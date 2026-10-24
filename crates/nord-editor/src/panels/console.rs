use crate::state::{Action, EditorState, LogLevel, LogLine};
use crate::theme::hex;
use egui::{RichText, Ui};

pub struct ConsoleUi {
    pub show: [bool; 4], // info, warn, error, build
    pub filter: String,
    pub stick: bool,
    /// Unity-style Collapse: identical lines are shown once with a count
    pub collapse: bool,
    /// Unity-style Clear on Play: start each run with an empty console
    pub clear_on_play: bool,
}

impl Default for ConsoleUi {
    fn default() -> Self {
        Self {
            show: [true; 4],
            filter: String::new(),
            stick: true,
            collapse: true,
            clear_on_play: true,
        }
    }
}

/// `path/file.ext:LINE[:COL]` anywhere in a line -> (path, line0)
pub fn find_location(s: &str) -> Option<(String, usize)> {
    for tok in s.split(|c: char| c.is_whitespace() || "()[]'\"<>".contains(c)) {
        let mut parts = tok.trim_end_matches([':', ',', '.']).split(':');
        let (Some(p), Some(l)) = (parts.next(), parts.next()) else {
            continue;
        };
        let ext_ok = [
            "js", "mjs", "ts", "rs", "json", "html", "css", "toml", "wgsl", "glsl",
        ]
        .iter()
        .any(|e| p.ends_with(&format!(".{e}")));
        if ext_ok {
            if let Ok(n) = l.parse::<usize>() {
                return Some((p.to_string(), n.saturating_sub(1)));
            }
        }
    }
    None
}

fn level_color(i: usize, ui: &Ui, th: &crate::theme::Theme) -> egui::Color32 {
    match i {
        0 => ui.visuals().text_color(),
        1 => hex(&th.ui.warn),
        2 => hex(&th.ui.bad),
        _ => hex(&th.ui.accent),
    }
}

fn level_idx(l: &LogLevel) -> usize {
    match l {
        LogLevel::Info => 0,
        LogLevel::Warn => 1,
        LogLevel::Error => 2,
        LogLevel::Build => 3,
    }
}

/// Lines in display order; with `collapse`, a repeated (level, text) is folded into its first occurrence with a count.
fn visible_lines(lines: &[LogLine], collapse: bool) -> Vec<(&LogLine, usize)> {
    let mut out: Vec<(&LogLine, usize)> = Vec::with_capacity(lines.len());
    if !collapse {
        return lines.iter().map(|l| (l, 1)).collect();
    }
    let mut seen: std::collections::HashMap<(usize, &str), usize> = Default::default();
    for l in lines {
        match seen.entry((level_idx(&l.level), l.text.as_str())) {
            std::collections::hash_map::Entry::Occupied(e) => out[*e.get()].1 += 1,
            std::collections::hash_map::Entry::Vacant(e) => {
                e.insert(out.len());
                out.push((l, 1));
            }
        }
    }
    out
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    ui.horizontal_wrapped(|ui| {
        if ui.small_button("Clear").clicked() {
            st.console.clear();
        }
        for (i, (n, icon)) in [
            ("Info", "info"),
            ("Warn", "alert-triangle"),
            ("Error", "alert-circle"),
            ("Build", "hammer"),
        ]
        .iter()
        .enumerate()
        {
            let count = st
                .console
                .iter()
                .filter(|l| level_idx(&l.level) == i)
                .count();
            let tint = level_color(i, ui, &st.themes.theme(&st.settings.theme).clone());
            let on = st.console_ui.show[i];
            let b = egui::Button::image_and_text(
                crate::icons::icon(icon, 13.0, if on { tint } else { tint.gamma_multiply(0.5) }),
                format!("{n} {count}"),
            )
            .selected(on);
            if ui
                .add(b)
                .on_hover_text(format!("Show / hide {n} lines"))
                .clicked()
            {
                st.console_ui.show[i] = !on;
            }
        }
        ui.toggle_value(&mut st.console_ui.collapse, "Collapse")
            .on_hover_text("Show identical lines once, with a count");
        ui.toggle_value(&mut st.console_ui.clear_on_play, "Clear on Play");
        ui.add(
            egui::TextEdit::singleline(&mut st.console_ui.filter)
                .hint_text("Filter…")
                .desired_width(160.0),
        );
        if ui.small_button("Validate project").clicked() {
            st.push(Action::Build("validate".into()));
        }
        if st.project.as_ref().is_some_and(|p| {
            matches!(
                p.kind,
                nord_core::ProjectType::WasmGame | nord_core::ProjectType::WasmApp
            )
        }) {
            if ui.small_button("Build Rust").clicked() {
                st.push(Action::Build("rust build".into()));
            }
            if ui.small_button("cargo check").clicked() {
                st.push(Action::Build("cargo check".into()));
            }
        }
    });
    ui.separator();
    let th = st.themes.theme(&st.settings.theme).clone();
    let filter = st.console_ui.filter.to_lowercase();
    let mut open: Option<(String, usize)> = None;
    egui::ScrollArea::vertical()
        .auto_shrink([false; 2])
        .stick_to_bottom(st.console_ui.stick)
        .show(ui, |ui| {
            for (l, n) in visible_lines(&st.console, st.console_ui.collapse) {
                let idx = level_idx(&l.level);
                if !st.console_ui.show[idx]
                    || (!filter.is_empty() && !l.text.to_lowercase().contains(&filter))
                {
                    continue;
                }
                let color = match l.level {
                    LogLevel::Info => ui.visuals().text_color(),
                    LogLevel::Warn => hex(&th.ui.warn),
                    LogLevel::Error => hex(&th.ui.bad),
                    LogLevel::Build => hex(&th.ui.accent),
                };
                let loc = find_location(&l.text);
                let icon = ["info", "alert-triangle", "alert-circle", "hammer"][idx];
                ui.horizontal(|ui| {
                    ui.add(crate::icons::icon(icon, 12.0, color));
                    ui.spacing_mut().item_spacing.x = 4.0;
                    let r = ui.add(
                        egui::Label::new(
                            RichText::new(if n > 1 {
                                format!("({n}) {}", l.text)
                            } else {
                                l.text.clone()
                            })
                            .monospace()
                            .color(color),
                        )
                        .sense(if loc.is_some() {
                            egui::Sense::click()
                        } else {
                            egui::Sense::hover()
                        }),
                    );
                    if let Some(loc) = loc {
                        if r.on_hover_cursor(egui::CursorIcon::PointingHand)
                            .on_hover_text("Click to open")
                            .clicked()
                        {
                            open = Some(loc);
                        }
                    }
                });
            }
        });
    if let Some((p, line)) = open {
        let root = st.root.clone().unwrap_or_default();
        let path = if std::path::Path::new(&p).is_absolute() {
            p.into()
        } else {
            root.join(&p)
        };
        st.push(Action::OpenFile(path, Some(line)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapse_counts() {
        let mk = |t: &str| LogLine {
            level: LogLevel::Info,
            text: t.into(),
        };
        let v = vec![mk("a"), mk("b"), mk("a"), mk("a")];
        let c = visible_lines(&v, true);
        assert_eq!(
            c.iter()
                .map(|(l, n)| (l.text.as_str(), *n))
                .collect::<Vec<_>>(),
            [("a", 3), ("b", 1)]
        );
        assert_eq!(visible_lines(&v, false).len(), 4);
    }

    #[test]
    fn locations() {
        assert_eq!(
            find_location("TypeError at scripts/player.js:12:5"),
            Some(("scripts/player.js".into(), 11))
        );
        assert_eq!(
            find_location("  --> crates/x/src/main.rs:40:9"),
            Some(("crates/x/src/main.rs".into(), 39))
        );
        assert_eq!(
            find_location("http://x/y.js (scripts/a.js:3)"),
            Some(("scripts/a.js".into(), 2))
        );
        assert_eq!(find_location("no location here"), None);
    }
}
