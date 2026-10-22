//! Prefab instance overrides for the Inspector (Unity-style): show the prefab merged with the instance's overrides, and turn
//! edits back into a minimal `overrides` patch. `apply` mirrors `applyOverrides` in `runtime/core/scene.js`.
use crate::{scene_ops, state::EditorState};
use nord_core::scene::Entity;
use serde_json::{Map, Value};

/// Entity keys the Inspector can override (name/transform/enabled/tags stay on the instance itself).
pub const KEYS: [&str; 5] = ["components", "scripts", "behaviors", "effects", "layer"];

/// Deep-merge `ov` onto `target`: objects merge, numeric-key objects patch arrays by index, anything else replaces.
pub fn apply(target: &mut Value, ov: &Value) {
    match (target, ov) {
        (Value::Array(t), Value::Object(o)) if o.keys().all(|k| k.parse::<usize>().is_ok()) => {
            for (k, v) in o {
                let i: usize = k.parse().unwrap_or(0);
                if i >= t.len() {
                    t.resize(i + 1, Value::Null);
                }
                match v {
                    Value::Object(_) => {
                        if !t[i].is_object() {
                            t[i] = Value::Object(Map::new());
                        }
                        apply(&mut t[i], v);
                    }
                    _ => t[i] = v.clone(),
                }
            }
        }
        (Value::Object(t), Value::Object(o)) => {
            for (k, v) in o {
                match (t.get_mut(k), v) {
                    (Some(cur), Value::Object(_)) if cur.is_object() || cur.is_array() => {
                        apply(cur, v)
                    }
                    _ => {
                        t.insert(k.clone(), v.clone());
                    }
                }
            }
        }
        (t, v) => *t = v.clone(),
    }
}

/// Smallest patch that turns `base` into `new` under `apply` (None = identical). Removed keys become null.
pub fn diff(base: &Value, new: &Value) -> Option<Value> {
    if base == new {
        return None;
    }
    match (base, new) {
        (Value::Object(b), Value::Object(n)) => {
            let mut out = Map::new();
            for (k, v) in n {
                match b.get(k) {
                    Some(bv) => {
                        if let Some(d) = diff(bv, v) {
                            out.insert(k.clone(), d);
                        }
                    }
                    None => {
                        out.insert(k.clone(), v.clone());
                    }
                }
            }
            for k in b.keys().filter(|k| !n.contains_key(*k)) {
                out.insert(k.clone(), Value::Null);
            }
            Some(Value::Object(out))
        }
        (Value::Array(b), Value::Array(n)) if b.len() == n.len() => {
            let out: Map<String, Value> = b
                .iter()
                .zip(n)
                .enumerate()
                .filter_map(|(i, (x, y))| diff(x, y).map(|d| (i.to_string(), d)))
                .collect();
            Some(Value::Object(out))
        }
        _ => Some(new.clone()),
    }
}

/// The instance as the Inspector edits it: prefab root + overrides on the overridable keys, instance name/transform kept.
pub fn effective(inst: &Entity, base: &Entity) -> Entity {
    let (Ok(mut v), Some(p)) = (serde_json::to_value(base), inst.prefab.as_ref()) else {
        return inst.clone();
    };
    apply(&mut v, &Value::Object(p.overrides.clone()));
    let Ok(eff) = serde_json::from_value::<Entity>(v) else {
        return inst.clone();
    };
    let mut out = inst.clone();
    out.components = eff.components;
    out.scripts = eff.scripts;
    out.behaviors = eff.behaviors;
    out.effects = eff.effects;
    out.layer = eff.layer;
    out
}

/// New `overrides` for `inst` after the Inspector edited `edited` (an `effective` entity): other keys already stored are kept.
pub fn overrides_for(inst: &Entity, base: &Entity, edited: &Entity) -> Map<String, Value> {
    let mut ov = inst
        .prefab
        .as_ref()
        .map(|p| p.overrides.clone())
        .unwrap_or_default();
    for k in KEYS {
        ov.remove(k);
    }
    let (Ok(b), Ok(e)) = (serde_json::to_value(base), serde_json::to_value(edited)) else {
        return ov;
    };
    for k in KEYS {
        if let Some(d) =
            diff(&b[k], &e[k]).or_else(|| (b[k].is_null() != e[k].is_null()).then(|| e[k].clone()))
        {
            ov.insert(k.into(), d);
        }
    }
    ov
}

/// An instance turned into plain entities ("Unpack"): prefab root + overrides, instance id/name/transform, the prefab's children
/// with fresh ids, no prefab link.
pub fn unpack_entity(inst: &Entity, base: &Entity) -> Entity {
    let mut out = effective(inst, base);
    out.children = base
        .children
        .iter()
        .map(crate::scene_ops::clone_fresh)
        .collect();
    out.prefab = None;
    out
}

/// Prefab file content for `e` (a scene entity, link stripped, children kept).
pub fn file_for(e: &Entity) -> Option<String> {
    let mut root = e.clone();
    root.prefab = None;
    serde_json::to_string_pretty(&nord_core::scene::Prefab { format: 1, root }).ok()
}

impl EditorState {
    /// Read a prefab file's root entity.
    pub fn read_prefab(&self, path: &str) -> Option<Entity> {
        let txt = nord_core::vfs::read_to_string(self.root.as_ref()?.join(path)).ok()?;
        serde_json::from_str::<nord_core::scene::Prefab>(&txt)
            .ok()
            .map(|p| p.root)
    }

    /// Hierarchy → Project drop / context menu: save entity `id` as `<dir>/<name>.prefab.json` and turn it into an instance.
    pub fn make_prefab(&mut self, id: &str, dir: &str) -> Option<String> {
        let root = self.root.clone()?;
        let e = scene_ops::find(&self.scene.as_ref()?.entities, id)?.clone();
        if e.prefab.is_some() {
            self.toast("Already a prefab instance");
            return None;
        }
        let stem: String = e
            .name
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' {
                    c
                } else {
                    '-'
                }
            })
            .collect();
        let dir = if dir.is_empty() { "prefabs" } else { dir };
        let mut n = 1;
        let rel = loop {
            let name = if n == 1 {
                format!("{stem}.prefab.json")
            } else {
                format!("{stem}-{n}.prefab.json")
            };
            let rel = format!("{dir}/{name}");
            if !root.join(&rel).exists() {
                break rel;
            }
            n += 1;
        };
        let body = file_for(&e)?;
        let _ = nord_core::vfs::create_dir_all(root.join(dir));
        if nord_core::vfs::write(root.join(&rel), body).is_err() {
            self.toast("Could not write the prefab file");
            return None;
        }
        let rel2 = rel.clone();
        self.edit("Create prefab", None, |l| {
            if let Some(slot) = scene_ops::find_mut(l, id) {
                slot.children.clear();
                slot.components.clear();
                slot.scripts.clear();
                slot.behaviors.clear();
                slot.effects.clear();
                slot.prefab = Some(nord_core::scene::PrefabRef {
                    path: rel2,
                    overrides: Default::default(),
                });
            }
        });
        self.refresh_assets();
        self.toast(format!("Prefab created: {rel}"));
        Some(rel)
    }

    /// Prefab ▸ Unpack. `completely` also unpacks prefab instances nested in the prefab's children.
    pub fn unpack_prefab(&mut self, id: &str, completely: bool) {
        let Some(inst) = self
            .scene
            .as_ref()
            .and_then(|s| scene_ops::find(&s.entities, id))
            .cloned()
        else {
            return;
        };
        let Some(base) = inst.prefab.as_ref().and_then(|p| self.read_prefab(&p.path)) else {
            self.toast("Prefab file not found");
            return;
        };
        let mut out = unpack_entity(&inst, &base);
        if completely {
            fn deep(st: &EditorState, e: &mut Entity) {
                for c in &mut e.children {
                    if let Some(b) = c.prefab.as_ref().and_then(|p| st.read_prefab(&p.path)) {
                        *c = unpack_entity(c, &b);
                    }
                    deep(st, c);
                }
            }
            deep(self, &mut out);
        }
        let id = id.to_string();
        self.edit("Unpack prefab", None, |l| {
            if let Some(slot) = scene_ops::find_mut(l, &id) {
                *slot = out;
            }
        });
    }

    /// Overrides ▸ Apply all: write the instance (with its overrides) back into the prefab file and clear the overrides.
    pub fn apply_prefab(&mut self, id: &str) {
        let Some(inst) = self
            .scene
            .as_ref()
            .and_then(|s| scene_ops::find(&s.entities, id))
            .cloned()
        else {
            return;
        };
        let (Some(p), Some(root)) = (inst.prefab.clone(), self.root.clone()) else {
            return;
        };
        let Some(base) = self.read_prefab(&p.path) else {
            self.toast("Prefab file not found");
            return;
        };
        let mut merged = effective(&inst, &base);
        merged.id = base.id.clone();
        merged.name = base.name.clone();
        merged.transform = base.transform.clone();
        merged.children = base.children.clone();
        let Some(body) = file_for(&merged) else {
            return;
        };
        if nord_core::vfs::write(root.join(&p.path), body).is_err() {
            self.toast("Could not write the prefab file");
            return;
        }
        let id = id.to_string();
        self.edit("Apply prefab overrides", None, |l| {
            if let Some(slot) = scene_ops::find_mut(l, &id) {
                if let Some(pr) = slot.prefab.as_mut() {
                    pr.overrides.clear();
                }
            }
        });
        self.toast(format!("Applied to {}", p.path));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nord_core::scene::{Component, PrefabRef, ScriptRef};
    use serde_json::json;

    fn base() -> Entity {
        let mut e = Entity::new("Coin");
        e.components.push(Component {
            kind: "sprite".into(),
            fields: json!({"texture": "a.png", "tint": "#fff"})
                .as_object()
                .unwrap()
                .clone(),
        });
        e.scripts.push(ScriptRef {
            path: "scripts/c.js".into(),
            attributes: json!({"value": 1}).as_object().unwrap().clone(),
        });
        e
    }

    #[test]
    fn unpack_applies_overrides_and_drops_the_link() {
        let mut b = base();
        b.children.push(Entity::new("Child"));
        let mut inst = Entity::new("Coin 2");
        inst.prefab = Some(PrefabRef {
            path: "p.prefab.json".into(),
            overrides: json!({"components": {"0": {"tint": "#f00"}}})
                .as_object()
                .unwrap()
                .clone(),
        });
        let u = unpack_entity(&inst, &b);
        assert!(u.prefab.is_none());
        assert_eq!(u.name, "Coin 2");
        assert_eq!(u.components[0].fields["tint"], json!("#f00"));
        assert_eq!(u.children.len(), 1);
        assert_ne!(u.children[0].id, b.children[0].id);
        assert!(file_for(&u).unwrap().contains("\"format\": 1"));
    }

    #[test]
    fn edit_roundtrips_through_overrides() {
        let b = base();
        let mut inst = Entity::new("Coin 2");
        inst.prefab = Some(PrefabRef {
            path: "p.prefab.json".into(),
            overrides: Map::new(),
        });
        let mut e = effective(&inst, &b);
        assert_eq!(e.components, b.components);
        e.components[0].fields.insert("tint".into(), json!("#f00"));
        e.scripts[0].attributes.insert("value".into(), json!(5));
        let ov = overrides_for(&inst, &b, &e);
        assert_eq!(
            Value::Object(ov.clone()),
            json!({"components": {"0": {"tint": "#f00"}}, "scripts": {"0": {"attributes": {"value": 5}}}})
        );
        inst.prefab.as_mut().unwrap().overrides = ov;
        let again = effective(&inst, &b);
        assert_eq!(
            (again.components, again.scripts),
            (e.components.clone(), e.scripts.clone())
        );
        // reverting a field removes its override
        let mut r = e.clone();
        r.components[0].fields.insert("tint".into(), json!("#fff"));
        assert!(!overrides_for(&inst, &b, &r).contains_key("components"));
    }
}
