//! Project tab (M10-25): project properties, find all references, safe rename (assets, objects), project-wide replace.
//! Logic lives in `nord_core::refs`; every rename/replace shows a dry-run list first.
use crate::state::{EditorState, LogLevel};
use egui::{RichText, Ui};
use nord_core::refs;
use serde_json::{json, Value};

#[derive(Default, PartialEq, Clone, Copy)]
pub enum Pending {
    #[default]
    None,
    Asset,
    Object,
    Replace,
}

#[derive(Default)]
pub struct ProjectUi {
    pub find: String,
    pub whole_word: bool,
    pub hits: Vec<refs::Hit>,
    pub from: String,
    pub to: String,
    pub preview: Vec<String>,
    pub pending: Pending,
    pub replace_with: String,
    /// Input editor: the action whose next key press is being captured, and the new-action name box.
    pub capture: Option<String>,
    pub new_action: String,
}

fn web(p: &mut nord_core::Project) -> &mut Value {
    p.export.entry("web").or_insert_with(|| json!({}))
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
    egui::ScrollArea::vertical()
        .auto_shrink([false, false])
        .show(ui, |ui| {
            properties(st, ui, &root);
            ui.add_space(8.0);
            quality_section(st, ui, &root);
            ui.add_space(8.0);
            input_section(st, ui, &root);
            ui.add_space(8.0);
            refs_section(st, ui, &root);
        });
}

fn properties(st: &mut EditorState, ui: &mut Ui, root: &std::path::Path) {
    let scenes: Vec<String> = st.project_files(".scene.json");
    let mut apply = false;
    egui::CollapsingHeader::new(RichText::new("Project properties").strong())
        .default_open(true)
        .show(ui, |ui| {
            let Some(p) = st.project.as_mut() else { return };
            egui::Grid::new("proj-props")
                .num_columns(2)
                .spacing([12.0, 6.0])
                .show(ui, |ui| {
                    ui.label("Name");
                    ui.text_edit_singleline(&mut p.name);
                    ui.end_row();
                    ui.label("Start scene");
                    egui::ComboBox::from_id_salt("start-scene")
                        .selected_text(p.start_scene.clone())
                        .show_ui(ui, |ui| {
                            for s in &scenes {
                                ui.selectable_value(&mut p.start_scene, s.clone(), s);
                            }
                        });
                    ui.end_row();
                    ui.label("Game size");
                    ui.horizontal_wrapped(|ui| {
                        ui.add(egui::DragValue::new(&mut p.display.width).range(64..=8192));
                        ui.label("×");
                        ui.add(egui::DragValue::new(&mut p.display.height).range(64..=8192));
                        for (label, w, h) in [
                            ("Phone (portrait)", 360, 640),
                            ("Phone (landscape)", 640, 360),
                            ("Tablet", 1024, 768),
                            ("HD", 1280, 720),
                            ("Full HD", 1920, 1080),
                        ] {
                            if ui
                                .small_button(label)
                                .on_hover_text(format!("{w} × {h}"))
                                .clicked()
                            {
                                p.display.width = w;
                                p.display.height = h;
                            }
                        }
                    });
                    ui.end_row();
                    ui.label("Scaling");
                    egui::ComboBox::from_id_salt("scale-mode")
                        .selected_text(p.display.scale.clone())
                        .show_ui(ui, |ui| {
                            for (k, hint) in [
                                ("fit", "fit — whole game visible, letterboxed"),
                                ("fill", "fill — covers the window, edges cropped"),
                                ("stretch", "stretch — follows the window size"),
                                ("none", "none — fixed size"),
                            ] {
                                ui.selectable_value(&mut p.display.scale, k.to_string(), hint);
                            }
                        });
                    ui.end_row();
                    ui.label("Pixel art");
                    ui.checkbox(&mut p.display.pixel_art, "crisp pixels (no smoothing)");
                    ui.end_row();
                    ui.label("Background");
                    ui.text_edit_singleline(&mut p.display.background);
                    ui.end_row();
                    ui.label("Physics");
                    ui.horizontal(|ui| {
                        egui::ComboBox::from_id_salt("phys-engine")
                            .selected_text(p.physics.engine.clone())
                            .show_ui(ui, |ui| {
                                for k in ["arcade", "matter", "havok", "rapier", "none"] {
                                    ui.selectable_value(&mut p.physics.engine, k.to_string(), k);
                                }
                            });
                        ui.label("gravity Y");
                        ui.add(egui::DragValue::new(&mut p.physics.gravity[1]).speed(10.0));
                    });
                    ui.end_row();
                    let w = web(p);
                    let mut orient = w["pwa"]["orientation"]
                        .as_str()
                        .unwrap_or("any")
                        .to_string();
                    ui.label("Orientation");
                    egui::ComboBox::from_id_salt("orient")
                        .selected_text(orient.clone())
                        .show_ui(ui, |ui| {
                            for k in ["any", "landscape", "portrait"] {
                                ui.selectable_value(&mut orient, k.to_string(), k);
                            }
                        });
                    ui.end_row();
                    if orient != w["pwa"]["orientation"].as_str().unwrap_or("any") {
                        w["pwa"]["orientation"] = json!(orient);
                    }
                    for (label, key, hint) in [
                        ("Icon", "icon", "icon.png (used by PWA and apps)"),
                        ("Version", "version", "1.0.0"),
                    ] {
                        let mut v = w[key].as_str().unwrap_or("").to_string();
                        ui.label(label);
                        if ui
                            .add(egui::TextEdit::singleline(&mut v).hint_text(hint))
                            .changed()
                        {
                            w[key] = json!(v);
                        }
                        ui.end_row();
                    }
                });
            if ui.button("Apply project properties").clicked() {
                apply = true;
            }
        });
    if apply {
        if let Some(p) = &st.project {
            match nord_core::io::save_project(root, p) {
                Ok(()) => st.toast("Saved nord.project.json"),
                Err(e) => st.log(LogLevel::Error, e.to_string()),
            }
        }
    }
}

fn refs_section(st: &mut EditorState, ui: &mut Ui, root: &std::path::Path) {
    egui::CollapsingHeader::new(RichText::new("Find references, rename, replace").strong())
        .default_open(true)
        .show(ui, |ui| {
            let pu = &mut st.project_ui;
            ui.horizontal(|ui| {
                ui.add(
                    egui::TextEdit::singleline(&mut pu.find)
                        .hint_text("name or text to find…")
                        .desired_width(220.0),
                );
                ui.checkbox(&mut pu.whole_word, "whole word");
                if ui.button("Find all references").clicked() && !pu.find.is_empty() {
                    pu.hits = refs::find(root, &pu.find, pu.whole_word);
                    pu.pending = Pending::None;
                }
            });
            if !pu.hits.is_empty() {
                ui.weak(format!("{} hit(s)", pu.hits.len()));
                egui::ScrollArea::vertical()
                    .max_height(180.0)
                    .id_salt("hits")
                    .show(ui, |ui| {
                        for h in pu.hits.iter().take(300) {
                            ui.label(
                                RichText::new(format!("{}:{}  {}", h.file, h.line, h.text))
                                    .monospace()
                                    .small(),
                            );
                        }
                    });
            }
            ui.separator();
            ui.horizontal(|ui| {
                ui.label("Rename");
                ui.add(
                    egui::TextEdit::singleline(&mut pu.from)
                        .hint_text("object name or asset path")
                        .desired_width(200.0),
                );
                ui.label("to");
                ui.add(
                    egui::TextEdit::singleline(&mut pu.to)
                        .hint_text("new name / path")
                        .desired_width(200.0),
                );
            });
            let mut action: Option<Pending> = None;
            ui.horizontal(|ui| {
                if ui
                    .button("Preview object rename")
                    .on_hover_text("scenes, prefabs, event sheets (not scripts)")
                    .clicked()
                {
                    action = Some(Pending::Object);
                }
                if ui
                    .button("Preview asset rename")
                    .on_hover_text("moves the file and its .meta.json, rewrites quoted references")
                    .clicked()
                {
                    action = Some(Pending::Asset);
                }
                ui.add(
                    egui::TextEdit::singleline(&mut pu.replace_with)
                        .hint_text("replace Find text with…")
                        .desired_width(160.0),
                );
                if ui
                    .button("Preview replace")
                    .on_hover_text("replaces the Find text in every text file")
                    .clicked()
                {
                    action = Some(Pending::Replace);
                }
            });
            let (from, to, find, with, ww) = (
                pu.from.clone(),
                pu.to.clone(),
                pu.find.clone(),
                pu.replace_with.clone(),
                pu.whole_word,
            );
            if let Some(kind) = action {
                let r: Result<Vec<String>, String> = match kind {
                    Pending::Object => {
                        refs::rename_object(root, &from, &to, true).map_err(|e| e.to_string())
                    }
                    Pending::Asset => {
                        refs::rename_asset(root, &from, &to, true).map_err(|e| e.to_string())
                    }
                    Pending::Replace => refs::replace_all(root, &find, &with, ww, true)
                        .map(|v| v.into_iter().map(|(f, n)| format!("{f} ({n})")).collect())
                        .map_err(|e| e.to_string()),
                    Pending::None => Ok(vec![]),
                };
                match r {
                    Ok(list) => {
                        st.project_ui.preview = list;
                        st.project_ui.pending = kind;
                    }
                    Err(e) => {
                        st.project_ui.preview.clear();
                        st.project_ui.pending = Pending::None;
                        st.toast(e);
                    }
                }
            }
            let pu = &st.project_ui;
            if pu.pending != Pending::None {
                ui.separator();
                ui.strong(format!("{} file(s) would change:", pu.preview.len()));
                for f in &pu.preview {
                    ui.label(RichText::new(f).monospace().small());
                }
                if ui
                    .button("Apply (take a version-history snapshot first)")
                    .clicked()
                {
                    let kind = pu.pending;
                    let _ = nord_core::history::snapshot(root, "before project-wide edit");
                    let r = match kind {
                        Pending::Object => {
                            refs::rename_object(root, &from, &to, false).map(|v| v.len())
                        }
                        Pending::Asset => {
                            refs::rename_asset(root, &from, &to, false).map(|v| v.len())
                        }
                        Pending::Replace => {
                            refs::replace_all(root, &find, &with, ww, false).map(|v| v.len())
                        }
                        Pending::None => Ok(0),
                    };
                    match r {
                        Ok(n) => {
                            st.project_ui.pending = Pending::None;
                            st.project_ui.preview.clear();
                            st.reload_after_restore();
                            st.toast(format!("Changed {n} file(s). Undo with the History tab."));
                        }
                        Err(e) => st.log(LogLevel::Error, e.to_string()),
                    }
                }
            }
        });
}

/// Quality presets (must match `qualityPreset` in runtime/babylon/lighting.js): shadows, shadow map size, max lights per material, antialiasing, render scale, post-processing.
const QUALITY: [(&str, &str, i64, i64, bool, f64, bool); 4] = [
    ("low", "off", 512, 4, false, 0.75, false),
    ("medium", "hard", 1024, 4, true, 1.0, true),
    ("high", "soft", 1024, 8, true, 1.0, true),
    ("ultra", "soft", 2048, 12, true, 1.0, true),
];

fn quality_section(st: &mut EditorState, ui: &mut Ui, root: &std::path::Path) {
    let mut save = false;
    egui::CollapsingHeader::new(RichText::new("Quality and lighting").strong())
        .default_open(true)
        .show(ui, |ui| {
            if let Some(p) = st.project.as_mut() {
                let q = &mut p.quality;
                let level = q
                    .get("level")
                    .and_then(|v| v.as_str())
                    .unwrap_or("high")
                    .to_string();
                let pre = QUALITY.iter().find(|r| r.0 == level).unwrap_or(&QUALITY[2]);
                egui::Grid::new("quality")
                    .num_columns(2)
                    .spacing([12.0, 6.0])
                    .show(ui, |ui| {
                        ui.label("Quality level");
                        egui::ComboBox::from_id_salt("q-level")
                            .selected_text(level.clone())
                            .show_ui(ui, |ui| {
                                for r in QUALITY {
                                    if ui.selectable_label(level == r.0, r.0).clicked() {
                                        q.clear(); // a level is a preset: drop the overrides
                                        q.insert("level".into(), json!(r.0));
                                        save = true;
                                    }
                                }
                            });
                        ui.end_row();
                        let mut sh = q
                            .get("shadows")
                            .and_then(|v| v.as_str())
                            .unwrap_or(pre.1)
                            .to_string();
                        ui.label("Shadows");
                        egui::ComboBox::from_id_salt("q-sh")
                            .selected_text(sh.clone())
                            .show_ui(ui, |ui| {
                                for k in ["off", "hard", "soft"] {
                                    ui.selectable_value(&mut sh, k.to_string(), k);
                                }
                            });
                        if q.get("shadows").and_then(|v| v.as_str()).unwrap_or(pre.1) != sh {
                            q.insert("shadows".into(), json!(sh));
                            save = true;
                        }
                        ui.end_row();
                        let mut res = q
                            .get("shadowResolution")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(pre.2);
                        ui.label("Shadow resolution");
                        egui::ComboBox::from_id_salt("q-res")
                            .selected_text(res.to_string())
                            .show_ui(ui, |ui| {
                                for k in [256, 512, 1024, 2048, 4096] {
                                    ui.selectable_value(&mut res, k, k.to_string());
                                }
                            });
                        if q.get("shadowResolution")
                            .and_then(|v| v.as_i64())
                            .unwrap_or(pre.2)
                            != res
                        {
                            q.insert("shadowResolution".into(), json!(res));
                            save = true;
                        }
                        ui.end_row();
                        let mut ml = q.get("maxLights").and_then(|v| v.as_i64()).unwrap_or(pre.3);
                        ui.label("Lights per object");
                        if ui
                            .add(egui::DragValue::new(&mut ml).range(1..=16))
                            .changed()
                        {
                            q.insert("maxLights".into(), json!(ml));
                            save = true;
                        }
                        ui.end_row();
                        let mut aa = q
                            .get("antialiasing")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(pre.4);
                        ui.label("Anti-aliasing");
                        if ui.checkbox(&mut aa, "smooth edges (MSAA)").changed() {
                            q.insert("antialiasing".into(), json!(aa));
                            save = true;
                        }
                        ui.end_row();
                        let mut rs = q
                            .get("renderScale")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(pre.5);
                        ui.label("Render scale");
                        if ui.add(egui::Slider::new(&mut rs, 0.25..=1.0)).changed() {
                            q.insert("renderScale".into(), json!((rs * 100.0).round() / 100.0));
                            save = true;
                        }
                        ui.end_row();
                        let mut pp = q
                            .get("postProcessing")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(pre.6);
                        ui.label("Post-processing");
                        if ui.checkbox(&mut pp, "bloom, tonemap, vignette").changed() {
                            q.insert("postProcessing".into(), json!(pp));
                            save = true;
                        }
                        ui.end_row();
                    });
            }
            ui.separator();
            ui.label(RichText::new("Environment lighting (open scene)").strong());
            let (mut amb, mut on, mut k) = st
                .scene
                .as_ref()
                .map(|s| {
                    let c = s.settings.ambient.clone();
                    (
                        c.clone().unwrap_or_else(|| "#b8b8c8".into()),
                        c.is_some(),
                        s.settings
                            .extra
                            .get("ambientIntensity")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(1.0),
                    )
                })
                .unwrap_or_default();
            if st.scene.is_none() {
                ui.weak("Open a scene to edit its ambient light.");
            } else {
                let (before_amb, before_on, before_k) = (amb.clone(), on, k);
                ui.horizontal(|ui| {
                    ui.checkbox(&mut on, "Ambient colour");
                    ui.add_enabled(on, egui::TextEdit::singleline(&mut amb).desired_width(80.0));
                });
                ui.add_enabled(
                    on,
                    egui::Slider::new(&mut k, 0.0..=3.0).text("intensity (0 = dark)"),
                );
                ui.weak("Off: 3D scenes use only their own lights, 2D scenes a soft grey.");
                if (before_amb, before_on, before_k) != (amb.clone(), on, k) {
                    st.edit_scene("Scene ambient light", Some("ambient"), |s| {
                        s.settings.ambient = on.then(|| amb.clone());
                        s.settings.extra.insert("ambientIntensity".into(), json!(k));
                    });
                }
            }
            ui.weak(
                "Lights and shadows are set per light (Light component); see Manual: Lighting.",
            );
        });
    if save {
        if let Some(p) = &st.project {
            if let Err(e) = nord_core::io::save_project(root, p) {
                st.log(LogLevel::Error, e.to_string());
            }
        }
    }
}

/// egui key -> browser `KeyboardEvent.code` name used by the runtime (`A` -> `KeyA`, `Num1` -> `Digit1`).
fn key_code(k: egui::Key) -> String {
    let n = format!("{k:?}");
    match n.as_str() {
        s if s.len() == 1 && s.as_bytes()[0].is_ascii_uppercase() => format!("Key{s}"),
        s if s.len() == 4 && s.starts_with("Num") => format!("Digit{}", &s[3..]),
        _ => n,
    }
}

const EXTRA_INPUTS: &[&str] = &[
    "Mouse0",
    "Mouse1",
    "Mouse2",
    "Gamepad0",
    "Gamepad1",
    "Gamepad2",
    "Gamepad3",
    "ShiftLeft",
    "ControlLeft",
    "AltLeft",
];

/// Input editor: edit the project's action map (`input.actions`). New projects start with the basic map.
fn input_section(st: &mut EditorState, ui: &mut Ui, root: &std::path::Path) {
    let mut save = false;
    egui::CollapsingHeader::new(RichText::new("Input Manager (actions and keys)").strong())
        .default_open(true)
        .show(ui, |ui| {
            let Some(p) = st.project.as_mut() else { return };
            let pu = &mut st.project_ui;
            ui.weak("Scripts read these names: Input.GetButton('jump'), input.down('jump'). Raw keys always work too (Input.GetKey(KeyCode.Space)).");
            // key capture: the next key press goes to the armed action
            if let Some(name) = pu.capture.clone() {
                ui.colored_label(egui::Color32::YELLOW, format!("Press a key for '{name}'… (Esc cancels)"));
                let pressed = ui.input(|i| {
                    i.events.iter().find_map(|e| match e {
                        egui::Event::Key { key, pressed: true, .. } => Some(*key),
                        _ => None,
                    })
                });
                if let Some(k) = pressed {
                    if k != egui::Key::Escape {
                        let keys = p.input.actions.entry(name).or_default();
                        let c = key_code(k);
                        if !keys.contains(&c) {
                            keys.push(c);
                            save = true;
                        }
                    }
                    pu.capture = None;
                }
            }
            let names: Vec<String> = p.input.actions.keys().cloned().collect();
            let mut remove_action = None;
            egui::Grid::new("input-map")
                .num_columns(4)
                .striped(true)
                .spacing([14.0, 6.0])
                .show(ui, |ui| {
                    for h in ["Action", "Keys / buttons", "Add", ""] {
                        ui.label(RichText::new(h).small().weak());
                    }
                    ui.end_row();
                    for name in &names {
                        ui.label(
                            RichText::new(name)
                                .strong()
                                .color(egui::Color32::from_rgb(240, 190, 90)),
                        );
                        let keys = p.input.actions.get_mut(name).expect("listed above");
                        ui.horizontal_wrapped(|ui| {
                            let mut drop_key = None;
                            for (i, k) in keys.iter().enumerate() {
                                let c = if k.starts_with("Mouse") {
                                    egui::Color32::from_rgb(226, 88, 80)
                                } else if k.starts_with("Gamepad") {
                                    egui::Color32::from_rgb(112, 192, 72)
                                } else {
                                    egui::Color32::from_rgb(86, 148, 240)
                                };
                                ui.label(
                                    RichText::new(k)
                                        .color(c)
                                        .background_color(c.gamma_multiply(0.18)),
                                );
                                if crate::icons::mini(ui, "x", "Remove this key").clicked() {
                                    drop_key = Some(i);
                                }
                            }
                            if let Some(i) = drop_key {
                                keys.remove(i);
                                save = true;
                            }
                        });
                        ui.horizontal(|ui| {
                            if crate::icons::mini(ui, "plus", "Add a key, then press it").clicked() {
                                pu.capture = Some(name.clone());
                            }
                            egui::ComboBox::from_id_salt(("in-extra", name))
                                .selected_text("mouse/pad")
                                .width(90.0)
                                .show_ui(ui, |ui| {
                                    for e in EXTRA_INPUTS {
                                        if ui.selectable_label(false, *e).clicked()
                                            && !keys.iter().any(|k| k == e)
                                        {
                                            keys.push((*e).into());
                                            save = true;
                                        }
                                    }
                                });
                        });
                        if crate::icons::mini(ui, "trash-2", "Delete this action").clicked() {
                            remove_action = Some(name.clone());
                        }
                        ui.end_row();
                    }
                });
            if let Some(n) = remove_action {
                p.input.actions.remove(&n);
                save = true;
            }
            ui.horizontal(|ui| {
                ui.add(egui::TextEdit::singleline(&mut pu.new_action).hint_text("new action name").desired_width(140.0));
                let ok = !pu.new_action.trim().is_empty() && !p.input.actions.contains_key(pu.new_action.trim());
                if ui.add_enabled(ok, egui::Button::new("Add action")).clicked() {
                    let n = pu.new_action.trim().to_string();
                    p.input.actions.insert(n.clone(), vec![]);
                    pu.capture = Some(n);
                    pu.new_action.clear();
                    save = true;
                }
                if ui.button("Add missing basics").on_hover_text("left, right, up, down, jump, fire, interact: only the ones that are missing").clicked() {
                    save |= p.input.add_missing_basics() > 0;
                }
                if ui.button("Reset to basics").on_hover_text("Replace the whole map with the default one").clicked() {
                    p.input = nord_core::project::Input::basic();
                    save = true;
                }
            });
        });
    if save {
        if let Some(p) = &st.project {
            if let Err(e) = nord_core::io::save_project(root, p) {
                st.log(LogLevel::Error, e.to_string());
            }
        }
    }
}
