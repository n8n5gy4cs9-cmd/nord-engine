//! Native code editor on `egui::TextEdit` + our tokenizer highlighter. See docs/EDITOR_UI.md.
use nord_core::vfs::PathExt;
pub mod api;
pub mod edit;
pub mod highlight;
pub mod multi;

use crate::{
    icons,
    state::{Action, EditorState, LogLevel},
    theme::hex,
};
use edit::Edit;
use egui::{
    text::{CCursor, CCursorRange},
    Color32, Id, Key, Modifiers, Pos2, Rect, Sense, Stroke, Ui, Vec2,
};
use highlight::Lang;
use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    sync::mpsc::{channel, Receiver, Sender},
    time::Duration,
};
use web_time::Instant;

const MAX_HIGHLIGHT: usize = 400_000;

#[derive(Clone)]
pub struct Problem {
    pub line: usize, // 0-based
    pub msg: String,
}

pub struct Doc {
    pub path: PathBuf,
    pub rel: String,
    pub text: String,
    pub saved: String,
    pub lang: Lang,
    pub problems: Vec<Problem>,
    mtime: Option<web_time::SystemTime>,
    hl: Option<(u64, std::sync::Arc<egui::text::LayoutJob>)>,
    pub scroll_y: f32,
    goto: Option<usize>,
    /// secondary selections (multi-cursor); primary lives in the TextEdit state
    pub extra: Vec<multi::Sel>,
    extra_len: usize,
    prev_primary: Option<multi::Sel>,
}

impl Doc {
    pub fn dirty(&self) -> bool {
        self.text != self.saved
    }
}

#[derive(Default)]
pub struct Find {
    pub open: bool,
    pub replace: bool,
    pub query: String,
    pub repl: String,
    pub regex: bool,
    pub case: bool,
    pub cur: usize,
    focus: bool,
}

pub struct Completion {
    pub items: Vec<api::Item>,
    pub sel: usize,
    pub start: usize,
}

pub struct CodeState {
    pub docs: Vec<Doc>,
    pub active: usize,
    pub split: Option<usize>,
    pub find: Find,
    pub goto: Option<String>,
    pub search_open: bool,
    pub search_q: String,
    pub search_res: Vec<(String, usize, String)>,
    pub minimap: bool,
    pub completion: Option<Completion>,
    pub confirm_close: Option<usize>,
    tx: Sender<(PathBuf, Vec<Problem>)>,
    rx: Receiver<(PathBuf, Vec<Problem>)>,
    last_disk_check: Instant,
}

impl Default for CodeState {
    fn default() -> Self {
        let (tx, rx) = channel();
        Self {
            docs: vec![],
            active: 0,
            split: None,
            find: Find::default(),
            goto: None,
            search_open: false,
            search_q: String::new(),
            search_res: vec![],
            minimap: true,
            completion: None,
            confirm_close: None,
            tx,
            rx,
            last_disk_check: Instant::now(),
        }
    }
}

impl CodeState {
    pub fn open(
        &mut self,
        root: Option<&Path>,
        path: &Path,
        line: Option<usize>,
    ) -> Result<(), String> {
        if let Some(i) = self.docs.iter().position(|d| d.path == path) {
            self.active = i;
            self.docs[i].goto = line;
            return Ok(());
        }
        let meta =
            nord_core::vfs::metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
        if meta.len() > 8_000_000 {
            return Err(format!(
                "{}: file too large for the editor (>8 MB)",
                path.display()
            ));
        }
        let bytes = nord_core::vfs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
        let text = String::from_utf8(bytes)
            .map_err(|_| format!("{}: not a UTF-8 text file", path.display()))?;
        let rel = root.and_then(|r| path.strip_prefix(r).ok()).map_or_else(
            || path.to_string_lossy().into_owned(),
            |p| p.to_string_lossy().replace('\\', "/"),
        );
        self.docs.push(Doc {
            path: path.to_path_buf(),
            lang: Lang::from_path(&rel),
            rel,
            saved: text.clone(),
            text,
            problems: vec![],
            mtime: meta.modified().ok(),
            hl: None,
            scroll_y: 0.0,
            goto: line,
            extra: vec![],
            extra_len: 0,
            prev_primary: None,
        });
        self.active = self.docs.len() - 1;
        let d = &self.docs[self.active];
        spawn_check(d.path.clone(), d.lang, d.text.clone(), self.tx.clone());
        Ok(())
    }

    pub fn save(&mut self, i: usize) -> Result<(), String> {
        let Some(d) = self.docs.get_mut(i) else {
            return Ok(());
        };
        nord_core::io::write_atomic(&d.path, d.text.as_bytes()).map_err(|e| e.to_string())?;
        d.saved = d.text.clone();
        d.mtime = nord_core::vfs::metadata(&d.path)
            .and_then(|m| m.modified())
            .ok();
        spawn_check(d.path.clone(), d.lang, d.text.clone(), self.tx.clone());
        Ok(())
    }

    pub fn close(&mut self, i: usize) {
        if i < self.docs.len() {
            self.docs.remove(i);
            self.active = self.active.min(self.docs.len().saturating_sub(1));
            if self.split.is_some_and(|s| s >= self.docs.len()) {
                self.split = None;
            }
        }
    }

    pub fn any_dirty(&self) -> bool {
        self.docs.iter().any(Doc::dirty)
    }
}

/// Syntax check: JSON via serde (instant), JS via `node --check` on a worker thread; results arrive through the channel.
fn spawn_check(path: PathBuf, lang: Lang, text: String, tx: Sender<(PathBuf, Vec<Problem>)>) {
    match lang {
        Lang::Json => {
            let p = match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(_) => vec![],
                Err(e) => vec![Problem {
                    line: e.line().saturating_sub(1),
                    msg: e.to_string(),
                }],
            };
            let _ = tx.send((path, p));
        }
        Lang::Js => {
            crate::platform::spawn(move || {
                let tmp =
                    std::env::temp_dir().join(format!("nord-check-{}.mjs", std::process::id()));
                let _ = nord_core::vfs::write(&tmp, &text);
                let out = std::process::Command::new("node")
                    .arg("--check")
                    .arg(&tmp)
                    .output();
                let _ = nord_core::vfs::remove_file(&tmp);
                let mut probs = vec![];
                if let Ok(o) = out {
                    if !o.status.success() {
                        probs = parse_node_error(&String::from_utf8_lossy(&o.stderr));
                    }
                }
                let _ = tx.send((path, probs));
            });
        }
        _ => {
            let _ = tx.send((path, vec![]));
        }
    }
}

pub fn parse_node_error(stderr: &str) -> Vec<Problem> {
    let mut line = None;
    let mut msg = String::new();
    for l in stderr.lines() {
        if line.is_none() {
            if let Some((_, n)) = l.rsplit_once(':') {
                if let Ok(n) = n.trim().parse::<usize>() {
                    line = Some(n.saturating_sub(1));
                }
            }
        }
        if l.contains("Error:") && msg.is_empty() {
            msg = l.trim().to_string();
        }
    }
    line.map(|line| {
        vec![Problem {
            line,
            msg: if msg.is_empty() {
                "syntax error".into()
            } else {
                msg
            },
        }]
    })
    .unwrap_or_default()
}

fn hash_of(s: &str, lang: Lang, theme: &str) -> u64 {
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    lang.hash(&mut h);
    theme.hash(&mut h);
    h.finish()
}

/// Matches as char ranges.
pub fn find_matches(text: &str, f: &Find) -> Vec<(usize, usize)> {
    if f.query.is_empty() {
        return vec![];
    }
    let pat = if f.regex {
        f.query.clone()
    } else {
        regex::escape(&f.query)
    };
    let Ok(re) = regex::RegexBuilder::new(&pat)
        .case_insensitive(!f.case)
        .multi_line(true)
        .build()
    else {
        return vec![];
    };
    let mut out = vec![];
    let (mut bi, mut ci) = (0usize, 0usize);
    for m in re.find_iter(text).take(5000) {
        if m.start() == m.end() {
            continue;
        }
        ci += text[bi..m.start()].chars().count();
        let len = text[m.start()..m.end()].chars().count();
        out.push((ci, ci + len));
        ci += len;
        bi = m.end();
    }
    out
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let mut cs = std::mem::take(&mut st.code);
    body(st, &mut cs, ui);
    st.code = cs;
}

fn body(st: &mut EditorState, cs: &mut CodeState, ui: &mut Ui) {
    // async results + external changes
    while let Ok((p, probs)) = cs.rx.try_recv() {
        if let Some(d) = cs.docs.iter_mut().find(|d| d.path == p) {
            d.problems = probs;
        }
    }
    if cs.last_disk_check.elapsed() > Duration::from_secs(1) {
        cs.last_disk_check = Instant::now();
        for d in &mut cs.docs {
            let m = nord_core::vfs::metadata(&d.path)
                .and_then(|m| m.modified())
                .ok();
            if m != d.mtime && !d.dirty() {
                if let Ok(t) = nord_core::vfs::read_to_string(&d.path) {
                    d.text = t.clone();
                    d.saved = t;
                }
            }
            if m != d.mtime && !d.dirty() {
                d.mtime = m;
            }
        }
    }
    // shortcuts that work while the editor tab is shown
    let (save, find, replace, goto, psearch) = ui.input_mut(|i| {
        (
            i.consume_key(Modifiers::COMMAND, Key::S),
            i.consume_key(Modifiers::COMMAND, Key::F),
            i.consume_key(Modifiers::COMMAND | Modifiers::ALT, Key::F),
            i.consume_key(Modifiers::COMMAND, Key::G),
            i.consume_key(Modifiers::COMMAND | Modifiers::SHIFT, Key::F),
        )
    });
    if save {
        let a = cs.active;
        match cs.save(a) {
            Ok(()) => {
                let n = cs.docs.get(a).map(|d| d.rel.clone()).unwrap_or_default();
                st.toast(format!("Saved {n}"));
            }
            Err(e) => st.log(LogLevel::Error, e),
        }
    }
    if find || replace {
        cs.find.open = true;
        cs.find.replace = replace;
        cs.find.focus = true;
    }
    if goto {
        cs.goto = Some(String::new());
    }
    if psearch {
        cs.search_open = true;
    }

    // tab bar
    let mut close = None;
    ui.horizontal(|ui| {
        egui::ScrollArea::horizontal()
            .id_salt("codetabs")
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    for (i, d) in cs.docs.iter().enumerate() {
                        let name = d.rel.rsplit('/').next().unwrap_or(&d.rel);
                        let label = format!("{}{}", name, if d.dirty() { " ●" } else { "" });
                        let r = ui
                            .selectable_label(cs.active == i, label)
                            .on_hover_text(&d.rel);
                        if r.clicked() {
                            cs.active = i;
                        }
                        if r.middle_clicked() || icons::button(ui, "x", "Close", false).clicked() {
                            close = Some(i);
                        }
                        ui.separator();
                    }
                });
            });
    });
    if let Some(i) = close {
        if cs.docs[i].dirty() {
            cs.confirm_close = Some(i);
        } else {
            cs.close(i);
        }
    }
    if let Some(i) = cs.confirm_close {
        egui::Window::new("Unsaved changes")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ui.ctx(), |ui| {
                ui.label(format!("{} has unsaved changes.", cs.docs[i].rel));
                ui.horizontal(|ui| {
                    if ui.button("Save & close").clicked() {
                        let _ = cs.save(i);
                        cs.close(i);
                        cs.confirm_close = None;
                    }
                    if ui.button("Discard").clicked() {
                        cs.close(i);
                        cs.confirm_close = None;
                    }
                    if ui.button("Cancel").clicked() {
                        cs.confirm_close = None;
                    }
                });
            });
    }
    if cs.docs.is_empty() {
        ui.add_space(20.0);
        ui.vertical_centered(|ui| {
            ui.weak("Open a script from the Assets panel (double-click) or press Cmd+P");
        });
        return;
    }
    cs.active = cs.active.min(cs.docs.len() - 1);

    toolbar(st, cs, ui);
    find_bar(cs, ui);
    goto_window(cs, ui);
    search_panel(st, cs, ui);

    let th = st.themes.theme(&st.settings.theme).clone();
    let (fsz, tab) = (st.settings.code_font_size, st.settings.tab_width.max(1));
    let metrics = (
        st.settings.code_word_wrap,
        st.settings.code_line_height.clamp(1.0, 2.2),
        st.settings.code_letter_spacing.clamp(0.0, 2.0),
    );
    let split = cs.split.filter(|s| *s < cs.docs.len());
    let status = {
        let d = &cs.docs[cs.active];
        let line = ui
            .ctx()
            .data(|d| d.get_temp::<(usize, usize)>(Id::new("cursor_pos")))
            .unwrap_or((1, 1));
        format!(
            "{:?}  Ln {}, Col {}  {} lines  {}",
            d.lang,
            line.0,
            line.1,
            d.text.lines().count().max(1),
            if d.problems.is_empty() {
                "no problems".to_string()
            } else {
                format!("{} problem(s)", d.problems.len())
            }
        )
    };
    egui::TopBottomPanel::bottom("code-status").show_inside(ui, |ui| {
        ui.horizontal(|ui| {
            ui.weak(status);
            if let Some(p) = cs.docs[cs.active].problems.first() {
                ui.colored_label(hex(&th.ui.bad), format!("line {}: {}", p.line + 1, p.msg));
            }
        });
    });
    let mut clicked_problem = None;
    match split {
        Some(s) => {
            ui.columns(2, |cols| {
                pane(
                    cs,
                    &mut cols[0],
                    cs.active,
                    "L",
                    &th,
                    fsz,
                    tab,
                    metrics,
                    &mut clicked_problem,
                );
                pane(
                    cs,
                    &mut cols[1],
                    s,
                    "R",
                    &th,
                    fsz,
                    tab,
                    metrics,
                    &mut clicked_problem,
                );
            });
        }
        None => pane(
            cs,
            ui,
            cs.active,
            "L",
            &th,
            fsz,
            tab,
            metrics,
            &mut clicked_problem,
        ),
    }
}

fn toolbar(st: &mut EditorState, cs: &mut CodeState, ui: &mut Ui) {
    ui.horizontal(|ui| {
        if icons::button(
            ui,
            "save",
            "Save (Cmd+S) — hot-reloads the running game",
            false,
        )
        .clicked()
        {
            let a = cs.active;
            if let Err(e) = cs.save(a) {
                st.log(LogLevel::Error, e);
            }
        }
        if icons::button(ui, "search", "Find (Cmd+F)", cs.find.open).clicked() {
            cs.find.open = !cs.find.open;
            cs.find.focus = true;
        }
        if icons::button(
            ui,
            "folder-open",
            "Search in project (Cmd+Shift+F)",
            cs.search_open,
        )
        .clicked()
        {
            cs.search_open = !cs.search_open;
        }
        if ui
            .small_button("Format")
            .on_hover_text("Re-indent / pretty-print JSON")
            .clicked()
        {
            let tab = st.settings.tab_width;
            if let Some(d) = cs.docs.get_mut(cs.active) {
                match d.lang {
                    Lang::Json => {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&d.text) {
                            d.text = serde_json::to_string_pretty(&v).unwrap_or_default() + "\n";
                        }
                    }
                    Lang::Js | Lang::Ts | Lang::Rust | Lang::Css | Lang::Glsl | Lang::Wgsl => {
                        d.text = edit::reindent(&d.text, tab)
                    }
                    _ => {}
                }
            }
        }
        if ui
            .checkbox(&mut st.settings.code_word_wrap, "Word wrap")
            .changed()
        {
            st.settings.save();
        }
        ui.checkbox(&mut cs.minimap, "Minimap");
        let mut sp = cs.split.is_some();
        if ui.checkbox(&mut sp, "Split").changed() {
            cs.split = if sp && cs.docs.len() > 1 {
                Some((cs.active + 1) % cs.docs.len())
            } else if sp {
                Some(cs.active)
            } else {
                None
            };
        }
        if let Some(s) = cs.split.as_mut() {
            egui::ComboBox::from_id_salt("splitdoc")
                .selected_text(cs.docs.get(*s).map_or("", |d| d.rel.as_str()))
                .show_ui(ui, |ui| {
                    for (i, d) in cs.docs.iter().enumerate() {
                        ui.selectable_value(s, i, &d.rel);
                    }
                });
        }
    });
}

fn find_bar(cs: &mut CodeState, ui: &mut Ui) {
    if !cs.find.open {
        return;
    }
    let text = cs.docs[cs.active].text.clone();
    let matches = find_matches(&text, &cs.find);
    let mut action: Option<(i32, bool)> = None; // (dir, replace)
    ui.horizontal(|ui| {
        let r = ui.add(
            egui::TextEdit::singleline(&mut cs.find.query)
                .hint_text("Find")
                .desired_width(180.0),
        );
        if cs.find.focus {
            r.request_focus();
            cs.find.focus = false;
        }
        if r.changed() {
            cs.find.cur = 0;
            action = Some((0, false));
        }
        if r.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter)) {
            action = Some((
                if ui.input(|i| i.modifiers.shift) {
                    -1
                } else {
                    1
                },
                false,
            ));
            r.request_focus();
        }
        ui.toggle_value(&mut cs.find.regex, ".*")
            .on_hover_text("Regular expression");
        ui.toggle_value(&mut cs.find.case, "Aa")
            .on_hover_text("Match case");
        if ui.small_button("↑").clicked() {
            action = Some((-1, false));
        }
        if ui.small_button("↓").clicked() {
            action = Some((1, false));
        }
        ui.weak(if matches.is_empty() {
            "no results".to_string()
        } else {
            format!(
                "{}/{}",
                cs.find.cur.min(matches.len() - 1) + 1,
                matches.len()
            )
        });
        if cs.find.regex && !cs.find.query.is_empty() && regex::Regex::new(&cs.find.query).is_err()
        {
            ui.colored_label(Color32::LIGHT_RED, "invalid regex");
        }
        ui.toggle_value(&mut cs.find.replace, "Replace");
        if icons::button(ui, "x", "Close", false).clicked() {
            cs.find.open = false;
        }
    });
    if cs.find.replace {
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(&mut cs.find.repl)
                    .hint_text("Replace with")
                    .desired_width(180.0),
            );
            if ui.small_button("Replace").clicked() {
                action = Some((0, true));
            }
            if ui.small_button("Replace all").clicked() {
                let d = &mut cs.docs[cs.active];
                d.text = replace_all(&d.text, &cs.find);
            }
        });
    }
    if let Some((dir, rep)) = action {
        if matches.is_empty() {
            return;
        }
        let n = matches.len() as i32;
        if rep {
            let i = (cs.find.cur as i32).rem_euclid(n) as usize;
            let (a, b) = matches[i];
            let d = &mut cs.docs[cs.active];
            let (ba, bb) = (edit::byte(&d.text, a), edit::byte(&d.text, b));
            let r = if cs.find.regex {
                regex::RegexBuilder::new(&cs.find.query)
                    .case_insensitive(!cs.find.case)
                    .build()
                    .ok()
                    .map(|re| {
                        re.replace(&d.text[ba..bb], cs.find.repl.as_str())
                            .into_owned()
                    })
            } else {
                Some(cs.find.repl.clone())
            };
            if let Some(r) = r {
                d.text.replace_range(ba..bb, &r);
            }
        } else {
            cs.find.cur = ((cs.find.cur as i32 + dir).rem_euclid(n)) as usize;
        }
        let (a, b) = matches[cs.find.cur.min(matches.len() - 1)];
        ui.ctx()
            .data_mut(|d| d.insert_temp(Id::new("select_range"), (a, b)));
    }
}

pub fn replace_all(text: &str, f: &Find) -> String {
    if f.query.is_empty() {
        return text.to_string();
    }
    let pat = if f.regex {
        f.query.clone()
    } else {
        regex::escape(&f.query)
    };
    match regex::RegexBuilder::new(&pat)
        .case_insensitive(!f.case)
        .multi_line(true)
        .build()
    {
        Ok(re) => {
            if f.regex {
                re.replace_all(text, f.repl.as_str()).into_owned()
            } else {
                re.replace_all(text, regex::NoExpand(&f.repl)).into_owned()
            }
        }
        Err(_) => text.to_string(),
    }
}

fn goto_window(cs: &mut CodeState, ui: &mut Ui) {
    let Some(mut g) = cs.goto.clone() else { return };
    let mut keep = true;
    egui::Window::new("Go to line")
        .collapsible(false)
        .resizable(false)
        .anchor(egui::Align2::CENTER_TOP, [0.0, 60.0])
        .show(ui.ctx(), |ui| {
            let r = ui.add(egui::TextEdit::singleline(&mut g).hint_text("line number"));
            r.request_focus();
            if ui.input(|i| i.key_pressed(Key::Enter)) {
                if let Ok(n) = g.trim().parse::<usize>() {
                    let a = cs.active;
                    cs.docs[a].goto = Some(n.saturating_sub(1));
                }
                keep = false;
            }
            if ui.input(|i| i.key_pressed(Key::Escape)) {
                keep = false;
            }
        });
    cs.goto = keep.then_some(g);
}

fn walk_text_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(rd) = nord_core::vfs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let p = e.path();
        let n = e.file_name().to_string_lossy().into_owned();
        if p.v_is_dir() {
            if !n.starts_with('.')
                && !matches!(n.as_str(), "dist" | "node_modules" | "target" | "vendor")
            {
                walk_text_files(&p, out);
            }
        } else if Lang::from_path(&n) != Lang::Plain || n.ends_with(".txt") {
            out.push(p);
        }
    }
}

pub fn project_search(root: &Path, q: &str, case: bool) -> Vec<(String, usize, String)> {
    let mut files = vec![];
    walk_text_files(root, &mut files);
    let ql = q.to_lowercase();
    let mut out = vec![];
    for f in files {
        if nord_core::vfs::metadata(&f).map_or(true, |m| m.len() > 2_000_000) {
            continue;
        }
        let Ok(t) = nord_core::vfs::read_to_string(&f) else {
            continue;
        };
        let rel = f
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        for (i, l) in t.lines().enumerate() {
            if (case && l.contains(q)) || (!case && l.to_lowercase().contains(&ql)) {
                out.push((rel.clone(), i, l.trim().chars().take(160).collect()));
                if out.len() >= 500 {
                    return out;
                }
            }
        }
    }
    out
}

fn search_panel(st: &mut EditorState, cs: &mut CodeState, ui: &mut Ui) {
    if !cs.search_open {
        return;
    }
    ui.horizontal(|ui| {
        let r = ui.add(
            egui::TextEdit::singleline(&mut cs.search_q)
                .hint_text("Search in project…")
                .desired_width(260.0),
        );
        if (r.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter)))
            || ui.small_button("Search").clicked()
        {
            if let Some(root) = &st.root {
                cs.search_res = project_search(root, &cs.search_q, false);
            }
        }
        ui.weak(format!("{} result(s)", cs.search_res.len()));
        if icons::button(ui, "x", "Close", false).clicked() {
            cs.search_open = false;
        }
    });
    egui::ScrollArea::vertical()
        .id_salt("psearch")
        .max_height(140.0)
        .show(ui, |ui| {
            for (f, l, t) in cs.search_res.clone() {
                if ui
                    .selectable_label(false, format!("{f}:{}  {t}", l + 1))
                    .clicked()
                {
                    if let Some(root) = &st.root {
                        st.push(Action::OpenFile(root.join(&f), Some(l)));
                    }
                }
            }
        });
    ui.separator();
}

#[allow(clippy::too_many_arguments)]
fn pane(
    cs: &mut CodeState,
    ui: &mut Ui,
    idx: usize,
    side: &str,
    th: &crate::theme::Theme,
    fsz: f32,
    tab: usize,
    metrics: (bool, f32, f32),
    _clicked: &mut Option<usize>,
) {
    let pal = highlight::Palette::new(&th.code);
    let font = egui::FontId::monospace(fsz);
    let (word_wrap, line_height, letter_spacing) = metrics;
    let row_h = fsz * line_height;
    let bg = hex(&th.code.bg);
    let gutter_c = hex(&th.code.gutter);
    let theme_id = th.id.clone();
    let id = Id::new(("code", cs.docs[idx].path.clone(), side));
    let focused = ui.ctx().memory(|m| m.has_focus(id));
    let sel_req: Option<(usize, usize)> = if idx == cs.active {
        ui.ctx()
            .data_mut(|d| d.remove_temp::<(usize, usize)>(Id::new("select_range")))
    } else {
        None
    };

    // ---- keyboard handling that must run before the TextEdit sees the events ----
    let mut comp_accept: Option<(usize, String)> = None;
    if focused {
        let lang = cs.docs[idx].lang;
        if let Some(c) = cs.completion.as_mut() {
            let (down, up, enter, esc) = ui.input_mut(|i| {
                (
                    i.consume_key(Modifiers::NONE, Key::ArrowDown),
                    i.consume_key(Modifiers::NONE, Key::ArrowUp),
                    i.consume_key(Modifiers::NONE, Key::Enter)
                        || i.consume_key(Modifiers::NONE, Key::Tab),
                    i.consume_key(Modifiers::NONE, Key::Escape),
                )
            });
            if down {
                c.sel = (c.sel + 1) % c.items.len().max(1);
            }
            if up {
                c.sel = (c.sel + c.items.len().max(1) - 1) % c.items.len().max(1);
            }
            if enter {
                if let Some(it) = c.items.get(c.sel) {
                    comp_accept = Some((c.start, it.insert.clone()));
                }
            }
            if esc || enter {
                cs.completion = None;
            }
        }
        let doc = &mut cs.docs[idx];
        process_keys(ui, id, doc, lang, tab, comp_accept.take());
    }

    let doc = &mut cs.docs[idx];
    let hkey = hash_of(&doc.text, doc.lang, &format!("{theme_id}:{fsz}"));
    if doc.hl.as_ref().is_none_or(|(h, _)| *h != hkey) {
        let job = if doc.text.len() > MAX_HIGHLIGHT {
            let mut job = egui::text::LayoutJob::default();
            job.append(
                &doc.text,
                0.0,
                egui::TextFormat::simple(font.clone(), pal.fg),
            );
            job
        } else {
            highlight::layout_job(&doc.text, doc.lang, &pal, font.clone())
        };
        doc.hl = Some((hkey, std::sync::Arc::new(job)));
    }
    let job = doc.hl.as_ref().map(|(_, j)| j.clone()).unwrap();
    let big = doc.text.len() > MAX_HIGHLIGHT;
    let nlines = doc.text.split('\n').count();
    let matches = if cs.find.open && idx == cs.active {
        find_matches(&doc.text, &cs.find)
    } else {
        vec![]
    };

    let mut minimap_click: Option<f32> = None;
    let avail = ui.available_size();
    let mm_w = if cs.minimap { 80.0 } else { 0.0 };
    let editor_w = (avail.x - mm_w).max(100.0);
    let frame = egui::Frame::NONE.fill(bg);
    let mut scroll_state = (0.0f32, 0.0f32, 0.0f32); // offset, content height, viewport height
    ui.horizontal_top(|ui| {
        ui.allocate_ui(Vec2::new(editor_w, avail.y), |ui| {
            frame.show(ui, |ui| {
                ui.set_min_size(Vec2::new(editor_w - 8.0, avail.y - 8.0));
                let mut sa = egui::ScrollArea::new([!word_wrap, true])
                    .id_salt(("codescroll", idx, side))
                    .auto_shrink([false; 2]);
                if let Some(y) = ui
                    .ctx()
                    .data_mut(|d| d.remove_temp::<f32>(Id::new(("mm_scroll", idx, side))))
                {
                    sa = sa.vertical_scroll_offset(y);
                }
                let out = sa.show(ui, |ui| {
                    ui.horizontal_top(|ui| {
                        // Use the same wrapped galley for layout and the logical-line gutter.
                        let digits = nlines.to_string().len().max(3);
                        let gutter_w = digits as f32 * (fsz * 0.62 + letter_spacing) + 16.0;
                        let text_w = (editor_w - gutter_w - 24.0).max(40.0);
                        let mut display_job = (*job).clone();
                        display_job.wrap.max_width = if word_wrap { text_w } else { f32::INFINITY };
                        if display_job.sections.is_empty() {
                            display_job.append(
                                "",
                                0.0,
                                egui::TextFormat::simple(font.clone(), pal.fg),
                            );
                        }
                        for section in &mut display_job.sections {
                            section.format.line_height = Some(row_h);
                            section.format.extra_letter_spacing = letter_spacing;
                        }
                        let content_h = ui.fonts(|f| f.layout_job(display_job.clone()).size().y);
                        let (grect, _) = ui.allocate_exact_size(
                            Vec2::new(gutter_w, content_h.max(row_h * 10.0)),
                            Sense::hover(),
                        );
                        let doc = &mut cs.docs[idx];
                        let lang = doc.lang;
                        let mut layouter = |ui: &Ui, source: &str, width: f32| {
                            let mut layout = if source == display_job.text {
                                display_job.clone()
                            } else if big {
                                let mut layout = egui::text::LayoutJob::default();
                                layout.append(
                                    source,
                                    0.0,
                                    egui::TextFormat::simple(font.clone(), pal.fg),
                                );
                                layout
                            } else {
                                highlight::layout_job(source, lang, &pal, font.clone())
                            };
                            layout.wrap.max_width = if word_wrap { width } else { f32::INFINITY };
                            for section in &mut layout.sections {
                                section.format.line_height = Some(row_h);
                                section.format.extra_letter_spacing = letter_spacing;
                            }
                            ui.fonts(|f| f.layout_job(layout))
                        };
                        if !ui.input(|i| i.pointer.any_down()) {
                            doc.prev_primary = egui::TextEdit::load_state(ui.ctx(), id)
                                .and_then(|s| s.cursor.char_range())
                                .map(|r| multi::Sel {
                                    anchor: r.secondary.index,
                                    head: r.primary.index,
                                });
                        }
                        let mut te = egui::TextEdit::multiline(&mut doc.text)
                            .id(id)
                            .font(font.clone())
                            .frame(false)
                            .desired_width(if word_wrap { text_w } else { f32::INFINITY })
                            .desired_rows(nlines.max(10))
                            .lock_focus(true)
                            .text_color(pal.fg);
                        te = te.layouter(&mut layouter);
                        let mut out = te.show(ui);
                        // Alt+click adds a cursor (the old primary becomes secondary); a plain click drops extras.
                        if out.response.clicked() || out.response.drag_started() {
                            if ui.input(|i| i.modifiers.alt) && out.response.clicked() {
                                if let Some(p) = doc.prev_primary {
                                    doc.extra.push(p);
                                    doc.extra_len = doc.text.len();
                                    let m = multi::Multi::new(
                                        out.state.cursor.char_range().map_or(p, |r| multi::Sel {
                                            anchor: r.secondary.index,
                                            head: r.primary.index,
                                        }),
                                        &doc.extra,
                                    );
                                    doc.extra = m.split().1;
                                }
                            } else {
                                doc.extra.clear();
                            }
                        }
                        if !doc.extra.is_empty() {
                            paint_extras(
                                ui,
                                doc,
                                &out.galley,
                                out.galley_pos,
                                row_h,
                                hex(&th.code.selection),
                                hex(&th.code.cursor),
                            );
                        }
                        if let Some((a, b)) = sel_req {
                            out.state.cursor.set_char_range(Some(CCursorRange::two(
                                CCursor::new(a),
                                CCursor::new(b),
                            )));
                            out.state.clone().store(ui.ctx(), id);
                            let r = out
                                .galley
                                .pos_from_cursor(&out.galley.from_ccursor(CCursor::new(a)));
                            ui.scroll_to_rect(
                                r.translate(out.galley_pos.to_vec2()),
                                Some(egui::Align::Center),
                            );
                        }
                        if let Some(line) = doc.goto.take() {
                            let ranges = edit::line_ranges(&doc.text);
                            let pos = ranges.get(line.min(ranges.len() - 1)).map_or(0, |r| r.0);
                            out.state
                                .cursor
                                .set_char_range(Some(CCursorRange::one(CCursor::new(pos))));
                            out.state.clone().store(ui.ctx(), id);
                            let r = out
                                .galley
                                .pos_from_cursor(&out.galley.from_ccursor(CCursor::new(pos)));
                            ui.scroll_to_rect(
                                r.translate(out.galley_pos.to_vec2()),
                                Some(egui::Align::Center),
                            );
                            out.response.request_focus();
                        }
                        // gutter painting (after we know the galley origin)
                        let p = ui.painter();
                        let cur_line = out
                            .cursor_range
                            .map(|c| edit::line_of(&doc.text, c.primary.ccursor.index));
                        let line_ranges = edit::line_ranges(&doc.text);
                        let line_rects: Vec<Rect> = line_ranges
                            .iter()
                            .map(|(start, end)| {
                                let a = out.galley.pos_from_ccursor(CCursor::new(*start));
                                let b = out.galley.pos_from_ccursor(CCursor::new(*end));
                                Rect::from_min_max(a.min, Pos2::new(b.max.x.max(a.max.x), b.max.y))
                            })
                            .collect();
                        for (l, line_rect) in line_rects.iter().enumerate() {
                            let y = out.galley_pos.y + line_rect.min.y;
                            if !ui.is_rect_visible(Rect::from_min_size(
                                Pos2::new(grect.left(), y),
                                Vec2::new(10.0, row_h),
                            )) {
                                continue;
                            }
                            let has_err = doc.problems.iter().any(|p| p.line == l);
                            p.text(
                                Pos2::new(grect.right() - 8.0, y + row_h / 2.0),
                                egui::Align2::RIGHT_CENTER,
                                if has_err {
                                    "●".to_string()
                                } else {
                                    (l + 1).to_string()
                                },
                                font.clone(),
                                if has_err {
                                    hex(&th.ui.bad)
                                } else if cur_line == Some(l) {
                                    pal.fg
                                } else {
                                    gutter_c
                                },
                            );
                        }
                        if let Some(cl) = cur_line {
                            let line_rect = line_rects[cl.min(line_rects.len() - 1)];
                            let y = out.galley_pos.y + line_rect.min.y;
                            p.rect_filled(
                                Rect::from_min_size(
                                    Pos2::new(out.galley_pos.x, y),
                                    Vec2::new(
                                        out.response.rect.width().max(ui.clip_rect().width()),
                                        line_rect.height(),
                                    ),
                                ),
                                0.0,
                                hex(&th.code.line_highlight).linear_multiply(0.5),
                            );
                        }
                        // find matches
                        for (k, (a, b)) in matches.iter().enumerate() {
                            let ra = out
                                .galley
                                .pos_from_cursor(&out.galley.from_ccursor(CCursor::new(*a)));
                            let rb = out
                                .galley
                                .pos_from_cursor(&out.galley.from_ccursor(CCursor::new(*b)));
                            if ra.min.y == rb.min.y {
                                let r = Rect::from_min_max(ra.min, Pos2::new(rb.min.x, ra.max.y))
                                    .translate(out.galley_pos.to_vec2());
                                p.rect_filled(
                                    r,
                                    2.0,
                                    hex(&th.ui.warn).linear_multiply(if k == cs.find.cur {
                                        0.55
                                    } else {
                                        0.25
                                    }),
                                );
                            }
                        }
                        // bracket match
                        if let Some(c) = out.cursor_range {
                            if let Some((x, y)) =
                                edit::matching_bracket(&doc.text, c.primary.ccursor.index)
                            {
                                for i in [x, y] {
                                    let r = out
                                        .galley
                                        .pos_from_cursor(&out.galley.from_ccursor(CCursor::new(i)));
                                    let r = Rect::from_min_size(r.min, Vec2::new(fsz * 0.6, row_h))
                                        .translate(out.galley_pos.to_vec2());
                                    p.rect_stroke(
                                        r,
                                        2.0,
                                        Stroke::new(1.0_f32, hex(&th.code.cursor)),
                                        egui::StrokeKind::Inside,
                                    );
                                }
                            }
                            let ci = c.primary.ccursor.index;
                            let line = edit::line_of(&doc.text, ci);
                            let ls = edit::line_ranges(&doc.text)[line].0;
                            ui.ctx().data_mut(|d| {
                                d.insert_temp(Id::new("cursor_pos"), (line + 1, ci - ls + 1))
                            });
                        }
                        // Squiggles follow every visual row of a wrapped logical line.
                        for pr in &doc.problems {
                            let Some((start, end)) = line_ranges.get(pr.line) else {
                                continue;
                            };
                            let first = out.galley.from_ccursor(CCursor::new(*start)).rcursor.row;
                            let last = out.galley.from_ccursor(CCursor::new(*end)).rcursor.row;
                            for row in &out.galley.rows[first..=last] {
                                let rect = row.rect.translate(out.galley_pos.to_vec2());
                                let y = rect.bottom() - 2.0;
                                let mut pts = vec![];
                                let mut x = rect.left();
                                let mut up = false;
                                while x < rect.right().max(rect.left() + 20.0) {
                                    pts.push(Pos2::new(x, y + if up { -2.0 } else { 0.0 }));
                                    x += 3.0;
                                    up = !up;
                                }
                                p.add(egui::Shape::line(
                                    pts,
                                    Stroke::new(1.0_f32, hex(&th.ui.bad)),
                                ));
                                if ui.rect_contains_pointer(rect) {
                                    egui::show_tooltip_at_pointer(
                                        ui.ctx(),
                                        ui.layer_id(),
                                        Id::new(("prob", pr.line)),
                                        |ui| {
                                            ui.colored_label(hex(&th.ui.bad), &pr.msg);
                                        },
                                    );
                                }
                            }
                        }
                        // autocomplete trigger
                        if out.response.has_focus() && out.response.changed() {
                            if let Some(c) = out.cursor_range {
                                let (start, prefix) =
                                    edit::word_before(&doc.text, c.primary.ccursor.index);
                                let items = if prefix.chars().count() >= 2 && c.is_empty() {
                                    api::candidates(&prefix, &doc.text)
                                } else {
                                    vec![]
                                };
                                cs.completion = if items.is_empty() {
                                    None
                                } else {
                                    Some(Completion {
                                        items,
                                        sel: 0,
                                        start,
                                    })
                                };
                            }
                        }
                        if ui.input_mut(|i| i.consume_key(Modifiers::CTRL, Key::Space))
                            || ui.input_mut(|i| i.consume_key(Modifiers::COMMAND, Key::Space))
                        {
                            if let Some(c) = out.cursor_range {
                                let (start, prefix) =
                                    edit::word_before(&doc.text, c.primary.ccursor.index);
                                let items = api::candidates(&prefix, &doc.text);
                                cs.completion = if items.is_empty() {
                                    None
                                } else {
                                    Some(Completion {
                                        items,
                                        sel: 0,
                                        start,
                                    })
                                };
                            }
                        }
                        // completion popup
                        if let (Some(c), Some(cr)) = (&cs.completion, out.cursor_range) {
                            if out.response.has_focus() {
                                let r = out.galley.pos_from_cursor(&cr.primary);
                                let at = out.galley_pos + r.left_bottom().to_vec2();
                                egui::Area::new(Id::new("completion"))
                                    .order(egui::Order::Foreground)
                                    .fixed_pos(at)
                                    .show(ui.ctx(), |ui| {
                                        egui::Frame::popup(ui.style()).show(ui, |ui| {
                                            for (i, it) in c.items.iter().enumerate() {
                                                ui.horizontal(|ui| {
                                                    let _ = ui.selectable_label(
                                                        i == c.sel,
                                                        egui::RichText::new(&it.label).monospace(),
                                                    );
                                                    ui.weak(it.detail);
                                                });
                                            }
                                        });
                                    });
                            }
                        }
                        if out.response.clicked() || out.response.lost_focus() {
                            cs.completion = None;
                        }
                    });
                });
                scroll_state = (
                    out.state.offset.y,
                    out.content_size.y,
                    out.inner_rect.height(),
                );
            });
        });
        if cs.minimap {
            let doc = &cs.docs[idx];
            let (rect, resp) =
                ui.allocate_exact_size(Vec2::new(mm_w, avail.y), Sense::click_and_drag());
            let p = ui.painter_at(rect);
            p.rect_filled(rect, 0.0, bg);
            let scale = (rect.height() / nlines.max(1) as f32).min(3.0);
            let step = (nlines / 600).max(1);
            for (l, line) in doc.text.split('\n').enumerate().step_by(step) {
                let w = (line.chars().count() as f32 * 0.8).min(rect.width() - 4.0);
                if w > 0.0 {
                    let y = rect.top() + l as f32 * scale;
                    p.rect_filled(
                        Rect::from_min_size(
                            Pos2::new(rect.left() + 2.0, y),
                            Vec2::new(w, (scale * step as f32).max(1.0)),
                        ),
                        0.0,
                        gutter_c.linear_multiply(0.6),
                    );
                }
            }
            let total = scroll_state.1.max(1.0);
            let vy = rect.top() + scroll_state.0 / total * (nlines as f32 * scale);
            let vh = (scroll_state.2 / total * nlines as f32 * scale).max(8.0);
            p.rect_filled(
                Rect::from_min_size(Pos2::new(rect.left(), vy), Vec2::new(rect.width(), vh)),
                0.0,
                hex(&th.code.selection).linear_multiply(0.6),
            );
            if resp.clicked() || resp.dragged() {
                if let Some(pp) = resp.interact_pointer_pos() {
                    let frac =
                        ((pp.y - rect.top()) / (nlines as f32 * scale).max(1.0)).clamp(0.0, 1.0);
                    minimap_click = Some((frac * total - scroll_state.2 / 2.0).max(0.0));
                }
            }
        }
    });
    if let Some(y) = minimap_click {
        ui.ctx()
            .data_mut(|d| d.insert_temp(Id::new(("mm_scroll", idx, side)), y));
        ui.ctx().request_repaint();
    }
}

/// Apply editor key behaviours (indent, comment, auto-indent, auto-close, completion accept) to the focused document.
fn process_keys(
    ui: &mut Ui,
    id: Id,
    doc: &mut Doc,
    lang: Lang,
    tab: usize,
    accept: Option<(usize, String)>,
) {
    let ctx = ui.ctx().clone();
    let Some(mut state) = egui::TextEdit::load_state(&ctx, id) else {
        return;
    };
    let Some(range) = state.cursor.char_range() else {
        return;
    };
    let (mut head, mut anchor) = (range.primary.index, range.secondary.index);
    let mut changed = false;
    let apply = |e: Edit, doc: &mut Doc, head: &mut usize, anchor: &mut usize| {
        doc.text = e.text;
        *anchor = e.sel.0;
        *head = e.sel.1;
    };
    if let Some((start, ins)) = accept {
        let b0 = edit::byte(&doc.text, start);
        let b1 = edit::byte(&doc.text, head);
        let mut t = doc.text.clone();
        t.replace_range(b0..b1, &ins);
        let pos = start + ins.chars().count();
        apply(
            Edit {
                text: t,
                sel: (pos, pos),
            },
            doc,
            &mut head,
            &mut anchor,
        );
        changed = true;
    }
    if multi_keys(&ctx, doc, &mut anchor, &mut head, tab) {
        changed = true;
    }
    let events = ctx.input_mut(|i| std::mem::take(&mut i.events));
    let mut keep = Vec::with_capacity(events.len());
    for ev in events {
        match &ev {
            egui::Event::Key {
                key: Key::Tab,
                pressed: true,
                modifiers,
                ..
            } if !modifiers.command => {
                let multi = edit::line_of(&doc.text, head) != edit::line_of(&doc.text, anchor);
                let e = if modifiers.shift || multi {
                    edit::indent_lines(&doc.text, anchor, head, tab, modifiers.shift)
                } else {
                    let col = head - edit::line_ranges(&doc.text)[edit::line_of(&doc.text, head)].0;
                    let n = tab - col % tab;
                    let b = edit::byte(&doc.text, head);
                    let mut t = doc.text.clone();
                    t.insert_str(b, &" ".repeat(n));
                    Edit {
                        text: t,
                        sel: (head + n, head + n),
                    }
                };
                apply(e, doc, &mut head, &mut anchor);
                changed = true;
            }
            egui::Event::Key {
                key: Key::Enter,
                pressed: true,
                modifiers,
                ..
            } if !modifiers.command && !modifiers.shift && head == anchor => {
                apply(
                    edit::newline(&doc.text, head, tab),
                    doc,
                    &mut head,
                    &mut anchor,
                );
                changed = true;
            }
            egui::Event::Key {
                key: Key::Slash,
                pressed: true,
                modifiers,
                ..
            } if modifiers.command => {
                if let Some(p) = lang.line_comment() {
                    apply(
                        edit::toggle_comment(&doc.text, anchor, head, p),
                        doc,
                        &mut head,
                        &mut anchor,
                    );
                    changed = true;
                }
            }
            egui::Event::Key {
                key: Key::Backspace,
                pressed: true,
                modifiers,
                ..
            } if head == anchor && !modifiers.any() => {
                if let Some(e) = edit::backspace_pair(&doc.text, head) {
                    apply(e, doc, &mut head, &mut anchor);
                    changed = true;
                } else {
                    keep.push(ev);
                }
            }
            // Text is applied here (not left to TextEdit) so several events in one frame see each other's cursor moves.
            egui::Event::Text(t) if !t.is_empty() && !t.chars().any(char::is_control) => {
                let (lo, hi) = (head.min(anchor), head.max(anchor));
                let paired = if head == anchor && t.chars().count() == 1 {
                    edit::typed(&doc.text, head, t.chars().next().unwrap())
                } else {
                    None
                };
                if let Some(e) = paired {
                    apply(e, doc, &mut head, &mut anchor);
                } else {
                    let (b0, b1) = (edit::byte(&doc.text, lo), edit::byte(&doc.text, hi));
                    doc.text.replace_range(b0..b1, t);
                    head = lo + t.chars().count();
                    anchor = head;
                }
                changed = true;
            }
            _ => keep.push(ev),
        }
    }
    ctx.input_mut(|i| i.events = keep);
    if changed {
        state.cursor.set_char_range(Some(CCursorRange::two(
            CCursor::new(anchor),
            CCursor::new(head),
        )));
        state.store(&ctx, id);
    }
}

/// Multi-cursor key handling (runs before the single-cursor logic). Add-cursor shortcuts always work; while extra
/// cursors exist, editing/navigation keys are applied to every selection and removed from the event queue.
fn multi_keys(
    ctx: &egui::Context,
    doc: &mut Doc,
    anchor: &mut usize,
    head: &mut usize,
    tab: usize,
) -> bool {
    use multi::{Dir, Multi, Sel};
    if !doc.extra.is_empty() && doc.text.len() != doc.extra_len {
        doc.extra.clear(); // text changed behind our back (undo, cut, reload)
    }
    let is_add = |e: &egui::Event| {
        matches!(e, egui::Event::Key { key, pressed: true, modifiers, .. }
            if modifiers.command && ((*key == Key::D && !modifiers.alt)
                || (modifiers.alt && matches!(key, Key::ArrowUp | Key::ArrowDown))))
    };
    let events = ctx.input(|i| i.events.clone());
    if doc.extra.is_empty() && !events.iter().any(is_add) {
        return false;
    }
    let mut m = Multi::new(
        Sel {
            anchor: *anchor,
            head: *head,
        },
        &doc.extra,
    );
    let mut keep = Vec::with_capacity(events.len());
    let mut changed = false;
    for ev in events {
        if is_add(&ev) {
            if let egui::Event::Key { key, .. } = &ev {
                match key {
                    Key::D => {
                        multi::add_next_occurrence(&doc.text, &mut m);
                    }
                    k => multi::add_vertical(&doc.text, &mut m, *k == Key::ArrowUp),
                }
            }
            changed = true;
            continue;
        }
        if m.sels.len() < 2 {
            keep.push(ev);
            continue;
        }
        let apply = |r: (String, Multi), doc: &mut Doc, m: &mut Multi| {
            doc.text = r.0;
            *m = r.1;
        };
        match &ev {
            egui::Event::Text(t) | egui::Event::Paste(t)
                if !t.is_empty() && !t.chars().any(|c| c.is_control() && c != '\n') =>
            {
                apply(multi::insert(&doc.text, &m, t), doc, &mut m);
            }
            egui::Event::Key {
                key,
                pressed: true,
                modifiers,
                ..
            } if !modifiers.command && !modifiers.alt => match key {
                Key::Backspace => apply(multi::backspace(&doc.text, &m), doc, &mut m),
                Key::Delete => apply(multi::delete(&doc.text, &m), doc, &mut m),
                Key::Enter if !modifiers.shift => {
                    apply(multi::newline(&doc.text, &m, tab), doc, &mut m)
                }
                Key::Tab if !modifiers.shift => apply(multi::tab(&doc.text, &m, tab), doc, &mut m),
                Key::Escape => m.sels = vec![m.sels[m.primary]],
                Key::ArrowLeft => multi::move_all(&doc.text, &mut m, Dir::Left, modifiers.shift),
                Key::ArrowRight => multi::move_all(&doc.text, &mut m, Dir::Right, modifiers.shift),
                Key::ArrowUp => multi::move_all(&doc.text, &mut m, Dir::Up, modifiers.shift),
                Key::ArrowDown => multi::move_all(&doc.text, &mut m, Dir::Down, modifiers.shift),
                Key::Home => multi::move_all(&doc.text, &mut m, Dir::Home, modifiers.shift),
                Key::End => multi::move_all(&doc.text, &mut m, Dir::End, modifiers.shift),
                _ => {
                    keep.push(ev);
                    continue;
                }
            },
            _ => {
                keep.push(ev);
                continue;
            }
        }
        if matches!(
            &ev,
            egui::Event::Key {
                key: Key::Escape,
                ..
            }
        ) {
            m.primary = 0;
        }
        changed = true;
    }
    ctx.input_mut(|i| i.events = keep);
    if changed {
        let (p, ex) = m.split();
        *anchor = p.anchor;
        *head = p.head;
        doc.extra = if m.sels.len() > 1 { ex } else { vec![] };
        doc.extra_len = doc.text.len();
    }
    changed
}

/// Paint secondary carets/selections.
#[allow(clippy::needless_range_loop)]
fn paint_extras(
    ui: &Ui,
    doc: &Doc,
    galley: &egui::Galley,
    origin: Pos2,
    row_h: f32,
    sel_c: Color32,
    caret_c: Color32,
) {
    let p = ui.painter();
    let at = |i: usize| galley.pos_from_cursor(&galley.from_ccursor(CCursor::new(i)));
    let ranges = edit::line_ranges(&doc.text);
    for s in &doc.extra {
        if !s.is_empty() {
            let (l0, l1) = (
                edit::line_of(&doc.text, s.lo()),
                edit::line_of(&doc.text, s.hi()),
            );
            for l in l0..=l1 {
                let (a, b) = (s.lo().max(ranges[l].0), s.hi().min(ranges[l].1));
                let (ra, rb) = (at(a), at(b));
                let mut r = Rect::from_min_max(ra.min, Pos2::new(rb.min.x, ra.min.y + row_h));
                if l < l1 {
                    r.max.x += 6.0; // newline marker
                }
                p.rect_filled(r.translate(origin.to_vec2()), 0.0, sel_c);
            }
        }
        let c = at(s.head);
        let x = origin.x + c.min.x;
        let y = origin.y + c.min.y;
        p.line_segment(
            [Pos2::new(x, y), Pos2::new(x, y + row_h)],
            Stroke::new(2.0_f32, caret_c),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_and_replace_all() {
        let mut f = Find {
            query: "a.".into(),
            regex: true,
            ..Default::default()
        };
        assert_eq!(find_matches("ab ac", &f), vec![(0, 2), (3, 5)]);
        f.regex = false;
        assert!(find_matches("ab ac", &f).is_empty());
        f.query = "É".into();
        assert_eq!(
            find_matches("xéy", &f),
            vec![(1, 2)],
            "case-insensitive unicode"
        );
        f.regex = true;
        f.query = "(\\w)b".into();
        f.repl = "$1$1".into();
        assert_eq!(replace_all("ab cb", &f), "aa cc");
    }

    #[test]
    fn node_error_line() {
        let e = parse_node_error(
            "/tmp/x.mjs:3\n  let = ;\n      ^\n\nSyntaxError: Unexpected token '='\n    at ...",
        );
        assert_eq!(e[0].line, 2);
        assert!(e[0].msg.starts_with("SyntaxError"));
    }

    #[test]
    fn json_check_reports_line() {
        let (tx, rx) = channel();
        spawn_check(
            PathBuf::from("a.json"),
            Lang::Json,
            "{\n  \"a\": ,\n}".into(),
            tx,
        );
        let (_, p) = rx.recv().unwrap();
        assert_eq!(p[0].line, 1);
    }

    #[test]
    fn project_search_finds_lines() {
        let d = std::env::temp_dir().join(format!("nord-search-{}", std::process::id()));
        nord_core::vfs::create_dir_all(d.join("scripts")).unwrap();
        nord_core::vfs::write(d.join("scripts/a.js"), "let x = 1;\nlet Needle = 2;\n").unwrap();
        let r = project_search(&d, "needle", false);
        assert_eq!(
            r,
            vec![("scripts/a.js".to_string(), 1, "let Needle = 2;".to_string())]
        );
        assert!(project_search(&d, "needle", true).is_empty());
    }
}
