//! Prefab instance overrides for the Inspector (Unity-style): show the prefab merged with the instance's overrides, and turn
//! edits back into a minimal `overrides` patch. `apply` mirrors `applyOverrides` in `runtime/core/scene.js`.
use crate::{scene_ops, state::EditorState};
use nord_core::scene::Entity;
use serde_json::{Map, Value};

/// A prefab opened for editing on its own (Prefab mode); `back_*` is the scene we return to.
pub struct PrefabMode {
    pub path: String,
    pub back_scene: nord_core::scene::Scene,
    pub back_dirty: bool,
}

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
    serde_json::to_string_pretty(&nord_core::scene::Prefab {
        format: 1,
        root,
        variant_of: None,
        overrides: Map::new(),
    })
    .ok()
}

impl EditorState {
    /// The prefab file as stored (variants unresolved).
    pub fn read_prefab_file(&self, path: &str) -> Option<nord_core::scene::Prefab> {
        let txt = nord_core::vfs::read_to_string(self.root.as_ref()?.join(path)).ok()?;
        serde_json::from_str(&txt).ok()
    }

    /// A prefab's root entity; a variant resolves to its base root with the variant's overrides applied.
    pub fn read_prefab(&self, path: &str) -> Option<Entity> {
        self.resolve_prefab(path, 0)
    }

    fn resolve_prefab(&self, path: &str, depth: u8) -> Option<Entity> {
        let pf = self.read_prefab_file(path)?;
        match pf.variant_of.as_deref() {
            Some(base) if depth < 8 => {
                let mut v = serde_json::to_value(self.resolve_prefab(base, depth + 1)?).ok()?;
                apply(&mut v, &Value::Object(pf.overrides));
                serde_json::from_value(v).ok()
            }
            _ => Some(pf.root),
        }
    }

    /// Prefab ▸ Create variant: a new prefab file that points at `path` and only stores its own overrides.
    pub fn make_variant(&mut self, path: &str) -> Option<String> {
        let root = self.root.clone()?;
        let base = self.read_prefab(path)?;
        let stem = path
            .rsplit('/')
            .next()
            .unwrap_or(path)
            .trim_end_matches(".prefab.json");
        let dir = path.rsplit_once('/').map_or("prefabs", |(d, _)| d);
        let mut n = 1;
        let rel = loop {
            let name = if n == 1 {
                format!("{stem}-variant.prefab.json")
            } else {
                format!("{stem}-variant-{n}.prefab.json")
            };
            let rel = format!("{dir}/{name}");
            if !root.join(&rel).exists() {
                break rel;
            }
            n += 1;
        };
        let pf = nord_core::scene::Prefab {
            format: 1,
            root: base,
            variant_of: Some(path.to_string()),
            overrides: Map::new(),
        };
        let body = serde_json::to_string_pretty(&pf).ok()?;
        if nord_core::vfs::write(root.join(&rel), body).is_err() {
            self.toast("Could not write the variant");
            return None;
        }
        self.refresh_assets();
        self.toast(format!("Variant created: {rel}"));
        Some(rel)
    }

    /// Prefab mode: edit a prefab's root entity on its own (the scene is parked and comes back on exit).
    pub fn open_prefab_mode(&mut self, path: &str) {
        if self.prefab_mode.is_some() {
            self.exit_prefab_mode();
        }
        let Some(pf) = self.read_prefab_file(path) else {
            self.toast("Prefab file not found");
            return;
        };
        if pf.variant_of.is_some() {
            self.toast(
                "Variants are edited through their overrides (instance Inspector ▸ Apply all)",
            );
            return;
        }
        let Some(back) = self.scene.take() else {
            return;
        };
        let mut s = nord_core::scene::Scene::new(path.rsplit('/').next().unwrap_or(path));
        s.entities = vec![pf.root];
        self.prefab_mode = Some(PrefabMode {
            path: path.to_string(),
            back_scene: back,
            back_dirty: self.dirty,
        });
        self.scene = Some(s);
        self.selection.clear();
        self.undo.clear();
        self.dirty = false;
        self.rev += 1;
    }

    /// Write the prefab being edited back to its file (keeps any other keys of the file).
    pub fn save_prefab_mode(&mut self) {
        let (Some(pm), Some(root), Some(s)) = (&self.prefab_mode, self.root.clone(), &self.scene)
        else {
            return;
        };
        let Some(e) = s.entities.first() else { return };
        let path = root.join(&pm.path);
        let mut v: Value = nord_core::vfs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or_else(|| serde_json::json!({"format": 1}));
        v["root"] = serde_json::to_value(e).unwrap_or(Value::Null);
        let ok = serde_json::to_string_pretty(&v)
            .is_ok_and(|t| nord_core::vfs::write(&path, t + "\n").is_ok());
        let p = pm.path.clone();
        if ok {
            self.dirty = false;
            self.toast(format!("Saved {p}"));
        } else {
            self.toast("Could not save the prefab");
        }
    }

    /// Leave prefab mode (saving first: Auto Save) and restore the parked scene.
    pub fn exit_prefab_mode(&mut self) {
        if self.prefab_mode.is_none() {
            return;
        }
        if self.dirty {
            self.save_prefab_mode();
        }
        if let Some(pm) = self.prefab_mode.take() {
            self.scene = Some(pm.back_scene);
            self.dirty = pm.back_dirty;
            self.selection.clear();
            self.undo.clear();
            self.rev += 1;
        }
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
        // a variant keeps its link: store the difference to its own base, not a full root
        let variant = self
            .read_prefab_file(&p.path)
            .and_then(|f| f.variant_of.clone().map(|b| (b, f)));
        let body = if let Some((b, mut file)) = variant {
            let Some(bv) = self
                .read_prefab(&b)
                .and_then(|e| serde_json::to_value(e).ok())
            else {
                return;
            };
            let Ok(mv) = serde_json::to_value(&merged) else {
                return;
            };
            file.overrides = match diff(&bv, &mv) {
                Some(Value::Object(m)) => m,
                _ => Map::new(),
            };
            file.root = merged.clone();
            let Ok(t) = serde_json::to_string_pretty(&file) else {
                return;
            };
            t
        } else {
            let Some(body) = file_for(&merged) else {
                return;
            };
            body
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
