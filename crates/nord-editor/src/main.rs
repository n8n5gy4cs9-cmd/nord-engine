//! Nord Engine editor. Credit: Crowelian 2026 + Sonnet.
use nord_editor::app;

#[cfg(target_arch = "wasm32")]
fn main() {} // the web entry point is crates/nord-editor-web

#[cfg(not(target_arch = "wasm32"))]
fn main() -> eframe::Result {
    // Start as the borderless splash window; `App::splash` turns it into the main window after >= 2 s.
    let opts = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Nord Engine")
            .with_inner_size([600.0, 526.0])
            .with_decorations(false)
            .with_resizable(false)
            .with_icon(std::sync::Arc::new(load_icon())),
        ..Default::default()
    };
    // `nord-editor [project-dir]` opens a project directly (used by run.sh and smoke tests).
    let open = std::env::args().nth(1).map(std::path::PathBuf::from);
    eframe::run_native(
        "Nord Engine",
        opts,
        Box::new(move |_cc| {
            let mut a = app::App::new(true);
            if let Some(p) = open {
                a.st.push(nord_editor::state::Action::OpenPath(p));
            }
            Ok(Box::new(a))
        }),
    )
}

#[cfg(not(target_arch = "wasm32"))]
fn load_icon() -> egui::IconData {
    let img = image::load_from_memory(include_bytes!("../../../assets/brand/logo-256.png"))
        .map(|i| i.to_rgba8());
    match img {
        Ok(i) => egui::IconData {
            width: i.width(),
            height: i.height(),
            rgba: i.into_raw(),
        },
        Err(_) => egui::IconData::default(),
    }
}
