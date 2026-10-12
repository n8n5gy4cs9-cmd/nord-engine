use crate::{
    app::Tab,
    icons,
    state::{Action, EditorState, Tool},
};
use egui::Ui;

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    ui.spacing_mut().item_spacing.x = 5.0;
    ui.horizontal_wrapped(|ui| {
        ui.add(
            egui::Image::new(egui::include_image!(
                "../../../../assets/brand/logo-mark-transparent.png"
            ))
            .fit_to_exact_size(egui::vec2(24.0, 24.0)),
        );
        let name = st.project.as_ref().map_or("Workspace", |p| p.name.as_str());
        ui.add_sized(
            [150.0, 28.0],
            egui::Label::new(
                egui::RichText::new(format!("{name}{}", if st.dirty { " •" } else { "" })).strong(),
            )
            .truncate(),
        )
        .on_hover_text(name);
        ui.separator();
        let has = st.project.is_some();
        if has {
            let running = st.is_playing();
            let busy = st.rust_job.is_some();
            if ui
                .add_enabled(
                    !busy,
                    egui::Button::new(if running { "Stop" } else { "Play" })
                        .fill(ui.visuals().selection.bg_fill),
                )
                .on_hover_text(format!("Play / stop ({})", st.settings.key_label(true)))
                .clicked()
            {
                st.push(if running { Action::Stop } else { Action::Play });
            }
            ui.add_enabled_ui(running, |ui| {
                if icons::button(
                    ui,
                    "square",
                    &format!("Stop ({})", st.settings.key_label(false)),
                    false,
                )
                .clicked()
                {
                    st.push(Action::Stop);
                }
            });
            ui.add_enabled_ui(running, |ui| {
                if icons::button(ui, "refresh-cw", "Reload game", false).clicked() {
                    st.push(Action::Reload);
                }
            });
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
            ui.add_enabled_ui(st.undo.can_undo(), |ui| {
                if icons::button(ui, "undo-2", "Undo (Cmd+Z)", false).clicked() {
                    st.push(Action::Undo);
                }
            });
            ui.add_enabled_ui(st.undo.can_redo(), |ui| {
                if icons::button(ui, "redo-2", "Redo (Shift+Cmd+Z)", false).clicked() {
                    st.push(Action::Redo);
                }
            });
            if icons::button(ui, "save", "Save (Cmd+S)", false).clicked() {
                st.push(Action::SaveAll);
            }
            ui.separator();
        } else {
            ui.weak("Create something worth playing.");
        }
        if ui.add_enabled(has, egui::Button::new("Export…")).clicked() {
            st.push(Action::Export);
        }
        if icons::button(ui, "book-open", "Docs", false).clicked() {
            st.push(Action::ShowTab(Tab::Docs));
        }
        if icons::button(ui, "search", "Command palette (Cmd+K)", false).clicked() {
            st.push(Action::Palette);
        }
        if icons::button(ui, "settings", "Settings (Cmd+,)", false).clicked() {
            st.push(Action::Settings);
        }
    });
}
