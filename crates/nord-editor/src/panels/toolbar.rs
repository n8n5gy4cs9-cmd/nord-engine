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
                .on_hover_text(format!("Play / stop (F5, {})", st.settings.key_label(true)))
                .clicked()
            {
                st.push(if running { Action::Stop } else { Action::Play });
            }
            if ui
                .add_enabled(!busy && st.scene_file.is_some(), egui::Button::new("Scene"))
                .on_hover_text("Run this scene only (F6)")
                .clicked()
            {
                st.push(Action::PlayScene);
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
                if ui
                    .selectable_label(st.game_paused, "Pause")
                    .on_hover_text("Pause / resume the running game")
                    .clicked()
                {
                    st.push(Action::PauseGame);
                }
                if ui
                    .button("Step")
                    .on_hover_text("Advance one frame (pauses first)")
                    .clicked()
                {
                    st.push(Action::StepGame);
                }
            });
            ui.add_enabled_ui(running, |ui| {
                if icons::button(ui, "refresh-cw", "Reload game", false).clicked() {
                    st.push(Action::Reload);
                }
            });
            if ui
                .selectable_label(st.lan.is_some(), "Phone")
                .on_hover_text("Preview on your phone: shows a QR code (same Wi-Fi)")
                .clicked()
            {
                if st.lan.is_some() && !st.lan_open {
                    st.lan_open = true;
                } else {
                    crate::panels::preview::toggle(st);
                }
            }
            ui.separator();
            for (t, ic, tip) in [
                (Tool::Hand, "hand", "Hand (Q)"),
                (Tool::Move, "move", "Move (W)"),
                (Tool::Rotate, "rotate-cw", "Rotate (E)"),
                (Tool::Scale, "scaling", "Scale (R)"),
                (Tool::Rect, "box-select", "Rect (T)"),
            ] {
                if icons::button(ui, ic, tip, st.tool == t).clicked() {
                    st.push(Action::SetTool(t));
                }
            }
            ui.separator();
            let (sp, sp_tip) = if st.settings.space_local {
                ("Local", "Gizmo space: Local (click for Global)")
            } else {
                ("Global", "Gizmo space: Global (click for Local)")
            };
            if ui.small_button(sp).on_hover_text(sp_tip).clicked() {
                st.push(Action::ToggleSpace);
            }
            let (pv, pv_tip) = if st.settings.pivot_center {
                ("Center", "Pivot: Center (click for Pivot)")
            } else {
                ("Pivot", "Pivot: Pivot (click for Center)")
            };
            if ui.small_button(pv).on_hover_text(pv_tip).clicked() {
                st.push(Action::TogglePivot);
            }
            if icons::button(
                ui,
                "magnet",
                "Snap (hold Ctrl for temporary snap)",
                st.settings.snap,
            )
            .clicked()
            {
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

/// PlayCanvas-style vertical tool rail: transform tools, gizmo space, snap, focus, grid. Active tool is orange.
pub fn rail(st: &mut EditorState, ui: &mut Ui) {
    ui.vertical_centered(|ui| {
        ui.spacing_mut().item_spacing.y = 4.0;
        for (t, ic, tip) in [
            (Tool::Hand, "hand", "Hand (Q)"),
            (Tool::Move, "move", "Move (W)"),
            (Tool::Rotate, "rotate-cw", "Rotate (E)"),
            (Tool::Scale, "scaling", "Scale (R)"),
            (Tool::Rect, "box-select", "Rect (T)"),
        ] {
            if icons::button(ui, ic, tip, st.tool == t).clicked() {
                st.push(Action::SetTool(t));
            }
        }
        ui.separator();
        let (sp, tip) = if st.settings.space_local {
            ("box", "Gizmo space: Local (click for Global)")
        } else {
            ("globe", "Gizmo space: Global (click for Local)")
        };
        if icons::button(ui, sp, tip, st.settings.space_local).clicked() {
            st.push(Action::ToggleSpace);
        }
        if icons::button(ui, "magnet", "Snap (hold Ctrl)", st.settings.snap).clicked() {
            st.push(Action::ToggleSnap);
        }
        if icons::button(ui, "grid-3x3", "Grid", st.settings.grid).clicked() {
            st.push(Action::ToggleGrid);
        }
        if icons::button(ui, "crosshair", "Focus selected (F)", false).clicked() {
            st.push(Action::Focus);
        }
    });
}
