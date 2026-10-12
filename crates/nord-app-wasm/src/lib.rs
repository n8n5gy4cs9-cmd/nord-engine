//! Nord Engine app tier: write an `eframe::App`, call [`launch`]; the same code runs natively (`cargo run`) and on the web
//! (`nord export --target web-wasm-app`: cargo build + the `wasm-bindgen` CLI — no trunk, no CDN).
//! ```ignore
//! struct Hello;
//! impl eframe::App for Hello {
//!     fn update(&mut self, ctx: &egui::Context, _: &mut eframe::Frame) { egui::CentralPanel::default().show(ctx, |ui| { ui.heading("Hi"); }); }
//! }
//! fn main() { nord_app_wasm::launch("Hello", |_cc| Box::new(Hello)); }
//! ```
pub mod desktop;
pub mod ux;
pub use eframe;
pub use serde_json;
pub use eframe::egui;

/// Canvas id the exported `index.html` provides.
pub const CANVAS_ID: &str = "the_canvas_id";

/// Start the app. Native: opens a window and blocks. Web: attaches to `<canvas id="the_canvas_id">` and returns immediately.
pub fn launch(
    title: &str,
    make: impl FnOnce(&eframe::CreationContext<'_>) -> Box<dyn eframe::App> + 'static,
) {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let opts = eframe::NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_inner_size([960.0, 640.0])
                .with_title(title),
            ..Default::default()
        };
        let _ = eframe::run_native(title, opts, Box::new(move |cc| Ok(make(cc))));
    }
    #[cfg(target_arch = "wasm32")]
    {
        use eframe::wasm_bindgen::JsCast as _;
        let _ = title;
        wasm_bindgen_futures::spawn_local(async move {
            let canvas = web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.get_element_by_id(CANVAS_ID))
                .and_then(|e| e.dyn_into::<web_sys::HtmlCanvasElement>().ok())
                .expect("canvas #the_canvas_id not found in index.html");
            let res = eframe::WebRunner::new()
                .start(
                    canvas,
                    eframe::WebOptions::default(),
                    Box::new(move |cc| Ok(make(cc))),
                )
                .await;
            if let Err(e) = res {
                web_sys::console::error_1(&format!("nord-app-wasm: {e:?}").into());
            }
        });
    }
}
