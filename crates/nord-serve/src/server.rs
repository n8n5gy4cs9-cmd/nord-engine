//! `nord serve` (also embedded in the editor): dev server. Mounts project at `/`, `/vendor/*` and `/runtime/*` from the engine root,
//! SSE live reload at `/__reload`, editor backend at `/api/*`.
use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path as UrlPath, Query, State},
    http::{header, StatusCode, Uri},
    response::{
        sse::{Event, Sse},
        IntoResponse, Response,
    },
    routing::{get, post},
    Json, Router,
};
use futures_util::{Stream, StreamExt};
use std::{
    collections::HashMap,
    convert::Infallible,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;

/// Injected into served HTML. The event carries the changed paths as JSON; a running Nord game may hot-swap scripts
/// (`window.__nord.hotReload(paths)` returns true when it handled the change), anything else reloads the page.
const RELOAD_JS: &str = "<script>window.__nordServed=true;(()=>{const s=(l,a)=>{try{fetch('/api/log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({level:l,text:a.map(x=>x instanceof Error?x.stack||x.message:typeof x==='object'?JSON.stringify(x):String(x)).join(' ')})})}catch{}};for(const l of ['log','info','warn','error']){const o=console[l].bind(console);console[l]=(...a)=>{o(...a);s(l,a)}}addEventListener('error',e=>s('error',[e.message+(e.filename?' ('+e.filename+':'+e.lineno+')':'')]));addEventListener('unhandledrejection',e=>s('error',[e.reason||'unhandled rejection']))})();new EventSource('/__reload').onmessage=e=>{let p=[];try{p=JSON.parse(e.data)}catch{}if(!(window.__nord&&window.__nord.hotReload&&window.__nord.hotReload(p)))location.reload()}</script>";

pub use crate::hub::{Hub, LogEntry};

#[derive(serde::Deserialize)]
struct Since {
    #[serde(default)]
    since: usize,
}

#[derive(Clone)]
struct App {
    desktop: Arc<std::sync::OnceLock<Option<Arc<nord_desktop::bridge::Bridge>>>>,
    project: Arc<PathBuf>,
    engine: Arc<PathBuf>,
    tx: broadcast::Sender<Vec<String>>,
    hub: Arc<Hub>,
    /// multiplayer signalling rooms (`/__signal/<room>`), see `runtime/core/multiplayer.js`
    rooms: Arc<Mutex<HashMap<String, broadcast::Sender<String>>>>,
}

/// Find the engine root (the directory holding `vendor/VENDOR.json`): `$NORD_ROOT`, else walk up from cwd and the exe.
pub fn engine_root() -> Option<PathBuf> {
    let ok = |p: &Path| p.join("vendor/VENDOR.json").exists();
    if let Some(r) = std::env::var_os("NORD_ROOT")
        .map(PathBuf::from)
        .filter(|p| ok(p))
    {
        return Some(r);
    }
    // macOS bundle: Nord Engine.app/Contents/MacOS/<exe>  ->  Contents/Resources holds vendor/, runtime/, editor/ ...
    if let Some(res) = std::env::current_exe()
        .ok()
        .and_then(|e| Some(e.parent()?.parent()?.join("Resources")))
        .filter(|p| ok(p))
    {
        return Some(res);
    }
    let starts = [std::env::current_exe().ok(), std::env::current_dir().ok()];
    starts
        .into_iter()
        .flatten()
        .find_map(|s| s.ancestors().find(|a| ok(a)).map(Path::to_path_buf))
}

fn safe_join(base: &Path, rel: &str) -> Option<PathBuf> {
    let rel = rel.trim_start_matches('/');
    if rel.split('/').any(|c| c == ".." || c.contains('\\')) {
        return None;
    }
    Some(base.join(rel))
}

fn file_response(p: &Path) -> Response {
    let p = if p.is_dir() {
        p.join("index.html")
    } else {
        p.to_path_buf()
    };
    let Ok(bytes) = std::fs::read(&p) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    content_response(&p, bytes)
}

fn content_response(p: &Path, mut bytes: Vec<u8>) -> Response {
    let mime = mime_guess::from_path(p).first_or_octet_stream();
    if mime.essence_str() == "text/html" {
        let s = String::from_utf8_lossy(&bytes).into_owned();
        let s = match s.rfind("</body>") {
            Some(i) => format!("{}{RELOAD_JS}{}", &s[..i], &s[i..]),
            None => format!("{s}{RELOAD_JS}"),
        };
        bytes = s.into_bytes();
    }
    (
        [
            (header::CONTENT_TYPE, mime.to_string()),
            (header::CACHE_CONTROL, "no-store".to_string()),
        ],
        bytes,
    )
        .into_response()
}

async fn static_files(State(a): State<App>, uri: Uri) -> Response {
    let path = uri.path();
    let (base, rel) = if let Some(r) = path.strip_prefix("/__docs/") {
        if !a.engine.join("docs/manual/index.html").is_file() {
            return archived_manual(&a.engine, r);
        }
        (a.engine.join("docs/manual"), r)
    } else if let Some(r) = path.strip_prefix("/__spritebank/") {
        if !r.starts_with("assets/packs/") {
            return StatusCode::FORBIDDEN.into_response();
        }
        (a.engine.as_ref().clone(), r)
    } else if let Some(r) = path.strip_prefix("/__level2d-library/") {
        if !nord_core::level2d::LIBRARY
            .iter()
            .any(|id| r == format!("{id}.js"))
        {
            return StatusCode::FORBIDDEN.into_response();
        }
        (a.engine.join("library/scripts"), r)
    } else if path == "/__edit" {
        (a.engine.join("editor/viewport"), "edit.html")
    } else if let Some(r) = path.strip_prefix("/editor/") {
        (a.engine.join("editor"), r)
    } else if let Some(r) = path.strip_prefix("/vendor/") {
        (a.engine.join("vendor"), r)
    } else if let Some(r) = path.strip_prefix("/runtime/") {
        (a.engine.join("runtime"), r)
    } else {
        ((*a.project).clone(), path)
    };
    match safe_join(&base, rel) {
        Some(p) => file_response(&p),
        None => StatusCode::BAD_REQUEST.into_response(),
    }
}

fn archived_manual(engine: &Path, rel: &str) -> Response {
    use std::io::Read;
    if safe_join(Path::new("manual"), rel).is_none() {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let rel = if rel.is_empty() { "index.html" } else { rel };
    let read = || -> Option<Vec<u8>> {
        let file = std::fs::File::open(engine.join("docs/manual.zip")).ok()?;
        let mut archive = zip::ZipArchive::new(file).ok()?;
        let mut entry = archive.by_name(rel).ok()?;
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes).ok()?;
        Some(bytes)
    };
    match read() {
        Some(bytes) => content_response(Path::new(rel), bytes),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn reload(State(a): State<App>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let s = BroadcastStream::new(a.tx.subscribe())
        .filter_map(|m| async move { m.ok() })
        .map(|paths| Ok(Event::default().data(serde_json::to_string(&paths).unwrap_or_default())));
    Sse::new(s).keep_alive(axum::response::sse::KeepAlive::new())
}

fn room_tx(a: &App, room: &str) -> Option<broadcast::Sender<String>> {
    if room.is_empty()
        || room.len() > 64
        || !room
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    let mut m = a.rooms.lock().unwrap();
    if !m.contains_key(room) && m.len() >= 64 {
        m.retain(|_, t| t.receiver_count() > 0); // forget empty rooms before refusing a new one
        if m.len() >= 64 {
            return None;
        }
    }
    Some(
        m.entry(room.to_string())
            .or_insert_with(|| broadcast::channel(64).0)
            .clone(),
    )
}

/// Multiplayer signalling relay: everything POSTed to a room is delivered to every SSE subscriber of that room (peers filter by `to`).
async fn signal_get(State(a): State<App>, UrlPath(room): UrlPath<String>) -> Response {
    let Some(tx) = room_tx(&a, &room) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let s = BroadcastStream::new(tx.subscribe())
        .filter_map(|m| async move { m.ok() })
        .map(|m| Ok::<_, Infallible>(Event::default().data(m)));
    Sse::new(s)
        .keep_alive(axum::response::sse::KeepAlive::new())
        .into_response()
}

async fn signal_post(
    State(a): State<App>,
    UrlPath(room): UrlPath<String>,
    body: String,
) -> StatusCode {
    if body.len() > 65536 {
        return StatusCode::PAYLOAD_TOO_LARGE;
    }
    match room_tx(&a, &room) {
        Some(tx) => {
            let _ = tx.send(body);
            StatusCode::NO_CONTENT
        }
        None => StatusCode::BAD_REQUEST,
    }
}

async fn edit_events(State(a): State<App>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let s = BroadcastStream::new(a.hub.edit_tx.subscribe())
        .filter_map(|m| async move { m.ok() })
        .map(|m| Ok(Event::default().data(m)));
    Sse::new(s).keep_alive(axum::response::sse::KeepAlive::new())
}

async fn log_post(State(a): State<App>, Json(e): Json<LogEntry>) -> StatusCode {
    let mut l = a.hub.logs.lock().unwrap();
    if l.len() > 5000 {
        l.drain(..1000);
    }
    l.push(e);
    StatusCode::NO_CONTENT
}

async fn log_get(State(a): State<App>, Query(q): Query<Since>) -> Json<Vec<LogEntry>> {
    let l = a.hub.logs.lock().unwrap();
    Json(l.iter().skip(q.since).cloned().collect())
}

async fn ipc_post(State(a): State<App>, Json(v): Json<serde_json::Value>) -> StatusCode {
    a.hub.inbox.lock().unwrap().push(v);
    StatusCode::NO_CONTENT
}

async fn ipc_get(State(a): State<App>, Query(q): Query<Since>) -> Json<Vec<serde_json::Value>> {
    let l = a.hub.inbox.lock().unwrap();
    Json(l.iter().skip(q.since).cloned().collect())
}

/// Non-JSON POSTs must carry a custom header: a cross-site page cannot set it without a CORS preflight (which we never answer).
fn has_nord_header(h: &axum::http::HeaderMap) -> bool {
    h.contains_key("x-nord")
}

/// Last heartbeat (ms since the epoch) of an open Graph editor: the running game only sends node-flow traces while one is watching.
static GRAPH_HEARTBEAT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

async fn graph_trace_hb(headers: axum::http::HeaderMap) -> StatusCode {
    if !has_nord_header(&headers) {
        return StatusCode::FORBIDDEN;
    }
    GRAPH_HEARTBEAT.store(now_ms(), std::sync::atomic::Ordering::Relaxed);
    StatusCode::NO_CONTENT
}

/// `{"wanted": true}` while a Graph editor sent a heartbeat in the last 5 s (polled by the game's graph runner).
async fn graph_trace_wanted() -> Json<serde_json::Value> {
    let last = GRAPH_HEARTBEAT.load(std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "wanted": last > 0 && now_ms().saturating_sub(last) < 5000 }))
}

/// Send a command to connected viewports (used by tests and the separate-window fallback).
async fn edit_cmd(
    State(a): State<App>,
    headers: axum::http::HeaderMap,
    body: String,
) -> StatusCode {
    if !has_nord_header(&headers) {
        return StatusCode::FORBIDDEN;
    }
    let _ = a.hub.edit_tx.send(body);
    StatusCode::NO_CONTENT
}

/// Dev-time desktop bridge (ADR-020): same JSON API as the wry IPC in `nord-player`, permissions from the project's `desktop.permissions`.
/// `NORD_DESKTOP_BASE=<dir>` redirects appData/documents/… (tests, sandboxes).
fn desktop_bridge(a: &App) -> Option<Arc<nord_desktop::bridge::Bridge>> {
    a.desktop
        .get_or_init(|| {
            let p = nord_core::io::load_project(&a.project).ok()?;
            let perms = nord_desktop::caps::Permissions::from_json(
                p.desktop
                    .get("permissions")
                    .unwrap_or(&serde_json::Value::Null),
            )
            .ok()?;
            let base = std::env::var_os("NORD_DESKTOP_BASE").map(PathBuf::from);
            let d = nord_desktop::Desktop::new(&p.id, perms, base).ok()?;
            Some(Arc::new(nord_desktop::bridge::Bridge::new(
                d,
                &p.name,
                &p.engine_version,
            )))
        })
        .clone()
}

async fn desktop_call(
    State(a): State<App>,
    headers: axum::http::HeaderMap,
    Json(req): Json<serde_json::Value>,
) -> Response {
    if !has_nord_header(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let Some(b) = desktop_bridge(&a) else {
        return Json(serde_json::json!({"error": {"code": "unsupported", "message": "project has no valid desktop.permissions"}})).into_response();
    };
    let method = req["method"].as_str().unwrap_or("").to_string();
    // blocking calls (dialogs, process) must not stall the async runtime
    let params = req["params"].clone();
    match tokio::task::spawn_blocking(move || b.call_json(&method, &params)).await {
        Ok(v) => Json(v).into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

async fn desktop_events(State(a): State<App>) -> Json<Vec<serde_json::Value>> {
    Json(
        desktop_bridge(&a)
            .map(|b| b.take_events())
            .unwrap_or_default(),
    )
}

// ---- FPS Creator level editor backend (docs/FPS_CREATOR.md): a jailed file API for `levels/` and `fpsc/` only -----------------------

/// Writes need `x-nord-fpsc: 1`: a custom header forces a CORS preflight, so other web pages cannot POST here.
fn fpsc_write_allowed(headers: &axum::http::HeaderMap) -> bool {
    headers.get("x-nord-fpsc").is_some_and(|v| v == "1")
}

#[derive(serde::Deserialize)]
struct FpscQuery {
    #[serde(default)]
    dir: String,
    #[serde(default)]
    path: String,
    #[serde(default)]
    start: bool,
}

async fn fpsc_ls(State(a): State<App>, Query(q): Query<FpscQuery>) -> Response {
    match nord_core::fpsc::ls(&a.project, &q.dir) {
        Ok(v) => Json(v).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    }
}

#[derive(serde::Deserialize)]
struct UsageQuery {
    q: String,
}

/// UI Designer: where is this action/file name used in project code?
async fn api_usages(State(a): State<App>, Query(q): Query<UsageQuery>) -> Response {
    match nord_core::fpsc::usages(&a.project, &q.q) {
        Ok(v) => Json(v).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    }
}

async fn fpsc_save(
    State(a): State<App>,
    headers: axum::http::HeaderMap,
    Query(q): Query<FpscQuery>,
    body: Bytes,
) -> Response {
    if !fpsc_write_allowed(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    match nord_core::fpsc::save(&a.project, &q.path, &body) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    }
}

async fn fpsc_install(
    State(a): State<App>,
    headers: axum::http::HeaderMap,
    Query(q): Query<FpscQuery>,
) -> Response {
    if !fpsc_write_allowed(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    match nord_core::fpsc::install(&a.engine, &a.project, q.start) {
        Ok(v) => Json(v).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn level2d_asset(
    State(a): State<App>,
    headers: axum::http::HeaderMap,
    Query(q): Query<std::collections::HashMap<String, String>>,
    body: Bytes,
) -> Response {
    if headers.get("x-nord-level2d").is_none_or(|v| v != "1") {
        return StatusCode::FORBIDDEN.into_response();
    }
    let name = q.get("name").map(String::as_str).unwrap_or("");
    if !name.ends_with(".png")
        || name.len() > 100
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
        || !body.starts_with(b"\x89PNG\r\n\x1a\n")
    {
        return StatusCode::BAD_REQUEST.into_response();
    }
    match nord_core::level2d::jailed(&a.project, &format!("assets/level2d/custom/{name}")) {
        Ok(p) if !p.exists() => match nord_core::io::write_atomic(&p, &body) {
            Ok(()) => StatusCode::NO_CONTENT.into_response(),
            Err(e) => (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
        },
        _ => (StatusCode::BAD_REQUEST, "Image exists or path is invalid").into_response(),
    }
}

async fn level2d_publish(
    State(a): State<App>,
    headers: axum::http::HeaderMap,
    body: Bytes,
) -> Response {
    if headers.get("x-nord-level2d").is_none_or(|v| v != "1") {
        return StatusCode::FORBIDDEN.into_response();
    }
    let v: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    };
    match nord_core::level2d::publish(&a.engine, &a.project, &v) {
        Ok(v) => Json(v).into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e.to_string()).into_response(),
    }
}

/// Model thumbnails rendered by the 3D edit viewport arrive as a PNG data URL; stored where nord-core caches thumbs.
async fn thumb_upload(
    State(a): State<App>,
    UrlPath(sha): UrlPath<String>,
    body: String,
) -> StatusCode {
    if sha.is_empty() || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return StatusCode::BAD_REQUEST;
    }
    let Some(b64) = body.strip_prefix("data:image/png;base64,") else {
        return StatusCode::BAD_REQUEST;
    };
    let Some(bytes) = b64_decode(b64) else {
        return StatusCode::BAD_REQUEST;
    };
    let p = a
        .project
        .join(".nord-cache/thumbs")
        .join(format!("{sha}{}.png", nord_core::thumbs::CACHE_TAG));
    if let Some(d) = p.parent() {
        let _ = std::fs::create_dir_all(d);
    }
    match nord_core::io::write_atomic(&p, &bytes) {
        Ok(()) => StatusCode::NO_CONTENT,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

fn b64_decode(s: &str) -> Option<Vec<u8>> {
    let val = |c: u8| -> Option<u32> {
        Some(match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        } as u32)
    };
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0);
    for c in s.bytes().filter(|c| !c.is_ascii_whitespace() && *c != b'=') {
        acc = (acc << 6) | val(c)?;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Some(out)
}

async fn api_project(State(a): State<App>) -> Response {
    match nord_core::io::load_project(&a.project) {
        Ok(p) => Json(p).into_response(),
        Err(e) => (StatusCode::UNPROCESSABLE_ENTITY, e.to_string()).into_response(),
    }
}

async fn api_assets(State(a): State<App>) -> Response {
    match nord_core::assets::scan(&a.project) {
        Ok(v) => Json(v).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn api_validate(State(a): State<App>) -> Json<Vec<serde_json::Value>> {
    Json(
        nord_core::validate::validate_project(&a.project)
            .into_iter()
            .map(|i| serde_json::json!({"file": i.file, "msg": i.msg}))
            .collect(),
    )
}

async fn api_thumb(State(a): State<App>, UrlPath(rel): UrlPath<String>) -> Response {
    let Ok(assets) = nord_core::assets::scan(&a.project) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let Some(asset) = assets.iter().find(|x| x.path == rel) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match nord_core::thumbs::thumb_for(&a.project, asset) {
        Ok(Some(p)) => (
            [(header::CONTENT_TYPE, "image/png")],
            std::fs::read(p).unwrap_or_default(),
        )
            .into_response(),
        _ => StatusCode::NOT_FOUND.into_response(),
    }
}

/// Poll mtimes of project files (cheap for hobby-sized projects; no watcher dependency).
fn watch(root: PathBuf, tx: broadcast::Sender<Vec<String>>) {
    fn snap(d: &Path, m: &mut HashMap<PathBuf, std::time::SystemTime>) {
        let Ok(rd) = std::fs::read_dir(d) else { return };
        for e in rd.flatten() {
            let p = e.path();
            let n = e.file_name();
            if p.is_dir() {
                if !matches!(
                    n.to_string_lossy().as_ref(),
                    ".nord-cache" | "dist" | ".git" | "node_modules" | "target"
                ) {
                    snap(&p, m);
                }
            } else if let Ok(t) = e.metadata().and_then(|m| m.modified()) {
                m.insert(p, t);
            }
        }
    }
    tokio::spawn(async move {
        let mut last = HashMap::new();
        snap(&root, &mut last);
        loop {
            tokio::time::sleep(Duration::from_millis(400)).await;
            let mut now = HashMap::new();
            snap(&root, &mut now);
            if now != last {
                let mut changed: Vec<String> = now
                    .iter()
                    .filter(|(k, v)| last.get(*k) != Some(*v))
                    .map(|(k, _)| k.clone())
                    .chain(last.keys().filter(|k| !now.contains_key(*k)).cloned())
                    .filter_map(|p| {
                        p.strip_prefix(&root)
                            .ok()
                            .map(|r| r.to_string_lossy().replace('\\', "/"))
                    })
                    .collect();
                changed.sort();
                last = now;
                let _ = tx.send(changed);
            }
        }
    });
}

/// DNS-rebinding guard: only answer requests addressed to a loopback host name.
async fn local_host_only(req: axum::extract::Request, next: axum::middleware::Next) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    let name = host.rsplit_once(':').map_or(host, |x| x.0);
    if matches!(name, "127.0.0.1" | "localhost" | "[::1]") {
        next.run(req).await
    } else {
        StatusCode::FORBIDDEN.into_response()
    }
}

pub fn router(project: PathBuf, engine: PathBuf) -> (Router, Arc<Hub>) {
    let (tx, _) = broadcast::channel(16);
    let (edit_tx, _) = broadcast::channel(64);
    let hub = Arc::new(Hub {
        logs: Mutex::new(vec![]),
        inbox: Mutex::new(vec![]),
        edit_tx,
        reload_tx: tx.clone(),
    });
    let app = App {
        desktop: Arc::default(),
        project: Arc::new(project),
        engine: Arc::new(engine),
        tx,
        hub: hub.clone(),
        rooms: Arc::default(),
    };
    let r = Router::new()
        .route("/__reload", get(reload))
        .route("/__signal/:room", get(signal_get).post(signal_post))
        .route("/api/project", get(api_project))
        .route("/api/assets", get(api_assets))
        .route("/api/validate", get(api_validate))
        .route("/api/thumb/*path", get(api_thumb))
        .route("/api/thumb-upload/:sha", post(thumb_upload))
        .route(
            "/api/level2d/asset",
            post(level2d_asset).layer(DefaultBodyLimit::max(8 << 20)),
        )
        .route(
            "/api/level2d/publish",
            post(level2d_publish).layer(DefaultBodyLimit::max(16 << 20)),
        )
        .route("/api/fpsc/ls", get(fpsc_ls))
        .route("/api/usages", get(api_usages))
        .route(
            "/api/fpsc/save",
            post(fpsc_save).layer(DefaultBodyLimit::max(nord_core::fpsc::MAX_BYTES)),
        )
        .route("/api/fpsc/install", post(fpsc_install))
        .route("/api/log", get(log_get).post(log_post))
        .route(
            "/api/ipc",
            get(ipc_get)
                .post(ipc_post)
                .layer(axum::extract::DefaultBodyLimit::max(32 << 20)),
        ) // screenshots arrive as data URLs
        .route(
            "/api/graph-trace",
            get(graph_trace_wanted).post(graph_trace_hb),
        )
        .route("/__edit/events", get(edit_events))
        .route("/__edit/cmd", post(edit_cmd))
        .route("/__desktop/call", post(desktop_call))
        .route("/__desktop/events", get(desktop_events))
        .fallback(static_files)
        .layer(axum::middleware::from_fn(local_host_only))
        .with_state(app);
    (r, hub)
}

/// Start the server on a background thread (own tokio runtime) at a free port; returns (port, hub). Used by the editor.
pub fn start_background(project: PathBuf, engine: PathBuf) -> anyhow::Result<(u16, Arc<Hub>)> {
    let (r, hub) = router(project.clone(), engine);
    let (ptx, prx) = std::sync::mpsc::channel();
    let tx = hub.reload_tx.clone();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("tokio");
        rt.block_on(async move {
            let l = tokio::net::TcpListener::bind(("127.0.0.1", 0))
                .await
                .expect("bind");
            let _ = ptx.send(l.local_addr().map(|a| a.port()).unwrap_or(0));
            watch(project, tx);
            let _ = axum::serve(l, r).await;
        });
    });
    Ok((prx.recv()?, hub))
}

pub async fn run(project: PathBuf, engine: PathBuf, port: u16) -> anyhow::Result<()> {
    let (r, hub) = router(project.clone(), engine);
    watch(project.clone(), hub.reload_tx.clone());
    let l = tokio::net::TcpListener::bind(("127.0.0.1", port)).await?;
    println!(
        "Serving {} at http://{} (Ctrl-C to stop)",
        project.display(),
        l.local_addr()?
    );
    axum::serve(l, r).await?;
    Ok(())
}

// ---- LAN preview (M10-24): open the running game on a phone/tablet on the same Wi-Fi --------------------------------------------
// A second, much smaller server: game files only (project + /runtime + /vendor), live reload and console logs. None of the editor,
// desktop-bridge, docs or /api endpoints exist on it, dot-folders (.git, .nord history) are hidden, and every request needs the random
// token from the QR/URL (first visit via `?k=`, then a cookie). It listens only while the returned `Lan` value is alive.
pub struct Lan {
    pub port: u16,
    pub token: String,
    /// `http://<lan ip>:<port>/?k=<token>` for each detected address
    pub urls: Vec<String>,
    /// the phone's console output arrives in `hub.logs`
    pub hub: Arc<Hub>,
    shutdown: Option<tokio::sync::oneshot::Sender<()>>,
}

impl Drop for Lan {
    fn drop(&mut self) {
        if let Some(t) = self.shutdown.take() {
            let _ = t.send(());
        }
    }
}

/// Local IPv4 address used for outbound traffic (UDP connect sends nothing). Empty when offline.
pub fn lan_ips() -> Vec<String> {
    let Ok(s) = std::net::UdpSocket::bind("0.0.0.0:0") else {
        return vec![];
    };
    if s.connect("192.0.2.1:9").is_err() {
        return vec![];
    }
    match s.local_addr() {
        Ok(a) if !a.ip().is_loopback() && !a.ip().is_unspecified() => vec![a.ip().to_string()],
        _ => vec![],
    }
}

fn random_token() -> String {
    use std::hash::{BuildHasher, Hasher};
    let mut out = String::new();
    for _ in 0..2 {
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u128(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_nanos()),
        );
        out += &format!("{:016x}", h.finish());
    }
    out
}

async fn lan_guard(
    State(tok): State<Arc<String>>,
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Response {
    let cookie_ok = req
        .headers()
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|c| c.split(';').any(|p| p.trim() == format!("nordk={tok}")));
    let query_ok = req
        .uri()
        .query()
        .is_some_and(|q| q.split('&').any(|p| p == format!("k={tok}")));
    if !cookie_ok && !query_ok {
        return StatusCode::FORBIDDEN.into_response();
    }
    let mut resp = next.run(req).await;
    if query_ok && !cookie_ok {
        if let Ok(v) = format!("nordk={tok}; Path=/; HttpOnly; SameSite=Strict").parse() {
            resp.headers_mut().append(header::SET_COOKIE, v);
        }
    }
    resp
}

async fn lan_static(State(a): State<App>, uri: Uri) -> Response {
    let p = uri.path();
    let hidden = p.split('/').any(|c| c.starts_with('.'))
        || ["/__docs", "/__edit", "/editor", "/api", "/__desktop"]
            .iter()
            .any(|x| p.starts_with(x));
    if hidden {
        return StatusCode::NOT_FOUND.into_response();
    }
    static_files(State(a), uri).await
}

pub fn lan_router(
    project: PathBuf,
    engine: PathBuf,
    token: String,
) -> (Router, Arc<Hub>, broadcast::Sender<Vec<String>>) {
    let (tx, _) = broadcast::channel(16);
    let (edit_tx, _) = broadcast::channel(4);
    let hub = Arc::new(Hub {
        logs: Mutex::new(vec![]),
        inbox: Mutex::new(vec![]),
        edit_tx,
        reload_tx: tx.clone(),
    });
    let app = App {
        desktop: Arc::default(),
        project: Arc::new(project),
        engine: Arc::new(engine),
        tx: tx.clone(),
        hub: hub.clone(),
        rooms: Arc::default(),
    };
    let r = Router::new()
        .route("/__reload", get(reload))
        .route("/__signal/:room", get(signal_get).post(signal_post))
        .route("/api/log", post(log_post))
        .fallback(lan_static)
        .layer(axum::middleware::from_fn_with_state(
            Arc::new(token),
            lan_guard,
        ))
        .with_state(app);
    (r, hub, tx)
}

/// Start the LAN preview server (`port` 0 = any free port).
pub fn start_lan(project: PathBuf, engine: PathBuf, port: u16) -> anyhow::Result<Lan> {
    let token = random_token();
    let (r, hub, tx) = lan_router(project.clone(), engine, token.clone());
    let (ptx, prx) = std::sync::mpsc::channel();
    let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("tokio");
        rt.block_on(async move {
            let l = match tokio::net::TcpListener::bind(("0.0.0.0", port)).await {
                Ok(l) => l,
                Err(e) => {
                    let _ = ptx.send(Err(e.to_string()));
                    return;
                }
            };
            let _ = ptx.send(Ok(l.local_addr().map(|a| a.port()).unwrap_or(0)));
            watch(project, tx);
            let _ = axum::serve(l, r)
                .with_graceful_shutdown(async move {
                    let _ = stop_rx.await;
                })
                .await;
        });
    });
    let port = prx
        .recv()?
        .map_err(|e| anyhow::anyhow!("cannot listen: {e}"))?;
    let urls = lan_ips()
        .into_iter()
        .map(|ip| format!("http://{ip}:{port}/?k={token}"))
        .collect();
    Ok(Lan {
        port,
        token,
        urls,
        hub,
        shutdown: Some(stop_tx),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn serves_zipped_manual_without_extracting_files() {
        use std::io::Write;
        let d = std::env::temp_dir().join(format!("nord-doczip-{}", std::process::id()));
        std::fs::create_dir_all(d.join("docs")).unwrap();
        let file = std::fs::File::create(d.join("docs/manual.zip")).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for (path, body) in [
            ("index.html", "<html>Guide</html>"),
            ("assets/search.js", "window.search=[]"),
            ("nord/guides/test.html", "<html>Nested</html>"),
        ] {
            zip.start_file(path, options).unwrap();
            zip.write_all(body.as_bytes()).unwrap();
        }
        zip.finish().unwrap();
        let (r, _) = router(d.clone(), d.clone());
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move { axum::serve(l, r).await.unwrap() });
        let c = reqwest::Client::new();
        for (path, mime, body) in [
            ("index.html", "text/html", "Guide"),
            ("assets/search.js", "javascript", "window.search=[]"),
            ("nord/guides/test.html", "text/html", "Nested"),
        ] {
            let response = c
                .get(format!("http://127.0.0.1:{port}/__docs/{path}"))
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            assert!(response.headers()[header::CONTENT_TYPE]
                .to_str()
                .unwrap()
                .contains(mime));
            assert!(response.text().await.unwrap().contains(body));
        }
        assert_eq!(
            archived_manual(&d, "../secret").status(),
            StatusCode::BAD_REQUEST
        );
        assert_eq!(
            archived_manual(&d, "missing.html").status(),
            StatusCode::NOT_FOUND
        );
        assert!(!d.join("docs/manual").exists());
    }

    #[tokio::test]
    async fn changed_assets_are_served_fresh_at_the_same_url() {
        let d = std::env::temp_dir().join(format!("nord-serve-fresh-{}", std::process::id()));
        std::fs::create_dir_all(d.join("assets")).unwrap();
        let file = d.join("assets/hero.png");
        std::fs::write(&file, b"old art").unwrap();
        let (r, _) = router(d.clone(), d.clone());
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move { axum::serve(l, r).await.unwrap() });
        let c = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{port}/assets/hero.png");
        let old = c.get(&url).send().await.unwrap();
        assert_eq!(old.headers()[header::CACHE_CONTROL], "no-store");
        assert_eq!(old.bytes().await.unwrap().as_ref(), b"old art");
        std::fs::write(&file, b"new art").unwrap();
        let new = c.get(&url).send().await.unwrap();
        assert_eq!(new.status(), StatusCode::OK);
        assert_eq!(new.headers()[header::CACHE_CONTROL], "no-store");
        assert_eq!(new.bytes().await.unwrap().as_ref(), b"new art");
    }

    #[tokio::test]
    async fn guards_host_and_cross_site_posts() {
        let d = std::env::temp_dir().join(format!("nord-serve-guard-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        let (r, _) = router(d.clone(), d);
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move { axum::serve(l, r).await.unwrap() });
        let c = reqwest::Client::new();
        let url = format!("http://127.0.0.1:{port}/__edit/cmd");
        assert_eq!(
            c.post(&url).body("{}").send().await.unwrap().status(),
            403,
            "no custom header"
        );
        assert_eq!(
            c.post(&url)
                .header("x-nord", "1")
                .body("{}")
                .send()
                .await
                .unwrap()
                .status(),
            204
        );
        let rebound = c
            .get(format!("http://127.0.0.1:{port}/api/log"))
            .header("host", "evil.example")
            .send()
            .await
            .unwrap();
        assert_eq!(rebound.status(), 403, "non-loopback Host rejected");
    }

    #[test]
    fn base64_decodes() {
        assert_eq!(b64_decode("aGVsbG8=").unwrap(), b"hello");
        assert_eq!(b64_decode("aGk").unwrap(), b"hi");
        assert!(b64_decode("a*b").is_none());
    }

    #[test]
    fn rejects_traversal() {
        assert!(safe_join(Path::new("/p"), "/../etc/passwd").is_none());
        assert_eq!(
            safe_join(Path::new("/p"), "/a/b.js").unwrap(),
            Path::new("/p/a/b.js")
        );
    }

    #[tokio::test]
    async fn serves_and_injects_reload() {
        let d = std::env::temp_dir().join(format!("nord-serve-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("index.html"), "<html><body>hi</body></html>").unwrap();
        let (r, _) = router(d.clone(), d.clone());
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move { axum::serve(l, r).await.unwrap() });
        let body = reqwest::get(format!("http://127.0.0.1:{port}/"))
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        assert!(body.contains("EventSource('/__reload')") && body.contains("hi"));
        let st = reqwest::get(format!("http://127.0.0.1:{port}/nope.js"))
            .await
            .unwrap()
            .status();
        assert_eq!(st, 404);
    }

    #[tokio::test]
    async fn lan_preview_needs_the_token_and_hides_editor_endpoints() {
        let d = std::env::temp_dir().join(format!("nord-lan-{}", std::process::id()));
        std::fs::create_dir_all(d.join(".nord/history")).unwrap();
        std::fs::write(d.join("index.html"), "<html><body>game</body></html>").unwrap();
        std::fs::write(d.join(".nord/history/secret.json"), "secret").unwrap();
        let lan = start_lan(d.clone(), d.clone(), 0).unwrap();
        let base = format!("http://127.0.0.1:{}", lan.port);
        let c = reqwest::Client::builder().build().unwrap();
        assert_eq!(
            c.get(format!("{base}/")).send().await.unwrap().status(),
            403,
            "no token"
        );
        let ok = c
            .get(format!("{base}/?k={}", lan.token))
            .send()
            .await
            .unwrap();
        assert_eq!(ok.status(), 200);
        let cookie = ok
            .headers()
            .get("set-cookie")
            .unwrap()
            .to_str()
            .unwrap()
            .split(';')
            .next()
            .unwrap()
            .to_string();
        assert!(ok.text().await.unwrap().contains("game"));
        for p in [
            "/.nord/history/secret.json",
            "/__edit/cmd",
            "/api/project",
            "/__desktop/call",
            "/__docs/index.html",
        ] {
            let r = c
                .get(format!("{base}{p}"))
                .header("cookie", &cookie)
                .send()
                .await
                .unwrap();
            assert_eq!(r.status(), 404, "{p}");
        }
        assert_eq!(
            c.get(format!("{base}/"))
                .header("cookie", "nordk=wrong")
                .send()
                .await
                .unwrap()
                .status(),
            403
        );
        let r = c
            .post(format!("{base}/api/log"))
            .header("cookie", &cookie)
            .header("content-type", "application/json")
            .body(r#"{"level":"info","text":"hi"}"#)
            .send()
            .await
            .unwrap();
        assert_eq!(r.status(), 204);
        assert_eq!(
            lan.hub.logs.lock().unwrap().len(),
            1,
            "phone console reaches the hub"
        );
        drop(lan);
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert!(
            c.get(format!("{base}/?k=x")).send().await.is_err(),
            "server stops when Lan is dropped"
        );
        let _ = std::fs::remove_dir_all(&d);
    }

    #[tokio::test]
    async fn signalling_relays_room_messages_and_rejects_bad_rooms() {
        let d = std::env::temp_dir().join(format!("nord-sig-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        let (r, _) = router(d.clone(), d.clone());
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = l.local_addr().unwrap().port();
        tokio::spawn(async move { axum::serve(l, r).await.unwrap() });
        let base = format!("http://127.0.0.1:{port}");
        let c = reqwest::Client::new();
        let mut sub = c
            .get(format!("{base}/__signal/room-1"))
            .send()
            .await
            .unwrap();
        assert_eq!(sub.status(), 200);
        let post = c
            .post(format!("{base}/__signal/room-1"))
            .body(r#"{"type":"hello","from":"a"}"#)
            .send()
            .await
            .unwrap();
        assert_eq!(post.status(), 204);
        let chunk = tokio::time::timeout(Duration::from_secs(3), sub.chunk())
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert!(String::from_utf8_lossy(&chunk).contains(r#""type":"hello""#));
        assert_eq!(
            c.post(format!("{base}/__signal/bad%20room"))
                .body("x")
                .send()
                .await
                .unwrap()
                .status(),
            400
        );
        assert_eq!(
            c.post(format!("{base}/__signal/room-1"))
                .body("x".repeat(70000))
                .send()
                .await
                .unwrap()
                .status(),
            413
        );
        let _ = std::fs::remove_dir_all(&d);
    }
}
