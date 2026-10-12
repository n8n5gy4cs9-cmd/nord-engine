use crate::state::{Action, EditorState, LogLevel};
use crate::theme::hex;
use egui::{RichText, Ui};

pub struct ConsoleUi {
    pub show: [bool; 4], // info, warn, error, build
    pub filter: String,
    pub stick: bool,
}

impl Default for ConsoleUi {
    fn default() -> Self {
        Self { show: [true; 4], filter: String::new(), stick: true }
    }
}

/// `path/file.ext:LINE[:COL]` anywhere in a line -> (path, line0)
pub fn find_location(s: &str) -> Option<(String, usize)> {
    for tok in s.split(|c: char| c.is_whitespace() || "()[]'\"<>".contains(c)) {
        let mut parts = tok.trim_end_matches([':', ',', '.']).split(':');
        let (Some(p), Some(l)) = (parts.next(), parts.next()) else { continue };
        let ext_ok = ["js", "mjs", "ts", "rs", "json", "html", "css", "toml", "wgsl", "glsl"].iter().any(|e| p.ends_with(&format!(".{e}")));
        if ext_ok {
            if let Ok(n) = l.parse::<usize>() {
                return Some((p.to_string(), n.saturating_sub(1)));
            }
        }
    }
    None
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    ui.horizontal(|ui| {
        if ui.small_button("Clear").clicked() {
            st.console.clear();
        }
        for (i, (n, c)) in [("Info", None), ("Warn", Some("warn")), ("Error", Some("bad")), ("Build", None)].iter().enumerate() {
            let _ = c;
            ui.toggle_value(&mut st.console_ui.show[i], *n);
        }
        ui.add(egui::TextEdit::singleline(&mut st.console_ui.filter).hint_text("Filter…").desired_width(160.0));
        if ui.small_button("Validate project").clicked() {
            st.push(Action::Build("validate".into()));
        }
        if st.project.as_ref().is_some_and(|p| matches!(p.kind, nord_core::ProjectType::WasmGame | nord_core::ProjectType::WasmApp)) && ui.small_button("cargo check").clicked() {
            st.push(Action::Build("cargo check".into()));
        }
    });
    ui.separator();
    let th = st.themes.theme(&st.settings.theme).clone();
    let filter = st.console_ui.filter.to_lowercase();
    let mut open: Option<(String, usize)> = None;
    egui::ScrollArea::vertical().auto_shrink([false; 2]).stick_to_bottom(st.console_ui.stick).show(ui, |ui| {
        for l in &st.console {
            let idx = match l.level {
                LogLevel::Info => 0,
                LogLevel::Warn => 1,
                LogLevel::Error => 2,
                LogLevel::Build => 3,
            };
            if !st.console_ui.show[idx] || (!filter.is_empty() && !l.text.to_lowercase().contains(&filter)) {
                continue;
            }
            let color = match l.level {
                LogLevel::Info => ui.visuals().text_color(),
                LogLevel::Warn => hex(&th.ui.warn),
                LogLevel::Error => hex(&th.ui.bad),
                LogLevel::Build => hex(&th.ui.accent),
            };
            let loc = find_location(&l.text);
            let r = ui.add(egui::Label::new(RichText::new(&l.text).monospace().color(color)).sense(if loc.is_some() { egui::Sense::click() } else { egui::Sense::hover() }));
            if let Some(loc) = loc {
                if r.on_hover_cursor(egui::CursorIcon::PointingHand).on_hover_text("Click to open").clicked() {
                    open = Some(loc);
                }
            }
        }
    });
    if let Some((p, line)) = open {
        let root = st.root.clone().unwrap_or_default();
        let path = if std::path::Path::new(&p).is_absolute() { p.into() } else { root.join(&p) };
        st.push(Action::OpenFile(path, Some(line)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locations() {
        assert_eq!(find_location("TypeError at scripts/player.js:12:5"), Some(("scripts/player.js".into(), 11)));
        assert_eq!(find_location("  --> crates/x/src/main.rs:40:9"), Some(("crates/x/src/main.rs".into(), 39)));
        assert_eq!(find_location("http://x/y.js (scripts/a.js:3)"), Some(("scripts/a.js".into(), 2)));
        assert_eq!(find_location("no location here"), None);
    }
}
