//! Host-platform seam (M11-03/04): the few things the editor needs from the OS (native dialogs, the local dev server).
//! Native builds forward to `rfd` / `nord-serve` unchanged; the web build (wasm32) has no folders, ports or processes,
//! so these report "not available" and the UI shows a toast instead. See docs/WEB_EDITOR_PLAN.md.
use std::path::PathBuf;
use std::sync::Arc;

pub use nord_serve::Hub;

#[cfg(not(target_arch = "wasm32"))]
pub use nord_serve::Lan;

/// Engine folder (`vendor/VENDOR.json`); the web build has none.
pub fn engine_root() -> Option<PathBuf> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        nord_serve::engine_root()
    }
    #[cfg(target_arch = "wasm32")]
    {
        None
    }
}

/// Something that finished in the background in the browser (file pickers are async there). The app drains these every frame.
#[derive(Debug)]
pub enum WebEvent {
    /// a project was unpacked (or created) at this path — open it
    OpenProject(PathBuf),
    /// asset files were staged at these paths — import them into the open project
    ImportFiles(Vec<PathBuf>),
    Error(String),
}

/// Finished browser jobs (always empty on desktop).
pub fn poll_events() -> Vec<WebEvent> {
    #[cfg(target_arch = "wasm32")]
    {
        crate::web::flush();
        crate::web::poll_events()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        Vec::new()
    }
}

/// Where new projects go by default.
pub fn default_projects_dir() -> Option<PathBuf> {
    #[cfg(target_arch = "wasm32")]
    {
        Some(PathBuf::from(crate::web::PROJECTS_DIR))
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        None
    }
}

/// Folder picker. Desktop: native dialog. Browser: there are no folders to pick, so "open" means "import a .zip"
/// (the result arrives later as [`WebEvent::OpenProject`]) and this returns `None`.
pub fn pick_folder(title: &str) -> Option<PathBuf> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        rfd::FileDialog::new().set_title(title).pick_folder()
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = title;
        crate::web::import_zip();
        None
    }
}

/// Multi-file picker (browser: async, see [`WebEvent::ImportFiles`]).
pub fn pick_files() -> Option<Vec<PathBuf>> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        rfd::FileDialog::new().pick_files()
    }
    #[cfg(target_arch = "wasm32")]
    {
        crate::web::import_files();
        None
    }
}

/// Start the local dev server for the game/edit viewport.
pub fn start_background(root: PathBuf, engine: PathBuf) -> anyhow::Result<(u16, Arc<Hub>)> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        nord_serve::start_background(root, engine)
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = (root, engine);
        anyhow::bail!("no local dev server in the web editor yet (M11-07)")
    }
}

/// Phone-preview server handle (web build: never constructed).
#[cfg(target_arch = "wasm32")]
pub struct Lan {
    pub port: u16,
    pub urls: Vec<String>,
    pub hub: Arc<Hub>,
}

/// Start the LAN preview server.
pub fn start_lan(root: PathBuf, engine: PathBuf, port: u16) -> anyhow::Result<Lan> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        nord_serve::start_lan(root, engine, port)
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = (root, engine, port);
        anyhow::bail!("phone preview needs the native editor")
    }
}

/// What kind of work a job does (decides whether this host can run it).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum JobKind {
    /// pure in-process work (thumbnails, validation)
    Compute,
    /// `nord build` / export
    Export,
    /// external tools: cargo, node, ffmpeg, the dev server
    Process,
}

/// Where long-running work runs: [`LocalHost`] (threads + processes, desktop), [`NoHost`] (browser, no threads yet);
/// the server build adds a remote host that runs jobs over HTTP (M11-10).
pub trait Host: Send + Sync {
    fn name(&self) -> &'static str;
    fn can(&self, kind: JobKind) -> bool;
    /// Run `job` in the background. Returns false when it cannot run here (the job is dropped, its channel closes).
    fn spawn(&self, job: Box<dyn FnOnce() + Send>) -> bool;
}

#[cfg(not(target_arch = "wasm32"))]
pub struct LocalHost;

#[cfg(not(target_arch = "wasm32"))]
impl Host for LocalHost {
    fn name(&self) -> &'static str {
        "local"
    }
    fn can(&self, _: JobKind) -> bool {
        true
    }
    fn spawn(&self, job: Box<dyn FnOnce() + Send>) -> bool {
        std::thread::spawn(job);
        true
    }
}

/// Static web build: nothing runs in the background and no processes exist.
pub struct NoHost;

impl Host for NoHost {
    fn name(&self) -> &'static str {
        "browser"
    }
    fn can(&self, _: JobKind) -> bool {
        false
    }
    fn spawn(&self, job: Box<dyn FnOnce() + Send>) -> bool {
        drop(job);
        false
    }
}

/// The host of this build.
pub fn host() -> &'static dyn Host {
    #[cfg(not(target_arch = "wasm32"))]
    {
        &LocalHost
    }
    #[cfg(target_arch = "wasm32")]
    {
        &NoHost
    }
}

/// Can this build run `kind` jobs? Panels use it to disable buttons with an explanation.
pub fn can(kind: JobKind) -> bool {
    host().can(kind)
}

/// Run `f` on the host. See [`Host::spawn`].
pub fn spawn<F: FnOnce() + Send + 'static>(f: F) -> bool {
    host().spawn(Box::new(f))
}

/// Modifier for quick open / palette / tab switching: Cmd/Ctrl on desktop, Alt in the browser (which owns Cmd/Ctrl+P/K/1-4).
pub fn nav_modifiers() -> egui::Modifiers {
    if cfg!(target_arch = "wasm32") {
        egui::Modifiers::ALT
    } else {
        egui::Modifiers::COMMAND
    }
}

/// Shortcut text for Settings: the keys that use [`nav_modifiers`] read `Alt+` in the browser.
pub fn shortcut_label(k: &str) -> String {
    let nav = ["Cmd+P", "Cmd+K", "Cmd+1/2/3/4", "Cmd+R / Cmd+."];
    if cfg!(target_arch = "wasm32") && nav.contains(&k) {
        k.replace("Cmd+", "Alt+")
    } else {
        k.to_string()
    }
}

/// Copy text to the system clipboard (egui handles the browser clipboard on the web).
pub fn copy_text(ctx: &egui::Context, text: String) {
    ctx.copy_text(text);
}
