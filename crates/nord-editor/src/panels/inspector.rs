//! Inspector generated from `schema.rs` (component tables + script `static attributes`). Edits a clone of the selected
//! entity and commits one coalesced undo step when anything changed.
use crate::{
    icons, scene_ops,
    schema::{self, Field, FieldType},
    state::EditorState,
    theme,
};
use egui::{DragValue, Ui};
use nord_core::vfs::PathExt;
use nord_core::{
    assets::{Asset, AssetType},
    scene::{Component, Entity, ScriptRef},
};
use serde_json::{json, Map, Value};

/// Drag payload used by the asset browser and asset pickers.
#[derive(Clone)]
pub struct AssetDrag(pub String);

pub struct Ctx<'a> {
    pub assets: &'a [Asset],
    pub entities: Vec<(String, String)>,
}

fn num(v: &Value) -> f64 {
    v.as_f64().unwrap_or(0.0)
}

fn drag(ui: &mut Ui, v: &mut f64, min: Option<f64>, max: Option<f64>, speed: f64) -> bool {
    let mut d = DragValue::new(v).speed(speed);
    if let (Some(a), Some(b)) = (min, max) {
        d = d.range(a..=b);
    } else if let Some(a) = min {
        d = d.range(a..=f64::MAX);
    }
    ui.add(d).changed()
}

fn vec_n(ui: &mut Ui, v: &mut Value, n: usize) -> bool {
    let mut a: Vec<f64> = v
        .as_array()
        .map(|a| a.iter().map(num).collect())
        .unwrap_or_default();
    a.resize(n, 0.0);
    let mut ch = false;
    ui.horizontal(|ui| {
        for (i, x) in a.iter_mut().enumerate() {
            let label = ["x", "y", "z"][i];
            ui.weak(label);
            ch |= drag(ui, x, None, None, 0.1);
        }
    });
    if ch {
        *v = json!(a);
    }
    ch
}

pub fn asset_matches(kind: &str, a: &Asset) -> bool {
    match kind {
        "image" => matches!(a.kind, AssetType::Image | AssetType::Spritesheet),
        "audio" => a.kind == AssetType::Audio,
        "model" => a.kind == AssetType::Model,
        "prefab" => a.kind == AssetType::Prefab,
        "material" => a.kind == AssetType::Material,
        "json" => matches!(
            a.kind,
            AssetType::Json | AssetType::Prefab | AssetType::Scene
        ),
        _ => true,
    }
}

/// One widget for one typed value. Returns true when the value changed.
pub fn field_ui(ui: &mut Ui, cx: &Ctx, ty: &FieldType, v: &mut Value, id: &str) -> bool {
    let mut ch = false;
    match ty {
        FieldType::Number { min, max } => {
            let mut x = num(v);
            let changed = match (min, max) {
                (Some(a), Some(b)) if b > a => ui
                    .add(egui::Slider::new(&mut x, *a..=*b).clamping(egui::SliderClamping::Never))
                    .changed(),
                _ => drag(ui, &mut x, *min, *max, 0.05),
            };
            if changed {
                *v = json!(x);
                ch = true;
            }
        }
        FieldType::Int => {
            let mut x = num(v) as i64;
            if ui.add(DragValue::new(&mut x)).changed() {
                *v = json!(x);
                ch = true;
            }
        }
        FieldType::Bool => {
            let mut b = v.as_bool().unwrap_or(false);
            if ui.checkbox(&mut b, "").changed() {
                *v = json!(b);
                ch = true;
            }
        }
        FieldType::Str => {
            let mut s = v.as_str().unwrap_or("").to_string();
            if ui
                .add(egui::TextEdit::singleline(&mut s).desired_width(f32::INFINITY))
                .changed()
            {
                *v = json!(s);
                ch = true;
            }
        }
        FieldType::Color => {
            let c = theme::hex(v.as_str().unwrap_or("#ffffff"));
            let mut rgb = [c.r(), c.g(), c.b()];
            ui.horizontal(|ui| {
                if ui.color_edit_button_srgb(&mut rgb).changed() {
                    *v = json!(format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]));
                    ch = true;
                }
                ui.monospace(v.as_str().unwrap_or(""));
            });
        }
        FieldType::Vec2 => ch = vec_n(ui, v, 2),
        FieldType::Vec3 => ch = vec_n(ui, v, 3),
        FieldType::Enum(opts) => {
            let cur = v.as_str().unwrap_or("").to_string();
            egui::ComboBox::from_id_salt(id)
                .selected_text(&cur)
                .show_ui(ui, |ui| {
                    for o in opts {
                        if ui.selectable_label(cur == *o, o).clicked() {
                            *v = json!(o);
                            ch = true;
                        }
                    }
                });
        }
        FieldType::Entity => {
            let cur = v.as_str().unwrap_or("").to_string();
            let name = cx
                .entities
                .iter()
                .find(|(i, _)| *i == cur)
                .map_or("(none)".to_string(), |(_, n)| n.clone());
            egui::ComboBox::from_id_salt(id)
                .selected_text(name)
                .show_ui(ui, |ui| {
                    if ui.selectable_label(cur.is_empty(), "(none)").clicked() {
                        *v = json!("");
                        ch = true;
                    }
                    for (i, n) in &cx.entities {
                        if ui.selectable_label(cur == *i, n).clicked() {
                            *v = json!(i);
                            ch = true;
                        }
                    }
                });
        }
        FieldType::Asset(kind) => {
            let cur = v.as_str().unwrap_or("").to_string();
            // thumbnail of the current image next to the picker
            if kind == "image" && !cur.is_empty() {
                let root: Option<String> =
                    ui.ctx().data(|d| d.get_temp(egui::Id::new("project_root")));
                if let Some(root) = root {
                    ui.add(
                        egui::Image::new(format!("file://{root}/{cur}"))
                            .fit_to_exact_size(egui::vec2(22.0, 22.0))
                            .corner_radius(2),
                    );
                }
            }
            // Unity: click the field's locate button to ping (select + scroll to) the file in the Assets browser
            let ping_w = if cur.is_empty() { 0.0 } else { 30.0 };
            let resp = egui::ComboBox::from_id_salt(id)
                .width((ui.available_width() - ping_w).max(60.0))
                .selected_text(if cur.is_empty() {
                    "(none)"
                } else {
                    cur.rsplit('/').next().unwrap_or(&cur)
                })
                .show_ui(ui, |ui| {
                    if ui.selectable_label(cur.is_empty(), "(none)").clicked() {
                        *v = json!("");
                        ch = true;
                    }
                    let root: Option<String> =
                        ui.ctx().data(|d| d.get_temp(egui::Id::new("project_root")));
                    for a in cx.assets.iter().filter(|a| asset_matches(kind, a)) {
                        let clicked = ui
                            .horizontal(|ui| {
                                // images show themselves; materials and models show their cached thumbnail when it exists
                                if let Some(root) = &root {
                                    let uri = match a.kind {
                                        AssetType::Image if !a.path.ends_with(".svg") => {
                                            Some(format!("file://{root}/{}", a.path))
                                        }
                                        AssetType::Material | AssetType::Model => {
                                            let p = nord_core::thumbs::thumb_path(
                                                std::path::Path::new(root),
                                                a,
                                            );
                                            p.exists().then(|| format!("file://{}", p.display()))
                                        }
                                        _ => None,
                                    };
                                    if let Some(u) = uri {
                                        ui.add(
                                            egui::Image::new(u)
                                                .fit_to_exact_size(egui::vec2(18.0, 18.0)),
                                        );
                                    }
                                }
                                ui.selectable_label(cur == a.path, &a.path).clicked()
                            })
                            .inner;
                        if clicked {
                            *v = json!(a.path);
                            ch = true;
                        }
                    }
                });
            if let Some(p) = resp.response.dnd_release_payload::<AssetDrag>() {
                *v = json!(p.0);
                ch = true;
            }
            if !cur.is_empty()
                && icons::button(ui, "crosshair", "Show in Assets (ping the file)", false).clicked()
            {
                ui.ctx()
                    .data_mut(|d| d.insert_temp(egui::Id::new("ping_asset"), cur.clone()));
            }
            resp.response.on_hover_text(&cur);
        }
        FieldType::Curve => {
            let mut pts: Vec<[f64; 2]> = v
                .as_array()
                .map(|a| a.iter().map(|p| [num(&p[0]), num(&p[1])]).collect())
                .unwrap_or_default();
            let mut del = None;
            for (i, p) in pts.iter_mut().enumerate() {
                ui.horizontal(|ui| {
                    ui.weak("t");
                    ch |= drag(ui, &mut p[0], Some(0.0), Some(1.0), 0.01);
                    ui.weak("v");
                    ch |= drag(ui, &mut p[1], None, None, 0.01);
                    if icons::button(ui, "x", "Remove point", false).clicked() {
                        del = Some(i);
                    }
                });
            }
            if let Some(i) = del {
                pts.remove(i);
                ch = true;
            }
            if ui.small_button("+ point").clicked() {
                pts.push([1.0, 1.0]);
                ch = true;
            }
            if ch {
                *v = json!(pts);
            }
        }
        FieldType::Array(inner) => {
            let mut items = v.as_array().cloned().unwrap_or_default();
            let mut del = None;
            for (i, it) in items.iter_mut().enumerate() {
                ui.horizontal(|ui| {
                    ui.weak(format!("{i}"));
                    ch |= field_ui(ui, cx, inner, it, &format!("{id}.{i}"));
                    if icons::button(ui, "x", "Remove", false).clicked() {
                        del = Some(i);
                    }
                });
            }
            if let Some(i) = del {
                items.remove(i);
                ch = true;
            }
            if ui.small_button("+ add").clicked() {
                items.push(schema::default_for(inner));
                ch = true;
            }
            if ch {
                *v = Value::Array(items);
            }
        }
    }
    ch
}

/// F1 pressed while the pointer is over `header` (Unity: F1 on a component opens its docs).
pub fn f1_over(header: &egui::Response, ui: &Ui) -> bool {
    header.hovered() && ui.input(|i| i.key_pressed(egui::Key::F1))
}

pub fn component_doc(kind: &str) -> String {
    format!("nord/components/component-{kind}.html")
}

/// Short "type (range)" text shown when hovering a field name, like Unity's attribute tooltips.
fn type_hint(ty: &FieldType) -> String {
    match ty {
        FieldType::Number { min, max } => match (min, max) {
            (Some(a), Some(b)) => format!("number, {a} to {b}"),
            (Some(a), None) => format!("number, min {a}"),
            (None, Some(b)) => format!("number, max {b}"),
            _ => "number".into(),
        },
        FieldType::Int => "integer".into(),
        FieldType::Bool => "bool".into(),
        FieldType::Str => "string".into(),
        FieldType::Color => "color".into(),
        FieldType::Vec2 => "vec2".into(),
        FieldType::Vec3 => "vec3".into(),
        FieldType::Enum(o) => format!("enum: {}", o.join(" | ")),
        FieldType::Entity => "entity reference".into(),
        FieldType::Asset(k) => format!("asset ({k})"),
        FieldType::Curve => "curve".into(),
        FieldType::Array(i) => format!("array of {}", type_hint(i)),
    }
}

/// `base`: the same component/script in the prefab; fields that differ get a blue marker and a revert button.
fn fields_ui(
    ui: &mut Ui,
    cx: &Ctx,
    fields: &[Field],
    data: &mut Map<String, Value>,
    id: &str,
    base: Option<&Map<String, Value>>,
) -> bool {
    let mut ch = false;
    egui::Grid::new(format!("g-{id}"))
        .num_columns(2)
        .spacing([8.0, 4.0])
        .show(ui, |ui| {
            for f in fields {
                let overridden = base.filter(|b| {
                    b.get(&f.name).unwrap_or(&f.default) != data.get(&f.name).unwrap_or(&f.default)
                });
                let lr = ui.label(if overridden.is_some() {
                    egui::RichText::new(format!("● {}", f.label))
                        .strong()
                        .color(egui::Color32::from_rgb(110, 170, 255))
                } else {
                    egui::RichText::new(&f.label)
                });
                if !f.hint.is_empty() {
                    lr.on_hover_text(&f.hint);
                } else {
                    lr.on_hover_text(type_hint(&f.ty));
                }
                let mut cur = data
                    .get(&f.name)
                    .cloned()
                    .unwrap_or_else(|| f.default.clone());
                // keep the stored value usable for the widget's type (e.g. null from a hand-edited file)
                if cur.is_null() {
                    cur = f.default.clone();
                }
                let mut revert = false;
                ui.horizontal(|ui| {
                    if field_ui(ui, cx, &f.ty, &mut cur, &format!("{id}.{}", f.name)) {
                        data.insert(f.name.clone(), cur.clone());
                        ch = true;
                    }
                    if overridden.is_some() {
                        if icons::button(ui, "x", "Revert to prefab value", false).clicked() {
                            revert = true;
                        }
                        if icons::mini(ui, "upload", "Apply this value to the prefab").clicked() {
                            ui.ctx().data_mut(|d| {
                                d.insert_temp(
                                    egui::Id::new("apply_field"),
                                    (id.to_string(), f.name.clone()),
                                )
                            });
                        }
                    }
                });
                if let (true, Some(b)) = (revert, base) {
                    match b.get(&f.name) {
                        Some(v) => data.insert(f.name.clone(), v.clone()),
                        None => data.remove(&f.name),
                    };
                    ch = true;
                }
                ui.end_row();
            }
            // fields present in the file but not in the schema: still editable (guessed type)
            let extra: Vec<String> = data
                .keys()
                .filter(|k| *k != "componentEnabled" && !fields.iter().any(|f| &f.name == *k))
                .cloned()
                .collect();
            for k in extra {
                ui.label(schema::label_of(&k));
                let cur = data.get_mut(&k).unwrap();
                let ty = schema::guess(cur);
                ch |= field_ui(ui, cx, &ty, cur, &format!("{id}.{k}"));
                ui.end_row();
            }
        });
    ch
}

/// Inspector for a selected `*.mat.json` asset: the Material component's fields, saved straight back to the file.
fn material_asset_ui(st: &mut EditorState, ui: &mut Ui, rel: &str) {
    let Some(root) = st.root.clone() else { return };
    let path = root.join(rel);
    let mut data: Map<String, Value> = nord_core::vfs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    ui.label(egui::RichText::new(format!("MATERIAL  {rel}")).strong());
    ui.separator();
    let fields: Vec<Field> = schema::component_fields("material")
        .into_iter()
        .filter(|f| f.name != "asset")
        .collect();
    let assets = st.assets.clone();
    let cx = Ctx {
        assets: &assets,
        entities: vec![],
    };
    let mut ch = false;
    egui::ScrollArea::vertical().show(ui, |ui| {
        ch = fields_ui(ui, &cx, &fields, &mut data, "matasset", None);
        ui.separator();
        draw_material_preview(ui, &data);
    });
    if ch {
        if let Ok(t) = serde_json::to_string_pretty(&data) {
            let _ = nord_core::vfs::write(&path, t + "\n");
            st.rev += 1; // games and viewports reload shared materials with the scene
        }
    }
}

/// Lit sphere of the material (CPU shading in `nord_core::thumbs::render_material`), cached per material JSON.
fn draw_material_preview(ui: &mut Ui, data: &Map<String, Value>) {
    use std::hash::{Hash, Hasher};
    let root: Option<String> = ui.ctx().data(|d| d.get_temp(egui::Id::new("project_root")));
    let key = serde_json::to_string(data).unwrap_or_default();
    let mut h = std::collections::hash_map::DefaultHasher::new();
    key.hash(&mut h);
    nord_core::thumbs::PLAIN_MATERIALS
        .load(std::sync::atomic::Ordering::Relaxed)
        .hash(&mut h);
    let (hash, tid) = (h.finish(), egui::Id::new("mat-preview-last"));
    // only the latest preview is kept (dragging a colour would otherwise leave hundreds of textures behind)
    let last: Option<(u64, egui::TextureHandle)> = ui.ctx().data(|d| d.get_temp(tid));
    let tex = last
        .filter(|(k, _)| *k == hash)
        .map(|(_, t)| t)
        .unwrap_or_else(|| {
            let img = nord_core::thumbs::render_material(
                std::path::Path::new(root.as_deref().unwrap_or(".")),
                data,
                128,
            );
            let ci = egui::ColorImage::from_rgba_unmultiplied([128, 128], img.as_raw());
            let t = ui
                .ctx()
                .load_texture("mat-preview", ci, egui::TextureOptions::LINEAR);
            ui.ctx().data_mut(|d| d.insert_temp(tid, (hash, t.clone())));
            t
        });
    ui.add(egui::Image::new(&tex).fit_to_exact_size(egui::vec2(120.0, 120.0)));
}

/// Material names declared in a .gltf / .glb (the JSON chunk), for the Model import material remap.
fn model_material_names(root: Option<&std::path::Path>, rel: &str) -> Vec<String> {
    let Some(root) = root else { return vec![] };
    let Ok(bytes) = nord_core::vfs::read(root.join(rel)) else {
        return vec![];
    };
    let json: Option<Value> = if rel.to_ascii_lowercase().ends_with(".glb") {
        // header 12 bytes, then chunk length (4) + type 'JSON' (4) + data
        (bytes.len() > 20 && &bytes[16..20] == b"JSON")
            .then(|| u32::from_le_bytes([bytes[12], bytes[13], bytes[14], bytes[15]]) as usize)
            .and_then(|n| bytes.get(20..20 + n))
            .and_then(|j| serde_json::from_slice(j).ok())
    } else {
        serde_json::from_slice(&bytes).ok()
    };
    json.and_then(|j| {
        j["materials"].as_array().map(|a| {
            a.iter()
                .filter_map(|m| m["name"].as_str().map(String::from))
                .collect()
        })
    })
    .unwrap_or_default()
}

/// Import settings for a selected image: `filter` and `wrap` in the sidecar `<file>.meta.json` (read by the Phaser and Babylon backends).
fn texture_import_ui(st: &mut EditorState, ui: &mut Ui, rel: &str) {
    let Some(root) = st.root.clone() else { return };
    let path = root.join(format!("{rel}.meta.json"));
    let mut meta: Map<String, Value> = nord_core::vfs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    let is_model = nord_core::assets::classify(rel) == AssetType::Model;
    ui.label(
        egui::RichText::new(format!(
            "{} IMPORT  {rel}",
            if is_model { "MODEL" } else { "TEXTURE" }
        ))
        .strong(),
    );
    ui.separator();
    let mut ch = false;
    if !is_model {
        egui::Grid::new("tex-import").num_columns(2).show(ui, |ui| {
            for (key, label, opts, def) in [
                ("filter", "Filter", ["linear", "nearest"], "linear"),
                ("wrap", "Wrap", ["repeat", "clamp"], "repeat"),
            ] {
                ui.label(label);
                let mut cur = meta
                    .get(key)
                    .and_then(Value::as_str)
                    .unwrap_or(def)
                    .to_string();
                egui::ComboBox::from_id_salt(key)
                    .selected_text(cur.clone())
                    .show_ui(ui, |ui| {
                        for o in opts {
                            ch |= ui.selectable_value(&mut cur, o.to_string(), o).changed();
                        }
                    });
                if ch {
                    meta.insert(key.into(), json!(cur));
                }
                ui.end_row();
            }
        });
    }
    if is_model {
        let mut s = meta.get("scale").and_then(Value::as_f64).unwrap_or(1.0);
        ui.horizontal(|ui| {
            ui.label("Scale");
            if ui
                .add(DragValue::new(&mut s).speed(0.01).range(0.001..=1000.0))
                .changed()
            {
                meta.insert("scale".into(), json!(s));
                ch = true;
            }
        });
        // Material remap: replace the materials stored inside the model with project material assets (*.mat.json)
        let names = model_material_names(st.root.as_deref(), rel);
        if !names.is_empty() {
            ui.separator();
            ui.label(egui::RichText::new("MATERIALS").strong());
            let mats: Vec<String> = st
                .assets
                .iter()
                .filter(|a| a.kind == AssetType::Material)
                .map(|a| a.path.clone())
                .collect();
            let mut map: Map<String, Value> = meta
                .get("materials")
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default();
            let before = map.clone();
            egui::Grid::new("model-mats").num_columns(2).show(ui, |ui| {
                for n in &names {
                    ui.label(n);
                    let cur = map.get(n).and_then(Value::as_str).unwrap_or("").to_string();
                    egui::ComboBox::from_id_salt(("modmat", n))
                        .selected_text(if cur.is_empty() {
                            "(from model)"
                        } else {
                            cur.rsplit('/').next().unwrap_or(&cur)
                        })
                        .show_ui(ui, |ui| {
                            if ui
                                .selectable_label(cur.is_empty(), "(from model)")
                                .clicked()
                            {
                                map.remove(n);
                            }
                            for m in &mats {
                                if ui.selectable_label(&cur == m, m).clicked() {
                                    map.insert(n.clone(), json!(m));
                                }
                            }
                        });
                    ui.end_row();
                }
            });
            if map != before {
                if map.is_empty() {
                    meta.remove("materials");
                } else {
                    meta.insert("materials".into(), Value::Object(map));
                }
                ch = true;
            }
        }
    } else {
        egui::Grid::new("tex-import2")
            .num_columns(2)
            .show(ui, |ui| {
                ui.label("Pixels per unit").on_hover_text(
                    "Sprites using this image are drawn at size ÷ this value (1 = native pixels)",
                );
                let mut ppu = meta.get("ppu").and_then(Value::as_f64).unwrap_or(1.0);
                if ui
                    .add(DragValue::new(&mut ppu).speed(0.1).range(0.01..=10000.0))
                    .changed()
                {
                    meta.insert("ppu".into(), json!(ppu));
                    ch = true;
                }
                ui.end_row();
                ui.label("Pivot");
                const PIVOTS: [(&str, &str, [f64; 2]); 9] = [
                    ("center", "Center", [0.5, 0.5]),
                    ("topLeft", "Top left", [0.0, 0.0]),
                    ("top", "Top", [0.5, 0.0]),
                    ("topRight", "Top right", [1.0, 0.0]),
                    ("left", "Left", [0.0, 0.5]),
                    ("right", "Right", [1.0, 0.5]),
                    ("bottomLeft", "Bottom left", [0.0, 1.0]),
                    ("bottom", "Bottom", [0.5, 1.0]),
                    ("bottomRight", "Bottom right", [1.0, 1.0]),
                ];
                let custom = meta.contains_key("origin") && !meta.contains_key("pivot");
                let cur = meta
                    .get("pivot")
                    .and_then(Value::as_str)
                    .unwrap_or("center")
                    .to_string();
                let shown = if custom {
                    "Custom (Sprite editor)"
                } else {
                    PIVOTS
                        .iter()
                        .find(|p| p.0 == cur.as_str())
                        .map_or("Center", |p| p.1)
                };
                egui::ComboBox::from_id_salt("pivot")
                    .selected_text(shown)
                    .show_ui(ui, |ui| {
                        for (k, label, _) in PIVOTS {
                            if ui.selectable_label(!custom && cur == k, label).clicked() {
                                meta.insert("pivot".into(), json!(k));
                                meta.remove("origin"); // a preset replaces the sprite editor's pixel pivot
                                ch = true;
                            }
                        }
                    });
                ui.end_row();
                ui.label("Max size").on_hover_text(
                    "Larger images are scaled down at load; sprites keep their world size",
                );
                let ms = meta.get("maxSize").and_then(Value::as_u64).unwrap_or(0);
                egui::ComboBox::from_id_salt("maxsize")
                    .selected_text(if ms == 0 {
                        "None".to_string()
                    } else {
                        ms.to_string()
                    })
                    .show_ui(ui, |ui| {
                        for v in [0u64, 32, 64, 128, 256, 512, 1024, 2048, 4096] {
                            let label = if v == 0 {
                                "None".to_string()
                            } else {
                                v.to_string()
                            };
                            if ui.selectable_label(ms == v, label).clicked() {
                                if v == 0 {
                                    meta.remove("maxSize");
                                } else {
                                    meta.insert("maxSize".into(), json!(v));
                                }
                                ch = true;
                            }
                        }
                    });
                ui.end_row();
            });
        if is_model && ui.button("Open in 3D Modeler").clicked() {
            st.open_in_modeler("", rel);
        }
        if !is_model && ui.button("Open in Sprite editor").clicked() {
            if let Some(root) = st.root.clone() {
                match image::open(root.join(rel)) {
                    Ok(i) => {
                        let m = nord_core::io::load_json(&root.join(format!("{rel}.meta.json")))
                            .unwrap_or(Value::Null);
                        st.sprite.load_image(rel, i.to_rgba8(), m);
                        st.push(crate::state::Action::ShowTab(crate::app::Tab::Sprite));
                    }
                    Err(e) => st.toast(format!("{rel}: {e}")),
                }
            }
        }
    }
    if ch {
        if let Ok(t) = serde_json::to_string_pretty(&meta) {
            let _ = nord_core::vfs::write(&path, t + "\n");
            st.refresh_assets();
            st.toast("Import settings saved — reload the game to apply");
        }
    }
}

/// Several entities selected: shared Active / Layer / Transform. Mixed values show "—"; editing a field sets it on all of them.
fn multi_ui(st: &mut EditorState, ui: &mut Ui) {
    let ids = st.selection.clone();
    let ents: Vec<Entity> = st
        .scene
        .as_ref()
        .map(|s| {
            ids.iter()
                .filter_map(|id| scene_ops::find(&s.entities, id).cloned())
                .collect()
        })
        .unwrap_or_default();
    if ents.len() < 2 {
        return;
    }
    ui.label(egui::RichText::new(format!("{} ENTITIES SELECTED", ents.len())).strong());
    ui.separator();
    let mut edits: Vec<(&'static str, usize, f64)> = vec![];
    let mut active = None;
    let all_on = ents.iter().all(|e| e.enabled);
    let any_on = ents.iter().any(|e| e.enabled);
    let mut on = all_on;
    let label = if all_on || !any_on {
        "Active"
    } else {
        "Active (mixed)"
    };
    if ui.checkbox(&mut on, label).changed() {
        active = Some(on);
    }
    egui::Grid::new("multi-xf").num_columns(2).show(ui, |ui| {
        for (label, key) in [("Position", "pos"), ("Rotation", "rot"), ("Scale", "scale")] {
            ui.label(label);
            ui.horizontal(|ui| {
                for axis in 0..3 {
                    let vals: Vec<f64> = ents
                        .iter()
                        .map(|e| match key {
                            "pos" => e.transform.pos[axis],
                            "rot" => e.transform.rot[axis],
                            _ => e.transform.scale[axis],
                        })
                        .collect();
                    let mixed = vals.iter().any(|v| (*v - vals[0]).abs() > 1e-9);
                    let mut v = vals[0];
                    ui.weak(["x", "y", "z"][axis]);
                    let mut dv =
                        DragValue::new(&mut v).speed(if key == "scale" { 0.01 } else { 0.5 });
                    if mixed {
                        dv = dv.custom_formatter(|_, _| "—".to_string());
                    }
                    if ui.add(dv).changed() {
                        edits.push((key, axis, v));
                    }
                }
            });
            ui.end_row();
        }
    });
    if active.is_some() || !edits.is_empty() {
        st.edit("Edit selection", Some("multi-edit"), |l| {
            for id in &ids {
                if let Some(e) = scene_ops::find_mut(l, id) {
                    if let Some(a) = active {
                        e.enabled = a;
                    }
                    for (key, axis, v) in &edits {
                        match *key {
                            "pos" => e.transform.pos[*axis] = *v,
                            "rot" => e.transform.rot[*axis] = *v,
                            _ => e.transform.scale[*axis] = *v,
                        }
                    }
                }
            }
        });
    }
    ui.separator();
    ui.menu_button("+ Add component to all", |ui| {
        for k in schema::COMPONENT_TYPES {
            if ui.button(schema::label_of(k)).clicked() {
                for id in &ids {
                    st.selection = vec![id.clone()];
                    st.add_component_to_selection(k);
                }
                st.selection = ids.clone();
                ui.close_menu();
            }
        }
    });
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    if let Some(r) = &st.root {
        let r = r.to_string_lossy().into_owned();
        ui.ctx()
            .data_mut(|d| d.insert_temp(egui::Id::new("project_root"), r));
    }
    if st.selection.len() > 1 && st.inspector_lock.is_none() {
        multi_ui(st, ui);
        return;
    }
    if st.selection.is_empty() {
        if let Some(rel) = st.assets_ui.selected.clone().filter(|r| {
            matches!(
                nord_core::assets::classify(r),
                AssetType::Image | AssetType::Spritesheet | AssetType::Model
            )
        }) {
            texture_import_ui(st, ui, &rel);
            return;
        }
        if let Some(rel) = st
            .assets_ui
            .selected
            .clone()
            .filter(|r| r.ends_with(".mat.json"))
        {
            material_asset_ui(st, ui, &rel);
            return;
        }
    }
    // Inspector lock (Unity's padlock): keep showing one entity while the selection changes elsewhere
    let locked = st.inspector_lock.clone().and_then(|id| {
        st.scene
            .as_ref()
            .and_then(|s| scene_ops::find(&s.entities, &id))
            .cloned()
    });
    if st.inspector_lock.is_some() && locked.is_none() {
        st.inspector_lock = None; // the locked entity is gone
    }
    if let Some(e) = st.selected().or(locked.as_ref()) {
        let (id, name, is_locked) = (e.id.clone(), e.name.clone(), st.inspector_lock.is_some());
        ui.horizontal(|ui| {
            if icons::button(
                ui,
                if is_locked { "lock" } else { "unlock" },
                "Lock the Inspector to this entity",
                is_locked,
            )
            .clicked()
            {
                st.inspector_lock = if is_locked { None } else { Some(id) };
            }
            if is_locked {
                ui.weak(format!("locked: {name}"));
            }
        });
    }
    if let Some(id) = st
        .selection
        .first()
        .filter(|id| crate::virt::is_virtual(id) && !id.starts_with("v:pfc:"))
        .cloned()
    {
        if let (Some(p), Some(sc)) = (&st.project, &st.scene) {
            let rows = crate::virt::all(st.root.as_deref(), p, sc);
            if let Some(n) = crate::virt::find(&rows, &id) {
                ui.heading(&n.name);
                ui.weak("Part of the game, not a scene entity (read-only).");
                ui.separator();
                for l in &n.info {
                    ui.label(l);
                }
                return;
            }
        }
    }
    // an entity inside a prefab instance: edited as "child of the prefab" with its overrides stored on the instance
    let mut child_ctx: Option<(String, Vec<usize>)> = None;
    let mut child_base: Option<Entity> = None;
    let mut child_inst: Option<Entity> = None;
    if let Some((iid, path)) = st
        .selection
        .first()
        .and_then(|id| crate::prefab::parse_child_id(id))
    {
        let root_inst = st
            .scene
            .as_ref()
            .and_then(|s| scene_ops::find(&s.entities, &iid))
            .cloned();
        if let Some(root_inst) = root_inst {
            if let Some(pr) = root_inst.prefab.clone() {
                if let Some(base) = st
                    .read_prefab_cached(&pr.path)
                    .and_then(|r| crate::prefab::base_child(&r, &path).cloned())
                {
                    let mut ci = base.clone();
                    ci.prefab = Some(nord_core::scene::PrefabRef {
                        path: pr.path.clone(),
                        overrides: crate::prefab::child_overrides(&pr.overrides, &path),
                    });
                    child_inst = Some(ci);
                    child_base = Some(base);
                    child_ctx = Some((iid, path));
                }
            }
        }
    }
    let Some(inst) = child_inst.or(locked).or_else(|| st.selected().cloned()) else {
        ui.weak(if st.scene.is_some() {
            "Select an entity"
        } else {
            "No scene open"
        });
        return;
    };
    // prefab instance: edit the prefab merged with its overrides, store the difference (docs: Prefab overrides)
    let base_ent: Option<Entity> = child_base.or_else(|| {
        inst.prefab.as_ref().and_then(|p| {
            let txt = nord_core::vfs::read_to_string(st.root.as_ref()?.join(&p.path)).ok()?;
            serde_json::from_str::<nord_core::scene::Prefab>(&txt)
                .ok()
                .map(|pf| pf.root)
        })
    });
    let orig = match &base_ent {
        Some(b) => crate::prefab::effective(&inst, b),
        None => inst.clone(),
    };
    let base_comp = |i: usize, kind: &str| {
        base_ent
            .as_ref()
            .and_then(|b| b.components.get(i))
            .filter(|c| c.kind == kind)
            .map(|c| &c.fields)
    };
    let base_script = |i: usize, path: &str| {
        base_ent
            .as_ref()
            .and_then(|b| b.scripts.get(i))
            .filter(|s| s.path == path)
            .map(|s| &s.attributes)
    };
    let is3d = st.is_3d();
    let entities: Vec<(String, String)> = st
        .scene
        .as_ref()
        .map(|s| {
            scene_ops::flatten(&s.entities)
                .into_iter()
                .map(|(_, e)| (e.id.clone(), e.name.clone()))
                .collect()
        })
        .unwrap_or_default();
    // script schemas first (needs &mut st)
    let script_fields: Vec<Vec<Field>> = orig
        .scripts
        .iter()
        .map(|s| st.script_fields(&s.path))
        .collect();
    let script_files: Vec<String> = st
        .root
        .as_ref()
        .map(|r| {
            let mut v = vec![];
            collect_scripts(r, r, &mut v);
            v.sort();
            v
        })
        .unwrap_or_default();
    let assets = st.assets.clone();
    let cx = Ctx {
        assets: &assets,
        entities,
    };

    // Signals: method names found in the target entity's scripts (picker next to the method box)
    let sig_methods: Vec<Vec<String>> = orig
        .connections
        .iter()
        .map(|c| {
            let id = if c.target.is_empty() {
                orig.id.clone()
            } else {
                c.target.clone()
            };
            script_methods(st, &id)
        })
        .collect();
    let all_tags: Vec<String> = st
        .scene
        .as_ref()
        .map(|sc| {
            let mut v: Vec<String> = scene_ops::flatten(&sc.entities)
                .into_iter()
                .flat_map(|(_, e)| e.tags.clone())
                .collect();
            v.sort();
            v.dedup();
            v
        })
        .unwrap_or_default();
    let mut e: Entity = orig.clone();
    let mut docs: Option<String> = None;
    let mut open_modeler: Option<String> = None;
    let mut open_mesh: Option<nord_core::scene::Component> = None;
    let mut prefab_op: Option<(String, u8)> = None;
    egui::ScrollArea::vertical()
        .auto_shrink([false; 2])
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.checkbox(&mut e.enabled, "")
                    .on_hover_text("Active: off = the entity (and its children) is not in the game and is hidden in the Scene view");
                ui.add(egui::TextEdit::singleline(&mut e.name).desired_width(ui.available_width() - 70.0));
                ui.add_enabled_ui(child_ctx.is_none(), |ui| {
                    ui.checkbox(&mut e.is_static, "Static")
                        .on_hover_text("Static: the entity does not move at runtime (scripts can read entity.isStatic)");
                });
            });
            ui.horizontal(|ui| {
                ui.weak(format!("id {}", e.id));
            });
            ui.horizontal(|ui| {
                ui.label("Tag");
                let shown = if e.tags.is_empty() { "Untagged".to_string() } else { e.tags.join(", ") };
                egui::ComboBox::from_id_salt("tag_picker").selected_text(shown).width(150.0).show_ui(ui, |ui| {
                    // every tag used in this scene is a checkbox (an entity can carry several); the box at the bottom adds a new one
                    let mut all: Vec<String> = all_tags.clone();
                    for t in &e.tags {
                        if !all.contains(t) {
                            all.push(t.clone());
                        }
                    }
                    all.sort();
                    for t in all {
                        let mut on = e.tags.contains(&t);
                        if ui.checkbox(&mut on, &t).changed() {
                            if on {
                                e.tags.push(t.clone());
                            } else {
                                e.tags.retain(|x| *x != t);
                            }
                        }
                    }
                    ui.separator();
                    let nid = egui::Id::new("new_tag");
                    let mut nt: String = ui.ctx().data(|d| d.get_temp(nid)).unwrap_or_default();
                    let r = ui.add(egui::TextEdit::singleline(&mut nt).hint_text("New tag + Enter").desired_width(130.0));
                    if r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                        let t = nt.trim().to_string();
                        if !t.is_empty() && !e.tags.contains(&t) {
                            e.tags.push(t);
                        }
                        nt.clear();
                    }
                    ui.ctx().data_mut(|d| d.insert_temp(nid, nt));
                });
                ui.label("Layer");
                ui.add(DragValue::new(&mut e.layer));
            });
            ui.separator();
            let xf_state = egui::collapsing_header::CollapsingState::load_with_default_open(
                ui.ctx(),
                ui.make_persistent_id("xf_hdr"),
                true,
            );
            let xf_clip = egui::Id::new("transform_clipboard");
            let xf_header = xf_state.show_header(ui, |ui| {
                ui.label(egui::RichText::new("TRANSFORM").strong());
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    ui.menu_image_button(crate::icons::icon("more-vertical", 14.0, ui.visuals().text_color()), |ui| {
                        if ui.button("Reset").clicked() {
                            e.transform = nord_core::scene::Transform::default();
                            ui.close_menu();
                        }
                        if ui.button("Reset Position").clicked() {
                            e.transform.pos = [0.0; 3];
                            ui.close_menu();
                        }
                        if ui.button("Reset Rotation").clicked() {
                            e.transform.rot = [0.0; 3];
                            ui.close_menu();
                        }
                        if ui.button("Reset Scale").clicked() {
                            e.transform.scale = [1.0; 3];
                            ui.close_menu();
                        }
                        ui.separator();
                        if ui.button("Copy values").clicked() {
                            let t = e.transform.clone();
                            ui.ctx().data_mut(|d| d.insert_temp(xf_clip, t));
                            ui.close_menu();
                        }
                        let clip: Option<nord_core::scene::Transform> =
                            ui.ctx().data(|d| d.get_temp(xf_clip));
                        if ui.add_enabled(clip.is_some(), egui::Button::new("Paste values")).clicked() {
                            if let Some(t) = clip {
                                e.transform = t;
                            }
                            ui.close_menu();
                        }
                    });
                });
            });
            xf_header.body(|ui| {
                    egui::Grid::new("xf").num_columns(2).show(ui, |ui| {
                        for (label, arr, n3) in [
                            ("Position", &mut e.transform.pos, true),
                            ("Rotation", &mut e.transform.rot, is3d),
                            ("Scale", &mut e.transform.scale, true),
                        ] {
                            ui.label(label);
                            ui.horizontal(|ui| {
                                let axes: &[usize] = if is3d || (n3 && label == "Position") {
                                    &[0, 1, 2]
                                } else if label == "Rotation" {
                                    &[2]
                                } else {
                                    &[0, 1]
                                };
                                for &i in axes {
                                    ui.weak(["x", "y", "z"][i]);
                                    let unit = match label {
                                        "Rotation" => "°",
                                        "Scale" => "×",
                                        _ => " u",
                                    };
                                    ui.add(
                                        DragValue::new(&mut arr[i])
                                            .suffix(unit)
                                            .speed(if label == "Scale" { 0.01 } else { 0.5 }),
                                    );
                                }
                            });
                            ui.end_row();
                        }
                    });
                });
            // components
            let mut remove_comp = None;
            let mut move_comp: Option<(usize, i32)> = None;
            for (i, c) in e.components.iter_mut().enumerate() {
                let id = format!("c{i}");
                let fields = schema::component_fields(&c.kind);
                let sid = ui.make_persistent_id(&id);
                let mut on = c.fields.get("componentEnabled") != Some(&Value::Bool(false));
                let was_on = on;
                let state = egui::collapsing_header::CollapsingState::load_with_default_open(
                    ui.ctx(),
                    sid,
                    true,
                );
                let header = state.show_header(ui, |ui| {
                    // Unity: enable checkbox + name in the header, ⋮ menu at the right; off = greyed out, not created in the game
                    ui.checkbox(&mut on, "")
                        .on_hover_text("Enabled: off = the component is not created in the game and is not drawn in the Scene view");
                    ui.add(crate::icons::icon(
                        crate::icons::component_icon(&c.kind),
                        13.0,
                        crate::icons::kind_color(crate::icons::component_icon(&c.kind), ui.visuals().text_color()),
                    ));
                    let t = egui::RichText::new(schema::label_of(&c.kind).to_uppercase()).strong();
                    ui.label(if on { t } else { t.weak() });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.menu_image_button(crate::icons::icon("more-vertical", 14.0, ui.visuals().text_color()), |ui| {
                                let clip_id = egui::Id::new("component_clipboard");
                                if ui.button("Reset").clicked() {
                                    c.fields.clear();
                                    schema::merge_defaults(&fields, &mut c.fields);
                                    ui.close_menu();
                                }
                                if ui.button("Copy values").clicked() {
                                    let v = (c.kind.clone(), c.fields.clone());
                                    ui.ctx().data_mut(|d| d.insert_temp(clip_id, v));
                                    ui.close_menu();
                                }
                                let clip: Option<(
                                    String,
                                    serde_json::Map<String, serde_json::Value>,
                                )> = ui.ctx().data(|d| d.get_temp(clip_id));
                                let can_paste = clip.as_ref().is_some_and(|(k, _)| *k == c.kind);
                                if ui
                                    .add_enabled(can_paste, egui::Button::new("Paste values"))
                                    .clicked()
                                {
                                    if let Some((_, f)) = clip {
                                        c.fields = f;
                                    }
                                    ui.close_menu();
                                }
                                ui.separator();
                                if ui.button("Move up").clicked() {
                                    move_comp = Some((i, -1));
                                    ui.close_menu();
                                }
                                if ui.button("Move down").clicked() {
                                    move_comp = Some((i, 1));
                                    ui.close_menu();
                                }
                                ui.separator();
                                if c.kind == "model" {
                                    let p = c.fields.get("path").and_then(Value::as_str).unwrap_or_default();
                                    if ui
                                        .add_enabled(!p.is_empty(), egui::Button::new("Open in 3D Modeler"))
                                        .on_hover_text("Edit this model with its textures; saving asks whether to overwrite it, or keep the change as a new model / prefab / variant")
                                        .clicked()
                                    {
                                        open_modeler = Some(p.to_string());
                                        ui.close_menu();
                                    }
                                }
                                if ui.button("Docs (F1)").clicked() {
                                    docs = Some(component_doc(&c.kind));
                                    ui.close_menu();
                                }
                                if ui.button("Remove component").clicked() {
                                    remove_comp = Some(i);
                                    ui.close_menu();
                                }
                            });
                    });
                });
                if on != was_on {
                    if on {
                        c.fields.remove("componentEnabled");
                    } else {
                        c.fields.insert("componentEnabled".into(), Value::Bool(false));
                    }
                }
                let (hdr, _, _) = header.body(|ui| {
                    ui.add_enabled_ui(on, |ui| {
                        fields_ui(ui, &cx, &fields, &mut c.fields, &id, base_comp(i, &c.kind));
                        if c.kind == "mesh" && ui.button("Edit as model in 3D Modeler").on_hover_text("Turns this primitive into editable geometry. Save in the Modeler to use the result on this object (the mesh becomes a model); closing without saving changes nothing.").clicked() {
                            open_mesh = Some(c.clone());
                        }
                        if c.kind == "model" {
                            let p = c.fields.get("path").and_then(Value::as_str).unwrap_or_default();
                            if ui
                                .add_enabled_ui(!p.is_empty(), |ui| crate::icons::label_icon(ui, "pencil", "Open in 3D Modeler"))
                                .inner
                                .on_hover_text("Edit this model with its textures; Save asks: overwrite, new model, new prefab or variant")
                                .clicked()
                            {
                                open_modeler = Some(p.to_string());
                            }
                        }
                    });
                });
                if f1_over(&hdr, ui) {
                    docs = Some(component_doc(&c.kind));
                }
            }
            if let Some(i) = remove_comp {
                e.components.remove(i);
            }
            if let Some((i, d)) = move_comp {
                let j = i as i32 + d;
                if j >= 0 && (j as usize) < e.components.len() {
                    e.components.swap(i, j as usize);
                }
            }
            ui.menu_button("+ Add component", |ui| {
                let sid = egui::Id::new("add_component_search");
                let mut q: String = ui.ctx().data(|d| d.get_temp(sid)).unwrap_or_default();
                let r = ui.add(egui::TextEdit::singleline(&mut q).hint_text("Search components…"));
                r.request_focus();
                ui.ctx().data_mut(|d| d.insert_temp(sid, q.clone()));
                let ql = q.to_lowercase();
                egui::ScrollArea::vertical()
                    .max_height(300.0)
                    .show(ui, |ui| {
                        for cat in schema::COMPONENT_CATEGORIES {
                            let kinds: Vec<&str> = schema::COMPONENT_TYPES
                                .iter()
                                .copied()
                                .filter(|k| schema::category_of(k) == *cat)
                                .filter(|k| {
                                    ql.is_empty()
                                        || schema::label_of(k).to_lowercase().contains(&ql)
                                        || k.to_lowercase().contains(&ql)
                                })
                                .collect();
                            if kinds.is_empty() {
                                continue;
                            }
                            ui.weak(cat.to_uppercase());
                            for k in kinds {
                                if ui.button(schema::label_of(k)).clicked() {
                                    let mut fields = Map::new();
                                    schema::merge_defaults(&schema::component_fields(k), &mut fields);
                                    e.components.push(Component {
                                        kind: k.to_string(),
                                        fields,
                                    });
                                    ui.close_menu();
                                }
                            }
                        }
                    });
            });
            ui.separator();
            // scripts
            let mut remove_script = None;
            for (i, s) in e.scripts.iter_mut().enumerate() {
                let id = format!("s{i}");
                let name = s.path.rsplit('/').next().unwrap_or(&s.path).to_string();
                let r = egui::CollapsingHeader::new(format!("{name}  (script)"))
                    .id_salt(&id)
                    .icon(crate::icons::accent_arrow)
                    .default_open(true)
                    .show(ui, |ui| {
                        ui.weak(&s.path);
                        let fields = script_fields.get(i).cloned().unwrap_or_default();
                        if fields.is_empty() {
                            ui.weak("No `static attributes` declared");
                        }
                        fields_ui(
                            ui,
                            &cx,
                            &fields,
                            &mut s.attributes,
                            &id,
                            base_script(i, &s.path),
                        );
                        ui.horizontal(|ui| {
                            if ui.small_button("Remove script").clicked() {
                                remove_script = Some(i);
                            }
                        });
                    });
                if f1_over(&r.header_response, ui) {
                    docs = Some("nord/manual/scripting.html".into());
                }
            }
            if let Some(i) = remove_script {
                e.scripts.remove(i);
            }
            ui.menu_button("+ Add script", |ui| {
                for f in &script_files {
                    if ui.button(f).clicked() {
                        e.scripts.push(ScriptRef {
                            path: f.clone(),
                            attributes: Map::new(),
                        });
                        ui.close_menu();
                    }
                }
                if script_files.is_empty() {
                    ui.weak("No scripts in scripts/");
                }
            });
            ui.separator();
            egui::CollapsingHeader::new(format!("Signals ({})", e.connections.len()))
                .id_salt("signals")
                .default_open(!e.connections.is_empty())
                .show(ui, |ui| {
                    ui.weak(
                        "When this entity emits an event, call a method on a script of the target.",
                    );
                    let mut del = None;
                    for (i, c) in e.connections.iter_mut().enumerate() {
                        ui.horizontal(|ui| {
                            ui.add(
                                egui::TextEdit::singleline(&mut c.event)
                                    .hint_text("event")
                                    .desired_width(80.0),
                            );
                            ui.label("→");
                            let name = cx
                                .entities
                                .iter()
                                .find(|(id, _)| *id == c.target)
                                .map_or("(self)".to_string(), |(_, n)| n.clone());
                            egui::ComboBox::from_id_salt(format!("sigt{i}"))
                                .selected_text(name)
                                .width(90.0)
                                .show_ui(ui, |ui| {
                                    if ui.selectable_label(c.target.is_empty(), "(self)").clicked()
                                    {
                                        c.target.clear();
                                    }
                                    for (id, n) in &cx.entities {
                                        if ui.selectable_label(c.target == *id, n).clicked() {
                                            c.target = id.clone();
                                        }
                                    }
                                });
                            ui.add(
                                egui::TextEdit::singleline(&mut c.method)
                                    .hint_text("method")
                                    .desired_width(80.0),
                            );
                            if let Some(ms) = sig_methods.get(i).filter(|m| !m.is_empty()) {
                                ui.menu_button("▾", |ui| {
                                    for m in ms {
                                        if ui.button(m).clicked() {
                                            c.method = m.clone();
                                            ui.close_menu();
                                        }
                                    }
                                });
                            }
                            if icons::button(ui, "x", "Remove connection", false).clicked() {
                                del = Some(i);
                            }
                        });
                    }
                    if let Some(i) = del {
                        e.connections.remove(i);
                    }
                    if ui.small_button("+ Connect").clicked() {
                        e.connections.push(nord_core::scene::Connection {
                            event: String::new(),
                            target: String::new(),
                            method: String::new(),
                        });
                    }
                });
            let dbg_id = egui::Id::new("inspector_debug");
            let mut dbg: bool = ui.ctx().data(|d| d.get_temp(dbg_id)).unwrap_or(false);
            ui.separator();
            if ui.checkbox(&mut dbg, "Debug mode").on_hover_text("Show the raw entity JSON").changed() {
                ui.ctx().data_mut(|d| d.insert_temp(dbg_id, dbg));
            }
            if dbg {
                let mut txt = serde_json::to_string_pretty(&e).unwrap_or_default();
                ui.add(egui::TextEdit::multiline(&mut txt).code_editor().desired_rows(8).desired_width(f32::INFINITY).interactive(true));
            }
            if child_ctx.is_some() {
                ui.separator();
                ui.weak("Inside a prefab: components, scripts and effects are stored as overrides on the instance.");
            }
            if let Some(p) = e.prefab.as_ref().filter(|_| child_ctx.is_none()) {
                ui.separator();
                ui.label(format!("Prefab instance: {}", p.path));
                ui.weak(format!("{} override(s)", p.overrides.len()));
                let pid = e.id.clone();
                ui.horizontal_wrapped(|ui| {
                    if ui.button("Apply all").clicked() {
                        prefab_op = Some((pid.clone(), 0));
                    }
                    if ui.button("Unpack").clicked() {
                        prefab_op = Some((pid.clone(), 1));
                    }
                    if ui.button("Unpack completely").clicked() {
                        prefab_op = Some((pid.clone(), 2));
                    }
                    if ui.button("Open prefab").clicked() {
                        prefab_op = Some((pid.clone(), 3));
                    }
                    if ui.button("Create variant").clicked() {
                        prefab_op = Some((pid.clone(), 4));
                    }
                });
                if let Some(b) = &base_ent {
                    if !p.overrides.is_empty() && ui.button("Revert all overrides").clicked() {
                        e.components = b.components.clone();
                        e.scripts = b.scripts.clone();
                        e.behaviors = b.behaviors.clone();
                        e.effects = b.effects.clone();
                        e.layer = b.layer;
                    }
                } else {
                    ui.weak("Prefab file not found or unreadable");
                }
            }
        });

    let pending: Option<(String, String)> = ui
        .ctx()
        .data_mut(|d| d.remove_temp(egui::Id::new("apply_field")));
    if let Some((cid, field)) = pending.filter(|_| child_ctx.is_none()) {
        if let Some(ci) = cid.strip_prefix('c').and_then(|n| n.parse::<usize>().ok()) {
            st.apply_prefab_part(&inst.id, Some((ci, field)));
            return;
        }
    }
    if let Some(page) = docs {
        st.push(crate::state::Action::OpenDocs(page));
    }
    if let Some(c) = open_mesh {
        let id = if child_ctx.is_some() {
            ""
        } else {
            inst.id.as_str()
        };
        st.open_mesh_in_modeler(id, &c);
        return;
    }
    if let Some(file) = open_modeler {
        // a prefab child has no scene id of its own: open the file only (save = overwrite / new file)
        let id = if child_ctx.is_some() {
            ""
        } else {
            inst.id.as_str()
        };
        st.open_in_modeler(id, &file);
        return;
    }
    if let Some((id, op)) = prefab_op {
        let path = st
            .scene
            .as_ref()
            .and_then(|s| scene_ops::find(&s.entities, &id))
            .and_then(|e| e.prefab.as_ref().map(|p| p.path.clone()));
        match (op, path) {
            (0, _) => st.apply_prefab(&id),
            (3, Some(p)) => st.push(crate::state::Action::OpenPrefab(p)),
            (4, Some(p)) => st.push(crate::state::Action::PrefabVariant(p)),
            (n, _) => st.unpack_prefab(&id, n == 2),
        }
        return;
    }
    if e != orig {
        if let (Some((iid, path)), Some(b)) = (&child_ctx, &base_ent) {
            let mut patch = crate::prefab::overrides_for(&inst, b, &e);
            patch.remove("enabled");
            if e.enabled != b.enabled {
                patch.insert("enabled".into(), Value::Bool(e.enabled));
            }
            let (iid, path) = (iid.clone(), path.clone());
            st.edit("Edit prefab child", Some(&format!("insp:{iid}")), |l| {
                if let Some(slot) = scene_ops::find_mut(l, &iid) {
                    if let Some(p) = slot.prefab.as_mut() {
                        let mut mine = Map::new();
                        for k in crate::prefab::KEYS.iter().chain(&["enabled"]) {
                            if let Some(v) = patch.get(*k) {
                                mine.insert((*k).into(), v.clone());
                            }
                        }
                        crate::prefab::set_child_overrides(&mut p.overrides, &path, mine);
                    }
                }
            });
            return;
        }
        let id = orig.id.clone();
        let ov = base_ent
            .as_ref()
            .map(|b| crate::prefab::overrides_for(&inst, b, &e));
        st.edit("Edit entity", Some(&format!("insp:{id}")), |l| {
            if let Some(slot) = scene_ops::find_mut(l, &id) {
                let children = std::mem::take(&mut slot.children);
                match ov {
                    // instance keeps only name/transform/flags + the override patch
                    Some(ov) => {
                        slot.name = e.name;
                        slot.enabled = e.enabled;
                        slot.is_static = e.is_static;
                        slot.tags = e.tags;
                        slot.transform = e.transform;
                        slot.connections = e.connections;
                        if let Some(p) = slot.prefab.as_mut() {
                            p.overrides = ov;
                        }
                    }
                    None => *slot = e,
                }
                slot.children = children;
            }
        });
    }
}

/// Method names declared in the scripts of entity `id` (regex over the source: `name(args) {` at the start of a line).
fn script_methods(st: &EditorState, id: &str) -> Vec<String> {
    let (Some(root), Some(scene)) = (st.root.as_ref(), st.scene.as_ref()) else {
        return vec![];
    };
    let Some(ent) = scene_ops::find(&scene.entities, id) else {
        return vec![];
    };
    let re =
        regex::Regex::new(r"(?m)^\s*(?:async\s+|static\s+)?\*?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{")
            .expect("static regex");
    let mut out = vec![];
    for s in &ent.scripts {
        if let Ok(src) = nord_core::vfs::read_to_string(root.join(&s.path)) {
            for c in re.captures_iter(&src) {
                let n = c[1].to_string();
                if !matches!(
                    n.as_str(),
                    "if" | "for"
                        | "while"
                        | "switch"
                        | "catch"
                        | "function"
                        | "constructor"
                        | "return"
                ) && !out.contains(&n)
                {
                    out.push(n);
                }
            }
        }
    }
    out
}

fn collect_scripts(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<String>) {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let p = e.path();
        let n = e.file_name().to_string_lossy().into_owned();
        if p.v_is_dir() {
            if !matches!(
                n.as_str(),
                ".nord-cache" | "dist" | ".git" | "node_modules" | "target" | "assets"
            ) {
                collect_scripts(root, &p, out);
            }
        } else if n.ends_with(".js") || n.ends_with(".ts") {
            if let Ok(r) = p.strip_prefix(root) {
                out.push(r.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}
