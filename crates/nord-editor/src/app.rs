//! eframe App: splash → hub/dock layout, global shortcuts, action dispatch, viewport sync.
use crate::{
    panels::{self, palette::Mode as PMode},
    state::{Action, EditorState, LogLevel, Tool},
    viewport::webview::{open_in_browser, WebPanes},
};
use egui::{Context, Key, Modifiers};
use egui_dock::{DockArea, DockState, NodeIndex, Style, TabViewer};
use std::time::{Duration, Instant};

const SPLASH_MIN: Duration = Duration::from_millis(2000);

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
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
}

impl App {
    pub fn new(splash: bool) -> Self {
        Self {
            st: EditorState::new(),
            dock: default_dock(),
            web: WebPanes::default(),
            splash_start: splash.then(Instant::now),
            sent_rev: 0,
            sent_sel: vec![],
            sent_settings: String::new(),
            quit_confirm: false,
            allow_close: false,
            last_window_save: Instant::now(),
        }
    }

    pub fn show_tab(&mut self, t: Tab) {
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
            if i.consume_key(cmd, Key::R) {
                st.push(Action::Play);
            }
            if i.consume_key(cmd, Key::Period) {
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
                        self.dock = default_dock();
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
                if st.project.is_some() && st.ensure_server().is_some() {
                    if st.dirty {
                        st.save();
                    }
                    if let Some(p) = st.play.as_mut() {
                        p.running = true;
                    }
                    st.game_nonce += 1;
                    st.log(LogLevel::Build, "▶ Play");
                    self.show_tab(Tab::Game);
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
                if ui.button("Reset layout").clicked() {
                    self.dock = default_dock();
                    ui.close_menu();
                }
                act(ui, "Settings…", Action::Settings, st);
            });
            ui.menu_button("Project", |ui| {
                act(ui, "Play  (Cmd+R)", Action::Play, st);
                act(ui, "Stop  (Cmd+.)", Action::Stop, st);
                act(ui, "Validate", Action::Build("validate".into()), st);
            });
            ui.menu_button("Help", |ui| {
                act(ui, "Documentation", Action::ShowTab(Tab::Docs), st);
                act(ui, "Command palette  (Cmd+K)", Action::Palette, st);
                act(ui, "About", Action::About, st);
            });
        });
    }
}

fn run_build(st: &mut EditorState, what: &str) {
    let Some(root) = st.root.clone() else { return };
    match what {
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
        false
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
                Some(u) => {
                    self.web.show(ui, self.frame, "docs", &u, self.overlay);
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
            Tab::Game => {
                if st.play.as_ref().is_some_and(|p| p.running) {
                    let base = st.ensure_server().unwrap_or_default();
                    let url = format!("{base}/?n={}", st.game_nonce);
                    self.web.show(ui, self.frame, "game", &url, self.overlay);
                } else {
                    ui.add_space(30.0);
                    ui.vertical_centered(|ui| {
                        ui.weak("Press ▶ Play (Cmd+R) to run the game here");
                        if let Some(p) = &st.play {
                            if ui.small_button("Open dev server in browser").clicked() {
                                open_in_browser(&format!("http://127.0.0.1:{}/", p.port));
                            }
                        }
                    });
                }
            }
        }
    }
}

impl eframe::App for App {
    fn update(&mut self, ctx: &Context, frame: &mut eframe::Frame) {
        self.frame_ui(ctx, Some(frame));
    }

    fn on_exit(&mut self) {
        self.st.settings.save();
    }
}

impl App {
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
        self.st.autosave_tick();
        self.sync_viewport();

        if let Some(r) = ctx.input(|i| i.viewport().outer_rect) {
            if let Some(inner) = ctx.input(|i| i.viewport().inner_rect) {
                self.st.settings.window = Some([r.min.x, r.min.y, inner.width(), inner.height()]);
            }
        }
        if self.last_window_save.elapsed() > Duration::from_secs(10) {
            self.st.settings.save();
            self.last_window_save = Instant::now();
        }

        egui::TopBottomPanel::top("menu").show(ctx, |ui| self.menu(ui));
        egui::TopBottomPanel::top("toolbar").show(ctx, |ui| panels::toolbar::ui(&mut self.st, ui));
        let overlay = ctx.memory(|m| m.any_popup_open())
            || self.st.palette.mode != PMode::Closed
            || self.st.settings_open
            || self.st.about_open
            || self.quit_confirm
            || self.st.assets_ui.confirm_delete.is_some()
            || self.st.code.confirm_close.is_some();
        self.web.begin_frame();
        if self.st.project.is_none() {
            egui::CentralPanel::default().show(ctx, |ui| panels::hub::ui(&mut self.st, ui));
        } else {
            let mut style = Style::from_egui(ctx.style().as_ref());
            style.tab_bar.fill_tab_bar = true;
            let mut dock = std::mem::replace(&mut self.dock, DockState::new(vec![]));
            egui::CentralPanel::default()
                .frame(egui::Frame::NONE)
                .show(ctx, |ui| {
                    DockArea::new(&mut dock)
                        .style(style)
                        .show_close_buttons(false)
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
        self.web.end_frame();

        panels::palette::window(&mut self.st, ctx);
        panels::settings::window(&mut self.st, ctx);
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
        // keep polling the hub (game logs, viewport events) while a server runs
        if self.st.play.is_some() {
            ctx.request_repaint_after(Duration::from_millis(100));
        }
    }
}
