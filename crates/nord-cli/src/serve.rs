//! `nord serve`: dev server. Mounts project at `/`, `/vendor/*` and `/runtime/*` from the engine root,
//! SSE live reload at `/__reload`, editor backend at `/api/*`.
use axum::{
    extract::{Path as UrlPath, State},
    http::{header, StatusCode, Uri},
    response::{
        sse::{Event, Sse},
        IntoResponse, Response,
    },
    routing::get,
    Json, Router,
};
use futures_util::{Stream, StreamExt};
use std::{
    collections::HashMap,
    convert::Infallible,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;

const RELOAD_JS: &str =
    "<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>";

#[derive(Clone)]
struct App {
    project: Arc<PathBuf>,
    engine: Arc<PathBuf>,
    tx: broadcast::Sender<()>,
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
    let (base, rel) = if let Some(r) = path.strip_prefix("/vendor/") {
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
    let s = BroadcastStream::new(a.tx.subscribe()).map(|_| Ok(Event::default().data("reload")));
    Sse::new(s).keep_alive(axum::response::sse::KeepAlive::new())
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
fn watch(root: PathBuf, tx: broadcast::Sender<()>) {
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
                last = now;
                let _ = tx.send(());
            }
        }
    });
}

pub fn router(project: PathBuf, engine: PathBuf) -> (Router, broadcast::Sender<()>) {
    let (tx, _) = broadcast::channel(16);
    let app = App {
        project: Arc::new(project),
        engine: Arc::new(engine),
        tx: tx.clone(),
    };
    let r = Router::new()
        .route("/__reload", get(reload))
        .route("/api/project", get(api_project))
        .route("/api/assets", get(api_assets))
        .route("/api/validate", get(api_validate))
        .route("/api/thumb/*path", get(api_thumb))
        .fallback(static_files)
        .with_state(app);
    (r, tx)
}

pub async fn run(project: PathBuf, engine: PathBuf, port: u16) -> anyhow::Result<()> {
    let (r, tx) = router(project.clone(), engine);
    watch(project.clone(), tx);
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
