//! Pure parts of the player (no window): locating the game folder, reading `nord.json`, serving files for the
//! `nord://game/` protocol. Unit-tested on any OS; the window itself lives in `main.rs` behind the `shell` feature.
use std::path::{Path, PathBuf};

/// Wry maps `nord://game/` to `http://nord.game/` on Windows WebView2.
pub fn is_game_navigation(url: &str) -> bool {
    url.starts_with("nord://game/")
        || url.starts_with("about:")
        || ["http://nord.game", "https://nord.game"]
            .iter()
            .any(|origin| {
                url == *origin || url.strip_prefix(origin).is_some_and(|s| s.starts_with('/'))
            })
}

#[derive(Debug, PartialEq)]
pub struct Manifest {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub id: String,
    pub version: String,
    /// `desktop` object of nord.json (`permissions`, `singleInstance`, `schemes`, `menu`, `tray`, …); `Null` for plain games
    pub desktop: serde_json::Value,
}

/// Where the game files are: `$NORD_GAME_DIR`, the first CLI argument, `<exe>/../Resources/game` (inside an .app), or `<exe dir>/game`.
pub fn find_game_dir(arg: Option<&str>) -> Option<PathBuf> {
    let ok = |p: &Path| p.join("index.html").exists();
    let mut c: Vec<PathBuf> = vec![];
    if let Ok(d) = std::env::var("NORD_GAME_DIR") {
        c.push(d.into());
    }
    if let Some(a) = arg {
        c.push(a.into());
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            c.push(dir.join("../Resources/game"));
            c.push(dir.join("game"));
        }
    }
    c.into_iter().find(|p| ok(p))
}

pub fn read_manifest(game: &Path) -> Manifest {
    let v: serde_json::Value = std::fs::read(game.join("nord.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    let n = |k: &str, d: u32| v["display"][k].as_u64().map_or(d, |x| x as u32);
    Manifest {
        name: v["name"].as_str().unwrap_or("Nord Game").to_string(),
        width: n("width", 1280).clamp(320, 7680),
        height: n("height", 720).clamp(200, 4320),
        id: v["id"].as_str().unwrap_or("nord-game").to_string(),
        version: v["version"]
            .as_str()
            .or(v["engine"].as_str())
            .unwrap_or("")
            .to_string(),
        desktop: v["desktop"].clone(),
    }
}

/// Resolve a request path (`/index.html`, `/assets/a.png?x=1`) to (bytes, mime). Never leaves the game folder.
pub fn serve(game: &Path, uri_path: &str) -> Option<(Vec<u8>, String)> {
    let p = uri_path.split(['?', '#']).next().unwrap_or("");
    let p = p.trim_start_matches('/');
    let p = if p.is_empty() { "index.html" } else { p };
    let decoded = decode(p);
    if decoded.split(['/', '\\']).any(|c| c == "..") {
        return None;
    }
    let f = game.join(&decoded);
    let bytes = std::fs::read(&f).ok()?;
    let mime = mime_guess::from_path(&f)
        .first_or_octet_stream()
        .to_string();
    Some((bytes, mime))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn navigation_accepts_webview2_game_origin_only() {
        for url in [
            "nord://game/index.html",
            "http://nord.game/index.html",
            "https://nord.game/page.html",
            "about:blank",
        ] {
            assert!(is_game_navigation(url), "{url}");
        }
        for url in [
            "http://nord.game.evil/index.html",
            "http://nord.game@evil/index.html",
            "https://example.com/",
            "nord://other/index.html",
        ] {
            assert!(!is_game_navigation(url), "{url}");
        }
    }

    fn game() -> PathBuf {
        static N: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let d = std::env::temp_dir().join(format!(
            "nord-player-{}-{}",
            std::process::id(),
            N.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("assets")).unwrap();
        std::fs::write(d.join("index.html"), "<html>").unwrap();
        std::fs::write(d.join("assets/a b.png"), [1, 2, 3]).unwrap();
        std::fs::write(
            d.join("nord.json"),
            r#"{"name":"Demo","display":{"width":640,"height":360}}"#,
        )
        .unwrap();
        d
    }

    #[test]
    fn serves_files_and_blocks_traversal() {
        let g = game();
        assert_eq!(serve(&g, "/").unwrap().1, "text/html");
        assert_eq!(serve(&g, "/assets/a%20b.png?v=1").unwrap().0, vec![1, 2, 3]);
        assert!(serve(&g, "/../secret").is_none());
        assert!(serve(&g, "/%2e%2e/secret").is_none());
        assert!(serve(&g, "/nope.js").is_none());
    }

    #[test]
    fn manifest_defaults_and_values() {
        let g = game();
        assert_eq!(
            read_manifest(&g),
            Manifest {
                name: "Demo".into(),
                width: 640,
                height: 360,
                id: "nord-game".into(),
                version: String::new(),
                desktop: serde_json::Value::Null,
            }
        );
        assert_eq!(read_manifest(&g.join("assets")).name, "Nord Game");
        assert_eq!(find_game_dir(Some(g.to_str().unwrap())), Some(g));
    }
}
