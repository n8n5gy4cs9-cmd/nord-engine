//! Graph editor tab: litegraph canvas + Nord node library (`editor/graph/`, docs/GRAPH.md). Saves `graphs/*.graph.json`.
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
    let url = match &st.graph_file {
        Some(f) => format!("{base}/editor/graph/index.html?file={f}"),
        None => format!("{base}/editor/graph/index.html"),
    };
    ui.horizontal(|ui| {
        if ui.button("Open in browser").clicked() {
            open_in_browser(&url);
        }
        ui.weak("Saves graphs/<name>.graph.json · run it with the `graph` component or scene settings \"graphs\"");
    });
    web.show(ui, frame, "graph", &url, overlay);
    ui.ctx()
        .request_repaint_after(std::time::Duration::from_millis(250));
}
