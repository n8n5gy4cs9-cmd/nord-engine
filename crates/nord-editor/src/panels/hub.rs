//! Project hub shown when no project is open: New (template picker), Open, Recent, Examples, Tutorials.
use crate::state::{Action, EditorState, LogLevel};
use egui::{RichText, Ui};
use nord_core::ProjectType;
use std::path::{Path, PathBuf};

pub struct HubUi {
    pub name: String,
    pub kind: ProjectType,
    /// starter template id from `templates/templates.json` (overrides `kind` when set)
    pub starter: Option<String>,
    pub parent: PathBuf,
    pub error: Option<String>,
}

impl Default for HubUi {
    fn default() -> Self {
        let home = std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_default();
        let docs = home.join("Documents");
        Self {
            name: "My Game".into(),
            kind: ProjectType::TwoD,
            starter: None,
            parent: if docs.exists() {
                docs.join("Nord Projects")
            } else {
                home.join("NordProjects")
            },
            error: None,
        }
    }
}

pub const TEMPLATES: [(ProjectType, &str, &str); 5] = [
    (
        ProjectType::TwoD,
        "2D game",
        "Phaser 2D — sprites, tilemaps, arcade physics",
    ),
    (
        ProjectType::ThreeD,
        "3D game",
        "Babylon.js 3D + Havok physics",
    ),
    (
        ProjectType::Html,
        "HTML-lite",
        "Plain HTML/JS page with the tiny nord-lite runtime",
    ),
    (
        ProjectType::WasmGame,
        "Rust game (WASM)",
        "Rust runtime compiled to WebAssembly (M5)",
    ),
    (
        ProjectType::WasmApp,
        "Rust app (WASM)",
        "egui app in the browser (M5)",
    ),
];

pub fn create_project(parent: &Path, name: &str, kind: ProjectType) -> Result<PathBuf, String> {
    let name = name.trim();
    if name.is_empty() || name.contains(['/', '\\']) {
        return Err("Enter a project name (no slashes)".into());
    }
    let dir = parent.join(name);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    nord_core::project::create(&dir, kind).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Create a project from a starter folder (`templates/<id>`).
pub fn create_starter(parent: &Path, name: &str, src: &Path) -> Result<PathBuf, String> {
    let name = name.trim();
    if name.is_empty() || name.contains(['/', '\\']) {
        return Err("Enter a project name (no slashes)".into());
    }
    let dir = parent.join(name);
    nord_core::project::create_from_template(src, &dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// `(id, title, description, type)` rows of `templates/templates.json` (empty when the engine ships none).
pub fn starters(root: &Path) -> Vec<(String, String, String, String)> {
    let Ok(txt) = std::fs::read_to_string(root.join("templates/templates.json")) else {
        return vec![];
    };
    let Ok(v) = serde_json::from_str::<Vec<serde_json::Value>>(&txt) else {
        return vec![];
    };
    let g = |x: &serde_json::Value, k: &str| x[k].as_str().unwrap_or("").to_string();
    v.iter()
        .map(|x| (g(x, "id"), g(x, "title"), g(x, "description"), g(x, "type")))
        .collect()
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for e in std::fs::read_dir(from)? {
        let e = e?;
        let n = e.file_name();
        if matches!(
            n.to_string_lossy().as_ref(),
            ".nord-cache" | "dist" | ".git"
        ) {
            continue;
        }
        let (a, b) = (e.path(), to.join(&n));
        if a.is_dir() {
            copy_dir(&a, &b)?;
        } else {
            std::fs::copy(&a, &b)?;
        }
    }
    Ok(())
}

/// Examples are opened as a private copy under the config dir so the engine folder stays clean.
pub fn open_example(src: &Path) -> Result<PathBuf, String> {
    let name = src.file_name().ok_or("bad example")?;
    let dst = nord_core::io::config_dir().join("examples").join(name);
    if !dst.exists() {
        copy_dir(src, &dst).map_err(|e| e.to_string())?;
        // Rust examples depend on the engine crates by relative path: point the private copy at the real checkout
        if let Some(root) = src.parent().and_then(Path::parent) {
            nord_core::project::retarget_engine_paths(&dst, root);
        }
    }
    Ok(dst)
}

fn list_projects(dir: &Path) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.join(nord_core::io::PROJECT_FILE).exists())
        .collect();
    v.sort();
    v
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    ui.add_space(24.0);
    ui.vertical_centered(|ui| {
        ui.add(
            egui::Image::new(egui::include_image!(
                "../../../../assets/brand/logo-256.png"
            ))
            .max_height(96.0),
        );
        ui.label(RichText::new("Nord Engine").size(28.0).strong());
        ui.weak("Crowelian 2026 + Sonnet");
    });
    ui.add_space(16.0);
    ui.columns(2, |cols| {
        let ui = &mut cols[0];
        ui.heading("New project");
        egui::Grid::new("newproj").num_columns(2).show(ui, |ui| {
            ui.label("Name");
            ui.text_edit_singleline(&mut st.hub.name);
            ui.end_row();
            ui.label("Location");
            ui.horizontal(|ui| {
                let mut s = st.hub.parent.to_string_lossy().into_owned();
                if ui
                    .add(egui::TextEdit::singleline(&mut s).desired_width(220.0))
                    .changed()
                {
                    st.hub.parent = s.into();
                }
                if ui.button("…").clicked() {
                    if let Some(p) = rfd::FileDialog::new().pick_folder() {
                        st.hub.parent = p;
                    }
                }
            });
            ui.end_row();
        });
        ui.add_space(4.0);
        for (k, title, desc) in TEMPLATES {
            let sel = st.hub.starter.is_none() && st.hub.kind == k;
            let r = ui.selectable_label(sel, RichText::new(title).strong());
            if r.clicked() {
                st.hub.kind = k;
                st.hub.starter = None;
            }
            ui.indent(title, |ui| ui.weak(desc));
        }
        let rows = st
            .engine_root
            .as_ref()
            .map(|r| starters(r))
            .unwrap_or_default();
        if !rows.is_empty() {
            ui.add_space(6.0);
            ui.label(RichText::new("Starter templates").strong());
            for (id, title, desc, ty) in &rows {
                let sel = st.hub.starter.as_deref() == Some(id.as_str());
                if ui
                    .selectable_label(sel, format!("{title}  ·  {ty}"))
                    .on_hover_text(desc)
                    .clicked()
                {
                    st.hub.starter = Some(id.clone());
                }
                if sel {
                    ui.indent(id, |ui| ui.weak(desc));
                }
            }
        }
        if ui.button("Create project").clicked() {
            let parent = st.hub.parent.clone();
            let name = st.hub.name.clone();
            // Rust project types start from their template folder (Cargo.toml + src/main.rs + scene) when the engine ships it
            let starter = st.hub.starter.clone().or_else(|| match st.hub.kind {
                ProjectType::WasmGame => Some("rust-2d-game".to_string()),
                ProjectType::WasmApp => Some("rust-egui-app".to_string()),
                _ => None,
            });
            let res = match (&starter, &st.engine_root) {
                (Some(id), Some(root)) if root.join("templates").join(id).exists() => {
                    create_starter(&parent, &name, &root.join("templates").join(id))
                }
                _ => create_project(&parent, &name, st.hub.kind),
            };
            match res {
                Ok(dir) => {
                    st.hub.error = None;
                    st.push(Action::OpenPath(dir));
                }
                Err(e) => st.hub.error = Some(e),
            }
        }
        if let Some(e) = &st.hub.error {
            ui.colored_label(ui.visuals().error_fg_color, e);
        }
        ui.add_space(12.0);
        if ui.button("Open project…").clicked() {
            st.push(Action::OpenProject);
        }

        let ui = &mut cols[1];
        ui.heading("Recent");
        let recent = nord_core::io::recent_projects();
        if recent.is_empty() {
            ui.weak("Nothing yet");
        }
        for p in recent
            .iter()
            .filter(|p| p.join(nord_core::io::PROJECT_FILE).exists())
            .take(8)
        {
            if ui
                .link(format!(
                    "{}  —  {}",
                    p.file_name()
                        .map_or(String::new(), |n| n.to_string_lossy().into_owned()),
                    p.display()
                ))
                .clicked()
            {
                st.push(Action::OpenPath(p.clone()));
            }
        }
        ui.add_space(10.0);
        ui.heading("Examples");
        let ex = st
            .engine_root
            .as_ref()
            .map(|r| list_projects(&r.join("examples")))
            .unwrap_or_default();
        if ex.is_empty() {
            ui.weak("No examples found");
        }
        for p in ex {
            let n = p
                .file_name()
                .map_or(String::new(), |n| n.to_string_lossy().into_owned());
            if ui.link(&n).on_hover_text("Opens a private copy").clicked() {
                match open_example(&p) {
                    Ok(d) => st.push(Action::OpenPath(d)),
                    Err(e) => st.log(LogLevel::Error, e),
                }
            }
        }
        ui.add_space(10.0);
        ui.heading("Tutorials");
        let tut = st
            .engine_root
            .as_ref()
            .map(|r| list_projects(&r.join("examples/tutorials")))
            .unwrap_or_default();
        if tut.is_empty() {
            ui.weak("Tutorials ship with the manual (M7)");
        }
        for p in tut {
            let n = p
                .file_name()
                .map_or(String::new(), |n| n.to_string_lossy().into_owned());
            if ui.link(&n).clicked() {
                if let Ok(d) = open_example(&p) {
                    st.push(Action::OpenPath(d));
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_each_template() {
        let base = std::env::temp_dir().join(format!("nord-hub-{}", std::process::id()));
        for (k, t, _) in TEMPLATES {
            let d = create_project(&base, t, k).unwrap();
            assert!(d.join("nord.project.json").exists(), "{t}");
        }
        assert!(create_project(&base, "bad/name", ProjectType::TwoD).is_err());
        assert!(
            create_project(&base, "2D game", ProjectType::TwoD).is_err(),
            "already exists"
        );
    }
}
