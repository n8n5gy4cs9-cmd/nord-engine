//! Single editor state. Panels are `fn ui(&mut EditorState, &mut Ui)`; every scene mutation goes through `edit`.
use crate::{scene_ops, undo::UndoStack};
use nord_core::{assets::Asset, scene::Entity, Project, Scene};
use nord_serve::Hub;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use web_time::Instant;

/// Keyboard shortcut shared with the FPS editor and its play-test iframe.
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct FpsShortcut {
    pub key: String,
    pub shift: bool,
    pub command: bool,
    pub alt: bool,
}

impl FpsShortcut {
    fn new(key: &str, shift: bool) -> Self {
        Self {
            key: key.into(),
            shift,
            command: false,
            alt: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(default)]
pub struct FpsShortcuts {
    pub test: FpsShortcut,
    pub test_here: FpsShortcut,
    pub stop: FpsShortcut,
}

impl Default for FpsShortcuts {
    fn default() -> Self {
        Self {
            test: FpsShortcut::new("F5", false),
            test_here: FpsShortcut::new("F5", true),
            stop: FpsShortcut::new("Escape", true),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct Settings {
    pub skin: String,
    pub theme: String,
    /// One-time migration from the original blue default; later theme choices persist.
    #[serde(default)]
    pub appearance_version: u8,
    pub ui_scale: f32,
    pub code_font_size: f32,
    pub code_word_wrap: bool,
    /// Line-height multiplier relative to the code font size.
    pub code_line_height: f32,
    /// Extra spacing between code characters, in points.
    pub code_letter_spacing: f32,
    pub tab_width: usize,
    pub autosave_secs: u64,
    /// Opt-in saved example copies and persistent embedded-browser storage for testing.
    pub use_cached_content: bool,
    pub snap: bool,
    pub snap_move: f64,
    pub snap_rot: f64,
    pub snap_scale: f64,
    pub grid: bool,
    pub window: Option<[f32; 4]>, // x, y, w, h
    /// Unity-style feedback: tint the whole editor while the game is playing / a Rust game is compiling
    pub tint: bool,
    /// PLAYMODE-COLOR (rgb)
    pub play_tint: [u8; 3],
    /// colour while compiling (before the game starts)
    pub build_tint: [u8; 3],
    /// Cmd/Ctrl + key: run, and stop again while running (toggle). Rebindable in case a game/app needs the combo.
    /// where the game view sits inside the Game panel when not 'Fit': anchor 0..1 (x, y; 0,0 = top-left) + pixel offset
    pub game_anchor: [f32; 2],
    pub game_offset: [f32; 2],
    pub run_key: String,
    /// Cmd/Ctrl + key: stop only
    pub stop_key: String,
    pub fps_shortcuts: FpsShortcuts,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            skin: "modern".into(),
            theme: "graphite".into(),
            appearance_version: 1,
            ui_scale: 1.0,
            code_font_size: 13.0,
            code_word_wrap: false,
            code_line_height: 1.6,
            code_letter_spacing: 0.0,
            tab_width: 2,
            autosave_secs: 30,
            use_cached_content: false,
            snap: false,
            snap_move: 1.0,
            snap_rot: 15.0,
            snap_scale: 0.1,
            grid: true,
            window: None,
            tint: true,
            play_tint: [34, 56, 96],
            build_tint: [104, 72, 20],
            game_anchor: [0.5, 0.0],
            game_offset: [0.0, 0.0],
            run_key: "R".into(),
            stop_key: ".".into(),
            fps_shortcuts: FpsShortcuts::default(),
        }
    }
}

impl Settings {
    /// Restore only run/stop and FPS test keys, preserving appearance and layout.
    pub fn reset_shortcuts(&mut self) {
        self.run_key = "R".into();
        self.stop_key = ".".into();
        self.fps_shortcuts = FpsShortcuts::default();
    }

    /// Key bound to run/stop-toggle (`run`) or stop-only; falls back to the default when the saved name is not a key.
    pub fn key(&self, run: bool) -> egui::Key {
        let (n, d) = if run {
            (&self.run_key, egui::Key::R)
        } else {
            (&self.stop_key, egui::Key::Period)
        };
        egui::Key::from_name(n.trim()).unwrap_or(d)
    }
    pub fn key_label(&self, run: bool) -> String {
        format!("Cmd+{}", self.key(run).name())
    }
    fn path() -> PathBuf {
        nord_core::io::config_dir().join("editor.json")
    }
    pub fn load() -> Self {
        let mut s: Self = nord_core::io::load_json(&Self::path()).unwrap_or_default();
        s.migrate_appearance();
        s
    }
    fn migrate_appearance(&mut self) {
        if self.appearance_version == 0 {
            if self.theme == "nord" {
                self.theme = "graphite".into();
            }
            self.appearance_version = 1;
        }
    }
    pub fn save(&self) {
        let _ = nord_core::io::save_json(&Self::path(), self);
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tool {
    Move,
    Rotate,
    Scale,
}

#[derive(Clone, Debug, PartialEq)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
    Build,
}

#[derive(Clone, Debug)]
pub struct LogLine {
    pub level: LogLevel,
    pub text: String,
}

/// Things the UI asks the app to do (menu, palette, shortcuts all produce these).
#[derive(Clone, Debug, PartialEq)]
pub enum Action {
    NewProject,
    OpenProject,
    OpenPath(PathBuf),
    CloseProject,
    Save,
    SaveAll,
    /// browser build: download the open project as a .zip
    DownloadZip,
    Undo,
    Redo,
    Copy,
    Paste,
    Duplicate,
    Delete,
    AddEntity(Option<String>),
    Focus,
    SetTool(Tool),
    Play,
    Stop,
    Reload,
    QuickOpen,
    Palette,
    Settings,
    ResetLayout,
    /// Window ▸ Layout presets ("default", "2d", "3d", "coding", "visual")
    Layout(String),
    /// Pause / resume the running game, or advance it one frame while paused
    PauseGame,
    StepGame,
    ResetSettings,
    Export,
    DesktopSettings,
    /// install / upgrade the FPS Creator runtime in the open project
    FpsInstall,
    About,
    OpenFile(PathBuf, Option<usize>),
    ToggleSnap,
    ToggleGrid,
    ShowTab(crate::app::Tab),
    Build(String),
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tint {
    Building,
    Playing,
}

/// Background Rust build (see `app::start_rust_build`). Output lines go to the hub log so they appear in the Console with clickable `file:line` links.
pub struct RustJob {
    pub done: std::sync::atomic::AtomicBool,
    pub ok: std::sync::atomic::AtomicBool,
    /// start the game as soon as the build succeeds (Play on a Rust project)
    pub play_after: bool,
    pub started: Instant,
    /// last cargo line, e.g. `rapier2d v0.22.0`
    pub phase: std::sync::Mutex<String>,
    pub crates: std::sync::atomic::AtomicUsize,
}

pub struct Play {
    pub port: u16,
    pub hub: Arc<Hub>,
    pub log_seen: usize,
    pub inbox_seen: usize,
    pub running: bool,
}

pub struct EditorState {
    pub root: Option<PathBuf>,
    pub project: Option<Project>,
    pub scene: Option<Scene>,
    pub scene_file: Option<String>,
    pub selection: Vec<String>,
    pub undo: UndoStack,
    pub dirty: bool,
    pub rev: u64,
    pub assets: Vec<Asset>,
    pub asset_dir: String,
    pub console: Vec<LogLine>,
    pub clipboard: Option<Entity>,
    pub settings: Settings,
    pub tool: Tool,
    pub actions: Vec<Action>,
    pub toast: Option<(String, Instant)>,
    pub play: Option<Play>,
    /// show the console under the Game view (off by default)
    pub game_console: bool,
    /// console strip height under the Game view (px, draggable)
    pub game_console_h: f32,
    /// Game view size: 0.0 = fit the tab, otherwise a fixed scale of the project's display size (centered)
    pub game_scale: f32,
    /// Game view maximised over the whole window (menu/toolbar/panels hidden, OS fullscreen); Esc leaves
    pub game_full: bool,
    pub lock: Option<nord_core::io::ProjectLock>,
    pub last_autosave: Instant,
    pub recover: Option<String>,
    pub script_cache: HashMap<String, (web_time::SystemTime, Vec<crate::schema::Field>)>,
    /// viewport asked us not to echo the scene back after its own edit
    pub skip_viewport_sync: bool,
    pub hierarchy_filter: String,
    pub collapsed: std::collections::HashSet<String>,
    /// file the UI Designer / Graph tab should show (`?file=` of the embedded page); set by the Assets menu and page IPC
    pub designer_file: Option<String>,
    /// (entity id, text) while an entity is being renamed in the Hierarchy
    pub hierarchy_rename: Option<(String, String)>,
    pub graph_file: Option<String>,
    pub engine_root: Option<PathBuf>,
    pub themes: Arc<crate::theme::Themes>,
    pub code: crate::code::CodeState,
    pub assets_ui: crate::panels::assets::AssetsUi,
    pub console_ui: crate::panels::console::ConsoleUi,
    pub library: crate::panels::library::LibraryUi,
    pub docs_ui: crate::panels::docs::DocsUi,
    pub hub: crate::panels::hub::HubUi,
    pub palette: crate::panels::palette::PaletteUi,
    pub anim: crate::panels::animation::AnimUi,
    pub events: crate::panels::events::EventsUi,
    pub history_ui: crate::panels::history::HistoryUi,
    pub project_ui: crate::panels::project::ProjectUi,
    pub layout_ui: crate::panels::layout::LayoutUi,
    pub sprite: crate::panels::sprite::SpriteUi,
    pub particles_ui: crate::panels::particles::ParticlesUi,
    pub timeline_ui: crate::panels::timeline::TimelineUi,
    /// last camera reported by the 2D viewport: [x, y, zoom]
    pub viewport_cam: Option<[f64; 3]>,
    files_cache: Option<(Instant, Vec<String>)>,
    /// phone/tablet preview server while it is on (dropping it stops the server)
    pub lan: Option<crate::platform::Lan>,
    pub lan_log_seen: usize,
    pub lan_open: bool,
    pub settings_open: bool,
    pub export_ui: crate::panels::export::ExportUi,
    pub desktop_ui: crate::panels::desktop::DesktopUi,
    pub about_open: bool,
    pub apply_theme: bool,
    pub apply_styles: bool,
    /// editor tint currently applied (`Tint::None` = theme colours) and the untinted visuals to restore
    pub tint_applied: Option<(Tint, [u8; 3])>,
    pub base_visuals: Option<egui::Visuals>,
    /// transient one-sentence status (shown in the status bar for a few seconds)
    pub status_msg: Option<(String, Instant)>,
    /// bumps on Play/Reload so the Game webview reloads
    pub game_nonce: u32,
    pub game_paused: bool,
    /// set by Stop: keeps the play-mode tint for a moment while the game view is torn down
    pub stopping: Option<Instant>,
    /// running `cargo build` for a Rust (wasm-game / wasm-app) project; `None` when idle
    pub rust_job: Option<Arc<RustJob>>,
    /// the edit viewport page has said hello (so scene/thumb messages are meaningful)
    pub viewport_ready: bool,
}

impl Default for EditorState {
    fn default() -> Self {
        Self::new()
    }
}

impl EditorState {
    pub fn new() -> Self {
        Self {
            root: None,
            project: None,
            scene: None,
            scene_file: None,
            selection: vec![],
            undo: UndoStack::default(),
            dirty: false,
            rev: 0,
            assets: vec![],
            asset_dir: "assets".into(),
            console: vec![],
            clipboard: None,
            settings: Settings::load(),
            tool: Tool::Move,
            actions: vec![],
            toast: None,
            play: None,
            game_console: false,
            game_console_h: 160.0,
            game_scale: 0.0,
            game_full: false,
            lock: None,
            last_autosave: Instant::now(),
            recover: None,
            script_cache: HashMap::new(),
            skip_viewport_sync: false,
            hierarchy_filter: String::new(),
            collapsed: Default::default(),
            designer_file: None,
            hierarchy_rename: None,
            graph_file: None,
            engine_root: crate::platform::engine_root(),
            themes: Arc::new(crate::theme::Themes::load()),
            code: Default::default(),
            assets_ui: Default::default(),
            console_ui: Default::default(),
            library: Default::default(),
            docs_ui: Default::default(),
            hub: Default::default(),
            palette: Default::default(),
            anim: Default::default(),
            events: Default::default(),
            history_ui: Default::default(),
            project_ui: Default::default(),
            layout_ui: Default::default(),
            sprite: Default::default(),
            particles_ui: Default::default(),
            timeline_ui: Default::default(),
            viewport_cam: None,
            files_cache: None,
            lan: None,
            lan_log_seen: 0,
            lan_open: false,
            settings_open: false,
            export_ui: Default::default(),
            desktop_ui: Default::default(),
            about_open: false,
            apply_theme: true,
            apply_styles: false,
            tint_applied: None,
            base_visuals: None,
            status_msg: None,
            game_nonce: 0,
            game_paused: false,
            stopping: None,
            rust_job: None,
            viewport_ready: false,
        }
    }

    pub fn push(&mut self, a: Action) {
        self.actions.push(a);
    }

    pub fn log(&mut self, level: LogLevel, text: impl Into<String>) {
        self.console.push(LogLine {
            level,
            text: text.into(),
        });
        if self.console.len() > 5000 {
            self.console.drain(..1000);
        }
    }

    pub fn toast(&mut self, t: impl Into<String>) {
        let t = t.into();
        self.status_msg = Some((t.clone(), Instant::now()));
        self.toast = Some((t, Instant::now()));
    }

    /// What the editor is doing right now, in one sentence (status bar).
    pub fn activity(&self) -> (Option<Tint>, String) {
        use std::sync::atomic::Ordering::SeqCst;
        if let Some(j) = self.rust_job.as_ref().filter(|j| !j.done.load(SeqCst)) {
            let secs = j.started.elapsed().as_secs();
            let phase = j.phase.lock().map(|p| p.clone()).unwrap_or_default();
            let n = j.crates.load(SeqCst);
            let what = if phase.is_empty() {
                "starting cargo".to_string()
            } else {
                phase
            };
            let hint = if secs > 20 && n > 0 {
                " — first builds compile all dependencies and can take a few minutes"
            } else {
                ""
            };
            return (
                Some(Tint::Building),
                format!(
                    "Compiling Rust {} — {what} ({n} crates, {secs}s){hint}",
                    if j.play_after {
                        "game, then it will start"
                    } else {
                        "project"
                    }
                ),
            );
        }
        if self.export_ui.is_running() {
            return (Some(Tint::Building), "Exporting…".into());
        }
        if self.play.as_ref().is_some_and(|p| p.running) {
            return (
                Some(Tint::Playing),
                "Playing — press Cmd+. (Stop) to return to editing".into(),
            );
        }
        if self
            .stopping
            .is_some_and(|t| t.elapsed() < Duration::from_millis(1500))
        {
            return (Some(Tint::Playing), "Stopping…".into());
        }
        if let Some((m, t)) = &self.status_msg {
            if t.elapsed() < Duration::from_secs(6) {
                return (None, m.clone());
            }
        }
        if self.dirty || self.code.any_dirty() {
            return (None, "Unsaved changes (Cmd+S to save)".into());
        }
        (None, "Ready".into())
    }

    pub fn is_3d(&self) -> bool {
        self.project
            .as_ref()
            .is_some_and(|p| p.kind == nord_core::ProjectType::ThreeD)
    }

    pub fn selected(&self) -> Option<&Entity> {
        let id = self.selection.first()?;
        scene_ops::find(&self.scene.as_ref()?.entities, id)
    }

    pub fn select(&mut self, id: Option<String>) {
        self.selection = id.into_iter().collect();
    }

    /// The one way to change the scene: records undo, marks dirty, bumps the revision (viewport resync).
    pub fn edit(
        &mut self,
        label: &str,
        key: Option<&str>,
        f: impl FnOnce(&mut Vec<Entity>),
    ) -> bool {
        let Some(s) = self.scene.as_mut() else {
            return false;
        };
        let changed = self.undo.apply(s, label, key, |sc| f(&mut sc.entities));
        if changed {
            self.dirty = true;
            self.rev += 1;
        }
        changed
    }

    /// Like `edit`, but the closure sees the whole scene (settings such as layers are undone together with the entities).
    pub fn edit_scene(
        &mut self,
        label: &str,
        key: Option<&str>,
        f: impl FnOnce(&mut Scene),
    ) -> bool {
        let Some(s) = self.scene.as_mut() else {
            return false;
        };
        let changed = self.undo.apply(s, label, key, f);
        if changed {
            self.dirty = true;
            self.rev += 1;
        }
        changed
    }

    pub fn do_undo(&mut self) {
        if let Some(s) = self.scene.as_mut() {
            if let Some(l) = self.undo.undo(s) {
                self.dirty = true;
                self.rev += 1;
                self.toast(format!("Undo: {l}"));
            }
        }
    }

    pub fn do_redo(&mut self) {
        if let Some(s) = self.scene.as_mut() {
            if let Some(l) = self.undo.redo(s) {
                self.dirty = true;
                self.rev += 1;
                self.toast(format!("Redo: {l}"));
            }
        }
    }

    pub fn add_entity(&mut self, parent: Option<String>) {
        let mut e = Entity::new("Entity");
        if self.is_3d() {
            e.components
                .push(serde_json::from_value(json!({"type":"mesh","shape":"box"})).unwrap());
        } else {
            e.transform.pos = [0.0, 0.0, 0.0];
        }
        let id = e.id.clone();
        self.edit("Add entity", None, |l| {
            let idx = usize::MAX;
            scene_ops::insert(l, parent.as_deref(), idx, e);
        });
        self.select(Some(id));
    }

    /// Hierarchy ▸ Create: a ready-made entity (name, components) under `parent` (Unity's GameObject menu).
    pub fn add_preset(&mut self, kind: &str, parent: Option<String>) {
        let (name, comps): (&str, Vec<Value>) = match kind {
            "empty" => ("Empty", vec![]),
            "camera" => ("Camera", vec![json!({"type":"camera"})]),
            "text" => (
                "Text",
                vec![json!({"type":"text","text":"Hello","size":24})],
            ),
            "light" => ("Light", vec![json!({"type":"light","kind":"point"})]),
            "audio" => ("Audio Source", vec![json!({"type":"audioSource"})]),
            "spawner" => ("Spawner", vec![json!({"type":"spawner","interval":1})]),
            "trigger" => (
                "Trigger Zone",
                vec![json!({"type":"trigger","shape":"box"})],
            ),
            "graph" => (
                "Graph",
                vec![json!({"type":"graph","file":"graphs/main.graph.json"})],
            ),
            "ui-label" => ("UI Label", vec![json!({"type":"uiLabel","text":"Label"})]),
            "ui-button" => (
                "UI Button",
                vec![json!({"type":"uiButton","text":"Button"})],
            ),
            "ui-panel" => ("UI Panel", vec![json!({"type":"uiPanel","w":200,"h":120})]),
            "cube" => (
                "Cube",
                vec![
                    json!({"type":"mesh","shape":"box"}),
                    json!({"type":"material"}),
                ],
            ),
            "sphere" => (
                "Sphere",
                vec![
                    json!({"type":"mesh","shape":"sphere"}),
                    json!({"type":"material"}),
                ],
            ),
            "ground" => (
                "Ground",
                vec![
                    json!({"type":"mesh","shape":"ground","size":[20,0.2,20]}),
                    json!({"type":"material"}),
                ],
            ),
            "sun" => (
                "Directional Light",
                vec![json!({"type":"light","kind":"directional","intensity":1.2})],
            ),
            _ => return,
        };
        let mut e = Entity::new(name);
        for c in comps {
            if let Ok(c) = serde_json::from_value(c) {
                e.components.push(c);
            }
        }
        let id = e.id.clone();
        self.edit("Create", None, |l| {
            scene_ops::insert(l, parent.as_deref(), usize::MAX, e);
        });
        self.select(Some(id));
    }

    /// Wrap the selected entities in a new empty parent ("Create Empty Parent").
    pub fn group_selected(&mut self) {
        let ids = self.selection.clone();
        if ids.is_empty() {
            return;
        }
        let g = Entity::new("Group");
        let gid = g.id.clone();
        let first = ids[0].clone();
        self.edit("Group", None, |l| {
            let parent = scene_ops::parent_of(l, &first);
            scene_ops::insert(l, parent.as_deref(), usize::MAX, g);
            for id in &ids {
                scene_ops::reparent(l, id, Some(&gid), usize::MAX);
            }
        });
        self.select(Some(gid));
    }

    /// Dropping an asset on the hierarchy: image -> sprite entity, model -> model entity, prefab -> instance,
    /// audio -> audioSource entity, script -> attached to the selection.
    pub fn add_asset_entity(&mut self, path: &str) {
        use nord_core::assets::{classify, AssetType};
        let name = path
            .rsplit('/')
            .next()
            .unwrap_or(path)
            .split('.')
            .next()
            .unwrap_or("Entity")
            .to_string();
        let mut e = Entity::new(&name);
        match classify(path) {
            AssetType::Image | AssetType::Spritesheet => e
                .components
                .push(serde_json::from_value(json!({"type":"sprite","texture":path})).unwrap()),
            AssetType::Model => e
                .components
                .push(serde_json::from_value(json!({"type":"model","path":path})).unwrap()),
            AssetType::Audio => e
                .components
                .push(serde_json::from_value(json!({"type":"audioSource","clip":path})).unwrap()),
            AssetType::Prefab => {
                e.prefab = Some(nord_core::scene::PrefabRef {
                    path: path.into(),
                    overrides: Default::default(),
                })
            }
            _ if path.ends_with(".js") || path.ends_with(".ts") => {
                if let Some(id) = self.selection.first().cloned() {
                    let p = path.to_string();
                    self.edit("Attach script", None, |l| {
                        if let Some(t) = scene_ops::find_mut(l, &id) {
                            t.scripts.push(nord_core::scene::ScriptRef {
                                path: p,
                                attributes: Default::default(),
                            });
                        }
                    });
                }
                return;
            }
            _ => return,
        }
        let id = e.id.clone();
        self.edit("Add from asset", None, |l| {
            scene_ops::insert(l, None, usize::MAX, e);
        });
        self.select(Some(id));
    }

    pub fn delete_selected(&mut self) {
        let ids = self.selection.clone();
        if ids.is_empty() {
            return;
        }
        self.edit("Delete", None, |l| {
            for id in &ids {
                scene_ops::remove(l, id);
            }
        });
        self.selection.clear();
    }

    pub fn duplicate_selected(&mut self) {
        let ids = self.selection.clone();
        let mut new = vec![];
        self.edit("Duplicate", None, |l| {
            for id in &ids {
                if let Some(n) = scene_ops::duplicate(l, id) {
                    new.push(n);
                }
            }
        });
        if !new.is_empty() {
            self.selection = new;
        }
    }

    pub fn copy_selected(&mut self) {
        self.clipboard = self.selected().cloned();
    }

    pub fn paste(&mut self) {
        let Some(c) = self.clipboard.clone() else {
            return;
        };
        let e = scene_ops::clone_fresh(&c);
        let id = e.id.clone();
        let parent = self.selection.first().and_then(|s| {
            self.scene
                .as_ref()
                .and_then(|sc| scene_ops::parent_of(&sc.entities, s))
        });
        self.edit("Paste", None, |l| {
            scene_ops::insert(l, parent.as_deref(), usize::MAX, e);
        });
        self.select(Some(id));
    }

    // ---- project / scene IO ----

    pub fn open_project(&mut self, dir: &Path) -> Result<(), String> {
        let dir = crate::panels::hub::current_example_path(
            dir,
            self.engine_root.as_deref(),
            self.settings.use_cached_content,
        );
        let dir = dir.as_path();
        self.close_project();
        let p = nord_core::io::load_project(dir).map_err(|e| e.to_string())?;
        self.lock = match nord_core::io::ProjectLock::acquire(dir) {
            Ok(l) => Some(l),
            Err(e) => return Err(e.to_string()),
        };
        let start = p.start_scene.clone();
        self.root = Some(dir.to_path_buf());
        self.project = Some(p);
        let _ = nord_core::io::add_recent(dir);
        self.refresh_assets();
        if !start.is_empty() {
            self.open_scene(&start)?;
        }
        self.log(LogLevel::Info, format!("Opened {}", dir.display()));
        Ok(())
    }

    pub fn close_project(&mut self) {
        self.stop();
        self.lan = None;
        self.root = None;
        self.project = None;
        self.scene = None;
        self.scene_file = None;
        self.selection.clear();
        self.undo.clear();
        self.assets.clear();
        self.script_cache.clear();
        self.dirty = false;
        self.lock = None;
        self.rev += 1;
    }

    /// Project files (anywhere in the project, not only `assets/`) whose name ends with `suffix`, e.g. `.events.json`, `.scene.json`.
    /// The folder is scanned at most every 2 seconds; `refresh_assets` forces a rescan.
    pub fn project_files(&mut self, suffix: &str) -> Vec<String> {
        let Some(root) = self.root.clone() else {
            return vec![];
        };
        if self
            .files_cache
            .as_ref()
            .is_none_or(|(t, _)| t.elapsed() > Duration::from_secs(2))
        {
            self.files_cache = Some((Instant::now(), nord_core::history::source_files(&root)));
        }
        self.files_cache
            .as_ref()
            .map(|(_, v)| v.iter().filter(|f| f.ends_with(suffix)).cloned().collect())
            .unwrap_or_default()
    }

    pub fn open_scene(&mut self, rel: &str) -> Result<(), String> {
        let root = self.root.clone().ok_or("no project")?;
        let path = root.join(rel);
        let s: Scene = nord_core::io::load_json(&path).map_err(|e| e.to_string())?;
        self.scene = Some(s);
        self.scene_file = Some(rel.to_string());
        self.selection.clear();
        self.undo.clear();
        self.dirty = false;
        self.rev += 1;
        self.recover = self
            .autosave_path()
            .filter(|a| {
                let m = |p: &Path| nord_core::vfs::metadata(p).and_then(|m| m.modified()).ok();
                matches!((m(a), m(&path)), (Some(x), Some(y)) if x > y)
            })
            .map(|a| a.to_string_lossy().into_owned());
        Ok(())
    }

    fn autosave_path(&self) -> Option<PathBuf> {
        let f = self.scene_file.as_ref()?;
        Some(
            self.root
                .as_ref()?
                .join(".nord-cache/autosave")
                .join(f.replace('/', "__")),
        )
    }

    /// After a version-history restore: re-read everything the editor holds in memory from disk.
    pub fn reload_after_restore(&mut self) {
        let Some(root) = self.root.clone() else {
            return;
        };
        if let Ok(p) = nord_core::io::load_project(&root) {
            self.project = Some(p);
        }
        if let Some(f) = self.scene_file.clone() {
            match nord_core::io::load_json::<Scene>(&root.join(&f)) {
                Ok(s) => self.scene = Some(s),
                Err(_) => self.scene = None,
            }
        }
        if let Some(p) = self.events.path.clone() {
            let _ = self.events.load(&root, &p);
        }
        self.selection.clear();
        self.undo.clear();
        self.script_cache.clear();
        self.dirty = false;
        self.refresh_assets();
        self.rev += 1;
    }

    pub fn recover_autosave(&mut self) {
        if let Some(p) = self.recover.take() {
            if let Ok(s) = nord_core::io::load_json::<Scene>(Path::new(&p)) {
                self.scene = Some(s);
                self.dirty = true;
                self.rev += 1;
                self.undo.clear();
                self.toast("Recovered autosave");
            }
        }
    }

    pub fn save(&mut self) {
        let (Some(root), Some(f), Some(s)) = (&self.root, &self.scene_file, &self.scene) else {
            return;
        };
        // version history: a snapshot of the sources before the first save in any 10 minutes
        nord_core::history::snapshot_if_stale(root, "auto (before save)", 600);
        match nord_core::io::save_json(&root.join(f), s) {
            Ok(()) => {
                self.dirty = false;
                if let Some(a) = self.autosave_path() {
                    let _ = nord_core::vfs::remove_file(a);
                }
                self.toast(format!("Saved {f}"));
            }
            Err(e) => self.log(LogLevel::Error, format!("Save failed: {e}")),
        }
    }

    /// Crash-safe autosave: atomic write to `.nord-cache/autosave/`, never touches the real file.
    pub fn autosave_tick(&mut self) {
        if !self.dirty
            || self.last_autosave.elapsed()
                < Duration::from_secs(self.settings.autosave_secs.max(5))
        {
            return;
        }
        self.last_autosave = Instant::now();
        if let (Some(p), Some(s)) = (self.autosave_path(), &self.scene) {
            let _ = nord_core::io::save_json(&p, s);
        }
    }

    pub fn refresh_assets(&mut self) {
        self.files_cache = None;
        if let Some(r) = &self.root {
            self.assets = nord_core::assets::scan(r).unwrap_or_default();
        }
    }

    // ---- play / viewport server ----

    /// Start the embedded dev server (once per project); returns the base URL.
    pub fn ensure_server(&mut self) -> Option<String> {
        if self.play.is_none() {
            let root = self.root.clone()?;
            let engine = self
                .engine_root
                .clone()
                .or_else(crate::platform::web_engine_root);
            let Some(engine) = engine else {
                self.log(
                    LogLevel::Error,
                    "Engine root not found (vendor/VENDOR.json). Set NORD_ROOT.",
                );
                return None;
            };
            match crate::platform::start_background(root, engine) {
                Ok((port, hub)) => {
                    self.play = Some(Play {
                        port,
                        hub,
                        log_seen: 0,
                        inbox_seen: 0,
                        running: false,
                    });
                    self.log(
                        LogLevel::Build,
                        format!("Dev server on http://127.0.0.1:{port}"),
                    );
                }
                Err(e) => {
                    self.log(LogLevel::Error, format!("Server failed: {e}"));
                    return None;
                }
            }
        }
        self.play
            .as_ref()
            .map(|p| format!("http://127.0.0.1:{}", p.port))
    }

    pub fn is_playing(&self) -> bool {
        self.play.as_ref().is_some_and(|p| p.running)
    }

    pub fn stop(&mut self) {
        self.game_paused = false;
        if let Some(p) = self.play.as_mut() {
            if p.running {
                self.stopping = Some(Instant::now());
            }
            p.running = false;
        }
    }

    /// Pull game console lines + viewport messages from the hub.
    pub fn pump_hub(&mut self) -> Vec<Value> {
        // console lines from a phone connected to the LAN preview
        if let Some(l) = &self.lan {
            let new: Vec<_> = {
                let g = l.hub.logs.lock().unwrap();
                let n: Vec<_> = g.iter().skip(self.lan_log_seen).cloned().collect();
                self.lan_log_seen = g.len();
                n
            };
            for e in new {
                let level = match e.level.as_str() {
                    "warn" => LogLevel::Warn,
                    "error" => LogLevel::Error,
                    _ => LogLevel::Info,
                };
                self.log(level, format!("[phone] {}", e.text));
            }
        }
        let Some(p) = self.play.as_mut() else {
            return vec![];
        };
        let (logs, msgs) = {
            let l = p.hub.logs.lock().unwrap();
            let new: Vec<_> = l.iter().skip(p.log_seen).cloned().collect();
            p.log_seen = l.len();
            let i = p.hub.inbox.lock().unwrap();
            let m: Vec<_> = i.iter().skip(p.inbox_seen).cloned().collect();
            p.inbox_seen = i.len();
            (new, m)
        };
        for e in logs {
            let level = match e.level.as_str() {
                "warn" => LogLevel::Warn,
                "error" => LogLevel::Error,
                _ => LogLevel::Info,
            };
            self.log(level, e.text);
        }
        msgs
    }

    pub fn send_viewport(&self, msg: Value) {
        if let Some(p) = &self.play {
            let _ = p.hub.edit_tx.send(msg.to_string());
        }
    }

    /// Full state for the edit viewport.
    pub fn viewport_scene_msg(&self) -> Value {
        json!({
            "t": "scene",
            "rev": self.rev,
            "project": self.project,
            "scene": self.scene,
            "selection": self.selection,
        })
    }

    pub fn viewport_settings_msg(&self) -> Value {
        json!({
            "t": "settings",
            "tool": match self.tool { Tool::Move => "move", Tool::Rotate => "rotate", Tool::Scale => "scale" },
            "snap": self.settings.snap,
            "snapMove": self.settings.snap_move,
            "snapRot": self.settings.snap_rot,
            "snapScale": self.settings.snap_scale,
            "grid": self.settings.grid,
        })
    }

    /// Apply messages coming from the edit viewport.
    pub fn handle_viewport(&mut self, m: &Value) {
        match m["t"].as_str() {
            Some("ready") => {
                self.viewport_ready = true;
                self.send_viewport(self.viewport_scene_msg());
                self.send_viewport(self.viewport_settings_msg());
            }
            // embedded pages (UI Designer, Graph) ask the editor to open a project file in the code editor / another tab
            Some("open-file") => {
                if let (Some(root), Some(p)) = (self.root.clone(), m["path"].as_str()) {
                    if !p.contains("..") && !p.starts_with('/') {
                        let line = m["line"].as_u64().map(|l| l as usize);
                        self.push(Action::OpenFile(root.join(p), line));
                    }
                }
            }
            // Graph editor: "Add to current scene" puts the file into scene.settings.graphs so Play runs it
            Some("attach-graph") => {
                if let Some(file) = m["file"].as_str().map(String::from) {
                    if file.starts_with("graphs/") && !file.contains("..") {
                        let f = file.clone();
                        let changed = self.edit_scene("Attach graph", None, |s| {
                            let arr = s
                                .settings
                                .extra
                                .entry("graphs")
                                .or_insert_with(|| json!([]));
                            if let Some(a) = arr.as_array_mut() {
                                if !a.iter().any(|v| v.as_str() == Some(&f)) {
                                    a.push(json!(f));
                                }
                            }
                        });
                        if changed {
                            self.push(Action::SaveAll);
                            self.toast(format!("{file} added to the scene — press Play"));
                        } else {
                            self.toast("Open a scene first, or the graph is already attached");
                        }
                    }
                }
            }
            Some("open-tab") => {
                let file = m["file"].as_str().map(String::from);
                match m["tab"].as_str() {
                    Some("uidesigner") => {
                        self.designer_file = file;
                        self.push(Action::ShowTab(crate::app::Tab::UiDesigner));
                    }
                    Some("graph") => {
                        self.graph_file = file;
                        self.push(Action::ShowTab(crate::app::Tab::Graph));
                    }
                    _ => {}
                }
            }
            Some("select") => {
                let id = m["id"].as_str().map(String::from);
                self.select(id);
            }
            Some("cam") => {
                if let (Some(x), Some(y), Some(z)) =
                    (m["x"].as_f64(), m["y"].as_f64(), m["zoom"].as_f64())
                {
                    self.viewport_cam = Some([x, y, z]);
                }
            }
            Some("guide") => {
                // dragged out of / back into a ruler: add, move (from → to) or delete (to == null) a guide line
                let ax = m["axis"].as_str().unwrap_or("x").to_string();
                let (from, to) = (m["from"].as_f64(), m["to"].as_f64());
                self.edit_scene("Guide", None, |s| {
                    let (mut gx, mut gy) = crate::layout::guides(s);
                    let list = if ax == "x" { &mut gx } else { &mut gy };
                    if let Some(f) = from {
                        list.retain(|g| (*g - f).abs() > 1e-9);
                    }
                    if let Some(t) = to {
                        list.push(t);
                    }
                    crate::layout::set_guides(s, gx, gy);
                });
            }
            Some("transform") => {
                let Some(id) = m["id"].as_str() else { return };
                let v3 = |k: &str| -> Option<[f64; 3]> {
                    let a = m[k].as_array()?;
                    Some([
                        a.first()?.as_f64()?,
                        a.get(1)?.as_f64()?,
                        a.get(2)?.as_f64()?,
                    ])
                };
                let (pos, rot, scale) = (v3("pos"), v3("rot"), v3("scale"));
                let id = id.to_string();
                self.skip_viewport_sync = true;
                self.edit("Transform", Some(&format!("xf:{id}")), |l| {
                    if let Some(e) = scene_ops::find_mut(l, &id) {
                        if let Some(p) = pos {
                            e.transform.pos = p;
                        }
                        if let Some(r) = rot {
                            e.transform.rot = r;
                        }
                        if let Some(s) = scale {
                            e.transform.scale = s;
                        }
                    }
                });
            }
            Some("key") => {
                let (cmd, shift) = (
                    m["cmd"].as_bool().unwrap_or(false),
                    m["shift"].as_bool().unwrap_or(false),
                );
                let a = match (m["key"].as_str().unwrap_or(""), cmd) {
                    ("w", false) => Some(Action::SetTool(Tool::Move)),
                    ("e", false) => Some(Action::SetTool(Tool::Rotate)),
                    ("r", false) => Some(Action::SetTool(Tool::Scale)),
                    ("f", false) => Some(Action::Focus),
                    ("delete" | "backspace", false) => Some(Action::Delete),
                    ("z", true) if shift => Some(Action::Redo),
                    ("z", true) => Some(Action::Undo),
                    ("d", true) => Some(Action::Duplicate),
                    ("s", true) => Some(Action::SaveAll),
                    ("c", true) => Some(Action::Copy),
                    ("v", true) => Some(Action::Paste),
                    ("p", true) => Some(Action::QuickOpen),
                    ("k", true) => Some(Action::Palette),
                    _ => None,
                };
                if let Some(a) = a {
                    self.push(a);
                }
            }
            Some("thumb") => {
                // model thumbnail rendered by the viewport; the file is written by the server (/api/thumb-upload)
                if let Some(p) = m["path"].as_str() {
                    self.assets_ui.thumbs_done(p);
                }
            }
            Some("log") => {
                let t = m["text"].as_str().unwrap_or("").to_string();
                self.log(LogLevel::Info, format!("[viewport] {t}"));
            }
            _ => {}
        }
    }

    /// `scripts/foo.js` -> attribute schema (cached by mtime only when explicitly enabled).
    pub fn script_fields(&mut self, rel: &str) -> Vec<crate::schema::Field> {
        let Some(root) = &self.root else {
            return vec![];
        };
        let p = root.join(rel);
        let Ok(mt) = nord_core::vfs::metadata(&p).and_then(|m| m.modified()) else {
            return vec![];
        };
        if let Some((t, f)) = self
            .script_cache
            .get(rel)
            .filter(|_| self.settings.use_cached_content)
        {
            if *t == mt {
                return f.clone();
            }
        }
        let f = nord_core::vfs::read_to_string(&p)
            .map(|s| crate::schema::script_attributes(&s))
            .unwrap_or_default();
        if self.settings.use_cached_content {
            self.script_cache.insert(rel.to_string(), (mt, f.clone()));
        }
        f
    }
}

#[cfg(test)]
mod appearance_tests {
    use super::Settings;

    #[test]
    fn fps_shortcuts_migrate_persist_and_reset_without_changing_appearance() {
        let mut s: Settings = serde_json::from_str("{}").unwrap();
        assert_eq!(s.fps_shortcuts.test.key, "F5");
        assert!(s.fps_shortcuts.test_here.shift);
        assert_eq!(s.fps_shortcuts.stop.key, "Escape");
        s.fps_shortcuts.stop.key = "F8".into();
        s.fps_shortcuts.stop.command = true;
        s.run_key = "Enter".into();
        s.theme = "github-light".into();
        let mut saved: Settings =
            serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        assert_eq!(saved.fps_shortcuts.stop.key, "F8");
        assert!(saved.fps_shortcuts.stop.command);
        saved.reset_shortcuts();
        assert_eq!(saved.run_key, "R");
        assert_eq!(saved.stop_key, ".");
        assert!(saved.fps_shortcuts == super::FpsShortcuts::default());
        assert_eq!(saved.theme, "github-light");
    }

    #[test]
    fn upgrade_default_once_and_keep_custom_themes_and_play_color() {
        for (old, expected) in [("nord", "graphite"), ("dracula", "dracula")] {
            let mut s: Settings = serde_json::from_value(serde_json::json!({
                "theme": old, "play_tint": [20, 40, 80]
            }))
            .unwrap();
            s.migrate_appearance();
            assert_eq!(s.theme, expected);
            assert_eq!(s.play_tint, [20, 40, 80]);
            s.theme = "nord".into();
            let mut saved: Settings =
                serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
            saved.migrate_appearance();
            assert_eq!(
                saved.theme, "nord",
                "explicit choices after migration must survive restart"
            );
        }
        assert_eq!(Settings::default().play_tint, [34, 56, 96]);
    }
}
