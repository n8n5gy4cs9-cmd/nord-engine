//! Embedded web content (edit viewport, game, docs). With `--features webview` a `wry` child webview is placed over
//! the egui panel rect (macOS: WKWebView child view; verified only on macOS CI / by the owner, see KNOWN_ISSUES RISK-001).
//! Without the feature — or if creation fails — the pane shows a card with "Open in browser" (separate-window
//! fallback). Editor <-> page messaging does NOT depend on the webview: it goes over HTTP/SSE via nord-serve's Hub.
use egui::{Ui, Vec2};
use std::collections::{HashMap, HashSet};

#[derive(Default)]
pub struct WebPanes {
    #[cfg(feature = "webview")]
    panes: HashMap<String, wry::WebView>,
    #[cfg(not(feature = "webview"))]
    panes: HashMap<String, ()>,
    shown: HashSet<String>,
    urls: HashMap<String, String>,
    pub error: Option<String>,
}

pub fn open_in_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd").args(["/C", "start", url]).spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

impl WebPanes {
    pub fn begin_frame(&mut self) {
        self.shown.clear();
    }

    /// Hide panes whose tab was not drawn this frame (egui_dock only calls `ui` for visible tabs).
    pub fn end_frame(&mut self) {
        #[cfg(feature = "webview")]
        for (k, wv) in &self.panes {
            let _ = wv.set_visible(self.shown.contains(k));
        }
    }

    /// Destroy a pane (stops whatever page it was running, e.g. on Stop).
    pub fn drop_pane(&mut self, key: &str) {
        self.panes.remove(key);
        self.urls.remove(key);
    }

    pub fn available() -> bool {
        cfg!(feature = "webview")
    }

    /// Run JS in a pane (no-op without webview).
    #[allow(unused_variables)]
    pub fn eval(&self, key: &str, js: &str) {
        #[cfg(feature = "webview")]
        if let Some(wv) = self.panes.get(key) {
            let _ = wv.evaluate_script(js);
        }
    }

    /// Reload the pane's URL (used by Play/Reload).
    #[allow(unused_variables)]
    pub fn reload(&mut self, key: &str) {
        #[cfg(feature = "webview")]
        if let (Some(wv), Some(u)) = (self.panes.get(key), self.urls.get(key)) {
            let _ = wv.load_url(u);
        }
    }

    /// Draw the pane into `ui`. `overlay` = an egui popup/modal is open: native views would cover it, so hide meanwhile.
    #[allow(unused_variables)]
    pub fn show(&mut self, ui: &mut Ui, frame: &eframe::Frame, key: &str, url: &str, overlay: bool) -> bool {
        let size = ui.available_size().max(Vec2::splat(10.0));
        let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
        self.shown.insert(key.to_string());
        #[cfg(feature = "webview")]
        {
            use wry::dpi::{LogicalPosition, LogicalSize};
            let z = ui.ctx().zoom_factor();
            let bounds = wry::Rect {
                position: LogicalPosition::new((rect.min.x * z) as f64, (rect.min.y * z) as f64).into(),
                size: LogicalSize::new((rect.width() * z) as f64, (rect.height() * z) as f64).into(),
            };
            if !self.panes.contains_key(key) {
                match wry::WebViewBuilder::new().with_url(url).with_bounds(bounds).build_as_child(frame) {
                    Ok(wv) => {
                        self.panes.insert(key.to_string(), wv);
                        self.urls.insert(key.to_string(), url.to_string());
                    }
                    Err(e) => self.error = Some(format!("webview: {e}")),
                }
            }
            if let Some(wv) = self.panes.get(key) {
                if self.urls.get(key).map(String::as_str) != Some(url) {
                    let _ = wv.load_url(url);
                    self.urls.insert(key.to_string(), url.to_string());
                }
                let _ = wv.set_bounds(bounds);
                let _ = wv.set_visible(!overlay);
                if overlay {
                    ui.painter().rect_filled(rect, 0.0, ui.visuals().extreme_bg_color);
                    ui.painter().text(rect.center(), egui::Align2::CENTER_CENTER, "(paused while a menu is open)", egui::FontId::proportional(13.0), ui.visuals().weak_text_color());
                }
                return true;
            }
        }
        // fallback card
        let mut child = ui.new_child(egui::UiBuilder::new().max_rect(rect));
        child.vertical_centered(|ui| {
            ui.add_space(rect.height() * 0.3);
            ui.heading("Web view");
            ui.label(if Self::available() {
                self.error.clone().unwrap_or_else(|| "Could not create the embedded webview.".into())
            } else {
                "This build has no embedded webview (cargo feature `webview`).".into()
            });
            ui.weak(url);
            if ui.button("Open in browser").clicked() {
                open_in_browser(url);
            }
        });
        false
    }
}
