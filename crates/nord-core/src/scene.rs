//! Scene + prefab model. See docs/PROJECT_FORMAT.md.
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Transform {
    pub pos: [f64; 3],
    pub rot: [f64; 3],
    pub scale: [f64; 3],
}

impl Default for Transform {
    fn default() -> Self {
        Self { pos: [0.0; 3], rot: [0.0; 3], scale: [1.0; 3] }
    }
}

/// A component is `{ "type": "...", ...fields }`; fields are schema-driven so kept as JSON.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Component {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(flatten)]
    pub fields: Map<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScriptRef {
    pub path: String,
    #[serde(default)]
    pub attributes: Map<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrefabRef {
    pub path: String,
    #[serde(default)]
    pub overrides: Map<String, Value>,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub name: String,
    #[serde(default = "yes")]
    pub enabled: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub layer: i32,
    #[serde(default)]
    pub transform: Transform,
    #[serde(default)]
    pub components: Vec<Component>,
    #[serde(default)]
    pub scripts: Vec<ScriptRef>,
    #[serde(default)]
    pub children: Vec<Entity>,
    #[serde(default)]
    pub prefab: Option<PrefabRef>,
}

impl Entity {
    pub fn new(name: &str) -> Self {
        Self {
            id: new_id(),
            name: name.into(),
            enabled: true,
            tags: vec![],
            layer: 0,
            transform: Transform::default(),
            components: vec![],
            scripts: vec![],
            children: vec![],
            prefab: None,
        }
    }

    /// Depth-first visit of this entity and all descendants.
    pub fn walk<'a>(&'a self, f: &mut impl FnMut(&'a Entity)) {
        f(self);
        for c in &self.children {
            c.walk(f);
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SceneSettings {
    #[serde(default)]
    pub ambient: Option<String>,
    #[serde(default)]
    pub skybox: Option<String>,
    #[serde(default)]
    pub gravity: Option<[f64; 3]>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Scene {
    pub format: u32,
    pub name: String,
    #[serde(default)]
    pub settings: SceneSettings,
    #[serde(default)]
    pub entities: Vec<Entity>,
}

impl Scene {
    pub fn new(name: &str) -> Self {
        Self { format: crate::FORMAT, name: name.into(), settings: SceneSettings::default(), entities: vec![] }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Prefab {
    pub format: u32,
    pub root: Entity,
}

/// Unique 8-char base36 id (time + counter hashed; no rand dependency needed).
pub fn new_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};
    static N: AtomicU64 = AtomicU64::new(0);
    let t = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0);
    let mut x = t ^ N.fetch_add(1, Ordering::Relaxed).wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ u64::from(std::process::id());
    // splitmix64 finaliser
    x = (x ^ (x >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    x = (x ^ (x >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    x ^= x >> 31;
    const A: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    (0..8).map(|_| { let c = A[(x % 36) as usize] as char; x /= 36; c }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_spec_example() {
        let src = r##"{
          "format":1,"name":"main","settings":{"ambient":"#222233","skybox":null,"gravity":null},
          "entities":[{"id":"k3j9x0a1","name":"Player","enabled":true,"tags":["player"],"layer":0,
            "transform":{"pos":[100,300,0],"rot":[0,0,0],"scale":[1,1,1]},
            "components":[{"type":"sprite","texture":"assets/sprites/player.png","frame":0}],
            "scripts":[{"path":"scripts/player.js","attributes":{"speed":220}}],
            "children":[],"prefab":null}]}"##;
        let s: Scene = serde_json::from_str(src).unwrap();
        assert_eq!(s.entities[0].components[0].kind, "sprite");
        assert_eq!(s.entities[0].components[0].fields["frame"], 0);
        let s2: Scene = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        assert_eq!(s, s2);
    }

    #[test]
    fn ids_unique() {
        let ids: std::collections::HashSet<_> = (0..1000).map(|_| new_id()).collect();
        assert_eq!(ids.len(), 1000);
        assert!(ids.iter().all(|i| i.len() == 8));
    }
}
