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

/// Keys a prefab *child* override can carry: the editable ones plus Active (`enabled`, the Inspector checkbox).
const CHILD_KEYS: [&str; 6] = [
    "components",
    "scripts",
    "behaviors",
    "effects",
    "layer",
    "enabled",
];

/// Id of the read-only Hierarchy row for the prefab child at `path` (child indices from the prefab root) of instance `inst`.
pub fn child_id(inst: &str, path: &[usize]) -> String {
    let p: Vec<String> = path.iter().map(usize::to_string).collect();
    format!("v:pfc:{inst}:{}", p.join("."))
}

/// Inverse of [`child_id`].
pub fn parse_child_id(id: &str) -> Option<(String, Vec<usize>)> {
    let rest = id.strip_prefix("v:pfc:")?;
    let (inst, p) = rest.rsplit_once(':')?;
    let path: Option<Vec<usize>> = p.split('.').map(|n| n.parse().ok()).collect();
    Some((inst.to_string(), path?))
}

/// The prefab-root descendant at `path`.
pub fn base_child<'a>(root: &'a Entity, path: &[usize]) -> Option<&'a Entity> {
    path.iter().try_fold(root, |e, &i| e.children.get(i))
}

fn child_slot<'a>(ov: &'a Map<String, Value>, path: &[usize]) -> Option<&'a Map<String, Value>> {
    path.iter().try_fold(ov, |m, i| {
        m.get("children")?
            .as_object()?
            .get(&i.to_string())?
            .as_object()
    })
}

/// Overrides stored on the instance for the child at `path` (only the Inspector-editable keys).
pub fn child_overrides(ov: &Map<String, Value>, path: &[usize]) -> Map<String, Value> {
    let mut out = Map::new();
    if let Some(m) = child_slot(ov, path) {
        for k in CHILD_KEYS {
            if let Some(v) = m.get(k) {
                out.insert(k.into(), v.clone());
            }
        }
    }
    out
}

fn prune(m: &mut Map<String, Value>) {
    if let Some(Value::Object(ch)) = m.get_mut("children") {
        for v in ch.values_mut() {
            if let Value::Object(o) = v {
                prune(o);
            }
        }
        ch.retain(|_, v| v.as_object().is_none_or(|o| !o.is_empty()));
        if ch.is_empty() {
            m.remove("children");
        }
    }
}

/// Replace the editable overrides of the child at `path` inside the instance's `ov` (empty patches disappear again).
/// Children use the same `{"children": {"<index>": {...}}}` shape the runtime's `applyOverrides` already merges.
pub fn set_child_overrides(ov: &mut Map<String, Value>, path: &[usize], patch: Map<String, Value>) {
    let mut cur = &mut *ov;
    for i in path {
        let ch = cur
            .entry("children")
            .or_insert_with(|| Value::Object(Map::new()));
        if !ch.is_object() {
            *ch = Value::Object(Map::new());
        }
        let Some(Value::Object(chm)) = Some(ch) else {
            return;
        };
        let slot = chm
            .entry(i.to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        if !slot.is_object() {
            *slot = Value::Object(Map::new());
        }
        let Value::Object(m) = slot else {
            return;
        };
        cur = m;
    }
    for k in CHILD_KEYS {
        cur.remove(k);
    }
    cur.extend(patch);
    prune(ov);
}

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
    // Active override stored on a prefab child (an instance root keeps its own `enabled`)
    if let Some(on) = p_enabled(inst) {
        out.enabled = on;
    }
    out
}

fn p_enabled(inst: &Entity) -> Option<bool> {
    inst.prefab.as_ref()?.overrides.get("enabled")?.as_bool()
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

/// Fill prefab instances with the prefab's content (what the game spawns) so the Scene view can draw and select it.
/// Children get the Hierarchy's read-only ids ([`child_id`]).
fn expand_instances(
    st: &EditorState,
    list: &mut [Entity],
    cache: &mut std::collections::HashMap<String, Option<Entity>>,
) {
    for e in list {
        if let (Some(p), true) = (&e.prefab, e.children.is_empty()) {
            let base = cache
                .entry(p.path.clone())
                .or_insert_with(|| st.read_prefab(&p.path))
                .clone();
            if let Some(base) = base {
                if let Ok(mut v) = serde_json::to_value(&base) {
                    apply(&mut v, &Value::Object(p.overrides.clone()));
                    if let Ok(m) = serde_json::from_value::<Entity>(v) {
                        e.components = m.components;
                        e.scripts = m.scripts;
                        e.behaviors = m.behaviors;
                        e.effects = m.effects;
                        e.children = m.children;
                        number_children(&e.id, &mut e.children, &mut vec![]);
                    }
                }
            }
        }
        expand_instances(st, &mut e.children, cache);
    }
}

fn number_children(inst: &str, kids: &mut [Entity], path: &mut Vec<usize>) {
    for (i, k) in kids.iter_mut().enumerate() {
        path.push(i);
        k.id = child_id(inst, path);
        number_children(inst, &mut k.children, path);
        path.pop();
    }
}

impl EditorState {
    /// The scene as the Scene view shows it: prefab instances expanded.
    pub fn viewport_scene(&self) -> Option<nord_core::scene::Scene> {
        let mut sc = self.scene.clone()?;
        expand_instances(self, &mut sc.entities, &mut Default::default());
        Some(sc)
    }

    /// `read_prefab` for per-frame callers (Hierarchy): re-read only when the prefab file or any of its `variantOf` bases changed.
    pub fn read_prefab_cached(&mut self, path: &str) -> Option<Entity> {
        let root = self.root.clone()?;
        let mtime = |p: &str| {
            nord_core::vfs::metadata(root.join(p))
                .and_then(|m| m.modified())
                .ok()
        };
        if let Some((deps, e)) = self.prefab_cache.get(path) {
            if deps.iter().all(|(p, t)| mtime(p) == Some(*t)) {
                return e.clone();
            }
        }
        // rebuild: remember the whole variant chain (cycle/depth guarded like resolve_prefab)
        let mut deps = vec![];
        let mut cur = Some(path.to_string());
        while let Some(p) = cur.take() {
            if deps.len() >= 9
                || deps
                    .iter()
                    .any(|(d, _): &(String, web_time::SystemTime)| *d == p)
            {
                break;
            }
            let Some(t) = mtime(&p) else { break };
            cur = self.read_prefab_file(&p).and_then(|f| f.variant_of);
            deps.push((p, t));
        }
        let e = self.read_prefab(path);
        if !deps.is_empty() {
            self.prefab_cache
                .insert(path.to_string(), (deps, e.clone()));
        }
        e
    }

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
        self.apply_prefab_part(id, None);
    }

    /// Overrides ▸ Apply one field (`only` = component index + field name); `None` applies everything.
    pub fn apply_prefab_part(&mut self, id: &str, only: Option<(usize, String)>) {
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
        if let Some((ci, field)) = &only {
            // keep the prefab as it is and take just this one value from the instance
            let mut one = base.clone();
            let val = merged.components.get(*ci).and_then(|c| c.fields.get(field));
            if let (Some(v), Some(dst)) = (val, one.components.get_mut(*ci)) {
                dst.fields.insert(field.clone(), v.clone());
            }
            merged = one;
        }
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
        let part = only.is_some();
        self.edit("Apply prefab overrides", None, |l| {
            if let Some(slot) = scene_ops::find_mut(l, &id) {
                if let Some(pr) = slot.prefab.as_mut() {
                    // a single field stays in the patch (now equal to the prefab, so harmless)
                    if !part {
                        pr.overrides.clear();
                    }
                }
            }
        });
        self.toast(format!("Applied to {}", p.path));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn child_override_paths() {
        assert_eq!(
            parse_child_id(&child_id("abc", &[1, 0])),
            Some(("abc".into(), vec![1, 0]))
        );
        let mut ov = Map::new();
        let mut patch = Map::new();
        patch.insert("layer".into(), Value::from(3));
        set_child_overrides(&mut ov, &[1, 0], patch);
        assert_eq!(ov["children"]["1"]["children"]["0"]["layer"], 3);
        assert_eq!(child_overrides(&ov, &[1, 0])["layer"], 3);
        set_child_overrides(&mut ov, &[1, 0], Map::new());
        assert!(ov.is_empty(), "empty patches are pruned: {ov:?}");
    }

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

#[cfg(test)]
mod child_active_tests {
    use super::*;

    #[test]
    fn child_active_override_roundtrips() {
        let mut ov = Map::new();
        let mut patch = Map::new();
        patch.insert("enabled".into(), Value::Bool(false));
        set_child_overrides(&mut ov, &[0], patch);
        assert_eq!(
            child_overrides(&ov, &[0]).get("enabled"),
            Some(&Value::Bool(false))
        );
        let mut inst = Entity::new("t");
        inst.prefab = Some(nord_core::scene::PrefabRef {
            path: "p".into(),
            overrides: child_overrides(&ov, &[0]),
        });
        assert!(!effective(&inst, &Entity::new("t")).enabled);
        set_child_overrides(&mut ov, &[0], Map::new());
        assert!(ov.is_empty(), "turning Active back on leaves no override");
    }
}
