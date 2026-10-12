//! eframe App: splash → hub/dock layout, global shortcuts, action dispatch, viewport sync.
use crate::{
    panels::{self, palette::Mode as PMode},
    state::{Action, EditorState, LogLevel, Tint, Tool},
    viewport::webview::{open_in_browser, WebPanes},
};
use egui::{Context, Key, Modifiers};
use egui_dock::{DockArea, DockState, NodeIndex, Style, TabViewer};
use std::sync::Arc;
use std::time::{Duration, Instant};

const SPLASH_MIN: Duration = Duration::from_millis(2000);

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash, serde::Serialize, serde::Deserialize)]
pub enum Tab {
    Hierarchy,
    Inspector,
    Scene,
    Game,
    Code,
    Animation,
    Assets,
    Console,
    Library,
    Docs,
}

impl Tab {
    pub fn title(self) -> &'static str {
        match self {
            Tab::Hierarchy => "Hierarchy",
            Tab::Inspector => "Inspector",
            Tab::Scene => "Scene",
            Tab::Game => "Game",
            Tab::Code => "Code",
            Tab::Animation => "Anim & Tiles",
            Tab::Assets => "Assets",
            Tab::Console => "Console",
            Tab::Library => "Library",
            Tab::Docs => "Docs",
        }
    }
}

pub fn default_dock() -> DockState<Tab> {
    let mut dock = DockState::new(vec![Tab::Scene, Tab::Game, Tab::Code, Tab::Animation]);
    let s = dock.main_surface_mut();
    let [center, _] = s.split_left(NodeIndex::root(), 0.18, vec![Tab::Hierarchy]);
    let [center, _] = s.split_right(center, 0.78, vec![Tab::Inspector]);
    let [_, _] = s.split_below(
        center,
        0.68,
        vec![Tab::Assets, Tab::Console, Tab::Library, Tab::Docs],
    );
    dock
}

fn layout_path() -> std::path::PathBuf {
    nord_core::io::config_dir().join("layout.json")
}

/// The dock layout the user arranged last time (tabs dragged, split, popped out, closed), else the default.
fn load_dock() -> DockState<Tab> {
    nord_core::io::load_json::<DockState<Tab>>(&layout_path())
        .ok()
        .filter(|d| d.iter_all_tabs().next().is_some())
        .unwrap_or_else(default_dock)
}

pub struct App {
    pub st: EditorState,
    pub dock: DockState<Tab>,
    pub web: WebPanes,
    splash_start: Option<Instant>,
    sent_rev: u64,
    sent_sel: Vec<String>,
    sent_settings: String,
    quit_confirm: bool,
    allow_close: bool,
    last_window_save: Instant,
    saved_layout: String,
    os_fullscreen: bool,
}

impl App {
    pub fn new(splash: bool) -> Self {
        Self {
            st: EditorState::new(),
            dock: load_dock(),
            web: WebPanes::default(),
            splash_start: splash.then(Instant::now),
            sent_rev: 0,
            sent_sel: vec![],
            sent_settings: String::new(),
            quit_confirm: false,
            allow_close: false,
            last_window_save: Instant::now(),
            saved_layout: String::new(),
            os_fullscreen: false,
        }
    }

    /// Persist the dock layout when it changed (cheap string compare; called with the periodic settings save).
    fn save_layout(&mut self) {
        if let Ok(j) = serde_json::to_string(&self.dock) {
            if j != self.saved_layout {
                let _ = nord_core::io::write_atomic(&layout_path(), j.as_bytes());
                self.saved_layout = j;
            }
        }
    }

    pub fn show_tab(&mut self, t: Tab) {
        if self.dock.iter_all_tabs().next().is_none() {
            self.dock = default_dock(); // everything was closed
        }
        if let Some(loc) = self.dock.find_tab(&t) {
            self.dock.set_active_tab(loc);
        } else {
            self.dock.push_to_focused_leaf(t);
        }
    }

    fn splash(&mut self, ctx: &Context) -> bool {
        let Some(t0) = self.splash_start else {
            return false;
        };
        if t0.elapsed() < SPLASH_MIN {
            egui::CentralPanel::default()
                .frame(egui::Frame::NONE.fill(egui::Color32::BLACK))
                .show(ctx, |ui| {
                    ui.add(
                        egui::Image::new(egui::include_image!(
                            "../../../assets/brand/splash-640x360.png"
                        ))
                        .fit_to_exact_size(ui.available_size()),
                    );
                });
            if t0.elapsed() < Duration::from_millis(100) {
                if let Some(c) = egui::ViewportCommand::center_on_screen(ctx) {
                    ctx.send_viewport_cmd(c);
                }
            }
            ctx.request_repaint_after(Duration::from_millis(50));
            return true;
        }
        // splash done: become the main window
        self.splash_start = None;
        let w = self.st.settings.window.unwrap_or([0.0, 0.0, 1440.0, 900.0]);
        ctx.send_viewport_cmd(egui::ViewportCommand::Decorations(true));
        ctx.send_viewport_cmd(egui::ViewportCommand::Resizable(true));
        ctx.send_viewport_cmd(egui::ViewportCommand::MinInnerSize(egui::vec2(
            900.0, 600.0,
        )));
        ctx.send_viewport_cmd(egui::ViewportCommand::InnerSize(egui::vec2(
            w[2].max(900.0),
            w[3].max(600.0),
        )));
        if self.st.settings.window.is_some() && (w[0] != 0.0 || w[1] != 0.0) {
            ctx.send_viewport_cmd(egui::ViewportCommand::OuterPosition(egui::pos2(w[0], w[1])));
        } else if let Some(c) = egui::ViewportCommand::center_on_screen(ctx) {
            ctx.send_viewport_cmd(c);
        }
        false
    }

    fn shortcuts(&mut self, ctx: &Context) {
        let typing = ctx.wants_keyboard_input();
        let st = &mut self.st;
        ctx.input_mut(|i| {
            let cmd = Modifiers::COMMAND;
            if i.consume_key(cmd, Key::S) {
                st.push(Action::SaveAll);
            }
            if i.consume_key(cmd, Key::P) {
                st.push(Action::QuickOpen);
            }
            if i.consume_key(cmd, Key::K) {
                st.push(Action::Palette);
            }
            let (run, stop) = (st.settings.key(true), st.settings.key(false));
            if i.consume_key(cmd, run) {
                st.push(if st.is_playing() {
                    Action::Stop
                } else {
                    Action::Play
                });
            } else if i.consume_key(cmd, stop) {
                st.push(Action::Stop);
            }
            if i.consume_key(cmd, Key::Comma) {
                st.push(Action::Settings);
            }
            for (k, t) in [
                (Key::Num1, Tab::Scene),
                (Key::Num2, Tab::Game),
                (Key::Num3, Tab::Code),
                (Key::Num4, Tab::Assets),
            ] {
                if i.consume_key(cmd, k) {
                    st.push(Action::ShowTab(t));
                }
            }
            if !typing {
                if i.consume_key(cmd | Modifiers::SHIFT, Key::Z) {
                    st.push(Action::Redo);
                } else if i.consume_key(cmd, Key::Z) {
                    st.push(Action::Undo);
                }
                if i.consume_key(cmd, Key::D) {
                    st.push(Action::Duplicate);
                }
                if i.consume_key(cmd, Key::C) {
                    st.push(Action::Copy);
                }
                if i.consume_key(cmd, Key::V) {
                    st.push(Action::Paste);
                }
                if i.consume_key(Modifiers::NONE, Key::Delete)
                    || i.consume_key(Modifiers::NONE, Key::Backspace)
                {
                    st.push(Action::Delete);
                }
                for (k, t) in [
                    (Key::W, Tool::Move),
                    (Key::E, Tool::Rotate),
                    (Key::R, Tool::Scale),
                ] {
                    if i.consume_key(Modifiers::NONE, k) {
                        st.push(Action::SetTool(t));
                    }
                }
                if i.consume_key(Modifiers::NONE, Key::F) {
                    st.push(Action::Focus);
                }
            }
        });
    }

    /// Show the Game tab and (re)load the game page.
    fn begin_play(&mut self) {
        let st = &mut self.st;
        if st.ensure_server().is_none() {
            return;
        }
        if st.dirty {
            st.save();
        }
        st.stopping = None;
        if let Some(p) = st.play.as_mut() {
            p.running = true;
        }
        st.game_nonce += 1;
        st.log(LogLevel::Build, "▶ Play");
        self.show_tab(Tab::Game);
    }

    /// Unity-style play-mode colour: while compiling (amber) or playing (blue) the whole editor chrome is tinted, so it is obvious the
    /// editor is busy / in play mode. Restores the theme's own colours afterwards.
    fn apply_tint(&mut self, ctx: &Context) {
        let st = &mut self.st;
        let want = if st.settings.tint {
            st.activity().0
        } else {
            None
        };
        let rgb = |t| {
            if t == Tint::Playing {
                st.settings.play_tint
            } else {
                st.settings.build_tint
            }
        };
        let want_key = want.map(|t| (t, rgb(t)));
        if want_key == st.tint_applied {
            return;
        }
        match want_key {
            None => {
                if let Some(v) = st.base_visuals.take() {
                    ctx.set_visuals(v);
                }
            }
            Some((_, c)) => {
                let base = st
                    .base_visuals
                    .get_or_insert_with(|| ctx.style().visuals.clone())
                    .clone();
                let tint = egui::Color32::from_rgb(c[0], c[1], c[2]);
                let mix = |a: egui::Color32, k: f32| {
                    let f = |x: u8, y: u8| (x as f32 * (1.0 - k) + y as f32 * k) as u8;
                    egui::Color32::from_rgb(
                        f(a.r(), tint.r()),
                        f(a.g(), tint.g()),
                        f(a.b(), tint.b()),
                    )
                };
                let mut v = base;
                v.panel_fill = mix(v.panel_fill, 0.9);
                v.window_fill = mix(v.window_fill, 0.8);
                v.faint_bg_color = mix(v.faint_bg_color, 0.7);
                v.extreme_bg_color = mix(v.extreme_bg_color, 0.55);
                ctx.set_visuals(v);
            }
        }
        st.tint_applied = want_key;
        ctx.request_repaint();
    }

    /// Poll the background Rust build; start the game when a Play-triggered build succeeded.
    fn poll_rust_build(&mut self, ctx: &Context) {
        use std::sync::atomic::Ordering::SeqCst;
        let Some(job) = self.st.rust_job.clone() else {
            return;
        };
        if !job.done.load(SeqCst) {
            ctx.request_repaint_after(Duration::from_millis(150));
            return;
        }
        self.st.rust_job = None;
        if job.ok.load(SeqCst) {
            if job.play_after {
                self.begin_play();
            }
        } else {
            self.st.toast("Rust build failed — see Console");
            self.show_tab(Tab::Console);
        }
    }

    pub fn run_actions(&mut self, ctx: &Context) {
        while !self.st.actions.is_empty() {
            let a = self.st.actions.remove(0);
            self.run(a, ctx);
        }
    }

    pub fn run(&mut self, a: Action, ctx: &Context) {
        let st = &mut self.st;
        match a {
            Action::NewProject | Action::CloseProject => {
                st.close_project();
                st.hub.show_docs = false;
                self.web = WebPanes::default();
            }
            Action::OpenProject => {
                if let Some(d) = rfd::FileDialog::new()
                    .set_title("Open Nord project folder")
                    .pick_folder()
                {
                    st.push(Action::OpenPath(d));
                }
            }
            Action::OpenPath(d) => {
                self.web = WebPanes::default();
                st.play = None;
                match st.open_project(&d) {
                    Ok(()) => {
                        self.sent_rev = 0;
                        self.sent_sel.clear();
                        st.viewport_ready = false;
                        if st.recover.is_some() {
                            st.toast("Unsaved autosave found — see Edit ▸ Recover autosave");
                        }
                    }
                    Err(e) => {
                        st.log(LogLevel::Error, format!("Open failed: {e}"));
                        st.toast(format!("Open failed: {e}"));
                    }
                }
            }
            Action::Save | Action::SaveAll => {
                if st.dirty {
                    st.save();
                }
                let mut cs = std::mem::take(&mut st.code);
                for i in 0..cs.docs.len() {
                    if cs.docs[i].dirty() {
                        if let Err(e) = cs.save(i) {
                            st.log(LogLevel::Error, e);
                        }
                    }
                }
                st.code = cs;
                st.refresh_assets();
            }
            Action::Undo => st.do_undo(),
            Action::Redo => st.do_redo(),
            Action::Copy => st.copy_selected(),
            Action::Paste => st.paste(),
            Action::Duplicate => st.duplicate_selected(),
            Action::Delete => st.delete_selected(),
            Action::AddEntity(p) => st.add_entity(p.or_else(|| st.selection.first().cloned())),
            Action::Focus => st.send_viewport(serde_json::json!({"t":"focus"})),
            Action::SetTool(t) => st.tool = t,
            Action::ToggleSnap => st.settings.snap = !st.settings.snap,
            Action::ToggleGrid => st.settings.grid = !st.settings.grid,
            Action::Play => {
                if st.project.is_some() && is_rust(st) {
                    start_rust_build(st, true); // builds, then `finish_rust_build` starts the game
                } else if st.project.is_some() && st.ensure_server().is_some() {
                    self.begin_play();
                }
            }
            Action::Stop => {
                st.stop();
                self.web.drop_pane("game");
                st.log(LogLevel::Build, "■ Stop");
            }
            Action::Reload => {
                st.game_nonce += 1;
            }
            Action::QuickOpen => {
                st.palette.mode = PMode::Files;
                st.palette.files.clear();
                st.palette.query.clear();
            }
            Action::Palette => {
                st.palette.mode = PMode::Commands;
                st.palette.query.clear();
            }
            Action::Settings => st.settings_open = true,
            Action::ResetLayout => {
                self.dock = default_dock();
                st.toast("Panel layout reset");
            }
            Action::ResetSettings => {
                let window = st.settings.window;
                st.settings = crate::state::Settings {
                    window,
                    ..Default::default()
                };
                st.apply_theme = true;
                self.dock = default_dock();
                st.toast("Settings and layout reset to defaults");
            }
            Action::Export => st.export_ui.open = true,
            Action::DesktopSettings => st.desktop_ui.open = true,
            Action::About => st.about_open = true,
            Action::OpenFile(p, line) => {
                let root = st.root.clone();
                let mut cs = std::mem::take(&mut st.code);
                let r = cs.open(root.as_deref(), &p, line);
                st.code = cs;
                match r {
                    Ok(()) => self.show_tab(Tab::Code),
                    Err(e) => {
                        st.log(LogLevel::Error, e.clone());
                        st.toast(e);
                    }
                }
            }
            Action::ShowTab(Tab::Docs) if st.project.is_none() => st.hub.show_docs = true,
            Action::ShowTab(t) => self.show_tab(t),
            Action::Build(what) => run_build(st, &what),
        }
        let _ = ctx;
    }

    fn sync_viewport(&mut self) {
        let st = &mut self.st;
        if st.rev != self.sent_rev {
            if st.skip_viewport_sync {
                st.skip_viewport_sync = false;
            } else if st.viewport_ready {
                st.send_viewport(st.viewport_scene_msg());
            }
            self.sent_rev = st.rev;
        }
        if st.selection != self.sent_sel {
            st.send_viewport(serde_json::json!({"t":"select","ids":st.selection}));
            self.sent_sel = st.selection.clone();
        }
        let sig = st.viewport_settings_msg().to_string();
        if sig != self.sent_settings {
            st.send_viewport(st.viewport_settings_msg());
            self.sent_settings = sig;
        }
        if st.viewport_ready && !st.assets_ui.model_requests.is_empty() {
            let reqs: Vec<_> = st
                .assets_ui
                .model_requests
                .drain(..)
                .filter_map(|p| {
                    st.assets
                        .iter()
                        .find(|a| a.path == p)
                        .map(|a| serde_json::json!({"path": a.path, "sha": a.sha256}))
                })
                .collect();
            st.send_viewport(serde_json::json!({"t":"thumbs","items":reqs}));
        }
    }

    fn menu(&mut self, ui: &mut egui::Ui) {
        let st = &mut self.st;
        egui::menu::bar(ui, |ui| {
            let act = |ui: &mut egui::Ui, label: &str, a: Action, st: &mut EditorState| {
                if ui.button(label).clicked() {
                    st.push(a);
                    ui.close_menu();
                }
            };
            ui.menu_button("File", |ui| {
                act(ui, "New project…", Action::NewProject, st);
                act(ui, "Open project…", Action::OpenProject, st);
                ui.menu_button("Open recent", |ui| {
                    for p in nord_core::io::recent_projects().into_iter().take(10) {
                        if ui.button(p.display().to_string()).clicked() {
                            st.push(Action::OpenPath(p));
                            ui.close_menu();
                        }
                    }
                });
                ui.separator();
                act(ui, "Save all  (Cmd+S)", Action::SaveAll, st);
                act(ui, "Close project", Action::CloseProject, st);
            });
            ui.menu_button("Edit", |ui| {
                act(ui, "Undo  (Cmd+Z)", Action::Undo, st);
                act(ui, "Redo  (Shift+Cmd+Z)", Action::Redo, st);
                ui.separator();
                act(ui, "Copy", Action::Copy, st);
                act(ui, "Paste", Action::Paste, st);
                act(ui, "Duplicate  (Cmd+D)", Action::Duplicate, st);
                act(ui, "Delete", Action::Delete, st);
                ui.separator();
                act(ui, "Add entity", Action::AddEntity(None), st);
                if st.recover.is_some() && ui.button("Recover autosave").clicked() {
                    st.recover_autosave();
                    ui.close_menu();
                }
            });
            ui.menu_button("View", |ui| {
                for t in [
                    Tab::Scene,
                    Tab::Game,
                    Tab::Code,
                    Tab::Animation,
                    Tab::Hierarchy,
                    Tab::Inspector,
                    Tab::Assets,
                    Tab::Console,
                    Tab::Library,
                    Tab::Docs,
                ] {
                    act(ui, t.title(), Action::ShowTab(t), st);
                }
                ui.separator();
                act(ui, "Reset layout", Action::ResetLayout, st);
                act(ui, "Settings…", Action::Settings, st);
            });
            ui.menu_button("Project", |ui| {
                let (rk, sk) = (st.settings.key_label(true), st.settings.key_label(false));
                let play_action = if st.is_playing() {
                    Action::Stop
                } else {
                    Action::Play
                };
                act(ui, &format!("Play / stop  ({rk})"), play_action, st);
                act(ui, &format!("Stop  ({sk})"), Action::Stop, st);
                act(ui, "Validate", Action::Build("validate".into()), st);
                if is_rust(st) {
                    act(ui, "Build Rust", Action::Build("rust build".into()), st);
                }
                act(ui, "Export…", Action::Export, st);
                act(ui, "Desktop app permissions…", Action::DesktopSettings, st);
            });
            ui.menu_button("Help", |ui| {
                act(ui, "Documentation", Action::ShowTab(Tab::Docs), st);
                act(ui, "Command palette  (Cmd+K)", Action::Palette, st);
                act(ui, "About", Action::About, st);
            });
        });
    }
}

fn is_rust(st: &EditorState) -> bool {
    st.project.as_ref().is_some_and(|p| {
        matches!(
            p.kind,
            nord_core::ProjectType::WasmGame | nord_core::ProjectType::WasmApp
        )
    })
}

/// `nord build-rust` in a background thread: cargo output streams into the Console (hub log) with `file:line` links; `play_after` runs the game on success.
fn start_rust_build(st: &mut EditorState, play_after: bool) {
    use std::sync::atomic::{AtomicBool, Ordering::SeqCst};
    if st.rust_job.as_ref().is_some_and(|j| !j.done.load(SeqCst)) {
        st.toast("A Rust build is already running");
        return;
    }
    let Some(root) = st.root.clone() else { return };
    let Some(hub) = st
        .ensure_server()
        .and_then(|_| st.play.as_ref().map(|p| p.hub.clone()))
    else {
        return;
    };
    if st.dirty {
        st.save();
    }
    st.log(
        LogLevel::Build,
        "$ nord build-rust (cargo build --target wasm32-unknown-unknown)",
    );
    st.log(
        LogLevel::Info,
        "The first Rust build compiles every dependency (macroquad, rapier…) and can take several minutes; later builds are fast.",
    );
    let job = Arc::new(crate::state::RustJob {
        done: AtomicBool::new(false),
        ok: AtomicBool::new(false),
        play_after,
        started: Instant::now(),
        phase: Default::default(),
        crates: Default::default(),
    });
    st.status_msg = None;
    st.rust_job = Some(job.clone());
    let job_cb = job.clone();
    std::thread::spawn(move || {
        let push = |level: &str, text: String| {
            hub.logs.lock().unwrap().push(nord_serve::LogEntry {
                level: level.into(),
                text,
            });
        };
        let res = nord_export::rust::dev_build(&root, false, &mut |l| {
            let t = l.trim_start();
            if let Some(r) = t.strip_prefix("Compiling ") {
                if let Ok(mut p) = job_cb.phase.lock() {
                    *p = r.to_string();
                }
                job_cb.crates.fetch_add(1, SeqCst);
            } else if t.starts_with("Finished") {
                if let Ok(mut p) = job_cb.phase.lock() {
                    *p = "packaging for the web (wasm-bindgen)".into();
                }
            } else if t.starts_with("Downloading") || t.starts_with("Updating") {
                if let Ok(mut p) = job_cb.phase.lock() {
                    *p = t.to_string();
                }
            }
            let level = if l.starts_with("error")
                || nord_export::rust::parse_diagnostic(l).is_some_and(|d| d.3)
            {
                "error"
            } else if l.contains("warning") {
                "warn"
            } else {
                "info"
            };
            push(level, l.to_string());
        });
        match res {
            Ok(p) => {
                push("info", format!("✔ Rust build ok → {}", p.display()));
                job.ok.store(true, SeqCst);
            }
            Err(e) => push("error", format!("✘ {e}")),
        }
        job.done.store(true, SeqCst);
    });
}

fn run_build(st: &mut EditorState, what: &str) {
    let Some(root) = st.root.clone() else { return };
    match what {
        "rust build" => start_rust_build(st, false),
        "validate" => {
            let issues = nord_core::validate::validate_project(&root);
            if issues.is_empty() {
                st.log(LogLevel::Build, "Validate: OK");
            }
            for i in issues {
                st.log(LogLevel::Warn, format!("{}: {}", i.file, i.msg));
            }
        }
        cmd => {
            st.log(LogLevel::Build, format!("$ {cmd}"));
            let mut parts = cmd.split_whitespace();
            let prog = parts.next().unwrap_or("cargo").to_string();
            let args: Vec<String> = parts.map(String::from).collect();
            let hub = st
                .ensure_server()
                .and_then(|_| st.play.as_ref().map(|p| p.hub.clone()));
            std::thread::spawn(move || {
                let out = std::process::Command::new(prog)
                    .args(args)
                    .current_dir(root)
                    .output();
                if let Some(hub) = hub {
                    let mut l = hub.logs.lock().unwrap();
                    match out {
                        Ok(o) => {
                            for line in String::from_utf8_lossy(&o.stderr)
                                .lines()
                                .chain(String::from_utf8_lossy(&o.stdout).lines())
                            {
                                l.push(nord_serve::LogEntry {
                                    level: if line.contains("error") {
                                        "error".into()
                                    } else {
                                        "info".into()
                                    },
                                    text: line.to_string(),
                                });
                            }
                        }
                        Err(e) => l.push(nord_serve::LogEntry {
                            level: "error".into(),
                            text: e.to_string(),
                        }),
                    }
                }
            });
        }
    }
}

struct Viewer<'a> {
    st: &'a mut EditorState,
    web: &'a mut WebPanes,
    frame: Option<&'a eframe::Frame>,
    overlay: bool,
}

impl TabViewer for Viewer<'_> {
    type Tab = Tab;

    fn title(&mut self, t: &mut Tab) -> egui::WidgetText {
        t.title().into()
    }

    fn closeable(&mut self, _: &mut Tab) -> bool {
        true // closed panels come back via the View menu / Reset layout
    }

    fn ui(&mut self, ui: &mut egui::Ui, t: &mut Tab) {
        let st = &mut *self.st;
        match t {
            Tab::Hierarchy => panels::hierarchy::ui(st, ui),
            Tab::Inspector => panels::inspector::ui(st, ui),
            Tab::Assets => panels::assets::ui(st, ui),
            Tab::Console => panels::console::ui(st, ui),
            Tab::Library => panels::library::ui(st, ui),
            Tab::Code => crate::code::ui(st, ui),
            Tab::Animation => panels::animation::ui(st, ui),
            Tab::Docs => match panels::docs::manual_url(st) {
                // the embedded native webview floats above every panel, so the HTML manual opens in the browser instead
                Some(u) => {
                    ui.horizontal(|ui| {
                        if ui.button("Open the manual in your browser").clicked() {
                            crate::viewport::webview::open_in_browser(&u);
                        }
                        ui.weak("(HTML manual, searchable) — the specs below are the same pages as Markdown");
                    });
                    ui.separator();
                    panels::docs::markdown_ui(st, ui);
                }
                None => panels::docs::markdown_ui(st, ui),
            },
            Tab::Scene => {
                if st.scene.is_none() {
                    ui.weak("No scene open");
                } else if let Some(base) = st.ensure_server() {
                    let url = format!(
                        "{base}/__edit?mode={}",
                        if st.is_3d() { "3d" } else { "2d" }
                    );
                    self.web.show(ui, self.frame, "scene", &url, self.overlay);
                }
            }
            Tab::Game => game_tab(st, ui, self.web, self.frame, self.overlay),
        }
    }
}

/// The Game tab: toolbar (console / size / fullscreen), the embedded game webview and an optional console strip under it.
/// The console strip is laid out *before* the webview from a stored height, so the native webview can never cover it.
pub fn game_tab(
    st: &mut crate::state::EditorState,
    ui: &mut egui::Ui,
    web: &mut WebPanes,
    frame: Option<&eframe::Frame>,
    overlay: bool,
) {
    ui.horizontal_wrapped(|ui| {
        if crate::icons::button(
            ui,
            "terminal",
            "Show/hide console under the game",
            st.game_console,
        )
        .clicked()
        {
            st.game_console = !st.game_console;
        }
        ui.separator();
        ui.weak("Position");
        for (label, tip, y) in [
            ("⬆ Top", "Dock the game under the toolbar", 0.0_f32),
            ("Middle", "Centre vertically", 0.5),
            ("⬇ Bottom", "Dock the game to the bottom of the panel", 1.0),
        ] {
            if ui
                .selectable_label((st.settings.game_anchor[1] - y).abs() < 1e-3, label)
                .on_hover_text(tip)
                .clicked()
            {
                st.settings.game_anchor[1] = y;
                st.settings.game_offset[1] = 0.0;
            }
        }
        ui.add(
            egui::DragValue::new(&mut st.settings.game_offset[0])
                .speed(1.0)
                .prefix("x "),
        )
        .on_hover_text(
            "Horizontal offset in pixels (moves the game view; cropped at the panel edge)",
        );
        ui.add(
            egui::DragValue::new(&mut st.settings.game_offset[1])
                .speed(1.0)
                .prefix("y "),
        )
        .on_hover_text("Vertical offset in pixels from the anchor");
        if ui
            .small_button("↺")
            .on_hover_text("Reset position")
            .clicked()
        {
            st.settings.game_anchor = [0.5, 0.0];
            st.settings.game_offset = [0.0, 0.0];
        }
        ui.weak("Size");
        for (label, v) in [
            ("Fit", 0.0_f32),
            ("50%", 0.5),
            ("100%", 1.0),
            ("150%", 1.5),
            ("200%", 2.0),
        ] {
            if ui
                .selectable_label((st.game_scale - v).abs() < f32::EPSILON, label)
                .clicked()
            {
                st.game_scale = v;
            }
        }
        ui.separator();
        if ui
            .button(if st.game_full {
                "Exit fullscreen (Esc)"
            } else {
                "Fullscreen"
            })
            .on_hover_text("Maximise the game over the whole window (Esc leaves)")
            .clicked()
        {
            st.game_full = !st.game_full;
        }
        if st.is_playing()
            && ui
                .button("■ Stop")
                .on_hover_text("Stop the game and return to editing")
                .clicked()
        {
            st.push(Action::Stop);
            st.game_full = false;
        }
        if let Some(p) = &st.play {
            if ui.button("Open in browser").clicked() {
                open_in_browser(&format!("http://127.0.0.1:{}/", p.port));
            }
        }
    });
    let running = st.play.as_ref().is_some_and(|p| p.running);
    // console strip: fixed height (draggable handle), reserved first
    let total = ui.available_size();
    let mut console_h = 0.0;
    if st.game_console && !st.game_full {
        console_h = st.game_console_h.clamp(60.0, (total.y - 80.0).max(60.0));
    }
    let game_h = (total.y - console_h - if console_h > 0.0 { 8.0 } else { 0.0 }).max(40.0);
    ui.allocate_ui(egui::vec2(total.x, game_h), |ui| {
        ui.set_min_size(egui::vec2(total.x, game_h));
        if running {
            let base = st.ensure_server().unwrap_or_default();
            let url = format!("{base}/?n={}", st.game_nonce);
            let fixed = Some({
                let d = st
                    .project
                    .as_ref()
                    .map(|p| (p.display.width as f32, p.display.height as f32))
                    .unwrap_or((1280.0, 720.0));
                crate::viewport::webview::Fixed {
                    size: egui::vec2(d.0, d.1)
                        * if st.game_scale > 0.0 {
                            st.game_scale
                        } else {
                            1.0
                        },
                    fit: st.game_scale <= 0.0,
                    anchor: st.settings.game_anchor,
                    offset: st.settings.game_offset,
                }
            });
            web.show_sized(ui, frame, "game", &url, overlay, fixed);
        } else {
            ui.add_space(30.0);
            ui.vertical_centered(|ui| {
                ui.weak(format!(
                    "Press ▶ Play ({}) to run the game here",
                    st.settings.key_label(true)
                ));
            });
        }
    });
    if console_h > 0.0 {
        let (handle, resp) = ui.allocate_exact_size(egui::vec2(total.x, 8.0), egui::Sense::drag());
        ui.painter().rect_filled(
            handle.shrink2(egui::vec2(0.0, 2.0)),
            2.0,
            ui.visuals().widgets.noninteractive.bg_stroke.color,
        );
        if resp.dragged() {
            st.game_console_h =
                (st.game_console_h - resp.drag_delta().y).clamp(60.0, (total.y - 80.0).max(60.0));
        }
        if resp.hovered() || resp.dragged() {
            ui.ctx().set_cursor_icon(egui::CursorIcon::ResizeVertical);
        }
        ui.allocate_ui(egui::vec2(total.x, console_h), |ui| {
            ui.set_min_size(egui::vec2(total.x, console_h));
            panels::console::ui(st, ui);
        });
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &Context, frame: &mut eframe::Frame) {
        self.frame_ui(ctx, Some(frame));
    }

    fn on_exit(&mut self) {
        self.st.settings.save();
        self.save_layout();
    }
}

impl App {
    fn overlays_open(&self, ctx: &Context) -> bool {
        ctx.memory(|m| m.any_popup_open())
            || self.st.palette.mode != PMode::Closed
            || self.st.settings_open
            || self.st.export_ui.open
            || self.st.about_open
            || self.st.desktop_ui.open
            || (self.st.recover.is_some() && self.st.project.is_some())
            || self.st.code.goto.is_some()
            || self.quit_confirm
            || self.st.assets_ui.confirm_delete.is_some()
            || self.st.code.confirm_close.is_some()
    }

    /// One UI frame. `frame` is `None` in headless tests (no native window => no embedded webview).
    pub fn frame_ui(&mut self, ctx: &Context, frame: Option<&eframe::Frame>) {
        egui_extras::install_image_loaders(ctx);
        if self.splash(ctx) {
            return;
        }
        if self.st.apply_theme {
            self.st.themes.apply(
                ctx,
                &self.st.settings.skin.clone(),
                &self.st.settings.theme.clone(),
            );
            self.st.apply_theme = false;
            self.st.base_visuals = None;
            self.st.tint_applied = None;
            self.st.apply_styles = true;
            ctx.request_repaint();
        } else if self.st.apply_styles {
            self.st
                .themes
                .apply_text_styles(ctx, self.st.settings.ui_scale);
            self.st.apply_styles = false;
        }
        // close handling
        if ctx.input(|i| i.viewport().close_requested())
            && !self.allow_close
            && (self.st.dirty || self.st.code.any_dirty())
        {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            self.quit_confirm = true;
        }
        self.shortcuts(ctx);
        for m in self.st.pump_hub() {
            self.st.handle_viewport(&m);
        }
        self.run_actions(ctx);
        self.poll_rust_build(ctx);
        self.st.autosave_tick();
        if self.st.stopping.is_some() {
            ctx.request_repaint_after(Duration::from_millis(100)); // let the "stopping" tint expire
        }
        self.apply_tint(ctx);
        self.sync_viewport();

        if let Some(r) = ctx.input(|i| i.viewport().outer_rect) {
            if let Some(inner) = ctx.input(|i| i.viewport().inner_rect) {
                self.st.settings.window = Some([r.min.x, r.min.y, inner.width(), inner.height()]);
            }
        }
        if self.last_window_save.elapsed() > Duration::from_secs(10) {
            self.st.settings.save();
            self.save_layout();
            self.last_window_save = Instant::now();
        }

        if self.st.game_full && ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            self.st.game_full = false;
        }
        if self.st.game_full != self.os_fullscreen {
            self.os_fullscreen = self.st.game_full;
            ctx.send_viewport_cmd(egui::ViewportCommand::Fullscreen(self.os_fullscreen));
        }
        let game_full = self.st.game_full && self.st.project.is_some();
        if !game_full {
            egui::TopBottomPanel::top("menu").show(ctx, |ui| self.menu(ui));
            egui::TopBottomPanel::top("toolbar")
                .frame(
                    egui::Frame::NONE
                        .fill(ctx.style().visuals.panel_fill)
                        .inner_margin(egui::Margin::symmetric(12, 8)),
                )
                .show(ctx, |ui| panels::toolbar::ui(&mut self.st, ui));
            if self.st.project.is_some() {
                egui::TopBottomPanel::bottom("status").show(ctx, |ui| status_bar(&mut self.st, ui));
            }
        }
        let overlay = self.overlays_open(ctx);
        self.web
            .set_use_cached_content(self.st.settings.use_cached_content);
        self.web.begin_frame();
        if self.st.project.is_none() {
            egui::CentralPanel::default().show(ctx, |ui| {
                if self.st.hub.show_docs {
                    if ui.button("Back to projects").clicked() {
                        self.st.hub.show_docs = false;
                    }
                    ui.separator();
                    panels::docs::markdown_ui(&mut self.st, ui);
                } else {
                    panels::hub::ui(&mut self.st, ui);
                }
            });
        } else if game_full {
            egui::CentralPanel::default()
                .frame(egui::Frame::NONE)
                .show(ctx, |ui| {
                    game_tab(&mut self.st, ui, &mut self.web, frame, overlay);
                });
        } else {
            let mut style = Style::from_egui(ctx.style().as_ref());
            style.tab_bar.fill_tab_bar = false;
            style.tab_bar.height = 34.0 * self.st.settings.ui_scale;
            style.tab_bar.bg_fill = ctx.style().visuals.extreme_bg_color;
            style.tab_bar.hline_color = ctx.style().visuals.widgets.noninteractive.bg_stroke.color;
            style.tab.tab_body.inner_margin = egui::Margin::same(10);
            style.tab.active.bg_fill = ctx.style().visuals.panel_fill;
            style.tab.focused.bg_fill = ctx.style().visuals.panel_fill;
            style.tab.focused.text_color = ctx.style().visuals.hyperlink_color;
            style.separator.width = 3.0;
            style.separator.color_idle = ctx.style().visuals.extreme_bg_color;
            let mut dock = std::mem::replace(&mut self.dock, DockState::new(vec![]));
            egui::CentralPanel::default()
                .frame(egui::Frame::NONE)
                .show(ctx, |ui| {
                    DockArea::new(&mut dock)
                        .style(style)
                        .show_close_buttons(true)
                        .show_inside(
                            ui,
                            &mut Viewer {
                                st: &mut self.st,
                                web: &mut self.web,
                                frame,
                                overlay,
                            },
                        );
                });
            self.dock = dock;
        }

        panels::palette::window(&mut self.st, ctx);
        panels::settings::window(&mut self.st, ctx);
        panels::export::window(&mut self.st, ctx);
        panels::desktop::window(&mut self.st, ctx);
        if self.st.recover.is_some() && self.st.project.is_some() {
            egui::Window::new("Recover unsaved work?").collapsible(false).resizable(false).anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0]).show(ctx, |ui| {
                ui.label("An autosave newer than the saved scene was found (the editor may have crashed).");
                ui.horizontal(|ui| {
                    if ui.button("Recover").clicked() {
                        self.st.recover_autosave();
                    }
                    if ui.button("Discard").clicked() {
                        self.st.recover = None;
                    }
                });
            });
        }
        if self.quit_confirm {
            egui::Window::new("Unsaved changes")
                .collapsible(false)
                .resizable(false)
                .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                .show(ctx, |ui| {
                    ui.label("Save changes before quitting?");
                    ui.horizontal(|ui| {
                        if ui.button("Save & quit").clicked() {
                            self.run(Action::SaveAll, ctx);
                            self.allow_close = true;
                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                        }
                        if ui.button("Quit without saving").clicked() {
                            self.allow_close = true;
                            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                        }
                        if ui.button("Cancel").clicked() {
                            self.quit_confirm = false;
                        }
                    });
                });
        }
        if let Some((t, at)) = &self.st.toast {
            if at.elapsed() < Duration::from_secs(3) {
                egui::Area::new(egui::Id::new("toast"))
                    .anchor(egui::Align2::CENTER_BOTTOM, [0.0, -20.0])
                    .order(egui::Order::Tooltip)
                    .show(ctx, |ui| {
                        egui::Frame::popup(ui.style()).show(ui, |ui| ui.label(t));
                    });
                ctx.request_repaint_after(Duration::from_millis(300));
            } else {
                self.st.toast = None;
            }
        }
        let overlay = self.overlays_open(ctx);
        self.web.end_frame(overlay);
        // keep polling the hub (game logs, viewport events) while a server runs
        if self.st.play.is_some() {
            ctx.request_repaint_after(Duration::from_millis(100));
        }
    }
}

/// Bottom status bar: a coloured dot + one sentence about what the editor is doing.
fn status_bar(st: &mut EditorState, ui: &mut egui::Ui) {
    let (tint, text) = st.activity();
    ui.horizontal(|ui| {
        let (dot, busy) = match tint {
            Some(Tint::Building) => (egui::Color32::from_rgb(235, 180, 60), true),
            Some(Tint::Playing) => (egui::Color32::from_rgb(110, 170, 255), false),
            None => (egui::Color32::from_rgb(120, 190, 130), false),
        };
        if busy {
            ui.spinner();
        } else {
            ui.colored_label(dot, "●");
        }
        ui.label(text);
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if let Some(p) = &st.project {
                ui.weak(format!("{} · {}", p.name, p.kind.as_str()));
            }
        });
    });
    if busy_repaint(st) {
        ui.ctx().request_repaint_after(Duration::from_millis(250));
    }
}

fn busy_repaint(st: &EditorState) -> bool {
    st.activity().0 == Some(Tint::Building)
}
