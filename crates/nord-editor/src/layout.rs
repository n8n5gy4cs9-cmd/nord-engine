//! Layout-editing logic on the scene model (M10-12/13/14): layers, alignment/distribution, object types, guides. Pure functions on
//! `Scene`/`Entity` so they are unit-testable; the Layout panel (`panels/layout.rs`) only calls them through `EditorState::edit_scene`.
//! Layer properties live in `scene.settings.layers[<layer number>]` and are applied by the runtime (see `runtime/phaser/index.js`).
use nord_core::{scene::Entity, Scene};
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, PartialEq)]
pub struct LayerInfo {
    pub id: i32,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f64,
    pub parallax: [f64; 2],
    pub blend: String,
    pub background: String,
    pub transparent: bool,
    pub count: usize,
}

fn layers_map(s: &Scene) -> Option<&Map<String, Value>> {
    s.settings.extra.get("layers").and_then(Value::as_object)
}

fn layers_mut(s: &mut Scene) -> &mut Map<String, Value> {
    let v = s.settings.extra.entry("layers").or_insert_with(|| json!({}));
    if !v.is_object() {
        *v = json!({});
    }
    v.as_object_mut().unwrap()
}

fn walk_layers(list: &[Entity], out: &mut std::collections::BTreeMap<i32, usize>) {
    for e in list {
        *out.entry(e.layer).or_default() += 1;
        walk_layers(&e.children, out);
    }
}

/// All layers, lowest (drawn first) to highest: those with settings plus any a used by entities; layer 0 always exists.
pub fn layers(s: &Scene) -> Vec<LayerInfo> {
    let mut counts = std::collections::BTreeMap::new();
    walk_layers(&s.entities, &mut counts);
    counts.entry(0).or_default();
    if let Some(m) = layers_map(s) {
        for k in m.keys().filter_map(|k| k.parse::<i32>().ok()) {
            counts.entry(k).or_default();
        }
    }
    counts
        .into_iter()
        .map(|(id, count)| {
            let p = layers_map(s).and_then(|m| m.get(&id.to_string())).cloned().unwrap_or(Value::Null);
            LayerInfo {
                id,
                name: p["name"].as_str().map_or_else(|| if id == 0 { "Layer 0".into() } else { format!("Layer {id}") }, String::from),
                visible: p["visible"].as_bool().unwrap_or(true),
                locked: p["locked"].as_bool().unwrap_or(false),
                opacity: p["opacity"].as_f64().unwrap_or(1.0),
                parallax: [p["parallax"][0].as_f64().unwrap_or(1.0), p["parallax"][1].as_f64().unwrap_or(1.0)],
                blend: p["blend"].as_str().unwrap_or("normal").into(),
                background: p["background"].as_str().unwrap_or("#000000").into(),
                transparent: p["transparent"].as_bool().unwrap_or(true),
                count,
            }
        })
        .collect()
}

pub fn set_layer_prop(s: &mut Scene, id: i32, key: &str, v: Value) {
    let m = layers_mut(s);
    let e = m.entry(id.to_string()).or_insert_with(|| json!({}));
    if !e.is_object() {
        *e = json!({});
    }
    e[key] = v;
}

/// New layer above all others; returns its number.
pub fn add_layer(s: &mut Scene) -> i32 {
    let id = layers(s).last().map_or(0, |l| l.id) + 1;
    set_layer_prop(s, id, "name", json!(format!("Layer {id}")));
    id
}

fn renumber(list: &mut [Entity], from: i32, to: i32) {
    for e in list {
        if e.layer == from {
            e.layer = to;
        }
        renumber(&mut e.children, from, to);
    }
}

/// Swap a layer with its neighbour above (`up`) or below: entities and layer properties both move.
pub fn move_layer(s: &mut Scene, id: i32, up: bool) -> bool {
    let all = layers(s);
    let Some(i) = all.iter().position(|l| l.id == id) else { return false };
    let j = if up { i + 1 } else { i.wrapping_sub(1) };
    let Some(other) = all.get(j) else { return false };
    let other = other.id;
    // park via a sentinel number so the two renumberings do not collide
    renumber(&mut s.entities, id, i32::MIN);
    renumber(&mut s.entities, other, id);
    renumber(&mut s.entities, i32::MIN, other);
    let m = layers_mut(s);
    let (a, b) = (m.remove(&id.to_string()), m.remove(&other.to_string()));
    if let Some(a) = a {
        m.insert(other.to_string(), a);
    }
    if let Some(b) = b {
        m.insert(id.to_string(), b);
    }
    true
}

/// Remove a layer; its objects drop to the layer below (or the one above when it is the lowest). The last layer cannot be deleted.
pub fn delete_layer(s: &mut Scene, id: i32) -> bool {
    let all = layers(s);
    if all.len() <= 1 {
        return false;
    }
    let Some(i) = all.iter().position(|l| l.id == id) else { return false };
    let target = if i > 0 { all[i - 1].id } else { all[i + 1].id };
    renumber(&mut s.entities, id, target);
    layers_mut(s).remove(&id.to_string());
    true
}

pub fn layer_of_entity(s: &Scene, id: &str) -> Option<i32> {
    fn find(list: &[Entity], id: &str) -> Option<i32> {
        list.iter().find_map(|e| if e.id == id { Some(e.layer) } else { find(&e.children, id) })
    }
    find(&s.entities, id)
}

// ---------------------------------------------------------------- arranging

/// Approximate size of an entity in world units (sprite/collider size, scaled); 32×32 when it has neither.
pub fn size_of(e: &Entity) -> [f64; 2] {
    let mut sz = [32.0, 32.0];
    for c in &e.components {
        let key = match c.kind.as_str() {
            "sprite" | "tiledBackground" | "ninePatch" | "drawingCanvas" | "video" => "size",
            "collider" => "size",
            _ => continue,
        };
        if let (Some(w), Some(h)) = (c.fields.get(key).and_then(|v| v[0].as_f64()), c.fields.get(key).and_then(|v| v[1].as_f64())) {
            sz = [w, h];
            if c.kind == "sprite" {
                break;
            }
        }
    }
    [sz[0] * e.transform.scale[0].abs(), sz[1] * e.transform.scale[1].abs()]
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Align {
    Left,
    CenterH,
    Right,
    Top,
    CenterV,
    Bottom,
}

fn find_mut<'a>(list: &'a mut [Entity], id: &str) -> Option<&'a mut Entity> {
    for e in list {
        if e.id == id {
            return Some(e);
        }
        if let Some(f) = find_mut(&mut e.children, id) {
            return Some(f);
        }
    }
    None
}

/// Align the entities `ids` (top-level positions; objects are treated as boxes centred on their position, Y down).
pub fn align(entities: &mut [Entity], ids: &[String], mode: Align) {
    if ids.len() < 2 {
        return;
    }
    let boxes: Vec<(String, [f64; 2], [f64; 2])> = ids
        .iter()
        .filter_map(|id| {
            let e = find_mut(entities, id)?;
            Some((id.clone(), [e.transform.pos[0], e.transform.pos[1]], size_of(e)))
        })
        .collect();
    let (lo_x, hi_x, lo_y, hi_y) = boxes.iter().fold((f64::MAX, f64::MIN, f64::MAX, f64::MIN), |a, (_, p, s)| {
        (a.0.min(p[0] - s[0] / 2.0), a.1.max(p[0] + s[0] / 2.0), a.2.min(p[1] - s[1] / 2.0), a.3.max(p[1] + s[1] / 2.0))
    });
    for (id, _, s) in boxes {
        if let Some(e) = find_mut(entities, &id) {
            match mode {
                Align::Left => e.transform.pos[0] = lo_x + s[0] / 2.0,
                Align::Right => e.transform.pos[0] = hi_x - s[0] / 2.0,
                Align::CenterH => e.transform.pos[0] = (lo_x + hi_x) / 2.0,
                Align::Top => e.transform.pos[1] = lo_y + s[1] / 2.0,
                Align::Bottom => e.transform.pos[1] = hi_y - s[1] / 2.0,
                Align::CenterV => e.transform.pos[1] = (lo_y + hi_y) / 2.0,
            }
        }
    }
}

/// Spread entities evenly between the outermost two along an axis (centres equally spaced); needs at least three.
pub fn distribute(entities: &mut [Entity], ids: &[String], horizontal: bool) {
    let ax = usize::from(!horizontal);
    let mut v: Vec<(String, f64)> = ids.iter().filter_map(|id| Some((id.clone(), find_mut(entities, id)?.transform.pos[ax]))).collect();
    if v.len() < 3 {
        return;
    }
    v.sort_by(|a, b| a.1.total_cmp(&b.1));
    let (a, b) = (v[0].1, v[v.len() - 1].1);
    let n = (v.len() - 1) as f64;
    for (i, (id, _)) in v.iter().enumerate() {
        if let Some(e) = find_mut(entities, id) {
            e.transform.pos[ax] = a + (b - a) * i as f64 / n;
        }
    }
}

// ---------------------------------------------------------------- object types

#[derive(Debug, Clone, PartialEq)]
pub struct ObjType {
    pub name: String,
    pub count: usize,
    pub ids: Vec<String>,
}

/// Object types = entity names (what event sheets call objects), with their instances. Alphabetical.
pub fn object_types(s: &Scene) -> Vec<ObjType> {
    fn go(list: &[Entity], m: &mut std::collections::BTreeMap<String, Vec<String>>) {
        for e in list {
            m.entry(e.name.clone()).or_default().push(e.id.clone());
            go(&e.children, m);
        }
    }
    let mut m = std::collections::BTreeMap::new();
    go(&s.entities, &mut m);
    m.into_iter().map(|(name, ids)| ObjType { name, count: ids.len(), ids }).collect()
}

/// "Object type = shared properties": copy components, behaviors, effects, scripts, tags and layer of `from` to every other
/// instance with the same name (positions, rotation, scale, ids and children are kept). Returns the instances changed.
pub fn sync_type(entities: &mut [Entity], from: &str) -> usize {
    fn find<'a>(list: &'a [Entity], id: &str) -> Option<&'a Entity> {
        list.iter().find_map(|e| if e.id == id { Some(e) } else { find(&e.children, id) })
    }
    let Some(src) = find(entities, from).cloned() else { return 0 };
    fn go(list: &mut [Entity], src: &Entity, n: &mut usize) {
        for e in list {
            if e.name == src.name && e.id != src.id {
                e.components = src.components.clone();
                e.behaviors = src.behaviors.clone();
                e.effects = src.effects.clone();
                e.scripts = src.scripts.clone();
                e.tags = src.tags.clone();
                e.layer = src.layer;
                *n += 1;
            }
            go(&mut e.children, src, n);
        }
    }
    let mut n = 0;
    go(entities, &src, &mut n);
    n
}

// ---------------------------------------------------------------- guides + bounds

/// `settings.guides = { "x": [..], "y": [..] }` (world coordinates; drawn as rulers' guide lines in the viewport).
pub fn guides(s: &Scene) -> (Vec<f64>, Vec<f64>) {
    let g = s.settings.extra.get("guides");
    let list = |k: &str| g.and_then(|g| g[k].as_array()).map(|a| a.iter().filter_map(Value::as_f64).collect()).unwrap_or_default();
    (list("x"), list("y"))
}

pub fn set_guides(s: &mut Scene, x: Vec<f64>, y: Vec<f64>) {
    if x.is_empty() && y.is_empty() {
        s.settings.extra.remove("guides");
    } else {
        s.settings.extra.insert("guides".into(), json!({ "x": x, "y": y }));
    }
}

/// Snap `v` to the closest guide within `radius`.
pub fn snap_to_guides(v: f64, guides: &[f64], radius: f64) -> f64 {
    guides.iter().copied().filter(|g| (g - v).abs() <= radius).min_by(|a, b| (a - v).abs().total_cmp(&(b - v).abs())).unwrap_or(v)
}

/// Saved camera views (`settings.views = [{name, x, y, zoom}]`).
pub fn views(s: &Scene) -> Vec<(String, [f64; 3])> {
    s.settings.extra.get("views").and_then(Value::as_array).map(|a| a.iter().map(|v| (v["name"].as_str().unwrap_or("view").to_string(), [v["x"].as_f64().unwrap_or(0.0), v["y"].as_f64().unwrap_or(0.0), v["zoom"].as_f64().unwrap_or(1.0)])).collect()).unwrap_or_default()
}

pub fn save_view(s: &mut Scene, name: &str, cam: [f64; 3]) {
    let mut v = views(s);
    v.retain(|(n, _)| n != name);
    v.push((name.to_string(), cam));
    set_views(s, &v);
}

pub fn set_views(s: &mut Scene, v: &[(String, [f64; 3])]) {
    if v.is_empty() {
        s.settings.extra.remove("views");
    } else {
        s.settings.extra.insert("views".into(), json!(v.iter().map(|(n, c)| json!({"name": n, "x": c[0], "y": c[1], "zoom": c[2]})).collect::<Vec<_>>()));
    }
}

/// Place a copy of the first instance of object type `name` at world position (x, y) (top level). Returns the new id.
pub fn place_instance(s: &mut Scene, name: &str, x: f64, y: f64) -> Option<String> {
    let src = object_types(s).into_iter().find(|t| t.name == name)?.ids.first()?.clone();
    fn find<'a>(list: &'a [Entity], id: &str) -> Option<&'a Entity> {
        list.iter().find_map(|e| if e.id == id { Some(e) } else { find(&e.children, id) })
    }
    let mut c = crate::scene_ops::clone_fresh(find(&s.entities, &src)?);
    c.transform.pos[0] = x;
    c.transform.pos[1] = y;
    let id = c.id.clone();
    s.entities.push(c);
    Some(id)
}

/// World-space box [x0, y0, x1, y1] containing every top-level entity (for the minimap).
pub fn content_bounds(s: &Scene) -> Option<[f64; 4]> {
    let mut b: Option<[f64; 4]> = None;
    for e in &s.entities {
        let sz = size_of(e);
        let (x, y) = (e.transform.pos[0], e.transform.pos[1]);
        let r = [x - sz[0] / 2.0, y - sz[1] / 2.0, x + sz[0] / 2.0, y + sz[1] / 2.0];
        b = Some(match b {
            None => r,
            Some(o) => [o[0].min(r[0]), o[1].min(r[1]), o[2].max(r[2]), o[3].max(r[3])],
        });
    }
    b
}

/// Layout properties: `settings.layoutSize = {width, height}` bounds Bound/DestroyOutside behaviors; `unboundedScrolling` lets the camera leave it.
pub fn layout_size(s: &Scene) -> Option<[f64; 2]> {
    let v = s.settings.extra.get("layoutSize")?;
    Some([v["width"].as_f64()?, v["height"].as_f64()?])
}

pub fn set_layout_size(s: &mut Scene, size: Option<[f64; 2]>) {
    match size {
        Some([w, h]) => {
            s.settings.extra.insert("layoutSize".into(), json!({ "width": w, "height": h }));
        }
        None => {
            s.settings.extra.remove("layoutSize");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nord_core::scene::Component;

    fn ent(name: &str, x: f64, y: f64, w: f64, h: f64, layer: i32) -> Entity {
        let mut e = Entity::new(name);
        e.transform.pos = [x, y, 0.0];
        e.layer = layer;
        let mut c = Component { kind: "sprite".into(), fields: Default::default() };
        c.fields.insert("size".into(), json!([w, h]));
        e.components.push(c);
        e
    }

    fn scene() -> Scene {
        let mut s = Scene::new("t");
        s.entities = vec![ent("A", 10.0, 10.0, 20.0, 20.0, 0), ent("B", 100.0, 50.0, 40.0, 40.0, 1), ent("C", 60.0, 90.0, 10.0, 10.0, 1)];
        s
    }

    #[test]
    fn layers_list_add_prop_move_delete() {
        let mut s = scene();
        let l = layers(&s);
        assert_eq!(l.iter().map(|l| (l.id, l.count)).collect::<Vec<_>>(), vec![(0, 1), (1, 2)]);
        let id = add_layer(&mut s);
        assert_eq!(id, 2);
        set_layer_prop(&mut s, 2, "opacity", json!(0.5));
        set_layer_prop(&mut s, 2, "parallax", json!([0.0, 0.0]));
        let l2 = layers(&s).pop().unwrap();
        assert_eq!((l2.opacity, l2.parallax), (0.5, [0.0, 0.0]));
        // move layer 1 up: entities B, C go to 2, the old layer 2 (empty) becomes 1 with its props
        assert!(move_layer(&mut s, 1, true));
        assert_eq!(layer_of_entity(&s, &s.entities[1].id.clone()), Some(2));
        assert_eq!(layers(&s).iter().find(|l| l.id == 1).unwrap().opacity, 0.5);
        assert!(!move_layer(&mut s, 2, true), "top layer cannot move up");
        // delete layer 2: its objects drop to layer 1
        assert!(delete_layer(&mut s, 2));
        assert_eq!(s.entities[1].layer, 1);
        assert!(!layers(&s).iter().any(|l| l.id == 2));
        let mut one = Scene::new("x");
        assert!(!delete_layer(&mut one, 0), "the last layer stays");
    }

    #[test]
    fn align_and_distribute() {
        let mut s = scene();
        let ids: Vec<String> = s.entities.iter().map(|e| e.id.clone()).collect();
        align(&mut s.entities, &ids, Align::Left);
        // leftmost edge = A: 10 - 10 = 0 → A.x 10, B.x 20, C.x 5
        assert_eq!(s.entities.iter().map(|e| e.transform.pos[0]).collect::<Vec<_>>(), vec![10.0, 20.0, 5.0]);
        align(&mut s.entities, &ids, Align::Bottom);
        // lowest bottom edge: C 90+5=95
        assert_eq!(s.entities.iter().map(|e| e.transform.pos[1]).collect::<Vec<_>>(), vec![85.0, 75.0, 90.0]);
        let mut t = scene();
        let ids: Vec<String> = t.entities.iter().map(|e| e.id.clone()).collect();
        distribute(&mut t.entities, &ids, true);
        assert_eq!(t.entities.iter().map(|e| e.transform.pos[0]).collect::<Vec<_>>(), vec![10.0, 100.0, 55.0]);
    }

    #[test]
    fn object_types_and_sync() {
        let mut s = scene();
        let mut b2 = ent("B", 200.0, 50.0, 8.0, 8.0, 0);
        b2.tags = vec!["x".into()];
        s.entities.push(b2);
        let t = object_types(&s);
        assert_eq!(t.iter().map(|t| (t.name.as_str(), t.count)).collect::<Vec<_>>(), vec![("A", 1), ("B", 2), ("C", 1)]);
        let from = s.entities[1].id.clone();
        s.entities[1].behaviors.push(json!({"type": "Solid"}));
        assert_eq!(sync_type(&mut s.entities, &from), 1);
        assert_eq!(s.entities[3].behaviors.len(), 1);
        assert_eq!(s.entities[3].components[0].fields["size"], json!([40.0, 40.0]));
        assert_eq!(s.entities[3].transform.pos[0], 200.0, "position stays");
        assert_eq!(s.entities[3].layer, 1);
    }

    #[test]
    fn views_and_drag_placement() {
        let mut s = scene();
        save_view(&mut s, "boss", [500.0, 200.0, 0.5]);
        save_view(&mut s, "start", [0.0, 0.0, 1.0]);
        save_view(&mut s, "boss", [600.0, 200.0, 0.5]);
        assert_eq!(views(&s), vec![("start".to_string(), [0.0, 0.0, 1.0]), ("boss".to_string(), [600.0, 200.0, 0.5])]);
        set_views(&mut s, &[]);
        assert!(!s.settings.extra.contains_key("views"));
        let n = s.entities.len();
        let id = place_instance(&mut s, "B", 321.0, 123.0).unwrap();
        assert_eq!(s.entities.len(), n + 1);
        let e = s.entities.last().unwrap();
        assert_eq!((e.id.clone(), e.name.as_str(), e.transform.pos[0], e.transform.pos[1]), (id, "B", 321.0, 123.0));
        assert_eq!(e.components[0].fields["size"], json!([40.0, 40.0]), "a full copy");
        assert!(place_instance(&mut s, "Nope", 0.0, 0.0).is_none());
    }

    #[test]
    fn guides_bounds_and_layout_size() {
        let mut s = scene();
        assert_eq!(guides(&s), (vec![], vec![]));
        set_guides(&mut s, vec![0.0, 100.0], vec![50.0]);
        assert_eq!(guides(&s).0, vec![0.0, 100.0]);
        assert_eq!(snap_to_guides(97.0, &guides(&s).0, 5.0), 100.0);
        assert_eq!(snap_to_guides(60.0, &guides(&s).0, 5.0), 60.0);
        set_guides(&mut s, vec![], vec![]);
        assert!(!s.settings.extra.contains_key("guides"));
        assert_eq!(content_bounds(&s), Some([0.0, 0.0, 120.0, 95.0]));
        set_layout_size(&mut s, Some([800.0, 600.0]));
        assert_eq!(layout_size(&s), Some([800.0, 600.0]));
        set_layout_size(&mut s, None);
        assert_eq!(layout_size(&s), None);
    }
}
