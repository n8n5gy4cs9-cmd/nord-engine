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
    pub onion: bool,
    pub gif_path: String,
    pub brush_kind: Brush,
    pub brush_set: Vec<i64>,
    pub terrain: usize,
    pub mask_slot: usize,
    pub drag_start: Option<(i64, i64)>,
    pub anim_frames: String,
    pub anim_fps: f64,
    pub new_tileset: String,
    pub new_tile: u32,
    pub new_w: usize,
    pub new_h: usize,
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
    frames
        .iter()
        .filter_map(Value::as_i64)
        .map(|n| n.to_string())
        .collect::<Vec<_>>()
        .join(", ")
}

fn tex(ui: &Ui, root: &Path, rel: &str) -> Option<(egui::TextureId, Vec2)> {
    let uri = format!("file://{}", root.join(rel).display());
    match ui
        .ctx()
        .try_load_texture(&uri, TextureOptions::NEAREST, egui::SizeHint::default())
    {
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
    d[y][x]
        .as_i64()
        .or_else(|| d[y * width + x].as_i64())
        .unwrap_or(-1)
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
        Some(r) if r.is_array() => (
            r.as_array().map_or(0, Vec::len),
            l["data"].as_array().map_or(0, Vec::len),
        ),
        _ => {
            let w = l["width"].as_u64().or(m["width"].as_u64()).unwrap_or(0) as usize;
            let n = l["data"].as_array().map_or(0, Vec::len);
            (w, n.checked_div(w).unwrap_or(0))
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
    let sheets: Vec<String> = st
        .assets
        .iter()
        .filter(|a| matches!(a.kind, AssetType::Image | AssetType::Spritesheet))
        .map(|a| a.path.clone())
        .collect();
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
        ui.menu_button("Import GIF…", |ui| {
            ui.label("Path of an animated GIF on disk; it becomes assets/sprites/<name>.png (+ animation).");
            ui.add(egui::TextEdit::singleline(&mut st.anim.gif_path).hint_text("/path/to/anim.gif").desired_width(260.0));
            if ui.button("Import").clicked() && !st.anim.gif_path.trim().is_empty() {
                let src = std::path::PathBuf::from(st.anim.gif_path.trim());
                let name = src.file_stem().map_or_else(|| "anim".into(), |s| s.to_string_lossy().into_owned());
                let rel = format!("assets/sprites/{name}.png");
                let res = std::fs::read(&src).map_err(|e| e.to_string()).and_then(|b| crate::gif_import::gif_to_sheet(&b)).and_then(|sheet| {
                    std::fs::create_dir_all(root.join("assets/sprites")).map_err(|e| e.to_string())?;
                    sheet.image.save(root.join(&rel)).map_err(|e| e.to_string())?;
                    nord_core::io::save_json(&root.join(format!("{rel}.meta.json")), &sheet.meta).map_err(|e| e.to_string())?;
                    Ok((sheet.meta, sheet.frames))
                });
                match res {
                    Ok((meta, n)) => {
                        st.refresh_assets();
                        st.anim.sheet = Some(rel.clone());
                        st.anim.meta = meta;
                        st.anim.anim = Some("default".into());
                        st.toast(format!("Imported {n} frames to {rel}"));
                        ui.close_menu();
                    }
                    Err(e) => st.log(LogLevel::Error, format!("GIF import: {e}")),
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
    let names: Vec<String> = st.anim.meta["anims"]
        .as_object()
        .map(|o| o.keys().cloned().collect())
        .unwrap_or_default();
    ui.columns(2, |cols| {
        let ui = &mut cols[0];
        ui.strong("Animations");
        for n in &names {
            if ui
                .selectable_label(st.anim.anim.as_deref() == Some(n), n)
                .clicked()
            {
                st.anim.anim = Some(n.clone());
                st.anim.frames_text = frames_text(
                    st.anim.meta["anims"][n]["frames"]
                        .as_array()
                        .map_or(&[][..], |v| &v[..]),
                );
            }
        }
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(&mut st.anim.new_name)
                    .hint_text("new animation")
                    .desired_width(120.0),
            );
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
            advanced_props(&mut st.anim.meta["anims"][&n], ui);
            ui.label("Frames (e.g. 0-3, 5)");
            if ui.text_edit_singleline(&mut st.anim.frames_text).changed() {
                st.anim.meta["anims"][&n]["frames"] = json!(parse_frames(&st.anim.frames_text));
            }
            if frame_list(&mut st.anim.meta["anims"][&n], ui) {
                st.anim.frames_text = frames_text(st.anim.meta["anims"][&n]["frames"].as_array().map_or(&[][..], |v| &v[..]));
            }
            if ui.button("Delete animation").clicked() {
                if let Some(o) = st.anim.meta["anims"].as_object_mut() {
                    o.remove(&n);
                }
                st.anim.anim = None;
            }
            // preview
            if let Some((id, size)) = texinfo {
                let frames: Vec<i64> = st.anim.meta["anims"][&n]["frames"]
                    .as_array()
                    .map(|a| a.iter().filter_map(Value::as_i64).collect())
                    .unwrap_or_default();
                if !frames.is_empty() {
                    st.anim.clock += ui.input(|i| i.unstable_dt) as f64;
                    let fi = frame_at(&st.anim.meta["anims"][&n], frames.len(), st.anim.clock * fps);
                    let cols_n = (size.x / fw).floor().max(1.0) as i64;
                    let f = frames[fi];
                    let uv = frame_uv(f, cols_n, fw, fh, size);
                    let (r, _) = ui.allocate_exact_size(Vec2::splat(96.0), Sense::hover());
                    if st.anim.onion {
                        // onion skin: the previous and next frames of the animation, faded
                        for (off, tint) in [(frames.len() - 1, Color32::from_rgba_unmultiplied(255, 120, 120, 70)), (1, Color32::from_rgba_unmultiplied(120, 255, 120, 70))] {
                            let g = frames[(fi + off) % frames.len()];
                            ui.painter().image(id, r, frame_uv(g, cols_n, fw, fh, size), tint);
                        }
                    }
                    ui.painter().image(id, r, uv, Color32::WHITE);
                    ui.checkbox(&mut st.anim.onion, "onion skin");
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
                    ui.painter().image(
                        id,
                        r,
                        Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
                        Color32::WHITE,
                    );
                    let (cn, rn) = ((size.x / fw) as i64, (size.y / fh) as i64);
                    for c in 0..=cn {
                        ui.painter().vline(
                            r.left() + c as f32 * fw * z,
                            r.y_range(),
                            egui::Stroke::new(1.0_f32, Color32::from_white_alpha(40)),
                        );
                    }
                    for rr in 0..=rn {
                        ui.painter().hline(
                            r.x_range(),
                            r.top() + rr as f32 * fh * z,
                            egui::Stroke::new(1.0_f32, Color32::from_white_alpha(40)),
                        );
                    }
                    if resp.clicked() {
                        if let (Some(p), Some(n)) =
                            (resp.interact_pointer_pos(), st.anim.anim.clone())
                        {
                            let (cx, cy) = (
                                ((p.x - r.left()) / (fw * z)) as i64,
                                ((p.y - r.top()) / (fh * z)) as i64,
                            );
                            if cx < cn && cy < rn {
                                let f = cy * cn + cx;
                                if let Some(a) = st.anim.meta["anims"][&n]["frames"].as_array_mut()
                                {
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

/// Speed, ping-pong, repeat count / repeat-to frame and tags of one animation (all optional keys in the sheet meta).
pub fn advanced_props(a: &mut Value, ui: &mut Ui) {
    ui.horizontal_wrapped(|ui| {
        let mut speed = a["speed"].as_f64().unwrap_or(1.0);
        if ui.add(egui::DragValue::new(&mut speed).speed(0.05).range(0.1..=10.0).prefix("speed × ")).changed() {
            a["speed"] = json!(speed);
        }
        let mut pp = a["pingPong"].as_bool().unwrap_or(false);
        if ui.checkbox(&mut pp, "ping-pong").changed() {
            a["pingPong"] = json!(pp);
        }
    });
    ui.horizontal_wrapped(|ui| {
        if a["loop"].as_bool().unwrap_or(true) {
            let mut on = a["repeatTo"].is_number();
            let mut at = a["repeatTo"].as_i64().unwrap_or(0);
            let c = ui.checkbox(&mut on, "repeat to frame #").on_hover_text("play once, then loop from this frame of the list").changed();
            let d = ui.add_enabled(on, egui::DragValue::new(&mut at).range(0..=999)).changed();
            if c || d {
                if on {
                    a["repeatTo"] = json!(at);
                } else if let Some(o) = a.as_object_mut() {
                    o.remove("repeatTo");
                }
            }
        } else {
            let mut r = a["repeat"].as_i64().unwrap_or(0);
            if ui.add(egui::DragValue::new(&mut r).range(0..=99).prefix("repeat ")).on_hover_text("extra plays after the first").changed() {
                a["repeat"] = json!(r);
            }
        }
        let mut tags = a["tags"].as_array().map(|t| t.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(", ")).unwrap_or_default();
        if ui.add(egui::TextEdit::singleline(&mut tags).hint_text("tags: attack, loop-safe").desired_width(140.0)).changed() {
            a["tags"] = json!(tags.split(',').map(str::trim).filter(|t| !t.is_empty()).collect::<Vec<_>>());
        }
    });
}

/// Frame list with per-frame duration multipliers; reorder, duplicate, delete. Returns true when the frame list changed.
pub fn frame_list(a: &mut Value, ui: &mut Ui) -> bool {
    let frames: Vec<i64> = a["frames"].as_array().map(|f| f.iter().filter_map(Value::as_i64).collect()).unwrap_or_default();
    let mut durs: Vec<f64> = (0..frames.len()).map(|i| a["frameDurations"][i].as_f64().unwrap_or(1.0)).collect();
    let mut fr = frames.clone();
    let mut changed = false;
    let mut act: Option<(usize, &str)> = None;
    egui::CollapsingHeader::new("Frame list (durations)").default_open(false).show(ui, |ui| {
        for i in 0..fr.len() {
            ui.horizontal(|ui| {
                ui.monospace(format!("{i:>2}  frame {}", fr[i]));
                ui.add(egui::DragValue::new(&mut durs[i]).speed(0.05).range(0.1..=20.0).prefix("× "));
                if crate::icons::mini(ui, "arrow-up", "Move up").clicked() && i > 0 {
                    act = Some((i, "up"));
                }
                if crate::icons::mini(ui, "arrow-down", "Move down").clicked() && i + 1 < fr.len() {
                    act = Some((i, "down"));
                }
                if crate::icons::mini(ui, "copy", "Duplicate frame").clicked() {
                    act = Some((i, "dup"));
                }
                if crate::icons::mini(ui, "x", "Delete frame").clicked() && fr.len() > 1 {
                    act = Some((i, "del"));
                }
            });
        }
    });
    if let Some((i, what)) = act {
        match what {
            "up" => {
                fr.swap(i, i - 1);
                durs.swap(i, i - 1);
            }
            "down" => {
                fr.swap(i, i + 1);
                durs.swap(i, i + 1);
            }
            "dup" => {
                fr.insert(i + 1, fr[i]);
                durs.insert(i + 1, durs[i]);
            }
            _ => {
                fr.remove(i);
                durs.remove(i);
            }
        }
        changed = true;
        a["frames"] = json!(fr);
    }
    let was: Vec<f64> = (0..frames.len()).map(|i| a["frameDurations"][i].as_f64().unwrap_or(1.0)).collect();
    if changed || durs != was {
        if durs.iter().all(|d| (*d - 1.0).abs() < 1e-9) {
            if let Some(o) = a.as_object_mut() {
                o.remove("frameDurations");
            }
        } else {
            a["frameDurations"] = json!(durs);
        }
    }
    changed
}

/// Index into the frame list after `ticks` frame-times, honouring per-frame duration multipliers (and ping-pong).
pub fn frame_at(a: &Value, n: usize, ticks: f64) -> usize {
    if n == 0 {
        return 0;
    }
    let mult: Vec<f64> = (0..n).map(|i| a["frameDurations"][i].as_f64().unwrap_or(1.0).max(0.01)).collect();
    let pp = a["pingPong"].as_bool().unwrap_or(false);
    let total: f64 = mult.iter().sum();
    let period = if pp && n > 1 { total * 2.0 - mult[0] - mult[n - 1] } else { total };
    let mut t = ticks.rem_euclid(period.max(0.01));
    // forward, then (ping-pong) back without repeating the end frames
    let seq: Vec<usize> = if pp && n > 1 { (0..n).chain((1..n - 1).rev()).collect() } else { (0..n).collect() };
    for i in seq {
        t -= mult[i];
        if t < 0.0 {
            return i;
        }
    }
    n - 1
}

pub fn frame_uv(f: i64, cols: i64, fw: f32, fh: f32, size: Vec2) -> Rect {
    let (cx, cy) = ((f % cols) as f32, (f / cols) as f32);
    Rect::from_min_max(
        Pos2::new(cx * fw / size.x, cy * fh / size.y),
        Pos2::new((cx + 1.0) * fw / size.x, (cy + 1.0) * fh / size.y),
    )
}

#[derive(Default, PartialEq, Clone, Copy)]
pub enum Brush {
    #[default]
    Single,
    Rect,
    Fill,
    Random,
    Terrain,
    DefineTerrain,
}

fn tile_ui(st: &mut EditorState, ui: &mut Ui, root: &Path) {
    use crate::tilemap as tm;
    if st.anim.zoom == 0.0 {
        st.anim.zoom = 2.0;
    }
    if st.anim.new_tile == 0 {
        (st.anim.new_tile, st.anim.new_w, st.anim.new_h, st.anim.anim_fps) = (16, 40, 23, 6.0);
    }
    let maps: Vec<String> = st.assets.iter().filter(|a| a.path.ends_with(".tilemap.json") || a.path.ends_with(".tmj")).map(|a| a.path.clone()).collect();
    let images: Vec<String> = st.assets.iter().filter(|a| matches!(a.kind, AssetType::Image | AssetType::Spritesheet)).map(|a| a.path.clone()).collect();
    ui.horizontal_wrapped(|ui| {
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
        ui.menu_button("New tilemap…", |ui| {
            ui.label("Tileset image");
            egui::ComboBox::from_id_salt("nt-tileset").selected_text(st.anim.new_tileset.clone()).show_ui(ui, |ui| {
                for i in &images {
                    ui.selectable_value(&mut st.anim.new_tileset, i.clone(), i);
                }
            });
            ui.horizontal(|ui| {
                ui.add(egui::DragValue::new(&mut st.anim.new_tile).range(4..=256).prefix("tile "));
                ui.add(egui::DragValue::new(&mut st.anim.new_w).range(1..=500).prefix("map w "));
                ui.add(egui::DragValue::new(&mut st.anim.new_h).range(1..=500).prefix("h "));
            });
            ui.add(egui::TextEdit::singleline(&mut st.anim.new_name).hint_text("name").desired_width(160.0));
            if ui.button("Create").clicked() && !st.anim.new_name.trim().is_empty() && !st.anim.new_tileset.is_empty() {
                let rel = format!("assets/maps/{}.tilemap.json", st.anim.new_name.trim().replace(' ', "-"));
                let m = tm::new_map(&st.anim.new_tileset, st.anim.new_tile, st.anim.new_tile, st.anim.new_w, st.anim.new_h);
                if let Some(p) = root.join(&rel).parent() {
                    let _ = std::fs::create_dir_all(p);
                }
                match nord_core::io::save_json(&root.join(&rel), &m) {
                    Ok(()) => {
                        st.refresh_assets();
                        st.anim.map = Some(rel);
                        st.anim.map_json = m;
                        st.anim.layer = 0;
                        st.anim.dirty_map = false;
                        st.anim.new_name.clear();
                        ui.close_menu();
                    }
                    Err(e) => st.log(LogLevel::Error, e.to_string()),
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
        ui.weak("Pick a *.tilemap.json (Nord format) or create one from a tileset image");
        return;
    }
    let (mw, mh) = map_size(&st.anim.map_json);
    let tw = st.anim.map_json["tileWidth"].as_f64().or(st.anim.map_json["tilewidth"].as_f64()).unwrap_or(16.0) as f32;
    let th = st.anim.map_json["tileHeight"].as_f64().or(st.anim.map_json["tileheight"].as_f64()).unwrap_or(16.0) as f32;
    let tileset = st.anim.map_json["tileset"].as_str().map(String::from).or_else(|| st.anim.map_json["tilesets"][0]["image"].as_str().map(String::from));
    let tinfo = tileset.as_deref().and_then(|t| tex(ui, root, t));
    let nl = st.anim.map_json["layers"].as_array().map_or(0, Vec::len);
    st.anim.layer = st.anim.layer.min(nl.saturating_sub(1));
    // layers: select, add, rename, reorder, hide, delete
    ui.horizontal_wrapped(|ui| {
        for i in 0..nl {
            let name = st.anim.map_json["layers"][i]["name"].as_str().unwrap_or("layer").to_string();
            let hidden = st.anim.map_json["layers"][i]["visible"].as_bool() == Some(false);
            ui.selectable_value(&mut st.anim.layer, i, if hidden { format!("({name})") } else { name });
        }
        let l = st.anim.layer;
        if crate::icons::mini(ui, "plus", "Add layer").clicked() {
            tm::add_layer(&mut st.anim.map_json, &format!("layer{}", nl + 1));
            st.anim.layer = nl;
            st.anim.dirty_map = true;
        }
        let mut name = st.anim.map_json["layers"][l]["name"].as_str().unwrap_or("").to_string();
        if ui.add(egui::TextEdit::singleline(&mut name).desired_width(90.0)).changed() {
            st.anim.map_json["layers"][l]["name"] = json!(name);
            st.anim.dirty_map = true;
        }
        let mut vis = st.anim.map_json["layers"][l]["visible"].as_bool() != Some(false);
        if ui.checkbox(&mut vis, "visible").changed() {
            st.anim.map_json["layers"][l]["visible"] = json!(vis);
            st.anim.dirty_map = true;
        }
        if crate::icons::mini(ui, "arrow-up", "Move layer up").clicked() {
            if let Some(j) = tm::move_layer(&mut st.anim.map_json, l, true) {
                st.anim.layer = j;
                st.anim.dirty_map = true;
            }
        }
        if crate::icons::mini(ui, "arrow-down", "Move layer down").clicked() {
            if let Some(j) = tm::move_layer(&mut st.anim.map_json, l, false) {
                st.anim.layer = j;
                st.anim.dirty_map = true;
            }
        }
        if crate::icons::mini(ui, "x", "Delete layer").clicked() && tm::delete_layer(&mut st.anim.map_json, l) {
            st.anim.layer = l.saturating_sub(1);
            st.anim.dirty_map = true;
        }
    });
    // brushes
    let terr = tm::terrains(&st.anim.map_json);
    ui.horizontal_wrapped(|ui| {
        for (b, label, tip) in [
            (Brush::Single, "Paint", "Click/drag; right-click erases"),
            (Brush::Rect, "Rectangle", "Drag a box"),
            (Brush::Fill, "Fill", "Flood fill the area"),
            (Brush::Random, "Random", "Random tile from the ctrl-clicked tileset tiles"),
            (Brush::Terrain, "Terrain", "Auto-tile: picks edges/corners from neighbours"),
            (Brush::DefineTerrain, "Define terrain", "Assign tileset tiles to the 16 neighbour masks"),
        ] {
            ui.selectable_value(&mut st.anim.brush_kind, b, label).on_hover_text(tip);
        }
        ui.weak(format!("{mw}×{mh} tiles, brush {}", st.anim.brush));
    });
    if matches!(st.anim.brush_kind, Brush::Terrain | Brush::DefineTerrain) {
        ui.horizontal_wrapped(|ui| {
            egui::ComboBox::from_id_salt("terrain-pick").selected_text(terr.get(st.anim.terrain).map_or("(no terrain)".to_string(), |t| t.name.clone())).show_ui(ui, |ui| {
                for (i, t) in terr.iter().enumerate() {
                    ui.selectable_value(&mut st.anim.terrain, i, &t.name);
                }
            });
            if ui.small_button("+ terrain").clicked() {
                let mut all = terr.clone();
                all.push(tm::Terrain { name: format!("terrain{}", all.len() + 1), tiles: [-1; 16] });
                st.anim.terrain = all.len() - 1;
                tm::set_terrains(&mut st.anim.map_json, &all);
                st.anim.dirty_map = true;
            }
            if st.anim.brush_kind == Brush::DefineTerrain {
                ui.weak("pick a mask, then click a tileset tile:");
                for m in 0..16usize {
                    let t = terr.get(st.anim.terrain).map_or(-1, |t| t.tiles[m]);
                    let label = format!("{}{}{}{}->{t}", if m & 1 != 0 { "N" } else { "" }, if m & 2 != 0 { "E" } else { "" }, if m & 4 != 0 { "S" } else { "" }, if m & 8 != 0 { "W" } else { "" });
                    ui.selectable_value(&mut st.anim.mask_slot, m, if m == 0 { format!("alone->{t}") } else { label });
                }
            }
        });
    }
    // properties of the brush tile: collision + animation
    ui.horizontal_wrapped(|ui| {
        let tile = st.anim.brush;
        let mut col = st.anim.map_json["collides"].as_array().is_some_and(|a| a.iter().any(|v| v.as_i64() == Some(tile)));
        if ui.checkbox(&mut col, format!("tile {tile} blocks movement")).changed() {
            tm::toggle_collide(&mut st.anim.map_json, tile);
            st.anim.dirty_map = true;
        }
        ui.label("animate frames");
        ui.add(egui::TextEdit::singleline(&mut st.anim.anim_frames).hint_text("e.g. 5, 6, 7").desired_width(90.0));
        ui.add(egui::DragValue::new(&mut st.anim.anim_fps).range(1.0..=30.0).prefix("fps "));
        if ui.small_button("Apply").on_hover_text("animated tile: fewer than 2 frames removes the animation").clicked() {
            let frames = parse_frames(&st.anim.anim_frames);
            tm::set_animated(&mut st.anim.map_json, tile, &frames, st.anim.anim_fps.max(1.0));
            st.anim.dirty_map = true;
        }
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
                        let t = cy * cols + cx;
                        if st.anim.brush_kind == Brush::DefineTerrain {
                            let mut all = terr.clone();
                            if let Some(tr) = all.get_mut(st.anim.terrain) {
                                tr.tiles[st.anim.mask_slot.min(15)] = t;
                                tm::set_terrains(&mut st.anim.map_json, &all);
                                st.anim.dirty_map = true;
                            }
                        } else if ui.input(|i| i.modifiers.command || i.modifiers.ctrl) {
                            if let Some(p) = st.anim.brush_set.iter().position(|x| *x == t) {
                                st.anim.brush_set.remove(p);
                            } else {
                                st.anim.brush_set.push(t);
                            }
                        } else {
                            st.anim.brush = t;
                            st.anim.brush_set = vec![t];
                        }
                    }
                }
                let mark = |t: i64, col: Color32| {
                    let (bx, by) = ((t % cols) as f32, (t / cols) as f32);
                    ui.painter().rect_stroke(Rect::from_min_size(r.min + Vec2::new(bx * tw * z, by * th * z), Vec2::new(tw * z, th * z)), 0.0, egui::Stroke::new(2.0_f32, col), egui::StrokeKind::Inside);
                };
                for t in &st.anim.brush_set {
                    mark(*t, Color32::from_rgb(120, 200, 255));
                }
                if st.anim.brush >= 0 {
                    mark(st.anim.brush, Color32::YELLOW);
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
        let layer = st.anim.layer;
        let cols = tinfo.map_or(1, |(_, s)| (s.x / tw).floor().max(1.0) as i64);
        for li in 0..nl {
            if st.anim.map_json["layers"][li]["visible"].as_bool() == Some(false) {
                continue;
            }
            let faded = if li == layer { Color32::WHITE } else { Color32::from_white_alpha(130) };
            for y in 0..mh {
                for x in 0..mw {
                    let cell = Rect::from_min_size(r.min + Vec2::new(x as f32 * tw * z, y as f32 * th * z), Vec2::new(tw * z, th * z));
                    if !ui.is_rect_visible(cell) {
                        continue;
                    }
                    let v = get_cell(&st.anim.map_json["layers"][li], mw, x, y);
                    if v >= 0 {
                        if let Some((id, size)) = tinfo {
                            ui.painter().image(id, cell, frame_uv(v, cols, tw, th, size), faded);
                        }
                    }
                }
            }
        }
        for y in 0..mh {
            for x in 0..mw {
                let cell = Rect::from_min_size(r.min + Vec2::new(x as f32 * tw * z, y as f32 * th * z), Vec2::new(tw * z, th * z));
                if ui.is_rect_visible(cell) {
                    ui.painter().rect_stroke(cell, 0.0, egui::Stroke::new(0.5_f32, Color32::from_white_alpha(18)), egui::StrokeKind::Inside);
                }
            }
        }
        let cell_at = |p: Pos2| (((p.x - r.left()) / (tw * z)).floor() as i64, ((p.y - r.top()) / (th * z)).floor() as i64);
        let kind = st.anim.brush_kind;
        if kind == Brush::DefineTerrain {
            return;
        }
        let paint = resp.dragged_by(egui::PointerButton::Primary) || resp.clicked();
        let erase = resp.dragged_by(egui::PointerButton::Secondary) || resp.secondary_clicked();
        let terrain = terr.get(st.anim.terrain).cloned();
        if resp.drag_started_by(egui::PointerButton::Primary) {
            st.anim.drag_start = resp.interact_pointer_pos().map(cell_at);
        }
        // rectangle preview while dragging
        if kind == Brush::Rect {
            if let (Some(s0), Some(p)) = (st.anim.drag_start, resp.interact_pointer_pos()) {
                let e = cell_at(p);
                let (a, b) = ((s0.0.min(e.0), s0.1.min(e.1)), (s0.0.max(e.0), s0.1.max(e.1)));
                let pr = Rect::from_min_max(r.min + Vec2::new(a.0 as f32 * tw * z, a.1 as f32 * th * z), r.min + Vec2::new((b.0 + 1) as f32 * tw * z, (b.1 + 1) as f32 * th * z));
                ui.painter().rect_stroke(pr, 0.0, egui::Stroke::new(2.0_f32, Color32::YELLOW), egui::StrokeKind::Outside);
            }
        }
        let mut changed = false;
        if let Some(p) = resp.interact_pointer_pos() {
            let (x, y) = cell_at(p);
            let brush = st.anim.brush;
            let set = if st.anim.brush_set.is_empty() { vec![brush] } else { st.anim.brush_set.clone() };
            if erase {
                match (&terrain, kind) {
                    (Some(t), Brush::Terrain) => tm::erase_terrain(&mut st.anim.map_json, layer, x, y, t),
                    _ => tm::set(&mut st.anim.map_json, layer, x, y, -1),
                }
                changed = true;
            } else if kind == Brush::Rect {
                if resp.drag_stopped() {
                    if let Some(s0) = st.anim.drag_start.take() {
                        tm::rect_fill(&mut st.anim.map_json, layer, s0.0, s0.1, x, y, brush);
                        changed = true;
                    }
                } else if resp.clicked() {
                    tm::set(&mut st.anim.map_json, layer, x, y, brush);
                    changed = true;
                }
            } else if paint {
                match kind {
                    Brush::Single => tm::set(&mut st.anim.map_json, layer, x, y, brush),
                    Brush::Fill if resp.clicked() => {
                        tm::flood(&mut st.anim.map_json, layer, x, y, brush);
                    }
                    Brush::Random => tm::set(&mut st.anim.map_json, layer, x, y, tm::random_pick(&set, x, y, 7)),
                    Brush::Terrain => {
                        if let Some(t) = &terrain {
                            tm::paint_terrain(&mut st.anim.map_json, layer, x, y, t);
                        }
                    }
                    _ => {}
                }
                changed = kind != Brush::Fill || resp.clicked();
            }
        }
        if resp.drag_stopped() {
            st.anim.drag_start = None;
        }
        if changed {
            st.anim.dirty_map = true;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_at_respects_durations_and_ping_pong() {
        let a = json!({"frames":[0,1,2],"frameDurations":[1.0,3.0,1.0]});
        assert_eq!([0.5, 1.5, 3.9, 4.5, 5.5].map(|t| frame_at(&a, 3, t)), [0, 1, 1, 2, 0]);
        let pp = json!({"frames":[0,1,2],"pingPong":true});
        assert_eq!([0.5, 1.5, 2.5, 3.5, 4.5].map(|t| frame_at(&pp, 3, t)), [0, 1, 2, 1, 0]);
    }

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
        assert_eq!(
            map_size(&json!({"layers": [{"data": [[0, 0, 0], [0, 0, 0]]}]})),
            (3, 2)
        );
        assert_eq!(
            map_size(&json!({"layers": [{"data": [0, 0, 0, 0, 0, 0], "width": 3}]})),
            (3, 2)
        );
    }
}
