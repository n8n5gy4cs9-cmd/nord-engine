//! Web entry point of the Nord editor (M11-05). Native builds compile this crate to nothing.
#![cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

/// Start the editor on `<canvas id=canvas_id>`. Called from `www/index.html`.
#[wasm_bindgen]
pub async fn start(canvas_id: String) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    nord_editor::web::init().await; // restore the project tree from IndexedDB
    let canvas = web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.get_element_by_id(&canvas_id))
        .and_then(|e| e.dyn_into::<HtmlCanvasElement>().ok())
        .ok_or_else(|| JsValue::from_str("canvas not found"))?;
    eframe::WebRunner::new()
        .start(
            canvas,
            eframe::WebOptions::default(),
            Box::new(|_cc| Ok(Box::new(nord_editor::app::App::new(false)))),
        )
        .await
}

/// A file of the open project, for the service worker that serves the Play / edit iframes. `undefined` = not found.
#[wasm_bindgen]
pub fn read_project_file(path: &str) -> Option<Vec<u8>> {
    nord_editor::web::read_project_file(path)
}
