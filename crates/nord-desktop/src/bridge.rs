//! JSON dispatcher: `call("fs.read", {path})` → result. This is the whole JS surface (`window.nord.desktop.*`) in one place, used by
//! `nord-player` (wry IPC) and `nord serve` (HTTP). Every call is permission-checked, sensitive ones prompt once, all are audited.
use crate::{
    caps::{ClipboardPerm, Grants},
    fs::Watcher,
    lifecycle::Launch,
    services::{check_url, FileDialog},
    window::{self, HostCommand, MenuItem, WindowOpts},
    Desktop, DesktopError, Result,
};
use serde_json::{json, Value};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};

pub struct Bridge {
    pub d: Desktop,
    grants: Grants,
    host: Mutex<Vec<HostCommand>>,
    watchers: Mutex<(u32, HashMap<u32, Watcher>)>,
    pub launch: Mutex<Launch>,
    pub name: String,
    pub version: String,
}

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
pub fn b64_encode(d: &[u8]) -> String {
    let mut o = String::with_capacity(d.len().div_ceil(3) * 4);
    for c in d.chunks(3) {
        let n = (c[0] as u32) << 16
            | (*c.get(1).unwrap_or(&0) as u32) << 8
            | *c.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            if i <= c.len() {
                o.push(B64[(n >> (18 - 6 * i) & 63) as usize] as char)
            } else {
                o.push('=')
            }
        }
    }
    o
}
pub fn b64_decode(s: &str) -> Result<Vec<u8>> {
    let mut o = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0);
    for ch in s.bytes().filter(|b| !b.is_ascii_whitespace() && *b != b'=') {
        let v = B64
            .iter()
            .position(|b| *b == ch)
            .ok_or_else(|| DesktopError::invalid("bad base64"))? as u32;
        acc = acc << 6 | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            o.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Ok(o)
}

fn s<'a>(p: &'a Value, k: &str) -> Result<&'a str> {
    p[k].as_str()
        .ok_or_else(|| DesktopError::invalid(format!("missing string '{k}'")))
}

impl Bridge {
    pub fn new(d: Desktop, name: &str, version: &str) -> Self {
        let grants = Grants::open(d.roots.app_data().join("grants.json"));
        Self {
            d,
            grants,
            host: Mutex::new(vec![]),
            watchers: Mutex::new((0, HashMap::new())),
            launch: Mutex::new(Launch {
                files: vec![],
                urls: vec![],
            }),
            name: name.into(),
            version: version.into(),
        }
    }
    /// Commands for the shell (windows, menus, tray, …) accumulated since the last call.
    pub fn take_host_commands(&self) -> Vec<HostCommand> {
        std::mem::take(&mut *self.host.lock().unwrap_or_else(|e| e.into_inner()))
    }
    fn push(&self, c: HostCommand) {
        self.host.lock().unwrap_or_else(|e| e.into_inner()).push(c);
    }

    /// First use of a sensitive capability asks the user once (when `permissions.prompt`), remembered in grants.json.
    fn ask(&self, key: &str, text: &str) -> Result<()> {
        if !self.d.caps.prompt || self.grants.has(key) {
            return Ok(());
        }
        if self
            .d
            .dialogs
            .confirm(&format!("{} wants permission", self.name), text)?
        {
            self.grants.add(key);
            Ok(())
        } else {
            Err(DesktopError::denied("declined by the user"))
        }
    }

    pub fn call(&self, method: &str, p: &Value) -> Result<Value> {
        let r = self.dispatch(method, p);
        let detail = ["path", "from", "url", "program", "key", "title"]
            .iter()
            .find_map(|k| p[*k].as_str())
            .unwrap_or("");
        self.d
            .audit
            .log(method, !matches!(&r, Err(e) if e.code == "denied"), detail);
        r
    }

    fn picked(&self, path: &std::path::Path) {
        self.d.roots.add_picked(path);
        let mut rec: Vec<Value> = self
            .d
            .store
            .get("__recent")
            .and_then(|v| v.as_array().cloned())
            .unwrap_or_default();
        let ps = path.display().to_string();
        rec.retain(|x| x != &json!(ps));
        rec.insert(0, json!(ps));
        rec.truncate(10);
        let _ = self.d.store.set_raw("__recent", Value::Array(rec));
    }

    fn dispatch(&self, method: &str, p: &Value) -> Result<Value> {
        let c = &self.d.caps;
        let (ns, name) = method
            .split_once('.')
            .ok_or_else(|| DesktopError::invalid("method must be 'namespace.name'"))?;
        match (ns, name) {
            ("app", "info") => Ok(
                json!({"name": self.name, "version": self.version, "id": self.d.app_id, "os": std::env::consts::OS, "arch": std::env::consts::ARCH, "shell": "native"}),
            ),
            ("app", "paths") => Ok(
                json!({"appData": self.d.roots.app_data(), "documents": c.fs.roots.iter().any(|r| r == "documents").then(|| self.d.roots.documents()), "downloads": c.fs.roots.iter().any(|r| r == "downloads").then(|| self.d.roots.downloads()), "temp": c.fs.roots.iter().any(|r| r == "temp").then(|| self.d.roots.temp())}),
            ),
            ("app", "permissions") => Ok(json!({"summary": c.summary(), "granted": &**c})),
            ("app", "launch") => Ok(serde_json::to_value(
                &*self.launch.lock().unwrap_or_else(|e| e.into_inner()),
            )
            .unwrap_or_default()),
            ("app", "audit") => Ok(json!(self
                .d
                .audit
                .read()
                .lines()
                .rev()
                .take(p["limit"].as_u64().unwrap_or(100) as usize)
                .collect::<Vec<_>>())),
            ("app", "quit") => {
                self.push(HostCommand::Quit);
                Ok(Value::Null)
            }
            ("app", "quitGuard") => {
                self.push(HostCommand::QuitGuard {
                    enable: p["enable"].as_bool().unwrap_or(true),
                });
                Ok(Value::Null)
            }
            ("app", "autostart") => {
                self.ask("autostart", "start automatically when you log in")?;
                self.push(HostCommand::Autostart {
                    enable: p["enable"].as_bool().unwrap_or(true),
                });
                Ok(Value::Null)
            }

            ("fs", _) => self.fs(name, p),

            ("dialog", _) => {
                c.require(c.dialogs, "dialogs")?;
                let o: FileDialog = window::parse(p, "dialog options")?;
                match name {
                    "open" => Ok(match self.d.dialogs.open_files(&o)? {
                        Some(v) => {
                            v.iter().for_each(|x| self.picked(x));
                            json!(v)
                        }
                        None => Value::Null,
                    }),
                    "save" => Ok(match self.d.dialogs.save_file(&o)? {
                        Some(f) => {
                            self.picked(&f);
                            json!(f)
                        }
                        None => Value::Null,
                    }),
                    "folder" => Ok(match self.d.dialogs.pick_folder(&o)? {
                        Some(f) => {
                            self.picked(&f);
                            json!(f)
                        }
                        None => Value::Null,
                    }),
                    "message" => {
                        self.d.dialogs.message(
                            p["level"].as_str().unwrap_or("info"),
                            p["title"].as_str().unwrap_or(""),
                            s(p, "text")?,
                        )?;
                        Ok(Value::Null)
                    }
                    "confirm" => Ok(json!(self
                        .d
                        .dialogs
                        .confirm(p["title"].as_str().unwrap_or(""), s(p, "text")?)?)),
                    "recent" => Ok(self.d.store.get("__recent").unwrap_or(json!([]))),
                    _ => Err(DesktopError::unsupported(method.to_string())),
                }
            }

            ("notify", _) => {
                c.require(c.notifications, "notifications")?;
                match name {
                    "show" => self
                        .d
                        .notifier
                        .notify(s(p, "title")?, p["body"].as_str().unwrap_or(""))?,
                    "badge" => {
                        self.d.notifier.set_badge(p["text"].as_str())?;
                        self.push(HostCommand::Badge {
                            text: p["text"].as_str().map(Into::into),
                        })
                    }
                    "progress" => {
                        let v = p["value"].as_f64().map(|x| x as f32);
                        self.d.notifier.set_progress(v)?;
                        self.push(HostCommand::Progress {
                            value: v.map(|x| x.clamp(0.0, 1.0)),
                        })
                    }
                    _ => return Err(DesktopError::unsupported(method.to_string())),
                }
                Ok(Value::Null)
            }

            ("clipboard", _) => {
                let write = matches!(name, "writeText" | "writeImage");
                c.require(
                    if write {
                        c.clipboard != ClipboardPerm::None
                    } else {
                        c.clipboard == ClipboardPerm::Read
                    },
                    if write {
                        "clipboard:write"
                    } else {
                        "clipboard:read"
                    },
                )?;
                if !write {
                    self.ask("clipboard.read", "read what is on your clipboard")?;
                }
                match name {
                    "readText" => Ok(json!(self.d.clipboard.get_text()?)),
                    "writeText" => {
                        self.d.clipboard.set_text(s(p, "text")?)?;
                        Ok(Value::Null)
                    }
                    "readImage" => Ok(json!(self.d.clipboard.get_image()?.map(|b| b64_encode(&b)))),
                    "writeImage" => {
                        self.d.clipboard.set_image(&b64_decode(s(p, "png")?)?)?;
                        Ok(Value::Null)
                    }
                    "readFiles" => Ok(json!(self.d.clipboard.get_files()?)),
                    _ => Err(DesktopError::unsupported(method.to_string())),
                }
            }

            ("store", _) => {
                c.require(c.storage, "storage")?;
                match name {
                    "get" => Ok(self.d.store.get(s(p, "key")?).unwrap_or(Value::Null)),
                    "set" => {
                        self.d.store.set(s(p, "key")?, p["value"].clone())?;
                        Ok(Value::Null)
                    }
                    "remove" => {
                        self.d.store.remove(s(p, "key")?)?;
                        Ok(Value::Null)
                    }
                    "keys" => Ok(json!(self.d.store.keys())),
                    "clear" => {
                        self.d.store.clear()?;
                        Ok(Value::Null)
                    }
                    _ => Err(DesktopError::unsupported(method.to_string())),
                }
            }
            ("secret", _) => {
                c.require(c.storage, "storage")?;
                let id = &self.d.app_id;
                match name {
                    "get" => Ok(json!(self.d.secrets.get(id, s(p, "key")?)?)),
                    "set" => {
                        self.d.secrets.set(id, s(p, "key")?, s(p, "value")?)?;
                        Ok(Value::Null)
                    }
                    "delete" => {
                        self.d.secrets.delete(id, s(p, "key")?)?;
                        Ok(Value::Null)
                    }
                    _ => Err(DesktopError::unsupported(method.to_string())),
                }
            }

            ("shell", _) => match name {
                "openUrl" => {
                    let u = s(p, "url")?;
                    check_url(u)?;
                    self.d.shell.open_url(u)?;
                    Ok(Value::Null)
                }
                "openPath" | "reveal" => {
                    let f = self.d.fs.resolve(s(p, "path")?, false)?;
                    if name == "openPath" {
                        self.d.shell.open_path(&f)?
                    } else {
                        self.d.shell.reveal(&f)?
                    }
                    Ok(Value::Null)
                }
                _ => Err(DesktopError::unsupported(method.to_string())),
            },

            ("process", "run") => {
                let prog = s(p, "program")?;
                c.require(
                    c.process.iter().any(|x| x == prog),
                    &format!("process:{prog}"),
                )?;
                self.ask(
                    &format!("process.{prog}"),
                    &format!("run the program '{prog}'"),
                )?;
                let args: Vec<String> = p["args"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|x| x.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let cwd = p["cwd"]
                    .as_str()
                    .map(|d| self.d.fs.resolve(d, false))
                    .transpose()?;
                Ok(
                    serde_json::to_value(crate::process::run(c, prog, &args, cwd.as_deref())?)
                        .unwrap_or_default(),
                )
            }
            ("http", "fetch") => {
                let url = s(p, "url")?;
                let host =
                    crate::process::host_of(url).ok_or_else(|| DesktopError::invalid("bad URL"))?;
                c.require(c.host_allowed(&host), &format!("net:{host}"))?;
                self.ask(&format!("net.{host}"), &format!("connect to {host}"))?;
                let headers: Vec<(String, String)> = p["headers"]
                    .as_object()
                    .map(|o| {
                        o.iter()
                            .filter_map(|(k, v)| v.as_str().map(|v| (k.clone(), v.into())))
                            .collect()
                    })
                    .unwrap_or_default();
                let (status, body) = crate::process::fetch(
                    c,
                    p["method"].as_str().unwrap_or("GET"),
                    url,
                    &headers,
                    p["body"].as_str(),
                )?;
                Ok(json!({"status": status, "body": body}))
            }

            ("window", "open") => {
                c.require(c.windows, "windows")?;
                let mut o: WindowOpts = window::parse(p, "window")?;
                if o.id.is_empty() {
                    return Err(DesktopError::invalid("window.id required"));
                }
                if o.url.contains("://") && !o.url.starts_with("nord://") {
                    return Err(DesktopError::denied(
                        "windows may only load the app's own pages",
                    ));
                }
                o.width = o.width.clamp(0.0, 8192.0);
                o.height = o.height.clamp(0.0, 8192.0);
                self.push(HostCommand::OpenWindow(o));
                Ok(Value::Null)
            }
            ("window", "close") => {
                self.push(HostCommand::CloseWindow {
                    id: s(p, "id")?.into(),
                });
                Ok(Value::Null)
            }
            ("window", "setTitle") => {
                self.push(HostCommand::SetTitle {
                    title: s(p, "title")?.into(),
                });
                Ok(Value::Null)
            }
            ("window", "setFullscreen") => {
                self.push(HostCommand::SetFullscreen {
                    on: p["on"].as_bool().unwrap_or(true),
                });
                Ok(Value::Null)
            }
            ("window", "setAlwaysOnTop") => {
                self.push(HostCommand::SetAlwaysOnTop {
                    on: p["on"].as_bool().unwrap_or(true),
                });
                Ok(Value::Null)
            }
            ("menu", "set") | ("menu", "context") => {
                let items: Vec<MenuItem> = window::parse(&p["items"], "menu items")?;
                window::check_menu(&items, 0)?;
                self.push(if name == "set" {
                    HostCommand::SetMenu { items }
                } else {
                    HostCommand::ContextMenu {
                        items,
                        x: p["x"].as_f64(),
                        y: p["y"].as_f64(),
                    }
                });
                Ok(Value::Null)
            }
            ("tray", "set") => {
                c.require(c.tray, "tray")?;
                let items: Vec<MenuItem> = if p["items"].is_null() {
                    vec![]
                } else {
                    window::parse(&p["items"], "tray items")?
                };
                window::check_menu(&items, 0)?;
                let icon = p["icon"]
                    .as_str()
                    .map(|i| self.d.fs.resolve(i, false))
                    .transpose()?
                    .map(|f| f.display().to_string());
                self.push(HostCommand::SetTray {
                    icon,
                    tooltip: p["tooltip"].as_str().unwrap_or("").into(),
                    items,
                });
                Ok(Value::Null)
            }
            ("tray", "remove") => {
                self.push(HostCommand::RemoveTray);
                Ok(Value::Null)
            }
            ("shortcut", "register") => {
                c.require(c.global_shortcuts, "globalShortcuts")?;
                let a = window::check_accelerator(s(p, "accelerator")?)?;
                self.ask("shortcuts", "register global keyboard shortcuts")?;
                self.push(HostCommand::RegisterShortcut {
                    id: s(p, "id")?.into(),
                    accelerator: a,
                });
                Ok(Value::Null)
            }
            ("shortcut", "unregister") => {
                self.push(HostCommand::UnregisterShortcut {
                    id: s(p, "id")?.into(),
                });
                Ok(Value::Null)
            }
            _ => Err(DesktopError::unsupported(format!(
                "unknown method '{method}'"
            ))),
        }
    }

    fn fs(&self, name: &str, p: &Value) -> Result<Value> {
        let fs = &self.d.fs;
        let path = || s(p, "path");
        Ok(match name {
            "readText" => json!(fs.read_text(path()?)?),
            "read" => json!(b64_encode(&fs.read(path()?)?)),
            "writeText" => {
                fs.write(path()?, s(p, "text")?.as_bytes())?;
                Value::Null
            }
            "write" => {
                fs.write(path()?, &b64_decode(s(p, "data")?)?)?;
                Value::Null
            }
            "append" => {
                fs.append(path()?, s(p, "text")?.as_bytes())?;
                Value::Null
            }
            "list" => json!(fs.list(path()?)?),
            "stat" => json!(fs.stat(path()?)?),
            "exists" => json!(fs.exists(path()?)?),
            "mkdir" => {
                fs.mkdir(path()?)?;
                Value::Null
            }
            "remove" => {
                fs.remove(path()?, p["recursive"].as_bool().unwrap_or(false))?;
                Value::Null
            }
            "rename" => {
                fs.rename(s(p, "from")?, s(p, "to")?)?;
                Value::Null
            }
            "copy" => {
                fs.copy(s(p, "from")?, s(p, "to")?)?;
                Value::Null
            }
            "watch" => {
                let w = fs.watch(path()?, p["recursive"].as_bool().unwrap_or(false))?;
                let mut g = self.watchers.lock().unwrap_or_else(|e| e.into_inner());
                if g.1.len() >= 16 {
                    return Err(DesktopError::denied("too many watchers"));
                }
                g.0 += 1;
                let id = g.0;
                g.1.insert(id, w);
                json!(id)
            }
            "poll" => {
                let mut g = self.watchers.lock().unwrap_or_else(|e| e.into_inner());
                let w =
                    g.1.get_mut(&(p["id"].as_u64().unwrap_or(0) as u32))
                        .ok_or_else(|| DesktopError::new("not_found", "no such watcher"))?;
                json!(w.poll())
            }
            "unwatch" => {
                self.watchers
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .1
                    .remove(&(p["id"].as_u64().unwrap_or(0) as u32));
                Value::Null
            }
            _ => return Err(DesktopError::unsupported(format!("fs.{name}"))),
        })
    }

    /// `{"ok":…}` / `{"error":{"code","message"}}` — the wire format both transports use.
    pub fn call_json(&self, method: &str, p: &Value) -> Value {
        match self.call(method, p) {
            Ok(v) => json!({"ok": v}),
            Err(e) => json!({"error": {"code": e.code, "message": e.message}}),
        }
    }
    pub fn picked_paths(&self) -> Vec<PathBuf> {
        self.d.roots.picked()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{caps::Permissions, paths::Roots, services::Headless};
    use std::sync::Arc;

    fn bridge(p: Permissions) -> (tempfile::TempDir, Bridge, Headless) {
        let d = tempfile::tempdir().unwrap();
        let h = Headless::default();
        let dk = Desktop::with_services(
            "com.t.app",
            p,
            Arc::new(Roots::with_base("com.t.app", d.path())),
            Box::new(h.clone()),
            Box::new(h.clone()),
            Box::new(h.clone()),
            Box::new(h.clone()),
        )
        .unwrap();
        (d, Bridge::new(dk, "T", "1.0"), h)
    }
    fn code(r: Result<Value>) -> &'static str {
        r.unwrap_err().code
    }

    #[test]
    fn base64_roundtrip() {
        for n in 0..9 {
            let v: Vec<u8> = (0..n as u8).map(|i| i.wrapping_mul(37)).collect();
            assert_eq!(b64_decode(&b64_encode(&v)).unwrap(), v)
        }
        assert_eq!(b64_encode(b"Man"), "TWFu");
        assert!(b64_decode("@@").is_err());
    }
    #[test]
    fn default_app_can_only_use_storage_dialogs_and_own_files() {
        let (_d, b, _) = bridge(Permissions::default());
        b.call("fs.writeText", &json!({"path":"n.txt","text":"hi"}))
            .unwrap();
        assert_eq!(
            b.call("fs.readText", &json!({"path":"n.txt"})).unwrap(),
            json!("hi")
        );
        b.call("store.set", &json!({"key":"k","value":{"a":1}}))
            .unwrap();
        assert_eq!(
            b.call("store.get", &json!({"key":"k"})).unwrap(),
            json!({"a":1})
        );
        for (m, pr) in [
            ("notify.show", json!({"title":"x"})),
            ("clipboard.readText", json!({})),
            ("clipboard.writeText", json!({"text":"x"})),
            ("fs.readText", json!({"path":"documents:a"})),
            ("process.run", json!({"program":"ls"})),
            ("http.fetch", json!({"url":"https://x.com"})),
            ("tray.set", json!({})),
            ("shortcut.register", json!({"id":"a","accelerator":"Cmd+K"})),
            ("window.open", json!({"id":"w"})),
        ] {
            assert_eq!(code(b.call(m, &pr)), "denied", "{m}");
        }
        assert_eq!(code(b.call("nope.x", &json!({}))), "unsupported");
        assert_eq!(code(b.call("bad", &json!({}))), "invalid");
    }
    #[test]
    fn dialogs_grant_picked_paths_and_record_recent() {
        let mut p = Permissions::default();
        p.fs.roots = vec!["picked".into()];
        p.fs.write = true;
        let (d, b, h) = bridge(p);
        let f = d.path().join("proj");
        std::fs::create_dir_all(&f).unwrap();
        std::fs::write(f.join("a.txt"), "A").unwrap();
        assert_eq!(
            code(b.call("fs.readText", &json!({"path": f.join("a.txt")}))),
            "denied"
        );
        h.st().folder.push_back(Some(f.clone()));
        assert_eq!(b.call("dialog.folder", &json!({})).unwrap(), json!(f));
        assert_eq!(
            b.call("fs.readText", &json!({"path": f.join("a.txt")}))
                .unwrap(),
            json!("A")
        );
        assert_eq!(b.call("dialog.recent", &json!({})).unwrap(), json!([f]));
        assert_eq!(
            b.call("dialog.open", &json!({})).unwrap(),
            Value::Null,
            "cancelled"
        );
    }
    #[test]
    fn sensitive_capabilities_prompt_once_and_are_remembered() {
        let mut p = Permissions::all();
        p.prompt = true;
        p.process = vec!["echo".into()];
        let (d, b, h) = bridge(p);
        h.st().confirms.extend([false, true]);
        assert_eq!(
            code(b.call("process.run", &json!({"program":"echo","args":["a"]}))),
            "denied",
            "user declined"
        );
        if cfg!(unix) {
            assert_eq!(
                b.call("process.run", &json!({"program":"echo","args":["a"]}))
                    .unwrap()["stdout"],
                "a\n"
            );
            assert_eq!(
                b.call("process.run", &json!({"program":"echo","args":["b"]}))
                    .unwrap()["stdout"],
                "b\n",
                "no second prompt"
            );
        }
        assert!(
            Grants::open(d.path().join("data/com.t.app/grants.json")).has("process.echo")
                || !cfg!(unix)
        );
        let audit = b.call("app.audit", &json!({})).unwrap();
        assert!(audit.to_string().contains("process.run"));
    }
    #[test]
    fn notifications_clipboard_and_host_commands() {
        let (_d, b, h) = bridge(Permissions::all());
        b.call("notify.show", &json!({"title":"Hi","body":"there"}))
            .unwrap();
        b.call("notify.badge", &json!({"text":"3"})).unwrap();
        b.call("clipboard.writeText", &json!({"text":"copied"}))
            .unwrap();
        assert_eq!(
            b.call("clipboard.readText", &json!({})).unwrap(),
            json!("copied")
        );
        assert_eq!(
            h.st().notifications,
            vec![("Hi".to_string(), "there".to_string())]
        );
        b.call(
            "window.open",
            &json!({"id":"prefs","title":"Prefs","url":"prefs.html","width":400,"height":300}),
        )
        .unwrap();
        assert_eq!(
            code(b.call("window.open", &json!({"id":"x","url":"https://evil.com"}))),
            "denied"
        );
        b.call("menu.set", &json!({"items":[{"label":"File","items":[{"id":"new","label":"New","accelerator":"Cmd+N"}]}]})).unwrap();
        assert_eq!(
            code(b.call(
                "menu.set",
                &json!({"items":[{"label":"x","accelerator":"Hyper+Q"}]})
            )),
            "invalid"
        );
        b.call(
            "shortcut.register",
            &json!({"id":"go","accelerator":"Ctrl+Alt+K"}),
        )
        .unwrap();
        let cmds = b.take_host_commands();
        assert!(
            matches!(cmds[0], HostCommand::Badge { .. })
                && cmds
                    .iter()
                    .any(|c| matches!(c, HostCommand::OpenWindow(w) if w.id == "prefs"))
                && cmds
                    .iter()
                    .any(|c| matches!(c, HostCommand::RegisterShortcut { .. }))
        );
        assert!(b.take_host_commands().is_empty());
    }
    #[test]
    fn open_url_only_allows_web_schemes_and_files_in_scope() {
        let (_d, b, h) = bridge(Permissions::default());
        b.call("shell.openUrl", &json!({"url":"https://nord.dev"}))
            .unwrap();
        assert_eq!(
            code(b.call("shell.openUrl", &json!({"url":"file:///etc/passwd"}))),
            "denied"
        );
        assert_eq!(
            code(b.call("shell.openPath", &json!({"path":"/etc/passwd"}))),
            "denied"
        );
        assert_eq!(h.st().opened, ["https://nord.dev"]);
    }
    #[test]
    fn watchers_and_wire_format() {
        let (_d, b, _) = bridge(Permissions::default());
        b.call("fs.writeText", &json!({"path":"w/a","text":"1"}))
            .unwrap();
        let id = b.call("fs.watch", &json!({"path":"w"})).unwrap();
        b.call("fs.writeText", &json!({"path":"w/b","text":"1"}))
            .unwrap();
        assert_eq!(
            b.call("fs.poll", &json!({"id":id})).unwrap(),
            json!([{"kind":"created","path":"w/b"}])
        );
        assert_eq!(
            b.call_json("fs.readText", &json!({"path":"../x"}))["error"]["code"],
            "denied"
        );
        assert_eq!(b.call_json("store.keys", &json!({}))["ok"], json!([]));
    }
}
