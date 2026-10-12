use crate::{
    icons,
    state::{Action, EditorState, Tool},
};
use egui::Ui;

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    ui.horizontal(|ui| {
        ui.add(
            egui::Image::new(egui::include_image!(
                "../../../../assets/brand/logo-mark-transparent.png"
            ))
            .max_height(22.0),
        );
        let name = st
            .project
            .as_ref()
            .map_or("No project".to_string(), |p| p.name.clone());
        ui.strong(format!("{}{}", name, if st.dirty { " •" } else { "" }));
        ui.separator();
        let has = st.project.is_some();
        ui.add_enabled_ui(has, |ui| {
            let running = st.play.as_ref().is_some_and(|p| p.running);
            if icons::button(ui, "play", "Play (Cmd+R)", running).clicked() {
                st.push(Action::Play);
            }
            if icons::button(ui, "square", "Stop (Cmd+.)", false).clicked() {
                st.push(Action::Stop);
            }
            if icons::button(ui, "refresh-cw", "Reload game", false).clicked() {
                st.push(Action::Reload);
            }
            ui.separator();
            for (t, ic, tip) in [
                (Tool::Move, "move", "Move (W)"),
                (Tool::Rotate, "rotate-cw", "Rotate (E)"),
                (Tool::Scale, "scaling", "Scale (R)"),
            ] {
                if icons::button(ui, ic, tip, st.tool == t).clicked() {
                    st.push(Action::SetTool(t));
                }
            }
            ui.separator();
            if icons::button(ui, "magnet", "Snap", st.settings.snap).clicked() {
                st.push(Action::ToggleSnap);
            }
            if icons::button(ui, "grid-3x3", "Grid", st.settings.grid).clicked() {
                st.push(Action::ToggleGrid);
            }
            ui.weak(if st.is_3d() { "3D" } else { "2D" });
            ui.separator();
            if icons::button(ui, "undo-2", "Undo (Cmd+Z)", false).clicked() {
                st.push(Action::Undo);
            }
            if icons::button(ui, "redo-2", "Redo (Shift+Cmd+Z)", false).clicked() {
                st.push(Action::Redo);
            }
            if icons::button(ui, "save", "Save (Cmd+S)", false).clicked() {
                st.push(Action::SaveAll);
            }
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if icons::button(ui, "settings", "Settings (Cmd+,)", false).clicked() {
                st.push(Action::Settings);
            }
            if icons::button(ui, "book-open", "Docs", false).clicked() {
                st.push(Action::ShowTab(crate::app::Tab::Docs));
            }
            ui.add_enabled(false, egui::Button::new("Export ▾"))
                .on_hover_text("Export arrives in M4");
        });
    });
}
