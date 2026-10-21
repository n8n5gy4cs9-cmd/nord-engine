//! 2D level creator, using the same embedded-page pattern as FPS Level.
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
        ui.weak("Open a 2D project first");
        return;
    }
    let Some(base) = st.ensure_server() else {
        return;
    };
    let url = format!("{base}/editor/level2d/index.html");
    ui.horizontal(|ui|{if ui.button("Open in browser").clicked(){open_in_browser(&url);}ui.weak("Save writes a normal Nord scene · Use as game start → Play / Export · F5 tests unsaved edits");});
    web.show(ui, frame, "level2d", &url, overlay);
    ui.ctx()
        .request_repaint_after(std::time::Duration::from_millis(250));
}
