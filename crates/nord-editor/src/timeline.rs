//! Timeline / keyframe editing logic (M10-21). Data = `scene.settings.timelines[name]` (format in `runtime/core/timeline.js`). The easing and
//! sampling functions mirror the runtime exactly, so the editor's curve preview and scrubbing show what the game will do.
use nord_core::Scene;
use serde_json::{json, Map, Value};

pub const EASES: &[&str] = &[
    "linear",
    "quadIn",
    "quadOut",
    "quadInOut",
    "cubicIn",
    "cubicOut",
    "cubicInOut",
    "sineInOut",
    "backOut",
    "elasticOut",
    "bounceOut",
    "bounceIn",
];
pub const PROPERTIES: &[&str] = &["x", "y", "z", "angle", "scaleX", "scaleY", "opacity"];

fn bounce_out(t: f64) -> f64 {
    let (n1, d1) = (7.5625, 2.75);
    if t < 1.0 / d1 {
        n1 * t * t
    } else if t < 2.0 / d1 {
        let t = t - 1.5 / d1;
        n1 * t * t + 0.75
    } else if t < 2.5 / d1 {
        let t = t - 2.25 / d1;
        n1 * t * t + 0.9375
    } else {
        let t = t - 2.625 / d1;
        n1 * t * t + 0.984375
    }
}

pub fn ease(name: &str, t: f64) -> f64 {
    match name {
        "quadIn" => t * t,
        "quadOut" => 1.0 - (1.0 - t) * (1.0 - t),
        "quadInOut" => {
            if t < 0.5 {
                2.0 * t * t
            } else {
                1.0 - (-2.0 * t + 2.0).powi(2) / 2.0
            }
        }
        "cubicIn" => t.powi(3),
        "cubicOut" => 1.0 - (1.0 - t).powi(3),
        "cubicInOut" => {
            if t < 0.5 {
                4.0 * t.powi(3)
            } else {
                1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
            }
        }
        "sineInOut" => -((std::f64::consts::PI * t).cos() - 1.0) / 2.0,
        "backOut" => 1.0 + 2.70158 * (t - 1.0).powi(3) + 1.70158 * (t - 1.0).powi(2),
        "elasticOut" => {
            if t == 0.0 || t == 1.0 {
                t
            } else {
                2f64.powf(-10.0 * t)
                    * (((t * 10.0 - 0.75) * (2.0 * std::f64::consts::PI) / 3.0).sin())
                    + 1.0
            }
        }
        "bounceOut" => bounce_out(t),
        "bounceIn" => 1.0 - bounce_out(1.0 - t),
        _ => t,
    }
}

/// CSS-style cubic-bezier easing.
pub fn bezier(x1: f64, y1: f64, x2: f64, y2: f64, x: f64) -> f64 {
    if x <= 0.0 {
        return 0.0;
    }
    if x >= 1.0 {
        return 1.0;
    }
    let (cx, cy) = (3.0 * x1, 3.0 * y1);
    let (bx, by) = (3.0 * (x2 - x1) - cx, 3.0 * (y2 - y1) - cy);
    let (ax, ay) = (1.0 - cx - bx, 1.0 - cy - by);
    let (fx, fy) = (
        |t: f64| ((ax * t + bx) * t + cx) * t,
        |t: f64| ((ay * t + by) * t + cy) * t,
    );
    let (mut lo, mut hi, mut t) = (0.0, 1.0, x);
    for _ in 0..30 {
        let v = fx(t);
        if (v - x).abs() < 1e-6 {
            break;
        }
        if v < x {
            lo = t;
        } else {
            hi = t;
        }
        t = (lo + hi) / 2.0;
    }
    fy(t)
}

/// The key's ease value: a name (string) or `[x1, y1, x2, y2]`.
pub fn apply_ease(e: &Value, t: f64) -> f64 {
    match e {
        Value::Array(a) if a.len() == 4 => bezier(
            a[0].as_f64().unwrap_or(0.0),
            a[1].as_f64().unwrap_or(0.0),
            a[2].as_f64().unwrap_or(1.0),
            a[3].as_f64().unwrap_or(1.0),
            t,
        ),
        Value::String(s) => ease(s, t),
        _ => t,
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Key {
    pub t: f64,
    pub v: f64,
    pub ease: Value,
}

pub fn keys(track: &Value) -> Vec<Key> {
    let mut k: Vec<Key> = track["keys"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|k| Key {
                    t: k["t"].as_f64().unwrap_or(0.0),
                    v: k["v"].as_f64().unwrap_or(0.0),
                    ease: k["ease"].clone(),
                })
                .collect()
        })
        .unwrap_or_default();
    k.sort_by(|a, b| a.t.total_cmp(&b.t));
    k
}

pub fn write_keys(track: &mut Value, keys: &[Key]) {
    track["keys"] = Value::Array(
        keys.iter()
            .map(|k| {
                let mut o = json!({ "t": (k.t * 1000.0).round() / 1000.0, "v": (k.v * 1000.0).round() / 1000.0 });
                if !k.ease.is_null() && k.ease != json!("linear") {
                    o["ease"] = k.ease.clone();
                }
                o
            })
            .collect(),
    );
}

/// Same as the runtime's `sample`: the segment ending at the next key uses that key's ease.
pub fn sample(keys: &[Key], t: f64) -> Option<f64> {
    let first = keys.first()?;
    let last = keys.last()?;
    if t <= first.t {
        return Some(first.v);
    }
    if t >= last.t {
        return Some(last.v);
    }
    let i = keys
        .windows(2)
        .position(|w| t < w[1].t)
        .unwrap_or(keys.len() - 2);
    let (a, b) = (&keys[i], &keys[i + 1]);
    Some(a.v + (b.v - a.v) * apply_ease(&b.ease, (t - a.t) / (b.t - a.t)))
}

// ---------------------------------------------------------------- scene settings access

fn map_mut(s: &mut Scene) -> &mut Map<String, Value> {
    let v = s
        .settings
        .extra
        .entry("timelines")
        .or_insert_with(|| json!({}));
    if !v.is_object() {
        *v = json!({});
    }
    v.as_object_mut().unwrap()
}

pub fn names(s: &Scene) -> Vec<String> {
    s.settings
        .extra
        .get("timelines")
        .and_then(Value::as_object)
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default()
}

pub fn get<'a>(s: &'a Scene, name: &str) -> Option<&'a Value> {
    s.settings.extra.get("timelines")?.get(name)
}

pub fn add_timeline(s: &mut Scene, name: &str) -> bool {
    let m = map_mut(s);
    if m.contains_key(name) || name.is_empty() {
        return false;
    }
    m.insert(
        name.into(),
        json!({ "duration": 2.0, "loop": false, "tracks": [], "events": [] }),
    );
    true
}

pub fn delete_timeline(s: &mut Scene, name: &str) {
    map_mut(s).remove(name);
    if map_mut(s).is_empty() {
        s.settings.extra.remove("timelines");
    }
}

pub fn rename_timeline(s: &mut Scene, from: &str, to: &str) -> bool {
    let m = map_mut(s);
    if from == to || to.is_empty() || m.contains_key(to) {
        return false;
    }
    match m.remove(from) {
        Some(v) => {
            m.insert(to.into(), v);
            true
        }
        None => false,
    }
}

pub fn timeline_mut<'a>(s: &'a mut Scene, name: &str) -> Option<&'a mut Value> {
    map_mut(s).get_mut(name)
}

pub fn add_track(tl: &mut Value, target: &str, property: &str) {
    if !tl["tracks"].is_array() {
        tl["tracks"] = json!([]);
    }
    tl["tracks"]
        .as_array_mut()
        .unwrap()
        .push(json!({ "target": target, "property": property, "keys": [] }));
}

/// Insert a key at time `t` (value = the track's current sampled value, or 0), keeping time order. Returns its index.
pub fn add_key(track: &mut Value, t: f64) -> usize {
    let mut k = keys(track);
    let v = sample(&k, t).unwrap_or(0.0);
    k.push(Key {
        t,
        v,
        ease: Value::Null,
    });
    k.sort_by(|a, b| a.t.total_cmp(&b.t));
    let i = k.iter().position(|x| x.t == t).unwrap_or(0);
    write_keys(track, &k);
    i
}

/// Move key `i` to time `t` (clamped to [0, duration]); returns its new index after re-sorting.
pub fn move_key(track: &mut Value, i: usize, t: f64, duration: f64) -> usize {
    let mut k = keys(track);
    if i >= k.len() {
        return i;
    }
    let t = t.clamp(0.0, duration.max(0.0));
    k[i].t = t;
    let marker = k[i].clone();
    k.sort_by(|a, b| a.t.total_cmp(&b.t));
    let ni = k.iter().position(|x| *x == marker).unwrap_or(i);
    write_keys(track, &k);
    ni
}

pub fn remove_key(track: &mut Value, i: usize) {
    let mut k = keys(track);
    if i < k.len() {
        k.remove(i);
        write_keys(track, &k);
    }
}

/// Track value range for drawing: (min, max) of the keys, padded.
pub fn value_range(keys: &[Key]) -> (f64, f64) {
    let (lo, hi) = keys
        .iter()
        .fold((f64::MAX, f64::MIN), |a, k| (a.0.min(k.v), a.1.max(k.v)));
    if keys.is_empty() {
        (0.0, 1.0)
    } else if (hi - lo).abs() < 1e-9 {
        (lo - 1.0, hi + 1.0)
    } else {
        (lo, hi)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn easing_matches_the_runtime() {
        assert_eq!(ease("quadIn", 0.5), 0.25);
        assert_eq!(ease("quadOut", 0.5), 0.75);
        assert!((ease("backOut", 1.0) - 1.0).abs() < 1e-9);
        assert_eq!(ease("bounceOut", 1.0), 1.0);
        assert_eq!(ease("elasticOut", 0.0), 0.0);
        assert!((ease("sineInOut", 0.5) - 0.5).abs() < 1e-12);
        assert_eq!(ease("nonsense", 0.3), 0.3);
        let b = bezier(0.25, 0.1, 0.25, 1.0, 0.5);
        assert!(b > 0.5 && b < 1.0);
        assert_eq!(
            (bezier(0.0, 0.0, 1.0, 1.0, 0.37) * 100.0).round(),
            37.0,
            "linear bezier"
        );
    }

    #[test]
    fn sampling_and_key_editing() {
        let mut tr = json!({ "target": "Box", "property": "x", "keys": [] });
        assert_eq!(add_key(&mut tr, 0.0), 0);
        let k = keys(&tr);
        assert_eq!(sample(&k, 5.0), Some(0.0));
        let mut k = keys(&tr);
        k.push(Key {
            t: 2.0,
            v: 10.0,
            ease: json!("quadIn"),
        });
        write_keys(&mut tr, &k);
        assert_eq!(sample(&keys(&tr), 1.0), Some(2.5), "eased by the next key");
        assert_eq!(sample(&keys(&tr), 3.0), Some(10.0));
        let i = add_key(&mut tr, 1.0);
        assert_eq!(i, 1);
        assert_eq!(keys(&tr).len(), 3);
        assert_eq!(
            keys(&tr)[1].v,
            2.5,
            "a new key starts at the curve's current value"
        );
        let ni = move_key(&mut tr, 1, 5.0, 3.0);
        assert_eq!(ni, 2, "clamped to the duration and re-sorted");
        remove_key(&mut tr, 0);
        assert_eq!(keys(&tr).len(), 2);
        assert_eq!(tr["keys"][0]["ease"], "quadIn");
        assert!(sample(&[], 0.0).is_none());
        assert_eq!(value_range(&[]), (0.0, 1.0));
    }

    #[test]
    fn timelines_in_scene_settings() {
        let mut s = Scene::new("t");
        assert!(add_timeline(&mut s, "intro"));
        assert!(!add_timeline(&mut s, "intro"));
        add_track(timeline_mut(&mut s, "intro").unwrap(), "Title", "y");
        assert_eq!(get(&s, "intro").unwrap()["tracks"][0]["target"], "Title");
        assert!(rename_timeline(&mut s, "intro", "start"));
        assert_eq!(names(&s), vec!["start".to_string()]);
        delete_timeline(&mut s, "start");
        assert!(!s.settings.extra.contains_key("timelines"));
    }
}
