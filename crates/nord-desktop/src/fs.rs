//! Scoped file API. Paths are either `root:relative/path` (`appData`, `documents`, `downloads`, `temp`), a bare relative path (= appData)
//! or an absolute path inside a user-picked file/folder. Anything else is `denied`. Symlinks are resolved before the containment check.
use crate::{caps::Permissions, paths::Roots, DesktopError, Result};
use serde::Serialize;
use std::{
    collections::BTreeMap,
    path::{Component, Path, PathBuf},
    sync::Arc,
    time::UNIX_EPOCH,
};

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct Entry {
    pub name: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    pub size: u64,
    /// unix ms
    pub modified: u64,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct FsEvent {
    pub kind: &'static str, // created | modified | removed
    pub path: String,
}

pub struct ScopedFs {
    caps: Arc<Permissions>,
    roots: Arc<Roots>,
}

const NAMED: [&str; 4] = ["appData", "documents", "downloads", "temp"];

fn canon_lenient(p: &Path) -> std::io::Result<PathBuf> {
    // canonicalise the longest existing ancestor, then re-append the not-yet-existing tail (so new files can be checked)
    let mut tail = vec![];
    let mut cur = p.to_path_buf();
    loop {
        match cur.canonicalize() {
            Ok(c) => return Ok(tail.iter().rev().fold(c, |a, t| a.join(t))),
            Err(_) => match (
                cur.file_name().map(|f| f.to_os_string()),
                cur.parent().map(Path::to_path_buf),
            ) {
                (Some(f), Some(par)) => {
                    tail.push(f);
                    cur = par;
                }
                _ => {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        "no existing ancestor",
                    ))
                }
            },
        }
    }
}

fn clean_rel(rel: &str) -> Result<PathBuf> {
    if rel.contains('\0') {
        return Err(DesktopError::invalid("NUL in path"));
    }
    let mut out = PathBuf::new();
    for c in Path::new(rel).components() {
        match c {
            Component::Normal(n) => {
                let s = n.to_string_lossy();
                // Windows-only hazards are rejected everywhere so an app behaves the same on every OS
                let stem = s.split('.').next().unwrap_or("").to_ascii_uppercase();
                let reserved = ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
                    || (stem.len() == 4
                        && (stem.starts_with("COM") || stem.starts_with("LPT"))
                        && stem.as_bytes()[3].is_ascii_digit());
                if s.contains(':')
                    || s.contains('\\')
                    || reserved
                    || s.ends_with(' ')
                    || s.ends_with('.') && s != "."
                {
                    return Err(DesktopError::denied(format!(
                        "illegal path component '{s}'"
                    )));
                }
                out.push(n);
            }
            Component::CurDir => {}
            _ => {
                return Err(DesktopError::denied(
                    "path must be relative and may not contain '..'",
                ))
            }
        }
    }
    Ok(out)
}

impl ScopedFs {
    pub fn new(caps: Arc<Permissions>, roots: Arc<Roots>) -> Self {
        Self { caps, roots }
    }

    fn granted(&self, root: &str) -> bool {
        root == "appData" || self.caps.fs.roots.iter().any(|r| r == root)
    }

    /// Resolve + authorise. `write` additionally needs `fs.write` (appData is always writable).
    pub fn resolve(&self, spec: &str, write: bool) -> Result<PathBuf> {
        let (root_name, base, joined): (&str, PathBuf, PathBuf) =
            if let Some((l, r)) = spec.split_once(':').filter(|(l, _)| NAMED.contains(l)) {
                let base = self.roots.named(l).unwrap().to_path_buf();
                let rel = clean_rel(r.trim_start_matches(['/', '\\']))?;
                (l, base.clone(), base.join(rel))
            } else if Path::new(spec).is_absolute() {
                if spec.contains('\0')
                    || Path::new(spec)
                        .components()
                        .any(|c| matches!(c, Component::ParentDir))
                {
                    return Err(DesktopError::denied("'..' not allowed"));
                }
                if !self.granted("picked") {
                    return Err(DesktopError::denied(
                        "absolute path: 'picked' root not granted",
                    ));
                }
                let p = PathBuf::from(spec);
                let base = self
                    .roots
                    .picked()
                    .into_iter()
                    .find(|b| p.starts_with(b))
                    .ok_or_else(|| {
                        DesktopError::denied("path was not chosen by the user in a dialog")
                    })?;
                ("picked", base, p)
            } else {
                let base = self.roots.app_data().to_path_buf();
                ("appData", base.clone(), base.join(clean_rel(spec)?))
            };
        if !self.granted(root_name) {
            return Err(DesktopError::denied(format!(
                "root '{root_name}' not granted"
            )));
        }
        if write && root_name != "appData" && !self.caps.fs.write {
            return Err(DesktopError::denied("fs.write not granted"));
        }
        // symlink-safe containment
        let _ = std::fs::create_dir_all(&base);
        let cb = base.canonicalize().map_err(DesktopError::from)?;
        let cj = canon_lenient(&joined).map_err(DesktopError::from)?;
        if !cj.starts_with(&cb) {
            return Err(DesktopError::denied("path escapes its root"));
        }
        Ok(cj)
    }

    pub fn read(&self, p: &str) -> Result<Vec<u8>> {
        Ok(std::fs::read(self.resolve(p, false)?)?)
    }
    pub fn read_text(&self, p: &str) -> Result<String> {
        String::from_utf8(self.read(p)?)
            .map_err(|_| DesktopError::invalid("file is not valid UTF-8"))
    }
    /// Atomic: writes `<file>.nord-tmp` then renames. Creates parent folders.
    pub fn write(&self, p: &str, data: &[u8]) -> Result<()> {
        let f = self.resolve(p, true)?;
        if let Some(d) = f.parent() {
            std::fs::create_dir_all(d)?;
        }
        let tmp = f.with_extension(format!(
            "{}nord-tmp",
            f.extension()
                .map(|e| format!("{}.", e.to_string_lossy()))
                .unwrap_or_default()
        ));
        std::fs::write(&tmp, data)?;
        std::fs::rename(&tmp, &f).inspect_err(|_| {
            let _ = std::fs::remove_file(&tmp);
        })?;
        Ok(())
    }
    pub fn append(&self, p: &str, data: &[u8]) -> Result<()> {
        use std::io::Write;
        let f = self.resolve(p, true)?;
        if let Some(d) = f.parent() {
            std::fs::create_dir_all(d)?;
        }
        Ok(std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(f)?
            .write_all(data)?)
    }
    pub fn exists(&self, p: &str) -> Result<bool> {
        Ok(self.resolve(p, false)?.exists())
    }
    fn entry(name: String, m: &std::fs::Metadata) -> Entry {
        let modified = m
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_millis() as u64);
        Entry {
            name,
            is_dir: m.is_dir(),
            size: if m.is_dir() { 0 } else { m.len() },
            modified,
        }
    }
    pub fn stat(&self, p: &str) -> Result<Entry> {
        let f = self.resolve(p, false)?;
        Ok(Self::entry(
            f.file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            &std::fs::metadata(&f)?,
        ))
    }
    pub fn list(&self, p: &str) -> Result<Vec<Entry>> {
        let mut v = vec![];
        for e in std::fs::read_dir(self.resolve(p, false)?)? {
            let e = e?;
            v.push(Self::entry(
                e.file_name().to_string_lossy().into_owned(),
                &e.metadata()?,
            ));
        }
        v.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(v)
    }
    pub fn mkdir(&self, p: &str) -> Result<()> {
        Ok(std::fs::create_dir_all(self.resolve(p, true)?)?)
    }
    /// Files and (with `recursive`) folders. A root itself can never be removed.
    pub fn remove(&self, p: &str, recursive: bool) -> Result<()> {
        let f = self.resolve(p, true)?;
        let is_root = [
            self.roots.app_data(),
            self.roots.documents(),
            self.roots.downloads(),
            self.roots.temp(),
        ]
        .iter()
        .chain(
            self.roots
                .picked()
                .iter()
                .map(|x| x.as_path())
                .collect::<Vec<_>>()
                .iter(),
        )
        .any(|r| r.canonicalize().is_ok_and(|c| c == f));
        if is_root {
            return Err(DesktopError::denied("cannot remove a root folder"));
        }
        if f.is_dir() {
            if recursive {
                std::fs::remove_dir_all(f)?
            } else {
                std::fs::remove_dir(f)?
            }
        } else {
            std::fs::remove_file(f)?
        }
        Ok(())
    }
    pub fn rename(&self, from: &str, to: &str) -> Result<()> {
        let (a, b) = (self.resolve(from, true)?, self.resolve(to, true)?);
        if let Some(d) = b.parent() {
            std::fs::create_dir_all(d)?;
        }
        Ok(std::fs::rename(a, b)?)
    }
    pub fn copy(&self, from: &str, to: &str) -> Result<()> {
        let (a, b) = (self.resolve(from, false)?, self.resolve(to, true)?);
        if let Some(d) = b.parent() {
            std::fs::create_dir_all(d)?;
        }
        std::fs::copy(a, b)?;
        Ok(())
    }
    /// Polling watcher (snapshot diff): call [`Watcher::poll`] from a timer; no OS notification dependency.
    pub fn watch(&self, p: &str, recursive: bool) -> Result<Watcher> {
        let root = self.resolve(p, false)?;
        let snap = snapshot(&root, recursive);
        Ok(Watcher {
            root,
            recursive,
            snap,
            spec: p.to_string(),
        })
    }
}

pub struct Watcher {
    root: PathBuf,
    recursive: bool,
    snap: BTreeMap<PathBuf, (u64, u64)>,
    spec: String,
}

fn snapshot(root: &Path, recursive: bool) -> BTreeMap<PathBuf, (u64, u64)> {
    let mut m = BTreeMap::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&d) else {
            if d == root {
                if let Ok(md) = std::fs::metadata(&d) {
                    m.insert(d.clone(), (md.len(), 0));
                }
            }
            continue;
        };
        for e in rd.flatten() {
            let Ok(md) = e.metadata() else { continue };
            let t = md
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map_or(0, |d| d.as_nanos() as u64);
            m.insert(e.path(), (md.len(), t));
            if recursive && md.is_dir() {
                stack.push(e.path());
            }
        }
    }
    if root.is_file() {
        if let Ok(md) = std::fs::metadata(root) {
            m.insert(
                root.to_path_buf(),
                (
                    md.len(),
                    md.modified()
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map_or(0, |d| d.as_nanos() as u64),
                ),
            );
        }
    }
    m
}

impl Watcher {
    pub fn poll(&mut self) -> Vec<FsEvent> {
        let now = snapshot(&self.root, self.recursive);
        let mut ev = vec![];
        let rel = |p: &Path| {
            format!(
                "{}{}",
                self.spec.trim_end_matches('/'),
                p.strip_prefix(&self.root)
                    .map(|r| if r.as_os_str().is_empty() {
                        String::new()
                    } else {
                        format!("/{}", r.to_string_lossy())
                    })
                    .unwrap_or_default()
            )
        };
        for (p, v) in &now {
            match self.snap.get(p) {
                None => ev.push(FsEvent {
                    kind: "created",
                    path: rel(p),
                }),
                Some(o) if o != v => ev.push(FsEvent {
                    kind: "modified",
                    path: rel(p),
                }),
                _ => {}
            }
        }
        for p in self.snap.keys() {
            if !now.contains_key(p) {
                ev.push(FsEvent {
                    kind: "removed",
                    path: rel(p),
                });
            }
        }
        self.snap = now;
        ev
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup(p: Permissions) -> (tempfile::TempDir, ScopedFs, Arc<Roots>) {
        let d = tempfile::tempdir().unwrap();
        let r = Arc::new(Roots::with_base("app", d.path()));
        (d, ScopedFs::new(Arc::new(p), r.clone()), r)
    }
    fn docs() -> Permissions {
        let mut p = Permissions::default();
        p.fs.roots = vec!["documents".into(), "picked".into()];
        p.fs.write = true;
        p
    }

    #[test]
    fn app_data_roundtrip_and_ops() {
        let (_d, fs, _) = setup(Permissions::default());
        fs.write("notes/a.txt", b"hi").unwrap();
        assert_eq!(fs.read_text("appData:notes/a.txt").unwrap(), "hi");
        fs.append("notes/a.txt", b"!").unwrap();
        assert_eq!(fs.read_text("notes/a.txt").unwrap(), "hi!");
        fs.copy("notes/a.txt", "b.txt").unwrap();
        fs.rename("b.txt", "c/d.txt").unwrap();
        assert!(fs.exists("c/d.txt").unwrap() && !fs.exists("b.txt").unwrap());
        let l = fs.list("").unwrap();
        assert_eq!(
            l.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(),
            ["c", "notes", "store.json"]
                .iter()
                .filter(|n| l.iter().any(|e| e.name == **n))
                .copied()
                .collect::<Vec<_>>()
        );
        assert_eq!(fs.stat("notes/a.txt").unwrap().size, 3);
        fs.remove("c", true).unwrap();
        assert_eq!(fs.read("c/d.txt").unwrap_err().code, "not_found");
        assert!(fs.remove("", true).is_err(), "root cannot be removed");
    }

    #[test]
    fn ungranted_roots_and_write_are_denied() {
        let (_d, fs, _) = setup(Permissions::default());
        assert_eq!(fs.read("documents:x").unwrap_err().code, "denied");
        let mut ro = docs();
        ro.fs.write = false;
        let (_d2, fs2, _) = setup(ro);
        assert_eq!(
            fs2.write("documents:x.txt", b"1").unwrap_err().code,
            "denied"
        );
        assert!(fs2.write("own.txt", b"1").is_ok(), "appData stays writable");
    }

    #[test]
    fn traversal_and_hostile_names_are_rejected() {
        let (d, fs, _) = setup(docs());
        std::fs::create_dir_all(d.path().join("Documents")).unwrap();
        std::fs::write(d.path().join("secret.txt"), "s").unwrap();
        for bad in [
            "../secret.txt",
            "documents:../secret.txt",
            "documents:a/../../secret.txt",
            "documents:..\\secret",
            "documents:C:/x",
            "documents:file.txt:stream",
            "documents:CON",
            "documents:nul.txt",
            "documents:LPT1",
            "documents:trail.",
            "a\0b",
        ] {
            assert_eq!(
                fs.read(bad).unwrap_err().code,
                if bad.contains('\0') {
                    "invalid"
                } else {
                    "denied"
                },
                "{bad}"
            );
        }
        // absolute paths outside any picked location
        assert_eq!(
            fs.read(d.path().join("secret.txt").to_str().unwrap())
                .unwrap_err()
                .code,
            "denied"
        );
    }

    #[cfg(unix)]
    #[test]
    fn symlink_escape_is_blocked() {
        let (d, fs, _) = setup(docs());
        std::fs::create_dir_all(d.path().join("Documents")).unwrap();
        std::fs::write(d.path().join("secret.txt"), "s").unwrap();
        std::os::unix::fs::symlink(d.path(), d.path().join("Documents/out")).unwrap();
        std::os::unix::fs::symlink(
            d.path().join("secret.txt"),
            d.path().join("Documents/link.txt"),
        )
        .unwrap();
        assert_eq!(
            fs.read("documents:out/secret.txt").unwrap_err().code,
            "denied"
        );
        assert_eq!(fs.read("documents:link.txt").unwrap_err().code, "denied");
        assert_eq!(
            fs.write("documents:out/new.txt", b"x").unwrap_err().code,
            "denied"
        );
        assert!(!d.path().join("new.txt").exists());
    }

    #[test]
    fn picked_paths_are_the_only_absolute_paths() {
        let (d, fs, roots) = setup(docs());
        let outside = d.path().join("proj");
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(outside.join("a.md"), "x").unwrap();
        assert!(fs.read(outside.join("a.md").to_str().unwrap()).is_err());
        roots.add_picked(&outside);
        assert_eq!(
            fs.read_text(outside.join("a.md").to_str().unwrap())
                .unwrap(),
            "x"
        );
        fs.write(outside.join("sub/b.md").to_str().unwrap(), b"y")
            .unwrap();
        assert!(fs.read(d.path().join("secret").to_str().unwrap()).is_err());
        assert!(
            fs.remove(outside.to_str().unwrap(), true).is_err(),
            "picked root itself is protected"
        );
        let mut np = docs();
        np.fs.roots.retain(|r| r != "picked");
        let (_d3, fs3, r3) = setup(np);
        r3.add_picked(&outside);
        assert_eq!(
            fs3.read(outside.join("a.md").to_str().unwrap())
                .unwrap_err()
                .code,
            "denied"
        );
    }

    #[test]
    fn watcher_reports_changes() {
        let (_d, fs, _) = setup(Permissions::default());
        fs.write("w/a.txt", b"1").unwrap();
        let mut w = fs.watch("w", true).unwrap();
        assert!(w.poll().is_empty());
        fs.write("w/b.txt", b"22").unwrap();
        fs.write("w/a.txt", b"333").unwrap();
        let mut ev = w.poll();
        ev.sort_by(|a, b| a.path.cmp(&b.path));
        assert_eq!(
            ev,
            vec![
                FsEvent {
                    kind: "modified",
                    path: "w/a.txt".into()
                },
                FsEvent {
                    kind: "created",
                    path: "w/b.txt".into()
                }
            ]
        );
        fs.remove("w/a.txt", false).unwrap();
        assert_eq!(
            w.poll(),
            vec![FsEvent {
                kind: "removed",
                path: "w/a.txt".into()
            }]
        );
    }
}
