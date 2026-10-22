//! Field schemas that drive the inspector: built-in components (compact table below) and script `static attributes`
//! (parsed leniently from the JS source). Unknown component fields fall back to a type-guessed JSON editor.
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, PartialEq)]
pub enum FieldType {
    Number {
        min: Option<f64>,
        max: Option<f64>,
    },
    Int,
    Bool,
    Str,
    Color,
    Vec2,
    Vec3,
    Enum(Vec<String>),
    Entity,
    /// image | audio | model | json | prefab
    Asset(String),
    /// list of `[t, value]` points
    Curve,
    Array(Box<FieldType>),
}

#[derive(Debug, Clone)]
pub struct Field {
    pub name: String,
    pub label: String,
    pub ty: FieldType,
    pub default: Value,
    /// tooltip text (script `description`/`tooltip` attribute), empty when none
    pub hint: String,
}

pub fn default_for(ty: &FieldType) -> Value {
    match ty {
        FieldType::Number { .. } => json!(0.0),
        FieldType::Int => json!(0),
        FieldType::Bool => json!(false),
        FieldType::Str | FieldType::Entity | FieldType::Asset(_) => json!(""),
        FieldType::Color => json!("#ffffff"),
        FieldType::Vec2 => json!([0.0, 0.0]),
        FieldType::Vec3 => json!([0.0, 0.0, 0.0]),
        FieldType::Enum(o) => json!(o.first().cloned().unwrap_or_default()),
        FieldType::Curve => json!([[0.0, 0.0], [1.0, 1.0]]),
        FieldType::Array(_) => json!([]),
    }
}

pub fn parse_type(t: &str) -> Option<FieldType> {
    let t = t.trim();
    if let Some(inner) = t.strip_prefix("array<").and_then(|x| x.strip_suffix('>')) {
        return Some(FieldType::Array(Box::new(parse_type(inner)?)));
    }
    if let Some(o) = t.strip_prefix("enum(").and_then(|x| x.strip_suffix(')')) {
        return Some(FieldType::Enum(o.split('|').map(str::to_string).collect()));
    }
    if let Some(o) = t.strip_prefix("asset(").and_then(|x| x.strip_suffix(')')) {
        return Some(FieldType::Asset(o.to_string()));
    }
    Some(match t {
        "number" | "float" => FieldType::Number {
            min: None,
            max: None,
        },
        "int" | "integer" => FieldType::Int,
        "bool" | "boolean" => FieldType::Bool,
        "string" | "text" => FieldType::Str,
        "color" => FieldType::Color,
        "vec2" => FieldType::Vec2,
        "vec3" => FieldType::Vec3,
        "entity" => FieldType::Entity,
        "curve" => FieldType::Curve,
        "asset" => FieldType::Asset("image".into()),
        _ => return None,
    })
}

/// "name:type=default name2:type2" -> fields. Defaults are parsed as JSON, falling back to a plain string.
fn dsl(s: &str) -> Vec<Field> {
    s.split_whitespace()
        .filter_map(|tok| {
            let (name, rest) = tok.split_once(':')?;
            let (ty, def) = match rest.split_once('=') {
                Some((t, d)) => (t, Some(d)),
                None => (rest, None),
            };
            let ty = parse_type(ty)?;
            let default = def
                .map(|d| serde_json::from_str(d).unwrap_or_else(|_| json!(d)))
                .unwrap_or_else(|| default_for(&ty));
            Some(Field {
                name: name.into(),
                label: label_of(name),
                ty,
                default,
                hint: String::new(),
            })
        })
        .collect()
}

pub fn label_of(name: &str) -> String {
    let mut out = String::new();
    for (i, c) in name.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            out.push(' ');
        }
        out.push(if i == 0 { c.to_ascii_uppercase() } else { c });
    }
    out
}

pub const COMPONENT_TYPES: [&str; 26] = [
    "sprite",
    "animatedSprite",
    "text",
    "tilemap",
    "particles",
    "camera",
    "light",
    "mesh",
    "model",
    "material",
    "rigidbody",
    "collider",
    "audioSource",
    "audioListener",
    "uiPanel",
    "uiButton",
    "uiLabel",
    "uiImage",
    "uiBar",
    "trigger",
    "path",
    "spawner",
    "graph",
    "parallax",
    "skybox",
    "postProcess",
];

const UI_POS: &str = "x:number y:number anchor:enum(tl|t|tr|l|c|r|bl|b|br)=\"tl\" w:number h:number screen:string=\"hud\"";

pub fn component_fields(kind: &str) -> Vec<Field> {
    let s = match kind {
        "sprite" => "texture:asset(image) frame:int tint:color alpha:number=1 flipX:bool flipY:bool",
        "animatedSprite" => "texture:asset(image) anim:string autoplay:bool=true speed:number=1 flipX:bool flipY:bool",
        "text" => "text:string size:int=16 color:color font:string align:enum(left|center|right) bold:bool stroke:color strokeThickness:int wrapWidth:int",
        "tilemap" => "map:asset(json) tileset:asset(image) tilesetName:string collides:bool",
        "particles" => "texture:asset(image) lifespan:number=1000 speed:number=100 angle:number gravityY:number scale:number=1 alpha:number=1 tint:color frequency:number=50 quantity:int=1 burst:bool emitting:bool=true blend:enum(normal|add|multiply|screen)",
        "camera" => "zoom:number=1 follow:entity lerp:number=0.1 background:color deadzone:vec2 roundPixels:bool fov:number=60 near:number=0.1 far:number=1000 type:enum(free|follow|arcRotate)=\"follow\" active:bool=true",
        "light" => "kind:enum(point|directional|spot|hemispheric)=\"point\" color:color intensity:number=1 radius:number=200 range:number=10 flicker:number castShadows:bool",
        "mesh" => "shape:enum(box|sphere|cylinder|plane|ground|capsule|torus)=\"box\" size:vec3 segments:int=24 castShadow:bool=true receiveShadow:bool=true",
        "model" => "path:asset(model) animation:string speed:number=1 shadow:bool unique:bool",
        "material" => "color:color metallic:number roughness:number=0.8 texture:asset(image) normalMap:asset(image) emissive:color alpha:number=1 doubleSided:bool unlit:bool",
        "rigidbody" => "mode:enum(dynamic|static|kinematic)=\"dynamic\" mass:number=1 drag:number=0.1 gravityScale:number=1 bounce:number",
        "collider" => "shape:enum(box|circle|sphere|capsule)=\"box\" size:vec3 radius:number offset:vec3 trigger:bool",
        "trigger" => "shape:enum(box|circle|sphere)=\"box\" size:vec3 radius:number offset:vec3",
        "audioSource" => "clip:asset(audio) volume:number=1 loop:bool autoplay:bool bus:enum(sfx|music|ui)=\"sfx\"",
        "audioListener" => "",
        "uiPanel" => UI_POS,
        "uiLabel" => return [dsl("text:string size:int=16 color:color"), dsl(UI_POS)].concat(),
        "uiImage" => return [dsl("src:asset(image)"), dsl(UI_POS)].concat(),
        "uiBar" => return [dsl("value:number=1 color:color"), dsl(UI_POS)].concat(),
        "uiButton" => return [dsl("text:string=\"Button\" event:string"), dsl(UI_POS)].concat(),
        "graph" => "file:asset(json)",
        "path" => "points:array<vec3> loop:bool",
        "spawner" => "prefab:asset(prefab) interval:number=1 max:int offset:vec3 jitter:vec3 autostart:bool=true",
        "parallax" => "texture:asset(image) factor:number=0.5 fit:bool=true scale:number=1",
        "skybox" => "path:asset(image)",
        "postProcess" => "bloom:bool bloomThreshold:number=0.8 bloomWeight:number=0.3 fxaa:bool vignette:number contrast:number=1 exposure:number=1 tonemap:bool grain:number sharpen:number chromaticAberration:number msaa:int",
        _ => "",
    };
    dsl(s)
}

/// Convert the JS object literal in `static attributes = { ... }` to JSON (single quotes, bare keys, trailing commas,
/// comments) — no JS evaluation.
pub fn js_literal_to_json(src: &str) -> String {
    let c: Vec<char> = src.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < c.len() {
        match c[i] {
            '/' if c.get(i + 1) == Some(&'/') => {
                while i < c.len() && c[i] != '\n' {
                    i += 1;
                }
            }
            '/' if c.get(i + 1) == Some(&'*') => {
                i += 2;
                while i + 1 < c.len() && !(c[i] == '*' && c[i + 1] == '/') {
                    i += 1;
                }
                i += 2;
            }
            q @ ('\'' | '"' | '`') => {
                let mut s = String::new();
                i += 1;
                while i < c.len() && c[i] != q {
                    if c[i] == '\\' && i + 1 < c.len() {
                        s.push(c[i]);
                        i += 1;
                    }
                    if c[i] == '"' {
                        s.push('\\');
                    }
                    s.push(c[i]);
                    i += 1;
                }
                i += 1;
                out.push('"');
                out.push_str(&s);
                out.push('"');
            }
            ch if ch.is_alphabetic() || ch == '_' || ch == '$' => {
                let st = i;
                while i < c.len() && (c[i].is_alphanumeric() || c[i] == '_' || c[i] == '$') {
                    i += 1;
                }
                let w: String = c[st..i].iter().collect();
                let mut j = i;
                while j < c.len() && c[j].is_whitespace() {
                    j += 1;
                }
                if c.get(j) == Some(&':') {
                    out.push_str(&format!("\"{w}\""));
                } else if matches!(w.as_str(), "true" | "false" | "null") {
                    out.push_str(&w);
                } else {
                    out.push_str("null"); // identifiers / expressions we cannot evaluate
                }
            }
            ch => {
                out.push(ch);
                i += 1;
            }
        }
    }
    // strip trailing commas
    let o: Vec<char> = out.chars().collect();
    let mut res = String::new();
    for (k, &ch) in o.iter().enumerate() {
        if ch == ',' {
            let nxt = o[k + 1..].iter().find(|x| !x.is_whitespace());
            if matches!(nxt, Some('}') | Some(']')) {
                continue;
            }
        }
        res.push(ch);
    }
    res
}

/// Extract `static attributes = {…}` fields from a script source.
pub fn script_attributes(src: &str) -> Vec<Field> {
    let Some(p) = src.find("static attributes") else {
        return vec![];
    };
    let Some(b) = src[p..].find('{') else {
        return vec![];
    };
    let body = &src[p + b..];
    let (mut depth, mut end) = (0i32, None);
    let mut quote: Option<char> = None;
    for (i, ch) in body.char_indices() {
        match (quote, ch) {
            (Some(q), c) if c == q => quote = None,
            (Some(_), _) => {}
            (None, '\'' | '"' | '`') => quote = Some(ch),
            (None, '{') => depth += 1,
            (None, '}') => {
                depth -= 1;
                if depth == 0 {
                    end = Some(i + 1);
                    break;
                }
            }
            _ => {}
        }
    }
    let Some(end) = end else { return vec![] };
    let Ok(Value::Object(m)) = serde_json::from_str::<Value>(&js_literal_to_json(&body[..end]))
    else {
        return vec![];
    };
    m.into_iter()
        .filter_map(|(k, v)| attr_field(&k, &v))
        .collect()
}

fn attr_field(name: &str, v: &Value) -> Option<Field> {
    let o = v.as_object()?;
    let t = o.get("type").and_then(Value::as_str).unwrap_or("string");
    let mut ty = match t {
        "enum" => {
            let opts = o
                .get("options")
                .or_else(|| o.get("values"))
                .and_then(Value::as_array);
            FieldType::Enum(
                opts.map(|a| {
                    a.iter()
                        .filter_map(|x| x.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            )
        }
        "asset" => FieldType::Asset(
            o.get("assetType")
                .and_then(Value::as_str)
                .unwrap_or("image")
                .into(),
        ),
        "array" => FieldType::Array(Box::new(
            o.get("of")
                .and_then(Value::as_str)
                .and_then(parse_type)
                .unwrap_or(FieldType::Str),
        )),
        other => parse_type(other)?,
    };
    if let FieldType::Number { min, max } = &mut ty {
        *min = o.get("min").and_then(Value::as_f64);
        *max = o.get("max").and_then(Value::as_f64);
    }
    let default = o
        .get("default")
        .filter(|d| !d.is_null())
        .cloned()
        .unwrap_or_else(|| default_for(&ty));
    let label = o
        .get("label")
        .and_then(Value::as_str)
        .map(String::from)
        .unwrap_or_else(|| label_of(name));
    let hint = o
        .get("description")
        .or_else(|| o.get("tooltip"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    Some(Field {
        name: name.into(),
        label,
        ty,
        default,
        hint,
    })
}

/// Guess an editor type for a raw JSON value (fields not in any schema).
pub fn guess(v: &Value) -> FieldType {
    match v {
        Value::Bool(_) => FieldType::Bool,
        Value::Number(n) if n.is_i64() => FieldType::Int,
        Value::Number(_) => FieldType::Number {
            min: None,
            max: None,
        },
        Value::String(s) if s.starts_with('#') && (s.len() == 7 || s.len() == 4) => {
            FieldType::Color
        }
        Value::Array(a) if a.len() == 2 && a.iter().all(Value::is_number) => FieldType::Vec2,
        Value::Array(a) if a.len() == 3 && a.iter().all(Value::is_number) => FieldType::Vec3,
        _ => FieldType::Str,
    }
}

pub fn merge_defaults(fields: &[Field], into: &mut Map<String, Value>) {
    for f in fields {
        into.entry(f.name.clone())
            .or_insert_with(|| f.default.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dsl_covers_all_components() {
        for k in COMPONENT_TYPES {
            let f = component_fields(k);
            if k != "audioListener" {
                assert!(!f.is_empty(), "{k}");
            }
        }
        let f = component_fields("sprite");
        assert_eq!(f[0].ty, FieldType::Asset("image".into()));
        let f = component_fields("path");
        assert_eq!(f[0].ty, FieldType::Array(Box::new(FieldType::Vec3)));
    }

    #[test]
    fn parses_script_attributes() {
        let src = r#"
export default class P extends NordScript {
  static attributes = {
    speed:     { type: 'number', default: 220, min: 0, max: 1000, label: 'Move speed' }, // px/s
    jumpForce: { type: 'number', default: 520 },
    sfxJump:   { type: 'asset', assetType: 'audio', default: 'assets/audio/sfx/jump.wav' },
    mode: { type: 'enum', options: ['a', 'b'], default: 'b', description: 'How it works' },
    tint: { type: 'color', default: '#ff0000', },
    pts: { type: 'array', of: 'vec2' },
  };
  start() { const x = { a: 1 }; }
}"#;
        let f = script_attributes(src);
        assert_eq!(f.len(), 6);
        assert_eq!(f[0].label, "Move speed");
        assert_eq!(
            f[0].ty,
            FieldType::Number {
                min: Some(0.0),
                max: Some(1000.0)
            }
        );
        assert_eq!(f[2].ty, FieldType::Asset("audio".into()));
        assert_eq!(f[3].ty, FieldType::Enum(vec!["a".into(), "b".into()]));
        assert_eq!(f[3].default, json!("b"));
        assert_eq!(f[3].hint, "How it works");
        assert_eq!(f[5].ty, FieldType::Array(Box::new(FieldType::Vec2)));
    }
}
