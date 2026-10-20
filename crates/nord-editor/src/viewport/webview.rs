//! Embedded web content (edit viewport, game, docs). With `--features webview` a `wry` child webview is placed over
//! the egui panel rect (macOS: WKWebView child view; verified only on macOS CI / by the owner, see KNOWN_ISSUES RISK-001).
//! Without the feature — or if creation fails — the pane shows a card with "Open in browser" (separate-window
//! fallback). Editor <-> page messaging does NOT depend on the webview: it goes over HTTP/SSE via nord-serve's Hub.
use egui::{Ui, Vec2};
use std::collections::{HashMap, HashSet};

#[cfg(any(all(target_os = "macos", feature = "webview"), test))]
fn mac_child_position(rect: egui::Rect, parent_height: f32, zoom: f32) -> Vec2 {
    // wry 0.50 converts top-left coordinates for an unflipped NSView. winit 0.30's
    // parent NSView is already flipped: compensate before wry performs its conversion.
    egui::vec2(rect.left(), parent_height - rect.bottom()) * zoom
}

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
    let _ = std::process::Command::new("explorer").arg(url).spawn();
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
    pub fn end_frame(&mut self, overlay: bool) {
        if overlay {
            self.shown.clear();
        }
        #[cfg(feature = "webview")]
        for (k, wv) in &self.panes {
            let _ = wv.set_visible(self.shown.contains(k));
        }
        #[cfg(target_arch = "wasm32")]
        for k in self.panes.keys() {
            crate::web::set_iframe_visible(k, self.shown.contains(k));
        }
    }

    /// Destroy a pane (stops whatever page it was running, e.g. on Stop).
    pub fn drop_pane(&mut self, key: &str) {
        #[cfg(target_arch = "wasm32")]
        crate::web::remove_iframe(key);
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
        #[cfg(target_arch = "wasm32")]
        crate::web::reload_iframe(key);
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
        if !overlay {
            self.shown.insert(key.to_string());
        }
        self.rects.insert(key.to_string(), rect);
        #[cfg(feature = "webview")]
        {
            use wry::dpi::{LogicalPosition, LogicalSize};
            let z = ui.ctx().zoom_factor();
            #[cfg(target_os = "macos")]
            let position = mac_child_position(rect, ui.ctx().screen_rect().height(), z);
            #[cfg(not(target_os = "macos"))]
            let position = rect.min.to_vec2() * z;
            let bounds = wry::Rect {
                position: LogicalPosition::new(position.x as f64, position.y as f64).into(),
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
        // browser: an <iframe> over the reserved rect (the page is served by the service worker, see crates/nord-editor-web/www/sw.js)
        #[cfg(target_arch = "wasm32")]
        {
            let z = ui.ctx().zoom_factor();
            // `…:0` is the web hub's stand-in for the dev server port; the page lives under `play/` next to the editor
            let page = url
                .strip_prefix("http://127.0.0.1:0/")
                .map(|r| format!("play/{r}"))
                .unwrap_or_else(|| url.to_string());
            let page = if page.contains("__edit") { format!("{page}&web=1") } else { page };
            crate::web::place_iframe(key, &page, rect.min.x * z, rect.min.y * z, rect.width() * z, rect.height() * z, !overlay);
            self.panes.insert(key.to_string(), ());
            if overlay {
                ui.painter().rect_filled(rect, 0.0, ui.visuals().extreme_bg_color);
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
        // fallback card
        #[allow(unreachable_code)]
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
    fn mac_webview_matches_egui_top_left_in_flipped_winit_view() {
        for zoom in [1.0, 1.5] {
            for y in [100.0, 140.0] {
                let rect = egui::Rect::from_min_size(egui::pos2(40.0, y), egui::vec2(640.0, 360.0));
                let pos = mac_child_position(rect, 900.0, zoom);
                // wry 0.50 assumes an unflipped NSView and computes this frame origin;
                // winit's NSView is flipped, so that origin is already a top-left coordinate.
                let frame_y = 900.0 * zoom - pos.y - rect.height() * zoom;
                assert_eq!(
                    frame_y,
                    rect.top() * zoom,
                    "native webview vertically mirrored"
                );
                assert_eq!(pos.x, rect.left() * zoom);
            }
        }
    }

    #[test]
    fn dialog_keeps_webview_hidden_at_end_of_frame() {
        let ctx = egui::Context::default();
        let mut web = WebPanes::default();
        for overlay in [false, true, false] {
            web.begin_frame();
            let _ = ctx.run(Default::default(), |ctx| {
                egui::CentralPanel::default().show(ctx, |ui| {
                    web.show(ui, None, "scene", "http://127.0.0.1/__edit", overlay);
                });
            });
            web.end_frame(overlay);
            assert_eq!(
                web.shown.contains("scene"),
                !overlay,
                "end_frame must not re-show a view hidden by a dialog"
            );
        }
    }

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
