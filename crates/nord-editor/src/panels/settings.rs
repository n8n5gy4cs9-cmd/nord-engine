use crate::state::{Action, EditorState};
use egui::Context;

pub const SHORTCUTS: &[(&str, &str)] = &[
    ("Cmd+P", "Quick open file"),
    ("Cmd+K", "Command palette"),
    ("Cmd+S", "Save"),
    ("Cmd+Z / Shift+Cmd+Z", "Undo / redo"),
    ("Cmd+C / Cmd+V / Cmd+D", "Copy / paste / duplicate entity"),
    ("Delete", "Delete selection"),
    ("W / E / R", "Move / rotate / scale gizmo"),
    ("F", "Focus selection in viewport"),
    ("Cmd+R / Cmd+.", "Play (toggles stop) / stop — rebind above"),
    ("Cmd+F / Cmd+Opt+F", "Find / replace in file"),
    ("Cmd+Shift+F", "Search in project"),
    ("Cmd+G", "Go to line"),
    ("Cmd+/", "Toggle comment"),
    ("Tab / Shift+Tab", "Indent / dedent"),
    ("Ctrl+Space", "Autocomplete"),
    ("Cmd+1/2/3/4", "Show Scene / Game / Code / Assets"),
    ("Cmd+,", "Settings"),
];

pub fn window(st: &mut EditorState, ctx: &Context) {
    if st.settings_open {
        let mut open = true;
        let mut changed = false;
        let mut content_changed = false;
        egui::Window::new("Settings").open(&mut open).default_width(560.0).default_height(560.0).vscroll(true).show(ctx, |ui| {
            let s = &mut st.settings;
            egui::Grid::new("settings").num_columns(2).spacing([12.0, 6.0]).show(ui, |ui| {
                ui.label("Skin (fonts)");
                egui::ComboBox::from_id_salt("skin").selected_text(st.themes.skin(&s.skin).name.clone()).show_ui(ui, |ui| {
                    for k in st.themes.skins() {
                        changed |= ui.selectable_value(&mut s.skin, k.id.clone(), format!("{} — {} / {}", k.name, k.ui, k.code)).changed();
                    }
                });
                ui.end_row();
                ui.label("Theme (colors)");
                egui::ComboBox::from_id_salt("theme").selected_text(st.themes.theme(&s.theme).name.clone()).show_ui(ui, |ui| {
                    for t in st.themes.themes() {
                        changed |= ui.selectable_value(&mut s.theme, t.id.clone(), &t.name).changed();
                    }
                });
                ui.end_row();
                ui.label("UI scale");
                changed |= ui.add(egui::Slider::new(&mut s.ui_scale, 0.8..=1.6)).changed();
                ui.end_row();
                ui.label("Code font size");
                ui.add(egui::Slider::new(&mut s.code_font_size, 9.0..=24.0));
                ui.end_row();
                ui.label("Code word wrap");
                ui.checkbox(&mut s.code_word_wrap, "Wrap long lines")
                    .on_hover_text("Display-only wrapping; saved source files keep their original lines.");
                ui.end_row();
                ui.label("Code line height");
                ui.add(egui::Slider::new(&mut s.code_line_height, 1.0..=2.2).step_by(0.05))
                    .on_hover_text("Multiplier of the font size. Default: 1.6.");
                ui.end_row();
                ui.label("Code letter spacing");
                ui.add(egui::Slider::new(&mut s.code_letter_spacing, 0.0..=2.0).step_by(0.1).suffix(" pt"));
                ui.end_row();
                ui.label("Tab width");
                ui.add(egui::Slider::new(&mut s.tab_width, 1..=8));
                ui.end_row();
                ui.label("Autosave (seconds)");
                ui.add(egui::Slider::new(&mut s.autosave_secs, 5..=300));
                ui.end_row();
                ui.label("USE CACHED CONTENT");
                content_changed = ui.checkbox(&mut s.use_cached_content, "ON")
                    .on_hover_text("OFF (default): current example files and temporary webview storage. ON: saved example copies and persistent webview storage for testing. Reopen an example to switch its source.")
                    .changed();
                ui.end_row();
                ui.label("Play-mode tint");
                ui.horizontal(|ui| {
                    ui.checkbox(&mut s.tint, "tint the editor");
                    ui.color_edit_button_srgb(&mut s.play_tint).on_hover_text("PLAYMODE-COLOR: editor colour while the game is playing");
                    ui.label("playing");
                    ui.color_edit_button_srgb(&mut s.build_tint).on_hover_text("editor colour while a Rust game compiles / exports");
                    ui.label("compiling");
                });
                ui.end_row();
                ui.label("Run / stop keys");
                ui.horizontal(|ui| {
                    ui.weak("Cmd/Ctrl +");
                    ui.add(egui::TextEdit::singleline(&mut s.run_key).desired_width(36.0)).on_hover_text("Run; press again to stop. Key name, e.g. R, F5, Enter");
                    ui.weak("stop only:");
                    ui.add(egui::TextEdit::singleline(&mut s.stop_key).desired_width(36.0)).on_hover_text("Stop only. Change it if your game/app uses Cmd+. itself");
                });
                ui.end_row();
                ui.label("Snap move / rotate / scale");
                ui.horizontal(|ui| {
                    ui.add(egui::DragValue::new(&mut s.snap_move).speed(0.1));
                    ui.add(egui::DragValue::new(&mut s.snap_rot).speed(1.0));
                    ui.add(egui::DragValue::new(&mut s.snap_scale).speed(0.01));
                });
                ui.end_row();
            });
            let skin = st.themes.skin(&st.settings.skin);
            ui.add_space(6.0);
            ui.weak(format!(
                "Ligatures ({}) apply to the web-based UI; the native code editor draws without ligatures (egui has no text shaping).",
                if skin.ligatures { "on in this skin" } else { "off in this skin" }
            ));
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                if ui.button("Reset panel layout").clicked() {
                    st.push(Action::ResetLayout);
                }
                if ui.button("Reset all settings to defaults").on_hover_text("Theme, skin, keys, game view position, tint… and the panel layout (window size is kept)").clicked() {
                    st.push(Action::ResetSettings);
                }
            });
            ui.separator();
            ui.strong("Shortcuts");
            egui::Grid::new("shortcuts").num_columns(2).show(ui, |ui| {
                for (k, d) in SHORTCUTS {
                    ui.monospace(*k);
                    ui.label(*d);
                    ui.end_row();
                }
            });
        });
        if changed {
            st.apply_theme = true;
        }
        if content_changed {
            st.script_cache.clear();
            st.settings.save();
            st.toast("Content mode changed. Reopen an example to switch its source.");
        }
        if !open {
            st.settings_open = false;
            st.settings.save();
        }
    }
    if st.about_open {
        let mut open = true;
        egui::Window::new("About Nord Engine")
            .open(&mut open)
            .collapsible(false)
            .resizable(false)
            .show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add(
                        egui::Image::new(egui::include_image!(
                            "../../../../assets/brand/logo-256.png"
                        ))
                        .max_width(128.0),
                    );
                    ui.heading("Nord Engine");
                    ui.label(format!("Editor v{}", env!("CARGO_PKG_VERSION")));
                    ui.label("Crowelian 2026 + Sonnet");
                    ui.weak(
                        "Personal engine & editor · exports static HTML web games and a Mac app",
                    );
                    ui.weak("Phaser · Babylon.js · Havok · egui · wry — see THIRD_PARTY.md");
                });
            });
        if !open {
            st.about_open = false;
        }
    }
}
