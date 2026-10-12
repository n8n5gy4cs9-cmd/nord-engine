//! OS services behind traits. [`Headless`] = scripted/in-memory (tests, CI, `nord serve` without a window); `native` = real (rfd, arboard,
//! notify-rust, opener). The platform-specific ones (badge, progress) are best effort and documented in KNOWN_ISSUES.
use crate::{DesktopError, Result};
use serde::Deserialize;
use std::{
    collections::VecDeque,
    path::PathBuf,
    sync::{Arc, Mutex},
};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct FileDialog {
    pub title: Option<String>,
    /// e.g. `[{"name":"Markdown","extensions":["md","txt"]}]`
    pub filters: Vec<Filter>,
    pub directory: Option<String>,
    pub file_name: Option<String>,
    pub multiple: bool,
}
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Filter {
    pub name: String,
    pub extensions: Vec<String>,
}

pub trait Dialogs: Send + Sync {
    /// `None` = cancelled
    fn open_files(&self, o: &FileDialog) -> Result<Option<Vec<PathBuf>>>;
    fn save_file(&self, o: &FileDialog) -> Result<Option<PathBuf>>;
    fn pick_folder(&self, o: &FileDialog) -> Result<Option<PathBuf>>;
    /// `level`: info | warning | error
    fn message(&self, level: &str, title: &str, text: &str) -> Result<()>;
    fn confirm(&self, title: &str, text: &str) -> Result<bool>;
}
pub trait Notifier: Send + Sync {
    fn notify(&self, title: &str, body: &str) -> Result<()>;
    /// dock/taskbar badge text (`None` clears)
    fn set_badge(&self, text: Option<&str>) -> Result<()>;
    /// 0.0..=1.0 (`None` clears)
    fn set_progress(&self, p: Option<f32>) -> Result<()>;
}
pub trait Clipboard: Send + Sync {
    fn get_text(&self) -> Result<Option<String>>;
    fn set_text(&self, t: &str) -> Result<()>;
    /// PNG bytes
    fn get_image(&self) -> Result<Option<Vec<u8>>> {
        Err(DesktopError::unsupported("clipboard images"))
    }
    fn set_image(&self, _png: &[u8]) -> Result<()> {
        Err(DesktopError::unsupported("clipboard images"))
    }
    fn get_files(&self) -> Result<Vec<PathBuf>> {
        Err(DesktopError::unsupported("clipboard files"))
    }
}
pub trait Shell: Send + Sync {
    fn open_url(&self, url: &str) -> Result<()>;
    fn open_path(&self, p: &std::path::Path) -> Result<()>;
    fn reveal(&self, p: &std::path::Path) -> Result<()>;
}

/// Secrets (tokens, passwords). Native = OS keychain (`keychain` feature); otherwise in memory only (never written to disk).
pub trait Secrets: Send + Sync {
    fn get(&self, app: &str, key: &str) -> Result<Option<String>>;
    fn set(&self, app: &str, key: &str, value: &str) -> Result<()>;
    fn delete(&self, app: &str, key: &str) -> Result<()>;
}
#[derive(Default)]
pub struct MemorySecrets(Mutex<std::collections::HashMap<String, String>>);
impl Secrets for MemorySecrets {
    fn get(&self, a: &str, k: &str) -> Result<Option<String>> {
        Ok(self
            .0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(&format!("{a}/{k}"))
            .cloned())
    }
    fn set(&self, a: &str, k: &str, v: &str) -> Result<()> {
        self.0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(format!("{a}/{k}"), v.into());
        Ok(())
    }
    fn delete(&self, a: &str, k: &str) -> Result<()> {
        self.0
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&format!("{a}/{k}"));
        Ok(())
    }
}
#[cfg(feature = "keychain")]
pub struct Keychain;
#[cfg(feature = "keychain")]
impl Secrets for Keychain {
    fn get(&self, a: &str, k: &str) -> Result<Option<String>> {
        match keyring::Entry::new(&format!("nord.{a}"), k).and_then(|e| e.get_password()) {
            Ok(v) => Ok(Some(v)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(DesktopError::new("io", e.to_string())),
        }
    }
    fn set(&self, a: &str, k: &str, v: &str) -> Result<()> {
        keyring::Entry::new(&format!("nord.{a}"), k)
            .and_then(|e| e.set_password(v))
            .map_err(|e| DesktopError::new("io", e.to_string()))
    }
    fn delete(&self, a: &str, k: &str) -> Result<()> {
        match keyring::Entry::new(&format!("nord.{a}"), k).and_then(|e| e.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(DesktopError::new("io", e.to_string())),
        }
    }
}

/// Scripted services: dialog answers are queued by the test, everything else is recorded.
#[derive(Clone, Default)]
pub struct Headless(pub Arc<Mutex<HeadlessState>>);
#[derive(Default)]
pub struct HeadlessState {
    pub open: VecDeque<Option<Vec<PathBuf>>>,
    pub save: VecDeque<Option<PathBuf>>,
    pub folder: VecDeque<Option<PathBuf>>,
    pub confirms: VecDeque<bool>,
    pub messages: Vec<(String, String, String)>,
    pub notifications: Vec<(String, String)>,
    pub badge: Option<String>,
    pub progress: Option<f32>,
    pub clipboard: Option<String>,
    pub image: Option<Vec<u8>>,
    pub opened: Vec<String>,
}
impl Headless {
    pub fn st(&self) -> std::sync::MutexGuard<'_, HeadlessState> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}
impl Dialogs for Headless {
    fn open_files(&self, _: &FileDialog) -> Result<Option<Vec<PathBuf>>> {
        Ok(self.st().open.pop_front().flatten())
    }
    fn save_file(&self, _: &FileDialog) -> Result<Option<PathBuf>> {
        Ok(self.st().save.pop_front().flatten())
    }
    fn pick_folder(&self, _: &FileDialog) -> Result<Option<PathBuf>> {
        Ok(self.st().folder.pop_front().flatten())
    }
    fn message(&self, l: &str, t: &str, x: &str) -> Result<()> {
        self.st().messages.push((l.into(), t.into(), x.into()));
        Ok(())
    }
    fn confirm(&self, _: &str, _: &str) -> Result<bool> {
        Ok(self.st().confirms.pop_front().unwrap_or(false))
    }
}
impl Notifier for Headless {
    fn notify(&self, t: &str, b: &str) -> Result<()> {
        self.st().notifications.push((t.into(), b.into()));
        Ok(())
    }
    fn set_badge(&self, t: Option<&str>) -> Result<()> {
        self.st().badge = t.map(Into::into);
        Ok(())
    }
    fn set_progress(&self, p: Option<f32>) -> Result<()> {
        self.st().progress = p.map(|x| x.clamp(0.0, 1.0));
        Ok(())
    }
}
impl Clipboard for Headless {
    fn get_text(&self) -> Result<Option<String>> {
        Ok(self.st().clipboard.clone())
    }
    fn set_text(&self, t: &str) -> Result<()> {
        self.st().clipboard = Some(t.into());
        Ok(())
    }
    fn get_image(&self) -> Result<Option<Vec<u8>>> {
        Ok(self.st().image.clone())
    }
    fn set_image(&self, p: &[u8]) -> Result<()> {
        self.st().image = Some(p.to_vec());
        Ok(())
    }
}
impl Shell for Headless {
    fn open_url(&self, u: &str) -> Result<()> {
        self.st().opened.push(u.into());
        Ok(())
    }
    fn open_path(&self, p: &std::path::Path) -> Result<()> {
        self.st().opened.push(p.display().to_string());
        Ok(())
    }
    fn reveal(&self, p: &std::path::Path) -> Result<()> {
        self.st().opened.push(format!("reveal:{}", p.display()));
        Ok(())
    }
}

/// Only http(s)/mailto may be opened from an app; never `file:` or custom schemes.
pub fn check_url(u: &str) -> Result<()> {
    let l = u.to_ascii_lowercase();
    if ["https://", "http://", "mailto:"]
        .iter()
        .any(|p| l.starts_with(p))
    {
        Ok(())
    } else {
        Err(DesktopError::denied(
            "only http(s) and mailto URLs can be opened",
        ))
    }
}

#[cfg(feature = "native")]
pub mod native {
    use super::*;
    fn io(e: impl std::fmt::Display) -> DesktopError {
        DesktopError::new("io", e.to_string())
    }
    pub struct Native;
    fn build(o: &FileDialog) -> rfd::FileDialog {
        let mut d = rfd::FileDialog::new();
        if let Some(t) = &o.title {
            d = d.set_title(t)
        }
        if let Some(p) = &o.directory {
            d = d.set_directory(p)
        }
        if let Some(n) = &o.file_name {
            d = d.set_file_name(n)
        }
        for f in &o.filters {
            d = d.add_filter(&f.name, &f.extensions)
        }
        d
    }
    impl Dialogs for Native {
        fn open_files(&self, o: &FileDialog) -> Result<Option<Vec<PathBuf>>> {
            Ok(if o.multiple {
                build(o).pick_files()
            } else {
                build(o).pick_file().map(|p| vec![p])
            })
        }
        fn save_file(&self, o: &FileDialog) -> Result<Option<PathBuf>> {
            Ok(build(o).save_file())
        }
        fn pick_folder(&self, o: &FileDialog) -> Result<Option<PathBuf>> {
            Ok(build(o).pick_folder())
        }
        fn message(&self, l: &str, t: &str, x: &str) -> Result<()> {
            let lv = match l {
                "error" => rfd::MessageLevel::Error,
                "warning" => rfd::MessageLevel::Warning,
                _ => rfd::MessageLevel::Info,
            };
            rfd::MessageDialog::new()
                .set_level(lv)
                .set_title(t)
                .set_description(x)
                .show();
            Ok(())
        }
        fn confirm(&self, t: &str, x: &str) -> Result<bool> {
            Ok(rfd::MessageDialog::new()
                .set_title(t)
                .set_description(x)
                .set_buttons(rfd::MessageButtons::YesNo)
                .show()
                == rfd::MessageDialogResult::Yes)
        }
    }
    impl Notifier for Native {
        fn notify(&self, t: &str, b: &str) -> Result<()> {
            notify_rust::Notification::new()
                .summary(t)
                .body(b)
                .show()
                .map(|_| ())
                .map_err(io)
        }
        // Dock badge / taskbar progress need the window handle (NSApp dockTile, ITaskbarList3, Unity launcher API): applied by the shell via
        // `HostCommand::Badge/Progress` (see window.rs), so the backend only reports support.
        fn set_badge(&self, _: Option<&str>) -> Result<()> {
            Ok(())
        }
        fn set_progress(&self, _: Option<f32>) -> Result<()> {
            Ok(())
        }
    }
    impl Clipboard for Native {
        fn get_text(&self) -> Result<Option<String>> {
            Ok(arboard::Clipboard::new().map_err(io)?.get_text().ok())
        }
        fn set_text(&self, t: &str) -> Result<()> {
            arboard::Clipboard::new()
                .map_err(io)?
                .set_text(t.to_string())
                .map_err(io)
        }
        // images: the web/JS side reads them with navigator.clipboard; native PNG encode is left out (no image codec dependency)
    }
    impl Shell for Native {
        fn open_url(&self, u: &str) -> Result<()> {
            check_url(u)?;
            opener::open_browser(u).map_err(io)
        }
        fn open_path(&self, p: &std::path::Path) -> Result<()> {
            opener::open(p).map_err(io)
        }
        fn reveal(&self, p: &std::path::Path) -> Result<()> {
            opener::reveal(p).map_err(io)
        }
    }
    /// dialogs, notifier, clipboard, shell
    pub type Set = (
        Box<dyn Dialogs>,
        Box<dyn Notifier>,
        Box<dyn Clipboard>,
        Box<dyn Shell>,
    );
    pub fn all() -> Set {
        (
            Box::new(Native),
            Box::new(Native),
            Box::new(Native),
            Box::new(Native),
        )
    }
}
