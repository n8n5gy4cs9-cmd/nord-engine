//! 2D Level Creator publication. Reuses ordinary scenes, library scripts and the export pipeline.
use crate::{io, Error, Result};
use serde_json::{json, Value};
use std::{
    collections::BTreeSet,
    path::{Component, Path, PathBuf},
};

pub const LIBRARY: &[&str] = &["platformer2d", "topdown", "pickup", "health", "ai-patrol"];
fn err(s: impl Into<String>) -> Error {
    Error::Msg(s.into())
}

/// Reject traversal and symlinks, including a symlinked ancestor of a not-yet-created file.
pub fn jailed(root: &Path, rel: &str) -> Result<PathBuf> {
    if rel.is_empty() || rel.contains('\\') || rel.contains('\0') || rel.len() > 240 {
        return Err(err("Invalid path"));
    }
    let mut out = root.to_path_buf();
    for c in Path::new(rel).components() {
        let Component::Normal(s) = c else {
            return Err(err("Invalid path"));
        };
        if s.to_string_lossy().starts_with('.') {
            return Err(err("Hidden path"));
        }
        out.push(s);
        if std::fs::symlink_metadata(&out).is_ok_and(|m| m.file_type().is_symlink()) {
            return Err(err("Symlinks are not allowed"));
        }
    }
    Ok(out)
}
pub fn bank(engine: &Path) -> Result<Value> {
    io::load_json(&engine.join("editor/level2d/bank.json"))
}

fn copy_preserving(src: &Path, dst: &Path) -> Result<()> {
    let bytes = std::fs::read(src).map_err(|e| io::io_err(src, e))?;
    if dst.exists() {
        if std::fs::read(dst).map_err(|e| io::io_err(dst, e))? != bytes {
            return Err(err(format!(
                "Existing file differs; move it before installing bundled content: {}",
                dst.display()
            )));
        }
    } else {
        io::write_atomic(dst, &bytes)?;
    }
    Ok(())
}
/// Publish only explicitly named level + scene and catalogue-approved bundled assets.
pub fn publish(engine: &Path, project: &Path, v: &Value) -> Result<Value> {
    let name = v["name"].as_str().unwrap_or("");
    if name.is_empty()
        || name.len() > 64
        || !name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    {
        return Err(err("Filename must contain letters, numbers, - or _"));
    }
    if v["level"]["format"] != "nord-level2d/1" || v["scene"]["format"] != 1 {
        return Err(err("Invalid level or scene format"));
    }
    // Parse the compiled scene using the same schema used by the builder.
    let _: crate::Scene =
        serde_json::from_value(v["scene"].clone()).map_err(|e| err(e.to_string()))?;
    let mut manifest: Value = io::load_json(&project.join("nord.project.json"))?;
    if manifest["type"] != "2d" {
        return Err(err("Open a 2D project to publish this level"));
    }
    let catalog = bank(engine)?;
    let entries = catalog["entries"]
        .as_array()
        .ok_or_else(|| err("Invalid bank"))?;
    let mut sources = BTreeSet::new();
    for id in v["assets"]
        .as_array()
        .ok_or_else(|| err("Missing asset list"))?
    {
        let a = entries
            .iter()
            .find(|a| a["id"] == *id)
            .ok_or_else(|| err("Unknown bundled sprite"))?;
        let source = a["source"].as_str().ok_or_else(|| err("Missing source"))?;
        if !source.starts_with("assets/packs/") {
            return Err(err("Invalid catalogue path"));
        }
        sources.insert(source.to_string());
    }
    // Preflight every destination before writing any content, including user-edited scripts.
    let mut copies = vec![];
    for source in &sources {
        copies.push((jailed(engine, source)?, jailed(project, source)?));
        let meta = format!("{source}.meta.json");
        if engine.join(&meta).exists() {
            copies.push((jailed(engine, &meta)?, jailed(project, &meta)?));
        }
        let license = if source.starts_with("assets/packs/nord-amiga/") {
            "assets/packs/nord-amiga/README.md".to_string()
        } else {
            let parts: Vec<_> = source.split('/').collect();
            format!("{}/LICENSE.md", parts[..4].join("/"))
        };
        copies.push((jailed(engine, &license)?, jailed(project, &license)?));
    }
    for id in LIBRARY
        .iter()
        .copied()
        .chain(["level-actions", "level-hud", "level-animate"])
    {
        let src = if LIBRARY.contains(&id) {
            format!("library/scripts/{id}.js")
        } else {
            format!("runtime/level2d/{id}.js")
        };
        let dst = jailed(project, &format!("scripts/level2d/{id}.js"))?;
        // Scripts become project-owned after first install; never replace edits.
        if !dst.exists() {
            copies.push((jailed(engine, &src)?, dst));
        }
    }
    for (src, dst) in &copies {
        if dst.exists()
            && std::fs::read(dst).map_err(|e| io::io_err(dst, e))?
                != std::fs::read(src).map_err(|e| io::io_err(src, e))?
        {
            return Err(err(format!("Bundled asset conflict: {}", dst.display())));
        }
    }
    let level = format!("levels/{name}.level2d.json");
    let scene = format!("scenes/{name}.scene.json");
    let level_path = jailed(project, &level)?;
    let scene_path = jailed(project, &scene)?;
    for (src, dst) in &copies {
        copy_preserving(src, dst)?;
    }
    if let Some(custom) = v["level"]["custom"].as_array() {
        for a in custom {
            let src = a["source"]
                .as_str()
                .ok_or_else(|| err("Invalid custom sprite"))?;
            if !src.starts_with("assets/") || !src.ends_with(".png") {
                return Err(err("Invalid custom sprite path"));
            }
            let path = jailed(project, src)?;
            if !path.is_file() {
                return Err(err("Custom sprite not found"));
            }
            let meta = jailed(project, &format!("{src}.meta.json"))?;
            io::save_json(
                &meta,
                &json!({"type":"spritesheet","frameWidth":a["width"],"frameHeight":a["height"],"filter":"nearest","anims":a["anims"]}),
            )?;
        }
    }
    io::save_json(&level_path, &v["level"])?;
    io::save_json(&scene_path, &v["scene"])?;
    if v["start"].as_bool().unwrap_or(false) {
        manifest["startScene"] = json!(scene);
        for key in ["display", "physics", "input"] {
            if v["settings"][key].is_object() {
                manifest[key] = v["settings"][key].clone();
            }
        }
        io::save_json(&jailed(project, "nord.project.json")?, &manifest)?;
    }
    Ok(json!({"level":level,"scene":scene,"images":sources.len(),"start":v["start"]==true}))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn traversal() {
        let p = Path::new("/tmp/nord");
        for s in ["../a", "/tmp/a", "a/../x", "a/.x", "a\\b"] {
            assert!(jailed(p, s).is_err(), "{s}");
        }
        assert!(jailed(p, "assets/packs/a.png").is_ok());
    }
    #[cfg(unix)]
    #[test]
    fn symlinks() {
        let p = std::env::temp_dir().join(format!("level2d-jail-{}", std::process::id()));
        std::fs::create_dir_all(&p).unwrap();
        std::os::unix::fs::symlink(std::env::temp_dir(), p.join("assets")).unwrap();
        assert!(jailed(&p, "assets/escape.png").is_err());
        std::fs::remove_dir_all(p).unwrap();
    }
}
