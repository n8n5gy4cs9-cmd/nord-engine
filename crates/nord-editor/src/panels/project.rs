//! Project tab (M10-25): project properties, find all references, safe rename (assets, objects), project-wide replace.
//! Logic lives in `nord_core::refs`; every rename/replace shows a dry-run list first.
use crate::state::{EditorState, LogLevel};
use egui::{RichText, Ui};
use nord_core::{assets::AssetType, refs};
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
}

fn web(p: &mut nord_core::Project) -> &mut Value {
    p.export.entry("web").or_insert_with(|| json!({}))
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
    egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
        properties(st, ui, &root);
        ui.add_space(8.0);
        refs_section(st, ui, &root);
    });
}

fn properties(st: &mut EditorState, ui: &mut Ui, root: &std::path::Path) {
    let scenes: Vec<String> = st.assets.iter().filter(|a| a.kind == AssetType::Scene).map(|a| a.path.clone()).collect();
    let mut apply = false;
    egui::CollapsingHeader::new(RichText::new("Project properties").strong()).default_open(true).show(ui, |ui| {
        let Some(p) = st.project.as_mut() else { return };
        egui::Grid::new("proj-props").num_columns(2).spacing([12.0, 6.0]).show(ui, |ui| {
            ui.label("Name");
            ui.text_edit_singleline(&mut p.name);
            ui.end_row();
            ui.label("Start scene");
            egui::ComboBox::from_id_salt("start-scene").selected_text(p.start_scene.clone()).show_ui(ui, |ui| {
                for s in &scenes {
                    ui.selectable_value(&mut p.start_scene, s.clone(), s);
                }
            });
            ui.end_row();
            ui.label("Game size");
            ui.horizontal(|ui| {
                ui.add(egui::DragValue::new(&mut p.display.width).range(64..=8192));
                ui.label("×");
                ui.add(egui::DragValue::new(&mut p.display.height).range(64..=8192));
            });
            ui.end_row();
            ui.label("Scaling");
            egui::ComboBox::from_id_salt("scale-mode").selected_text(p.display.scale.clone()).show_ui(ui, |ui| {
                for (k, hint) in [("fit", "fit — whole game visible, letterboxed"), ("fill", "fill — covers the window, edges cropped"), ("stretch", "stretch — follows the window size"), ("none", "none — fixed size")] {
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
                egui::ComboBox::from_id_salt("phys-engine").selected_text(p.physics.engine.clone()).show_ui(ui, |ui| {
                    for k in ["arcade", "matter", "havok", "rapier", "none"] {
                        ui.selectable_value(&mut p.physics.engine, k.to_string(), k);
                    }
                });
                ui.label("gravity Y");
                ui.add(egui::DragValue::new(&mut p.physics.gravity[1]).speed(10.0));
            });
            ui.end_row();
            let w = web(p);
            let mut orient = w["pwa"]["orientation"].as_str().unwrap_or("any").to_string();
            ui.label("Orientation");
            egui::ComboBox::from_id_salt("orient").selected_text(orient.clone()).show_ui(ui, |ui| {
                for k in ["any", "landscape", "portrait"] {
                    ui.selectable_value(&mut orient, k.to_string(), k);
                }
            });
            ui.end_row();
            if orient != w["pwa"]["orientation"].as_str().unwrap_or("any") {
                w["pwa"]["orientation"] = json!(orient);
            }
            for (label, key, hint) in [("Icon", "icon", "icon.png (used by PWA and apps)"), ("Version", "version", "1.0.0")] {
                let mut v = w[key].as_str().unwrap_or("").to_string();
                ui.label(label);
                if ui.add(egui::TextEdit::singleline(&mut v).hint_text(hint)).changed() {
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
    egui::CollapsingHeader::new(RichText::new("Find references, rename, replace").strong()).default_open(true).show(ui, |ui| {
        let pu = &mut st.project_ui;
        ui.horizontal(|ui| {
            ui.add(egui::TextEdit::singleline(&mut pu.find).hint_text("name or text to find…").desired_width(220.0));
            ui.checkbox(&mut pu.whole_word, "whole word");
            if ui.button("Find all references").clicked() && !pu.find.is_empty() {
                pu.hits = refs::find(root, &pu.find, pu.whole_word);
                pu.pending = Pending::None;
            }
        });
        if !pu.hits.is_empty() {
            ui.weak(format!("{} hit(s)", pu.hits.len()));
            egui::ScrollArea::vertical().max_height(180.0).id_salt("hits").show(ui, |ui| {
                for h in pu.hits.iter().take(300) {
                    ui.label(RichText::new(format!("{}:{}  {}", h.file, h.line, h.text)).monospace().small());
                }
            });
        }
        ui.separator();
        ui.horizontal(|ui| {
            ui.label("Rename");
            ui.add(egui::TextEdit::singleline(&mut pu.from).hint_text("object name or asset path").desired_width(200.0));
            ui.label("→");
            ui.add(egui::TextEdit::singleline(&mut pu.to).hint_text("new name / path").desired_width(200.0));
        });
        let mut action: Option<Pending> = None;
        ui.horizontal(|ui| {
            if ui.button("Preview object rename").on_hover_text("scenes, prefabs, event sheets (not scripts)").clicked() {
                action = Some(Pending::Object);
            }
            if ui.button("Preview asset rename").on_hover_text("moves the file and its .meta.json, rewrites quoted references").clicked() {
                action = Some(Pending::Asset);
            }
            ui.add(egui::TextEdit::singleline(&mut pu.replace_with).hint_text("replace Find text with…").desired_width(160.0));
            if ui.button("Preview replace").on_hover_text("replaces the Find text in every text file").clicked() {
                action = Some(Pending::Replace);
            }
        });
        let (from, to, find, with, ww) = (pu.from.clone(), pu.to.clone(), pu.find.clone(), pu.replace_with.clone(), pu.whole_word);
        if let Some(kind) = action {
            let r: Result<Vec<String>, String> = match kind {
                Pending::Object => refs::rename_object(root, &from, &to, true).map_err(|e| e.to_string()),
                Pending::Asset => refs::rename_asset(root, &from, &to, true).map_err(|e| e.to_string()),
                Pending::Replace => refs::replace_all(root, &find, &with, ww, true).map(|v| v.into_iter().map(|(f, n)| format!("{f} ({n})")).collect()).map_err(|e| e.to_string()),
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
            if ui.button("Apply (take a version-history snapshot first)").clicked() {
                let kind = pu.pending;
                let _ = nord_core::history::snapshot(root, "before project-wide edit");
                let r = match kind {
                    Pending::Object => refs::rename_object(root, &from, &to, false).map(|v| v.len()),
                    Pending::Asset => refs::rename_asset(root, &from, &to, false).map(|v| v.len()),
                    Pending::Replace => refs::replace_all(root, &find, &with, ww, false).map(|v| v.len()),
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
