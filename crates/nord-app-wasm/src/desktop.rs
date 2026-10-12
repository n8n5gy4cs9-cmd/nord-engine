//! Desktop services for Rust apps (M9-11): ONE cfg-free API. Native builds call the same `nord-desktop` backend as the JS bridge (so the
//! `desktop.permissions` manifest is enforced identically); web builds degrade gracefully (localStorage store + virtual app-data files,
//! Notification API, clipboard write, `window.open`) and return `Error { code: "unsupported" }` for the rest.
//! ```ignore
//! let d = nord_app_wasm::desktop::Desktop::new("com.me.notes", serde_json::json!({ "fs": { "roots": ["documents"], "write": true } }));
//! d.store_set("theme", "dark".into())?;           d.fs_write_text("notes/a.md", "# hi")?;
//! if let Some(f) = d.pick_file()? { let text = d.fs_read_text(&f)?; }
//! ```
#[cfg(not(target_arch = "wasm32"))]
use serde_json::json;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub struct Error {
    /// `denied` | `unsupported` | `not_found` | `invalid` | `io`
    pub code: String,
    pub message: String,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for Error {}
pub type Result<T> = std::result::Result<T, Error>;
#[cfg(target_arch = "wasm32")]
fn unsupported<T>(what: &str) -> Result<T> {
    Err(Error {
        code: "unsupported".into(),
        message: format!("{what} is not available in the browser"),
    })
}

#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

#[cfg(not(target_arch = "wasm32"))]
mod imp {
    use super::*;
    pub struct Desktop {
        b: nord_desktop::bridge::Bridge,
    }
    fn conv(e: nord_desktop::DesktopError) -> Error {
        Error {
            code: e.code.into(),
            message: e.message,
        }
    }
    impl Desktop {
        /// `permissions` is the `desktop.permissions` object of nord.project.json (`{}` = least privilege). Prompts are off: Rust app code is trusted,
        /// the manifest still limits what it can touch.
        pub fn new(app_id: &str, permissions: Value) -> Self {
            let mut p =
                nord_desktop::caps::Permissions::from_json(&permissions).unwrap_or_default();
            p.prompt = false;
            let d = nord_desktop::Desktop::new(app_id, p, None).expect("desktop backend");
            Self {
                b: nord_desktop::bridge::Bridge::new(d, app_id, ""),
            }
        }
        pub fn is_native(&self) -> bool {
            true
        }
        /// Any bridge method (same names as the JS API, e.g. `"server.start"`).
        pub fn call(&self, method: &str, params: Value) -> Result<Value> {
            self.b.call(method, &params).map_err(conv)
        }
        pub fn list(&self, path: &str) -> Result<Vec<Entry>> {
            let v = self.call("fs.list", json!({ "path": path }))?;
            Ok(v.as_array()
                .map(|a| {
                    a.iter()
                        .map(|e| Entry {
                            name: e["name"].as_str().unwrap_or("").into(),
                            is_dir: e["isDir"].as_bool().unwrap_or(false),
                            size: e["size"].as_u64().unwrap_or(0),
                        })
                        .collect()
                })
                .unwrap_or_default())
        }
        pub fn fs_read_text(&self, path: &str) -> Result<String> {
            Ok(self
                .call("fs.readText", json!({ "path": path }))?
                .as_str()
                .unwrap_or("")
                .to_string())
        }
        pub fn fs_write_text(&self, path: &str, text: &str) -> Result<()> {
            self.call("fs.writeText", json!({ "path": path, "text": text }))
                .map(|_| ())
        }
        pub fn fs_exists(&self, path: &str) -> Result<bool> {
            Ok(self
                .call("fs.exists", json!({ "path": path }))?
                .as_bool()
                .unwrap_or(false))
        }
        pub fn fs_remove(&self, path: &str) -> Result<()> {
            self.call("fs.remove", json!({ "path": path, "recursive": true }))
                .map(|_| ())
        }
        pub fn store_get(&self, key: &str) -> Result<Option<Value>> {
            Ok(Some(self.call("store.get", json!({ "key": key }))?).filter(|v| !v.is_null()))
        }
        pub fn store_set(&self, key: &str, v: Value) -> Result<()> {
            self.call("store.set", json!({ "key": key, "value": v }))
                .map(|_| ())
        }
        pub fn store_remove(&self, key: &str) -> Result<()> {
            self.call("store.remove", json!({ "key": key })).map(|_| ())
        }
        pub fn notify(&self, title: &str, body: &str) -> Result<()> {
            self.call("notify.show", json!({ "title": title, "body": body }))
                .map(|_| ())
        }
        pub fn clipboard_set_text(&self, t: &str) -> Result<()> {
            self.call("clipboard.writeText", json!({ "text": t }))
                .map(|_| ())
        }
        pub fn clipboard_get_text(&self) -> Result<Option<String>> {
            Ok(self
                .call("clipboard.readText", json!({}))?
                .as_str()
                .map(String::from))
        }
        pub fn open_url(&self, url: &str) -> Result<()> {
            self.call("shell.openUrl", json!({ "url": url }))
                .map(|_| ())
        }
        /// Native dialogs (block until closed). The chosen path becomes readable/writable under the `picked` root.
        pub fn pick_file(&self) -> Result<Option<String>> {
            Ok(self
                .call("dialog.open", json!({}))?
                .as_array()
                .and_then(|a| a.first())
                .and_then(|p| p.as_str())
                .map(String::from))
        }
        pub fn pick_folder(&self) -> Result<Option<String>> {
            Ok(self
                .call("dialog.folder", json!({}))?
                .as_str()
                .map(String::from))
        }
        pub fn save_file(&self, name: &str) -> Result<Option<String>> {
            Ok(self
                .call("dialog.save", json!({ "fileName": name }))?
                .as_str()
                .map(String::from))
        }
        pub fn confirm(&self, text: &str) -> Result<bool> {
            Ok(self
                .call("dialog.confirm", json!({ "text": text }))?
                .as_bool()
                .unwrap_or(false))
        }
        pub fn message(&self, text: &str) -> Result<()> {
            self.call("dialog.message", json!({ "text": text }))
                .map(|_| ())
        }
    }
}

#[cfg(target_arch = "wasm32")]
mod imp {
    use super::*;
    pub struct Desktop {
        app: String,
    }
    fn storage() -> Result<web_sys::Storage> {
        web_sys::window()
            .and_then(|w| w.local_storage().ok().flatten())
            .ok_or(Error {
                code: "unsupported".into(),
                message: "localStorage unavailable".into(),
            })
    }
    fn io(e: wasm_bindgen_js_value::JsValue) -> Error {
        Error {
            code: "io".into(),
            message: format!("{e:?}"),
        }
    }
    use eframe::wasm_bindgen as wasm_bindgen_js_value;
    use eframe::wasm_bindgen::JsValue;
    impl Desktop {
        pub fn new(app_id: &str, _permissions: Value) -> Self {
            Self { app: app_id.into() }
        }
        pub fn is_native(&self) -> bool {
            false
        }
        pub fn call(&self, method: &str, _p: Value) -> Result<Value> {
            unsupported(method)
        }
        fn k(&self, kind: &str, key: &str) -> String {
            format!("nord.{}.{kind}.{key}", self.app)
        }
        fn files(&self) -> Result<Vec<String>> {
            let (s, pre) = (storage()?, format!("nord.{}.fs.", self.app));
            Ok((0..s.length().unwrap_or(0))
                .filter_map(|i| s.key(i).ok().flatten())
                .filter_map(|k| k.strip_prefix(&pre).map(String::from))
                .collect())
        }
        fn norm(p: &str) -> Result<String> {
            let p = p.trim_start_matches("appData:");
            if p.contains("..") || p.starts_with('/') || p.contains('\\') {
                return Err(Error {
                    code: "denied".into(),
                    message: "only app-data paths exist in the browser".into(),
                });
            }
            Ok(p.split('/')
                .filter(|x| !x.is_empty())
                .collect::<Vec<_>>()
                .join("/"))
        }
        pub fn list(&self, path: &str) -> Result<Vec<Entry>> {
            let p = Self::norm(path)?;
            let pre = if p.is_empty() {
                String::new()
            } else {
                format!("{p}/")
            };
            let mut seen: std::collections::BTreeMap<String, Entry> = Default::default();
            for f in self.files()?.into_iter().filter(|f| f.starts_with(&pre)) {
                let rest = &f[pre.len()..];
                let (name, dir) = match rest.split_once('/') {
                    Some((n, _)) => (n.to_string(), true),
                    None => (rest.to_string(), false),
                };
                seen.insert(
                    name.clone(),
                    Entry {
                        name,
                        is_dir: dir,
                        size: 0,
                    },
                );
            }
            Ok(seen.into_values().collect())
        }
        pub fn fs_read_text(&self, path: &str) -> Result<String> {
            storage()?
                .get_item(&self.k("fs", &Self::norm(path)?))
                .map_err(io)?
                .ok_or(Error {
                    code: "not_found".into(),
                    message: path.into(),
                })
        }
        pub fn fs_write_text(&self, path: &str, text: &str) -> Result<()> {
            storage()?
                .set_item(&self.k("fs", &Self::norm(path)?), text)
                .map_err(io)
        }
        pub fn fs_exists(&self, path: &str) -> Result<bool> {
            Ok(storage()?
                .get_item(&self.k("fs", &Self::norm(path)?))
                .map_err(io)?
                .is_some())
        }
        pub fn fs_remove(&self, path: &str) -> Result<()> {
            let p = Self::norm(path)?;
            let s = storage()?;
            for f in self
                .files()?
                .into_iter()
                .filter(|f| *f == p || f.starts_with(&format!("{p}/")))
            {
                s.remove_item(&self.k("fs", &f)).map_err(io)?;
            }
            Ok(())
        }
        pub fn store_get(&self, key: &str) -> Result<Option<Value>> {
            Ok(storage()?
                .get_item(&self.k("store", key))
                .map_err(io)?
                .and_then(|s| serde_json::from_str(&s).ok()))
        }
        pub fn store_set(&self, key: &str, v: Value) -> Result<()> {
            storage()?
                .set_item(&self.k("store", key), &v.to_string())
                .map_err(io)
        }
        pub fn store_remove(&self, key: &str) -> Result<()> {
            storage()?.remove_item(&self.k("store", key)).map_err(io)
        }
        pub fn notify(&self, title: &str, body: &str) -> Result<()> {
            let o = web_sys::NotificationOptions::new();
            o.set_body(body);
            if web_sys::Notification::permission() == web_sys::NotificationPermission::Default {
                let _ = web_sys::Notification::request_permission();
            }
            web_sys::Notification::new_with_options(title, &o)
                .map(|_| ())
                .map_err(io)
        }
        pub fn clipboard_set_text(&self, t: &str) -> Result<()> {
            let c = web_sys::window()
                .map(|w| w.navigator().clipboard())
                .ok_or(Error {
                    code: "unsupported".into(),
                    message: "clipboard".into(),
                })?;
            let _ = c.write_text(t); // promise ignored: best effort
            Ok(())
        }
        pub fn clipboard_get_text(&self) -> Result<Option<String>> {
            unsupported("reading the clipboard synchronously")
        }
        pub fn open_url(&self, url: &str) -> Result<()> {
            if !(url.starts_with("https://")
                || url.starts_with("http://")
                || url.starts_with("mailto:"))
            {
                return Err(Error {
                    code: "denied".into(),
                    message: "only http(s)/mailto".into(),
                });
            }
            web_sys::window()
                .ok_or(Error {
                    code: "unsupported".into(),
                    message: "window".into(),
                })?
                .open_with_url_and_target(url, "_blank")
                .map(|_| ())
                .map_err(io)
        }
        pub fn pick_file(&self) -> Result<Option<String>> {
            unsupported("native file dialogs")
        }
        pub fn pick_folder(&self) -> Result<Option<String>> {
            unsupported("native folder dialogs")
        }
        pub fn save_file(&self, _name: &str) -> Result<Option<String>> {
            unsupported("native save dialogs")
        }
        pub fn confirm(&self, text: &str) -> Result<bool> {
            web_sys::window()
                .ok_or(Error {
                    code: "unsupported".into(),
                    message: "window".into(),
                })?
                .confirm_with_message(text)
                .map_err(io)
        }
        pub fn message(&self, text: &str) -> Result<()> {
            web_sys::window()
                .ok_or(Error {
                    code: "unsupported".into(),
                    message: "window".into(),
                })?
                .alert_with_message(text)
                .map_err(io)
        }
    }
    #[allow(dead_code)]
    fn _unused(_: JsValue) {}
}

pub use imp::Desktop;

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::*;
    #[test]
    fn same_api_native_enforces_permissions() {
        std::env::set_var(
            "XDG_DATA_HOME",
            std::env::temp_dir().join(format!("nord-app-desk-{}", std::process::id())),
        );
        let d = Desktop::new("com.t.rust", json!({}));
        assert!(d.is_native());
        d.fs_write_text("a/b.txt", "hi").unwrap();
        assert_eq!(d.fs_read_text("a/b.txt").unwrap(), "hi");
        assert_eq!(d.list("a").unwrap()[0].name, "b.txt");
        d.store_set("k", json!([1, 2])).unwrap();
        assert_eq!(d.store_get("k").unwrap(), Some(json!([1, 2])));
        assert_eq!(d.store_get("missing").unwrap(), None);
        assert_eq!(d.fs_read_text("documents:x").unwrap_err().code, "denied");
        assert_eq!(d.notify("t", "b").unwrap_err().code, "denied");
        assert_eq!(d.clipboard_set_text("x").unwrap_err().code, "denied");
        assert_eq!(d.open_url("file:///etc/passwd").unwrap_err().code, "denied");
        d.fs_remove("a").unwrap();
        assert!(!d.fs_exists("a/b.txt").unwrap());
    }
}
