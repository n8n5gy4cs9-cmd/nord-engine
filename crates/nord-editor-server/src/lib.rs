//! Nord editor server (M11-09..12): serves the wasm editor and a small project API so several browsers can edit projects that live
//! on this machine. The browser keeps a copy of the open project in memory and syncs changed files here (see docs/WEB_EDITOR.md).
//!
//! Security rules (docs/WEB_EDITOR_PLAN.md §4): bind loopback by default; token or users-file auth; every path jailed to the user's
//! workspace (`jail`); writes are atomic; state-changing requests need the `x-nord` header (CSRF) on top of SameSite=Strict cookies;
//! jobs run argv-only, with a timeout, as the server's own unprivileged user.
mod jail;
mod jobs;

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path as UrlPath, Query, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode, Uri},
    middleware::{self, Next},
    response::{
        sse::{Event, Sse},
        IntoResponse, Response,
    },
    routing::{delete, get, post},
    Json, Router,
};
use futures_util::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    convert::Infallible,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;

pub use jail::{safe_join, valid_name};

/// How clients prove who they are.
#[derive(Clone)]
pub enum AuthMode {
    /// No login. Only for loopback (the binary refuses it on other addresses).
    None,
    /// One shared secret; everybody is the single user `admin`.
    Token(String),
    /// `user -> argon2 PHC hash`; each user gets their own workspace folder.
    Users(HashMap<String, String>),
}

#[derive(Clone)]
pub struct Config {
    /// Parent of the per-user workspaces: `<workspace>/<user>/<project>/…`.
    pub workspace: PathBuf,
    /// Folder with the built web editor (`tools/build-web-editor.sh`); `None` = API only.
    pub web: Option<PathBuf>,
    /// Engine folder (for export jobs: `NORD_ROOT`).
    pub engine: Option<PathBuf>,
    /// The `nord` CLI used by export jobs (default: next to this executable, else `$PATH`).
    pub nord_bin: Option<PathBuf>,
    pub auth: AuthMode,
    /// Per-user workspace size limit.
    pub quota_bytes: u64,
    /// Largest single file upload.
    pub max_upload: usize,
    pub job_timeout: Duration,
    pub max_jobs_per_user: usize,
    /// Allow Rust/WASM project builds (cargo runs project code!). Off by default; enable only inside a container.
    pub allow_rust_jobs: bool,
    /// Add `Secure` to the session cookie (set when behind TLS).
    pub secure_cookies: bool,
}

impl Config {
    pub fn new(workspace: PathBuf) -> Self {
        Self {
            workspace,
            web: None,
            engine: None,
            nord_bin: None,
            auth: AuthMode::None,
            quota_bytes: 2 << 30,
            max_upload: 256 << 20,
            job_timeout: Duration::from_secs(600),
            max_jobs_per_user: 2,
            allow_rust_jobs: false,
            secure_cookies: false,
        }
    }
}

struct Session {
    user: String,
}

struct Lock {
    sid: String,
    until: Instant,
}

#[derive(Clone, Serialize)]
struct Ev {
    #[serde(skip)]
    user: String,
    #[serde(skip)]
    project: String,
    #[serde(flatten)]
    body: Value,
}

pub(crate) struct Inner {
    cfg: Config,
    sessions: Mutex<HashMap<String, Session>>,
    locks: Mutex<HashMap<(String, String), Lock>>,
    events: broadcast::Sender<Ev>,
    pub(crate) jobs: Mutex<HashMap<String, jobs::Job>>,
    failures: Mutex<(Instant, u32)>,
}

#[derive(Clone)]
pub struct AppState(pub(crate) Arc<Inner>);

/// Who is calling.
#[derive(Clone)]
struct Who {
    user: String,
    sid: String,
}

fn rand_hex(n: usize) -> String {
    let mut b = vec![0u8; n];
    // getrandom only fails on exotic platforms; a session id must never be predictable, so refuse to continue instead
    getrandom::getrandom(&mut b).expect("OS random number generator");
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn ct_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    let mut d = (a.len() ^ b.len()) as u8;
    for i in 0..a.len().max(b.len()) {
        d |= a.get(i).copied().unwrap_or(0) ^ b.get(i).copied().unwrap_or(0);
    }
    d == 0
}

fn cookie(h: &HeaderMap, name: &str) -> Option<String> {
    h.get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|c| {
            let (k, v) = c.trim().split_once('=')?;
            (k == name).then(|| v.to_string())
        })
}

impl AppState {
    fn who(&self, h: &HeaderMap) -> Option<Who> {
        match &self.0.cfg.auth {
            AuthMode::None => Some(Who {
                user: "local".into(),
                sid: "local".into(),
            }),
            AuthMode::Token(t) => {
                if let Some(b) = h
                    .get(header::AUTHORIZATION)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.strip_prefix("Bearer "))
                {
                    return ct_eq(b, t).then(|| Who {
                        user: "admin".into(),
                        sid: "token".into(),
                    });
                }
                let sid = cookie(h, "nord_session")?;
                self.0.sessions.lock().ok()?.get(&sid).map(|s| Who {
                    user: s.user.clone(),
                    sid,
                })
            }
            AuthMode::Users(_) => {
                let sid = cookie(h, "nord_session")?;
                self.0.sessions.lock().ok()?.get(&sid).map(|s| Who {
                    user: s.user.clone(),
                    sid,
                })
            }
        }
    }

    fn user_dir(&self, user: &str) -> PathBuf {
        self.0.cfg.workspace.join(user)
    }

    fn project_dir(&self, user: &str, project: &str) -> Option<PathBuf> {
        valid_name(project).then(|| self.user_dir(user).join(project))
    }

    fn emit(&self, user: &str, project: &str, body: Value) {
        let _ = self.0.events.send(Ev {
            user: user.into(),
            project: project.into(),
            body,
        });
    }
}

/// Build the HTTP app. `main.rs` serves it; the integration tests drive it directly.
pub fn router(cfg: Config) -> Router {
    let _ = std::fs::create_dir_all(&cfg.workspace);
    let max_upload = cfg.max_upload;
    let (events, _) = broadcast::channel(256);
    let st = AppState(Arc::new(Inner {
        cfg,
        sessions: Mutex::default(),
        locks: Mutex::default(),
        events,
        jobs: Mutex::default(),
        failures: Mutex::new((Instant::now(), 0)),
    }));
    let api = Router::new()
        .route("/projects", get(list_projects).post(create_project))
        .route("/p/:project", delete(delete_project))
        .route("/p/:project/tree", get(tree))
        .route(
            "/p/:project/file",
            get(get_file).put(put_file).delete(delete_file),
        )
        .route("/p/:project/rename", post(rename))
        .route(
            "/p/:project/lock",
            get(lock_status).post(lock_acquire).delete(lock_release),
        )
        .route("/p/:project/events", get(events_sse))
        .route("/p/:project/download.zip", get(download_zip))
        .route("/p/:project/jobs/:job", post(jobs::start))
        .route("/p/:project/jobs/:job/status", get(jobs::status))
        .route("/p/:project/jobs/:job", delete(jobs::cancel))
        .route("/p/:project/jobs/:job/download", get(jobs::download))
        .layer(middleware::from_fn_with_state(st.clone(), guard))
        .layer(DefaultBodyLimit::max(max_upload));
    Router::new()
        .route("/api/ping", get(ping))
        .route("/api/login", post(login))
        .route("/api/logout", post(logout))
        .nest("/api", api)
        .fallback(static_files)
        .layer(middleware::from_fn(security_headers))
        .with_state(st)
}

async fn security_headers(req: axum::extract::Request, next: Next) -> Response {
    let mut r = next.run(req).await;
    let h = r.headers_mut();
    h.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    h.insert("referrer-policy", HeaderValue::from_static("same-origin"));
    r
}

/// Auth + CSRF for everything under `/api/` except ping/login.
async fn guard(
    State(st): State<AppState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Response {
    let Some(who) = st.who(req.headers()) else {
        return (StatusCode::UNAUTHORIZED, "login required").into_response();
    };
    let unsafe_method = !matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS);
    if unsafe_method && !req.headers().contains_key("x-nord") {
        return (StatusCode::FORBIDDEN, "missing x-nord header").into_response();
    }
    req.extensions_mut().insert(who);
    next.run(req).await
}

fn me(req: &axum::http::Extensions) -> Who {
    req.get::<Who>().cloned().unwrap_or(Who {
        user: "nobody".into(),
        sid: String::new(),
    })
}

async fn ping(State(st): State<AppState>, headers: HeaderMap) -> Json<Value> {
    let who = st.who(&headers);
    let mode = match st.0.cfg.auth {
        AuthMode::None => "none",
        AuthMode::Token(_) => "token",
        AuthMode::Users(_) => "users",
    };
    Json(
        json!({ "server": true, "auth": mode, "authed": who.is_some(), "user": who.map(|w| w.user) }),
    )
}

#[derive(Deserialize)]
struct LoginBody {
    token: Option<String>,
    user: Option<String>,
    password: Option<String>,
}

async fn login(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(b): Json<LoginBody>,
) -> Response {
    if !headers.contains_key("x-nord") {
        return (StatusCode::FORBIDDEN, "missing x-nord header").into_response();
    }
    // slow down guessing: after 5 failures in a minute every attempt waits 1 s
    let throttle = {
        let mut f = st.0.failures.lock().unwrap_or_else(|e| e.into_inner());
        if f.0.elapsed() > Duration::from_secs(60) {
            *f = (Instant::now(), 0);
        }
        f.1 >= 5
    };
    if throttle {
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
    let user = match &st.0.cfg.auth {
        AuthMode::None => Some("local".to_string()),
        AuthMode::Token(t) => b
            .token
            .as_deref()
            .filter(|x| ct_eq(x, t))
            .map(|_| "admin".to_string()),
        AuthMode::Users(u) => match (b.user.as_deref(), b.password.as_deref()) {
            (Some(name), Some(pw)) if valid_name(name) => u
                .get(name)
                .filter(|h| verify_password(pw, h))
                .map(|_| name.to_string()),
            _ => None,
        },
    };
    let Some(user) = user else {
        st.0.failures.lock().unwrap_or_else(|e| e.into_inner()).1 += 1;
        return (StatusCode::UNAUTHORIZED, "wrong credentials").into_response();
    };
    let _ = std::fs::create_dir_all(st.user_dir(&user));
    let sid = rand_hex(24);
    if let Ok(mut s) = st.0.sessions.lock() {
        s.insert(sid.clone(), Session { user: user.clone() });
    }
    let secure = if st.0.cfg.secure_cookies {
        "; Secure"
    } else {
        ""
    };
    (
        [(
            header::SET_COOKIE,
            format!("nord_session={sid}; HttpOnly; SameSite=Strict; Path=/{secure}"),
        )],
        Json(json!({ "user": user })),
    )
        .into_response()
}

async fn logout(State(st): State<AppState>, headers: HeaderMap) -> Response {
    if !headers.contains_key("x-nord") {
        return StatusCode::FORBIDDEN.into_response();
    }
    if let (Some(sid), Ok(mut s)) = (cookie(&headers, "nord_session"), st.0.sessions.lock()) {
        s.remove(&sid);
    }
    (
        [(
            header::SET_COOKIE,
            "nord_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/",
        )],
        StatusCode::NO_CONTENT,
    )
        .into_response()
}

/// `argon2` PHC string check (users file). Constant-time inside the crate.
fn verify_password(pw: &str, phc: &str) -> bool {
    use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};
    PasswordHash::new(phc)
        .is_ok_and(|h| Argon2::default().verify_password(pw.as_bytes(), &h).is_ok())
}

/// Hash a password for the users file (`nord-editor-server hash-password`).
pub fn hash_password(pw: &str) -> anyhow::Result<String> {
    use argon2::{
        password_hash::{PasswordHasher, SaltString},
        Argon2,
    };
    let mut salt = [0u8; 16];
    getrandom::getrandom(&mut salt).map_err(|e| anyhow::anyhow!("no OS randomness: {e}"))?;
    let salt = SaltString::encode_b64(&salt).map_err(|e| anyhow::anyhow!("{e}"))?;
    Ok(Argon2::default()
        .hash_password(pw.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("{e}"))?
        .to_string())
}

/// Parse a users file: one `name:argon2-hash` per line (`#` comments).
pub fn parse_users(text: &str) -> HashMap<String, String> {
    text.lines()
        .filter_map(|l| {
            let l = l.trim();
            let (n, h) = l.split_once(':')?;
            (!l.starts_with('#') && valid_name(n.trim()))
                .then(|| (n.trim().to_string(), h.trim().to_string()))
        })
        .collect()
}

// ---------- projects ----------

fn err(code: StatusCode, msg: impl Into<String>) -> Response {
    (code, Json(json!({ "error": msg.into() }))).into_response()
}

async fn list_projects(State(st): State<AppState>, req: axum::extract::Request) -> Response {
    let who = me(req.extensions());
    let dir = st.user_dir(&who.user);
    let mut v = vec![];
    if let Ok(rd) = std::fs::read_dir(&dir) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            if !valid_name(&name) || !e.path().join(nord_core::io::PROJECT_FILE).is_file() {
                continue;
            }
            let kind = nord_core::io::load_project(&e.path())
                .map(|p| p.kind.as_str().to_string())
                .unwrap_or_default();
            v.push(json!({ "name": name, "kind": kind }));
        }
    }
    v.sort_by_key(|x| x["name"].as_str().map(str::to_lowercase));
    Json(v).into_response()
}

#[derive(Deserialize)]
struct NewProject {
    name: String,
    #[serde(default = "default_kind")]
    kind: String,
}

fn default_kind() -> String {
    "2d".into()
}

async fn create_project(State(st): State<AppState>, req: axum::extract::Request) -> Response {
    let who = me(req.extensions());
    let Ok(body) = axum::body::to_bytes(req.into_body(), 64 << 10).await else {
        return err(StatusCode::BAD_REQUEST, "bad body");
    };
    let Ok(b) = serde_json::from_slice::<NewProject>(&body) else {
        return err(StatusCode::BAD_REQUEST, "expected {name, kind}");
    };
    let Some(dir) = st.project_dir(&who.user, &b.name) else {
        return err(StatusCode::BAD_REQUEST, "invalid project name");
    };
    let Ok(kind) = serde_json::from_value(Value::String(b.kind.clone())) else {
        return err(
            StatusCode::BAD_REQUEST,
            "kind: html | 2d | 3d (Rust projects are created in the desktop editor)",
        );
    };
    if workspace_size(&st.user_dir(&who.user)) > st.0.cfg.quota_bytes {
        return err(StatusCode::INSUFFICIENT_STORAGE, "workspace quota used up");
    }
    match nord_core::project::create(&dir, kind) {
        Ok(()) => (StatusCode::CREATED, Json(json!({ "name": b.name }))).into_response(),
        Err(e) => err(StatusCode::CONFLICT, e.to_string()),
    }
}

async fn delete_project(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let Some(dir) = st.project_dir(&who.user, &project) else {
        return err(StatusCode::BAD_REQUEST, "invalid project name");
    };
    // a second, deliberate header so a stray request cannot wipe a project
    if req
        .headers()
        .get("x-nord-confirm")
        .and_then(|v| v.to_str().ok())
        != Some(project.as_str())
    {
        return err(
            StatusCode::PRECONDITION_REQUIRED,
            "send x-nord-confirm: <project name>",
        );
    }
    match std::fs::remove_dir_all(&dir) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

fn workspace_size(dir: &Path) -> u64 {
    fn walk(d: &Path, n: &mut u64) {
        if let Ok(rd) = std::fs::read_dir(d) {
            for e in rd.flatten() {
                match e.file_type() {
                    Ok(t) if t.is_dir() => walk(&e.path(), n),
                    Ok(t) if t.is_file() => *n += e.metadata().map_or(0, |m| m.len()),
                    _ => {}
                }
            }
        }
    }
    let mut n = 0;
    walk(dir, &mut n);
    n
}

/// Resolve `<user>/<project>` and require that it exists.
#[allow(clippy::result_large_err)] // the Err is the ready-made HTTP response; this is a request-scoped helper
fn existing_project(st: &AppState, who: &Who, project: &str) -> Result<PathBuf, Response> {
    let dir = st
        .project_dir(&who.user, project)
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "invalid project name"))?;
    if dir.is_dir() {
        Ok(dir)
    } else {
        Err(err(StatusCode::NOT_FOUND, "no such project"))
    }
}

async fn tree(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let dir = match existing_project(&st, &who, &project) {
        Ok(d) => d,
        Err(r) => return r,
    };
    fn walk(base: &Path, d: &Path, out: &mut Vec<Value>) {
        let Ok(rd) = std::fs::read_dir(d) else { return };
        for e in rd.flatten() {
            let Ok(t) = e.file_type() else { continue };
            let name = e.file_name().to_string_lossy().into_owned();
            if t.is_symlink() || name == ".nord-cache" || name == ".git" {
                continue;
            }
            let rel = e
                .path()
                .strip_prefix(base)
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            if t.is_dir() {
                out.push(json!({ "path": rel, "dir": true }));
                walk(base, &e.path(), out);
            } else {
                out.push(json!({ "path": rel, "dir": false, "size": e.metadata().map_or(0, |m| m.len()) }));
            }
        }
    }
    let mut out = vec![];
    walk(&dir, &dir, &mut out);
    Json(out).into_response()
}

#[derive(Deserialize)]
struct PathQ {
    path: String,
}

async fn get_file(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    Query(q): Query<PathQ>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let dir = match existing_project(&st, &who, &project) {
        Ok(d) => d,
        Err(r) => return r,
    };
    let Some(p) = safe_join(&dir, &q.path) else {
        return err(StatusCode::BAD_REQUEST, "bad path");
    };
    match tokio::fs::read(&p).await {
        Ok(b) => (
            [
                (header::CONTENT_TYPE, "application/octet-stream"),
                (header::CACHE_CONTROL, "no-store"),
            ],
            b,
        )
            .into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

/// The project's single writer: holder of a fresh lock, or nobody holds one.
fn writable(st: &AppState, who: &Who, project: &str) -> bool {
    let l = st.0.locks.lock().unwrap_or_else(|e| e.into_inner());
    match l.get(&(who.user.clone(), project.to_string())) {
        Some(lock) if lock.until > Instant::now() => lock.sid == who.sid,
        _ => true,
    }
}

async fn put_file(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    Query(q): Query<PathQ>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let dir = match existing_project(&st, &who, &project) {
        Ok(d) => d,
        Err(r) => return r,
    };
    if !writable(&st, &who, &project) {
        return err(
            StatusCode::LOCKED,
            "another session is editing this project",
        );
    }
    let Some(p) = safe_join(&dir, &q.path) else {
        return err(StatusCode::BAD_REQUEST, "bad path");
    };
    let limit = st.0.cfg.max_upload;
    let Ok(body) = axum::body::to_bytes(req.into_body(), limit).await else {
        return err(StatusCode::PAYLOAD_TOO_LARGE, "file too large");
    };
    let st2 = st.clone();
    let user = who.user.clone();
    let res = tokio::task::spawn_blocking(move || {
        if workspace_size(&st2.user_dir(&user)) + body.len() as u64 > st2.0.cfg.quota_bytes {
            return Err((
                StatusCode::INSUFFICIENT_STORAGE,
                "workspace quota used up".to_string(),
            ));
        }
        nord_core::io::write_atomic(&p, &body)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    })
    .await;
    match res {
        Ok(Ok(())) => {
            st.emit(
                &who.user,
                &project,
                json!({ "t": "file", "op": "put", "path": q.path, "by": who.sid }),
            );
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(Err((c, m))) => err(c, m),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "write failed"),
    }
}

async fn delete_file(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    Query(q): Query<PathQ>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let dir = match existing_project(&st, &who, &project) {
        Ok(d) => d,
        Err(r) => return r,
    };
    if !writable(&st, &who, &project) {
        return err(
            StatusCode::LOCKED,
            "another session is editing this project",
        );
    }
    let Some(p) = safe_join(&dir, &q.path) else {
        return err(StatusCode::BAD_REQUEST, "bad path");
    };
    if p.file_name()
        .is_some_and(|n| n == nord_core::io::PROJECT_FILE)
        && q.path == nord_core::io::PROJECT_FILE
    {
        return err(StatusCode::BAD_REQUEST, "delete the project instead");
    }
    let r = if p.is_dir() {
        std::fs::remove_dir_all(&p)
    } else {
        std::fs::remove_file(&p)
    };
    match r {
        Ok(()) => {
            st.emit(
                &who.user,
                &project,
                json!({ "t": "file", "op": "delete", "path": q.path, "by": who.sid }),
            );
            StatusCode::NO_CONTENT.into_response()
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

#[derive(Deserialize)]
struct Mv {
    from: String,
    to: String,
}

async fn rename(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let dir = match existing_project(&st, &who, &project) {
        Ok(d) => d,
        Err(r) => return r,
    };
    if !writable(&st, &who, &project) {
        return err(
            StatusCode::LOCKED,
            "another session is editing this project",
        );
    }
    let Ok(body) = axum::body::to_bytes(req.into_body(), 64 << 10).await else {
        return err(StatusCode::BAD_REQUEST, "bad body");
    };
    let Ok(m) = serde_json::from_slice::<Mv>(&body) else {
        return err(StatusCode::BAD_REQUEST, "expected {from, to}");
    };
    let (Some(a), Some(b)) = (safe_join(&dir, &m.from), safe_join(&dir, &m.to)) else {
        return err(StatusCode::BAD_REQUEST, "bad path");
    };
    if b.exists() {
        return err(StatusCode::CONFLICT, "target exists");
    }
    if let Some(parent) = b.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    match std::fs::rename(&a, &b) {
        Ok(()) => {
            st.emit(
                &who.user,
                &project,
                json!({ "t": "file", "op": "rename", "from": m.from, "to": m.to, "by": who.sid }),
            );
            StatusCode::NO_CONTENT.into_response()
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

const LOCK_TTL: Duration = Duration::from_secs(45);

async fn lock_status(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let l = st.0.locks.lock().unwrap_or_else(|e| e.into_inner());
    let held = l
        .get(&(who.user.clone(), project))
        .filter(|k| k.until > Instant::now());
    Json(json!({ "locked": held.is_some(), "mine": held.is_some_and(|k| k.sid == who.sid) }))
        .into_response()
}

/// Take (or refresh) the project's writer lock; clients call it again every ~15 s while editing.
async fn lock_acquire(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    if let Err(r) = existing_project(&st, &who, &project) {
        return r;
    }
    let mut l = st.0.locks.lock().unwrap_or_else(|e| e.into_inner());
    let key = (who.user.clone(), project);
    if l.get(&key)
        .is_some_and(|k| k.until > Instant::now() && k.sid != who.sid)
    {
        return err(
            StatusCode::LOCKED,
            "another session is editing this project",
        );
    }
    l.insert(
        key,
        Lock {
            sid: who.sid,
            until: Instant::now() + LOCK_TTL,
        },
    );
    Json(json!({ "ttl": LOCK_TTL.as_secs() })).into_response()
}

async fn lock_release(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let mut l = st.0.locks.lock().unwrap_or_else(|e| e.into_inner());
    let key = (who.user.clone(), project);
    if l.get(&key).is_some_and(|k| k.sid == who.sid) {
        l.remove(&key);
    }
    StatusCode::NO_CONTENT.into_response()
}

async fn events_sse(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let who = me(req.extensions());
    let rx = st.0.events.subscribe();
    let s = BroadcastStream::new(rx).filter_map(move |e| {
        let (user, project) = (who.user.clone(), project.clone());
        async move {
            let e = e.ok()?;
            (e.user == user && e.project == project)
                .then(|| Ok(Event::default().data(serde_json::to_string(&e).unwrap_or_default())))
        }
    });
    Sse::new(s).keep_alive(axum::response::sse::KeepAlive::default())
}

async fn download_zip(
    State(st): State<AppState>,
    UrlPath(project): UrlPath<String>,
    req: axum::extract::Request,
) -> Response {
    let who = me(req.extensions());
    let dir = match existing_project(&st, &who, &project) {
        Ok(d) => d,
        Err(r) => return r,
    };
    match tokio::task::spawn_blocking(move || zip_dir(&dir, &project)).await {
        Ok(Ok(bytes)) => (
            [(header::CONTENT_TYPE, "application/zip".to_string())],
            bytes,
        )
            .into_response(),
        _ => err(StatusCode::INTERNAL_SERVER_ERROR, "zip failed"),
    }
}

pub(crate) fn zip_dir(dir: &Path, top: &str) -> anyhow::Result<Vec<u8>> {
    use std::io::Write;
    fn walk(base: &Path, d: &Path, out: &mut Vec<(PathBuf, String)>) {
        let Ok(rd) = std::fs::read_dir(d) else { return };
        for e in rd.flatten() {
            let Ok(t) = e.file_type() else { continue };
            let name = e.file_name().to_string_lossy().into_owned();
            if t.is_symlink()
                || name == ".nord-cache"
                || name == ".git"
                || name == "dist"
                || name == ".nord"
            {
                continue;
            }
            if t.is_dir() {
                walk(base, &e.path(), out);
            } else if let Ok(r) = e.path().strip_prefix(base) {
                out.push((e.path(), r.to_string_lossy().replace('\\', "/")));
            }
        }
    }
    let mut files = vec![];
    walk(dir, dir, &mut files);
    let mut z = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let opt = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (p, r) in files {
        z.start_file(format!("{top}/{r}"), opt)?;
        z.write_all(&std::fs::read(p)?)?;
    }
    Ok(z.finish()?.into_inner())
}

// ---------- static web editor ----------

async fn static_files(State(st): State<AppState>, uri: Uri) -> Response {
    let Some(web) = &st.0.cfg.web else {
        return (
            StatusCode::NOT_FOUND,
            "this server has no web editor (start it with --web <dir>)",
        )
            .into_response();
    };
    let rel = uri.path().trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };
    let ok = rel
        .split('/')
        .all(|c| !c.is_empty() && c != ".." && c != "." && !c.contains(['\\', '\0']));
    if !ok {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let mut p = web.join(rel);
    if p.is_dir() {
        p = p.join("index.html");
    }
    match tokio::fs::read(&p).await {
        Ok(b) => {
            let mime = mime_guess::from_path(&p).first_or_octet_stream();
            let mut r =
                ([(header::CONTENT_TYPE, mime.to_string())], Bytes::from(b)).into_response();
            // the service worker and the shell must always be revalidated; the big wasm is cached by the worker
            r.headers_mut()
                .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
            r
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}
