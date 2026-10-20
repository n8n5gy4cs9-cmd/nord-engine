//! Server jobs (M11-11): export (runs the `nord` CLI as a child process: argv only, no shell, time limit, cancellable),
//! offline check and thumbnails (in-process, fast). Log lines are polled with `GET …/jobs/<id>/status?since=N` and also pushed
//! over the project's SSE stream.
use crate::{err, existing_project, me, AppState};
use axum::{
    extract::{Path as UrlPath, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    sync::Notify,
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Status {
    Running,
    Done,
    Failed,
    Cancelled,
}

impl Status {
    fn as_str(self) -> &'static str {
        match self {
            Status::Running => "running",
            Status::Done => "done",
            Status::Failed => "failed",
            Status::Cancelled => "cancelled",
        }
    }
}

pub(crate) struct Job {
    user: String,
    project: String,
    kind: String,
    status: Status,
    log: Vec<String>,
    /// zip produced by an export
    out: Option<PathBuf>,
    cancel: Arc<Notify>,
    finished: Option<Instant>,
}

type Shared = Arc<AppState>;

fn push(st: &AppState, id: &str, line: impl Into<String>) {
    let line = line.into();
    let (user, project) = {
        let mut j = st.0.jobs.lock().unwrap_or_else(|e| e.into_inner());
        let Some(job) = j.get_mut(id) else { return };
        if job.log.len() < 5000 {
            job.log.push(line.clone());
        }
        (job.user.clone(), job.project.clone())
    };
    st.emit(&user, &project, json!({ "t": "job-log", "job": id, "line": line }));
}

fn finish(st: &AppState, id: &str, status: Status, out: Option<PathBuf>) {
    let (user, project) = {
        let mut j = st.0.jobs.lock().unwrap_or_else(|e| e.into_inner());
        let Some(job) = j.get_mut(id) else { return };
        // a cancelled job stays cancelled even if the process reports a failure while dying
        if job.status == Status::Running {
            job.status = status;
        }
        job.out = out;
        job.finished = Some(Instant::now());
        (job.user.clone(), job.project.clone())
    };
    st.emit(&user, &project, json!({ "t": "job-done", "job": id, "status": status.as_str() }));
}

#[derive(Deserialize, Default)]
struct ExportOpts {
    target: Option<String>,
    #[serde(default)]
    minify: bool,
    #[serde(default)]
    single_file: bool,
    #[serde(default)]
    optimize: bool,
    #[serde(default)]
    pwa: bool,
    #[serde(default)]
    no_compile_events: bool,
}

/// `POST /api/p/<project>/jobs/<export|check-offline|thumbs>` (optional JSON body with export options).
pub(crate) async fn start(State(st): State<AppState>, UrlPath((project, kind)): UrlPath<(String, String)>, req: axum::extract::Request) -> Response {
    let who = me(req.extensions());
    let dir = match existing_project(&st, &who, &project) {
        Ok(d) => d,
        Err(r) => return r,
    };
    if !matches!(kind.as_str(), "export" | "check-offline" | "thumbs") {
        return err(StatusCode::NOT_FOUND, "unknown job kind (export | check-offline | thumbs)");
    }
    let body = axum::body::to_bytes(req.into_body(), 16 << 10).await.unwrap_or_default();
    let opts: ExportOpts = if body.is_empty() { ExportOpts::default() } else { serde_json::from_slice(&body).unwrap_or_default() };
    // Rust/WASM projects run cargo (arbitrary build scripts): opt-in only
    let rust_project = nord_core::io::load_project(&dir).is_ok_and(|p| matches!(p.kind, nord_core::ProjectType::WasmGame | nord_core::ProjectType::WasmApp));
    if kind == "export" && (rust_project || opts.target.as_deref().is_some_and(|t| t.contains("wasm"))) && !st.0.cfg.allow_rust_jobs {
        return err(StatusCode::FORBIDDEN, "Rust/WASM builds are disabled on this server (--allow-rust-jobs, container only)");
    }
    let id = crate::rand_hex(8);
    let jobdir = st.user_dir(&who.user).join(".jobs").join(&id);
    {
        let mut j = st.0.jobs.lock().unwrap_or_else(|e| e.into_inner());
        // forget finished jobs older than an hour (and their output)
        let old: Vec<String> = j.iter().filter(|(_, x)| x.finished.is_some_and(|t| t.elapsed() > Duration::from_secs(3600))).map(|(k, _)| k.clone()).collect();
        for k in old {
            if let Some(x) = j.remove(&k) {
                let _ = std::fs::remove_dir_all(st.user_dir(&x.user).join(".jobs").join(&k));
            }
        }
        let running = j.values().filter(|x| x.user == who.user && x.status == Status::Running).count();
        if running >= st.0.cfg.max_jobs_per_user {
            return err(StatusCode::TOO_MANY_REQUESTS, "too many jobs running; wait or cancel one");
        }
        j.insert(
            id.clone(),
            Job { user: who.user.clone(), project: project.clone(), kind: kind.clone(), status: Status::Running, log: vec![], out: None, cancel: Arc::new(Notify::new()), finished: None },
        );
    }
    let cancel = st.0.jobs.lock().map(|j| j[&id].cancel.clone()).unwrap_or_default();
    let st2: Shared = Arc::new(st.clone());
    let id2 = id.clone();
    tokio::spawn(async move {
        match kind.as_str() {
            "export" => run_export(&st2, &id2, dir, jobdir, opts, cancel).await,
            "check-offline" => {
                let r = tokio::task::spawn_blocking(move || nord_core::offline::scan_dir(&dir, &[])).await;
                match r {
                    Ok(f) if f.is_empty() => {
                        push(&st2, &id2, "offline check: no external URLs found");
                        finish(&st2, &id2, Status::Done, None);
                    }
                    Ok(f) => {
                        for x in &f {
                            push(&st2, &id2, format!("{}:{}  {}", x.file, x.line, x.url));
                        }
                        finish(&st2, &id2, Status::Failed, None);
                    }
                    Err(_) => finish(&st2, &id2, Status::Failed, None),
                }
            }
            _ => {
                let r = tokio::task::spawn_blocking(move || {
                    let a = nord_core::assets::scan(&dir).map_err(|e| e.to_string())?;
                    Ok::<_, String>(nord_core::thumbs::generate_all(&dir, &a))
                })
                .await;
                match r {
                    Ok(Ok((ok, skip, bad))) => {
                        push(&st2, &id2, format!("thumbnails: {ok} ready, {skip} without thumbnail, {} failed", bad.len()));
                        for b in bad {
                            push(&st2, &id2, b);
                        }
                        finish(&st2, &id2, Status::Done, None);
                    }
                    Ok(Err(e)) => {
                        push(&st2, &id2, e);
                        finish(&st2, &id2, Status::Failed, None);
                    }
                    Err(_) => finish(&st2, &id2, Status::Failed, None),
                }
            }
        }
    });
    (StatusCode::ACCEPTED, Json(json!({ "job": id }))).into_response()
}

fn nord_bin(st: &AppState) -> PathBuf {
    st.0.cfg.nord_bin.clone().unwrap_or_else(|| {
        std::env::current_exe()
            .ok()
            .and_then(|e| Some(e.parent()?.join(if cfg!(windows) { "nord.exe" } else { "nord" })))
            .filter(|p| p.exists())
            .unwrap_or_else(|| PathBuf::from("nord"))
    })
}

async fn run_export(st: &AppState, id: &str, dir: PathBuf, jobdir: PathBuf, o: ExportOpts, cancel: Arc<Notify>) {
    let _ = std::fs::create_dir_all(&jobdir);
    let site = jobdir.join("site");
    let mut cmd = tokio::process::Command::new(nord_bin(st));
    cmd.arg("build").arg(&dir).arg("--out").arg(&site).arg("--zip");
    if let Some(t) = &o.target {
        // only known target names reach argv
        if t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            cmd.arg("--target").arg(t);
        }
    }
    for (on, flag) in [(o.minify, "--minify"), (o.single_file, "--single-file"), (o.optimize, "--optimize"), (o.pwa, "--pwa"), (o.no_compile_events, "--no-compile-events")] {
        if on {
            cmd.arg(flag);
        }
    }
    cmd.env_clear()
        .env("PATH", std::env::var_os("PATH").unwrap_or_default())
        .env("HOME", &jobdir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    if let Some(e) = &st.0.cfg.engine {
        cmd.env("NORD_ROOT", e);
    }
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            push(st, id, format!("could not start `nord`: {e} (is the nord CLI installed next to the server or on PATH?)"));
            return finish(st, id, Status::Failed, None);
        }
    };
    let (Some(out), Some(errp)) = (child.stdout.take(), child.stderr.take()) else {
        return finish(st, id, Status::Failed, None);
    };
    let lines = Arc::new(Mutex::new(Vec::<String>::new()));
    for r in [Box::new(out) as Box<dyn tokio::io::AsyncRead + Unpin + Send>, Box::new(errp)] {
        let (st2, id2) = (st.clone(), id.to_string());
        let lines = lines.clone();
        tokio::spawn(async move {
            let mut l = BufReader::new(r).lines();
            while let Ok(Some(line)) = l.next_line().await {
                if let Ok(mut v) = lines.lock() {
                    v.push(line.clone());
                }
                push(&st2, &id2, line);
            }
        });
    }
    let limit = st.0.cfg.job_timeout;
    tokio::select! {
        r = child.wait() => {
            // give the readers a moment to drain the pipes
            tokio::time::sleep(Duration::from_millis(100)).await;
            match r {
                Ok(s) if s.success() => {
                    let zip = site.with_extension("zip");
                    if zip.is_file() {
                        finish(st, id, Status::Done, Some(zip));
                    } else {
                        push(st, id, "export finished but no zip was produced");
                        finish(st, id, Status::Failed, None);
                    }
                }
                _ => finish(st, id, Status::Failed, None),
            }
        }
        _ = cancel.notified() => {
            let _ = child.kill().await;
            push(st, id, "cancelled");
            finish(st, id, Status::Cancelled, None);
        }
        _ = tokio::time::sleep(limit) => {
            let _ = child.kill().await;
            push(st, id, format!("stopped: longer than the {} s limit", limit.as_secs()));
            finish(st, id, Status::Failed, None);
        }
    }
}

#[derive(Deserialize)]
pub(crate) struct Since {
    #[serde(default)]
    since: usize,
}

fn owned(st: &AppState, who: &crate::Who, project: &str, id: &str) -> Option<(Status, Vec<String>, Option<PathBuf>, String)> {
    let j = st.0.jobs.lock().ok()?;
    let job = j.get(id)?;
    (job.user == who.user && job.project == project).then(|| (job.status, job.log.clone(), job.out.clone(), job.kind.clone()))
}

pub(crate) async fn status(State(st): State<AppState>, UrlPath((project, id)): UrlPath<(String, String)>, Query(q): Query<Since>, req: axum::extract::Request) -> Response {
    let who = me(req.extensions());
    match owned(&st, &who, &project, &id) {
        Some((s, log, _, kind)) => {
            let lines: Vec<&String> = log.iter().skip(q.since).collect();
            Json(json!({ "status": s.as_str(), "kind": kind, "next": log.len(), "lines": lines, "download": s == Status::Done && kind == "export" })).into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

pub(crate) async fn cancel(State(st): State<AppState>, UrlPath((project, id)): UrlPath<(String, String)>, req: axum::extract::Request) -> Response {
    let who = me(req.extensions());
    if owned(&st, &who, &project, &id).is_none() {
        return StatusCode::NOT_FOUND.into_response();
    }
    if let Some(j) = st.0.jobs.lock().ok().and_then(|j| j.get(&id).map(|x| x.cancel.clone())) {
        j.notify_one();
    }
    StatusCode::ACCEPTED.into_response()
}

pub(crate) async fn download(State(st): State<AppState>, UrlPath((project, id)): UrlPath<(String, String)>, req: axum::extract::Request) -> Response {
    let who = me(req.extensions());
    let Some((_, _, Some(zip), _)) = owned(&st, &who, &project, &id) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match tokio::fs::read(&zip).await {
        Ok(b) => (
            [(header::CONTENT_TYPE, "application/zip".to_string()), (header::CONTENT_DISPOSITION, format!("attachment; filename=\"{project}.zip\""))],
            b,
        )
            .into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}
