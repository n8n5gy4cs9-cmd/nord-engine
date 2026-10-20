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

/// Native folder picker.
pub fn pick_folder(title: &str) -> Option<PathBuf> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        rfd::FileDialog::new().set_title(title).pick_folder()
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = title;
        None
    }
}

/// Native multi-file picker.
pub fn pick_files() -> Option<Vec<PathBuf>> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        rfd::FileDialog::new().pick_files()
    }
    #[cfg(target_arch = "wasm32")]
    {
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

/// Run `f` on a worker thread. The web build has no threads yet, so the job is dropped (its channel closes and the UI
/// treats it as "not available"); real browser jobs arrive with the `Host` trait (M11-03).
pub fn spawn<F: FnOnce() + Send + 'static>(f: F) {
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::thread::spawn(f);
    }
    #[cfg(target_arch = "wasm32")]
    {
        drop(f);
    }
}
