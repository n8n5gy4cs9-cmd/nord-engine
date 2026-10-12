//! App lifecycle helpers that need no GUI toolkit: single instance (+ forwarding argv to the running one), deep-link/file argv parsing,
//! autostart files. macOS/Windows variants are written to match each OS's conventions but are only unit-tested for their pure parts here.
use crate::{DesktopError, Result};
use std::{
    io::{Read, Write},
    net::{Ipv4Addr, TcpListener, TcpStream},
    path::{Path, PathBuf},
};

pub enum Instance {
    /// we are the first instance; `rx` yields argv lists sent by later launches
    Primary {
        listener: TcpListener,
        lock: PathBuf,
    },
    /// another instance is running and has been handed our argv: exit now
    Forwarded,
}

/// Lock file `<dir>/instance.lock` holds the loopback port of the primary. A stale lock (nothing listening) is replaced.
pub fn single_instance(dir: &Path, argv: &[String]) -> Result<Instance> {
    std::fs::create_dir_all(dir)?;
    let lock = dir.join("instance.lock");
    if let Ok(t) = std::fs::read_to_string(&lock) {
        if let Ok(port) = t.trim().parse::<u16>() {
            if let Ok(mut s) = TcpStream::connect((Ipv4Addr::LOCALHOST, port)) {
                let _ = s.set_write_timeout(Some(std::time::Duration::from_secs(2)));
                s.write_all(serde_json::to_string(argv).unwrap_or_default().as_bytes())
                    .map_err(DesktopError::from)?;
                return Ok(Instance::Forwarded);
            }
        }
    }
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
    std::fs::write(&lock, listener.local_addr()?.port().to_string())?;
    Ok(Instance::Primary { listener, lock })
}

impl Instance {
    /// Blocking accept loop body: returns the argv a second launch sent (call from a thread).
    pub fn next_argv(&self) -> Option<Vec<String>> {
        let Instance::Primary { listener, .. } = self else {
            return None;
        };
        let (s, _) = listener.accept().ok()?;
        let mut buf = String::new();
        s.set_read_timeout(Some(std::time::Duration::from_secs(2)))
            .ok()?;
        s.take(1 << 20).read_to_string(&mut buf).ok()?;
        serde_json::from_str(&buf).ok()
    }
    pub fn release(&self) {
        if let Instance::Primary { lock, .. } = self {
            let _ = std::fs::remove_file(lock);
        }
    }
}

#[derive(Debug, PartialEq, serde::Serialize)]
pub struct Launch {
    pub files: Vec<String>,
    pub urls: Vec<String>,
}
/// Split argv into files to open and deep links (`<scheme>://…` for the app's registered schemes).
pub fn parse_launch(argv: &[String], schemes: &[String]) -> Launch {
    let mut l = Launch {
        files: vec![],
        urls: vec![],
    };
    for a in argv.iter().skip(1).filter(|a| !a.starts_with("-psn_")) {
        match a.split_once("://") {
            Some((s, _)) if schemes.iter().any(|x| x.eq_ignore_ascii_case(s)) => {
                l.urls.push(a.clone())
            }
            Some(_) => {}
            None if !a.starts_with('-') && Path::new(a).exists() => l.files.push(a.clone()),
            None => {}
        }
    }
    l
}

/// Write the per-user autostart entry. Linux: `~/.config/autostart/<id>.desktop`; macOS: `~/Library/LaunchAgents/<id>.plist`;
/// Windows: `HKCU\...\Run` via `reg.exe`. `enable=false` removes it.
pub fn set_autostart(app_id: &str, name: &str, exe: &Path, enable: bool) -> Result<()> {
    let home = std::env::var_os("HOME").map(PathBuf::from);
    if cfg!(target_os = "macos") {
        let p = home
            .ok_or_else(|| DesktopError::new("io", "no HOME"))?
            .join(format!("Library/LaunchAgents/{app_id}.plist"));
        if !enable {
            let _ = std::fs::remove_file(&p);
            return Ok(());
        }
        std::fs::create_dir_all(p.parent().unwrap())?;
        let esc = |s: &str| s.replace('&', "&amp;").replace('<', "&lt;");
        return Ok(std::fs::write(p, format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<plist version=\"1.0\"><dict><key>Label</key><string>{}</string><key>ProgramArguments</key><array><string>{}</string></array><key>RunAtLoad</key><true/></dict></plist>\n", esc(app_id), esc(&exe.display().to_string())))?);
    }
    if cfg!(windows) {
        let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        let st = if enable {
            std::process::Command::new("reg")
                .args([
                    "add",
                    key,
                    "/v",
                    name,
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\"", exe.display()),
                    "/f",
                ])
                .status()?
        } else {
            std::process::Command::new("reg")
                .args(["delete", key, "/v", name, "/f"])
                .status()?
        };
        return if st.success() || !enable {
            Ok(())
        } else {
            Err(DesktopError::new("io", "reg.exe failed"))
        };
    }
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| home.map(|h| h.join(".config")))
        .ok_or_else(|| DesktopError::new("io", "no HOME"))?;
    let p = base.join("autostart").join(format!("{app_id}.desktop"));
    if !enable {
        let _ = std::fs::remove_file(&p);
        return Ok(());
    }
    std::fs::create_dir_all(p.parent().unwrap())?;
    Ok(std::fs::write(p, format!("[Desktop Entry]\nType=Application\nName={name}\nExec=\"{}\"\nX-GNOME-Autostart-enabled=true\n", exe.display()))?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn second_launch_forwards_argv_to_the_first() {
        let d = tempfile::tempdir().unwrap();
        let first = single_instance(d.path(), &[]).unwrap();
        assert!(matches!(first, Instance::Primary { .. }));
        let t = std::thread::spawn(move || (first.next_argv(), first));
        let second = single_instance(d.path(), &["app".into(), "doc.md".into()]).unwrap();
        assert!(matches!(second, Instance::Forwarded));
        let (argv, first) = t.join().unwrap();
        assert_eq!(argv.unwrap(), ["app", "doc.md"]);
        first.release();
        assert!(matches!(
            single_instance(d.path(), &[]).unwrap(),
            Instance::Primary { .. }
        ));
    }
    #[test]
    fn stale_lock_is_replaced() {
        let d = tempfile::tempdir().unwrap();
        std::fs::write(d.path().join("instance.lock"), "1").unwrap(); // nothing listens on port 1
        assert!(matches!(
            single_instance(d.path(), &[]).unwrap(),
            Instance::Primary { .. }
        ));
    }
    #[test]
    fn launch_args_split_files_and_deep_links() {
        let d = tempfile::tempdir().unwrap();
        let f = d.path().join("a.md");
        std::fs::write(&f, "").unwrap();
        let argv: Vec<String> = [
            "app",
            f.to_str().unwrap(),
            "nordnotes://open?id=3",
            "http://x",
            "--flag",
            "missing.md",
        ]
        .map(String::from)
        .to_vec();
        let l = parse_launch(&argv, &["nordnotes".into()]);
        assert_eq!(
            (l.files, l.urls),
            (
                vec![f.display().to_string()],
                vec!["nordnotes://open?id=3".to_string()]
            )
        );
    }
}
