//! `nord serve` (also embedded in the editor): dev server. Mounts project at `/`, `/vendor/*` and `/runtime/*` from the engine root,
//! SSE live reload at `/__reload`, editor backend at `/api/*`.
use axum::{
    extract::{Path as UrlPath, Query, State},
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
const RELOAD_JS: &str = "<script>(()=>{const s=(l,a)=>{try{fetch('/api/log',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({level:l,text:a.map(x=>x instanceof Error?x.stack||x.message:typeof x==='object'?JSON.stringify(x):String(x)).join(' ')})})}catch{}};for(const l of ['log','info','warn','error']){const o=console[l].bind(console);console[l]=(...a)=>{o(...a);s(l,a)}}addEventListener('error',e=>s('error',[e.message+(e.filename?' ('+e.filename+':'+e.lineno+')':'')]));addEventListener('unhandledrejection',e=>s('error',[e.reason||'unhandled rejection']))})();new EventSource('/__reload').onmessage=e=>{let p=[];try{p=JSON.parse(e.data)}catch{}if(!(window.__nord&&window.__nord.hotReload&&window.__nord.hotReload(p)))location.reload()}</script>";

/// Shared state between the server and an in-process embedder (the editor): game console, viewport messages, commands.
pub struct Hub {
    pub logs: Mutex<Vec<LogEntry>>,
    /// viewport -> editor messages (selection, transforms, ...)
    pub inbox: Mutex<Vec<serde_json::Value>>,
    /// editor -> viewport commands (JSON strings), delivered over SSE
    pub edit_tx: broadcast::Sender<String>,
    pub reload_tx: broadcast::Sender<Vec<String>>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct LogEntry {
    pub level: String,
    pub text: String,
}

#[derive(serde::Deserialize)]
struct Since {
    #[serde(default)]
    since: usize,
}

#[derive(Clone)]
struct App {
    project: Arc<PathBuf>,
    engine: Arc<PathBuf>,
    tx: broadcast::Sender<Vec<String>>,
    hub: Arc<Hub>,
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
    let starts = [std::env::current_dir().ok(), std::env::current_exe().ok()];
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
    let Ok(mut bytes) = std::fs::read(&p) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let mime = mime_guess::from_path(&p).first_or_octet_stream();
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
        (a.engine.join("docs/manual"), r)
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

async fn reload(State(a): State<App>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let s = BroadcastStream::new(a.tx.subscribe())
        .filter_map(|m| async move { m.ok() })
        .map(|paths| Ok(Event::default().data(serde_json::to_string(&paths).unwrap_or_default())));
    Sse::new(s).keep_alive(axum::response::sse::KeepAlive::new())
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
        .join(format!("{sha}.png"));
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
        project: Arc::new(project),
        engine: Arc::new(engine),
        tx,
        hub: hub.clone(),
    };
    let r = Router::new()
        .route("/__reload", get(reload))
        .route("/api/project", get(api_project))
        .route("/api/assets", get(api_assets))
        .route("/api/validate", get(api_validate))
        .route("/api/thumb/*path", get(api_thumb))
        .route("/api/thumb-upload/:sha", post(thumb_upload))
        .route("/api/log", get(log_get).post(log_post))
        .route("/api/ipc", get(ipc_get).post(ipc_post))
        .route("/__edit/events", get(edit_events))
        .route("/__edit/cmd", post(edit_cmd))
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
