//! Notes manager: colourful development notes, task lists and a simple feature board, saved per project in `.nord/notes.json`.
use crate::{assetmeta::COLORS, icons, state::EditorState, theme::hex};
use egui::{RichText, Ui, Vec2};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Task {
    pub text: String,
    pub done: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body: String,
    /// index into `assetmeta::COLORS`
    pub color: usize,
    /// 0 note, 1 planned, 2 in progress, 3 done
    pub status: u8,
    pub tasks: Vec<Task>,
}

pub const STATUS: [&str; 4] = ["Note", "Planned", "In progress", "Done"];

#[derive(Default)]
pub struct NotesUi {
    pub notes: Vec<Note>,
    loaded_for: Option<PathBuf>,
    pub selected: Option<String>,
    pub search: String,
    pub filter: Option<u8>,
    new_task: String,
}

fn path(root: &Path) -> PathBuf {
    root.join(".nord").join("notes.json")
}

impl NotesUi {
    fn ensure(&mut self, root: &Path) {
        if self.loaded_for.as_deref() != Some(root) {
            self.notes = nord_core::io::load_json(&path(root)).unwrap_or_default();
            self.selected = self.notes.first().map(|n| n.id.clone());
            self.loaded_for = Some(root.to_path_buf());
        }
    }
    fn save(&self, root: &Path) {
        let _ = nord_core::vfs::create_dir_all(root.join(".nord"));
        let _ = nord_core::io::save_json(&path(root), &self.notes);
    }
    pub fn progress(n: &Note) -> Option<(usize, usize)> {
        (!n.tasks.is_empty()).then(|| (n.tasks.iter().filter(|t| t.done).count(), n.tasks.len()))
    }
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("Open a project first");
        return;
    };
    st.notes.ensure(&root);
    let mut changed = false;
    egui::SidePanel::left("notes-list")
        .resizable(true)
        .default_width(230.0)
        .show_inside(ui, |ui| {
            ui.horizontal(|ui| {
                if ui.button("+ New note").clicked() {
                    let id = format!(
                        "n{:x}",
                        web_time::SystemTime::now()
                            .duration_since(web_time::UNIX_EPOCH)
                            .map_or(0, |d| d.as_millis())
                    );
                    st.notes.notes.insert(
                        0,
                        Note {
                            id: id.clone(),
                            title: "New note".into(),
                            color: 5,
                            ..Default::default()
                        },
                    );
                    st.notes.selected = Some(id);
                    changed = true;
                }
                egui::ComboBox::from_id_salt("notes-filter")
                    .selected_text(st.notes.filter.map_or("All", |i| STATUS[i as usize]))
                    .show_ui(ui, |ui| {
                        ui.selectable_value(&mut st.notes.filter, None, "All");
                        for (i, s) in STATUS.iter().enumerate() {
                            ui.selectable_value(&mut st.notes.filter, Some(i as u8), *s);
                        }
                    });
            });
            ui.add(
                egui::TextEdit::singleline(&mut st.notes.search)
                    .hint_text("Search notes…")
                    .desired_width(f32::INFINITY),
            );
            ui.separator();
            let q = st.notes.search.to_lowercase();
            egui::ScrollArea::vertical()
                .auto_shrink([false; 2])
                .show(ui, |ui| {
                    for n in st.notes.notes.clone() {
                        if st.notes.filter.is_some_and(|f| f != n.status)
                            || (!q.is_empty()
                                && !n.title.to_lowercase().contains(&q)
                                && !n.body.to_lowercase().contains(&q))
                        {
                            continue;
                        }
                        let sel = st.notes.selected.as_deref() == Some(n.id.as_str());
                        let (rect, resp) = ui.allocate_exact_size(
                            Vec2::new(ui.available_width(), 38.0),
                            egui::Sense::click(),
                        );
                        let col = hex(COLORS[n.color.min(COLORS.len() - 1)].1);
                        let p = ui.painter();
                        p.rect_filled(
                            rect,
                            4.0,
                            if sel {
                                ui.visuals().selection.bg_fill
                            } else if resp.hovered() {
                                ui.visuals().widgets.hovered.bg_fill
                            } else {
                                ui.visuals().faint_bg_color
                            },
                        );
                        p.rect_filled(
                            egui::Rect::from_min_size(rect.min, Vec2::new(4.0, rect.height())),
                            2.0,
                            col,
                        );
                        p.text(
                            rect.min + Vec2::new(12.0, 4.0),
                            egui::Align2::LEFT_TOP,
                            &n.title,
                            egui::TextStyle::Body.resolve(ui.style()),
                            ui.visuals().text_color(),
                        );
                        let sub = match NotesUi::progress(&n) {
                            Some((d, t)) => {
                                format!("{} · {d}/{t} tasks", STATUS[n.status as usize])
                            }
                            None => STATUS[n.status as usize].to_string(),
                        };
                        p.text(
                            rect.min + Vec2::new(12.0, 21.0),
                            egui::Align2::LEFT_TOP,
                            sub,
                            egui::TextStyle::Small.resolve(ui.style()),
                            ui.visuals().weak_text_color(),
                        );
                        if resp.clicked() {
                            st.notes.selected = Some(n.id.clone());
                        }
                    }
                });
        });
    let sel = st.notes.selected.clone();
    let Some(i) = sel.and_then(|id| st.notes.notes.iter().position(|n| n.id == id)) else {
        ui.weak("Create a note on the left: ideas, bugs, features to build, with task lists. Saved in .nord/notes.json (commit it to share it).");
        if changed {
            st.notes.save(&root);
        }
        return;
    };
    let mut delete = false;
    let mut new_task = std::mem::take(&mut st.notes.new_task);
    {
        let n = &mut st.notes.notes[i];
        ui.horizontal(|ui| {
            changed |= ui
                .add(
                    egui::TextEdit::singleline(&mut n.title)
                        .font(egui::TextStyle::Heading)
                        .desired_width(ui.available_width() - 90.0),
                )
                .changed();
            if icons::button(ui, "trash-2", "Delete this note", false).clicked() {
                delete = true;
            }
        });
        ui.horizontal(|ui| {
            for (ci, (name, h)) in COLORS.iter().enumerate() {
                let (r, resp) = ui.allocate_exact_size(Vec2::splat(16.0), egui::Sense::click());
                ui.painter().rect_filled(r, 3.0, hex(h));
                if n.color == ci {
                    ui.painter().rect_stroke(
                        r,
                        3.0,
                        egui::Stroke::new(2.0, ui.visuals().strong_text_color()),
                        egui::StrokeKind::Outside,
                    );
                }
                if resp.on_hover_text(*name).clicked() {
                    n.color = ci;
                    changed = true;
                }
            }
            ui.separator();
            for (si, s) in STATUS.iter().enumerate() {
                if ui.selectable_label(n.status as usize == si, *s).clicked() {
                    n.status = si as u8;
                    changed = true;
                }
            }
        });
        ui.separator();
        if let Some((d, t)) = NotesUi::progress(n) {
            ui.add(
                egui::ProgressBar::new(d as f32 / t as f32)
                    .text(format!("{d} / {t} tasks"))
                    .desired_height(14.0),
            );
        }
        let mut remove = None;
        for (ti, t) in n.tasks.iter_mut().enumerate() {
            ui.horizontal(|ui| {
                changed |= ui.checkbox(&mut t.done, "").changed();
                let txt = RichText::new(&t.text);
                let mut s = t.text.clone();
                let r = ui.add(
                    egui::TextEdit::singleline(&mut s).desired_width(ui.available_width() - 30.0),
                );
                if r.changed() {
                    t.text = s;
                    changed = true;
                }
                let _ = txt;
                if icons::mini(ui, "x", "Remove task").clicked() {
                    remove = Some(ti);
                }
            });
        }
        if let Some(ti) = remove {
            n.tasks.remove(ti);
            changed = true;
        }
        ui.horizontal(|ui| {
            let r = ui.add(
                egui::TextEdit::singleline(&mut new_task)
                    .hint_text("Add a task and press Enter…")
                    .desired_width(ui.available_width() - 70.0),
            );
            if (r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter))
                || ui.button("Add").clicked())
                && !new_task.trim().is_empty()
            {
                n.tasks.push(Task {
                    text: new_task.trim().to_string(),
                    done: false,
                });
                new_task.clear();
                changed = true;
            }
        });
        ui.separator();
        egui::ScrollArea::vertical()
            .auto_shrink([false; 2])
            .show(ui, |ui| {
                changed |= ui
                    .add(
                        egui::TextEdit::multiline(&mut n.body)
                            .hint_text("Notes, design ideas, links… (plain text)")
                            .desired_width(f32::INFINITY)
                            .desired_rows(14),
                    )
                    .changed();
            });
    }
    st.notes.new_task = new_task;
    if delete {
        st.notes.notes.remove(i);
        st.notes.selected = st.notes.notes.first().map(|n| n.id.clone());
        changed = true;
    }
    if changed {
        st.notes.save(&root);
    }
}
