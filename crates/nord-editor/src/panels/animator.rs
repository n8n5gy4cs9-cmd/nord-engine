//! Animator: visual state machine for `anim/*.animator.json` (see docs/ANIMATOR.md), same embedded-page pattern as the Graph editor.
use crate::{
    state::EditorState,
    viewport::webview::{open_in_browser, WebPanes},
};
use egui::Ui;

pub fn ui(
    st: &mut EditorState,
    ui: &mut Ui,
    web: &mut WebPanes,
    frame: Option<&eframe::Frame>,
    overlay: bool,
) {
    if st.root.is_none() {
        ui.weak("Open a project first");
        return;
    }
    let Some(base) = st.ensure_server() else {
        return;
    };
    let url = match &st.animator_file {
        Some(f) => format!("{base}/editor/animator/index.html?file={f}"),
        None => format!("{base}/editor/animator/index.html"),
    };
    ui.horizontal(|ui| {
        if ui.button("Open in browser").clicked() {
            open_in_browser(&url);
        }
        ui.weak("Saves anim/<name>.animator.json · add an Animator component next to an Animated Sprite and point it at the file");
    });
    web.show(ui, frame, "animator", &url, overlay);
    ui.ctx()
        .request_repaint_after(std::time::Duration::from_millis(250));
}
