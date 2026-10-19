//! Version history panel (M10-31): snapshots of the project's source files, diff against the working tree, restore.
use crate::state::{EditorState, LogLevel};
use egui::{Color32, RichText, Ui};
use nord_core::history::{self, Change};

#[derive(Default)]
pub struct HistoryUi {
    pub label: String,
    pub selected: Option<String>,
    pub file: Option<String>,
    pub confirm_restore: bool,
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
    ui.horizontal(|ui| {
        ui.add(egui::TextEdit::singleline(&mut st.history_ui.label).hint_text("label (optional)").desired_width(200.0));
        if ui.button("Snapshot now").clicked() {
            let l = if st.history_ui.label.trim().is_empty() { "manual" } else { st.history_ui.label.trim() }.to_string();
            match history::snapshot(&root, &l) {
                Ok(id) => {
                    st.history_ui.label.clear();
                    st.history_ui.selected = Some(id);
                    st.toast("Snapshot taken");
                }
                Err(e) => st.log(LogLevel::Error, e.to_string()),
            }
        }
        ui.weak("Snapshots cover JSON, event sheets, scripts and text (not images/audio); the newest 50 are kept. An automatic one is taken before saves.");
    });
    ui.separator();
    let mut snaps = history::list(&root);
    snaps.reverse();
    if snaps.is_empty() {
        ui.weak("No snapshots yet.");
        return;
    }
    let selected = st.history_ui.selected.clone();
    ui.columns(2, |cols| {
        egui::ScrollArea::vertical().id_salt("snaps").show(&mut cols[0], |ui| {
            for s in &snaps {
                let text = format!("{}  ·  {}  ·  {} files", history::age_text(s.time), s.label, s.files);
                if ui.selectable_label(selected.as_deref() == Some(&s.id), text).clicked() {
                    st.history_ui.selected = Some(s.id.clone());
                    st.history_ui.file = None;
                    st.history_ui.confirm_restore = false;
                }
            }
        });
        let ui = &mut cols[1];
        let Some(id) = st.history_ui.selected.clone() else {
            ui.weak("Select a snapshot to compare it with the current files");
            return;
        };
        let changes = history::diff(&root, &id).unwrap_or_default();
        ui.horizontal(|ui| {
            ui.strong(format!("{} changed file(s) since this snapshot", changes.len()));
            let label = if st.history_ui.confirm_restore { "Click again to restore" } else { "Restore this snapshot" };
            if ui.button(label).clicked() {
                if st.history_ui.confirm_restore {
                    match history::restore(&root, &id) {
                        Ok(_) => {
                            st.history_ui.confirm_restore = false;
                            st.reload_after_restore();
                            st.toast("Restored (a safety snapshot was taken first)");
                        }
                        Err(e) => st.log(LogLevel::Error, e.to_string()),
                    }
                } else {
                    st.history_ui.confirm_restore = true;
                }
            }
        });
        for (f, c) in &changes {
            let (tag, col) = match c {
                Change::Added => ("added", Color32::from_rgb(130, 200, 130)),
                Change::Removed => ("removed", Color32::from_rgb(220, 110, 110)),
                Change::Modified => ("modified", Color32::from_rgb(230, 190, 100)),
            };
            if ui.selectable_label(st.history_ui.file.as_deref() == Some(f), RichText::new(format!("{tag}  {f}")).color(col)).clicked() {
                st.history_ui.file = Some(f.clone());
            }
        }
        if let Some(f) = st.history_ui.file.clone() {
            ui.separator();
            egui::ScrollArea::both().id_salt("diff").show(ui, |ui| {
                for (t, line) in history::file_diff(&root, &id, &f).unwrap_or_default().iter().filter(|(t, _)| *t != ' ').take(400) {
                    let col = if *t == '+' { Color32::from_rgb(130, 200, 130) } else { Color32::from_rgb(220, 110, 110) };
                    ui.label(RichText::new(format!("{t} {line}")).monospace().color(col));
                }
            });
        }
    });
}
