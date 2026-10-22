//! Command palette (Cmd+K) and quick open (Cmd+P) with subsequence fuzzy matching.
use crate::state::{Action, EditorState, Tool};
use egui::{Context, Key};
use nord_core::vfs::PathExt;
use std::path::Path;

#[derive(Default, PartialEq, Clone, Copy)]
pub enum Mode {
    #[default]
    Closed,
    Commands,
    Files,
}

#[derive(Default)]
pub struct PaletteUi {
    pub mode: Mode,
    pub query: String,
    pub sel: usize,
    pub files: Vec<String>,
}

/// Subsequence match score (higher = better); None = no match.
pub fn fuzzy(query: &str, text: &str) -> Option<i32> {
    if query.is_empty() {
        return Some(0);
    }
    let t: Vec<char> = text.to_lowercase().chars().collect();
    let mut score = 0;
    let mut ti = 0;
    let mut last: Option<usize> = None;
    for qc in query.to_lowercase().chars() {
        let pos = t[ti..].iter().position(|&c| c == qc)? + ti;
        score += 10;
        if last.is_some_and(|l| pos == l + 1) {
            score += 15; // consecutive
        }
        if pos == 0 || !t[pos - 1].is_alphanumeric() {
            score += 12; // word start
        }
        score -= (pos - last.map_or(0, |l| l + 1)) as i32;
        last = Some(pos);
        ti = pos + 1;
    }
    Some(score - (t.len() as i32) / 8)
}

fn collect_files(root: &Path, dir: &Path, out: &mut Vec<String>) {
    let Ok(rd) = std::fs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let p = e.path();
        let n = e.file_name().to_string_lossy().into_owned();
        if p.v_is_dir() {
            if !matches!(
                n.as_str(),
                ".nord-cache" | "dist" | ".git" | "node_modules" | "target"
            ) {
                collect_files(root, &p, out);
            }
        } else if !n.ends_with(".meta.json") && out.len() < 20_000 {
            if let Ok(r) = p.strip_prefix(root) {
                out.push(r.to_string_lossy().replace('\\', "/"));
            }
        }
    }
}

type CmdFn = fn() -> Action;

pub const COMMANDS: &[(&str, CmdFn)] = &[
    ("File: New project…", || Action::NewProject),
    ("File: Open project…", || Action::OpenProject),
    ("File: Save", || Action::SaveAll),
    ("File: Close project", || Action::CloseProject),
    ("Edit: Undo", || Action::Undo),
    ("Edit: Redo", || Action::Redo),
    ("Edit: Duplicate", || Action::Duplicate),
    ("Edit: Delete", || Action::Delete),
    ("Entity: Add empty entity", || Action::AddEntity(None)),
    ("File: New scene…", || Action::NewScene),
    ("Help: First 10 minutes", || Action::Tutorial),
    ("Game: Screenshot", || Action::Screenshot),
    ("File: Build Settings…", || Action::BuildSettings),
    ("View: Frame all", || Action::FocusAll),
    ("View: Toggle Local/Global", || Action::ToggleSpace),
    ("View: Toggle Pivot/Center", || Action::TogglePivot),
    ("Tool: Hand", || Action::SetTool(Tool::Hand)),
    ("Tool: Move", || Action::SetTool(Tool::Move)),
    ("Tool: Rotate", || Action::SetTool(Tool::Rotate)),
    ("Tool: Scale", || Action::SetTool(Tool::Scale)),
    ("Tool: Rect", || Action::SetTool(Tool::Rect)),
    ("View: Toggle snap", || Action::ToggleSnap),
    ("View: Toggle grid", || Action::ToggleGrid),
    ("View: Focus selection", || Action::Focus),
    ("View: Scene tab", || {
        Action::ShowTab(crate::app::Tab::Scene)
    }),
    ("View: Game tab", || Action::ShowTab(crate::app::Tab::Game)),
    ("View: Code tab", || Action::ShowTab(crate::app::Tab::Code)),
    ("View: Assets tab", || {
        Action::ShowTab(crate::app::Tab::Assets)
    }),
    ("View: Console tab", || {
        Action::ShowTab(crate::app::Tab::Console)
    }),
    ("View: Library tab", || {
        Action::ShowTab(crate::app::Tab::Library)
    }),
    ("View: Docs tab", || Action::ShowTab(crate::app::Tab::Docs)),
    ("View: 2D Level Creator", || {
        Action::ShowTab(crate::app::Tab::Level2d)
    }),
    ("View: UI Designer", || {
        Action::ShowTab(crate::app::Tab::UiDesigner)
    }),
    ("View: Graph editor", || {
        Action::ShowTab(crate::app::Tab::Graph)
    }),
    ("View: FPS Level editor", || {
        Action::ShowTab(crate::app::Tab::Fps)
    }),
    ("Project: Add / upgrade FPS Creator", || Action::FpsInstall),
    ("View: Animation & tilemap tab", || {
        Action::ShowTab(crate::app::Tab::Animation)
    }),
    ("Run: Play", || Action::Play),
    ("Run: This Scene (F6)", || Action::PlayScene),
    ("Run: Stop", || Action::Stop),
    ("Run: Reload", || Action::Reload),
    ("Project: Validate", || Action::Build("validate".into())),
    ("Editor: Settings", || Action::Settings),
    ("View: Reset panel layout", || Action::ResetLayout),
    ("Editor: Reset settings + layout to defaults", || {
        Action::ResetSettings
    }),
    ("Project: Export…", || Action::Export),
    ("Project: Desktop app permissions…", || {
        Action::DesktopSettings
    }),
    ("Editor: About", || Action::About),
];

pub fn window(st: &mut EditorState, ctx: &Context) {
    if st.palette.mode == Mode::Closed {
        return;
    }
    if st.palette.mode == Mode::Files && st.palette.files.is_empty() {
        if let Some(r) = st.root.clone() {
            let mut f = vec![];
            collect_files(&r, &r, &mut f);
            st.palette.files = f;
        }
    }
    let mode = st.palette.mode;
    let q = st.palette.query.clone();
    let mut results: Vec<(i32, String, Option<Action>)> = match mode {
        Mode::Commands => COMMANDS
            .iter()
            .filter_map(|(n, a)| fuzzy(&q, n).map(|s| (s, n.to_string(), Some(a()))))
            .collect(),
        _ => st
            .palette
            .files
            .iter()
            .filter_map(|f| fuzzy(&q, f).map(|s| (s, f.clone(), None)))
            .collect(),
    };
    results.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    results.truncate(12);
    if st.palette.sel >= results.len() {
        st.palette.sel = results.len().saturating_sub(1);
    }
    let mut chosen: Option<usize> = None;
    let mut close = false;
    egui::Window::new(if mode == Mode::Commands {
        "Command palette"
    } else {
        "Quick open"
    })
    .title_bar(false)
    .collapsible(false)
    .resizable(false)
    .anchor(egui::Align2::CENTER_TOP, [0.0, 70.0])
    .fixed_size([520.0, 0.0])
    .show(ctx, |ui| {
        let r = ui.add(
            egui::TextEdit::singleline(&mut st.palette.query)
                .hint_text(if mode == Mode::Commands {
                    "Type a command…"
                } else {
                    "Type a file name…"
                })
                .desired_width(f32::INFINITY),
        );
        r.request_focus();
        if r.changed() {
            st.palette.sel = 0;
        }
        let (down, up, enter, esc) = ui.input(|i| {
            (
                i.key_pressed(Key::ArrowDown),
                i.key_pressed(Key::ArrowUp),
                i.key_pressed(Key::Enter),
                i.key_pressed(Key::Escape),
            )
        });
        if down && st.palette.sel + 1 < results.len() {
            st.palette.sel += 1;
        }
        if up && st.palette.sel > 0 {
            st.palette.sel -= 1;
        }
        if enter && !results.is_empty() {
            chosen = Some(st.palette.sel);
        }
        if esc {
            close = true;
        }
        for (i, (_, label, _)) in results.iter().enumerate() {
            if ui.selectable_label(i == st.palette.sel, label).clicked() {
                chosen = Some(i);
            }
        }
        if results.is_empty() {
            ui.weak("No matches");
        }
    });
    if let Some(i) = chosen {
        let (_, label, act) = results.swap_remove(i);
        match (mode, act) {
            (Mode::Commands, Some(a)) => st.push(a),
            (Mode::Files, _) => {
                if let Some(r) = st.root.clone() {
                    st.push(Action::OpenFile(r.join(&label), None));
                }
            }
            _ => {}
        }
        close = true;
    }
    if close {
        st.palette.mode = Mode::Closed;
        st.palette.query.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fuzzy_ranks_sensibly() {
        assert!(fuzzy("plr", "scripts/player.js").is_some());
        assert!(fuzzy("xyz", "scripts/player.js").is_none());
        let a = fuzzy("play", "Run: Play").unwrap();
        let b = fuzzy("play", "Replay level in the background").unwrap();
        assert!(a > b);
        assert_eq!(fuzzy("", "anything"), Some(0));
    }
}
