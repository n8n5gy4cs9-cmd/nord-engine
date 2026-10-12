//! Inspector generated from `schema.rs` (component tables + script `static attributes`). Edits a clone of the selected
//! entity and commits one coalesced undo step when anything changed.
use crate::{
    icons, scene_ops,
    schema::{self, Field, FieldType},
    state::EditorState,
    theme,
};
use egui::{DragValue, Ui};
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
    let mut a: Vec<f64> = v.as_array().map(|a| a.iter().map(num).collect()).unwrap_or_default();
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
        "json" => matches!(a.kind, AssetType::Json | AssetType::Prefab | AssetType::Scene),
        _ => true,
    }
}

/// One widget for one typed value. Returns true when the value changed.
pub fn field_ui(ui: &mut Ui, cx: &Ctx, ty: &FieldType, v: &mut Value, id: &str) -> bool {
    let mut ch = false;
    match ty {
        FieldType::Number { min, max } => {
            let mut x = num(v);
            if drag(ui, &mut x, *min, *max, 0.05) {
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
            if ui.add(egui::TextEdit::singleline(&mut s).desired_width(f32::INFINITY)).changed() {
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
            egui::ComboBox::from_id_salt(id).selected_text(&cur).show_ui(ui, |ui| {
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
            let name = cx.entities.iter().find(|(i, _)| *i == cur).map_or("(none)".to_string(), |(_, n)| n.clone());
            egui::ComboBox::from_id_salt(id).selected_text(name).show_ui(ui, |ui| {
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
            let resp = egui::ComboBox::from_id_salt(id)
                .width(ui.available_width())
                .selected_text(if cur.is_empty() { "(none)" } else { cur.rsplit('/').next().unwrap_or(&cur) })
                .show_ui(ui, |ui| {
                    if ui.selectable_label(cur.is_empty(), "(none)").clicked() {
                        *v = json!("");
                        ch = true;
                    }
                    for a in cx.assets.iter().filter(|a| asset_matches(kind, a)) {
                        if ui.selectable_label(cur == a.path, &a.path).clicked() {
                            *v = json!(a.path);
                            ch = true;
                        }
                    }
                });
            if let Some(p) = resp.response.dnd_release_payload::<AssetDrag>() {
                *v = json!(p.0);
                ch = true;
            }
            resp.response.on_hover_text(&cur);
        }
        FieldType::Curve => {
            let mut pts: Vec<[f64; 2]> =
                v.as_array().map(|a| a.iter().map(|p| [num(&p[0]), num(&p[1])]).collect()).unwrap_or_default();
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

fn fields_ui(ui: &mut Ui, cx: &Ctx, fields: &[Field], data: &mut Map<String, Value>, id: &str) -> bool {
    let mut ch = false;
    egui::Grid::new(format!("g-{id}")).num_columns(2).spacing([8.0, 4.0]).show(ui, |ui| {
        for f in fields {
            ui.label(&f.label);
            let cur = data.entry(f.name.clone()).or_insert_with(|| f.default.clone());
            // keep the stored value usable for the widget's type (e.g. null from a hand-edited file)
            if cur.is_null() {
                *cur = f.default.clone();
            }
            ch |= field_ui(ui, cx, &f.ty, cur, &format!("{id}.{}", f.name));
            ui.end_row();
        }
        // fields present in the file but not in the schema: still editable (guessed type)
        let extra: Vec<String> = data.keys().filter(|k| !fields.iter().any(|f| &f.name == *k)).cloned().collect();
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

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(orig) = st.selected().cloned() else {
        ui.weak(if st.scene.is_some() { "Select an entity" } else { "No scene open" });
        return;
    };
    let is3d = st.is_3d();
    let entities: Vec<(String, String)> = st
        .scene
        .as_ref()
        .map(|s| scene_ops::flatten(&s.entities).into_iter().map(|(_, e)| (e.id.clone(), e.name.clone())).collect())
        .unwrap_or_default();
    // script schemas first (needs &mut st)
    let script_fields: Vec<Vec<Field>> = orig.scripts.iter().map(|s| st.script_fields(&s.path)).collect();
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
    let cx = Ctx { assets: &assets, entities };

    let mut e: Entity = orig.clone();
    egui::ScrollArea::vertical().auto_shrink([false; 2]).show(ui, |ui| {
        ui.horizontal(|ui| {
            ui.checkbox(&mut e.enabled, "");
            ui.add(egui::TextEdit::singleline(&mut e.name).desired_width(f32::INFINITY));
        });
        ui.horizontal(|ui| {
            ui.weak(format!("id {}", e.id));
            ui.weak("layer");
            ui.add(DragValue::new(&mut e.layer));
        });
        let mut tags = e.tags.join(", ");
        ui.horizontal(|ui| {
            ui.label("Tags");
            if ui.add(egui::TextEdit::singleline(&mut tags).desired_width(f32::INFINITY)).changed() {
                e.tags = tags.split(',').map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect();
            }
        });
        ui.separator();
        egui::CollapsingHeader::new("Transform").default_open(true).show(ui, |ui| {
            egui::Grid::new("xf").num_columns(2).show(ui, |ui| {
                for (label, arr, n3) in [
                    ("Position", &mut e.transform.pos, true),
                    ("Rotation", &mut e.transform.rot, is3d),
                    ("Scale", &mut e.transform.scale, true),
                ] {
                    ui.label(label);
                    ui.horizontal(|ui| {
                        let axes: &[usize] = if is3d || (n3 && label == "Position") { &[0, 1, 2] } else if label == "Rotation" { &[2] } else { &[0, 1] };
                        for &i in axes {
                            ui.weak(["x", "y", "z"][i]);
                            ui.add(DragValue::new(&mut arr[i]).speed(if label == "Scale" { 0.01 } else { 0.5 }));
                        }
                    });
                    ui.end_row();
                }
            });
        });
        // components
        let mut remove_comp = None;
        for (i, c) in e.components.iter_mut().enumerate() {
            let id = format!("c{i}");
            let fields = schema::component_fields(&c.kind);
            egui::CollapsingHeader::new(schema::label_of(&c.kind)).id_salt(&id).default_open(true).show(ui, |ui| {
                fields_ui(ui, &cx, &fields, &mut c.fields, &id);
                if ui.small_button("Remove component").clicked() {
                    remove_comp = Some(i);
                }
            });
        }
        if let Some(i) = remove_comp {
            e.components.remove(i);
        }
        ui.menu_button("+ Add component", |ui| {
            egui::ScrollArea::vertical().max_height(300.0).show(ui, |ui| {
                for k in schema::COMPONENT_TYPES {
                    if ui.button(schema::label_of(k)).clicked() {
                        let mut fields = Map::new();
                        schema::merge_defaults(&schema::component_fields(k), &mut fields);
                        e.components.push(Component { kind: k.to_string(), fields });
                        ui.close_menu();
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
            egui::CollapsingHeader::new(format!("📜 {name}")).id_salt(&id).default_open(true).show(ui, |ui| {
                ui.weak(&s.path);
                let fields = script_fields.get(i).cloned().unwrap_or_default();
                if fields.is_empty() {
                    ui.weak("No `static attributes` declared");
                }
                fields_ui(ui, &cx, &fields, &mut s.attributes, &id);
                ui.horizontal(|ui| {
                    if ui.small_button("Remove script").clicked() {
                        remove_script = Some(i);
                    }
                });
            });
        }
        if let Some(i) = remove_script {
            e.scripts.remove(i);
        }
        ui.menu_button("+ Add script", |ui| {
            for f in &script_files {
                if ui.button(f).clicked() {
                    e.scripts.push(ScriptRef { path: f.clone(), attributes: Map::new() });
                    ui.close_menu();
                }
            }
            if script_files.is_empty() {
                ui.weak("No scripts in scripts/");
            }
        });
        if let Some(p) = &e.prefab {
            ui.separator();
            ui.label(format!("Prefab instance: {}", p.path));
            ui.weak(format!("{} override(s)", p.overrides.len()));
        }
    });

    if e != orig {
        let id = orig.id.clone();
        st.edit("Edit entity", Some(&format!("insp:{id}")), |l| {
            if let Some(slot) = scene_ops::find_mut(l, &id) {
                let children = std::mem::take(&mut slot.children);
                *slot = e;
                slot.children = children;
            }
        });
    }
}

fn collect_scripts(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<String>) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        let n = e.file_name().to_string_lossy().into_owned();
        if p.is_dir() {
            if !matches!(n.as_str(), ".nord-cache" | "dist" | ".git" | "node_modules" | "target" | "assets") {
                collect_scripts(root, &p, out);
            }
        } else if n.ends_with(".js") || n.ends_with(".ts") {
            if let Ok(r) = p.strip_prefix(root) {
                out.push(r.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}
