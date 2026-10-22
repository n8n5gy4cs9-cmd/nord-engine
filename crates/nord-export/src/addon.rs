//! Addon SDK tooling (M10-27): `addon.json` metadata, `.nordaddon` packages (zip), install into a project. See docs/ADDONS.md.
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub const EXT: &str = "nordaddon";

#[derive(Debug, Clone, PartialEq)]
pub struct Meta {
    pub id: String,
    pub name: String,
    pub version: String,
    pub kind: String,
    pub main: String,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

/// Read + validate `<dir>/addon.json`.
pub fn read_meta(dir: &Path) -> Result<Meta> {
    let p = dir.join("addon.json");
    let v: Value = serde_json::from_slice(
        &fs::read(&p).with_context(|| format!("{} not found", p.display()))?,
    )
    .with_context(|| format!("{}: invalid JSON", p.display()))?;
    let s = |k: &str| v[k].as_str().map(String::from);
    let id = s("id").context("addon.json: \"id\" is required")?;
    if !valid_id(&id) {
        bail!("addon.json: id '{id}' must be lowercase letters, digits, '-' or '_'");
    }
    let main = s("main").unwrap_or_else(|| "addon.js".into());
    if main.contains("..") || main.starts_with('/') || !dir.join(&main).is_file() {
        bail!("addon.json: main '{main}' not found in the addon folder");
    }
    let kind = s("type").unwrap_or_else(|| "plugin".into());
    if !["plugin", "behavior", "effect", "mixed"].contains(&kind.as_str()) {
        bail!("addon.json: type must be plugin, behavior, effect or mixed");
    }
    Ok(Meta {
        name: s("name").unwrap_or_else(|| id.clone()),
        version: s("version").unwrap_or_else(|| "0.1.0".into()),
        id,
        kind,
        main,
    })
}

fn files(dir: &Path) -> Vec<(PathBuf, String)> {
    fn go(d: &Path, rel: &str, out: &mut Vec<(PathBuf, String)>) {
        let Ok(rd) = fs::read_dir(d) else { return };
        let mut es: Vec<_> = rd.flatten().collect();
        es.sort_by_key(|e| e.file_name());
        for e in es {
            let n = e.file_name().to_string_lossy().into_owned();
            if n.starts_with('.') || n == "node_modules" {
                continue;
            }
            let r = if rel.is_empty() {
                n
            } else {
                format!("{rel}/{n}")
            };
            if e.path().is_dir() {
                go(&e.path(), &r, out);
            } else {
                out.push((e.path(), r));
            }
        }
    }
    let mut v = vec![];
    go(dir, "", &mut v);
    v
}

/// Zip an addon folder into `<out or cwd>/<id>-<version>.nordaddon`.
pub fn pack(dir: &Path, out: Option<&Path>) -> Result<PathBuf> {
    let m = read_meta(dir)?;
    let target = out
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(format!("{}-{}.{EXT}", m.id, m.version)));
    let mut z = zip::ZipWriter::new(fs::File::create(&target)?);
    let opt = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (p, r) in files(dir) {
        z.start_file(r.as_str(), opt)?;
        z.write_all(&fs::read(p)?)?;
    }
    z.finish()?;
    Ok(target)
}

/// Install a folder or a `.nordaddon` file into `<project>/addons/<id>/` and register it in `nord.project.json` (`addons`).
pub fn install(src: &Path, project: &Path) -> Result<Meta> {
    let staging = project
        .join(".nord")
        .join(format!("addon-staging-{}", std::process::id()));
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging)?;
    let result = (|| -> Result<Meta> {
        if src.is_dir() {
            for (p, r) in files(src) {
                let d = staging.join(&r);
                fs::create_dir_all(d.parent().unwrap())?;
                fs::copy(p, d)?;
            }
        } else {
            let mut z = zip::ZipArchive::new(
                fs::File::open(src).with_context(|| src.display().to_string())?,
            )?;
            for i in 0..z.len() {
                let mut f = z.by_index(i)?;
                let Some(rel) = f.enclosed_name() else {
                    bail!("unsafe path in package: {}", f.name())
                };
                if f.is_dir() {
                    continue;
                }
                let d = staging.join(rel);
                fs::create_dir_all(d.parent().unwrap())?;
                let mut buf = vec![];
                f.read_to_end(&mut buf)?;
                fs::write(d, buf)?;
            }
        }
        let m = read_meta(&staging)?;
        let dest = project.join("addons").join(&m.id);
        if dest.exists() {
            fs::remove_dir_all(&dest)?; // upgrade in place
        }
        fs::create_dir_all(dest.parent().unwrap())?;
        fs::rename(&staging, &dest).or_else(|_| -> Result<()> {
            for (p, r) in files(&staging) {
                let d = dest.join(&r);
                fs::create_dir_all(d.parent().unwrap())?;
                fs::copy(p, d)?;
            }
            Ok(())
        })?;
        let mut proj = nord_core::io::load_project(project)?;
        let rel = format!("addons/{}", m.id);
        if !proj.addons.contains(&rel) {
            proj.addons.push(rel);
            nord_core::io::save_project(project, &proj)?;
        }
        Ok(m)
    })();
    let _ = fs::remove_dir_all(&staging);
    result
}

/// Addons registered in the project, with their metadata (missing/invalid ones are reported as errors in the second list).
pub fn list(project: &Path) -> (Vec<Meta>, Vec<String>) {
    let (mut ok, mut bad) = (vec![], vec![]);
    for rel in nord_core::io::load_project(project)
        .map(|p| p.addons)
        .unwrap_or_default()
    {
        match read_meta(&project.join(&rel)) {
            Ok(m) => ok.push(m),
            Err(e) => bad.push(format!("{rel}: {e}")),
        }
    }
    (ok, bad)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pack_install_list_roundtrip_and_validation() {
        let d = std::env::temp_dir().join(format!("nord-addon-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        let proj = d.join("game");
        nord_core::project::create(&proj, nord_core::ProjectType::TwoD).unwrap();
        let a = d.join("dice");
        fs::create_dir_all(&a).unwrap();
        fs::write(
            a.join("addon.json"),
            r#"{"id":"dice","name":"Dice","version":"1.2.0","type":"plugin"}"#,
        )
        .unwrap();
        fs::write(a.join("addon.js"), "export function register() {}").unwrap();
        let pkg = pack(&a, Some(&d.join("dice.nordaddon"))).unwrap();
        let m = install(&pkg, &proj).unwrap();
        assert_eq!((m.id.as_str(), m.version.as_str()), ("dice", "1.2.0"));
        assert!(proj.join("addons/dice/addon.js").is_file());
        install(&a, &proj).unwrap(); // folder install + upgrade does not duplicate the registration
        let (ok, bad) = list(&proj);
        assert_eq!(ok.len(), 1);
        assert!(bad.is_empty());
        assert_eq!(
            nord_core::io::load_project(&proj).unwrap().addons,
            vec!["addons/dice".to_string()]
        );
        // validation
        fs::write(a.join("addon.json"), r#"{"id":"Bad Id"}"#).unwrap();
        assert!(read_meta(&a).is_err());
        fs::write(a.join("addon.json"), r#"{"id":"x","main":"../evil.js"}"#).unwrap();
        assert!(read_meta(&a).is_err());
        let _ = fs::remove_dir_all(&d);
    }
}
