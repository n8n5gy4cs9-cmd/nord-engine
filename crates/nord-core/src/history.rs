//! Version history (M10-31): cheap local snapshots of a project's *source* files (JSON data, event sheets, scripts, shaders, text)
//! under `<project>/.nord/history/<id>/`, with list / diff / restore. Binary assets (images, audio, models) are not copied: they are
//! large and the editor never rewrites them in place. Not a replacement for git — a safety net you do not have to think about.
use crate::vfs as fs;
use crate::vfs::PathExt;
use crate::{io, Error, Result};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};
use web_time::{SystemTime, UNIX_EPOCH};

pub const DIR: &str = ".nord/history";
const KEEP: usize = 50;
const MAX_FILE: u64 = 4 << 20;
const TEXT_EXT: &[&str] = &[
    "json", "js", "mjs", "ts", "css", "html", "md", "txt", "glsl", "wgsl", "toml", "rs", "svg",
    "csv", "frag", "vert",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Snapshot {
    pub id: String,
    pub label: String,
    /// seconds since the Unix epoch
    pub time: u64,
    pub files: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Change {
    Added,
    Removed,
    Modified,
}

fn skip_dir(name: &str) -> bool {
    name.starts_with('.') || matches!(name, "dist" | "target" | "node_modules")
}

/// Source files of the project (relative, `/`-separated), sorted.
pub fn source_files(root: &Path) -> Vec<String> {
    fn go(dir: &Path, rel: &str, out: &mut Vec<String>) {
        let Ok(rd) = fs::read_dir(dir) else { return };
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            let r = if rel.is_empty() {
                name.clone()
            } else {
                format!("{rel}/{name}")
            };
            let p = e.path();
            if p.v_is_dir() {
                if !skip_dir(&name) {
                    go(&p, &r, out);
                }
            } else if name != ".DS_Store"
                && p.extension().and_then(|x| x.to_str()).is_some_and(|x| TEXT_EXT.contains(&x.to_ascii_lowercase().as_str()))
                && fs::metadata(&p).is_ok_and(|m| m.len() <= MAX_FILE)
                // generated/vendored output is not "your" source
                && !r.starts_with("vendor/")
                && !r.starts_with("runtime/")
            {
                out.push(r);
            }
        }
    }
    let mut v = vec![];
    go(root, "", &mut v);
    v.sort();
    v
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

/// Take a snapshot. Returns its id (sortable by time).
pub fn snapshot(root: &Path, label: &str) -> Result<String> {
    let hist = root.join(DIR);
    // ids are strictly increasing even within one second (and after pruning): continue after the newest existing id
    let (mut t, mut n) = (now(), 0u32);
    if let Some(last) = list(root).last().and_then(|l| {
        l.id.split_once('-')
            .map(|(a, b)| (a.parse::<u64>().unwrap_or(0), b.parse::<u32>().unwrap_or(0)))
    }) {
        if last.0 >= t {
            t = last.0;
            n = last.1 + 1;
        }
    }
    let id = format!("{t:010}-{n:04}");
    let dir = hist.join(&id);
    let files = source_files(root);
    for f in &files {
        let dst = dir.join("files").join(f);
        fs::create_dir_all(dst.parent().unwrap()).map_err(|e| io::io_err(&dst, e))?;
        fs::copy(root.join(f), &dst).map_err(|e| io::io_err(&dst, e))?;
    }
    let meta = serde_json::json!({ "label": label, "time": t, "files": files.len() });
    io::write_atomic(&dir.join("meta.json"), meta.to_string().as_bytes())?;
    prune(root);
    Ok(id)
}

/// Snapshot unless the newest one is younger than `max_age_secs` (used by autosave-style hooks).
pub fn snapshot_if_stale(root: &Path, label: &str, max_age_secs: u64) -> Option<String> {
    let fresh = list(root)
        .last()
        .is_some_and(|l| now().saturating_sub(l.time) < max_age_secs);
    if fresh {
        return None;
    }
    snapshot(root, label).ok()
}

pub fn age_text(time: u64) -> String {
    let s = now().saturating_sub(time);
    match s {
        0..=59 => "just now".into(),
        60..=3599 => format!("{} min ago", s / 60),
        3600..=86399 => format!("{} h ago", s / 3600),
        _ => format!("{} days ago", s / 86400),
    }
}

fn prune(root: &Path) {
    let mut all = list(root);
    while all.len() > KEEP {
        let old = all.remove(0); // oldest first
        let _ = fs::remove_dir_all(root.join(DIR).join(old.id));
    }
}

/// Snapshots, oldest first.
pub fn list(root: &Path) -> Vec<Snapshot> {
    let Ok(rd) = fs::read_dir(root.join(DIR)) else {
        return vec![];
    };
    let mut v: Vec<Snapshot> = rd
        .flatten()
        .filter_map(|e| {
            let id = e.file_name().to_string_lossy().into_owned();
            let m: serde_json::Value =
                serde_json::from_slice(&fs::read(e.path().join("meta.json")).ok()?).ok()?;
            Some(Snapshot {
                id,
                label: m["label"].as_str().unwrap_or("").into(),
                time: m["time"].as_u64().unwrap_or(0),
                files: m["files"].as_u64().unwrap_or(0) as usize,
            })
        })
        .collect();
    v.sort_by(|a, b| a.id.cmp(&b.id));
    v
}

fn snap_files(root: &Path, id: &str) -> Result<BTreeMap<String, PathBuf>> {
    let base = root.join(DIR).join(id).join("files");
    if !base.v_is_dir() {
        return Err(Error::Msg(format!("no snapshot '{id}'")));
    }
    let mut m = BTreeMap::new();
    fn go(dir: &Path, rel: &str, m: &mut BTreeMap<String, PathBuf>) {
        let Ok(rd) = fs::read_dir(dir) else { return };
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            let r = if rel.is_empty() {
                name
            } else {
                format!("{rel}/{name}")
            };
            if e.path().v_is_dir() {
                go(&e.path(), &r, m);
            } else {
                m.insert(r, e.path());
            }
        }
    }
    go(&base, "", &mut m);
    Ok(m)
}

/// What changed in the working tree compared with snapshot `id` (relative path, change).
pub fn diff(root: &Path, id: &str) -> Result<Vec<(String, Change)>> {
    let snap = snap_files(root, id)?;
    let now: Vec<String> = source_files(root);
    let mut out = vec![];
    for f in &now {
        match snap.get(f) {
            None => out.push((f.clone(), Change::Added)),
            Some(p) if fs::read(p).ok() != fs::read(root.join(f)).ok() => {
                out.push((f.clone(), Change::Modified))
            }
            _ => {}
        }
    }
    for f in snap.keys() {
        if !now.contains(f) {
            out.push((f.clone(), Change::Removed));
        }
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(out)
}

/// Line diff of one file between snapshot and now: `(tag, line)` with tag ' ' same, '-' only in the snapshot, '+' only now.
pub fn file_diff(root: &Path, id: &str, rel: &str) -> Result<Vec<(char, String)>> {
    let snap = snap_files(root, id)?;
    let old = snap
        .get(rel)
        .and_then(|p| fs::read_to_string(p).ok())
        .unwrap_or_default();
    let new = fs::read_to_string(root.join(rel)).unwrap_or_default();
    Ok(line_diff(&old, &new))
}

/// Minimal LCS line diff (inputs beyond 4000 lines fall back to "all removed, all added").
pub fn line_diff(old: &str, new: &str) -> Vec<(char, String)> {
    let a: Vec<&str> = old.lines().collect();
    let b: Vec<&str> = new.lines().collect();
    // trim common prefix/suffix first: the table only covers the changed middle
    let pre = a.iter().zip(&b).take_while(|(x, y)| x == y).count();
    let suf = a[pre..]
        .iter()
        .rev()
        .zip(b[pre..].iter().rev())
        .take_while(|(x, y)| x == y)
        .count();
    let (ma, mb) = (&a[pre..a.len() - suf], &b[pre..b.len() - suf]);
    let mut out: Vec<(char, String)> = a[..pre].iter().map(|l| (' ', (*l).into())).collect();
    if ma.len() > 4000 || mb.len() > 4000 {
        out.extend(ma.iter().map(|l| ('-', (*l).into())));
        out.extend(mb.iter().map(|l| ('+', (*l).into())));
    } else {
        let (n, m) = (ma.len(), mb.len());
        let mut t = vec![vec![0u32; m + 1]; n + 1];
        for i in (0..n).rev() {
            for j in (0..m).rev() {
                t[i][j] = if ma[i] == mb[j] {
                    t[i + 1][j + 1] + 1
                } else {
                    t[i + 1][j].max(t[i][j + 1])
                };
            }
        }
        let (mut i, mut j) = (0, 0);
        while i < n || j < m {
            if i < n && j < m && ma[i] == mb[j] {
                out.push((' ', ma[i].into()));
                i += 1;
                j += 1;
            } else if i < n && (j == m || t[i + 1][j] >= t[i][j + 1]) {
                out.push(('-', ma[i].into()));
                i += 1;
            } else {
                out.push(('+', mb[j].into()));
                j += 1;
            }
        }
    }
    out.extend(a[a.len() - suf..].iter().map(|l| (' ', (*l).into())));
    out
}

/// Restore the working tree's source files to snapshot `id`. A safety snapshot ("before restore") is taken first, so a restore can be undone.
/// Files added since the snapshot are removed; other (binary) files are untouched.
pub fn restore(root: &Path, id: &str) -> Result<String> {
    let snap = snap_files(root, id)?;
    let safety = snapshot(root, &format!("before restore of {id}"))?;
    for (f, src) in &snap {
        let dst = root.join(f);
        if let Some(p) = dst.parent() {
            fs::create_dir_all(p).map_err(|e| io::io_err(p, e))?;
        }
        fs::copy(src, &dst).map_err(|e| io::io_err(&dst, e))?;
    }
    for f in source_files(root) {
        if !snap.contains_key(&f) && f != "nord.project.json" {
            let _ = fs::remove_file(root.join(&f));
        }
    }
    Ok(safety)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(n: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nord-hist-{n}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(d.join("scenes")).unwrap();
        fs::create_dir_all(d.join("assets")).unwrap();
        d
    }

    #[test]
    fn snapshot_diff_restore_roundtrip() {
        let d = tmp("rt");
        fs::write(d.join("nord.project.json"), "{\"a\":1}").unwrap();
        fs::write(d.join("scenes/main.scene.json"), "one\ntwo\nthree\n").unwrap();
        fs::write(d.join("assets/pic.png"), [1u8, 2, 3]).unwrap();
        let a = snapshot(&d, "first").unwrap();
        assert_eq!(list(&d).len(), 1);
        assert_eq!(list(&d)[0].files, 2, "png is not a source file");
        assert!(diff(&d, &a).unwrap().is_empty());
        fs::write(d.join("scenes/main.scene.json"), "one\n2\nthree\nfour\n").unwrap();
        fs::write(d.join("new.js"), "x").unwrap();
        fs::remove_file(d.join("nord.project.json")).unwrap();
        let df = diff(&d, &a).unwrap();
        assert_eq!(
            df,
            vec![
                ("new.js".into(), Change::Added),
                ("nord.project.json".into(), Change::Removed),
                ("scenes/main.scene.json".into(), Change::Modified)
            ]
        );
        let ld = file_diff(&d, &a, "scenes/main.scene.json").unwrap();
        assert_eq!(
            ld.iter()
                .filter(|(t, _)| *t != ' ')
                .cloned()
                .collect::<Vec<_>>(),
            vec![
                ('-', "two".to_string()),
                ('+', "2".to_string()),
                ('+', "four".to_string())
            ]
        );
        let safety = restore(&d, &a).unwrap();
        assert_eq!(
            fs::read_to_string(d.join("scenes/main.scene.json")).unwrap(),
            "one\ntwo\nthree\n"
        );
        assert!(d.join("nord.project.json").v_exists() && !d.join("new.js").v_exists());
        assert!(d.join("assets/pic.png").v_exists());
        // the restore itself can be undone
        restore(&d, &safety).unwrap();
        assert!(d.join("new.js").v_exists());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn line_diff_basic() {
        let d = line_diff("a\nb\nc", "a\nc\nd");
        let tags: String = d.iter().map(|(t, _)| *t).collect();
        assert_eq!(tags, " - +");
    }

    #[test]
    fn prunes_old_snapshots() {
        let d = tmp("prune");
        fs::write(d.join("nord.project.json"), "{}").unwrap();
        for i in 0..KEEP + 3 {
            snapshot(&d, &format!("s{i}")).unwrap();
        }
        let l = list(&d);
        assert_eq!(l.len(), KEEP);
        assert_eq!(l.last().unwrap().label, format!("s{}", KEEP + 2));
        let _ = fs::remove_dir_all(&d);
    }
}
