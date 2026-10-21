//! Browser storage and file transfer (M11-06): the project tree lives in a `MemFs`, mirrored to IndexedDB; zips come in and go out
//! through the browser's file picker / download. Compiled for wasm32 only (see `platform` for the cross-platform seam).
use crate::platform::WebEvent;
use js_sys::{Array, Uint8Array};
use nord_core::vfs::{self, MemFs};
use std::collections::HashMap;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use web_time::Instant;

#[wasm_bindgen(module = "/web/store.js")]
extern "C" {
    #[wasm_bindgen(catch)]
    async fn load_all() -> Result<JsValue, JsValue>;
    fn put(path: &str, bytes: &[u8]);
    fn del(path: &str);
    #[wasm_bindgen(catch)]
    async fn pick_files(accept: &str, multiple: bool) -> Result<JsValue, JsValue>;
    fn download(name: &str, bytes: &[u8]);
    async fn fetch_bytes(url: &str) -> JsValue;
    async fn server_ping() -> JsValue;
    async fn srv_send(method: &str, path: &str, body: Option<Vec<u8>>) -> JsValue;
    async fn srv_get(path: &str, method: &str, body: Option<String>) -> JsValue;
    fn download_url(url: &str);
}

/// Where new and imported projects live in the browser tree.
pub const PROJECTS_DIR: &str = "/projects";

static MEM: OnceLock<Arc<MemFs>> = OnceLock::new();
static EVENTS: Mutex<Vec<WebEvent>> = Mutex::new(Vec::new());
static SAVED: Mutex<Option<HashMap<String, u64>>> = Mutex::new(None);
static LAST_FLUSH: Mutex<Option<Instant>> = Mutex::new(None);

fn entries(v: JsValue) -> Vec<(String, Vec<u8>)> {
    Array::from(&v)
        .iter()
        .filter_map(|e| {
            let pair = Array::from(&e);
            Some((pair.get(0).as_string()?, pair.get(1).dyn_into::<Uint8Array>().ok()?.to_vec()))
        })
        .collect()
}

static SERVER: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
/// Projects opened read-only because another session holds the writer lock.
static READ_ONLY: Mutex<Vec<String>> = Mutex::new(Vec::new());
/// Server projects whose files are in the tree (pulled), by name.
static PULLED: Mutex<Vec<String>> = Mutex::new(Vec::new());
static INFLIGHT: Mutex<Vec<String>> = Mutex::new(Vec::new());
static LAST_BEAT: Mutex<Option<Instant>> = Mutex::new(None);
static NOTE_AT: Mutex<Option<Instant>> = Mutex::new(None);

/// Is this editor talking to a `nord-editor-server` (projects live there, not in IndexedDB)?
pub fn server_mode() -> bool {
    SERVER.load(std::sync::atomic::Ordering::Relaxed)
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn status_of(v: &JsValue) -> u16 {
    v.as_f64().unwrap_or(0.0) as u16
}

fn body_of(v: JsValue) -> (u16, Vec<u8>) {
    let a = Array::from(&v);
    (a.get(0).as_f64().unwrap_or(0.0) as u16, a.get(1).dyn_into::<Uint8Array>().map(|b| b.to_vec()).unwrap_or_default())
}

/// `/projects/<name>/<rel>` -> (name, rel)
fn split_project(p: &str) -> Option<(&str, &str)> {
    let rest = p.strip_prefix("/projects/")?;
    let (name, rel) = rest.split_once('/')?;
    (!name.is_empty() && !rel.is_empty()).then_some((name, rel))
}

fn enc(s: &str) -> String {
    js_sys::encode_uri_component(s).as_string().unwrap_or_default()
}

/// Install the browser tree as the VFS backend and restore what the last session saved (IndexedDB) or, in server mode, the
/// project list of the server. Call once before the editor starts.
pub async fn init() {
    let mem = Arc::new(MemFs::new());
    let mut saved = HashMap::new();
    let ping = server_ping().await.as_string().and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok());
    let server = ping.as_ref().is_some_and(|p| p["authed"] == true);
    SERVER.store(server, std::sync::atomic::Ordering::Relaxed);
    if let Ok(v) = load_all().await {
        for (path, data) in entries(v) {
            // in server mode projects come from the server, not from an old local copy
            if !(server && path.starts_with("/projects/")) {
                mem.import(&path, data);
            }
        }
    }
    vfs::set_backend(mem.clone());
    let _ = vfs::create_dir_all(PROJECTS_DIR);
    if server {
        // list the server's projects: stub project files make the hub's "Recent projects" show them; the rest is pulled on open
        let (st, body) = body_of(srv_get("api/projects", "GET", None).await);
        let list: Vec<serde_json::Value> = if st == 200 { serde_json::from_slice(&body).unwrap_or_default() } else { vec![] };
        let mut recent = vec![];
        for p in list {
            let Some(name) = p["name"].as_str() else { continue };
            let (s2, f) = body_of(srv_get(&format!("api/p/{}/file?path=nord.project.json", enc(name)), "GET", None).await);
            if s2 == 200 {
                lock(&SERVER_KNOWN).push(name.to_string());
                mem.import(&format!("{PROJECTS_DIR}/{name}/nord.project.json"), f);
                recent.push(format!("{PROJECTS_DIR}/{name}"));
            }
        }
        if let Ok(j) = serde_json::to_vec(&recent) {
            mem.import("/.config/nord/recent.json", j);
        }
    }
    for (p, r) in mem.stamps() {
        saved.insert(p, r);
    }
    let _ = MEM.set(mem);
    *SAVED.lock().unwrap_or_else(|e| e.into_inner()) = Some(saved);
}

/// Write changed files to IndexedDB, or (server mode, files under `/projects/<name>/`) to the server. At most every 1.5 s; call
/// every frame.
pub fn flush() {
    let now = Instant::now();
    {
        let mut l = lock(&LAST_FLUSH);
        if l.is_some_and(|t| now.duration_since(t).as_millis() < 1500) {
            return;
        }
        *l = Some(now);
    }
    let Some(mem) = MEM.get() else { return };
    let mut g = lock(&SAVED);
    let Some(saved) = g.as_mut() else { return };
    let server = server_mode();
    let current = mem.stamps();
    let mut seen = std::collections::HashSet::new();
    for (p, r) in current {
        seen.insert(p.clone());
        // the engine copy, scratch and build output are derived data: never persisted
        if volatile(&p) || saved.get(&p) == Some(&r) {
            continue;
        }
        match split_project(&p).filter(|_| server) {
            Some((name, rel)) => push_remote(name.to_string(), rel.to_string(), p, r),
            None => {
                if let Ok(d) = vfs::read(&p) {
                    put(&p, &d);
                    saved.insert(p, r);
                }
            }
        }
    }
    let gone: Vec<String> = saved.keys().filter(|p| !seen.contains(*p)).cloned().collect();
    for p in gone {
        match split_project(&p).filter(|_| server) {
            Some((name, rel)) => {
                if !lock(&READ_ONLY).iter().any(|n| n == name) && lock(&PULLED).iter().any(|n| n == name) {
                    let (name, rel) = (name.to_string(), rel.to_string());
                    wasm_bindgen_futures::spawn_local(async move {
                        let st = status_of(&srv_send("DELETE", &format!("api/p/{}/file?path={}", enc(&name), enc(&rel)), None).await);
                        if st == 0 {
                            note("Server unreachable — a deletion was not sent; reload to resync");
                        }
                    });
                }
                saved.remove(&p);
            }
            None => {
                del(&p);
                saved.remove(&p);
            }
        }
    }
    drop(g);
    beat(now);
}

/// Throttled one-line notice (toast) so a down server does not spam the user.
fn note(msg: &str) {
    let mut n = lock(&NOTE_AT);
    if n.is_none_or(|t| t.elapsed().as_secs() > 30) {
        *n = Some(Instant::now());
        emit(WebEvent::Error(msg.to_string()));
    }
}

/// Upload one changed file; the saved stamp moves only after the server accepted it, so failures are retried by the next flush.
fn push_remote(name: String, rel: String, path: String, rev: u64) {
    let (known, pulled) = (lock(&SERVER_KNOWN).contains(&name), lock(&PULLED).contains(&name));
    if lock(&READ_ONLY).contains(&name) || (known && !pulled) {
        return; // not opened from the server (only its list stub is here), or opened read-only
    }
    {
        let mut f = lock(&INFLIGHT);
        if f.contains(&path) {
            return;
        }
        f.push(path.clone());
    }
    let Ok(data) = vfs::read(&path) else {
        lock(&INFLIGHT).retain(|p| p != &path);
        return;
    };
    wasm_bindgen_futures::spawn_local(async move {
        let url = format!("api/p/{}/file?path={}", enc(&name), enc(&rel));
        let mut st = status_of(&srv_send("PUT", &url, Some(data.clone())).await);
        if st == 404 {
            // a project made in this browser: create it on the server, take the lock, retry
            let body = format!("{{\"name\":{},\"kind\":\"html\"}}", serde_json::to_string(&name).unwrap_or_default());
            let (c, _) = body_of(srv_get("api/projects", "POST", Some(body)).await);
            if c == 201 || c == 409 {
                let _ = srv_send("POST", &format!("api/p/{}/lock", enc(&name)), None).await;
                lock(&SERVER_KNOWN).push(name.clone());
                lock(&PULLED).push(name.clone());
                st = status_of(&srv_send("PUT", &url, Some(data)).await);
            }
        }
        lock(&INFLIGHT).retain(|p| p != &path);
        match st {
            204 | 200 => {
                if let Some(g) = lock(&SAVED).as_mut() {
                    g.insert(path, rev);
                }
            }
            423 => {
                lock(&READ_ONLY).push(name.clone());
                note(&format!("“{name}” is being edited in another session — your changes are not saved to the server"));
            }
            0 => note("Server unreachable — changes are kept here and retried"),
            507 => note("Server workspace is full (quota) — changes are not saved"),
            c => note(&format!("Server refused a save ({c})")),
        }
    });
}

static SERVER_KNOWN: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Keep the writer lock of every open server project fresh (45 s lifetime on the server).
fn beat(now: Instant) {
    if !server_mode() {
        return;
    }
    {
        let mut b = lock(&LAST_BEAT);
        if b.is_some_and(|t| now.duration_since(t).as_secs() < 15) {
            return;
        }
        *b = Some(now);
    }
    let names: Vec<String> = lock(&PULLED).clone();
    for name in names {
        if lock(&READ_ONLY).contains(&name) {
            continue;
        }
        wasm_bindgen_futures::spawn_local(async move {
            let _ = srv_send("POST", &format!("api/p/{}/lock", enc(&name)), None).await;
        });
    }
}

pub fn poll_events() -> Vec<WebEvent> {
    std::mem::take(&mut *EVENTS.lock().unwrap_or_else(|e| e.into_inner()))
}

fn emit(e: WebEvent) {
    EVENTS.lock().unwrap_or_else(|e| e.into_inner()).push(e);
}

/// Pick a `.zip` project and unpack it into `/projects/<name>`; emits `OpenProject` when done.
pub fn import_zip() {
    wasm_bindgen_futures::spawn_local(async {
        let Ok(v) = pick_files(".zip", false).await else { return };
        let Some((name, data)) = entries(v).into_iter().next() else { return };
        match unzip_project(&name, &data) {
            Ok(dir) => emit(WebEvent::OpenProject(dir)),
            Err(e) => emit(WebEvent::Error(format!("Could not open {name}: {e}"))),
        }
    });
}

/// Pick asset files and stage them in `/imports`; emits `ImportFiles`.
pub fn import_files() {
    wasm_bindgen_futures::spawn_local(async {
        let Ok(v) = pick_files("*/*", true).await else { return };
        let _ = vfs::create_dir_all("/imports");
        let mut out = vec![];
        for (name, data) in entries(v) {
            let p = PathBuf::from("/imports").join(&name);
            if vfs::write(&p, &data).is_ok() {
                out.push(p);
            }
        }
        if !out.is_empty() {
            emit(WebEvent::ImportFiles(out));
        }
    });
}

fn unzip_project(zip_name: &str, data: &[u8]) -> Result<PathBuf, String> {
    let mut z = zip::ZipArchive::new(Cursor::new(data)).map_err(|e| e.to_string())?;
    // a zip made by "Download project" has a single top folder; strip it so nord.project.json lands at the root
    let names: Vec<String> = (0..z.len()).filter_map(|i| z.by_index(i).ok().map(|f| f.name().to_string())).collect();
    let top = names.first().and_then(|n| n.split('/').next()).unwrap_or("").to_string();
    let strip = !top.is_empty()
        && names.iter().all(|n| n.starts_with(&format!("{top}/")));
    let stem = zip_name.trim_end_matches(".zip");
    let base = if strip { top.as_str() } else { stem };
    let safe: String = base.chars().map(|c| if c.is_alphanumeric() || " -_.".contains(c) { c } else { '_' }).collect();
    let mut dir = Path::new(PROJECTS_DIR).join(&safe);
    let mut n = 2;
    while vfs::metadata(&dir).is_ok() {
        dir = Path::new(PROJECTS_DIR).join(format!("{safe} {n}"));
        n += 1;
    }
    for i in 0..z.len() {
        let mut f = z.by_index(i).map_err(|e| e.to_string())?;
        if f.is_dir() {
            continue;
        }
        let rel = f.name().to_string();
        let rel = if strip { rel[top.len() + 1..].to_string() } else { rel };
        // zip-slip guard: no absolute or parent components
        if rel.split('/').any(|c| c == ".." || c.is_empty() && rel.starts_with('/')) {
            continue;
        }
        let mut buf = vec![];
        f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        let target = dir.join(&rel);
        if let Some(parent) = target.parent() {
            vfs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        vfs::write(&target, &buf).map_err(|e| e.to_string())?;
    }
    if !vfs::metadata(dir.join("nord.project.json")).is_ok_and(|m| m.is_file()) {
        let _ = vfs::remove_dir_all(&dir);
        return Err("no nord.project.json in the zip".into());
    }
    Ok(dir)
}

/// Zip the project folder and hand it to the browser as a download.
pub fn download_project(root: &Path) -> Result<(), String> {
    let mem = MEM.get().ok_or("browser storage not ready")?;
    let prefix = format!("{}/", root.to_string_lossy().trim_end_matches('/'));
    let name = root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "project".into());
    let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let opts = zip::write::SimpleFileOptions::default();
    for (p, data) in mem.files() {
        let Some(rel) = p.strip_prefix(&prefix) else { continue };
        if rel.starts_with(".nord-cache/") {
            continue;
        }
        w.start_file(format!("{name}/{rel}"), opts).map_err(|e| e.to_string())?;
        w.write_all(&data).map_err(|e| e.to_string())?;
    }
    let bytes = w.finish().map_err(|e| e.to_string())?.into_inner();
    download(&format!("{name}.zip"), &bytes);
    Ok(())
}

static ROOT: Mutex<Option<PathBuf>> = Mutex::new(None);

/// A file of the open project, for the service worker (`play/…` requests). `None` = not found.
pub fn read_project_file(rel: &str) -> Option<Vec<u8>> {
    let root = ROOT.lock().unwrap_or_else(|e| e.into_inner()).clone()?;
    if rel.split('/').any(|c| c == "..") {
        return None;
    }
    vfs::read(root.join(rel)).ok()
}

/// The browser's stand-in for the dev server: a `Hub` fed by `postMessage` from the iframes (`ipc` from the edit viewport, `log`
/// from the game) and drained to the scene iframe (`edit_tx`). The service worker serves the pages themselves.
pub fn start_hub(root: PathBuf) -> Arc<nord_serve::Hub> {
    *ROOT.lock().unwrap_or_else(|e| e.into_inner()) = Some(root);
    let (edit_tx, _) = tokio::sync::broadcast::channel(256);
    let (reload_tx, _) = tokio::sync::broadcast::channel(16);
    let hub = Arc::new(nord_serve::Hub {
        logs: Mutex::new(vec![]),
        inbox: Mutex::new(vec![]),
        edit_tx,
        reload_tx,
    });
    // iframe -> editor
    let h = hub.clone();
    let on_msg = Closure::<dyn FnMut(web_sys::MessageEvent)>::new(move |ev: web_sys::MessageEvent| {
        let d = ev.data();
        let kind = js_sys::Reflect::get(&d, &"nord".into()).ok().and_then(|v| v.as_string());
        match kind.as_deref() {
            Some("ipc") => {
                let msg = js_sys::Reflect::get(&d, &"msg".into()).unwrap_or(JsValue::NULL);
                if let Some(v) = js_sys::JSON::stringify(&msg).ok().and_then(|s| s.as_string()).and_then(|s| serde_json::from_str(&s).ok()) {
                    h.inbox.lock().unwrap_or_else(|e| e.into_inner()).push(v);
                }
            }
            Some("log") => {
                let get = |k: &str| js_sys::Reflect::get(&d, &k.into()).ok().and_then(|v| v.as_string()).unwrap_or_default();
                let mut l = h.logs.lock().unwrap_or_else(|e| e.into_inner());
                if l.len() > 5000 {
                    l.drain(..1000);
                }
                l.push(nord_serve::LogEntry { level: get("level"), text: get("text") });
            }
            _ => {}
        }
    });
    if let Some(w) = web_sys::window() {
        let _ = w.add_event_listener_with_callback("message", on_msg.as_ref().unchecked_ref());
    }
    on_msg.forget();
    // editor -> scene iframe
    let mut rx = hub.edit_tx.subscribe();
    wasm_bindgen_futures::spawn_local(async move {
        while let Ok(text) = rx.recv().await {
            let msg = js_sys::Object::new();
            let _ = js_sys::Reflect::set(&msg, &"nord".into(), &"edit".into());
            let _ = js_sys::Reflect::set(&msg, &"data".into(), &text.into());
            if let Some(win) = pane("scene").and_then(|f| f.content_window()) {
                let _ = win.post_message(&msg, "*");
            }
        }
    });
    hub
}

fn pane(key: &str) -> Option<web_sys::HtmlIFrameElement> {
    web_sys::window()?.document()?.get_element_by_id(&format!("nord-pane-{key}"))?.dyn_into().ok()
}

/// Create or move the `<iframe>` for pane `key` (CSS pixels, relative to the page) and load `url` when it changed.
pub fn place_iframe(key: &str, url: &str, x: f32, y: f32, w: f32, h: f32, visible: bool) {
    let Some(doc) = web_sys::window().and_then(|w| w.document()) else { return };
    let f = match pane(key) {
        Some(f) => f,
        None => {
            let Some(f) = doc.create_element("iframe").ok().and_then(|e| e.dyn_into::<web_sys::HtmlIFrameElement>().ok()) else { return };
            f.set_id(&format!("nord-pane-{key}"));
            let _ = f.set_attribute("allow", "autoplay; fullscreen; gamepad; clipboard-read; clipboard-write");
            let st = f.style();
            let _ = st.set_property("position", "fixed");
            let _ = st.set_property("border", "0");
            let _ = st.set_property("background", "#101418");
            if let Some(b) = doc.body() {
                let _ = b.append_child(&f);
            }
            f
        }
    };
    if f.get_attribute("data-url").as_deref() != Some(url) {
        let _ = f.set_attribute("data-url", url);
        f.set_src(url);
    }
    let st = f.style();
    let _ = st.set_property("left", &format!("{x}px"));
    let _ = st.set_property("top", &format!("{y}px"));
    let _ = st.set_property("width", &format!("{w}px"));
    let _ = st.set_property("height", &format!("{h}px"));
    let _ = st.set_property("display", if visible { "block" } else { "none" });
}

pub fn post_to_pane(key: &str, message: &serde_json::Value) {
    if let Some(window) = pane(key).and_then(|f| f.content_window()) {
        if let Ok(value) = js_sys::JSON::parse(&message.to_string()) {
            let _ = window.post_message(&value, "*");
        }
    }
}

pub fn set_iframe_visible(key: &str, visible: bool) {
    if let Some(f) = pane(key) {
        let _ = f.style().set_property("display", if visible { "block" } else { "none" });
    }
}

pub fn remove_iframe(key: &str) {
    if let Some(f) = pane(key) {
        f.remove();
    }
}

pub fn reload_iframe(key: &str) {
    if let Some(f) = pane(key) {
        if let Some(u) = f.get_attribute("data-url") {
            f.set_src(&u);
        }
    }
}

fn volatile(p: &str) -> bool {
    p.starts_with("/engine/") || p.starts_with("/tmp/") || p.contains("/dist/") || p.ends_with("/dist.zip")
}

static ENGINE: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(0); // 0 idle, 1 loading, 2 ready

pub fn engine_ready() -> bool {
    ENGINE.load(std::sync::atomic::Ordering::Relaxed) == 2
}

/// Download the engine's runtime + vendored libs (listed in `engine/manifest.json`) into `/engine` of the virtual FS so
/// `nord_export` can stage them like it does from a checkout. Idempotent; takes a few seconds the first time.
pub fn load_engine() {
    use std::sync::atomic::Ordering::Relaxed;
    if ENGINE.compare_exchange(0, 1, Relaxed, Relaxed).is_err() {
        return;
    }
    wasm_bindgen_futures::spawn_local(async {
        let list: Vec<String> = match fetch_bytes("engine/manifest.json").await.dyn_into::<Uint8Array>() {
            Ok(b) => serde_json::from_slice(&b.to_vec()).unwrap_or_default(),
            Err(_) => vec![],
        };
        if list.is_empty() {
            emit(WebEvent::Error("engine files are not available (engine/manifest.json missing)".into()));
            ENGINE.store(0, Relaxed);
            return;
        }
        let Some(mem) = MEM.get() else { return };
        for chunk in list.chunks(8) {
            let got = futures_join(chunk).await;
            for (rel, data) in got {
                if let Some(d) = data {
                    mem.import(&format!("/engine/{rel}"), d);
                }
            }
        }
        ENGINE.store(2, Relaxed);
        emit(WebEvent::Info("Engine files ready — press Export again".into()));
    });
}

async fn futures_join(chunk: &[String]) -> Vec<(String, Option<Vec<u8>>)> {
    // wasm is single-threaded: start every fetch, then await them in order (they run concurrently in the browser)
    let pending: Vec<_> = chunk.iter().map(|rel| (rel.clone(), fetch_bytes_owned(format!("engine/{rel}")))).collect();
    let mut out = vec![];
    for (rel, fut) in pending {
        out.push((rel, fut.await));
    }
    out
}

async fn fetch_bytes_owned(url: String) -> Option<Vec<u8>> {
    fetch_bytes(&url).await.dyn_into::<Uint8Array>().ok().map(|b| b.to_vec())
}

/// Hand a file of the virtual FS to the browser as a download.
pub fn download_file(path: &Path) -> Result<(), String> {
    let data = vfs::read(path).map_err(|e| e.to_string())?;
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "export.zip".into());
    download(&name, &data);
    Ok(())
}

/// Server mode: download a project's files into the tree and take its writer lock; emits `OpenProject` (or `Error`) when done.
pub fn pull_project(dir: &Path) {
    let Some(name) = dir.file_name().map(|n| n.to_string_lossy().into_owned()) else { return };
    let dir = dir.to_path_buf();
    wasm_bindgen_futures::spawn_local(async move {
        let Some(mem) = MEM.get() else { return };
        let (st, body) = body_of(srv_get(&format!("api/p/{}/tree", enc(&name)), "GET", None).await);
        if st != 200 {
            return emit(WebEvent::Error(format!("Could not open “{name}” from the server ({st})")));
        }
        let files: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap_or_default();
        let (l, _) = body_of(srv_get(&format!("api/p/{}/lock", enc(&name)), "POST", None).await);
        if l == 423 {
            lock(&READ_ONLY).push(name.clone());
            emit(WebEvent::Info(format!("“{name}” is being edited in another session — opened read-only")));
        } else if l != 200 {
            emit(WebEvent::Error(format!("Could not lock “{name}” ({l})")));
        }
        for f in files {
            let Some(rel) = f["path"].as_str() else { continue };
            if f["dir"] == true {
                let _ = vfs::create_dir_all(dir.join(rel));
                continue;
            }
            let (s2, data) = body_of(srv_get(&format!("api/p/{}/file?path={}", enc(&name), enc(rel)), "GET", None).await);
            if s2 == 200 {
                mem.import(&dir.join(rel).to_string_lossy(), data);
            }
        }
        // what we just downloaded is already on the server
        if let Some(g) = lock(&SAVED).as_mut() {
            let pre = format!("{}/", dir.to_string_lossy());
            for (p, r) in mem.stamps() {
                if p.starts_with(&pre) {
                    g.insert(p, r);
                }
            }
        }
        lock(&PULLED).push(name);
        emit(WebEvent::OpenProject(dir));
    });
}

pub fn is_pulled(dir: &Path) -> bool {
    dir.file_name().is_some_and(|n| lock(&PULLED).iter().any(|p| *p == n.to_string_lossy()))
}

/// Server mode: run the project's export on the server (full pipeline: minify, single-file, optimise, event-sheet compile) and
/// download the zip. Progress lines arrive as `WebEvent::Log`.
pub fn server_export(root: &Path, opts_json: String) {
    let Some(name) = root.file_name().map(|n| n.to_string_lossy().into_owned()) else { return };
    wasm_bindgen_futures::spawn_local(async move {
        // let pending uploads finish first, so the server exports what the editor shows
        LAST_FLUSH.lock().unwrap_or_else(|e| e.into_inner()).take();
        flush();
        for _ in 0..40 {
            if lock(&INFLIGHT).is_empty() {
                break;
            }
            sleep_ms(500).await;
        }
        let (st, body) = body_of(srv_get(&format!("api/p/{}/jobs/export", enc(&name)), "POST", Some(opts_json)).await);
        if st != 202 {
            let why = serde_json::from_slice::<serde_json::Value>(&body).ok().and_then(|v| v["error"].as_str().map(String::from)).unwrap_or_default();
            return emit(WebEvent::Error(format!("Server export refused ({st}) {why}")));
        }
        let Some(id) = serde_json::from_slice::<serde_json::Value>(&body).ok().and_then(|v| v["job"].as_str().map(String::from)) else { return };
        let mut since = 0;
        loop {
            sleep_ms(1000).await;
            let (st, b) = body_of(srv_get(&format!("api/p/{}/jobs/{id}/status?since={since}", enc(&name)), "GET", None).await);
            if st != 200 {
                return emit(WebEvent::Error("Lost the export job".into()));
            }
            let v: serde_json::Value = serde_json::from_slice(&b).unwrap_or_default();
            for l in v["lines"].as_array().into_iter().flatten().filter_map(|l| l.as_str()) {
                emit(WebEvent::Log(l.to_string()));
            }
            since = v["next"].as_u64().unwrap_or(0) as usize;
            match v["status"].as_str() {
                Some("running") => {}
                Some("done") => {
                    download_url(&format!("api/p/{}/jobs/{id}/download", enc(&name)));
                    return emit(WebEvent::Info("Server export done — downloading".into()));
                }
                other => return emit(WebEvent::Error(format!("Server export {}", other.unwrap_or("failed")))),
            }
        }
    });
}

async fn sleep_ms(ms: i32) {
    let p = js_sys::Promise::new(&mut |res, _| {
        if let Some(w) = web_sys::window() {
            let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(&res, ms);
        }
    });
    let _ = wasm_bindgen_futures::JsFuture::from(p).await;
}
