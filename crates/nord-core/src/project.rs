//! `nord.project.json` model (subset; grows in M1-01).
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub format: u32,
    pub name: String,
    pub id: String,
    #[serde(rename = "type")]
    pub kind: ProjectType,
    #[serde(rename = "startScene")]
    pub start_scene: String,
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
    }
}
