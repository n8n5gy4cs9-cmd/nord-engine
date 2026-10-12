//! Spritesheet animation editor (edits `<sheet>.meta.json` `anims`) and a tilemap painter (Nord `*.tilemap.json`, plus flat
//! Tiled-style `data`). Basic by design (M3-21).
use crate::state::{EditorState, LogLevel};
use egui::{Color32, Pos2, Rect, Sense, TextureOptions, Ui, Vec2};
use nord_core::assets::AssetType;
use serde_json::{json, Value};
use std::path::Path;

#[derive(Default, PartialEq, Clone, Copy)]
pub enum Mode {
    #[default]
    Anim,
    Tile,
}

#[derive(Default)]
pub struct AnimUi {
    pub mode: Mode,
    // animation
    pub sheet: Option<String>,
    pub meta: Value,
    pub anim: Option<String>,
    pub frames_text: String,
    pub playing: bool,
    pub clock: f64,
    pub new_name: String,
    // tilemap
    pub map: Option<String>,
    pub map_json: Value,
    pub layer: usize,
    pub brush: i64,
    pub zoom: f32,
    pub dirty_map: bool,
}

pub fn parse_frames(s: &str) -> Vec<i64> {
    let mut out = vec![];
    for part in s.split(',').map(str::trim).filter(|p| !p.is_empty()) {
        if let Some((a, b)) = part.split_once('-') {
            if let (Ok(a), Ok(b)) = (a.trim().parse::<i64>(), b.trim().parse::<i64>()) {
                if a <= b && b - a < 4096 {
                    out.extend(a..=b);
                }
            }
        } else if let Ok(n) = part.parse() {
            out.push(n);
        }
    }
    out
}

pub fn frames_text(frames: &[Value]) -> String {
    frames.iter().filter_map(Value::as_i64).map(|n| n.to_string()).collect::<Vec<_>>().join(", ")
}

fn tex(ui: &Ui, root: &Path, rel: &str) -> Option<(egui::TextureId, Vec2)> {
    let uri = format!("file://{}", root.join(rel).display());
    match ui.ctx().try_load_texture(&uri, TextureOptions::NEAREST, egui::SizeHint::default()) {
        Ok(egui::load::TexturePoll::Ready { texture }) => Some((texture.id, texture.size)),
        Ok(_) => {
            ui.ctx().request_repaint();
            None
        }
        Err(_) => None,
    }
}

/// Read a cell of a layer (`data` as rows of ints, or flat with `width`).
pub fn get_cell(layer: &Value, width: usize, x: usize, y: usize) -> i64 {
    let d = &layer["data"];
    d[y][x].as_i64().or_else(|| d[y * width + x].as_i64()).unwrap_or(-1)
}

pub fn set_cell(layer: &mut Value, width: usize, x: usize, y: usize, v: i64) {
    if layer["data"][y].is_array() {
        layer["data"][y][x] = json!(v);
    } else if layer["data"][y * width + x].is_number() {
        layer["data"][y * width + x] = json!(v);
    }
}

pub fn map_size(m: &Value) -> (usize, usize) {
    let l = &m["layers"][0];
    match l["data"].get(0) {
        Some(r) if r.is_array() => (r.as_array().map_or(0, Vec::len), l["data"].as_array().map_or(0, Vec::len)),
        _ => {
            let w = l["width"].as_u64().or(m["width"].as_u64()).unwrap_or(0) as usize;
            let n = l["data"].as_array().map_or(0, Vec::len);
            (w, if w > 0 { n / w } else { 0 })
        }
    }
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
    ui.horizontal(|ui| {
        ui.selectable_value(&mut st.anim.mode, Mode::Anim, "Animations");
        ui.selectable_value(&mut st.anim.mode, Mode::Tile, "Tilemap painter");
    });
    ui.separator();
    match st.anim.mode {
        Mode::Anim => anim_ui(st, ui, &root),
        Mode::Tile => tile_ui(st, ui, &root),
    }
}

fn anim_ui(st: &mut EditorState, ui: &mut Ui, root: &Path) {
    let sheets: Vec<String> = st.assets.iter().filter(|a| matches!(a.kind, AssetType::Image | AssetType::Spritesheet)).map(|a| a.path.clone()).collect();
    ui.horizontal(|ui| {
        ui.label("Sheet");
        let cur = st.anim.sheet.clone().unwrap_or_else(|| "(choose)".into());
        egui::ComboBox::from_id_salt("sheet").selected_text(cur).show_ui(ui, |ui| {
            for s in &sheets {
                if ui.selectable_label(st.anim.sheet.as_deref() == Some(s), s).clicked() {
                    st.anim.sheet = Some(s.clone());
                    st.anim.meta = nord_core::io::load_json(&root.join(format!("{s}.meta.json"))).unwrap_or_else(|_| json!({"type":"spritesheet","frameWidth":32,"frameHeight":32,"anims":{}}));
                    st.anim.anim = None;
                }
            }
        });
        if ui.button("Save meta").clicked() {
            if let Some(s) = &st.anim.sheet {
                st.anim.meta["type"] = json!("spritesheet");
                match nord_core::io::save_json(&root.join(format!("{s}.meta.json")), &st.anim.meta) {
                    Ok(()) => {
                        st.toast("Saved animations");
                        st.refresh_assets();
                    }
                    Err(e) => st.log(LogLevel::Error, e.to_string()),
                }
            }
        }
    });
    let Some(sheet) = st.anim.sheet.clone() else {
        ui.weak("Pick a spritesheet image");
        return;
    };
    let fw = st.anim.meta["frameWidth"].as_u64().unwrap_or(32).max(1) as f32;
    let fh = st.anim.meta["frameHeight"].as_u64().unwrap_or(32).max(1) as f32;
    ui.horizontal(|ui| {
        let (mut w, mut h) = (fw as u32, fh as u32);
        ui.label("Frame");
        ui.add(egui::DragValue::new(&mut w).range(1..=4096));
        ui.label("×");
        ui.add(egui::DragValue::new(&mut h).range(1..=4096));
        st.anim.meta["frameWidth"] = json!(w);
        st.anim.meta["frameHeight"] = json!(h);
    });
    let texinfo = tex(ui, root, &sheet);
    let names: Vec<String> = st.anim.meta["anims"].as_object().map(|o| o.keys().cloned().collect()).unwrap_or_default();
    ui.columns(2, |cols| {
        let ui = &mut cols[0];
        ui.strong("Animations");
        for n in &names {
            if ui.selectable_label(st.anim.anim.as_deref() == Some(n), n).clicked() {
                st.anim.anim = Some(n.clone());
                st.anim.frames_text = frames_text(st.anim.meta["anims"][n]["frames"].as_array().map_or(&[][..], |v| &v[..]));
            }
        }
        ui.horizontal(|ui| {
            ui.add(egui::TextEdit::singleline(&mut st.anim.new_name).hint_text("new animation").desired_width(120.0));
            if ui.button("+").clicked() && !st.anim.new_name.trim().is_empty() {
                let n = st.anim.new_name.trim().to_string();
                st.anim.meta["anims"][&n] = json!({"frames":[0],"fps":10,"loop":true});
                st.anim.anim = Some(n);
                st.anim.frames_text = "0".into();
                st.anim.new_name.clear();
            }
        });
        if let Some(n) = st.anim.anim.clone() {
            ui.separator();
            let mut fps = st.anim.meta["anims"][&n]["fps"].as_f64().unwrap_or(10.0);
            let mut lp = st.anim.meta["anims"][&n]["loop"].as_bool().unwrap_or(true);
            ui.horizontal(|ui| {
                ui.label("fps");
                ui.add(egui::DragValue::new(&mut fps).range(1.0..=120.0));
                ui.checkbox(&mut lp, "loop");
            });
            st.anim.meta["anims"][&n]["fps"] = json!(fps);
            st.anim.meta["anims"][&n]["loop"] = json!(lp);
            ui.label("Frames (e.g. 0-3, 5)");
            if ui.text_edit_singleline(&mut st.anim.frames_text).changed() {
                st.anim.meta["anims"][&n]["frames"] = json!(parse_frames(&st.anim.frames_text));
            }
            if ui.button("Delete animation").clicked() {
                if let Some(o) = st.anim.meta["anims"].as_object_mut() {
                    o.remove(&n);
                }
                st.anim.anim = None;
            }
            // preview
            if let Some((id, size)) = texinfo {
                let frames: Vec<i64> = st.anim.meta["anims"][&n]["frames"].as_array().map(|a| a.iter().filter_map(Value::as_i64).collect()).unwrap_or_default();
                if !frames.is_empty() {
                    st.anim.clock += ui.input(|i| i.unstable_dt) as f64;
                    let fi = ((st.anim.clock * fps) as usize) % frames.len();
                    let cols_n = (size.x / fw).floor().max(1.0) as i64;
                    let f = frames[fi];
                    let uv = frame_uv(f, cols_n, fw, fh, size);
                    let (r, _) = ui.allocate_exact_size(Vec2::splat(96.0), Sense::hover());
                    ui.painter().image(id, r, uv, Color32::WHITE);
                    ui.weak(format!("frame {f}"));
                    ui.ctx().request_repaint();
                }
            }
        }
        let ui = &mut cols[1];
        ui.strong("Sheet (click a frame to append it)");
        match texinfo {
            Some((id, size)) => {
                egui::ScrollArea::both().show(ui, |ui| {
                    let z = 2.0;
                    let (r, resp) = ui.allocate_exact_size(size * z, Sense::click());
                    ui.painter().rect_filled(r, 0.0, Color32::from_gray(40));
                    ui.painter().image(id, r, Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)), Color32::WHITE);
                    let (cn, rn) = ((size.x / fw) as i64, (size.y / fh) as i64);
                    for c in 0..=cn {
                        ui.painter().vline(r.left() + c as f32 * fw * z, r.y_range(), egui::Stroke::new(1.0_f32, Color32::from_white_alpha(40)));
                    }
                    for rr in 0..=rn {
                        ui.painter().hline(r.x_range(), r.top() + rr as f32 * fh * z, egui::Stroke::new(1.0_f32, Color32::from_white_alpha(40)));
                    }
                    if resp.clicked() {
                        if let (Some(p), Some(n)) = (resp.interact_pointer_pos(), st.anim.anim.clone()) {
                            let (cx, cy) = (((p.x - r.left()) / (fw * z)) as i64, ((p.y - r.top()) / (fh * z)) as i64);
                            if cx < cn && cy < rn {
                                let f = cy * cn + cx;
                                if let Some(a) = st.anim.meta["anims"][&n]["frames"].as_array_mut() {
                                    a.push(json!(f));
                                    st.anim.frames_text = frames_text(a);
                                }
                            }
                        }
                    }
                });
            }
            None => {
                ui.weak("Loading image…");
            }
        }
    });
}

pub fn frame_uv(f: i64, cols: i64, fw: f32, fh: f32, size: Vec2) -> Rect {
    let (cx, cy) = ((f % cols) as f32, (f / cols) as f32);
    Rect::from_min_max(Pos2::new(cx * fw / size.x, cy * fh / size.y), Pos2::new((cx + 1.0) * fw / size.x, (cy + 1.0) * fh / size.y))
}

fn tile_ui(st: &mut EditorState, ui: &mut Ui, root: &Path) {
    if st.anim.zoom == 0.0 {
        st.anim.zoom = 2.0;
    }
    let maps: Vec<String> = st.assets.iter().filter(|a| a.path.ends_with(".tilemap.json") || a.path.ends_with(".tmj")).map(|a| a.path.clone()).collect();
    ui.horizontal(|ui| {
        egui::ComboBox::from_id_salt("tmap").selected_text(st.anim.map.clone().unwrap_or_else(|| "(choose tilemap)".into())).show_ui(ui, |ui| {
            for m in &maps {
                if ui.selectable_label(st.anim.map.as_deref() == Some(m), m).clicked() {
                    st.anim.map = Some(m.clone());
                    st.anim.map_json = nord_core::io::load_json(&root.join(m)).unwrap_or(Value::Null);
                    st.anim.layer = 0;
                    st.anim.dirty_map = false;
                }
            }
        });
        ui.add(egui::Slider::new(&mut st.anim.zoom, 0.5..=6.0).text("zoom"));
        if ui.add_enabled(st.anim.dirty_map, egui::Button::new("Save tilemap")).clicked() {
            if let Some(m) = &st.anim.map {
                match nord_core::io::save_json(&root.join(m), &st.anim.map_json) {
                    Ok(()) => {
                        st.anim.dirty_map = false;
                        st.toast("Saved tilemap");
                    }
                    Err(e) => st.log(LogLevel::Error, e.to_string()),
                }
            }
        }
        if st.anim.dirty_map {
            ui.weak("unsaved •");
        }
    });
    if st.anim.map_json.is_null() {
        ui.weak("Pick a *.tilemap.json (Nord format)");
        return;
    }
    let (mw, mh) = map_size(&st.anim.map_json);
    let tw = st.anim.map_json["tileWidth"].as_f64().or(st.anim.map_json["tilewidth"].as_f64()).unwrap_or(16.0) as f32;
    let th = st.anim.map_json["tileHeight"].as_f64().or(st.anim.map_json["tileheight"].as_f64()).unwrap_or(16.0) as f32;
    let tileset = st.anim.map_json["tileset"].as_str().map(String::from).or_else(|| st.anim.map_json["tilesets"][0]["image"].as_str().map(String::from));
    let tinfo = tileset.as_deref().and_then(|t| tex(ui, root, t));
    let nl = st.anim.map_json["layers"].as_array().map_or(0, Vec::len);
    ui.horizontal(|ui| {
        for i in 0..nl {
            let name = st.anim.map_json["layers"][i]["name"].as_str().unwrap_or("layer").to_string();
            ui.selectable_value(&mut st.anim.layer, i, name);
        }
        ui.weak(format!("{mw}×{mh} tiles, brush {} (right-click erases)", st.anim.brush));
    });
    egui::SidePanel::left("tile-palette").default_width(150.0).show_inside(ui, |ui| {
        ui.strong("Tileset");
        if let Some((id, size)) = tinfo {
            egui::ScrollArea::both().show(ui, |ui| {
                let z = 2.0;
                let (r, resp) = ui.allocate_exact_size(size * z, Sense::click());
                ui.painter().image(id, r, Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)), Color32::WHITE);
                let cols = (size.x / tw).floor().max(1.0) as i64;
                if resp.clicked() {
                    if let Some(p) = resp.interact_pointer_pos() {
                        let (cx, cy) = (((p.x - r.left()) / (tw * z)) as i64, ((p.y - r.top()) / (th * z)) as i64);
                        st.anim.brush = cy * cols + cx;
                    }
                }
                let (bx, by) = ((st.anim.brush % cols) as f32, (st.anim.brush / cols) as f32);
                if st.anim.brush >= 0 {
                    ui.painter().rect_stroke(Rect::from_min_size(r.min + Vec2::new(bx * tw * z, by * th * z), Vec2::new(tw * z, th * z)), 0.0, egui::Stroke::new(2.0_f32, Color32::YELLOW), egui::StrokeKind::Inside);
                }
            });
        } else {
            ui.weak("tileset image not found");
        }
    });
    let z = st.anim.zoom;
    egui::ScrollArea::both().show(ui, |ui| {
        let (r, resp) = ui.allocate_exact_size(Vec2::new(mw as f32 * tw * z, mh as f32 * th * z), Sense::click_and_drag());
        ui.painter().rect_filled(r, 0.0, Color32::from_gray(30));
        let layer = st.anim.layer.min(nl.saturating_sub(1));
        let cols = tinfo.map_or(1, |(_, s)| (s.x / tw).floor().max(1.0) as i64);
        for y in 0..mh {
            for x in 0..mw {
                let cell = Rect::from_min_size(r.min + Vec2::new(x as f32 * tw * z, y as f32 * th * z), Vec2::new(tw * z, th * z));
                if !ui.is_rect_visible(cell) {
                    continue;
                }
                let v = get_cell(&st.anim.map_json["layers"][layer], mw, x, y);
                if v >= 0 {
                    if let Some((id, size)) = tinfo {
                        ui.painter().image(id, cell, frame_uv(v, cols, tw, th, size), Color32::WHITE);
                    }
                }
                ui.painter().rect_stroke(cell, 0.0, egui::Stroke::new(0.5_f32, Color32::from_white_alpha(18)), egui::StrokeKind::Inside);
            }
        }
        let paint = resp.dragged_by(egui::PointerButton::Primary) || resp.clicked();
        let erase = resp.dragged_by(egui::PointerButton::Secondary) || resp.secondary_clicked();
        if paint || erase {
            if let Some(p) = resp.interact_pointer_pos() {
                let (x, y) = (((p.x - r.left()) / (tw * z)).floor() as i64, ((p.y - r.top()) / (th * z)).floor() as i64);
                if x >= 0 && y >= 0 && (x as usize) < mw && (y as usize) < mh {
                    let v = if erase { -1 } else { st.anim.brush };
                    set_cell(&mut st.anim.map_json["layers"][layer], mw, x as usize, y as usize, v);
                    st.anim.dirty_map = true;
                }
            }
        }
    });
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_lists() {
        assert_eq!(parse_frames("0-3, 5,7"), vec![0, 1, 2, 3, 5, 7]);
        assert_eq!(parse_frames("x, 2"), vec![2]);
        assert_eq!(frames_text(&[json!(1), json!(2)]), "1, 2");
    }

    #[test]
    fn tile_cells_rows_and_flat() {
        let mut rows = json!({"data": [[-1, 2], [3, -1]]});
        assert_eq!(get_cell(&rows, 2, 1, 0), 2);
        set_cell(&mut rows, 2, 0, 0, 9);
        assert_eq!(rows["data"][0][0], 9);
        let mut flat = json!({"data": [1, 2, 3, 4], "width": 2});
        assert_eq!(get_cell(&flat, 2, 0, 1), 3);
        set_cell(&mut flat, 2, 1, 1, 7);
        assert_eq!(flat["data"][3], 7);
        assert_eq!(map_size(&json!({"layers": [{"data": [[0, 0, 0], [0, 0, 0]]}]})), (3, 2));
        assert_eq!(map_size(&json!({"layers": [{"data": [0, 0, 0, 0, 0, 0], "width": 3}]})), (3, 2));
    }
}
