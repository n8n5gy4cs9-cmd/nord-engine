//! Build Settings (Unity-style): scenes in the build, start scene, platform list, Build / Build And Run.
//! "In build" is stored in `nord.project.json` as `export.excludeScenes` (scenes not listed there ship); the exporter drops excluded files.
use crate::state::EditorState;
use serde_json::{json, Value};
use std::path::Path;

#[derive(Default)]
pub struct BuildUi {
    pub open: bool,
    /// open the exported page in the browser when the next export finishes
    pub run_after: bool,
}

fn scenes(root: &Path) -> Vec<String> {
    fn walk(dir: &Path, root: &Path, out: &mut Vec<String>, depth: u8) {
        let Ok(rd) = nord_core::vfs::read_dir(dir) else {
            return;
        };
        for e in rd.flatten() {
            let p = e.path();
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') || matches!(name.as_str(), "dist" | "target" | "node_modules")
            {
                continue;
            }
            if nord_core::vfs::metadata(&p).is_ok_and(|m| m.is_dir()) {
                if depth < 4 {
                    walk(&p, root, out, depth + 1);
                }
            } else if name.ends_with(".scene.json") {
                if let Ok(r) = p.strip_prefix(root) {
                    out.push(r.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    let mut out = vec![];
    walk(root, root, &mut out, 0);
    out.sort();
    out
}

fn excluded(st: &EditorState) -> Vec<String> {
    st.project
        .as_ref()
        .and_then(|p| p.export.get("excludeScenes"))
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|s| s.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

fn save(st: &mut EditorState) {
    if let (Some(root), Some(p)) = (st.root.clone(), st.project.as_ref()) {
        if let Err(e) = nord_core::io::save_project(&root, p) {
            st.toast(format!("Could not save the project: {e}"));
        }
    }
}

pub fn window(st: &mut EditorState, ctx: &egui::Context) {
    if !st.build_ui.open {
        return;
    }
    let mut open = true;
    let mut build: Option<bool> = None;
    let mut mobile_build = false;
    egui::Window::new("Build Settings")
        .open(&mut open)
        .default_width(520.0)
        .show(ctx, |ui| {
            let (Some(root), true) = (st.root.clone(), st.project.is_some()) else {
                ui.weak("Open a project first");
                return;
            };
            ui.strong("Scenes in Build");
            let list = scenes(&root);
            let mut ex = excluded(st);
            let start = st
                .project
                .as_ref()
                .map(|p| p.start_scene.clone())
                .unwrap_or_default();
            let mut new_start: Option<String> = None;
            let mut changed = false;
            egui::ScrollArea::vertical()
                .max_height(180.0)
                .show(ui, |ui| {
                    for s in &list {
                        ui.horizontal(|ui| {
                            let mut inb = !ex.contains(s) || *s == start;
                            if ui
                                .add_enabled(*s != start, egui::Checkbox::new(&mut inb, ""))
                                .changed()
                            {
                                if inb {
                                    ex.retain(|x| x != s);
                                } else {
                                    ex.push(s.clone());
                                }
                                changed = true;
                            }
                            if ui
                                .radio(*s == start, s)
                                .on_hover_text("Start scene")
                                .clicked()
                            {
                                new_start = Some(s.clone());
                            }
                        });
                    }
                    if list.is_empty() {
                        ui.weak("No *.scene.json files found");
                    }
                });
            ui.weak(
                "Radio = start scene (always built). Unchecked scenes are left out of the export.",
            );
            if changed || new_start.is_some() {
                if let Some(p) = st.project.as_mut() {
                    if let Some(s) = new_start {
                        ex.retain(|x| *x != s);
                        p.start_scene = s;
                    }
                    if ex.is_empty() {
                        p.export.remove("excludeScenes");
                    } else {
                        p.export.insert("excludeScenes".into(), json!(ex));
                    }
                }
                save(st);
            }
            ui.separator();
            ui.strong("Platform");
            egui::Grid::new("platforms")
                .num_columns(3)
                .spacing([12.0, 6.0])
                .show(ui, |ui| {
                    ui.label("Web (HTML5)");
                    ui.weak("static folder / single file");
                    ui.horizontal(|ui| {
                        if ui.button("Build").clicked() {
                            build = Some(false);
                        }
                        if ui.button("Build And Run").clicked() {
                            build = Some(true);
                        }
                    });
                    ui.end_row();
                    ui.label("macOS / Windows / Linux");
                    ui.weak("desktop app (permissions, icon)");
                    if ui.button("Desktop app…").clicked() {
                        st.desktop_ui.open = true;
                    }
                    ui.end_row();
                    ui.label("Android / iOS");
                    ui.weak("Capacitor project (dist/mobile)");
                    if ui
                        .button("Mobile project")
                        .on_hover_text("Builds the game into dist/mobile/www and writes a Capacitor wrapper; README-MOBILE.md lists `npx cap add android|ios`")
                        .clicked()
                    {
                        st.export_ui.mobile = true;
                        mobile_build = true;
                    }
                    ui.end_row();
                });
            ui.separator();
            if ui.button("More export options…").clicked() {
                st.export_ui.open = true;
            }
        });
    if mobile_build {
        crate::panels::export::start(st);
    }
    if let Some(run) = build {
        st.build_ui.run_after = run;
        if run {
            st.export_ui.single_file = true; // opens from file://
        }
        crate::panels::export::start(st);
    }
    if !open {
        st.build_ui.open = false;
    }
}
