//! Capability manifest (`desktop.permissions` in nord.project.json), least-privilege defaults, audit log, remembered prompt answers.
use crate::{DesktopError, Result};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, io::Write, path::PathBuf, sync::Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClipboardPerm {
    #[default]
    None,
    Write,
    /// read + write
    Read,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct FsPerm {
    /// symbolic roots: `appData` (always), `documents`, `downloads`, `temp`, `picked` (paths the user chose in a dialog)
    pub roots: Vec<String>,
    pub write: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct NetPerm {
    pub hosts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Permissions {
    pub fs: FsPerm,
    pub dialogs: bool,
    pub notifications: bool,
    pub clipboard: ClipboardPerm,
    /// per-app key-value store / settings / secrets (default on: it only touches the app's own data dir)
    pub storage: bool,
    pub net: NetPerm,
    /// program names `process.run` may start (no paths)
    pub process: Vec<String>,
    pub tray: bool,
    pub global_shortcuts: bool,
    pub windows: bool,
    /// ask the user (native confirm) the first time a sensitive capability is used; remembered in appData/grants.json
    pub prompt: bool,
}

impl Default for Permissions {
    fn default() -> Self {
        Self {
            fs: FsPerm::default(),
            dialogs: true,
            notifications: false,
            clipboard: ClipboardPerm::None,
            storage: true,
            net: NetPerm::default(),
            process: vec![],
            tray: false,
            global_shortcuts: false,
            windows: false,
            prompt: true,
        }
    }
}

impl Permissions {
    pub fn from_json(v: &serde_json::Value) -> Result<Self> {
        serde_json::from_value(v.clone())
            .map_err(|e| DesktopError::invalid(format!("desktop.permissions: {e}")))
    }
    /// Everything on — for tests and trusted tools only.
    pub fn all() -> Self {
        Self {
            fs: FsPerm {
                roots: ["documents", "downloads", "temp", "picked"]
                    .map(String::from)
                    .to_vec(),
                write: true,
            },
            notifications: true,
            clipboard: ClipboardPerm::Read,
            net: NetPerm {
                hosts: vec!["*".into()],
            },
            tray: true,
            global_shortcuts: true,
            windows: true,
            prompt: false,
            ..Self::default()
        }
    }
    pub fn require(&self, ok: bool, what: &str) -> Result<()> {
        if ok {
            Ok(())
        } else {
            Err(DesktopError::denied(format!(
                "permission '{what}' not granted in desktop.permissions"
            )))
        }
    }
    pub fn host_allowed(&self, host: &str) -> bool {
        self.net.hosts.iter().any(|h| {
            h == "*"
                || h.eq_ignore_ascii_case(host)
                || h.strip_prefix("*.").is_some_and(|s| {
                    host.len() > s.len()
                        && host
                            .to_ascii_lowercase()
                            .ends_with(&format!(".{}", s.to_ascii_lowercase()))
                })
        })
    }
    /// One-line summary per granted capability, for the editor's review panel and first-run prompts.
    pub fn summary(&self) -> Vec<String> {
        let mut v = vec!["storage: own data folder".to_string()];
        if self.dialogs {
            v.push("dialogs: open/save/folder/message".into())
        }
        if !self.fs.roots.is_empty() {
            v.push(format!(
                "files: {}{}",
                self.fs.roots.join(", "),
                if self.fs.write {
                    " (read+write)"
                } else {
                    " (read-only)"
                }
            ))
        }
        if self.notifications {
            v.push("notifications".into())
        }
        if self.clipboard != ClipboardPerm::None {
            v.push(format!("clipboard: {:?}", self.clipboard).to_lowercase())
        }
        if !self.net.hosts.is_empty() {
            v.push(format!("network: {}", self.net.hosts.join(", ")))
        }
        if !self.process.is_empty() {
            v.push(format!("run programs: {}", self.process.join(", ")))
        }
        if self.tray {
            v.push("tray icon".into())
        }
        if self.global_shortcuts {
            v.push("global shortcuts".into())
        }
        if self.windows {
            v.push("extra windows".into())
        }
        v
    }
}

/// Append-only audit log (`audit.log` in appData): `unix_ms<TAB>method<TAB>allowed|denied<TAB>detail`. Best effort; capped at ~1 MB.
pub struct Audit {
    path: PathBuf,
    lock: Mutex<()>,
}
impl Audit {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            lock: Mutex::new(()),
        }
    }
    pub fn log(&self, method: &str, allowed: bool, detail: &str) {
        let _g = self.lock.lock().unwrap_or_else(|e| e.into_inner());
        if std::fs::metadata(&self.path)
            .map(|m| m.len() > 1_000_000)
            .unwrap_or(false)
        {
            let _ = std::fs::rename(&self.path, self.path.with_extension("log.1"));
        }
        let ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let detail: String = detail
            .chars()
            .filter(|c| !c.is_control())
            .take(200)
            .collect();
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
        {
            let _ = writeln!(
                f,
                "{ms}\t{method}\t{}\t{detail}",
                if allowed { "allowed" } else { "denied" }
            );
        }
    }
    pub fn read(&self) -> String {
        std::fs::read_to_string(&self.path).unwrap_or_default()
    }
}

/// Remembered answers to first-use prompts (`grants.json`).
pub struct Grants {
    path: PathBuf,
    set: Mutex<BTreeSet<String>>,
}
impl Grants {
    pub fn open(path: PathBuf) -> Self {
        let set = std::fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or_default();
        Self {
            path,
            set: Mutex::new(set),
        }
    }
    pub fn has(&self, k: &str) -> bool {
        self.set
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains(k)
    }
    pub fn add(&self, k: &str) {
        let mut s = self.set.lock().unwrap_or_else(|e| e.into_inner());
        s.insert(k.into());
        let _ = std::fs::write(&self.path, serde_json::to_string(&*s).unwrap_or_default());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn defaults_are_least_privilege() {
        let p = Permissions::default();
        assert!(
            p.fs.roots.is_empty()
                && !p.fs.write
                && !p.notifications
                && p.clipboard == ClipboardPerm::None
        );
        assert!(p.net.hosts.is_empty() && p.process.is_empty() && !p.tray && !p.global_shortcuts);
        assert!(p.require(p.notifications, "notifications").is_err());
    }
    #[test]
    fn parses_manifest_and_rejects_garbage() {
        let p = Permissions::from_json(&json!({"fs":{"roots":["documents"],"write":true},"clipboard":"write","net":{"hosts":["api.x.com","*.y.org"]}})).unwrap();
        assert!(p.fs.write && p.clipboard == ClipboardPerm::Write);
        assert!(
            p.host_allowed("api.x.com")
                && p.host_allowed("a.y.org")
                && !p.host_allowed("y.org")
                && !p.host_allowed("evil.com")
        );
        assert!(Permissions::from_json(&json!({"clipboard":"everything"})).is_err());
    }
    #[test]
    fn audit_and_grants_persist() {
        let d = tempfile::tempdir().unwrap();
        let a = Audit::new(d.path().join("audit.log"));
        a.log("fs.read", false, "x\ny");
        assert!(a.read().contains("fs.read\tdenied\txy"));
        let g = Grants::open(d.path().join("g.json"));
        assert!(!g.has("net"));
        g.add("net");
        assert!(Grants::open(d.path().join("g.json")).has("net"));
    }
}
