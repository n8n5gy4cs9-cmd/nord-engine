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
    let mut url = format!("{base}/editor/modeler/index.html");
    if let Some(c) = &st.modeler_ctx {
        url += &format!(
            "?file={}&entity={}&prefab={}&n={}",
            enc(&c.file),
            enc(&c.entity),
            enc(&c.prefab),
            c.nonce
        );
        if let Some((shape, sz, seg, name)) = &c.mesh {
            url += &format!(
                "&mesh={}&size={},{},{}&seg={seg}&ename={}",
                enc(shape),
                sz[0],
                sz[1],
                sz[2],
                enc(name)
            );
        }
    }
    ui.horizontal(|ui| {
        let tip = if st.modeler_full { "Back to the normal editor layout" } else { "Make the 3D Modeler fill the whole editor window (the red button brings the layout back)" };
        if crate::icons::fullscreen_button(ui, st.modeler_full, "Full window", "Exit full view", tip) {
            st.modeler_full = !st.modeler_full;
        }
        if ui.button("Open in browser").clicked() {
            open_in_browser(&url);
        }
        if let Some(c) = &st.modeler_ctx {
            ui.label(if c.file.is_empty() {
                "Editing the object's mesh as a model".to_string()
            } else {
                format!("Editing {}", c.file)
            });
            if ui
                .small_button("Detach")
                .on_hover_text("Forget the scene object: free modelling again")
                .clicked()
            {
                st.modeler_ctx = None;
            }
        }
        ui.weak("Save writes models/<name>.mesh.json (editable) and models/<name>.glb (game-ready, drag it into the scene)");
    });
    web.show(ui, frame, "modeler", &url, overlay);
    // the save dialog created a prefab / variant: tell the page which object and prefab it is tied to now
    if std::mem::take(&mut st.modeler_push) {
        if let Some(c) = &st.modeler_ctx {
            web.post_message(
                "modeler",
                &serde_json::json!({"t": "ctx", "file": c.file, "entity": c.entity, "prefab": c.prefab}),
            );
        }
    }
    ui.ctx()
        .request_repaint_after(std::time::Duration::from_millis(250));
}

/// Percent-encode a query value.
fn enc(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'/' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}
