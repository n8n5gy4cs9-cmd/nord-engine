//! FPS Level tab: the FPS Creator level editor (`editor/fpsc/`, served at `/editor/fpsc/index.html` by the project's dev server)
//! in the embedded webview. Offers a one-click install of the runtime into projects that do not have it yet (docs/FPS_CREATOR.md).
use crate::{
    state::{Action, EditorState},
    viewport::webview::{open_in_browser, WebPanes},
};
use egui::Ui;
use std::path::Path;

/// Has this project the FPS Creator runtime (`nord fpsc init` / the template)?
pub fn installed(root: &Path) -> bool {
    nord_core::vfs::PathExt::v_exists(&root.join("scripts/fpsc/level-script.js"))
}

pub fn ui(
    st: &mut EditorState,
    ui: &mut Ui,
    web: &mut WebPanes,
    frame: Option<&eframe::Frame>,
    overlay: bool,
) {
    let Some(root) = st.root.clone() else {
        ui.weak("Open a project first");
        return;
    };
    if !installed(&root) {
        ui.add_space(24.0);
        ui.vertical_centered(|ui| {
            ui.heading("FPS Creator");
            ui.label("Build first-person shooter levels on a grid: walls, doors, windows, stairs, lights,");
            ui.label("ready-made enemies and pickups, attachable scripts and no-code rules.");
            ui.add_space(8.0);
            if ui
                .button("Add FPS Creator to this project")
                .on_hover_text("Copies the runtime to scripts/fpsc, adds a starter level, bank and scene. Never overwrites your files.")
                .clicked()
            {
                st.push(Action::FpsInstall);
            }
            ui.add_space(6.0);
            ui.weak("Needs a 3D project. Or start from the \"FPS Creator\" template on the project hub.");
        });
        return;
    }
    let Some(base) = st.ensure_server() else {
        return;
    };
    let url = format!("{base}/editor/fpsc/index.html");
    ui.horizontal(|ui| {
        if ui
            .button("Open in browser")
            .on_hover_text("The editor is a normal web page — it also works in your browser")
            .clicked()
        {
            let config = serde_json::to_string(&st.settings.fps_shortcuts).unwrap_or_default();
            let encoded: String = config.bytes().map(|b| format!("%{b:02X}")).collect();
            open_in_browser(&format!("{url}?shortcuts={encoded}"));
        }
        if ui
            .button("Upgrade runtime")
            .on_hover_text("Re-copy runtime/fpsc to scripts/fpsc after updating Nord (your levels, bank and scripts are kept)")
            .clicked()
        {
            st.push(Action::FpsInstall);
        }
        ui.weak("Levels live in levels/*.fpsl.json · your content in fpsc/ · F1 inside the editor = help");
    });
    web.show(ui, frame, "fpsc", &url, overlay);
    web.post_message(
        "fpsc",
        &serde_json::json!({
            "type": "fpsc-shortcuts", "shortcuts": st.settings.fps_shortcuts
        }),
    );
    ui.ctx()
        .request_repaint_after(std::time::Duration::from_millis(250));
}
