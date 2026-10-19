//! Phone / tablet preview (M10-24): serves the running game on the local network and shows a QR code to open it.
use crate::state::{EditorState, LogLevel};
use egui::{Color32, Context, Rect, Sense, Vec2};

/// Start (or stop) the LAN preview server.
pub fn toggle(st: &mut EditorState) {
    if st.lan.is_some() {
        st.lan = None;
        st.lan_open = false;
        st.toast("Phone preview stopped");
        return;
    }
    let (Some(root), Some(engine)) = (st.root.clone(), nord_serve::engine_root()) else {
        st.toast("Open a project first");
        return;
    };
    match nord_serve::start_lan(root, engine, 0) {
        Ok(l) => {
            st.lan_log_seen = 0;
            st.log(LogLevel::Info, format!("Phone preview on port {} (needs the same Wi-Fi)", l.port));
            st.lan = Some(l);
            st.lan_open = true;
        }
        Err(e) => st.log(LogLevel::Error, format!("Phone preview: {e}")),
    }
}

/// QR modules as a square bool grid (`true` = dark), quiet zone not included.
pub fn qr_modules(text: &str) -> Option<(usize, Vec<bool>)> {
    let code = qrcode::QrCode::new(text.as_bytes()).ok()?;
    let w = code.width();
    let dark = code.to_colors().into_iter().map(|c| c == qrcode::Color::Dark).collect();
    Some((w, dark))
}

pub fn window(st: &mut EditorState, ctx: &Context) {
    if !st.lan_open {
        return;
    }
    let Some(lan) = &st.lan else {
        st.lan_open = false;
        return;
    };
    let urls = lan.urls.clone();
    let port = lan.port;
    let mut open = true;
    let mut stop = false;
    egui::Window::new("Phone preview").open(&mut open).collapsible(false).default_width(340.0).show(ctx, |ui| {
        match urls.first() {
            Some(url) => {
                ui.label("Scan with your phone (same Wi-Fi). The game reloads when you save, and the phone's console shows up in the Console tab.");
                if let Some((w, dark)) = qr_modules(url) {
                    let cell = 5.0;
                    let quiet = 4.0;
                    let size = (w as f32 + 2.0 * quiet) * cell;
                    let (r, _) = ui.allocate_exact_size(Vec2::splat(size), Sense::hover());
                    ui.painter().rect_filled(r, 4.0, Color32::WHITE);
                    for (i, d) in dark.iter().enumerate() {
                        if *d {
                            let (x, y) = ((i % w) as f32, (i / w) as f32);
                            let p = r.min + Vec2::new((x + quiet) * cell, (y + quiet) * cell);
                            ui.painter().rect_filled(Rect::from_min_size(p, Vec2::splat(cell)), 0.0, Color32::BLACK);
                        }
                    }
                }
                let mut shown = url.clone();
                ui.add(egui::TextEdit::singleline(&mut shown).desired_width(f32::INFINITY));
                if ui.button("Copy link").clicked() {
                    ui.ctx().copy_text(url.clone());
                }
            }
            None => {
                ui.label(format!("Listening on port {port}, but no network address was found. Connect to Wi-Fi and toggle the preview again."));
            }
        }
        ui.weak("Anyone with this link on your network can open the game while this is on. Only the game's files are shared, never the editor.");
        if ui.button("Stop phone preview").clicked() {
            stop = true;
        }
    });
    if stop {
        toggle(st);
    } else if !open {
        st.lan_open = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn qr_for_a_lan_url_is_a_square_grid() {
        let (w, d) = qr_modules("http://192.168.1.20:4173/?k=0123456789abcdef0123456789abcdef").unwrap();
        assert!(w >= 29 && d.len() == w * w);
        assert!(d.iter().filter(|x| **x).count() > w, "has dark modules");
    }
}
