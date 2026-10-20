//! Offline guarantee scanner: finds references to external http(s) hosts in text files of a build/project.
use crate::vfs::PathExt;
use std::path::Path;

/// Hosts that are fine (local dev, XML/SVG namespace URIs that are identifiers, not fetches).
pub const ALLOW_HOSTS: &[&str] = &[
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "www.w3.org",
    "w3.org",
    "purl.org",
    "schemas.xmlsoap.org",
    "ns.adobe.com",
    "www.khronos.org",
    "json-schema.org",
    "example.com",
    "example.org",
];
const TEXT_EXT: &[&str] = &[
    "html", "htm", "js", "mjs", "css", "json", "svg", "xml", "txt", "map",
];

#[derive(Debug, PartialEq)]
pub struct Finding {
    pub file: String,
    pub line: usize,
    pub url: String,
}

fn host_of(url: &str) -> &str {
    let rest = url.split("//").nth(1).unwrap_or("");
    rest.split(['/', ':', '?', '#', '"', '\'', ')', '`', '\\'])
        .next()
        .unwrap_or("")
}

/// Scan one text blob. `extra_allow` extends [`ALLOW_HOSTS`].
pub fn scan_text(file: &str, text: &str, extra_allow: &[String]) -> Vec<Finding> {
    let mut out = vec![];
    for (n, line) in text.lines().enumerate() {
        // Minified files: very long lines are fine, we just search substrings.
        let mut rest = line;
        while let Some(i) = ["https://", "http://"]
            .iter()
            .filter_map(|p| rest.find(p))
            .min()
        {
            let tail = &rest[i..];
            let end = tail
                .find(|c: char| c.is_whitespace() || "\"'`<>)".contains(c))
                .unwrap_or(tail.len());
            let url = &tail[..end];
            let host = host_of(url);
            let allowed = host.is_empty()
                || ALLOW_HOSTS.contains(&host)
                || extra_allow
                    .iter()
                    .any(|h| host == h || host.ends_with(&format!(".{h}")));
            if !allowed && !host.contains('{') && !host.contains('$') {
                out.push(Finding {
                    file: file.into(),
                    line: n + 1,
                    url: url.chars().take(120).collect(),
                });
            }
            rest = &tail[end.max(1)..];
        }
    }
    out
}

/// Recursively scan a directory. Allowlist file (`.offline-allow`, one host per line) at `dir` root is honoured.
pub fn scan_dir(dir: &Path, extra_allow: &[String]) -> Vec<Finding> {
    let mut allow = extra_allow.to_vec();
    if let Ok(s) = crate::vfs::read_to_string(dir.join(".offline-allow")) {
        allow.extend(
            s.lines()
                .map(str::trim)
                .filter(|l| !l.is_empty() && !l.starts_with('#'))
                .map(String::from),
        );
    }
    let mut out = vec![];
    fn go(base: &Path, d: &Path, allow: &[String], out: &mut Vec<Finding>) {
        let Ok(rd) = crate::vfs::read_dir(d) else {
            return;
        };
        let mut es: Vec<_> = rd.flatten().map(|e| e.path()).collect();
        es.sort();
        for p in es {
            let name = p.file_name().unwrap().to_string_lossy().into_owned();
            if p.v_is_dir() {
                if !matches!(
                    name.as_str(),
                    ".git" | "node_modules" | ".nord-cache" | "target"
                ) {
                    go(base, &p, allow, out);
                }
            } else if p
                .extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| TEXT_EXT.contains(&e.to_ascii_lowercase().as_str()))
            {
                if let Ok(t) = crate::vfs::read_to_string(&p) {
                    let rel = p
                        .strip_prefix(base)
                        .unwrap()
                        .to_string_lossy()
                        .replace('\\', "/");
                    out.extend(scan_text(&rel, &t, allow));
                }
            }
        }
    }
    go(dir, dir, &allow, &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_external_allows_local() {
        let t = "a <script src=\"https://cdn.jsdelivr.net/x.js\"></script>\n<svg xmlns=\"http://www.w3.org/2000/svg\"> fetch('http://localhost:3000/api')";
        let f = scan_text("i.html", t, &[]);
        assert_eq!(f.len(), 1);
        assert_eq!(
            (f[0].line, f[0].url.as_str()),
            (1, "https://cdn.jsdelivr.net/x.js")
        );
        assert!(scan_text("i.html", t, &["jsdelivr.net".into()]).is_empty());
    }
}
