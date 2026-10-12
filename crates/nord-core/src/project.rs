//! `nord.project.json` model. See docs/PROJECT_FORMAT.md.
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

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
    /// Export settings are kept free-form (`web`, `mac`, …) so unknown keys survive round trips.
    #[serde(default)]
    pub export: Map<String, Value>,
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
            export: Map::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
