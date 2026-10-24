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
    pub timestamps: bool,
    /// show only this `[Tag]`
    pub tag: Option<String>,
    pub font_size: f32,
    /// index of the line shown in the detail pane
    pub selected: Option<usize>,
}

impl Default for ConsoleUi {
    fn default() -> Self {
        Self {
            show: [true; 4],
            filter: String::new(),
            stick: true,
            collapse: true,
            clear_on_play: true,
            timestamps: true,
            tag: None,
            font_size: 12.5,
            selected: None,
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

/// Indices of the lines in display order with their repeat count; with `collapse`, a repeated (level, text) folds into its first occurrence.
fn visible_idx(lines: &[LogLine], collapse: bool) -> Vec<(usize, usize)> {
    if !collapse {
        return (0..lines.len()).map(|i| (i, 1)).collect();
    }
    let mut out: Vec<(usize, usize)> = Vec::with_capacity(lines.len());
    let mut seen: std::collections::HashMap<(usize, &str), usize> = Default::default();
    for (i, l) in lines.iter().enumerate() {
        match seen.entry((level_idx(&l.level), l.text.as_str())) {
            std::collections::hash_map::Entry::Occupied(e) => out[*e.get()].1 += 1,
            std::collections::hash_map::Entry::Vacant(e) => {
                e.insert(out.len());
                out.push((i, 1));
            }
        }
    }
    out
}

#[cfg(test)]
fn visible_lines(lines: &[LogLine], collapse: bool) -> Vec<(&LogLine, usize)> {
    visible_idx(lines, collapse)
        .into_iter()
        .map(|(i, n)| (&lines[i], n))
        .collect()
}

/// Local UTC offset in seconds (unix: asked from `date` once; elsewhere UTC).
fn local_offset() -> i64 {
    static OFF: std::sync::OnceLock<i64> = std::sync::OnceLock::new();
    *OFF.get_or_init(|| {
        #[cfg(unix)]
        {
            if let Ok(o) = std::process::Command::new("date").arg("+%z").output() {
                let t = String::from_utf8_lossy(&o.stdout);
                let t = t.trim();
                if t.len() == 5 {
                    let sign = if t.starts_with('-') { -1 } else { 1 };
                    let h: i64 = t[1..3].parse().unwrap_or(0);
                    let m: i64 = t[3..5].parse().unwrap_or(0);
                    return sign * (h * 3600 + m * 60);
                }
            }
        }
        0
    })
}

fn clock(t: u64) -> String {
    let s = (t as i64 + local_offset()).rem_euclid(86400);
    format!("{:02}:{:02}:{:02}", s / 3600, s % 3600 / 60, s % 60)
}

/// Text with every occurrence of `q` (case-insensitive) on a yellow background.
fn highlighted(
    text: &str,
    q: &str,
    color: egui::Color32,
    font: egui::FontId,
) -> egui::text::LayoutJob {
    let mut job = egui::text::LayoutJob::default();
    let fmt = |bg: bool| egui::TextFormat {
        font_id: font.clone(),
        color: if bg { egui::Color32::BLACK } else { color },
        background: if bg {
            egui::Color32::from_rgb(250, 215, 70)
        } else {
            egui::Color32::TRANSPARENT
        },
        ..Default::default()
    };
    if q.is_empty() {
        job.append(text, 0.0, fmt(false));
        return job;
    }
    let (lt, lq) = (text.to_lowercase(), q.to_lowercase());
    if lt.len() != text.len() {
        job.append(text, 0.0, fmt(false));
        return job;
    }
    let mut at = 0;
    while let Some(i) = lt[at..].find(&lq) {
        job.append(&text[at..at + i], 0.0, fmt(false));
        job.append(&text[at + i..at + i + lq.len()], 0.0, fmt(true));
        at += i + lq.len();
    }
    job.append(&text[at..], 0.0, fmt(false));
    job
}

fn export(st: &mut EditorState, lines: &[String]) {
    let Some(root) = st.root.clone() else { return };
    let dir = root.join("logs");
    let _ = nord_core::vfs::create_dir_all(&dir);
    let name = format!(
        "console-{}.txt",
        clock(
            web_time::SystemTime::now()
                .duration_since(web_time::UNIX_EPOCH)
                .map_or(0, |d| d.as_secs())
        )
        .replace(':', "-")
    );
    let file = dir.join(name);
    match nord_core::vfs::write(&file, lines.join("\n") + "\n") {
        Ok(_) => st.toast(format!(
            "Exported {} lines to {}",
            lines.len(),
            file.display()
        )),
        Err(e) => st.toast(format!("Export failed: {e}")),
    }
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let th = st.themes.theme(&st.settings.theme).clone();
    let tint = |i: usize, ui: &Ui| level_color(i, ui, &th);
    let mut export_clicked = false;
    ui.horizontal_wrapped(|ui| {
        if icons_btn(ui, "trash-2", "Clear") {
            st.console.clear();
            st.console_ui.selected = None;
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
            let c = tint(i, ui);
            let on = st.console_ui.show[i];
            let b = egui::Button::image_and_text(
                crate::icons::icon(icon, 13.0, if on { c } else { c.gamma_multiply(0.5) }),
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
        ui.separator();
        // tag filter: every [Tag] seen in the log
        let mut tags: Vec<String> = st.console.iter().filter_map(|l| l.tag.clone()).collect();
        tags.sort();
        tags.dedup();
        egui::ComboBox::from_id_salt("console-tag")
            .selected_text(
                st.console_ui
                    .tag
                    .clone()
                    .map_or("All tags".to_string(), |t| format!("[{t}]")),
            )
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut st.console_ui.tag, None, "All tags");
                for t in tags {
                    ui.selectable_value(&mut st.console_ui.tag, Some(t.clone()), format!("[{t}]"));
                }
            });
        ui.add(
            egui::TextEdit::singleline(&mut st.console_ui.filter)
                .hint_text("Search…")
                .desired_width(150.0),
        );
        ui.toggle_value(&mut st.console_ui.collapse, "Collapse")
            .on_hover_text("Show identical lines once, with a count");
        ui.toggle_value(&mut st.console_ui.timestamps, "Time")
            .on_hover_text("Show when each line arrived");
        ui.toggle_value(&mut st.console_ui.stick, "Auto-scroll");
        ui.toggle_value(&mut st.console_ui.clear_on_play, "Clear on Play");
        ui.toggle_value(&mut st.error_pause, "Pause on error")
            .on_hover_text("Pause the game when an error is logged");
        ui.add(egui::Slider::new(&mut st.console_ui.font_size, 9.0..=22.0).show_value(false))
            .on_hover_text("Font size");
        if ui
            .small_button("Export…")
            .on_hover_text("Write the visible lines to logs/console-<time>.txt in the project")
            .clicked()
        {
            export_clicked = true;
        }
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
    let q = st.console_ui.filter.clone();
    let ql = q.to_lowercase();
    let tag_f = st.console_ui.tag.clone();
    let font = egui::FontId::monospace(st.console_ui.font_size);
    let visible: Vec<(usize, LogLine, usize)> = {
        visible_idx(&st.console, st.console_ui.collapse)
            .into_iter()
            .map(|(i, n)| (i, &st.console[i], n))
            .filter(|(_, l, _)| {
                st.console_ui.show[level_idx(&l.level)]
                    && (ql.is_empty() || l.text.to_lowercase().contains(&ql))
                    && tag_f.as_ref().is_none_or(|t| l.tag.as_ref() == Some(t))
            })
            .map(|(i, l, n)| (i, l.clone(), n))
            .collect()
    };
    if export_clicked {
        let lines: Vec<String> = visible
            .iter()
            .map(|(_, l, n)| {
                format!(
                    "{} [{}] {}{}",
                    clock(l.time),
                    ["info", "warn", "error", "build"][level_idx(&l.level)],
                    l.text,
                    if *n > 1 {
                        format!(" (x{n})")
                    } else {
                        String::new()
                    }
                )
            })
            .collect();
        export(st, &lines);
    }
    // detail pane with the full text of the selected line (drag the splitter to resize)
    let sel = st.console_ui.selected.filter(|i| *i < st.console.len());
    if let Some(i) = sel {
        let l = st.console[i].clone();
        egui::TopBottomPanel::bottom("console-detail")
            .resizable(true)
            .default_height(90.0)
            .show_inside(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.weak(format!(
                        "{} · {}",
                        clock(l.time),
                        ["Info", "Warn", "Error", "Build"][level_idx(&l.level)]
                    ));
                    if let Some(t) = &l.tag {
                        ui.label(RichText::new(format!("[{t}]")).strong());
                    }
                    if ui.small_button("Copy").clicked() {
                        ui.ctx().copy_text(l.text.clone());
                    }
                });
                egui::ScrollArea::vertical().show(ui, |ui| {
                    ui.add(
                        egui::Label::new(
                            RichText::new(&l.text)
                                .monospace()
                                .size(st.console_ui.font_size),
                        )
                        .selectable(true),
                    );
                });
            });
    }
    let mut open: Option<(String, usize)> = None;
    let mut picked: Option<usize> = None;
    egui::ScrollArea::vertical()
        .auto_shrink([false; 2])
        .stick_to_bottom(st.console_ui.stick)
        .show(ui, |ui| {
            ui.spacing_mut().item_spacing.y = 1.0;
            for (row, (idx, l, n)) in visible.iter().enumerate() {
                let li = level_idx(&l.level);
                // Info = grey, Warn = yellow, Error = red (Console Pro); Build in the accent colour
                let color = if li == 0 {
                    ui.visuals().weak_text_color().linear_multiply(1.4)
                } else {
                    tint(li, ui)
                };
                let loc = find_location(&l.text);
                let text = if *n > 1 {
                    format!("({n}) {}", l.text)
                } else {
                    l.text.clone()
                };
                let h = st.console_ui.font_size + 6.0;
                let (rect, resp) = ui
                    .allocate_exact_size(egui::vec2(ui.available_width(), h), egui::Sense::click());
                if row % 2 == 1 {
                    ui.painter().rect_filled(
                        rect,
                        0.0,
                        ui.visuals().faint_bg_color.gamma_multiply(0.5),
                    );
                }
                if st.console_ui.selected == Some(*idx) {
                    ui.painter()
                        .rect_filled(rect, 0.0, ui.visuals().selection.bg_fill);
                }
                let text_for_a11y = if *n > 1 {
                    format!("({n}) {}", l.text)
                } else {
                    l.text.clone()
                };
                let mut x = rect.left() + 4.0;
                let icon = ["info", "alert-triangle", "alert-circle", "hammer"][li];
                crate::icons::icon(icon, 12.0, color).paint_at(
                    ui,
                    egui::Rect::from_center_size(
                        egui::pos2(x + 6.0, rect.center().y),
                        egui::Vec2::splat(12.0),
                    ),
                );
                x += 18.0;
                if st.console_ui.timestamps {
                    let g = ui.painter().layout_no_wrap(
                        clock(l.time),
                        font.clone(),
                        ui.visuals().weak_text_color(),
                    );
                    ui.painter().galley(
                        egui::pos2(x, rect.center().y - g.size().y / 2.0),
                        g.clone(),
                        egui::Color32::WHITE,
                    );
                    x += g.size().x + 8.0;
                }
                if let Some(t) = &l.tag {
                    let g = ui.painter().layout_no_wrap(
                        format!("[{t}]"),
                        font.clone(),
                        crate::theme::hex(&th.ui.accent),
                    );
                    ui.painter().galley(
                        egui::pos2(x, rect.center().y - g.size().y / 2.0),
                        g.clone(),
                        egui::Color32::WHITE,
                    );
                    x += g.size().x + 6.0;
                }
                let body = l
                    .tag
                    .as_ref()
                    .and_then(|t| {
                        text.split_once(&format!("[{t}]"))
                            .map(|(_, r)| r.trim_start().to_string())
                    })
                    .unwrap_or(text);
                let galley = ui.painter().layout_job(highlighted(
                    &body.replace('\n', " ⏎ "),
                    &q,
                    color,
                    font.clone(),
                ));
                let gy = rect.center().y - galley.size().y / 2.0;
                ui.painter()
                    .with_clip_rect(rect)
                    .galley(egui::pos2(x, gy), galley, color);
                resp.widget_info(|| {
                    egui::WidgetInfo::labeled(egui::WidgetType::Button, true, &text_for_a11y)
                });
                let resp = if loc.is_some() {
                    resp.on_hover_text("Double-click to open the file and line")
                } else {
                    resp
                };
                if resp.clicked() {
                    picked = Some(*idx);
                }
                if resp.double_clicked() {
                    if let Some(loc) = loc {
                        open = Some(loc);
                    }
                }
                resp.context_menu(|ui| {
                    if ui.button("Copy line").clicked() {
                        ui.ctx().copy_text(l.text.clone());
                        ui.close_menu();
                    }
                    if let Some(t) = &l.tag {
                        if ui.button(format!("Only [{t}]")).clicked() {
                            st.console_ui.tag = Some(t.clone());
                            ui.close_menu();
                        }
                    }
                });
            }
        });
    if picked.is_some() {
        st.console_ui.selected = picked;
    }
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

fn icons_btn(ui: &mut Ui, icon: &'static str, tip: &str) -> bool {
    crate::icons::button(ui, icon, tip, false).clicked()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collapse_counts() {
        let mk = |t: &str| LogLine::new(LogLevel::Info, t);
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

#[cfg(test)]
mod pro_tests {
    use super::*;
    #[test]
    fn tags_and_highlight() {
        assert_eq!(
            LogLine::new(LogLevel::Info, "[Combat] hit 5")
                .tag
                .as_deref(),
            Some("Combat")
        );
        assert_eq!(LogLine::new(LogLevel::Info, "no tag [x]").tag, None);
        assert_eq!(LogLine::new(LogLevel::Info, "[two words] a").tag, None);
        let job = highlighted(
            "Hello World hello",
            "hello",
            egui::Color32::WHITE,
            egui::FontId::monospace(12.0),
        );
        assert_eq!(
            job.sections
                .iter()
                .filter(|s| s.format.background != egui::Color32::TRANSPARENT)
                .count(),
            2
        );
        assert_eq!(clock(1_700_000_000).len(), 8);
    }
}
