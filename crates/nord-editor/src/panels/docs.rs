//! Docs tab: offline HTML manual (docs/manual, served at /__docs/) in the webview when available; otherwise a built-in
//! Markdown viewer over docs/*.md.
use crate::state::EditorState;
use egui::{RichText, Ui};

#[derive(Default)]
pub struct DocsUi {
    pub file: Option<String>,
    pub text: String,
}

fn md_files(root: &std::path::Path) -> Vec<String> {
    let mut v: Vec<String> = std::fs::read_dir(root.join("docs"))
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".md"))
        .collect();
    v.sort();
    v
}

pub fn render_md(ui: &mut Ui, text: &str) {
    let mut in_code = false;
    for line in text.lines() {
        if line.trim_start().starts_with("```") {
            in_code = !in_code;
            continue;
        }
        if in_code {
            ui.label(RichText::new(line).monospace());
        } else if let Some(h) = line.strip_prefix("### ") {
            ui.label(RichText::new(h).strong());
        } else if let Some(h) = line.strip_prefix("## ") {
            ui.add_space(6.0);
            ui.heading(h);
        } else if let Some(h) = line.strip_prefix("# ") {
            ui.add_space(8.0);
            ui.heading(RichText::new(h).size(22.0));
        } else if let Some(b) = line.trim_start().strip_prefix("- ").or_else(|| line.trim_start().strip_prefix("* ")) {
            ui.horizontal_wrapped(|ui| {
                ui.label("•");
                ui.label(b.replace('`', ""));
            });
        } else if line.trim().is_empty() {
            ui.add_space(4.0);
        } else {
            ui.label(line.replace('`', "").replace("**", ""));
        }
    }
}

/// Returns the manual URL if the HTML manual exists (caller embeds it).
pub fn manual_url(st: &mut EditorState) -> Option<String> {
    let engine = st.engine_root.clone()?;
    if !engine.join("docs/manual/index.html").exists() {
        return None;
    }
    st.ensure_server().map(|b| format!("{b}/__docs/index.html"))
}

pub fn markdown_ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(engine) = st.engine_root.clone() else {
        ui.weak("Engine folder not found");
        return;
    };
    let files = md_files(&engine);
    egui::SidePanel::left("docs-list").default_width(170.0).show_inside(ui, |ui| {
        egui::ScrollArea::vertical().show(ui, |ui| {
            for f in &files {
                if ui.selectable_label(st.docs_ui.file.as_deref() == Some(f), f).clicked() {
                    st.docs_ui.text = std::fs::read_to_string(engine.join("docs").join(f)).unwrap_or_default();
                    st.docs_ui.file = Some(f.clone());
                }
            }
        });
    });
    egui::ScrollArea::vertical().auto_shrink([false; 2]).show(ui, |ui| {
        if st.docs_ui.file.is_none() {
            ui.heading("Nord Engine docs");
            ui.label("The HTML manual (docs/manual) is built in M7. Until then these are the design documents.");
        } else {
            render_md(ui, &st.docs_ui.text.clone());
        }
    });
}
