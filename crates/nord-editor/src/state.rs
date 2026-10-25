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

/// A cached prefab root plus the files it was built from (the prefab and every `variantOf` base) with their mtimes.
pub type PrefabCacheEntry = (Vec<(String, web_time::SystemTime)>, Option<Entity>);

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct Settings {
    pub skin: String,
    pub theme: String,
    /// One-time migration from the original blue default; later theme choices persist.
    #[serde(default)]
    pub appearance_version: u8,
    pub ui_scale: f32,
    /// Extra scale for text only / for buttons and widget sizes only (1.0 = default); both multiply with `ui_scale`.
    pub font_scale: f32,
    pub button_scale: f32,
    /// Material preview ball / thumbnails: flat colour only (no texture, normal or emissive maps) for slow machines
    pub plain_material_previews: bool,
    /// Developer: show "Build templates" (Colima/Docker) in Export templates
    pub dev_build_templates: bool,
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
    /// Gizmo space: false = Global, true = Local (Unity's Pivot/Global toggles)
    pub space_local: bool,
    /// Pivot handle position: false = Pivot, true = Center
    pub pivot_center: bool,
    pub snap_move: f64,
    pub snap_rot: f64,
    pub snap_scale: f64,
    pub grid: bool,
    /// Gizmos menu: camera / light icons and collider outlines in the Scene view
    pub show_icons: bool,
    pub show_colliders: bool,
    /// Gizmos menu: preview the scene's own lights (off: neutral editor lighting)
    pub scene_lighting: bool,
    /// Assets panel ★ favourites (project-relative paths)
    pub asset_favorites: Vec<String>,
    pub window: Option<[f32; 4]>, // x, y, w, h
    /// Unity-style feedback: tint the whole editor while the game is playing / a Rust game is compiling
    pub tint: bool,
    /// Esc in the Game view releases a locked mouse (Unity editor behaviour); never applies to exported/standalone games
    pub esc_releases_mouse: bool,
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
    /// Rebound editor shortcuts (`keymap::DEFS` id -> chord); only changed ones are stored
    pub keymap: std::collections::BTreeMap<String, String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            skin: "modern".into(),
            theme: "playcanvas".into(),
            appearance_version: 1,
            ui_scale: 1.0,
            font_scale: 1.0,
            button_scale: 1.0,
            plain_material_previews: false,
            dev_build_templates: false,
            code_font_size: 13.0,
            code_word_wrap: false,
            code_line_height: 1.6,
            code_letter_spacing: 0.0,
            tab_width: 2,
            autosave_secs: 30,
            use_cached_content: false,
            snap: false,
            space_local: false,
            pivot_center: false,
            snap_move: 1.0,
            snap_rot: 15.0,
            snap_scale: 0.1,
            grid: true,
            show_icons: true,
            show_colliders: true,
            scene_lighting: true,
            asset_favorites: vec![],
            window: None,
            tint: true,
            esc_releases_mouse: true,
            play_tint: [34, 56, 96],
            build_tint: [104, 72, 20],
            game_anchor: [0.5, 0.0],
            game_offset: [0.0, 0.0],
            run_key: "R".into(),
            stop_key: ".".into(),
            fps_shortcuts: FpsShortcuts::default(),
            keymap: Default::default(),
        }
    }
}

impl Settings {
    /// Restore only run/stop and FPS test keys, preserving appearance and layout.
    pub fn reset_shortcuts(&mut self) {
        self.run_key = "R".into();
        self.stop_key = ".".into();
        self.fps_shortcuts = FpsShortcuts::default();
        self.keymap.clear();
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
        if s.theme == crate::theme::DRAFT_ID {
            s.theme = "playcanvas".into(); // the app closed while a theme was being edited
        }
        s.font_scale = s.font_scale.clamp(0.7, 1.8);
        s.button_scale = s.button_scale.clamp(0.7, 1.8);
        s
    }
    fn migrate_appearance(&mut self) {
        if self.appearance_version == 0 {
            if self.theme == "nord" {
                self.theme = "graphite".into();
            }
            self.appearance_version = 1;
        }
        if self.appearance_version == 1 {
            if self.theme == "graphite" {
                self.theme = "playcanvas".into(); // the previous default; explicit other choices are kept
            }
            self.appearance_version = 2;
        }
    }
    pub fn save(&self) {
        let _ = nord_core::io::save_json(&Self::path(), self);
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tool {
    /// Q: view tool (drag pans)
    Hand,
    Move,
    Rotate,
    Scale,
    /// T: rect tool (2D/UI handles; scale handles in 3D)
    Rect,
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
    /// unix seconds when the line arrived
    pub time: u64,
    /// `[Tag]` prefix of the text (Console Pro style), if any
    pub tag: Option<String>,
}

impl LogLine {
    pub fn new(level: LogLevel, text: impl Into<String>) -> Self {
        let text: String = text.into();
        let tag = text
            .strip_prefix('[')
            .and_then(|r| r.split_once(']'))
            .map(|(t, _)| t.trim().to_string())
            .filter(|t| !t.is_empty() && t.len() <= 24 && !t.contains(' '));
        let time = web_time::SystemTime::now()
            .duration_since(web_time::UNIX_EPOCH)
            .map_or(0, |d| d.as_secs());
        Self {
            level,
            text,
            time,
            tag,
        }
    }
}

/// The scene object (and prefab) a model is being edited for in the 3D Modeler.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ModelerCtx {
    pub file: String,
    pub entity: String,
    pub prefab: String,
    /// A scene `mesh` primitive to open as editable geometry instead of a file: (shape, size, segments, entity name).
    pub mesh: Option<(String, [f64; 3], i64, String)>,
    /// Bumped on every open so re-opening the same file reloads the page.
    pub nonce: u32,
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
    /// Frame all (Shift+F): fit every entity in the Scene view
    FocusAll,
    /// GameObject ▸ Align With View: the game camera takes the Scene view's position and direction (Unity Ctrl+Shift+F)
    AlignCameraWithView,
    ToggleSpace,
    TogglePivot,
    SetTool(Tool),
    Play,
    /// Run only the scene open in the editor (F6)
    PlayScene,
    /// Open a page of the HTML manual (path under `docs/manual/`), e.g. `nord/components/component-sprite.html` (F1 in the Inspector)
    OpenDocs(String),
    Stop,
    Reload,
    QuickOpen,
    Palette,
    Settings,
    ResetLayout,
    /// File ▸ Build Settings…
    BuildSettings,
    NewScene,
    Profiler,
    /// Edit a prefab on its own (Prefab mode)
    OpenPrefab(String),
    ExitPrefab,
    /// Create a variant of a prefab file
    PrefabVariant(String),
    Tutorial,
    Screenshot,
    /// Profiler window: start/stop the recorder in the running game
    ProfilerRecord,
    /// Profiler window: save the running game's profile to `profiles/profile-N.json`
    ProfilerSave,
    /// Project ▸ Play N players: N browser windows, the first hosts, the rest join (`lag` adds the network simulator)
    PlayPlayers(u8, bool),
    /// Window ▸ Layout presets ("default", "2d", "3d", "coding", "visual")
    Layout(String),
    /// Pause / resume the running game, or advance it one frame while paused
    PauseGame,
    StepGame,
    ResetSettings,
    Export,
    DesktopSettings,
    ExportTemplates,
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
    /// Game view resolution override (aspect/resolution drop-down); None = the project's display size
    pub game_res: Option<[f32; 2]>,
    /// Pause the game when an error is logged (Unity's Error Pause)
    pub error_pause: bool,
    /// Fullscreen the Game view on Play (Unity's Maximize On Play)
    pub maximize_on_play: bool,
    /// Game view maximised over the whole window (menu/toolbar/panels hidden, OS fullscreen); Esc leaves
    pub game_full: bool,
    pub lock: Option<nord_core::io::ProjectLock>,
    pub last_autosave: Instant,
    /// External-change watch: modification time of the open scene / project file as the editor last read or wrote it.
    pub disk_mtime: Option<std::time::SystemTime>,
    pub project_mtime: Option<std::time::SystemTime>,
    pub disk_check: Instant,
    /// The scene changed on disk while the editor holds unsaved edits: ask what to do.
    pub disk_conflict: bool,
    pub recover: Option<String>,
    pub script_cache: HashMap<String, (web_time::SystemTime, Vec<crate::schema::Field>)>,
    /// read-only Hierarchy rows parsed from FPS level files (virt.rs)
    pub virt_cache: crate::virt::Cache,
    /// Settings ▸ Shortcuts: the keymap id currently waiting for a key press
    pub rebinding: Option<String>,
    /// Prefab roots by path, keyed on file mtime (see `read_prefab_cached`).
    pub prefab_cache: std::collections::HashMap<String, PrefabCacheEntry>,
    /// viewport asked us not to echo the scene back after its own edit
    pub skip_viewport_sync: bool,
    pub hierarchy_filter: String,
    pub collapsed: std::collections::HashSet<String>,
    /// file the UI Designer / Graph tab should show (`?file=` of the embedded page); set by the Assets menu and page IPC
    pub designer_file: Option<String>,
    /// (entity id, text) while an entity is being renamed in the Hierarchy
    pub hierarchy_rename: Option<(String, String)>,
    /// Hierarchy range-select anchor (the row last clicked without Shift), like Unity's.
    pub hier_anchor: Option<String>,
    pub graph_file: Option<String>,
    pub animator_file: Option<String>,
    pub engine_root: Option<PathBuf>,
    pub themes: Arc<crate::theme::Themes>,
    pub code: crate::code::CodeState,
    pub assets_ui: crate::panels::assets::AssetsUi,
    pub console_ui: crate::panels::console::ConsoleUi,
    /// live entities of the running game (docs: Remote scene tree)
    pub remote: crate::panels::remote::Remote,
    pub library: crate::panels::library::LibraryUi,
    pub docs_ui: crate::panels::docs::DocsUi,
    pub hub: crate::panels::hub::HubUi,
    pub palette: crate::panels::palette::PaletteUi,
    pub anim: crate::panels::animation::AnimUi,
    pub events: crate::panels::events::EventsUi,
    pub history_ui: crate::panels::history::HistoryUi,
    pub project_ui: crate::panels::project::ProjectUi,
    pub build_ui: crate::panels::build::BuildUi,
    pub fun_ui: crate::panels::fun::FunUi,
    /// Inspector padlock: entity id the Inspector stays on
    pub inspector_lock: Option<String>,
    /// Prefab mode: the prefab being edited instead of the scene
    pub prefab_mode: Option<crate::prefab::PrefabMode>,
    pub layout_ui: crate::panels::layout::LayoutUi,
    pub sprite: crate::panels::sprite::SpriteUi,
    /// (Hierarchy selection id, texture): the Inspector sets that object's sprite texture on its next frame (Sprite editor save)
    pub sprite_apply: Option<(String, String)>,
    /// What the 3D Modeler tab was opened for (Inspector ▸ Model ▸ Open in 3D Modeler); `None` = free modelling.
    pub modeler_ctx: Option<ModelerCtx>,
    /// The Modeler page must be told a new context (after a prefab / variant was created from its save dialog).
    pub modeler_push: bool,
    /// the 3D Modeler fills the whole editor window (menus and panels hidden) until the red exit button is pressed
    pub modeler_full: bool,
    pub notes: crate::panels::notes::NotesUi,
    /// Asset colours / icons / tags / notes of the open project (`.nord/asset-meta.json`)
    pub asset_meta: crate::assetmeta::AssetMeta,
    /// Theme editor: the theme being edited (live preview) and the theme id to go back to on Cancel.
    pub theme_draft: Option<(crate::theme::Theme, String)>,
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
    pub templates_ui: crate::panels::templates::TemplatesUi,
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
    /// The Game view has keyboard focus (set by Play and by the game page's focus event, cleared by clicking any other panel or the Scene view): editor shortcuts stay silent, like Unity
    pub game_focused: bool,
    /// scene path passed to the game page as `?scene=` for Run This Scene; None = project start scene
    pub play_scene: Option<String>,
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
            game_res: None,
            error_pause: false,
            maximize_on_play: false,
            game_full: false,
            lock: None,
            last_autosave: Instant::now(),
            disk_mtime: None,
            project_mtime: None,
            disk_check: Instant::now(),
            disk_conflict: false,
            recover: None,
            script_cache: HashMap::new(),
            virt_cache: Default::default(),
            rebinding: None,
            prefab_cache: Default::default(),
            skip_viewport_sync: false,
            hierarchy_filter: String::new(),
            collapsed: Default::default(),
            designer_file: None,
            hierarchy_rename: None,
            hier_anchor: None,
            graph_file: None,
            animator_file: None,
            engine_root: crate::platform::engine_root(),
            themes: Arc::new(crate::theme::Themes::load()),
            code: Default::default(),
            assets_ui: Default::default(),
            console_ui: Default::default(),
            remote: Default::default(),
            library: Default::default(),
            docs_ui: Default::default(),
            hub: Default::default(),
            palette: Default::default(),
            anim: Default::default(),
            events: Default::default(),
            history_ui: Default::default(),
            project_ui: Default::default(),
            build_ui: Default::default(),
            fun_ui: Default::default(),
            inspector_lock: None,
            prefab_mode: None,
            layout_ui: Default::default(),
            sprite: Default::default(),
            sprite_apply: None,
            modeler_ctx: None,
            modeler_push: false,
            modeler_full: false,
            notes: Default::default(),
            asset_meta: Default::default(),
            theme_draft: None,
            particles_ui: Default::default(),
            timeline_ui: Default::default(),
            viewport_cam: None,
            files_cache: None,
            lan: None,
            lan_log_seen: 0,
            lan_open: false,
            settings_open: false,
            export_ui: Default::default(),
            templates_ui: Default::default(),
            desktop_ui: Default::default(),
            about_open: false,
            apply_theme: true,
            apply_styles: false,
            tint_applied: None,
            base_visuals: None,
            status_msg: None,
            game_nonce: 0,
            game_focused: false,
            play_scene: None,
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
        self.console.push(LogLine::new(level, text));
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

    /// Component menu: add a component with default values to the selected entity (one undo step).
    pub fn add_component_to_selection(&mut self, kind: &str) {
        let Some(id) = self.selection.first().cloned() else {
            self.toast("Select an entity first");
            return;
        };
        let mut fields = serde_json::Map::new();
        crate::schema::merge_defaults(&crate::schema::component_fields(kind), &mut fields);
        let comp = nord_core::scene::Component {
            kind: kind.to_string(),
            fields,
        };
        self.edit("Add component", None, |l| {
            if let Some(e) = scene_ops::find_mut(l, &id) {
                e.components.push(comp);
            }
        });
    }

    /// Hierarchy ▸ Create: a ready-made entity (name, components) under `parent` (Unity's GameObject menu).
    pub fn add_preset(&mut self, kind: &str, parent: Option<String>) {
        let sprite = (kind == "sprite")
            .then(|| self.ensure_default_sprite())
            .flatten();
        let (name, comps): (&str, Vec<Value>) = match kind {
            "empty" => ("Empty", vec![]),
            "sprite" => (
                "Sprite",
                vec![json!({"type":"sprite","texture":sprite.unwrap_or_default()})],
            ),
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
            "capsule" => (
                "Capsule",
                vec![
                    json!({"type":"mesh","shape":"capsule","size":[1,2,1]}),
                    json!({"type":"material"}),
                ],
            ),
            "cylinder" => (
                "Cylinder",
                vec![
                    json!({"type":"mesh","shape":"cylinder","size":[1,2,1]}),
                    json!({"type":"material"}),
                ],
            ),
            "plane" => (
                "Plane",
                vec![
                    json!({"type":"mesh","shape":"ground","size":[10,0.01,10]}),
                    json!({"type":"material"}),
                ],
            ),
            "quad" => (
                "Quad",
                vec![
                    json!({"type":"mesh","shape":"plane","size":[1,1,1]}),
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
    /// A dropped `models/x.mesh.json` is the *editable* source of a model: the game uses the `x.glb` the 3D Modeler writes next to it.
    /// Returns the model to use, or `None` (after telling the user and opening the Modeler, where Save writes the .glb).
    pub fn game_model_for(&mut self, path: &str) -> Option<String> {
        let Some(stem) = path.strip_suffix(".mesh.json") else {
            return Some(path.to_string());
        };
        let glb = format!("{stem}.glb");
        if self.root.as_ref().is_some_and(|r| r.join(&glb).exists()) {
            self.toast(format!("Using {glb} (the game-ready export of this mesh)"));
            return Some(glb);
        }
        self.toast("This mesh has no .glb yet: open it in the 3D Modeler and press Save (it writes the .glb)");
        self.open_in_modeler("", path);
        None
    }

    pub fn add_asset_entity(&mut self, path: &str) {
        let Some(path) = self.game_model_for(path) else {
            return;
        };
        let path = path.as_str();
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

    /// Drop an asset onto an existing entity (Hierarchy row or Scene object): set/add the matching component or script.
    /// Returns false when the asset kind has no such meaning (prefabs, scenes…), so the caller can create an entity instead.
    pub fn drop_asset_on_entity(&mut self, id: &str, path: &str) -> bool {
        let Some(path) = self.game_model_for(path) else {
            return true; // handled: the Modeler was opened
        };
        let path = path.as_str();
        use nord_core::assets::{classify, AssetType};
        let (kind, key): (&str, &str) = match classify(path) {
            AssetType::Image | AssetType::Spritesheet => ("sprite", "texture"),
            AssetType::Model => ("model", "path"),
            AssetType::Audio => ("audioSource", "clip"),
            AssetType::Material => ("material", "asset"),
            _ if path.ends_with(".js") || path.ends_with(".ts") => ("", ""),
            _ => return false,
        };
        let (id, path) = (id.to_string(), path.to_string());
        self.edit("Drop asset on entity", None, |l| {
            let Some(e) = scene_ops::find_mut(l, &id) else {
                return;
            };
            if kind.is_empty() {
                e.scripts.push(nord_core::scene::ScriptRef {
                    path,
                    attributes: Default::default(),
                });
                return;
            }
            if let Some(c) = e.components.iter_mut().find(|c| c.kind == kind) {
                c.fields.insert(key.into(), json!(path));
            } else if let Ok(c) = serde_json::from_value(json!({"type": kind, key: path})) {
                e.components.push(c);
            }
        });
        self.select(Some(id));
        true
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
        self.prefab_mode = None;
        let root = self.root.clone().ok_or("no project")?;
        let path = root.join(rel);
        let s: Scene = nord_core::io::load_json(&path).map_err(|e| e.to_string())?;
        self.scene = Some(s);
        self.scene_file = Some(rel.to_string());
        self.selection.clear();
        self.undo.clear();
        self.dirty = false;
        self.rev += 1;
        self.stamp_disk();
        self.recover = self
            .autosave_path()
            .filter(|a| {
                let m = |p: &Path| nord_core::vfs::metadata(p).and_then(|m| m.modified()).ok();
                matches!((m(a), m(&path)), (Some(x), Some(y)) if x > y)
            })
            .map(|a| a.to_string_lossy().into_owned());
        Ok(())
    }

    fn disk_mtimes(&self) -> (Option<std::time::SystemTime>, Option<std::time::SystemTime>) {
        let m = |p: PathBuf| nord_core::vfs::metadata(&p).and_then(|m| m.modified()).ok();
        let Some(root) = &self.root else {
            return (None, None);
        };
        (
            self.scene_file.as_ref().and_then(|f| m(root.join(f))),
            m(root.join("nord.project.json")),
        )
    }

    /// Remember the on-disk state we just read or wrote, so our own saves are not mistaken for outside edits.
    pub fn stamp_disk(&mut self) {
        (self.disk_mtime, self.project_mtime) = self.disk_mtimes();
        self.disk_conflict = false;
    }

    /// Cheap (two `stat` calls, once a second): notice when something else (an AI agent over MCP, git, a text editor)
    /// changed the open scene or `nord.project.json`. Unchanged editor => reload quietly; unsaved edits => ask.
    pub fn check_disk(&mut self) {
        if self.root.is_none()
            || self.scene.is_none()
            || self.prefab_mode.is_some()
            || self.disk_conflict
            || self.disk_check.elapsed() < Duration::from_secs(1)
        {
            return;
        }
        self.disk_check = Instant::now();
        let (scene_m, project_m) = self.disk_mtimes();
        if project_m != self.project_mtime {
            self.project_mtime = project_m;
            if let (Some(root), Some(cur)) = (self.root.clone(), self.project.as_ref()) {
                if let Ok(p) = nord_core::io::load_project(&root) {
                    if serde_json::to_value(&p).ok() != serde_json::to_value(cur).ok() {
                        self.project = Some(p);
                        self.rev += 1;
                        self.toast("Project settings reloaded: changed outside the editor");
                    }
                }
            }
        }
        if scene_m.is_some() && scene_m != self.disk_mtime {
            if self.dirty {
                self.disk_conflict = true;
            } else {
                self.reload_scene_from_disk();
                self.toast("Scene reloaded: it was changed outside the editor");
            }
        }
    }

    /// Replace the open scene by the file on disk (drops undo history and any autosave of the old state).
    pub fn reload_scene_from_disk(&mut self) {
        let (Some(root), Some(f)) = (self.root.clone(), self.scene_file.clone()) else {
            return;
        };
        match nord_core::io::load_json::<Scene>(&root.join(&f)) {
            Ok(s) => {
                self.selection
                    .retain(|id| scene_ops::find(&s.entities, id).is_some());
                self.scene = Some(s);
                self.undo.clear();
                self.dirty = false;
                if let Some(a) = self.autosave_path() {
                    let _ = nord_core::vfs::remove_file(a);
                }
                self.refresh_assets();
                self.rev += 1;
                self.stamp_disk();
            }
            Err(e) => self.log(LogLevel::Error, format!("Could not reload {f}: {e}")),
        }
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
        self.stamp_disk();
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
        if self.prefab_mode.is_some() {
            self.save_prefab_mode();
            return;
        }
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
                self.stamp_disk();
            }
            Err(e) => self.log(LogLevel::Error, format!("Save failed: {e}")),
        }
    }

    /// Forget the autosave of the open scene (the user chose to throw the unsaved edits away).
    pub fn discard_autosave(&mut self) {
        if let Some(a) = self.autosave_path() {
            let _ = nord_core::vfs::remove_file(a);
        }
    }

    /// Crash-safe autosave: atomic write to `.nord-cache/autosave/`, never touches the real file.
    pub fn autosave_tick(&mut self) {
        if !self.dirty
            || self.disk_conflict
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
            let is_err = level == LogLevel::Error;
            self.log(level, e.text);
            if is_err && self.error_pause && !self.game_paused && self.is_playing() {
                self.push(Action::PauseGame);
                self.toast("Error Pause: game paused");
            }
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
            "scene": self.viewport_scene(),
            "selection": self.selection,
        })
    }

    pub fn viewport_settings_msg(&self) -> Value {
        json!({
            "t": "settings",
            "tool": match self.tool { Tool::Hand => "hand", Tool::Move => "move", Tool::Rotate => "rotate", Tool::Scale => "scale", Tool::Rect => "rect" },
            "snap": self.settings.snap,
            "snapMove": self.settings.snap_move,
            "snapRot": self.settings.snap_rot,
            "snapScale": self.settings.snap_scale,
            "grid": self.settings.grid,
            "icons": self.settings.show_icons,
            "colliders": self.settings.show_colliders,
            "sceneLighting": self.settings.scene_lighting,
            "local": self.settings.space_local,
            "center": self.settings.pivot_center,
        })
    }

    /// Apply messages coming from the edit viewport.
    /// The Scene view's pose arrived (`viewPose`): put it on the selected camera, else the active one, else a new "Main Camera".
    /// 3D: position + direction (pitch/yaw, no roll). 2D: centre position + zoom.
    pub fn apply_view_pose(&mut self, m: &Value) {
        let Some(pos) = m["pos"].as_array().filter(|a| a.len() >= 2) else {
            return;
        };
        let p = |i: usize| pos.get(i).and_then(Value::as_f64).unwrap_or(0.0);
        let (px, py, pz) = (p(0), p(1), p(2));
        let rot = m["rot"]
            .as_array()
            .map(|a| [0, 1, 2].map(|i| a.get(i).and_then(Value::as_f64).unwrap_or(0.0)));
        let zoom = m["zoom"].as_f64();
        let Some(scene) = self.scene.as_ref() else {
            return;
        };
        let has_cam = |e: &Entity| e.components.iter().any(|c| c.kind == "camera");
        let sel = self
            .selection
            .first()
            .and_then(|id| scene_ops::find(&scene.entities, id))
            .filter(|e| has_cam(e));
        let found = sel.map(|e| e.id.clone()).or_else(|| {
            let all = scene_ops::flatten(&scene.entities);
            all.iter()
                .find(|(_, e)| has_cam(e) && e.enabled)
                .map(|(_, e)| e.id.clone())
        });
        let id = match found {
            Some(id) => id,
            None => {
                let mut e = Entity::new("Main Camera");
                if let Ok(c) = serde_json::from_value(json!({"type":"camera"})) {
                    e.components.push(c);
                }
                let id = e.id.clone();
                self.edit("Create camera", None, |l| {
                    scene_ops::insert(l, None, usize::MAX, e);
                });
                id
            }
        };
        let tid = id.clone();
        self.edit("Align camera with view", None, move |l| {
            if let Some(e) = scene_ops::find_mut(l, &tid) {
                e.transform.pos = [
                    px,
                    py,
                    if rot.is_some() {
                        pz
                    } else {
                        e.transform.pos[2]
                    },
                ];
                if let Some(r) = rot {
                    e.transform.rot = r;
                }
                if let Some(z) = zoom {
                    if let Some(c) = e.components.iter_mut().find(|c| c.kind == "camera") {
                        c.fields.insert("zoom".into(), json!(z));
                    }
                }
            }
        });
        self.select(Some(id));
        self.toast("Camera aligned with the Scene view");
    }

    pub fn handle_viewport(&mut self, m: &Value) {
        match m["t"].as_str() {
            Some("gameFocus") => self.game_focused = m["on"].as_bool().unwrap_or(false),
            Some("ready") => {
                self.viewport_ready = true;
                self.send_viewport(self.viewport_scene_msg());
                self.send_viewport(self.viewport_settings_msg());
            }
            // 3D Modeler: the save dialog wrote a model file and says what to do with the scene object
            Some("model-saved") => self.modeler_saved(m),
            Some("viewPose") => self.apply_view_pose(m),
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
                    Some("animator") => {
                        self.animator_file = file;
                        self.push(Action::ShowTab(crate::app::Tab::Animator));
                    }
                    Some("graph") => {
                        self.graph_file = file;
                        self.push(Action::ShowTab(crate::app::Tab::Graph));
                    }
                    _ => {}
                }
            }
            Some("addAsset") => {
                // Assets → Scene view drop: new entity from the asset, placed where it was dropped
                if let (Some(path), Some(onto)) = (m["path"].as_str(), m["onto"].as_str()) {
                    if self.drop_asset_on_entity(onto, path) {
                        return;
                    }
                }
                if let (Some(path), Some(p)) = (m["path"].as_str(), m["pos"].as_array()) {
                    let pos: Vec<f64> = p.iter().filter_map(Value::as_f64).collect();
                    let before = self.selection.clone();
                    self.add_asset_entity(path);
                    if pos.len() == 3 && self.selection != before {
                        if let Some(id) = self.selection.first().cloned() {
                            self.edit("Place dropped asset", None, |l| {
                                if let Some(e) = scene_ops::find_mut(l, &id) {
                                    e.transform.pos = [pos[0], pos[1], pos[2]];
                                }
                            });
                        }
                    }
                }
            }
            Some("profiler") => self.fun_ui.profiler.data = Some(m.clone()),
            Some("profile") => {
                if let Some(j) = m["json"].as_str() {
                    self.save_profile(j);
                }
            }
            Some("event-ran") => self.events.handle(m),
            Some("shot") => {
                if let Some(d) = m["data"].as_str() {
                    self.save_screenshot(d);
                }
            }
            Some("select") => {
                if let Some(ids) = m["ids"].as_array() {
                    self.selection = ids
                        .iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect();
                } else {
                    self.select(m["id"].as_str().map(String::from));
                }
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
                if self.is_playing() {
                    // Play mode: the gizmo moves the live entity in the running game; the saved scene is not touched
                    self.remote
                        .cmds
                        .push(crate::panels::remote::transform_js(&id, pos, rot, scale));
                    return;
                }
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
            Some("transforms") => {
                // several objects dragged together (multi-select gizmo): one undo step for the group
                let v3 = |a: &Value| -> Option<[f64; 3]> {
                    let a = a.as_array()?;
                    Some([
                        a.first()?.as_f64()?,
                        a.get(1)?.as_f64()?,
                        a.get(2)?.as_f64()?,
                    ])
                };
                type Xf = (String, Option<[f64; 3]>, Option<[f64; 3]>, Option<[f64; 3]>);
                let items: Vec<Xf> = m["items"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|i| {
                                Some((
                                    i["id"].as_str()?.to_string(),
                                    v3(&i["pos"]),
                                    v3(&i["rot"]),
                                    v3(&i["scale"]),
                                ))
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                if items.is_empty() {
                    return;
                }
                if self.is_playing() {
                    for (id, pos, rot, scale) in &items {
                        self.remote
                            .cmds
                            .push(crate::panels::remote::transform_js(id, *pos, *rot, *scale));
                    }
                    return;
                }
                let key = format!(
                    "xfm:{}",
                    items
                        .iter()
                        .map(|i| i.0.as_str())
                        .collect::<Vec<_>>()
                        .join(",")
                );
                self.skip_viewport_sync = true;
                self.edit("Transform", Some(&key), |l| {
                    for (id, pos, rot, scale) in &items {
                        if let Some(e) = scene_ops::find_mut(l, id) {
                            if let Some(p) = pos {
                                e.transform.pos = *p;
                            }
                            if let Some(r) = rot {
                                e.transform.rot = *r;
                            }
                            if let Some(s) = scale {
                                e.transform.scale = *s;
                            }
                        }
                    }
                });
            }
            Some("key") => {
                self.game_focused = false; // the Scene view page only forwards keys while it owns the keyboard
                                           // the Scene view page forwards every key; the (rebindable) keymap decides what it means
                let flag = |k: &str| m[k].as_bool().unwrap_or(false);
                let id = crate::keymap::from_page_key(
                    &self.settings.keymap,
                    m["key"].as_str().unwrap_or(""),
                    flag("cmd"),
                    flag("shift"),
                    flag("alt"),
                );
                match id {
                    Some("play") => {
                        let a = if self.is_playing() {
                            Action::Stop
                        } else {
                            Action::Play
                        };
                        self.push(a);
                    }
                    Some(id) => {
                        if let Some(a) = crate::keymap::action(id) {
                            self.push(a);
                        }
                    }
                    None => {}
                }
            }
            Some("entityEdited") => {
                // result of an Inspector script button: the whole entity as the script left it (children added, fields changed)
                let Some(id) = m["id"].as_str().map(String::from) else {
                    return;
                };
                let Ok(mut ne) =
                    serde_json::from_value::<nord_core::scene::Entity>(m["entity"].clone())
                else {
                    self.log(
                        LogLevel::Error,
                        "script button: the returned entity is not valid",
                    );
                    return;
                };
                let label = m["method"].as_str().unwrap_or("script").to_string();
                self.edit(&format!("Run {label}"), None, |l| {
                    if let Some(e) = scene_ops::find_mut(l, &id) {
                        ne.id = e.id.clone();
                        *e = ne;
                    }
                });
            }
            Some("scriptError") => {
                let t = m["text"].as_str().unwrap_or("").to_string();
                self.log(LogLevel::Error, format!("[script button] {t}"));
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
        for (old, expected) in [("nord", "playcanvas"), ("dracula", "dracula")] {
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

#[cfg(test)]
mod align_camera_tests {
    use super::*;

    fn st() -> EditorState {
        let mut st = EditorState::new();
        st.scene = Some(nord_core::scene::Scene::new("t"));
        st
    }
    fn cams(st: &EditorState) -> Vec<&Entity> {
        st.scene
            .as_ref()
            .unwrap()
            .entities
            .iter()
            .filter(|e| e.components.iter().any(|c| c.kind == "camera"))
            .collect()
    }

    #[test]
    fn creates_a_camera_when_the_scene_has_none_then_reuses_it() {
        let mut st = st();
        st.apply_view_pose(&json!({"pos":[1.0,2.0,3.0],"rot":[30.0,45.0,0.0]}));
        let c = cams(&st);
        assert_eq!(c.len(), 1);
        assert_eq!(c[0].transform.pos, [1.0, 2.0, 3.0]);
        assert_eq!(c[0].transform.rot, [30.0, 45.0, 0.0]);
        st.apply_view_pose(&json!({"pos":[5.0,6.0,7.0],"rot":[0.0,90.0,0.0]}));
        let c = cams(&st);
        assert_eq!(c.len(), 1, "the existing camera is moved, none is added");
        assert_eq!(c[0].transform.pos, [5.0, 6.0, 7.0]);
    }

    #[test]
    fn two_d_pose_sets_position_and_zoom() {
        let mut st = st();
        st.apply_view_pose(&json!({"pos":[100.0,50.0],"zoom":2.0}));
        let c = cams(&st);
        assert_eq!(&c[0].transform.pos[..2], &[100.0, 50.0]);
        assert_eq!(c[0].components[0].fields["zoom"], 2.0);
    }
}
