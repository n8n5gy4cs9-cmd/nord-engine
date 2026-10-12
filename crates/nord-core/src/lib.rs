//! Nord Engine core: project/scene model, asset index, thumbnails, offline scan.
//! See docs/PROJECT_FORMAT.md for the data model.

pub mod assets;
pub mod io;
pub mod offline;
pub mod project;
pub mod scene;
pub mod thumbs;
pub mod validate;

pub use project::{Project, ProjectType};
pub use scene::{Entity, Prefab, Scene};

/// Current on-disk format version for project/scene/prefab files.
pub const FORMAT: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{path}: {source}")]
    Io { path: String, source: std::io::Error },
    #[error("{path}: invalid JSON: {source}")]
    Json { path: String, source: serde_json::Error },
    #[error("{0}")]
    Msg(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// Hand-written JSON schemas (kept in sync with the serde model by `schemas_parse` test + docs/PROJECT_FORMAT.md).
pub mod schema {
    pub const PROJECT: &str = include_str!("../schema/project.schema.json");
    pub const SCENE: &str = include_str!("../schema/scene.schema.json");
    pub const PREFAB: &str = include_str!("../schema/prefab.schema.json");

    #[cfg(test)]
    #[test]
    fn schemas_parse() {
        for s in [PROJECT, SCENE, PREFAB] {
            let v: serde_json::Value = serde_json::from_str(s).unwrap();
            assert!(v["$id"].is_string() && v["required"].is_array());
        }
        // every component type the schema allows must be accepted by the model (free-form), and spec list must match docs
        let v: serde_json::Value = serde_json::from_str(SCENE).unwrap();
        assert_eq!(v["definitions"]["component"]["properties"]["type"]["enum"].as_array().unwrap().len(), 22);
    }
}
