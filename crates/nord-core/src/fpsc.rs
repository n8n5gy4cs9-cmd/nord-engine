//! FPS Creator addon (docs/FPS_CREATOR.md): installs the runtime into a project and gives the level editor a small, jailed file API.
//!
//! * [`install`]  — copy `<engine>/runtime/fpsc` → `<project>/scripts/fpsc`, create `fpsc/bank.json`, a starter level and a scene that runs it.
//! * [`safe_path`] / [`ls`] / [`save`] — what `/api/fpsc/*` (nord-serve) allows the editor page to touch: `levels/` and `fpsc/` only.
use crate::{io, Error, Result};
use serde_json::{json, Value};
use std::path::{Component, Path, PathBuf};

/// Folders (relative to the project) the editor page may read/write.
pub const ALLOWED_DIRS: [&str; 5] = ["levels", "fpsc", "ui", "graphs", "models"];
/// File extensions the editor may write.
const ALLOWED_EXT: [&str; 19] = [
    "json", "js", "md", "txt", "png", "jpg", "jpeg", "webp", "gif", "glb", "gltf", "bin", "wav",
    "ogg", "mp3", "m4a", "flac", "obj", "mtl",
];
/// Largest single upload.
pub const MAX_BYTES: usize = 64 << 20;

fn err(msg: impl Into<String>) -> Error {
    Error::Msg(msg.into())
}

/// Validate a project-relative path from the editor: inside `levels/` or `fpsc/`, no `..`, no hidden parts, known extension.
pub fn safe_path(project: &Path, rel: &str) -> Result<PathBuf> {
    let p = Path::new(rel);
    if rel.is_empty()
        || rel.len() > 200
        || rel.contains('\\')
        || rel.contains('\0')
        || p.is_absolute()
    {
        return Err(err(format!("bad path: {rel}")));
    }
    let mut parts = vec![];
    for c in p.components() {
        match c {
            Component::Normal(s) => {
                let s = s.to_str().ok_or_else(|| err("bad path"))?;
                if s.starts_with('.') {
                    return Err(err("hidden path components are not allowed"));
                }
                parts.push(s.to_string());
            }
            _ => return Err(err(format!("bad path: {rel}"))),
        }
    }
    // `assets/ui/…` is also writable (images uploaded from the UI Designer)
    let ui_assets = parts.len() >= 3 && parts[0] == "assets" && parts[1] == "ui";
    if parts.len() < 2 || !(ALLOWED_DIRS.contains(&parts[0].as_str()) || ui_assets) {
        return Err(err(format!(
            "only {} may be written",
            ALLOWED_DIRS.join(" and ")
        )));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !ALLOWED_EXT.contains(&ext.as_str()) {
        return Err(err(format!("file type .{ext} is not allowed")));
    }
    Ok(project.join(p))
}

/// Entries of an allowed folder: `[{ "name", "size", "mtime" }]` sorted by name (non-recursive; folders get `"dir": true`).
pub fn ls(project: &Path, dir: &str) -> Result<Vec<Value>> {
    let d = dir.trim_matches('/');
    let first = d.split('/').next().unwrap_or("");
    if d.contains("..") || d.contains('\\') || !ALLOWED_DIRS.contains(&first) {
        return Err(err("folder not allowed"));
    }
    let mut out = vec![];
    let Ok(rd) = std::fs::read_dir(project.join(d)) else {
        return Ok(out);
    };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(md) = e.metadata() else { continue };
        let mtime = md
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_secs());
        out.push(json!({ "name": name, "size": md.len(), "mtime": mtime, "dir": md.is_dir() }));
    }
    out.sort_by(|a, b| a["name"].as_str().cmp(&b["name"].as_str()));
    Ok(out)
}

/// Write one file atomically.
pub fn save(project: &Path, rel: &str, bytes: &[u8]) -> Result<()> {
    if bytes.len() > MAX_BYTES {
        return Err(err("file too large"));
    }
    let p = safe_path(project, rel)?;
    io::write_atomic(&p, bytes)
}

fn copy_tree(from: &Path, to: &Path, files: &mut Vec<String>, root: &Path) -> Result<()> {
    std::fs::create_dir_all(to).map_err(|e| err(format!("{}: {e}", to.display())))?;
    let mut ents: Vec<_> = std::fs::read_dir(from)
        .map_err(|e| err(format!("{}: {e}", from.display())))?
        .flatten()
        .collect();
    ents.sort_by_key(|e| e.file_name());
    for e in ents {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || name.ends_with(".test.mjs") {
            continue;
        }
        let (src, dst) = (e.path(), to.join(&name));
        if src.is_dir() {
            copy_tree(&src, &dst, files, root)?;
        } else {
            let bytes = std::fs::read(&src).map_err(|e| err(format!("{}: {e}", src.display())))?;
            if std::fs::read(&dst).ok().as_deref() != Some(&bytes) {
                io::write_atomic(&dst, &bytes)?;
                files.push(
                    dst.strip_prefix(root)
                        .unwrap_or(&dst)
                        .to_string_lossy()
                        .replace('\\', "/"),
                );
            }
        }
    }
    Ok(())
}

/// Install / upgrade the FPS Creator runtime in a project. Never overwrites levels, `fpsc/bank.json`, your scripts or an existing scene.
/// Returns `{ "updated": [files written], "created": [new project files], "level": "...", "scene": "...", "warnings": [...] }`.
pub fn install(engine: &Path, project: &Path, set_start: bool) -> Result<Value> {
    let src = engine.join("runtime/fpsc");
    if !src.join("index.js").exists() {
        return Err(err(format!(
            "engine runtime/fpsc not found under {}",
            engine.display()
        )));
    }
    let mut updated = vec![];
    copy_tree(&src, &project.join("scripts/fpsc"), &mut updated, project)?;
    let (mut created, mut warnings) = (vec![], vec![]);
    let mut make = |rel: &str, text: &str| -> Result<()> {
        let p = project.join(rel);
        if !p.exists() {
            io::write_atomic(&p, text.as_bytes())?;
            created.push(rel.to_string());
        }
        Ok(())
    };
    make(
        "fpsc/bank.json",
        "{\n  \"textures\": [],\n  \"entities\": [],\n  \"sounds\": {},\n  \"scripts\": []\n}\n",
    )?;
    make("fpsc/README.md", README)?;
    let tpl = engine.join("templates/fps-creator/levels/level1.fpsl.json");
    let level_text = std::fs::read_to_string(&tpl).unwrap_or_else(|_| STARTER_LEVEL.to_string());
    make("levels/level1.fpsl.json", &level_text)?;
    let scene = "scenes/fps.scene.json";
    make(scene, &scene_json("levels/level1.fpsl.json"))?;
    // The project must be a 3D (Babylon) project to run it.
    if let Ok(text) = std::fs::read_to_string(project.join("nord.project.json")) {
        if let Ok(mut v) = serde_json::from_str::<Value>(&text) {
            if v["type"] != "3d" {
                warnings.push("This is not a 3D project — FPS levels need type \"3d\" (Babylon). Create a new project from the 'FPS Creator' template.".to_string());
            }
            if set_start && v["startScene"] != scene {
                v["startScene"] = json!(scene);
                io::write_atomic(
                    &project.join("nord.project.json"),
                    io::to_json(&v).as_bytes(),
                )?;
                created.push("nord.project.json (startScene → scenes/fps.scene.json)".to_string());
            }
        }
    } else {
        warnings.push("nord.project.json not found — run this inside a Nord project".to_string());
    }
    Ok(
        json!({ "updated": updated, "created": created, "level": "levels/level1.fpsl.json", "scene": scene, "warnings": warnings }),
    )
}

/// A scene holding one entity that runs the level script.
pub fn scene_json(level: &str) -> String {
    let v = json!({
        "format": 1, "name": "fps", "settings": {},
        "entities": [{
            "id": "fpsclvl1", "name": "FPS Level", "enabled": true, "tags": [], "layer": 0,
            "transform": { "pos": [0, 0, 0], "rot": [0, 0, 0], "scale": [1, 1, 1] },
            "components": [], "children": [], "prefab": null,
            "scripts": [{ "path": "scripts/fpsc/level-script.js", "attributes": { "level": level } }]
        }]
    });
    io::to_json(&v)
}

const README: &str = "# fpsc/ — your FPS Creator content\n\n- `bank.json` registers your own textures, wall pieces, entities, sounds and scripts.\n- `textures/`, `art/` (sprites), `models/` (.glb), `sounds/`, `scripts/` hold the files.\n- Levels live in `../levels/*.fpsl.json`. Edit them with the **FPS Level** tab (or open /editor/fpsc/index.html on `nord serve`).\n- The runtime is `../scripts/fpsc/` — re-run `nord fpsc init` after updating Nord to upgrade it (your files here are never touched).\n\nFull guide: docs/FPS_CREATOR.md.\n";

/// Tiny fallback so install works even if the template folder is missing from an engine checkout.
const STARTER_LEVEL: &str = r#"{"format":"fpsc-level/1","name":"Level 1","w":24,"d":24,"settings":{"sky":"day","ground":"grass"},"layers":[{"name":"Ground","cells":{"4,4":{"f":"floor_concrete","c":"ceiling_tiles"}},"edges":{}}],"entities":[{"id":"ps1","type":"player_start","x":18,"z":18,"layer":0,"rot":0,"props":{}}]}"#;

/// Where is `needle` (an action / event / file name) used in project code? Scans scripts, event sheets, graphs and scenes
/// (never vendor/library folders). Returns `[{ file, line, text }]`, at most 80, code files before data files.
pub fn usages(project: &Path, needle: &str) -> Result<Vec<Value>> {
    if needle.is_empty()
        || needle.len() > 80
        || !needle
            .chars()
            .all(|c| c.is_alphanumeric() || "_-.:/".contains(c))
    {
        return Err(err("bad search text"));
    }
    const SKIP: [&str; 9] = [
        "vendor",
        "node_modules",
        "target",
        "dist",
        "lib",
        "docs",
        "assets",
        "library",
        "runtime",
    ];
    fn walk(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
        let Ok(rd) = std::fs::read_dir(dir) else {
            return;
        };
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || SKIP.contains(&name.as_str()) {
                continue;
            }
            let p = e.path();
            if p.is_dir() {
                if depth < 6 {
                    walk(&p, depth + 1, out);
                }
            } else if matches!(
                p.extension().and_then(|x| x.to_str()),
                Some("js" | "mjs" | "ts" | "json")
            ) {
                out.push(p);
            }
        }
    }
    let mut files = vec![];
    walk(project, 0, &mut files);
    let mut hits: Vec<(bool, Value)> = vec![];
    for f in files {
        let Ok(md) = std::fs::metadata(&f) else {
            continue;
        };
        if md.len() > 600_000 {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(&f) else {
            continue;
        };
        let rel = f
            .strip_prefix(project)
            .unwrap_or(&f)
            .to_string_lossy()
            .replace('\\', "/");
        let data = rel.ends_with(".json");
        for (i, line) in text.lines().enumerate() {
            if line.contains(needle) && hits.len() < 400 {
                let t: String = line.trim().chars().take(180).collect();
                hits.push((data, json!({ "file": rel, "line": i + 1, "text": t })));
            }
        }
    }
    hits.sort_by_key(|(d, _)| *d);
    Ok(hits.into_iter().map(|(_, v)| v).take(80).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ui_assets_and_graphs_are_writable() {
        let p = Path::new("/proj");
        assert!(safe_path(p, "graphs/a.graph.json").is_ok());
        assert!(safe_path(p, "ui/menu.ui.json").is_ok());
        assert!(safe_path(p, "assets/ui/panel.png").is_ok());
        assert!(safe_path(p, "assets/other/panel.png").is_err());
        assert!(safe_path(p, "scripts/a.js").is_err());
    }

    #[test]
    fn usages_finds_quoted_names_in_code() {
        let d = std::env::temp_dir().join(format!("nord-usages-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("lib")).unwrap();
        std::fs::write(
            d.join("app.js"),
            "menu.on('play', () => {});\nconst x = 1;\n",
        )
        .unwrap();
        std::fs::write(d.join("lib/nord-ui.js"), "'play'").unwrap();
        let hits = usages(&d, "play").unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0]["file"], "app.js");
        assert_eq!(hits[0]["line"], 1);
        assert!(usages(&d, "bad name").is_err());
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn jail() {
        let p = Path::new("/proj");
        assert!(safe_path(p, "levels/a.fpsl.json").is_ok());
        assert!(safe_path(p, "fpsc/textures/x.png").is_ok());
        for bad in [
            "",
            "../x.json",
            "levels/../../x.json",
            "/etc/passwd",
            "levels",
            "scripts/a.js",
            "nord.project.json",
            "levels/.hidden.json",
            "levels/a.exe",
            "levels\\a.json",
            "fpsc/a.sh",
        ] {
            assert!(safe_path(p, bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn save_and_ls() {
        let d = std::env::temp_dir().join(format!("fpsc-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        save(&d, "levels/one.fpsl.json", b"{}").unwrap();
        save(&d, "fpsc/textures/t.png", &[1, 2, 3]).unwrap();
        save(&d, "models/m.mesh.json", b"{}").unwrap();
        assert!(save(&d, "scripts/evil.js", b"x").is_err());
        let l = ls(&d, "levels").unwrap();
        assert_eq!(l.len(), 1);
        assert_eq!(l[0]["name"], "one.fpsl.json");
        assert!(ls(&d, "scripts").is_err() && ls(&d, "..").is_err());
        let _ = std::fs::remove_dir_all(&d);
    }
}
