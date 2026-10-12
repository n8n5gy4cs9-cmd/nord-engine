//! JSON tool: edit JSON on the left, see a collapsible tree on the right. Format / minify / sort keys; drop a .json file onto the window.
use nord_app_wasm::eframe;
use nord_app_wasm::egui::{self, CollapsingHeader, RichText, ScrollArea, TextEdit};
use serde_json::Value;

struct App {
    text: String,
    parsed: Result<Value, String>,
    filter: String,
}

impl App {
    fn new() -> Self {
        let text = r#"{"name":"Nord","tags":["engine","rust","wasm"],"nested":{"pi":3.14159,"ok":true,"none":null}}"#.to_string();
        let parsed = Self::parse(&text);
        Self { text, parsed, filter: String::new() }
    }
    fn parse(t: &str) -> Result<Value, String> {
        serde_json::from_str(t).map_err(|e| format!("line {}, column {}: {e}", e.line(), e.column()))
    }
    fn reparse(&mut self) {
        self.parsed = Self::parse(&self.text);
    }
}

fn sort_keys(v: &mut Value) {
    match v {
        Value::Object(m) => {
            let mut e: Vec<_> = std::mem::take(m).into_iter().collect();
            e.sort_by(|a, b| a.0.cmp(&b.0));
            for (k, mut x) in e {
                sort_keys(&mut x);
                m.insert(k, x);
            }
        }
        Value::Array(a) => a.iter_mut().for_each(sort_keys),
        _ => {}
    }
}

fn tree(ui: &mut egui::Ui, key: &str, v: &Value, filter: &str) {
    let hit = |s: &str| filter.is_empty() || s.to_lowercase().contains(&filter.to_lowercase());
    match v {
        Value::Object(m) => {
            CollapsingHeader::new(RichText::new(format!("{key}  {{{}}}", m.len())).strong()).id_salt(ui.next_auto_id()).default_open(key == "root").show(ui, |ui| {
                m.iter().for_each(|(k, x)| tree(ui, k, x, filter));
            });
        }
        Value::Array(a) => {
            CollapsingHeader::new(RichText::new(format!("{key}  [{}]", a.len())).strong()).id_salt(ui.next_auto_id()).show(ui, |ui| {
                a.iter().enumerate().for_each(|(i, x)| tree(ui, &i.to_string(), x, filter));
            });
        }
        leaf => {
            let s = leaf.to_string();
            if hit(key) || hit(&s) {
                let color = match leaf {
                    Value::String(_) => egui::Color32::from_rgb(163, 190, 140),
                    Value::Number(_) => egui::Color32::from_rgb(235, 203, 139),
                    Value::Bool(_) => egui::Color32::from_rgb(180, 142, 173),
                    _ => egui::Color32::GRAY,
                };
                ui.label(RichText::new(format!("{key}: {s}")).color(color).monospace());
            }
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _: &mut eframe::Frame) {
        if let Some(f) = ctx.input(|i| i.raw.dropped_files.first().cloned()) {
            if let Some(bytes) = f.bytes {
                self.text = String::from_utf8_lossy(&bytes).into_owned();
                self.reparse();
            }
        }
        egui::TopBottomPanel::top("bar").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.heading("JSON tool");
                if ui.button("Format").clicked() {
                    if let Ok(v) = &self.parsed {
                        self.text = serde_json::to_string_pretty(v).unwrap_or_default();
                    }
                }
                if ui.button("Minify").clicked() {
                    if let Ok(v) = &self.parsed {
                        self.text = v.to_string();
                    }
                }
                if ui.button("Sort keys").clicked() {
                    if let Ok(mut v) = self.parsed.clone() {
                        sort_keys(&mut v);
                        self.text = serde_json::to_string_pretty(&v).unwrap_or_default();
                    }
                }
                ui.separator();
                ui.label("Filter");
                ui.text_edit_singleline(&mut self.filter);
                match &self.parsed {
                    Ok(_) => ui.colored_label(egui::Color32::from_rgb(163, 190, 140), "valid"),
                    Err(e) => ui.colored_label(egui::Color32::from_rgb(191, 97, 106), e),
                };
            });
        });
        egui::SidePanel::left("src").resizable(true).default_width(420.0).show(ctx, |ui| {
            ScrollArea::vertical().show(ui, |ui| {
                if ui.add(TextEdit::multiline(&mut self.text).code_editor().desired_width(f32::INFINITY).desired_rows(30)).changed() {
                    self.reparse();
                }
            });
        });
        egui::CentralPanel::default().show(ctx, |ui| {
            ScrollArea::both().show(ui, |ui| match &self.parsed {
                Ok(v) => tree(ui, "root", v, &self.filter),
                Err(_) => {
                    ui.weak("Fix the JSON to see the tree. Tip: drop a .json file on this window.");
                }
            });
        });
    }
}

fn main() {
    nord_app_wasm::launch("JSON tool", |_cc| Box::new(App::new()));
}
