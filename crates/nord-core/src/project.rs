//! `nord.project.json` model. See docs/PROJECT_FORMAT.md.
use crate::vfs::PathExt;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::path::Path;

/// Which runtime tier a project exports to. See docs/EXPORT_TARGETS.md.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectType {
    Html,
    #[serde(rename = "2d")]
    TwoD,
    #[serde(rename = "3d")]
    ThreeD,
    WasmGame,
    WasmApp,
}

impl ProjectType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Html => "html",
            Self::TwoD => "2d",
            Self::ThreeD => "3d",
            Self::WasmGame => "wasm-game",
            Self::WasmApp => "wasm-app",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Display {
    pub width: u32,
    pub height: u32,
    pub scale: String,
    pub pixel_art: bool,
    pub background: String,
}

impl Default for Display {
    fn default() -> Self {
        Self {
            width: 1280,
            height: 720,
            scale: "fit".into(),
            pixel_art: false,
            background: "#101418".into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Physics {
    pub engine: String,
    #[serde(default)]
    pub gravity: [f64; 3],
}

impl Default for Physics {
    fn default() -> Self {
        Self {
            engine: "arcade".into(),
            gravity: [0.0, 980.0, 0.0],
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Input {
    #[serde(default)]
    pub actions: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub format: u32,
    pub name: String,
    pub id: String,
    #[serde(rename = "type")]
    pub kind: ProjectType,
    #[serde(default = "default_engine_version")]
    pub engine_version: String,
    pub start_scene: String,
    #[serde(default)]
    pub display: Display,
    #[serde(default)]
    pub physics: Physics,
    #[serde(default)]
    pub input: Input,
    /// Runtime UI look: `{ "skin": "modern|industrial|cyber", "theme": "<id from assets/themes/themes.json>" }`.
    #[serde(default)]
    pub ui: Map<String, Value>,
    #[serde(default)]
    pub plugins: Vec<String>,
    /// Installed addons (folders under `addons/` with an `addon.json`), loaded by the runtime before the first scene (docs/ADDONS.md).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub addons: Vec<String>,
    /// Export settings are kept free-form (`web`, `mac`, …) so unknown keys survive round trips.
    #[serde(default)]
    pub export: Map<String, Value>,
    /// Desktop-app settings (M9): `{ "permissions": {…}, "menu"?, … }`; see docs/DESKTOP_APPS.md. Free-form here, parsed by `nord-desktop`.
    #[serde(default, skip_serializing_if = "Map::is_empty")]
    pub desktop: Map<String, Value>,
    /// Graphics quality like Unity's Quality settings: `level` (low|medium|high|ultra) plus optional overrides
    /// `shadows` (off|hard|soft), `shadowResolution`, `maxLights`, `antialiasing`, `renderScale`, `postProcessing`. See docs/QUALITY.md.
    #[serde(default, skip_serializing_if = "Map::is_empty")]
    pub quality: Map<String, Value>,
}

fn default_engine_version() -> String {
    env!("CARGO_PKG_VERSION").into()
}

impl Project {
    pub fn new(name: &str, id: &str, kind: ProjectType) -> Self {
        Self {
            format: crate::FORMAT,
            name: name.into(),
            id: id.into(),
            kind,
            engine_version: default_engine_version(),
            start_scene: "scenes/main.scene.json".into(),
            display: Display::default(),
            physics: Physics::default(),
            input: Input::default(),
            ui: Map::new(),
            plugins: vec![],
            addons: vec![],
            export: Map::new(),
            desktop: Map::new(),
            quality: Map::new(),
        }
    }
}

fn slug(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// Create a new project skeleton in `dir` (used by `nord new` and the editor's project hub).
pub fn create(dir: &Path, kind: ProjectType) -> crate::Result<()> {
    use crate::io;
    if dir.join(io::PROJECT_FILE).v_exists() {
        return Err(crate::Error::Msg(format!(
            "{} already contains a Nord project",
            dir.display()
        )));
    }
    let name = dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "My Game".into());
    let mut p = Project::new(&name, &format!("com.crowelian.{}", slug(&name)), kind);
    for d in ["scenes", "scripts", "assets"] {
        crate::vfs::create_dir_all(dir.join(d)).map_err(|e| io::io_err(dir, e))?;
    }
    if kind == ProjectType::Html {
        p.start_scene = String::new();
        io::write_atomic(
            &dir.join("index.html"),
            include_str!("../templates/html/index.html")
                .replace("{{name}}", &name)
                .as_bytes(),
        )?;
    } else {
        let page = match kind {
            ProjectType::ThreeD => Some(include_str!("../templates/play-3d.html")),
            ProjectType::TwoD => Some(include_str!("../templates/play-2d.html")),
            _ => None,
        };
        if let Some(page) = page {
            io::write_atomic(
                &dir.join("index.html"),
                page.replace("{{name}}", &name).as_bytes(),
            )?;
        }
        io::write_atomic(
            &dir.join(&p.start_scene),
            include_str!("../templates/main.scene.json").as_bytes(),
        )?;
    }
    io::write_atomic(&dir.join(".gitignore"), b".nord-cache/\ndist/\ntarget/\n")?;
    io::save_project(dir, &p)
}

/// Rust projects reference the engine crates relatively (`../../crates/…` from `examples/<x>` or `templates/<x>`); after copying a project elsewhere
/// point those paths at the real engine checkout (absolute, forward slashes so TOML needs no escaping).
pub fn retarget_engine_paths(dir: &Path, engine: &Path) {
    let f = dir.join("Cargo.toml");
    if let Ok(t) = crate::vfs::read_to_string(&f) {
        let abs = engine.to_string_lossy().replace('\\', "/");
        let n = t.replace("\"../../crates/", &format!("\"{abs}/crates/"));
        if n != t {
            let _ = crate::vfs::write(&f, n);
        }
    }
}

/// Copy a starter template folder (`templates/<id>`) to `dst` and give the project its own name and id.
pub fn create_from_template(src: &Path, dst: &Path) -> crate::Result<()> {
    use crate::io;
    fn copy(from: &Path, to: &Path) -> crate::Result<()> {
        crate::vfs::create_dir_all(to).map_err(|e| io::io_err(to, e))?;
        for e in crate::vfs::read_dir(from).map_err(|e| io::io_err(from, e))? {
            let e = e.map_err(|e| io::io_err(from, e))?;
            let (a, b) = (e.path(), to.join(e.file_name()));
            if a.v_is_dir() {
                copy(&a, &b)?;
            } else {
                crate::vfs::copy(&a, &b).map_err(|e| io::io_err(&b, e))?;
            }
        }
        Ok(())
    }
    if dst.join(io::PROJECT_FILE).v_exists() {
        return Err(crate::Error::Msg(format!(
            "{} already contains a Nord project",
            dst.display()
        )));
    }
    copy(src, dst)?;
    let name = dst
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "My Game".into());
    let mut p = io::load_project(dst)?;
    p.name = name.clone();
    p.id = format!("com.crowelian.{}", slug(&name));
    if let Some(engine) = src.parent().and_then(Path::parent) {
        retarget_engine_paths(dst, engine);
    }
    io::write_atomic(&dst.join(".gitignore"), b".nord-cache/\ndist/\ntarget/\n")?;
    io::save_project(dst, &p)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_from_template_folder() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../templates");
        let Some(src) = crate::vfs::read_dir(&root).ok().and_then(|d| {
            d.flatten()
                .map(|e| e.path())
                .find(|p| p.join("nord.project.json").v_exists())
        }) else {
            return; // engine ships no starter templates (yet)
        };
        let dst = std::env::temp_dir().join(format!("nord-tpl-{}/My Starter", std::process::id()));
        create_from_template(&src, &dst).unwrap();
        let p = crate::io::load_project(&dst).unwrap();
        assert_eq!(p.name, "My Starter");
        assert_eq!(p.id, "com.crowelian.mystarter");
        assert!(create_from_template(&src, &dst).is_err());
    }

    #[test]
    fn slug_strips() {
        assert_eq!(slug("My Game!"), "mygame");
    }

    #[test]
    fn parses_minimal_project() {
        let p: Project = serde_json::from_str(
            r#"{"format":1,"name":"T","id":"com.x.t","type":"2d","startScene":"scenes/main.scene.json"}"#,
        )
        .unwrap();
        assert_eq!(p.kind, ProjectType::TwoD);
        assert_eq!(p.display.width, 1280);
    }
}
