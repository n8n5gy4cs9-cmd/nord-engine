//! Asset bundles (`.nordpkg`): one object (a prefab) plus everything it needs (models, textures, materials, scripts, sheets…)
//! in a single zip, like Unity's "Export Package" / Godot's "Export Resource Pack". See docs/ASSET_BUNDLES.md.
//!
//! Export finds the dependencies by following every string that is the path of a project file, through JSON and script text,
//! transitively. Import copies the files to `<top>/bundles/<name>/<rest>` (so nothing in the project is overwritten) and
//! rewrites the quoted paths inside the imported text files.
use anyhow::{bail, Context, Result};
use nord_core::{
    assets::sha256_bytes,
    io,
    scene::{Entity, Prefab},
    vfs::{self, PathExt},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const EXT: &str = "nordpkg";
const KIND: &str = "nord-asset-bundle";
const MANIFEST: &str = "bundle.json";
const PAYLOAD: &str = "files/";
const MAX_FILE: u64 = 512 * 1024 * 1024;
/// Files whose text is scanned for further dependencies and has its paths rewritten on import.
const TEXT_EXT: [&str; 11] = [
    "json", "js", "mjs", "ts", "glsl", "frag", "vert", "wgsl", "gltf", "tmj", "txt",
];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

/// `bundle.json` inside the package.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Manifest {
    pub format: u32,
    pub kind: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    /// Engine version that wrote the bundle.
    #[serde(default)]
    pub engine: String,
    /// Project path of the bundle's prefab (also listed in `files`).
    pub prefab: String,
    pub files: Vec<FileEntry>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Exported {
    pub out: PathBuf,
    pub manifest: Manifest,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Imported {
    /// Folder name under `<top>/bundles/` (the bundle name, or `name-2` when that was taken).
    pub id: String,
    /// Project path of the imported prefab: drag it into a scene.
    pub prefab: String,
    pub files: Vec<String>,
    /// True when files from an earlier import were overwritten (`replace`).
    pub replaced: bool,
}

/// File-name safe version of a name (letters, digits, `-`, `_`).
pub fn slug(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let s = s.trim_matches('-').to_string();
    if s.is_empty() {
        "bundle".into()
    } else {
        s
    }
}

fn safe_rel(p: &str) -> bool {
    !p.is_empty()
        && !p.starts_with('/')
        && !p.contains('\\')
        && !p.contains(':')
        && p.split('/').all(|s| !s.is_empty() && s != "." && s != "..")
}

fn ext(p: &str) -> String {
    p.rsplit('.').next().unwrap_or("").to_ascii_lowercase()
}

fn is_text(p: &str) -> bool {
    TEXT_EXT.contains(&ext(p).as_str())
}

fn ignored(rel: &str) -> bool {
    rel == "nord.project.json"
        || rel == "index.html"
        || rel.ends_with(".nordpkg")
        || rel.ends_with(".meta.json")
        || rel.split('/').next().is_some_and(|t| {
            t.starts_with('.')
                || matches!(
                    t,
                    "runtime" | "vendor" | "dist" | "target" | "node_modules" | "exports"
                )
        })
}

/// `base_dir/s` with `.` and `..` folded; `None` when it climbs out of the project.
fn join_norm(base_dir: &str, s: &str) -> Option<String> {
    let mut parts: Vec<&str> = base_dir.split('/').filter(|x| !x.is_empty()).collect();
    for seg in s.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            x => parts.push(x),
        }
    }
    Some(parts.join("/"))
}

fn top(rel: &str) -> &str {
    rel.split('/').next().unwrap_or("")
}

fn dir_of(rel: &str) -> &str {
    rel.rsplit_once('/').map_or("", |(d, _)| d)
}

/// Text between matching quotes (`"`, `'`, `` ` ``) on one line.
fn quoted(text: &str) -> Vec<&str> {
    let mut out = vec![];
    for line in text.lines() {
        let b = line.as_bytes();
        let mut i = 0;
        while i < b.len() {
            if matches!(b[i], b'"' | b'\'' | b'`') {
                let q = b[i];
                if let Some(n) = b[i + 1..].iter().position(|&c| c == q) {
                    out.push(&line[i + 1..i + 1 + n]);
                    i += n + 2;
                    continue;
                }
            }
            i += 1;
        }
    }
    out
}

fn json_strings(v: &Value, out: &mut Vec<String>) {
    match v {
        Value::String(s) => out.push(s.clone()),
        Value::Array(a) => a.iter().for_each(|x| json_strings(x, out)),
        Value::Object(m) => m.values().for_each(|x| json_strings(x, out)),
        _ => {}
    }
}

fn strings_of_text(rel: &str, text: &str) -> Vec<String> {
    if matches!(ext(rel).as_str(), "json" | "gltf" | "tmj") {
        if let Ok(v) = serde_json::from_str::<Value>(text) {
            let mut out = vec![];
            json_strings(&v, &mut out);
            return out;
        }
    }
    quoted(text).into_iter().map(String::from).collect()
}

struct Gather<'a> {
    root: &'a Path,
    files: BTreeSet<String>,
    warnings: Vec<String>,
}

impl Gather<'_> {
    /// Resolve `s` (a string found in a file in `base_dir`) to a project file: project-relative first, then next to the file.
    fn resolve(&self, base_dir: &str, s: &str) -> Option<(String, bool)> {
        let s = s.trim();
        if s.is_empty()
            || s.len() > 300
            || s.contains("://")
            || s.starts_with('/')
            || s.contains('\n')
        {
            return None;
        }
        let direct = join_norm("", s)?;
        if safe_rel(&direct) && !ignored(&direct) && vfs::is_file(self.root.join(&direct)) {
            return Some((direct, false));
        }
        let near = join_norm(base_dir, s)?;
        (safe_rel(&near) && !ignored(&near) && vfs::is_file(self.root.join(&near)))
            .then_some((near, true))
    }

    fn add_strings(&mut self, base_dir: &str, from: &str, strings: Vec<String>) {
        let mut queue = vec![(base_dir.to_string(), from.to_string(), strings)];
        while let Some((dir, from, strings)) = queue.pop() {
            for s in strings {
                let Some((rel, near)) = self.resolve(&dir, &s) else {
                    continue;
                };
                if near && !from.is_empty() && top(&rel) != top(&from) {
                    self.warnings.push(format!(
                        "{from} refers to {rel} by a relative path; keep both in the same top folder or use a project path"
                    ));
                }
                if !self.files.insert(rel.clone()) {
                    continue;
                }
                let meta = format!("{rel}.meta.json");
                if vfs::is_file(self.root.join(&meta)) {
                    self.files.insert(meta);
                }
                if is_text(&rel)
                    && vfs::metadata(self.root.join(&rel))
                        .is_ok_and(|m| m.len() <= 16 * 1024 * 1024)
                {
                    if let Ok(text) = vfs::read_to_string(self.root.join(&rel)) {
                        queue.push((
                            dir_of(&rel).to_string(),
                            rel.clone(),
                            strings_of_text(&rel, &text),
                        ));
                    }
                }
            }
        }
    }
}

fn write_package(
    root: &Path,
    name: &str,
    description: &str,
    prefab_rel: &str,
    virt: BTreeMap<String, Vec<u8>>,
    mut g: Gather,
    out: Option<&Path>,
) -> Result<Exported> {
    g.files.remove(prefab_rel);
    let mut payload: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    for f in &g.files {
        let p = root.join(f);
        if vfs::metadata(&p).is_ok_and(|m| m.len() > MAX_FILE) {
            bail!("{f} is bigger than {} MB", MAX_FILE / 1024 / 1024);
        }
        payload.insert(f.clone(), vfs::read(&p).with_context(|| f.clone())?);
    }
    payload.extend(virt);
    let manifest = Manifest {
        format: 1,
        kind: KIND.into(),
        name: name.into(),
        description: description.into(),
        engine: env!("CARGO_PKG_VERSION").into(),
        prefab: prefab_rel.into(),
        files: payload
            .iter()
            .map(|(p, b)| FileEntry {
                path: p.clone(),
                size: b.len() as u64,
                sha256: sha256_bytes(b),
            })
            .collect(),
        warnings: g.warnings,
    };
    let target = out
        .map(Path::to_path_buf)
        .unwrap_or_else(|| root.join("exports").join(format!("{}.{EXT}", slug(name))));
    if let Some(d) = target.parent() {
        std::fs::create_dir_all(d)?;
    }
    let mut z = zip::ZipWriter::new(std::fs::File::create(&target)?);
    let opt = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    z.start_file(MANIFEST, opt)?;
    z.write_all(io::to_json(&manifest).as_bytes())?;
    for (p, b) in &payload {
        z.start_file(format!("{PAYLOAD}{p}"), opt)?;
        z.write_all(b)?;
    }
    z.finish()?;
    Ok(Exported {
        out: target,
        manifest,
    })
}

/// Export an entity of a scene (with all its children) as a bundle. The root is saved at the origin so it drops cleanly into another scene.
pub fn export_entity(root: &Path, entity: &Entity, out: Option<&Path>) -> Result<Exported> {
    let name = entity.name.clone();
    let mut e = entity.clone();
    e.transform.pos = [0.0; 3];
    e.locked = false;
    e.hidden = false;
    // a prefab instance exports its prefab, as a variant when the instance has overrides
    if let Some(pr) = entity.prefab.clone() {
        let base = root.join(&pr.path);
        let file: Prefab = io::load_json(&base).with_context(|| format!("prefab {}", pr.path))?;
        if pr.overrides.is_empty() {
            return export_prefab_file(root, &pr.path, &file, &name, out);
        }
        let variant = Prefab {
            format: file.format,
            root: file.root,
            variant_of: Some(pr.path.clone()),
            overrides: pr.overrides,
        };
        let rel = format!("prefabs/{}.prefab.json", slug(&name));
        return export_prefab_file(root, &rel, &variant, &name, out);
    }
    e.prefab = None;
    let prefab = Prefab {
        format: nord_core::FORMAT,
        root: e,
        variant_of: None,
        overrides: Default::default(),
    };
    let rel = format!("prefabs/{}.prefab.json", slug(&name));
    export_prefab_file(root, &rel, &prefab, &name, out)
}

/// Export a prefab file of the project (`prefabs/x.prefab.json`) as a bundle.
pub fn export_prefab(root: &Path, prefab_rel: &str, out: Option<&Path>) -> Result<Exported> {
    if !safe_rel(prefab_rel) {
        bail!("{prefab_rel}: not a project path");
    }
    let file: Prefab =
        io::load_json(&root.join(prefab_rel)).with_context(|| prefab_rel.to_string())?;
    let name = file.root.name.clone();
    export_prefab_file(root, prefab_rel, &file, &name, out)
}

fn export_prefab_file(
    root: &Path,
    rel: &str,
    prefab: &Prefab,
    name: &str,
    out: Option<&Path>,
) -> Result<Exported> {
    let body = io::to_json(prefab).into_bytes();
    let mut g = Gather {
        root,
        files: BTreeSet::new(),
        warnings: vec![],
    };
    let mut strings = vec![];
    json_strings(&serde_json::to_value(prefab)?, &mut strings);
    g.add_strings(dir_of(rel), "", strings);
    let mut virt = BTreeMap::new();
    virt.insert(rel.to_string(), body);
    write_package(root, name, "", rel, virt, g, out)
}

/// Read and validate `bundle.json` of a package (no files are extracted).
pub fn read_manifest(pkg: &Path) -> Result<Manifest> {
    let mut z =
        zip::ZipArchive::new(std::fs::File::open(pkg).with_context(|| pkg.display().to_string())?)?;
    manifest_of(&mut z)
}

fn manifest_of<R: Read + std::io::Seek>(z: &mut zip::ZipArchive<R>) -> Result<Manifest> {
    let mut s = String::new();
    z.by_name(MANIFEST)
        .context("not a Nord bundle: bundle.json is missing")?
        .read_to_string(&mut s)?;
    let m: Manifest = serde_json::from_str(&s).context("bundle.json: invalid")?;
    if m.kind != KIND {
        bail!("bundle.json: kind is '{}', expected '{KIND}'", m.kind);
    }
    if m.format != 1 {
        bail!(
            "bundle format {} is newer than this engine understands",
            m.format
        );
    }
    if !m.files.iter().all(|f| safe_rel(&f.path)) {
        bail!("bundle.json: unsafe file path");
    }
    if !m.files.iter().any(|f| f.path == m.prefab) {
        bail!("bundle.json: prefab {} is not in the file list", m.prefab);
    }
    Ok(m)
}

/// Where `rel` lands for bundle folder `id`: `assets/a/b.png` → `assets/bundles/<id>/a/b.png`.
fn dest(id: &str, rel: &str) -> String {
    match rel.split_once('/') {
        Some((t, rest)) => format!("{t}/bundles/{id}/{rest}"),
        None => format!("bundles/{id}/{rel}"),
    }
}

fn rewrite(text: &str, map: &BTreeMap<String, String>) -> String {
    let mut s = text.to_string();
    for (from, to) in map {
        for q in ['"', '\'', '`'] {
            s = s.replace(&format!("{q}{from}{q}"), &format!("{q}{to}{q}"));
        }
    }
    s
}

/// Import a bundle into `project`. Files go to `<top>/bundles/<name>/…`; with `replace` an earlier import of the same name is
/// overwritten, otherwise a free name (`name-2`…) is used.
pub fn import(pkg: &Path, project: &Path, replace: bool) -> Result<Imported> {
    let mut z =
        zip::ZipArchive::new(std::fs::File::open(pkg).with_context(|| pkg.display().to_string())?)?;
    let m = manifest_of(&mut z)?;
    let mut data: BTreeMap<String, Vec<u8>> = BTreeMap::new();
    for f in &m.files {
        let mut e = z
            .by_name(&format!("{PAYLOAD}{}", f.path))
            .with_context(|| format!("{} is listed but missing in the bundle", f.path))?;
        if e.size() > MAX_FILE {
            bail!("{} is too big", f.path);
        }
        let mut b = Vec::with_capacity(e.size() as usize);
        e.read_to_end(&mut b)?;
        if sha256_bytes(&b) != f.sha256 {
            bail!("{} is damaged (checksum differs)", f.path);
        }
        data.insert(f.path.clone(), b);
    }
    let base = slug(&m.name).to_ascii_lowercase();
    let taken = |id: &str| {
        m.files
            .iter()
            .any(|f| project.join(dest(id, &f.path)).v_exists())
    };
    let mut id = base.clone();
    let mut n = 1;
    while !replace && taken(&id) {
        n += 1;
        id = format!("{base}-{n}");
    }
    let replaced = replace && taken(&id);
    let map: BTreeMap<String, String> = m
        .files
        .iter()
        .map(|f| (f.path.clone(), dest(&id, &f.path)))
        .collect();
    let mut written = vec![];
    for (rel, bytes) in data {
        let to = &map[&rel];
        let out = match (is_text(&rel), std::str::from_utf8(&bytes)) {
            (true, Ok(t)) => rewrite(t, &map).into_bytes(),
            _ => bytes,
        };
        io::write_atomic(&project.join(to), &out)?;
        written.push(to.clone());
    }
    Ok(Imported {
        prefab: map[&m.prefab].clone(),
        id,
        files: written,
        replaced,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nord-bundle-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    fn put(root: &Path, rel: &str, body: &str) {
        let p = root.join(rel);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, body).unwrap();
    }

    fn project() -> (PathBuf, Entity) {
        let root = tmp("src");
        put(
            &root,
            "assets/materials/red.mat.json",
            r##"{"color":"#f00","map":"assets/tex/wall.png"}"##,
        );
        put(&root, "assets/tex/wall.png", "png");
        put(&root, "assets/tex/wall.png.meta.json", "{}");
        put(&root, "assets/unused.png", "x");
        put(&root, "scripts/Clock.js", "import H from './Hands.js'; const m = 'assets/models/clock.glb'; load(\"assets/sfx/tick.ogg\")");
        put(&root, "scripts/Hands.js", "export default 1");
        put(&root, "assets/models/clock.glb", "glb");
        put(&root, "assets/sfx/tick.ogg", "ogg");
        let mut e = Entity::new("Analog Clock");
        e.transform.pos = [5.0, 2.0, 1.0];
        e.components.push(nord_core::scene::Component {
            kind: "model".into(),
            fields: serde_json::from_str(
                r#"{"src":"assets/models/clock.glb","material":"assets/materials/red.mat.json"}"#,
            )
            .unwrap(),
        });
        e.scripts.push(nord_core::scene::ScriptRef {
            path: "scripts/Clock.js".into(),
            attributes: Default::default(),
        });
        (root, e)
    }

    #[test]
    fn export_follows_dependencies_transitively() {
        let (root, e) = project();
        let x = export_entity(&root, &e, None).unwrap();
        let paths: Vec<_> = x.manifest.files.iter().map(|f| f.path.as_str()).collect();
        for want in [
            "prefabs/Analog-Clock.prefab.json",
            "assets/models/clock.glb",
            "assets/materials/red.mat.json",
            "assets/tex/wall.png",
            "assets/tex/wall.png.meta.json",
            "scripts/Clock.js",
            "scripts/Hands.js",
            "assets/sfx/tick.ogg",
        ] {
            assert!(paths.contains(&want), "{want} missing from {paths:?}");
        }
        assert!(!paths.contains(&"assets/unused.png"));
        let p: Prefab = serde_json::from_slice(
            read_zip(&x.out, "files/prefabs/Analog-Clock.prefab.json").as_slice(),
        )
        .unwrap();
        assert_eq!(
            p.root.transform.pos, [0.0; 3],
            "root is saved at the origin"
        );
    }

    fn read_zip(pkg: &Path, name: &str) -> Vec<u8> {
        let mut z = zip::ZipArchive::new(std::fs::File::open(pkg).unwrap()).unwrap();
        let mut b = vec![];
        z.by_name(name).unwrap().read_to_end(&mut b).unwrap();
        b
    }

    #[test]
    fn import_remaps_paths_and_never_overwrites() {
        let (root, e) = project();
        let x = export_entity(&root, &e, None).unwrap();
        let dst = tmp("dst");
        put(&dst, "nord.project.json", "{}");
        let a = import(&x.out, &dst, false).unwrap();
        assert_eq!(a.id, "analog-clock");
        assert_eq!(
            a.prefab,
            "prefabs/bundles/analog-clock/Analog-Clock.prefab.json"
        );
        let prefab = std::fs::read_to_string(dst.join(&a.prefab)).unwrap();
        assert!(prefab.contains("assets/bundles/analog-clock/models/clock.glb"));
        assert!(prefab.contains("scripts/bundles/analog-clock/Clock.js"));
        let js =
            std::fs::read_to_string(dst.join("scripts/bundles/analog-clock/Clock.js")).unwrap();
        assert!(
            js.contains("'assets/bundles/analog-clock/models/clock.glb'"),
            "{js}"
        );
        assert!(
            js.contains("./Hands.js"),
            "relative import stays valid next to it"
        );
        let mat =
            std::fs::read_to_string(dst.join("assets/bundles/analog-clock/materials/red.mat.json"))
                .unwrap();
        assert!(mat.contains("assets/bundles/analog-clock/tex/wall.png"));
        // second import: new folder; replace: same folder
        let b = import(&x.out, &dst, false).unwrap();
        assert_eq!(b.id, "analog-clock-2");
        let c = import(&x.out, &dst, true).unwrap();
        assert!(c.replaced && c.id == "analog-clock");
    }

    #[test]
    fn damaged_or_foreign_files_are_rejected() {
        let d = tmp("bad");
        let p = d.join("x.nordpkg");
        let mut z = zip::ZipWriter::new(std::fs::File::create(&p).unwrap());
        z.start_file("hello.txt", zip::write::SimpleFileOptions::default())
            .unwrap();
        z.write_all(b"hi").unwrap();
        z.finish().unwrap();
        assert!(read_manifest(&p).is_err());
        assert!(!safe_rel("../x") && !safe_rel("/x") && safe_rel("a/b.png"));
    }

    #[test]
    fn prefab_instance_with_overrides_exports_a_variant() {
        let (root, e) = project();
        let x = export_entity(&root, &e, None).unwrap();
        let dst = tmp("inst");
        put(&dst, "nord.project.json", "{}");
        let a = import(&x.out, &dst, false).unwrap();
        let mut inst = Entity::new("Clock instance");
        inst.prefab = Some(nord_core::scene::PrefabRef {
            path: a.prefab.clone(),
            overrides: serde_json::from_str(r#"{"layer":3}"#).unwrap(),
        });
        let y = export_entity(&dst, &inst, Some(&dst.join("v.nordpkg"))).unwrap();
        let v: Prefab = serde_json::from_slice(&read_zip(
            &y.out,
            &format!("files/prefabs/{}.prefab.json", slug("Clock instance")),
        ))
        .unwrap();
        assert_eq!(v.variant_of.as_deref(), Some(a.prefab.as_str()));
        assert!(
            y.manifest.files.iter().any(|f| f.path == a.prefab),
            "base prefab is bundled"
        );
    }
}
