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
    /// Last rect (egui points) each pane was placed at — what the native view is sized to; used by tests.
    pub rects: HashMap<String, egui::Rect>,
    use_cached_content: bool,
}

/// A fixed-size view: pixel size, anchor (0..1, x/y) inside the panel and pixel offset from that anchor.
pub struct Fixed {
    pub size: Vec2,
    pub anchor: [f32; 2],
    pub offset: [f32; 2],
    /// scale up to the largest aspect-correct size that fits (the Fit mode)
    pub fit: bool,
}

pub fn open_in_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", url])
        .spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}

impl WebPanes {
    /// Browser storage is temporary by default; switching mode recreates every pane.
    pub fn set_use_cached_content(&mut self, enabled: bool) {
        if self.use_cached_content != enabled {
            self.panes.clear();
            self.urls.clear();
            self.rects.clear();
            self.use_cached_content = enabled;
        }
    }

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
    pub fn show(
        &mut self,
        ui: &mut Ui,
        frame: Option<&eframe::Frame>,
        key: &str,
        url: &str,
        overlay: bool,
    ) -> bool {
        self.show_sized(ui, frame, key, url, overlay, None)
    }

    #[allow(unused_variables)]
    /// Like [`show`](Self::show) but optionally with a fixed pixel size (centered in the available area, never larger than it).
    pub fn show_sized(
        &mut self,
        ui: &mut Ui,
        frame: Option<&eframe::Frame>,
        key: &str,
        url: &str,
        overlay: bool,
        fixed: Option<Fixed>,
    ) -> bool {
        let size = ui.available_size().max(Vec2::splat(10.0));
        let (full, _) = ui.allocate_exact_size(size, egui::Sense::hover());
        let rect = match fixed {
            // keep the aspect ratio: scale down uniformly when the panel is smaller than the requested size
            Some(Fixed {
                size: f,
                anchor: a,
                offset: o,
                fit,
            }) => {
                // size comes from the whole panel; anchor places the view in the free space and the offset then translates it
                // by exactly that many pixels (size unchanged — it may overlap neighbouring panels, that is what you asked for)
                let k = (size.x / f.x).min(size.y / f.y);
                let k = if fit { k } else { k.min(1.0) }; // Fit also scales up
                let f = (f * k).max(Vec2::splat(10.0));
                let free = (size - f).max(Vec2::ZERO);
                egui::Rect::from_min_size(
                    full.min + egui::vec2(free.x * a[0] + o[0], free.y * a[1] + o[1]),
                    f,
                )
            }
            None => full,
        };
        // a native view is not clipped by egui: keep it inside the visible part of its panel — unless the user moved it
        // with an explicit offset, then only the window edge limits it
        let moved = fixed.as_ref().is_some_and(|f| f.offset != [0.0, 0.0]);
        let limit = if moved {
            ui.ctx().screen_rect()
        } else {
            ui.clip_rect()
        };
        let rect = {
            let c = rect.intersect(limit);
            if c.is_positive() {
                c
            } else {
                egui::Rect::from_min_size(rect.min, Vec2::splat(1.0))
            }
        };
        // the native view lags a frame behind egui's layout: repaint once more whenever its rect moved
        if self.rects.get(key) != Some(&rect) {
            ui.ctx().request_repaint();
        }
        if fixed.is_some() {
            ui.painter()
                .rect_filled(full, 0.0, ui.visuals().extreme_bg_color);
        }
        self.shown.insert(key.to_string());
        self.rects.insert(key.to_string(), rect);
        #[cfg(feature = "webview")]
        {
            use wry::dpi::{LogicalPosition, LogicalSize};
            let z = ui.ctx().zoom_factor();
            let bounds = wry::Rect {
                position: LogicalPosition::new((rect.min.x * z) as f64, (rect.min.y * z) as f64)
                    .into(),
                size: LogicalSize::new((rect.width() * z) as f64, (rect.height() * z) as f64)
                    .into(),
            };
            if let (false, Some(frame)) = (self.panes.contains_key(key), frame) {
                match wry::WebViewBuilder::new()
                    .with_incognito(!self.use_cached_content)
                    .with_url(url)
                    .with_bounds(bounds)
                    .build_as_child(frame)
                {
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
                    ui.painter()
                        .rect_filled(rect, 0.0, ui.visuals().extreme_bg_color);
                    ui.painter().text(
                        rect.center(),
                        egui::Align2::CENTER_CENTER,
                        "(paused while a menu is open)",
                        egui::FontId::proportional(13.0),
                        ui.visuals().weak_text_color(),
                    );
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
                self.error
                    .clone()
                    .unwrap_or_else(|| "Could not create the embedded webview.".into())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_mode_defaults_fresh_and_recreates_panes_when_changed() {
        let mut web = WebPanes::default();
        assert!(!web.use_cached_content);
        web.urls
            .insert("game".into(), "http://127.0.0.1/game".into());
        web.set_use_cached_content(false);
        assert!(web.urls.contains_key("game"));
        web.set_use_cached_content(true);
        assert!(web.use_cached_content);
        assert!(web.urls.is_empty());
        web.urls
            .insert("game".into(), "http://127.0.0.1/game".into());
        web.set_use_cached_content(false);
        assert!(!web.use_cached_content);
        assert!(web.urls.is_empty());
    }
}
