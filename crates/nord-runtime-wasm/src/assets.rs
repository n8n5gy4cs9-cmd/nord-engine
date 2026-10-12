//! Async asset preloading. macroquad loads files asynchronously, so everything the scene/prefabs/scripts can reference is loaded up front
//! (strings ending in .png/.jpg/.wav/.ogg/.prefab.json/.tilemap.json anywhere in the JSON, plus `Registry::{prefab,sound,texture}` lists).
use crate::data::{PrefabData, SheetMeta, TilemapData};
use macroquad::audio::{load_sound, Sound};
use macroquad::prelude::*;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Default)]
pub struct Assets {
    pub textures: HashMap<String, Texture2D>,
    pub metas: HashMap<String, SheetMeta>,
    pub sounds: HashMap<String, Sound>,
    pub prefabs: HashMap<String, Value>,
    pub maps: HashMap<String, TilemapData>,
}

/// Every string anywhere in `v`.
pub fn all_strings(v: &Value, out: &mut Vec<String>) {
    match v {
        Value::String(s) => out.push(s.clone()),
        Value::Object(m) => m.values().for_each(|x| all_strings(x, out)),
        Value::Array(a) => a.iter().for_each(|x| all_strings(x, out)),
        _ => {}
    }
}

impl Assets {
    /// Load everything referenced by `docs` (scene / prefab JSON) and the explicit lists. Prefabs are scanned recursively.
    pub async fn preload(&mut self, docs: &[Value], extra_prefabs: &[String], extra_sounds: &[String], extra_textures: &[String], pixel_art: bool) {
        let mut queue: Vec<String> = vec![];
        for d in docs {
            all_strings(d, &mut queue);
        }
        queue.extend(extra_prefabs.iter().chain(extra_sounds).chain(extra_textures).cloned());
        let mut i = 0;
        while i < queue.len() {
            let p = queue[i].clone();
            i += 1;
            let lower = p.to_ascii_lowercase();
            if lower.ends_with(".prefab.json") && !self.prefabs.contains_key(&p) {
                match load_string(&p).await.ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()) {
                    Some(v) => {
                        all_strings(&v, &mut queue);
                        self.prefabs.insert(p, v);
                    }
                    None => warn!("[nord] prefab not found: {p}"),
                }
            } else if lower.ends_with(".tilemap.json") && !self.maps.contains_key(&p) {
                match load_string(&p).await.ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()) {
                    Some(v) => {
                        all_strings(&v, &mut queue); // maps name their tileset
                        if let Ok(m) = serde_json::from_value::<TilemapData>(v) {
                            self.maps.insert(p, m);
                        }
                    }
                    None => warn!("[nord] tilemap not found: {p}"),
                }
            } else if (lower.ends_with(".png") || lower.ends_with(".jpg") || lower.ends_with(".jpeg")) && !self.textures.contains_key(&p) {
                match load_texture(&p).await {
                    Ok(t) => {
                        let meta = load_string(&format!("{p}.meta.json")).await.ok().and_then(|s| serde_json::from_str::<SheetMeta>(&s).ok());
                        let nearest = pixel_art || meta.as_ref().is_some_and(|m| m.filter == "nearest");
                        t.set_filter(if nearest { FilterMode::Nearest } else { FilterMode::Linear });
                        if let Some(m) = meta {
                            self.metas.insert(p.clone(), m);
                        }
                        self.textures.insert(p, t);
                    }
                    Err(e) => warn!("[nord] texture {p}: {e:?}"),
                }
            } else if (lower.ends_with(".wav") || lower.ends_with(".ogg")) && !self.sounds.contains_key(&p) {
                match load_sound(&p).await {
                    Ok(s) => {
                        self.sounds.insert(p, s);
                    }
                    Err(e) => warn!("[nord] sound {p}: {e:?}"),
                }
            }
        }
    }

    pub fn prefab_data(&self, path: &str) -> Option<PrefabData> {
        self.prefabs.get(path).and_then(|v| serde_json::from_value(v.clone()).ok())
    }
}
