//! Symbolic roots: where `appData`, `documents`, … live, plus user-picked paths (dialog results) for this run.
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

pub struct Roots {
    app_data: PathBuf,
    documents: PathBuf,
    downloads: PathBuf,
    temp: PathBuf,
    picked: Mutex<Vec<PathBuf>>,
}

fn home() -> PathBuf {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
}

impl Roots {
    /// OS-conventional locations: macOS `~/Library/Application Support/<id>`, Windows `%APPDATA%\<id>`, Linux `$XDG_DATA_HOME|~/.local/share/<id>`.
    pub fn system(app_id: &str) -> Self {
        let h = home();
        let data = if cfg!(target_os = "macos") {
            h.join("Library/Application Support")
        } else if cfg!(windows) {
            std::env::var_os("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|| h.join("AppData/Roaming"))
        } else {
            std::env::var_os("XDG_DATA_HOME")
                .map(PathBuf::from)
                .unwrap_or_else(|| h.join(".local/share"))
        };
        Self {
            app_data: data.join(app_id),
            documents: h.join("Documents"),
            downloads: h.join("Downloads"),
            temp: std::env::temp_dir().join(app_id),
            picked: Mutex::new(vec![]),
        }
    }
    /// Everything under `base` (tests, portable mode, sandboxes).
    pub fn with_base(app_id: &str, base: &Path) -> Self {
        Self {
            app_data: base.join("data").join(app_id),
            documents: base.join("Documents"),
            downloads: base.join("Downloads"),
            temp: base.join("tmp"),
            picked: Mutex::new(vec![]),
        }
    }
    pub fn app_data(&self) -> &Path {
        &self.app_data
    }
    pub fn documents(&self) -> &Path {
        &self.documents
    }
    pub fn downloads(&self) -> &Path {
        &self.downloads
    }
    pub fn temp(&self) -> &Path {
        &self.temp
    }
    pub fn named(&self, name: &str) -> Option<&Path> {
        match name {
            "appData" => Some(&self.app_data),
            "documents" => Some(&self.documents),
            "downloads" => Some(&self.downloads),
            "temp" => Some(&self.temp),
            _ => None,
        }
    }
    /// Remember a path the user chose in a dialog (file or folder); it becomes readable (and writable if `fs.write`) under `picked`.
    pub fn add_picked(&self, p: &Path) {
        let mut v = self.picked.lock().unwrap_or_else(|e| e.into_inner());
        if !v.iter().any(|x| x == p) {
            v.push(p.to_path_buf());
        }
    }
    pub fn picked(&self) -> Vec<PathBuf> {
        self.picked
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }
}
