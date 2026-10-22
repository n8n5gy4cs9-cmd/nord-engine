//! UI Designer: visual editor for `ui/*.ui.json` (see docs/UI_SCENES.md), same embedded-page pattern as the level editors.
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
    let url = format!("{base}/editor/uidesigner/index.html");
    ui.horizontal(|ui| {
        if ui.button("Open in browser").clicked() {
            open_in_browser(&url);
        }
        ui.weak("Saves ui/<name>.ui.json · load it with game.ui.load('ui/<name>.ui.json')");
    });
    web.show(ui, frame, "uidesigner", &url, overlay);
    ui.ctx()
        .request_repaint_after(std::time::Duration::from_millis(250));
}
