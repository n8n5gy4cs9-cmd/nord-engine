//! Project hub shown when no project is open: New (template picker), Open, Recent, Examples, Tutorials.
use crate::state::{Action, EditorState, LogLevel};
use egui::{RichText, Ui};
use nord_core::vfs::PathExt;
use nord_core::ProjectType;
use std::path::{Path, PathBuf};

pub struct HubUi {
    pub name: String,
    pub kind: ProjectType,
    /// starter template id from `templates/templates.json` (overrides `kind` when set)
    pub starter: Option<String>,
    pub parent: PathBuf,
    pub error: Option<String>,
    pub search: String,
    pub show_docs: bool,
    /// recent project awaiting delete confirmation
    pub confirm_delete: Option<PathBuf>,
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
            parent: if let Some(d) = crate::platform::default_projects_dir() {
                d
            } else if docs.v_exists() {
                docs.join("Nord Projects")
            } else {
                home.join("NordProjects")
            },
            error: None,
            search: String::new(),
            show_docs: false,
            confirm_delete: None,
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
    nord_core::vfs::create_dir_all(&dir).map_err(|e| e.to_string())?;
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
    let Ok(txt) = nord_core::vfs::read_to_string(root.join("templates/templates.json")) else {
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
    nord_core::vfs::create_dir_all(to)?;
    for e in nord_core::vfs::read_dir(from)? {
        let e = e?;
        let n = e.file_name();
        if matches!(
            n.to_string_lossy().as_ref(),
            ".nord-cache" | "dist" | ".git"
        ) {
            continue;
        }
        let (a, b) = (e.path(), to.join(&n));
        if a.v_is_dir() {
            copy_dir(&a, &b)?;
        } else {
            nord_core::vfs::copy(&a, &b)?;
        }
    }
    Ok(())
}

/// Open the current source; saved private copies are an explicit testing option.
pub fn open_example(src: &Path, use_cached_content: bool) -> Result<PathBuf, String> {
    if !src.join(nord_core::io::PROJECT_FILE).v_is_file() {
        return Err(format!("Example project not found: {}", src.display()));
    }
    if !use_cached_content {
        return Ok(src.to_path_buf());
    }
    let name = src.file_name().ok_or("bad example")?;
    let dst = nord_core::io::config_dir().join("examples").join(name);
    if !dst.v_exists() {
        copy_dir(src, &dst).map_err(|e| e.to_string())?;
        // Rust examples depend on the engine crates by relative path: point the private copy at the real checkout
        if let Some(root) = src.parent().and_then(Path::parent) {
            nord_core::project::retarget_engine_paths(&dst, root);
        }
    }
    Ok(dst)
}

/// Old Recent entries/launch paths may still point at the former saved example copies.
pub fn current_example_path(
    path: &Path,
    engine: Option<&Path>,
    use_cached_content: bool,
) -> PathBuf {
    if !use_cached_content {
        if let (Some(engine), Ok(relative)) = (
            engine,
            path.strip_prefix(nord_core::io::config_dir().join("examples")),
        ) {
            for base in [engine.join("examples"), engine.join("examples/tutorials")] {
                let current = base.join(relative);
                if current.join(nord_core::io::PROJECT_FILE).v_is_file() {
                    return current;
                }
            }
        }
    }
    path.to_path_buf()
}

fn list_projects(dir: &Path) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = nord_core::vfs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.join(nord_core::io::PROJECT_FILE).v_exists())
        .collect();
    v.sort();
    v
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    ui.add_space(24.0);
    let width = ui.available_width().min(1120.0);
    let height = ui.available_height();
    let gutter = ((ui.available_width() - width) * 0.5).max(0.0);
    ui.horizontal(|ui| {
        ui.add_space(gutter);
        ui.allocate_ui_with_layout(
            egui::vec2(width, height),
            egui::Layout::top_down(egui::Align::Min),
            |ui| {
                ui.horizontal(|ui| {
                    ui.add(
                        egui::Image::new(egui::include_image!(
                            "../../../../assets/brand/logo-mark-transparent.png"
                        ))
                        .fit_to_exact_size(egui::vec2(40.0, 40.0)),
                    );
                    ui.vertical(|ui| {
                        ui.label(RichText::new("Nord Engine").size(26.0).strong());
                        ui.weak("Your next game starts here.");
                    });
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.button("Open project…").clicked() {
                            st.push(Action::OpenProject);
                        }
                    });
                });
                ui.add_space(16.0);
                ui.columns(2, |cols| {
                    egui::ScrollArea::vertical()
                        .id_salt("hub-new")
                        .auto_shrink([false, false])
                        .show(&mut cols[0], |ui| {
                            card(ui, |ui| {
                                ui.heading("New project");
                                ui.weak("Choose a starting point, then make it yours.");
                                ui.add_space(10.0);
                                ui.label("Project name");
                                ui.add(
                                    egui::TextEdit::singleline(&mut st.hub.name)
                                        .desired_width(f32::INFINITY),
                                );
                                ui.label("Location");
                                ui.horizontal(|ui| {
                                    let mut location = st.hub.parent.to_string_lossy().into_owned();
                                    let field_width = (ui.available_width() - 48.0).max(80.0);
                                    if ui
                                        .add(
                                            egui::TextEdit::singleline(&mut location)
                                                .desired_width(field_width),
                                        )
                                        .changed()
                                    {
                                        st.hub.parent = location.into();
                                    }
                                    if ui
                                        .button("…")
                                        .on_hover_text("Choose project folder")
                                        .clicked()
                                    {
                                        if let Some(p) =
                                            crate::platform::pick_folder("Choose project folder")
                                        {
                                            st.hub.parent = p;
                                        }
                                    }
                                });
                                ui.add_space(10.0);
                                ui.strong("Project type");
                                for (kind, title, desc) in TEMPLATES {
                                    let selected = st.hub.starter.is_none() && st.hub.kind == kind;
                                    if ui
                                        .add_sized(
                                            [ui.available_width(), 30.0],
                                            egui::SelectableLabel::new(selected, title),
                                        )
                                        .on_hover_text(desc)
                                        .clicked()
                                    {
                                        st.hub.kind = kind;
                                        st.hub.starter = None;
                                    }
                                    if selected {
                                        ui.small(desc);
                                    }
                                }
                                let rows = st
                                    .engine_root
                                    .as_ref()
                                    .map(|r| starters(r))
                                    .unwrap_or_default();
                                if !rows.is_empty() {
                                    ui.add_space(6.0);
                                    egui::CollapsingHeader::new("Starter templates")
                                        .default_open(false)
                                        .show(ui, |ui| {
                                            for (id, title, desc, ty) in &rows {
                                                let selected =
                                                    st.hub.starter.as_deref() == Some(id.as_str());
                                                if ui
                                                    .selectable_label(
                                                        selected,
                                                        format!("{title}  ·  {ty}"),
                                                    )
                                                    .on_hover_text(desc)
                                                    .clicked()
                                                {
                                                    st.hub.starter = Some(id.clone());
                                                }
                                            }
                                        });
                                    if let Some(id) = &st.hub.starter {
                                        if let Some((_, title, desc, _)) =
                                            rows.iter().find(|r| &r.0 == id)
                                        {
                                            ui.strong(title);
                                            ui.small(desc);
                                        }
                                    }
                                }
                                ui.add_space(12.0);
                                if ui
                                    .add_sized(
                                        [ui.available_width(), 36.0],
                                        egui::Button::new("Create project")
                                            .fill(ui.visuals().selection.bg_fill),
                                    )
                                    .clicked()
                                {
                                    let parent = st.hub.parent.clone();
                                    let name = st.hub.name.clone();
                                    let starter =
                                        st.hub.starter.clone().or_else(|| match st.hub.kind {
                                            ProjectType::WasmGame => {
                                                Some("rust-2d-game".to_string())
                                            }
                                            ProjectType::WasmApp => {
                                                Some("rust-egui-app".to_string())
                                            }
                                            _ => None,
                                        });
                                    let res = match (&starter, &st.engine_root) {
                                        (Some(id), Some(root))
                                            if root.join("templates").join(id).v_exists() =>
                                        {
                                            create_starter(
                                                &parent,
                                                &name,
                                                &root.join("templates").join(id),
                                            )
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
                            });
                            ui.add_space(14.0);
                            ui.small("Crowelian 2026 + Sonnet");
                        });
                    egui::ScrollArea::vertical()
                        .id_salt("hub-lists")
                        .auto_shrink([false, false])
                        .show(&mut cols[1], |ui| {
                            card(ui, |ui| {
                                ui.heading("Recent projects");
                                let recent: Vec<_> = nord_core::io::recent_projects()
                                    .into_iter()
                                    .filter(|p| p.join(nord_core::io::PROJECT_FILE).v_exists())
                                    .take(8)
                                    .collect();
                                if recent.is_empty() {
                                    ui.weak("Projects you open will appear here.");
                                }
                                egui::ScrollArea::vertical()
                                    .id_salt("hub-recent")
                                    .max_height(150.0)
                                    .show(ui, |ui| {
                                        for p in recent {
                                            let name = project_name(&p);
                                            if st.hub.confirm_delete.as_ref() == Some(&p) {
                                                ui.horizontal_wrapped(|ui| {
                                                    ui.colored_label(
                                                        ui.visuals().error_fg_color,
                                                        format!("Permanently delete \"{name}\" and all its files?"),
                                                    );
                                                    if ui
                                                        .add(egui::Button::new(
                                                            RichText::new("Delete forever")
                                                                .color(egui::Color32::WHITE),
                                                        )
                                                        .fill(egui::Color32::from_rgb(190, 40, 40)))
                                                        .clicked()
                                                    {
                                                        st.hub.confirm_delete = None;
                                                        match nord_core::io::delete_recent_project(
                                                            &p,
                                                            st.engine_root.as_deref(),
                                                        ) {
                                                            Ok(()) => st.hub.error = None,
                                                            Err(e) => st.hub.error = Some(e.to_string()),
                                                        }
                                                    }
                                                    if ui.button("Cancel").clicked() {
                                                        st.hub.confirm_delete = None;
                                                    }
                                                });
                                                continue;
                                            }
                                            ui.horizontal(|ui| {
                                                let w = (ui.available_width() - 34.0).max(40.0);
                                                if ui
                                                    .scope(|ui| {
                                                        ui.set_width(w);
                                                        project_row(ui, &name, &p.display().to_string())
                                                    })
                                                    .inner
                                                    .clicked()
                                                {
                                                    st.push(Action::OpenPath(p.clone()));
                                                }
                                                if ui
                                                    .add(egui::Button::new(
                                                        RichText::new("🗑").color(egui::Color32::WHITE),
                                                    )
                                                    .fill(egui::Color32::from_rgb(190, 40, 40)))
                                                    .on_hover_text("Delete this project…")
                                                    .clicked()
                                                {
                                                    st.hub.confirm_delete = Some(p.clone());
                                                }
                                            });
                                        }
                                    });
                            });
                            ui.add_space(12.0);
                            card(ui, |ui| {
                                ui.heading("Explore & learn");
                                ui.weak("Playable examples and guided tutorials.");
                                ui.add_space(8.0);
                                ui.add(
                                    egui::TextEdit::singleline(&mut st.hub.search)
                                        .hint_text("Search examples and tutorials…")
                                        .desired_width(f32::INFINITY),
                                );
                                let query = st.hub.search.to_lowercase();
                                let ex = st
                                    .engine_root
                                    .as_ref()
                                    .map(|r| list_projects(&r.join("examples")))
                                    .unwrap_or_default();
                                ui.add_space(8.0);
                                ui.strong("Examples");
                                let mut count = 0;
                                for p in ex {
                                    let name = project_name(&p);
                                    if !name.to_lowercase().contains(&query) {
                                        continue;
                                    }
                                    count += 1;
                                    let hint = if st.settings.use_cached_content {
                                        "Open saved example copy"
                                    } else {
                                        "Open current example files"
                                    };
                                    if project_row(ui, &name, hint).clicked() {
                                        open_sample(st, &p);
                                    }
                                }
                                if count == 0 {
                                    ui.weak("No matching examples");
                                }
                                ui.add_space(10.0);
                                egui::CollapsingHeader::new("Tutorials")
                                    .default_open(true)
                                    .show(ui, |ui| {
                                        let tutorials = st
                                            .engine_root
                                            .as_ref()
                                            .map(|r| list_projects(&r.join("examples/tutorials")))
                                            .unwrap_or_default();
                                        if tutorials.is_empty() {
                                            ui.weak("Find guided tutorials in Documentation.");
                                        }
                                        for p in tutorials {
                                            let name = project_name(&p);
                                            if name.to_lowercase().contains(&query)
                                                && project_row(ui, &name, "Open tutorial").clicked()
                                            {
                                                open_sample(st, &p);
                                            }
                                        }
                                        if ui.button("Documentation").clicked() {
                                            st.push(Action::ShowTab(crate::app::Tab::Docs));
                                        }
                                    });
                            });
                        });
                });
            },
        );
    });
}

fn card(ui: &mut Ui, content: impl FnOnce(&mut Ui)) {
    egui::Frame::new()
        .fill(ui.visuals().panel_fill)
        .stroke(ui.visuals().window_stroke)
        .corner_radius(10)
        .inner_margin(18)
        .show(ui, |ui| {
            ui.set_min_width(ui.available_width());
            content(ui);
        });
}

fn project_name(path: &Path) -> String {
    path.file_name()
        .map_or(String::new(), |n| n.to_string_lossy().into_owned())
}

fn project_row(ui: &mut Ui, name: &str, hint: &str) -> egui::Response {
    let (rect, response) =
        ui.allocate_exact_size(egui::vec2(ui.available_width(), 32.0), egui::Sense::click());
    response
        .widget_info(|| egui::WidgetInfo::labeled(egui::WidgetType::Button, ui.is_enabled(), name));
    if ui.is_rect_visible(rect) {
        let visuals = ui.style().interact(&response);
        if response.hovered() || response.has_focus() {
            ui.painter().rect_filled(rect, 5, visuals.bg_fill);
        }
        crate::icons::icon("folder", 16.0, ui.visuals().weak_text_color()).paint_at(
            ui,
            egui::Rect::from_center_size(
                egui::pos2(rect.left() + 18.0, rect.center().y),
                egui::vec2(16.0, 16.0),
            ),
        );
        let text = ui.painter().layout(
            name.into(),
            egui::TextStyle::Body.resolve(ui.style()),
            visuals.fg_stroke.color,
            (rect.width() - 44.0).max(20.0),
        );
        ui.painter().with_clip_rect(rect).galley(
            egui::pos2(rect.left() + 36.0, rect.center().y - text.size().y * 0.5),
            text,
            visuals.fg_stroke.color,
        );
    }
    response
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .on_hover_text(hint)
}

fn open_sample(st: &mut EditorState, path: &Path) {
    match open_example(path, st.settings.use_cached_content) {
        Ok(dir) => st.push(Action::OpenPath(dir)),
        Err(e) => st.log(LogLevel::Error, e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn example_opens_current_source_after_assets_change() {
        let src = std::env::temp_dir()
            .join(format!("nord-example-current-{}", std::process::id()))
            .join("example");
        nord_core::vfs::create_dir_all(src.join("assets")).unwrap();
        nord_core::vfs::write(src.join("nord.project.json"), "{}").unwrap();
        let asset = src.join("assets/hero.png");
        nord_core::vfs::write(&asset, b"old art").unwrap();
        let first = open_example(&src, false).unwrap();
        assert_eq!(
            nord_core::vfs::read(first.join("assets/hero.png")).unwrap(),
            b"old art"
        );
        nord_core::vfs::write(&asset, b"new art").unwrap();
        let reopened = open_example(&src, false).unwrap();
        assert_eq!(
            nord_core::vfs::read(reopened.join("assets/hero.png")).unwrap(),
            b"new art"
        );
        assert_eq!(reopened, src);
    }

    #[test]
    fn cached_example_reuse_is_opt_in() {
        let src = std::env::temp_dir()
            .join(format!("nord-example-opt-in-{}", std::process::id()))
            .join(format!("cached-example-{}", std::process::id()));
        nord_core::vfs::create_dir_all(&src).unwrap();
        nord_core::vfs::write(src.join("nord.project.json"), "{}").unwrap();
        nord_core::vfs::write(src.join("hero.png"), b"old art").unwrap();
        let previous = nord_core::io::config_dir()
            .join("examples")
            .join(src.file_name().unwrap());
        if previous.v_exists() {
            nord_core::vfs::remove_dir_all(&previous).unwrap();
        }
        let copy = open_example(&src, true).unwrap();
        assert_ne!(copy, src);
        nord_core::vfs::write(src.join("hero.png"), b"new art").unwrap();
        assert_eq!(open_example(&src, true).unwrap(), copy);
        assert_eq!(
            nord_core::vfs::read(copy.join("hero.png")).unwrap(),
            b"old art"
        );
        assert_eq!(open_example(&src, false).unwrap(), src);
        nord_core::vfs::remove_dir_all(copy).unwrap();
    }

    #[test]
    fn cached_content_defaults_off_and_saved_setting_roundtrips() {
        let old: crate::state::Settings = serde_json::from_str("{}").unwrap();
        assert!(!old.use_cached_content);
        assert!(!crate::state::Settings::default().use_cached_content);
        let enabled = crate::state::Settings {
            use_cached_content: true,
            ..Default::default()
        };
        let loaded: crate::state::Settings =
            serde_json::from_str(&serde_json::to_string(&enabled).unwrap()).unwrap();
        assert!(loaded.use_cached_content);
    }

    #[test]
    fn old_recent_example_paths_resolve_to_current_bundle_by_default() {
        let engine =
            std::env::temp_dir().join(format!("nord-example-bundle-{}", std::process::id()));
        let current = engine.join("examples/noom");
        nord_core::vfs::create_dir_all(&current).unwrap();
        nord_core::vfs::write(current.join("nord.project.json"), "{}").unwrap();
        let old = nord_core::io::config_dir().join("examples/noom");
        assert_eq!(current_example_path(&old, Some(&engine), false), current);
        assert_eq!(current_example_path(&old, Some(&engine), true), old);
        let own = engine.join("my-game");
        assert_eq!(current_example_path(&own, Some(&engine), false), own);
    }

    #[test]
    fn creates_each_template() {
        let base = std::env::temp_dir().join(format!("nord-hub-{}", std::process::id()));
        for (k, t, _) in TEMPLATES {
            let d = create_project(&base, t, k).unwrap();
            assert!(d.join("nord.project.json").v_exists(), "{t}");
        }
        assert!(create_project(&base, "bad/name", ProjectType::TwoD).is_err());
        assert!(
            create_project(&base, "2D game", ProjectType::TwoD).is_err(),
            "already exists"
        );
    }
}
