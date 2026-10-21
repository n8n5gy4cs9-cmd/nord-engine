//! Load/save with crash-safe writes, project lock, recent-projects store.
use crate::vfs as fs;
use crate::{Error, Project, Result};
use serde::{de::DeserializeOwned, Serialize};
use std::path::{Path, PathBuf};

pub const PROJECT_FILE: &str = "nord.project.json";

pub fn io_err(path: &Path, source: std::io::Error) -> Error {
    Error::Io {
        path: path.display().to_string(),
        source,
    }
}

/// Crash-safe write (tmp file + fsync + rename on disk; whatever the backend offers elsewhere).
pub fn write_atomic(path: &Path, data: &[u8]) -> Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| io_err(dir, e))?;
    }
    crate::vfs::backend()
        .write_atomic(path, data)
        .map_err(|e| io_err(path, e))
}

/// Pretty JSON (2 spaces) + trailing newline, per PROJECT_FORMAT.md.
pub fn to_json<T: Serialize>(v: &T) -> String {
    let mut s = serde_json::to_string_pretty(v).expect("serialisable");
    s.push('\n');
    s
}

pub fn save_json<T: Serialize>(path: &Path, v: &T) -> Result<()> {
    write_atomic(path, to_json(v).as_bytes())
}

pub fn load_json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    let s = fs::read_to_string(path).map_err(|e| io_err(path, e))?;
    serde_json::from_str(&s).map_err(|e| Error::Json {
        path: path.display().to_string(),
        source: e,
    })
}

pub fn load_project(root: &Path) -> Result<Project> {
    let p: Project = load_json(&root.join(PROJECT_FILE))?;
    if p.format > crate::FORMAT {
        return Err(Error::Msg(format!(
            "project format {} is newer than supported ({})",
            p.format,
            crate::FORMAT
        )));
    }
    Ok(p)
}

pub fn save_project(root: &Path, p: &Project) -> Result<()> {
    save_json(&root.join(PROJECT_FILE), p)
}

/// Exclusive project lock (`.nord-cache/lock` holding the owner pid). Released on drop.
/// A lock whose pid is no longer alive (Linux: /proc, macOS: ps) is treated as stale.
#[derive(Debug)]
pub struct ProjectLock {
    path: PathBuf,
}

impl ProjectLock {
    pub fn acquire(root: &Path) -> Result<Self> {
        // the browser has one tab per project workspace and no process ids: no lock
        #[cfg(target_arch = "wasm32")]
        {
            let _ = root;
            Ok(Self {
                path: PathBuf::new(),
            })
        }
        #[cfg(not(target_arch = "wasm32"))]
        Self::acquire_native(root)
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn acquire_native(root: &Path) -> Result<Self> {
        use std::io::Write;
        let path = root.join(".nord-cache").join("lock");
        std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| io_err(&path, e))?;
        for _ in 0..2 {
            match std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
            {
                Ok(mut f) => {
                    let _ = write!(f, "{}", std::process::id());
                    return Ok(Self { path });
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                    let pid: Option<u32> = std::fs::read_to_string(&path)
                        .ok()
                        .and_then(|s| s.trim().parse().ok());
                    match pid {
                        Some(p) if pid_alive(p) && p != std::process::id() => {
                            return Err(Error::Msg(format!(
                                "project is open in another Nord process (pid {p})"
                            )))
                        }
                        _ => {
                            let _ = std::fs::remove_file(&path);
                        }
                    }
                }
                Err(e) => return Err(io_err(&path, e)),
            }
        }
        Err(Error::Msg("could not acquire project lock".into()))
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn pid_alive(pid: u32) -> bool {
    if cfg!(target_os = "linux") {
        Path::new(&format!("/proc/{pid}")).exists()
    } else if cfg!(target_os = "macos") {
        // kill -0 can fail with EPERM for an existing process owned by another user (e.g. pid 1).
        std::process::Command::new("ps")
            .args(["-p", &pid.to_string(), "-o", "pid="])
            .output()
            .map(|o| o.status.success() && !o.stdout.is_empty())
            .unwrap_or(true)
    } else if cfg!(target_os = "windows") {
        std::process::Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"])
            .output()
            .map(|o| {
                !o.status.success()
                    || String::from_utf8_lossy(&o.stdout).lines().any(|line| {
                        line.split(',')
                            .nth(1)
                            .is_some_and(|p| p.trim_matches('"') == pid.to_string())
                    })
            })
            .unwrap_or(true)
    } else {
        std::process::Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(true)
    }
}

impl Drop for ProjectLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

/// Recent projects, newest first, stored in `$NORD_CONFIG_DIR` or `~/.config/nord/recent.json`.
pub fn config_dir() -> PathBuf {
    if let Some(d) = std::env::var_os("NORD_CONFIG_DIR") {
        return d.into();
    }
    #[cfg(target_os = "windows")]
    if let Some(d) = std::env::var_os("APPDATA") {
        return PathBuf::from(d).join("NordEngine");
    }
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".config").join("nord")
}

pub fn recent_projects() -> Vec<PathBuf> {
    load_json::<Vec<PathBuf>>(&config_dir().join("recent.json")).unwrap_or_default()
}

pub fn add_recent(root: &Path) -> Result<()> {
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let mut list = recent_projects();
    list.retain(|p| p != &root);
    list.insert(0, root);
    list.truncate(20);
    save_json(&config_dir().join("recent.json"), &list)
}

/// Files/dirs that mark engine, source-control or dependency trees; a folder holding any of them is never deleted.
#[cfg(not(target_arch = "wasm32"))]
const DELETE_FORBIDDEN_MARKERS: [&str; 9] = [
    ".git",
    "Cargo.toml",
    "Cargo.lock",
    "PRD.json",
    "crates",
    "src",
    "node_modules",
    "tools",
    "third_party",
];

/// Delete ONE project folder that is listed in the recent-projects list, and drop it from that list.
/// Refuses (deleting nothing) unless every check passes: exact entry of the recent list, real directory
/// (not a symlink), contains `nord.project.json`, not the home dir / a shallow path, not the engine
/// (or inside/containing it), not the running exe/cwd, no engine/VCS markers, not locked by another process.
#[cfg(not(target_arch = "wasm32"))]
pub fn delete_recent_project(root: &Path, engine_root: Option<&Path>) -> Result<()> {
    let bad = |m: &str| Err(Error::Msg(format!("refusing to delete project: {m}")));
    if !recent_projects().iter().any(|p| p == root) {
        return bad("not in the recent projects list");
    }
    let meta = std::fs::symlink_metadata(root).map_err(|e| io_err(root, e))?;
    if meta.file_type().is_symlink() || !meta.is_dir() {
        return bad("not a real directory");
    }
    let canon = std::fs::canonicalize(root).map_err(|e| io_err(root, e))?;
    if canon != root {
        return bad("path is not canonical");
    }
    if !canon.join(PROJECT_FILE).is_file() {
        return bad("no nord.project.json inside");
    }
    if canon.components().count() < 4 {
        return bad("path is too shallow");
    }
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        let home = std::fs::canonicalize(&home).unwrap_or(home);
        if home.starts_with(&canon) {
            return bad("contains the home folder");
        }
    }
    for guard in engine_root
        .into_iter()
        .map(Path::to_path_buf)
        .chain(std::env::current_exe().ok())
        .chain(std::env::current_dir().ok())
        .chain(Some(config_dir()))
    {
        let g = std::fs::canonicalize(&guard).unwrap_or(guard);
        if g.starts_with(&canon) || canon.starts_with(&g) {
            return bad("overlaps the engine, the running app or its config");
        }
    }
    if DELETE_FORBIDDEN_MARKERS
        .iter()
        .any(|m| canon.join(m).exists())
    {
        return bad("looks like engine/source code");
    }
    // not open elsewhere (own pid is fine: the caller closes the project first)
    if let Ok(txt) = std::fs::read_to_string(canon.join(".nord-cache/lock")) {
        if let Ok(pid) = txt.trim().parse::<u32>() {
            if pid != std::process::id() && pid_alive(pid) {
                return bad("open in another Nord process");
            }
        }
    }
    std::fs::remove_dir_all(&canon).map_err(|e| io_err(&canon, e))?;
    let mut list = recent_projects();
    list.retain(|p| p != root);
    save_json(&config_dir().join("recent.json"), &list)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nord-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn atomic_write_and_roundtrip() {
        let d = tmp("io");
        let p = Project::new("T", "com.x.t", crate::ProjectType::TwoD);
        save_project(&d, &p).unwrap();
        assert!(fs::read_to_string(d.join(PROJECT_FILE))
            .unwrap()
            .ends_with("}\n"));
        assert_eq!(load_project(&d).unwrap(), p);
        assert!(!d.join("nord.project.json.nordtmp").exists());
    }

    #[test]
    fn lock_is_exclusive_and_released() {
        let d = tmp("lock");
        let l = ProjectLock::acquire(&d).unwrap();
        // same pid re-acquire is treated as stale-self; simulate foreign live pid (pid 1)
        let system_pid = if cfg!(target_os = "windows") {
            "4"
        } else {
            "1"
        };
        fs::write(d.join(".nord-cache/lock"), system_pid).unwrap();
        assert!(ProjectLock::acquire(&d).is_err());
        drop(l); // removes file
        assert!(ProjectLock::acquire(&d).is_ok());
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[test]
    fn delete_recent_project_is_guarded() {
        let base = tmp("del");
        std::env::set_var("NORD_CONFIG_DIR", base.join("cfg"));
        let proj = base.join("a").join("b").join("game");
        fs::create_dir_all(&proj).unwrap();
        let p = Project::new("T", "com.x.t", crate::ProjectType::TwoD);
        save_project(&proj, &p).unwrap();
        let proj = std::fs::canonicalize(&proj).unwrap();
        // not in the recent list -> refused
        assert!(delete_recent_project(&proj, None).is_err());
        add_recent(&proj).unwrap();
        // engine/source markers -> refused
        std::fs::write(proj.join("Cargo.toml"), "").unwrap();
        assert!(delete_recent_project(&proj, None).is_err());
        std::fs::remove_file(proj.join("Cargo.toml")).unwrap();
        // engine root inside the project -> refused
        assert!(delete_recent_project(&proj, Some(&proj.join("x"))).is_err());
        assert!(proj.exists());
        // sibling data survives
        std::fs::write(proj.parent().unwrap().join("keep.txt"), "k").unwrap();
        delete_recent_project(&proj, None).unwrap();
        assert!(!proj.exists());
        assert!(proj.parent().unwrap().join("keep.txt").exists());
        assert!(recent_projects().is_empty());
    }
}
