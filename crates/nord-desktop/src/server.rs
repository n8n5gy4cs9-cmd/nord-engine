//! Local static web server for desktop apps (`server.*` in the bridge): directory listing, SPA fallback, CORS, Range, ETag/304,
//! live reload (SSE + injected script), request log. std-only HTTP/1.1 (thread per connection, bounded); binds 127.0.0.1 unless `lan`.
use crate::{DesktopError, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    io::{BufRead, BufReader, Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering::Relaxed},
        Arc, Mutex,
    },
    time::{Duration, Instant, UNIX_EPOCH},
};

#[derive(Debug, Clone, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Options {
    pub port: u16,
    pub cors: bool,
    /// unknown paths without a file extension serve `/index.html` (single-page apps)
    pub spa: bool,
    pub listing: bool,
    pub live_reload: bool,
    /// bind 0.0.0.0 (reachable from the network) instead of loopback
    pub lan: bool,
    pub cache: bool,
}
impl Default for Options {
    fn default() -> Self {
        Self {
            port: 0,
            cors: false,
            spa: false,
            listing: true,
            live_reload: true,
            lan: false,
            cache: false,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub seq: u64,
    pub ts: u64,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub bytes: u64,
    pub ms: u64,
    pub ip: String,
}

pub struct Server {
    pub port: u16,
    pub root: PathBuf,
    pub opts: Options,
    stop: Arc<AtomicBool>,
    log: Arc<Mutex<VecDeque<LogEntry>>>,
    seq: Arc<AtomicU64>,
    pub requests: Arc<AtomicU64>,
}

struct Ctx {
    root: PathBuf,
    opts: Options,
    log: Arc<Mutex<VecDeque<LogEntry>>>,
    seq: Arc<AtomicU64>,
    version: Arc<AtomicU64>,
    stop: Arc<AtomicBool>,
    active: Arc<AtomicUsize>,
    requests: Arc<AtomicU64>,
}

const RELOAD_JS: &str = "<script>(()=>{const e=new EventSource('/__nord_reload');e.onmessage=()=>location.reload();})();</script>";

impl Server {
    pub fn start(root: PathBuf, opts: Options) -> Result<Server> {
        if !root.is_dir() {
            return Err(DesktopError::invalid("server root must be a folder"));
        }
        let l = TcpListener::bind((if opts.lan { "0.0.0.0" } else { "127.0.0.1" }, opts.port))
            .map_err(|e| {
                DesktopError::new("io", format!("cannot listen on port {}: {e}", opts.port))
            })?;
        let port = l.local_addr()?.port();
        let stop = Arc::new(AtomicBool::new(false));
        let ctx = Arc::new(Ctx {
            root: root.canonicalize()?,
            opts: opts.clone(),
            log: Arc::default(),
            seq: Arc::default(),
            version: Arc::default(),
            stop: stop.clone(),
            active: Arc::default(),
            requests: Arc::default(),
        });
        // change watcher for live reload: snapshot diff twice a second (also bumps on startup so late joiners reload once)
        if opts.live_reload {
            let c = ctx.clone();
            std::thread::spawn(move || {
                let mut prev = crate::fs::snapshot(&c.root, true);
                while !c.stop.load(Relaxed) {
                    std::thread::sleep(Duration::from_millis(400));
                    let now = crate::fs::snapshot(&c.root, true);
                    if now != prev {
                        c.version.fetch_add(1, Relaxed);
                        prev = now;
                    }
                }
            });
        }
        let srv = Server {
            port,
            root: ctx.root.clone(),
            opts,
            stop: stop.clone(),
            log: ctx.log.clone(),
            seq: ctx.seq.clone(),
            requests: ctx.requests.clone(),
        };
        std::thread::spawn(move || {
            for s in l.incoming() {
                if ctx.stop.load(Relaxed) {
                    break;
                }
                let Ok(s) = s else { continue };
                if ctx.active.load(Relaxed) >= 64 {
                    continue; // drop: simple overload protection
                }
                let c = ctx.clone();
                c.active.fetch_add(1, Relaxed);
                std::thread::spawn(move || {
                    let _ = handle(s, &c);
                    c.active.fetch_sub(1, Relaxed);
                });
            }
        });
        Ok(srv)
    }
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/", self.port)
    }
    pub fn stop(&self) {
        self.stop.store(true, Relaxed);
        let _ = TcpStream::connect(("127.0.0.1", self.port)); // wake accept()
    }
    /// entries with seq > `since`
    pub fn logs(&self, since: u64) -> (Vec<LogEntry>, u64) {
        let l = self.log.lock().unwrap_or_else(|e| e.into_inner());
        (
            l.iter().filter(|e| e.seq > since).cloned().collect(),
            self.seq.load(Relaxed),
        )
    }
}
impl Drop for Server {
    fn drop(&mut self) {
        self.stop();
    }
}

fn decode(s: &str) -> String {
    let b = s.as_bytes();
    let (mut o, mut i) = (Vec::with_capacity(b.len()), 0);
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(h) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                o.push(h);
                i += 3;
                continue;
            }
        }
        o.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&o).into_owned()
}
fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

struct Resp {
    status: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}
fn reason(c: u16) -> &'static str {
    match c {
        200 => "OK",
        204 => "No Content",
        206 => "Partial Content",
        304 => "Not Modified",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        416 => "Range Not Satisfiable",
        _ => "Error",
    }
}
fn page(status: u16, title: &str, body: &str) -> Resp {
    let html = format!("<!doctype html><meta charset=utf-8><title>{t}</title><style>body{{font:15px system-ui;background:#1e222a;color:#d8dee9;margin:2rem auto;max-width:56rem;padding:0 1rem}}a{{color:#88c0d0;text-decoration:none}}a:hover{{text-decoration:underline}}td{{padding:.25rem .8rem .25rem 0}}td.r{{text-align:right;color:#8a93a5}}h1{{font-size:1.2rem}}</style><h1>{t}</h1>{b}", t = esc(title), b = body);
    Resp {
        status,
        headers: vec![("Content-Type".into(), "text/html; charset=utf-8".into())],
        body: html.into_bytes(),
    }
}
fn human(n: u64) -> String {
    if n < 1024 {
        format!("{n} B")
    } else if n < 1 << 20 {
        format!("{:.1} KB", n as f64 / 1024.0)
    } else {
        format!("{:.1} MB", n as f64 / 1048576.0)
    }
}

fn listing(dir: &Path, url_path: &str) -> Resp {
    let mut rows: Vec<(bool, String, u64)> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|e| {
            e.metadata().ok().map(|m| {
                (
                    m.is_dir(),
                    e.file_name().to_string_lossy().into_owned(),
                    m.len(),
                )
            })
        })
        .collect();
    rows.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then(a.1.to_lowercase().cmp(&b.1.to_lowercase()))
    });
    let mut t = String::from("<table>");
    if url_path != "/" {
        t.push_str("<tr><td><a href=\"../\">../</a></td><td></td></tr>");
    }
    for (d, n, sz) in rows {
        let href: String = n
            .bytes()
            .map(|b| {
                if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
                    (b as char).to_string()
                } else {
                    format!("%{b:02X}")
                }
            })
            .collect();
        t.push_str(&format!(
            "<tr><td><a href=\"{}{}\">{}{}</a></td><td class=r>{}</td></tr>",
            href,
            if d { "/" } else { "" },
            esc(&n),
            if d { "/" } else { "" },
            if d { String::new() } else { human(sz) }
        ));
    }
    t.push_str("</table>");
    page(200, &format!("Index of {url_path}"), &t)
}

fn route(method: &str, raw_path: &str, headers: &[(String, String)], c: &Ctx) -> Resp {
    let h = |k: &str| {
        headers
            .iter()
            .find(|(n, _)| n.eq_ignore_ascii_case(k))
            .map(|(_, v)| v.as_str())
    };
    let mut r = route_inner(method, raw_path, h, c);
    if c.opts.cors {
        r.headers
            .push(("Access-Control-Allow-Origin".into(), "*".into()));
        r.headers.push((
            "Access-Control-Allow-Methods".into(),
            "GET, HEAD, OPTIONS".into(),
        ));
        r.headers
            .push(("Access-Control-Allow-Headers".into(), "*".into()));
    }
    if !c.opts.cache {
        r.headers.push(("Cache-Control".into(), "no-store".into()));
    }
    r
}

fn route_inner<'a>(
    method: &str,
    raw_path: &str,
    h: impl Fn(&str) -> Option<&'a str>,
    c: &Ctx,
) -> Resp {
    if method == "OPTIONS" {
        return Resp {
            status: 204,
            headers: vec![],
            body: vec![],
        };
    }
    if method != "GET" && method != "HEAD" {
        return page(405, "405 Method Not Allowed", "");
    }
    let url_path = raw_path.split(['?', '#']).next().unwrap_or("/");
    let rel = decode(url_path);
    if rel.contains('\0') || rel.split(['/', '\\']).any(|p| p == "..") {
        return page(403, "403 Forbidden", "");
    }
    let mut file = c.root.join(rel.trim_start_matches('/'));
    // symlink-safe containment
    let inside = |p: &Path| {
        p.canonicalize()
            .map(|x| x.starts_with(&c.root))
            .unwrap_or(false)
    };
    if !inside(&file) && file.exists() {
        return page(403, "403 Forbidden", "");
    }
    if file.is_dir() {
        if !url_path.ends_with('/') {
            return Resp {
                status: 301,
                headers: vec![("Location".into(), format!("{url_path}/"))],
                body: vec![],
            };
        }
        let idx = file.join("index.html");
        if idx.is_file() && inside(&idx) {
            file = idx;
        } else if c.opts.listing {
            return listing(&file, url_path);
        } else {
            return page(403, "403 Directory listing disabled", "");
        }
    } else if !file.is_file() {
        let ext = Path::new(&rel).extension().is_some();
        let idx = c.root.join("index.html");
        if c.opts.spa && !ext && idx.is_file() {
            file = idx;
        } else {
            let nf = c.root.join("404.html");
            if nf.is_file() {
                let mut r = Resp {
                    status: 404,
                    headers: vec![("Content-Type".into(), "text/html; charset=utf-8".into())],
                    body: std::fs::read(nf).unwrap_or_default(),
                };
                inject(&mut r, c);
                return r;
            }
            return page(404, "404 Not Found", &format!("<p>{}</p>", esc(url_path)));
        }
    }
    let Ok(meta) = std::fs::metadata(&file) else {
        return page(404, "404 Not Found", "");
    };
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_secs());
    let etag = format!("\"{:x}-{:x}\"", meta.len(), mtime);
    let mime = mime_guess::from_path(&file)
        .first_or_octet_stream()
        .to_string();
    let ctype = if mime.starts_with("text/") || mime.contains("javascript") || mime.contains("json")
    {
        format!("{mime}; charset=utf-8")
    } else {
        mime.clone()
    };
    let mut headers = vec![
        ("Content-Type".to_string(), ctype),
        ("ETag".into(), etag.clone()),
        ("Accept-Ranges".into(), "bytes".into()),
    ];
    if c.opts.cache && h("if-none-match") == Some(etag.as_str()) {
        return Resp {
            status: 304,
            headers,
            body: vec![],
        };
    }
    let is_html = mime == "text/html";
    let Ok(mut data) = std::fs::read(&file) else {
        return page(403, "403 Forbidden", "");
    };
    let total = data.len() as u64;
    if let (Some(rg), false) = (h("range").and_then(|r| r.strip_prefix("bytes=")), is_html) {
        let (a, b) = rg.split_once('-').unwrap_or(("", ""));
        let (s, e) = match (a.parse::<u64>(), b.parse::<u64>()) {
            (Ok(s), Ok(e)) => (s, e.min(total.saturating_sub(1))),
            (Ok(s), Err(_)) => (s, total.saturating_sub(1)),
            (Err(_), Ok(n)) => (total.saturating_sub(n), total.saturating_sub(1)), // suffix range
            _ => (0, total.saturating_sub(1)),
        };
        if s > e || s >= total {
            return Resp {
                status: 416,
                headers: vec![("Content-Range".into(), format!("bytes */{total}"))],
                body: vec![],
            };
        }
        headers.push(("Content-Range".into(), format!("bytes {s}-{e}/{total}")));
        return Resp {
            status: 206,
            headers,
            body: data[s as usize..=e as usize].to_vec(),
        };
    }
    let mut r = Resp {
        status: 200,
        headers: std::mem::take(&mut headers),
        body: std::mem::take(&mut data),
    };
    if is_html {
        inject(&mut r, c);
    }
    r
}

fn inject(r: &mut Resp, c: &Ctx) {
    if !c.opts.live_reload {
        return;
    }
    let s = String::from_utf8_lossy(&r.body).into_owned();
    let out = match s.to_ascii_lowercase().rfind("</body>") {
        Some(i) => format!("{}{}{}", &s[..i], RELOAD_JS, &s[i..]),
        None => format!("{s}{RELOAD_JS}"),
    };
    r.body = out.into_bytes();
}

fn handle(mut s: TcpStream, c: &Ctx) -> std::io::Result<()> {
    s.set_read_timeout(Some(Duration::from_secs(10)))?;
    let ip = s
        .peer_addr()
        .map(|a| a.ip().to_string())
        .unwrap_or_default();
    let mut rd = BufReader::new(s.try_clone()?);
    let mut line = String::new();
    if rd.by_ref().take(8192).read_line(&mut line)? == 0 {
        return Ok(());
    }
    let mut it = line.split_whitespace();
    let (method, path) = (
        it.next().unwrap_or("").to_string(),
        it.next().unwrap_or("/").to_string(),
    );
    let mut headers = vec![];
    loop {
        let mut l = String::new();
        if rd.by_ref().take(8192).read_line(&mut l)? == 0
            || l.trim().is_empty()
            || headers.len() > 64
        {
            break;
        }
        if let Some((k, v)) = l.split_once(':') {
            headers.push((k.trim().to_string(), v.trim().to_string()));
        }
    }
    let t0 = Instant::now();
    c.requests.fetch_add(1, Relaxed);
    if path.split('?').next() == Some("/__nord_reload") && c.opts.live_reload {
        // server-sent events: one message per change
        s.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nConnection: keep-alive\r\n\r\n: ok\n\n")?;
        let v0 = c.version.load(Relaxed);
        while !c.stop.load(Relaxed) {
            std::thread::sleep(Duration::from_millis(250));
            if c.version.load(Relaxed) != v0 {
                s.write_all(b"data: reload\n\n")?;
                break;
            }
            s.write_all(b": ping\n\n")?;
        }
        return Ok(());
    }
    let r = route(&method, &path, &headers, c);
    let head = format!(
        "HTTP/1.1 {} {}\r\nContent-Length: {}\r\nConnection: close\r\n{}\r\n",
        r.status,
        reason(r.status),
        r.body.len(),
        r.headers
            .iter()
            .map(|(k, v)| format!("{k}: {v}\r\n"))
            .collect::<String>()
    );
    s.write_all(head.as_bytes())?;
    if method != "HEAD" {
        s.write_all(&r.body)?;
    }
    let e = LogEntry {
        seq: c.seq.fetch_add(1, Relaxed) + 1,
        ts: std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_millis() as u64),
        method,
        path: path.chars().take(300).collect(),
        status: r.status,
        bytes: r.body.len() as u64,
        ms: t0.elapsed().as_millis() as u64,
        ip,
    };
    let mut l = c.log.lock().unwrap_or_else(|e| e.into_inner());
    if l.len() >= 500 {
        l.pop_front();
    }
    l.push_back(e);
    let _ = s.shutdown(Shutdown::Both);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get(port: u16, req: &str) -> (u16, String, String) {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.write_all(format!("{req}\r\nConnection: close\r\n\r\n").as_bytes())
            .unwrap();
        let mut b = Vec::new();
        s.read_to_end(&mut b).unwrap();
        let t = String::from_utf8_lossy(&b).into_owned();
        let (h, body) = t.split_once("\r\n\r\n").unwrap_or((&t, ""));
        (
            h.split_whitespace().nth(1).unwrap().parse().unwrap(),
            h.to_string(),
            body.to_string(),
        )
    }
    fn site() -> (tempfile::TempDir, PathBuf) {
        let d = tempfile::tempdir().unwrap();
        let r = d.path().join("site");
        std::fs::create_dir_all(r.join("sub")).unwrap();
        std::fs::write(r.join("index.html"), "<html><body>hi</body></html>").unwrap();
        std::fs::write(r.join("sub/a b.txt"), "0123456789").unwrap();
        std::fs::write(r.join("data.json"), "{}").unwrap();
        std::fs::write(d.path().join("secret.txt"), "s").unwrap();
        (d, r)
    }

    #[test]
    fn serves_files_index_listing_and_404() {
        let (_d, r) = site();
        let s = Server::start(r.clone(), Options::default()).unwrap();
        let (st, h, b) = get(s.port, "GET / HTTP/1.1");
        assert_eq!(st, 200);
        assert!(
            h.contains("text/html") && b.contains("hi") && b.contains("EventSource"),
            "live reload injected"
        );
        let (_, h, b) = get(s.port, "GET /sub HTTP/1.1");
        assert!(h.starts_with("HTTP/1.1 301") && !b.contains("a b"));
        let (st, _, b) = get(s.port, "GET /sub/ HTTP/1.1");
        assert!(
            st == 200 && b.contains("a%20b.txt") && b.contains("../"),
            "listing"
        );
        let (st, h, b) = get(s.port, "GET /sub/a%20b.txt HTTP/1.1");
        assert!(st == 200 && b == "0123456789" && h.contains("text/plain"));
        assert_eq!(get(s.port, "GET /nope HTTP/1.1").0, 404);
        assert_eq!(get(s.port, "POST / HTTP/1.1").0, 405);
        assert!(get(s.port, "HEAD /data.json HTTP/1.1").2.is_empty());
        let l = s.logs(0).0;
        assert!(l.len() >= 6 && l[0].path == "/" && l[0].status == 200);
        assert_eq!(s.logs(l.len() as u64).0.len(), 0);
    }
    #[test]
    fn blocks_traversal_and_symlinks() {
        let (d, r) = site();
        let s = Server::start(r.clone(), Options::default()).unwrap();
        for p in [
            "/../secret.txt",
            "/%2e%2e/secret.txt",
            "/sub/..%2f..%2fsecret.txt",
            "/..%5csecret.txt",
            "/%00",
        ] {
            let (st, _, b) = get(s.port, &format!("GET {p} HTTP/1.1"));
            assert!(st == 403 || st == 404, "{p} -> {st}");
            assert!(!b.contains('s') || !b.starts_with('s'));
        }
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(d.path().join("secret.txt"), r.join("link.txt")).unwrap();
            assert_eq!(get(s.port, "GET /link.txt HTTP/1.1").0, 403);
        }
        let _ = d;
    }
    #[test]
    fn range_cache_cors_spa() {
        let (_d, r) = site();
        let s = Server::start(
            r.clone(),
            Options {
                cors: true,
                spa: true,
                cache: true,
                ..Options::default()
            },
        )
        .unwrap();
        let (st, h, b) = get(s.port, "GET /sub/a%20b.txt HTTP/1.1\r\nRange: bytes=2-4");
        assert!(st == 206 && b == "234" && h.contains("Content-Range: bytes 2-4/10"));
        assert_eq!(
            get(s.port, "GET /sub/a%20b.txt HTTP/1.1\r\nRange: bytes=-3").2,
            "789"
        );
        assert_eq!(
            get(s.port, "GET /sub/a%20b.txt HTTP/1.1\r\nRange: bytes=50-").0,
            416
        );
        let (_, h, _) = get(s.port, "GET /data.json HTTP/1.1");
        let etag = h
            .lines()
            .find(|l| l.starts_with("ETag"))
            .unwrap()
            .split_once(": ")
            .unwrap()
            .1
            .to_string();
        assert!(h.contains("Access-Control-Allow-Origin: *"));
        assert_eq!(
            get(
                s.port,
                &format!("GET /data.json HTTP/1.1\r\nIf-None-Match: {etag}")
            )
            .0,
            304
        );
        assert_eq!(get(s.port, "OPTIONS /x HTTP/1.1").0, 204);
        assert!(
            get(s.port, "GET /app/route HTTP/1.1").2.contains("hi"),
            "spa fallback"
        );
        assert_eq!(
            get(s.port, "GET /missing.js HTTP/1.1").0,
            404,
            "assets do not fall back"
        );
    }
    #[test]
    fn live_reload_event_and_stop() {
        let (_d, r) = site();
        let s = Server::start(r.clone(), Options::default()).unwrap();
        let mut c = TcpStream::connect(("127.0.0.1", s.port)).unwrap();
        c.write_all(b"GET /__nord_reload HTTP/1.1\r\n\r\n").unwrap();
        c.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        std::thread::sleep(Duration::from_millis(700));
        std::fs::write(r.join("data.json"), "{\"x\":1}").unwrap();
        let mut got = String::new();
        let mut buf = [0u8; 256];
        while !got.contains("data: reload") {
            let n = c.read(&mut buf).unwrap();
            assert!(n > 0, "closed before reload: {got}");
            got.push_str(&String::from_utf8_lossy(&buf[..n]));
        }
        s.stop();
        std::thread::sleep(Duration::from_millis(100));
        assert!(TcpStream::connect(("127.0.0.1", s.port))
            .map(|mut c| {
                let _ = c.write_all(b"GET / HTTP/1.1\r\n\r\n");
                let mut b = String::new();
                c.set_read_timeout(Some(Duration::from_millis(500))).ok();
                c.read_to_string(&mut b).unwrap_or(0) == 0
            })
            .unwrap_or(true));
    }
    #[test]
    fn listing_can_be_disabled_and_port_conflicts_error() {
        let (_d, r) = site();
        let s = Server::start(
            r.clone(),
            Options {
                listing: false,
                ..Options::default()
            },
        )
        .unwrap();
        assert_eq!(get(s.port, "GET /sub/ HTTP/1.1").0, 403);
        assert!(Server::start(
            r,
            Options {
                port: s.port,
                ..Options::default()
            }
        )
        .is_err());
    }
}
