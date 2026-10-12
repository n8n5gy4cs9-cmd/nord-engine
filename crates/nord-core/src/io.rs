//! Load/save with crash-safe writes, project lock, recent-projects store.
use crate::{Error, Project, Result};
use serde::{de::DeserializeOwned, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const PROJECT_FILE: &str = "nord.project.json";

pub fn io_err(path: &Path, source: std::io::Error) -> Error {
    Error::Io { path: path.display().to_string(), source }
}

/// Write via tmp file + fsync + rename so a crash never leaves a half-written file.
pub fn write_atomic(path: &Path, data: &[u8]) -> Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| io_err(dir, e))?;
    }
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".nordtmp");
    let tmp = PathBuf::from(tmp);
    let res = (|| {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(data)?;
        f.sync_all()?;
        fs::rename(&tmp, path)
    })();
    if res.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    res.map_err(|e| io_err(path, e))
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
    serde_json::from_str(&s).map_err(|e| Error::Json { path: path.display().to_string(), source: e })
}

pub fn load_project(root: &Path) -> Result<Project> {
    let p: Project = load_json(&root.join(PROJECT_FILE))?;
    if p.format > crate::FORMAT {
        return Err(Error::Msg(format!("project format {} is newer than supported ({})", p.format, crate::FORMAT)));
    }
    Ok(p)
}

pub fn save_project(root: &Path, p: &Project) -> Result<()> {
    save_json(&root.join(PROJECT_FILE), p)
}

/// Exclusive project lock (`.nord-cache/lock` holding the owner pid). Released on drop.
/// A lock whose pid is no longer alive (Linux/macOS: `kill -0` semantics via /proc or ps) is treated as stale.
#[derive(Debug)]
pub struct ProjectLock {
    path: PathBuf,
}

impl ProjectLock {
    pub fn acquire(root: &Path) -> Result<Self> {
        let path = root.join(".nord-cache").join("lock");
        fs::create_dir_all(path.parent().unwrap()).map_err(|e| io_err(&path, e))?;
        for _ in 0..2 {
            match fs::OpenOptions::new().write(true).create_new(true).open(&path) {
                Ok(mut f) => {
                    let _ = write!(f, "{}", std::process::id());
                    return Ok(Self { path });
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                    let pid: Option<u32> = fs::read_to_string(&path).ok().and_then(|s| s.trim().parse().ok());
                    match pid {
                        Some(p) if pid_alive(p) && p != std::process::id() => {
                            return Err(Error::Msg(format!("project is open in another Nord process (pid {p})")))
                        }
                        _ => {
                            let _ = fs::remove_file(&path);
                        }
                    }
                }
                Err(e) => return Err(io_err(&path, e)),
            }
        }
        Err(Error::Msg("could not acquire project lock".into()))
    }
}

fn pid_alive(pid: u32) -> bool {
    if cfg!(target_os = "linux") {
        Path::new(&format!("/proc/{pid}")).exists()
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
    let home = std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
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
        assert!(fs::read_to_string(d.join(PROJECT_FILE)).unwrap().ends_with("}\n"));
        assert_eq!(load_project(&d).unwrap(), p);
        assert!(!d.join("nord.project.json.nordtmp").exists());
    }

    #[test]
    fn lock_is_exclusive_and_released() {
        let d = tmp("lock");
        let l = ProjectLock::acquire(&d).unwrap();
        // same pid re-acquire is treated as stale-self; simulate foreign live pid (pid 1)
        fs::write(d.join(".nord-cache/lock"), "1").unwrap();
        assert!(ProjectLock::acquire(&d).is_err());
        drop(l); // removes file
        assert!(ProjectLock::acquire(&d).is_ok());
    }
}
