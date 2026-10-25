pub mod animation;
pub mod animator;
pub mod assets;
pub mod build;
pub mod console;
pub mod desktop;
pub mod docs;
pub mod events;
pub mod export;
pub mod fps;
pub mod fun;
pub mod graph;
pub mod hierarchy;
pub mod history;
pub mod hub;
pub mod inspector;
pub mod layout;
pub mod level2d;
pub mod library;
pub mod modeler;
pub mod notes;
pub mod palette;
pub mod particles;
pub mod preview;
pub mod project;
pub mod remote;
pub mod settings;
pub mod sprite;
pub mod templates;
pub mod timeline;
pub mod toolbar;
pub mod uidesigner;

/// How an inline rename box ended this frame.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum RenameOutcome {
    Editing,
    /// Enter, Tab or a click elsewhere: keep the typed name (like Unity / Finder)
    Commit,
    /// Escape: keep the old name
    Cancel,
}

/// One-line rename editor shared by Assets, Hierarchy, ... It takes the keyboard focus when it appears, selects the name without
/// its extension, and reports Enter / click-away as `Commit` and Escape as `Cancel`. (Never call `request_focus` before checking
/// `lost_focus`: that re-grabs the focus in the same frame and Enter would never end the rename.)
pub fn inline_rename(
    ui: &mut egui::Ui,
    buf: &mut String,
    id: egui::Id,
    width: f32,
) -> RenameOutcome {
    let mut out = egui::TextEdit::singleline(buf)
        .id(id)
        .desired_width(width)
        .show(ui);
    if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
        return RenameOutcome::Cancel;
    }
    if out.response.lost_focus() {
        return RenameOutcome::Commit;
    }
    if !out.response.has_focus() {
        out.response.request_focus();
        let chars = buf.chars().count();
        let stem = buf
            .rfind('.')
            .filter(|i| *i > 0)
            .map_or(chars, |i| buf[..i].chars().count());
        out.state
            .cursor
            .set_char_range(Some(egui::text::CCursorRange::two(
                egui::text::CCursor::new(0),
                egui::text::CCursor::new(stem),
            )));
        out.state.store(ui.ctx(), id);
    }
    RenameOutcome::Editing
}
