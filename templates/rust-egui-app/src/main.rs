//! An egui app that runs natively (`cargo run`) and in the browser (`nord export . --target web-wasm-app`).
use nord_app_wasm::eframe;
use nord_app_wasm::egui;

#[derive(Default)]
struct App {
    name: String,
    clicks: u32,
}

impl eframe::App for App {
    fn update(&mut self, ctx: &egui::Context, _: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("My Rust app");
            ui.horizontal(|ui| {
                ui.label("Your name:");
                ui.text_edit_singleline(&mut self.name);
            });
            if ui.button("Click me").clicked() {
                self.clicks += 1;
            }
            ui.label(format!("Hello {}! Clicked {} times.", if self.name.is_empty() { "stranger" } else { &self.name }, self.clicks));
        });
    }
}

fn main() {
    nord_app_wasm::launch("My Rust app", |_cc| Box::new(App::default()));
}
