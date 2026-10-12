//! Nord Engine editor. Credit: Crowelian 2026 + Sonnet.
mod app;
mod code;
mod icons;
mod panels;
mod scene_ops;
mod schema;
mod state;
mod theme;
mod undo;
mod viewport;

fn main() -> eframe::Result {
    let mut opts = eframe::NativeOptions::default();
    // Start as the borderless splash window; `App::splash` turns it into the main window after >= 2 s.
    opts.viewport = egui::ViewportBuilder::default()
        .with_title("Nord Engine")
        .with_inner_size([640.0, 360.0])
        .with_decorations(false)
        .with_resizable(false)
        .with_icon(std::sync::Arc::new(load_icon()));
    eframe::run_native("Nord Engine", opts, Box::new(|_cc| Ok(Box::new(app::App::new(true)))))
}

fn load_icon() -> egui::IconData {
    let img = image::load_from_memory(include_bytes!("../../../assets/brand/logo-256.png")).map(|i| i.to_rgba8());
    match img {
        Ok(i) => egui::IconData { width: i.width(), height: i.height(), rgba: i.into_raw() },
        Err(_) => egui::IconData::default(),
    }
}
