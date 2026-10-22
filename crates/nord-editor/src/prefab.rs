//! Prefab instance overrides for the Inspector (Unity-style): show the prefab merged with the instance's overrides, and turn
//! edits back into a minimal `overrides` patch. `apply` mirrors `applyOverrides` in `runtime/core/scene.js`.
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
