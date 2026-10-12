//! Asset index: scan `assets/`, classify by extension, read `.meta.json` sidecars, sha256 hashes.
use crate::{io, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetType {
    Image,
    Spritesheet,
    Audio,
    Model,
    Font,
    Json,
    Prefab,
    Scene,
    Video,
    Other,
}

pub fn classify(path: &str) -> AssetType {
    let l = path.to_ascii_lowercase();
    if l.ends_with(".prefab.json") {
        return AssetType::Prefab;
    }
    if l.ends_with(".scene.json") {
        return AssetType::Scene;
    }
    match l.rsplit('.').next().unwrap_or("") {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif" => AssetType::Image,
        "ogg" | "mp3" | "wav" | "m4a" | "flac" => AssetType::Audio,
        "glb" | "gltf" | "obj" | "babylon" => AssetType::Model,
        "ttf" | "otf" | "woff" | "woff2" => AssetType::Font,
        "json" | "tmj" => AssetType::Json,
        "mp4" | "webm" => AssetType::Video,
        _ => AssetType::Other,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    /// Project-relative, forward slashes, e.g. `assets/sprites/player.png`.
    pub path: String,
    #[serde(rename = "type")]
    pub kind: AssetType,
    pub size: u64,
    pub sha256: String,
    /// Contents of the sidecar `<file>.meta.json`, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<Value>,
}

pub fn sha256_file(p: &Path) -> Result<String> {
    let bytes = std::fs::read(p).map_err(|e| io::io_err(p, e))?;
    Ok(Sha256::digest(&bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let p = e.path();
        if p.is_dir() {
            walk(&p, out);
        } else {
            out.push(p);
        }
    }
}

/// Scan `<root>/assets`, sorted by path. Sidecars are folded into their asset, not listed.
pub fn scan(root: &Path) -> Result<Vec<Asset>> {
    let mut files = vec![];
    walk(&root.join("assets"), &mut files);
    files.sort();
    let mut out = vec![];
    for f in files {
        let rel = f
            .strip_prefix(root)
            .unwrap()
            .to_string_lossy()
            .replace('\\', "/");
        if rel.ends_with(".meta.json") || rel.rsplit('/').next().is_some_and(|n| n.starts_with('.'))
        {
            continue;
        }
        let mut meta_path = f.clone().into_os_string();
        meta_path.push(".meta.json");
        let meta: Option<Value> = io::load_json(Path::new(&meta_path)).ok();
        let mut kind = classify(&rel);
        if kind == AssetType::Image
            && meta.as_ref().and_then(|m| m["type"].as_str()) == Some("spritesheet")
        {
            kind = AssetType::Spritesheet;
        }
        let size = std::fs::metadata(&f).map_err(|e| io::io_err(&f, e))?.len();
        out.push(Asset {
            sha256: sha256_file(&f)?,
            path: rel,
            kind,
            size,
            meta,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_and_scan() {
        assert_eq!(classify("a/b.PNG"), AssetType::Image);
        assert_eq!(classify("x.prefab.json"), AssetType::Prefab);
        let d = std::env::temp_dir().join(format!("nord-assets-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("assets/s")).unwrap();
        std::fs::write(d.join("assets/s/p.png"), b"x").unwrap();
        std::fs::write(
            d.join("assets/s/p.png.meta.json"),
            r#"{"type":"spritesheet","frameWidth":8}"#,
        )
        .unwrap();
        std::fs::write(d.join("assets/hit.ogg"), b"y").unwrap();
        let a = scan(&d).unwrap();
        assert_eq!(a.len(), 2);
        assert_eq!(a[0].path, "assets/hit.ogg");
        assert_eq!(a[1].kind, AssetType::Spritesheet);
        assert_eq!(a[1].sha256.len(), 64);
    }
}
