//! Serde mirrors of the Nord project/scene/prefab JSON (docs/PROJECT_FORMAT.md). Components stay `serde_json::Value`
//! (`type` + free fields) and are interpreted by `world.rs`, so new component types never break loading.
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct Project {
    pub name: String,
    pub id: String,
    #[serde(rename = "startScene")]
    pub start_scene: String,
    pub display: Display,
    pub physics: PhysicsCfg,
    pub input: InputCfg,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct Display {
    pub width: f32,
    pub height: f32,
    pub background: String,
    #[serde(rename = "pixelArt")]
    pub pixel_art: bool,
}
impl Default for Display {
    fn default() -> Self {
        Self { width: 640.0, height: 360.0, background: "#2e3440".into(), pixel_art: false }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct PhysicsCfg {
    pub engine: String,
    pub gravity: [f32; 3],
}
impl Default for PhysicsCfg {
    fn default() -> Self {
        Self { engine: "rapier".into(), gravity: [0.0, 980.0, 0.0] }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct InputCfg {
    pub actions: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct SceneData {
    pub name: String,
    pub entities: Vec<EntityData>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct PrefabData {
    pub root: EntityData,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct EntityData {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub tags: Vec<String>,
    pub transform: Transform,
    pub components: Vec<Value>,
    pub scripts: Vec<ScriptData>,
    pub children: Vec<EntityData>,
    pub prefab: Option<PrefabRef>,
}
impl Default for EntityData {
    fn default() -> Self {
        Self { id: String::new(), name: "Entity".into(), enabled: true, tags: vec![], transform: Transform::default(), components: vec![], scripts: vec![], children: vec![], prefab: None }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct Transform {
    pub pos: [f32; 3],
    pub rot: [f32; 3],
    pub scale: [f32; 3],
}
impl Default for Transform {
    fn default() -> Self {
        Self { pos: [0.0; 3], rot: [0.0; 3], scale: [1.0; 3] }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct ScriptData {
    /// `scripts/player.js` or `player` — the registry key is the file stem
    pub path: String,
    pub attributes: HashMap<String, Value>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct PrefabRef {
    pub path: String,
    pub overrides: Value,
}

/// Sidecar `<texture>.meta.json`: sprite sheet frames + animations.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct SheetMeta {
    #[serde(rename = "frameWidth")]
    pub frame_width: f32,
    #[serde(rename = "frameHeight")]
    pub frame_height: f32,
    pub filter: String,
    pub anims: HashMap<String, AnimDef>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct AnimDef {
    pub frames: Vec<u32>,
    pub fps: f32,
    #[serde(rename = "loop")]
    pub looping: bool,
}
impl Default for AnimDef {
    fn default() -> Self {
        Self { frames: vec![0], fps: 8.0, looping: true }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct TilemapData {
    #[serde(rename = "tileWidth")]
    pub tile_width: f32,
    #[serde(rename = "tileHeight")]
    pub tile_height: f32,
    pub collides: Vec<i32>,
    pub layers: Vec<TileLayer>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(default)]
pub struct TileLayer {
    pub name: String,
    pub data: Vec<Vec<i32>>,
}

/// Recursively collect every string value stored under one of `keys` (used to preload textures/sounds/maps before the first frame).
pub fn collect_strings(v: &Value, keys: &[&str], out: &mut Vec<String>) {
    match v {
        Value::Object(m) => {
            for (k, x) in m {
                if let (true, Value::String(s)) = (keys.contains(&k.as_str()), x) {
                    if !out.contains(s) {
                        out.push(s.clone());
                    }
                }
                collect_strings(x, keys, out);
            }
        }
        Value::Array(a) => a.iter().for_each(|x| collect_strings(x, keys, out)),
        _ => {}
    }
}
