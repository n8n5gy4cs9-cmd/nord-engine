//! Notes app in Rust + egui using the Nord Desktop API (`nord_app_wasm::desktop`): files in the app data folder, a settings store,
//! notifications, native dialogs and the clipboard. The same code runs natively and in the browser (fallbacks: localStorage files,
//! Notification API, window.confirm). Permissions come from `desktop.permissions` in nord.project.json (compiled in below).
use nord_app_wasm::desktop::Desktop;
use nord_app_wasm::eframe;
use nord_app_wasm::egui;
use nord_app_wasm::serde_json::json;

struct Notes {
    d: Desktop,
    names: Vec<String>,
    cur: Option<String>,
    text: String,
    dirty: bool,
    status: String,
    dark: bool,
}

impl Notes {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        // keep in sync with nord.project.json → desktop.permissions
        let d = Desktop::new(
            "com.crowelian.rustdesktopnotes",
            json!({ "fs": { "roots": ["picked"], "write": true }, "dialogs": true, "notifications": true, "clipboard": "write" }),
        );
        let dark = d
            .store_get("dark")
            .ok()
            .flatten()
            .and_then(|v| v.as_bool())
            .unwrap_or(true);
        cc.egui_ctx.set_visuals(if dark {
            egui::Visuals::dark()
        } else {
            egui::Visuals::light()
        });
        let mut s = Self {
            d,
            names: vec![],
            cur: None,
            text: String::new(),
            dirty: false,
            status: String::new(),
            dark,
        };
        s.refresh();
        if let Some(first) = s.names.first().cloned() {
            s.open(&first);
        }
        s
    }
    fn refresh(&mut self) {
        self.names = self
            .d
            .list("notes")
            .map(|v| {
                v.into_iter()
                    .filter(|e| !e.is_dir && e.name.ends_with(".md"))
                    .map(|e| e.name)
                    .collect()
            })
            .unwrap_or_default();
        self.names.sort();
    }
    fn save(&mut self) {
        if let Some(n) = &self.cur {
            match self.d.fs_write_text(&format!("notes/{n}"), &self.text) {
                Ok(()) => {
                    self.dirty = false;
                    self.status = format!("Saved {n}");
                }
                Err(e) => self.status = format!("Save failed: {e}"),
            }
        }
    }
    fn open(&mut self, n: &str) {
        if self.dirty {
            self.save();
        }
        self.text = self
            .d
            .fs_read_text(&format!("notes/{n}"))
            .unwrap_or_default();
        self.cur = Some(n.to_string());
        self.dirty = false;
    }
}

impl eframe::App for Notes {
    fn update(&mut self, ctx: &egui::Context, _: &mut eframe::Frame) {
        if ctx.input(|i| i.modifiers.command && i.key_pressed(egui::Key::S)) {
            self.save();
        }
        egui::SidePanel::left("list")
            .default_width(200.0)
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    if ui.button("➕ New").clicked() {
                        let n = format!("note-{}.md", self.names.len() + 1);
                        let _ = self.d.fs_write_text(&format!("notes/{n}"), "# New note\n");
                        self.refresh();
                        self.open(&n);
                    }
                    if ui
                        .button("🌓")
                        .on_hover_text("Toggle theme (remembered)")
                        .clicked()
                    {
                        self.dark = !self.dark;
                        ctx.set_visuals(if self.dark {
                            egui::Visuals::dark()
                        } else {
                            egui::Visuals::light()
                        });
                        let _ = self.d.store_set("dark", json!(self.dark));
                    }
                });
                ui.separator();
                for n in self.names.clone() {
                    if ui
                        .selectable_label(self.cur.as_deref() == Some(&n), &n)
                        .clicked()
                    {
                        self.open(&n);
                    }
                }
            });
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.horizontal(|ui| {
                if ui
                    .add_enabled(self.cur.is_some(), egui::Button::new("💾 Save"))
                    .clicked()
                {
                    self.save();
                }
                if ui.button("📂 Import…").clicked() {
                    match self.d.pick_file() {
                        Ok(Some(p)) => {
                            if let Ok(t) = self.d.fs_read_text(&p) {
                                let n = format!("imported-{}.md", self.names.len() + 1);
                                let _ = self.d.fs_write_text(&format!("notes/{n}"), &t);
                                self.refresh();
                                self.open(&n);
                            }
                        }
                        Ok(None) => {}
                        Err(e) => self.status = format!("{e}"),
                    }
                }
                if ui.button("📋 Copy").clicked() {
                    self.status = match self.d.clipboard_set_text(&self.text) {
                        Ok(()) => "Copied".into(),
                        Err(e) => format!("{e}"),
                    };
                }
                if ui.button("🔔 Remind").clicked() {
                    self.status = match self
                        .d
                        .notify("Nord Notes", self.text.lines().next().unwrap_or(""))
                    {
                        Ok(()) => "Notification sent".into(),
                        Err(e) => format!("{e}"),
                    };
                }
                if ui.button("🗑 Delete").clicked() {
                    if let Some(n) = self.cur.take() {
                        if self.d.confirm(&format!("Delete {n}?")).unwrap_or(false) {
                            let _ = self.d.fs_remove(&format!("notes/{n}"));
                            self.text.clear();
                            self.refresh();
                        } else {
                            self.cur = Some(n);
                        }
                    }
                }
                ui.weak(&self.status);
            });
            ui.separator();
            if self.cur.is_some()
                && ui
                    .add_sized(
                        ui.available_size(),
                        egui::TextEdit::multiline(&mut self.text).code_editor(),
                    )
                    .changed()
            {
                self.dirty = true;
            }
        });
    }
}

fn main() {
    nord_app_wasm::launch("Rust Desktop Notes", |cc| Box::new(Notes::new(cc)));
}
