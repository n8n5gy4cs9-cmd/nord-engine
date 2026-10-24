use crate::state::{Action, EditorState};
use egui::Context;
use std::sync::Arc;

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
        egui::Window::new("Settings").open(&mut open).default_width(580.0).default_height(820.0).vscroll(true).show(ctx, |ui| {
            let s = &mut st.settings;
            egui::CollapsingHeader::new("Shortcuts (Unity defaults)").show(ui, |ui| {
                // capture: the next key press (with its modifiers) becomes the new chord; Esc cancels
                if st.rebinding.is_some() {
                    let ev = ui.ctx().input(|i| {
                        i.events.iter().find_map(|e| match e {
                            egui::Event::Key { key, pressed: true, modifiers, repeat: false, .. } => Some((*key, *modifiers)),
                            _ => None,
                        })
                    });
                    if let Some((key, mods)) = ev {
                        if let Some(id) = st.rebinding.take() {
                            if key != egui::Key::Escape {
                                s.keymap.insert(id, crate::keymap::format_chord(mods, key));
                                s.save();
                            }
                        }
                    }
                }
                egui::Grid::new("shortcuts").num_columns(3).spacing([10.0, 4.0]).show(ui, |ui| {
                    for def in crate::keymap::DEFS {
                        ui.label(def.label);
                        let waiting = st.rebinding.as_deref() == Some(def.id);
                        let text = if waiting { "press keys…".to_string() } else { crate::keymap::chord_text(&s.keymap, def).to_string() };
                        let clash = crate::keymap::conflicts(&s.keymap, def.id);
                        let mut b = egui::RichText::new(text).monospace();
                        if !clash.is_empty() {
                            b = b.color(egui::Color32::from_rgb(240, 140, 90));
                        }
                        let r = ui.add_sized([150.0, 20.0], egui::Button::new(b).selected(waiting));
                        if r.clicked() {
                            st.rebinding = if waiting { None } else { Some(def.id.to_string()) };
                        }
                        if !clash.is_empty() {
                            r.on_hover_text(format!("Same keys as: {}", clash.join(", ")));
                        }
                        if s.keymap.contains_key(def.id) && crate::icons::mini(ui, "rotate-ccw", &format!("Back to {}", def.default)).clicked() {
                            s.keymap.remove(def.id);
                            s.save();
                        } else {
                            ui.label("");
                        }
                        ui.end_row();
                    }
                });
                ui.weak("Click a key box, then press the new keys (Esc cancels). Orange = two actions share the keys. Run/stop keys are below.");
            });
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
                    for t in st.themes.themes().iter().filter(|t| t.id != crate::theme::DRAFT_ID) {
                        let label = if st.themes.is_custom(&t.id) { format!("{} (custom)", t.name) } else { t.name.clone() };
                        changed |= ui.selectable_value(&mut s.theme, t.id.clone(), label).changed();
                    }
                });
                ui.end_row();
                // sizes are edited as a draft and only applied with the button: re-laying out the UI while dragging made it wiggle
                let size_id = egui::Id::new("size_draft");
                let mut d: (f32, f32, f32) = ui.ctx().data(|m| m.get_temp(size_id)).unwrap_or((s.ui_scale, s.font_scale, s.button_scale));
                ui.label("Interface size");
                ui.add(egui::Slider::new(&mut d.0, 0.7..=1.8).fixed_decimals(2)).on_hover_text("Everything: text, buttons, spacing");
                ui.end_row();
                ui.label("Text size");
                ui.add(egui::Slider::new(&mut d.1, 0.7..=1.8).fixed_decimals(2)).on_hover_text("Text only, on top of Interface size");
                ui.end_row();
                ui.label("Button size");
                ui.add(egui::Slider::new(&mut d.2, 0.7..=1.8).fixed_decimals(2)).on_hover_text("Buttons, inputs and icon buttons, on top of Interface size");
                ui.end_row();
                ui.label("");
                ui.horizontal(|ui| {
                    let pending = d != (s.ui_scale, s.font_scale, s.button_scale);
                    if ui.add_enabled(pending, egui::Button::new("Apply sizes")).on_hover_text("Nothing changes until you press this").clicked() {
                        (s.ui_scale, s.font_scale, s.button_scale) = d;
                        changed = true;
                    }
                    if ui.button("Reset to 1.00").on_hover_text("Puts the sliders back to the default size; press Apply sizes to use it").clicked() {
                        d = (1.0, 1.0, 1.0);
                    }
                    if pending {
                        ui.weak("not applied yet");
                    }
                });
                ui.end_row();
                ui.ctx().data_mut(|m| m.insert_temp(size_id, d));
                ui.label("Material previews");
                ui.checkbox(&mut s.plain_material_previews, "Flat colour only (faster)")
                    .on_hover_text("Off (default): the preview ball and Assets thumbnails show the texture, normal map and emissive map. On: colour, metallic and roughness only.");
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
                ui.label("Game view mouse");
                ui.checkbox(&mut s.esc_releases_mouse, "Esc releases a locked mouse")
                    .on_hover_text("Like Unity's editor: Esc in the Game view unlocks the cursor even if the game never does. Never applies to an exported or standalone game. Takes effect on the next Play.");
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
                for (label, binding) in [
                    ("FPS Level: Test", &mut s.fps_shortcuts.test),
                    ("FPS Level: Test from here", &mut s.fps_shortcuts.test_here),
                    ("FPS Level: Stop test", &mut s.fps_shortcuts.stop),
                ] {
                    ui.label(label);
                    ui.horizontal(|ui| {
                        ui.add(egui::TextEdit::singleline(&mut binding.key).desired_width(60.0))
                            .on_hover_text("Key name: F5, F6, Escape, Enter, Space, A… Invalid keys use the action's default.");
                        ui.checkbox(&mut binding.shift, "Shift");
                        ui.checkbox(&mut binding.command, "Cmd/Ctrl");
                        ui.checkbox(&mut binding.alt, "Alt");
                    });
                    ui.end_row();
                }
                ui.label("Shortcut defaults");
                if ui.button("Reset shortcuts to defaults").clicked() {
                    s.reset_shortcuts();
                    s.save();
                }
                ui.end_row();
                ui.label("Snap move / rotate / scale");
                ui.horizontal(|ui| {
                    ui.add(egui::DragValue::new(&mut s.snap_move).speed(0.1));
                    ui.add(egui::DragValue::new(&mut s.snap_rot).speed(1.0));
                    ui.add(egui::DragValue::new(&mut s.snap_scale).speed(0.01));
                });
                ui.end_row();
            });
            changed |= theme_editor(ui, st);
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
            ui.weak("FPS keys apply inside FPS Level and its test. Esc pauses; Stop test closes it. Use distinct bindings; Stop takes priority if duplicated.");
            ui.strong("Shortcuts");
            egui::Grid::new("shortcuts").num_columns(2).show(ui, |ui| {
                for (k, d) in SHORTCUTS {
                    ui.monospace(crate::platform::shortcut_label(k));
                    ui.label(*d);
                    ui.end_row();
                }
            });
        });
        if changed {
            st.apply_theme = true;
            st.settings.save();
        }
        if content_changed {
            st.script_cache.clear();
            st.settings.save();
            st.toast("Content mode changed. Reopen an example to switch its source.");
        }
        if !open {
            st.settings_open = false;
            st.rebinding = None;
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

/// Easy theme editor: edit a copy, preview live, save as a *new* custom theme (built-in themes are never overwritten).
fn theme_editor(ui: &mut egui::Ui, st: &mut EditorState) -> bool {
    use crate::theme::{hex, DRAFT_ID};
    let mut apply = false;
    egui::CollapsingHeader::new("Theme editor (make your own theme)").show(ui, |ui| {
        ui.weak("Start from a theme, change the colours (the editor updates live), then save. Built-in themes are never changed: yours is added as a new \"(custom)\" theme and is kept when the app closes.");
        let Some((mut t, prev)) = st.theme_draft.take() else {
            if ui.button("New theme from the current one").clicked() {
                let mut t = st.themes.theme(&st.settings.theme).clone();
                t.name = format!("{} copy", t.name);
                let prev = st.settings.theme.clone();
                Arc::make_mut(&mut st.themes).set_draft(t.clone());
                st.settings.theme = DRAFT_ID.into();
                st.theme_draft = Some((t, prev));
                apply = true;
            }
            let customs: Vec<(String, String)> = st.themes.themes().iter().filter(|t| st.themes.is_custom(&t.id) && t.id != DRAFT_ID).map(|t| (t.id.clone(), t.name.clone())).collect();
            for (id, name) in customs {
                ui.horizontal(|ui| {
                    ui.label(&name);
                    if ui.small_button("Use").clicked() {
                        st.settings.theme = id.clone();
                        apply = true;
                    }
                    if ui.small_button("Edit").clicked() {
                        let t = st.themes.theme(&id).clone();
                        let prev = st.settings.theme.clone();
                        Arc::make_mut(&mut st.themes).set_draft(t.clone());
                        st.settings.theme = DRAFT_ID.into();
                        st.theme_draft = Some((t, prev));
                        apply = true;
                    }
                    if ui.small_button("Delete").clicked() {
                        if st.settings.theme == id {
                            st.settings.theme = "playcanvas".into();
                            apply = true;
                        }
                        Arc::make_mut(&mut st.themes).remove_custom(&id);
                    }
                });
            }
            return;
        };
        let mut changed = false;
        ui.horizontal(|ui| {
            ui.label("Name");
            changed |= ui.text_edit_singleline(&mut t.name).changed();
            changed |= ui.checkbox(&mut t.dark, "Dark").on_hover_text("Chooses egui's dark or light base for widgets").changed();
        });
        let mut pick = |ui: &mut egui::Ui, label: &str, v: &mut String| {
            let c = hex(v);
            let mut rgb = [c.r(), c.g(), c.b()];
            ui.horizontal(|ui| {
                if egui::color_picker::color_edit_button_srgb(ui, &mut rgb).changed() {
                    *v = format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]);
                    changed = true;
                }
                ui.label(label);
            });
        };
        ui.strong("Interface colours");
        egui::Grid::new("theme-ui").num_columns(2).show(ui, |ui| {
            pick(ui, "Background", &mut t.ui.bg);
            pick(ui, "Panel", &mut t.ui.panel);
            ui.end_row();
            pick(ui, "Panel (raised)", &mut t.ui.panel2);
            pick(ui, "Borders", &mut t.ui.border);
            ui.end_row();
            pick(ui, "Text", &mut t.ui.fg);
            pick(ui, "Dim text", &mut t.ui.fg_dim);
            ui.end_row();
            pick(ui, "Accent", &mut t.ui.accent);
            pick(ui, "Good", &mut t.ui.good);
            ui.end_row();
            pick(ui, "Warning", &mut t.ui.warn);
            pick(ui, "Error", &mut t.ui.bad);
            ui.end_row();
        });
        ui.strong("Code colours");
        egui::Grid::new("theme-code").num_columns(2).show(ui, |ui| {
            pick(ui, "Keyword", &mut t.code.keyword);
            pick(ui, "String", &mut t.code.string);
            ui.end_row();
            pick(ui, "Number", &mut t.code.number);
            pick(ui, "Comment", &mut t.code.comment);
            ui.end_row();
            pick(ui, "Function", &mut t.code.function);
            pick(ui, "Type", &mut t.code.ty);
            ui.end_row();
        });
        let mut save = false;
        let mut cancel = false;
        ui.horizontal(|ui| {
            save = ui.button("Save as new theme").clicked();
            cancel = ui.button("Cancel").clicked();
        });
        if save {
            // derived code colours follow the interface colours
            let base = t.clone();
            let ui_c = &base.ui;
            let th = crate::theme::make_theme(
                &base,
                "x",
                &base.name,
                base.dark,
                [&ui_c.bg, &ui_c.panel, &ui_c.panel2, &ui_c.border, &ui_c.fg, &ui_c.fg_dim, &ui_c.accent, &ui_c.good, &ui_c.warn, &ui_c.bad],
                [&base.code.keyword, &base.code.string, &base.code.number, &base.code.comment, &base.code.function, &base.code.ty],
            );
            let id = Arc::make_mut(&mut st.themes).save_custom(th);
            st.settings.theme = id;
            st.toast("Theme saved");
            apply = true;
            return;
        }
        if cancel {
            Arc::make_mut(&mut st.themes).clear_draft();
            st.settings.theme = prev;
            apply = true;
            return;
        }
        if changed {
            let th = crate::theme::make_theme(
                &t,
                DRAFT_ID,
                &t.name,
                t.dark,
                [&t.ui.bg, &t.ui.panel, &t.ui.panel2, &t.ui.border, &t.ui.fg, &t.ui.fg_dim, &t.ui.accent, &t.ui.good, &t.ui.warn, &t.ui.bad],
                [&t.code.keyword, &t.code.string, &t.code.number, &t.code.comment, &t.code.function, &t.code.ty],
            );
            Arc::make_mut(&mut st.themes).set_draft(th);
            st.settings.theme = DRAFT_ID.into();
            apply = true;
        }
        st.theme_draft = Some((t, prev));
    });
    apply
}
