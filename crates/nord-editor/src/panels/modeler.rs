//! 3D Modeler: small polygon mesh editor + texture painter + UV editor (`editor/modeler/`), same embedded-page pattern as the UI Designer.
//! Meshes are saved as `models/<name>.mesh.json` (+ `.glb` / `.obj` exports and `.png` textures) through the jailed `/api/fpsc/save`.
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
    let url = format!("{base}/editor/modeler/index.html");
    ui.horizontal(|ui| {
        if ui.button("Open in browser").clicked() {
            open_in_browser(&url);
        }
        ui.weak("Saves models/<name>.mesh.json · Export GLB to use it in a 3D scene");
    });
    web.show(ui, frame, "modeler", &url, overlay);
    ui.ctx()
        .request_repaint_after(std::time::Duration::from_millis(250));
}
