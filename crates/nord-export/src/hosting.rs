//! Hosting presets (`nord build --host <name>`): extra files next to a finished web build so it can be deployed to a
//! static host or container without hand-written config. Pure file writing; the build itself is unchanged.
use anyhow::Result;
use std::{fs, path::Path};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Host {
    #[default]
    None,
    /// itch.io HTML5 upload: forces the `.zip`, adds `ITCH.md` with the `butler push` line.
    Itch,
    /// GitHub Pages: `.nojekyll`, `404.html`, a Pages deploy workflow.
    GithubPages,
    /// Netlify: `netlify.toml` + `_headers` (long cache for hashed libs, no cache for the page).
    Netlify,
    /// Vercel: `vercel.json`.
    Vercel,
    /// Container: `Dockerfile` + `nginx.conf` (static files behind nginx).
    Docker,
}

impl std::str::FromStr for Host {
    type Err = String;
    fn from_str(s: &str) -> std::result::Result<Self, String> {
        Ok(match s {
            "none" | "" => Self::None,
            "itch" => Self::Itch,
            "github-pages" => Self::GithubPages,
            "netlify" => Self::Netlify,
            "vercel" => Self::Vercel,
            "docker" => Self::Docker,
            _ => {
                return Err(format!(
                    "unknown host '{s}' (none, itch, github-pages, netlify, vercel, docker)"
                ))
            }
        })
    }
}

impl Host {
    pub const ALL: [Host; 6] = [
        Host::None,
        Host::Itch,
        Host::GithubPages,
        Host::Netlify,
        Host::Vercel,
        Host::Docker,
    ];
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Itch => "itch",
            Self::GithubPages => "github-pages",
            Self::Netlify => "netlify",
            Self::Vercel => "vercel",
            Self::Docker => "docker",
        }
    }
    /// Human label for menus.
    pub fn label(self) -> &'static str {
        match self {
            Self::None => "None (plain folder)",
            Self::Itch => "itch.io (HTML5 zip + butler line)",
            Self::GithubPages => "GitHub Pages (workflow + .nojekyll)",
            Self::Netlify => "Netlify (netlify.toml + _headers)",
            Self::Vercel => "Vercel (vercel.json)",
            Self::Docker => "Docker (Dockerfile + nginx.conf)",
        }
    }
}

/// Letters, digits, dash and underscore only: safe inside TOML/YAML/JSON/shell lines.
fn slug(s: &str) -> String {
    let v: String = s
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let v = v.trim_matches('-').to_string();
    if v.is_empty() {
        "game".into()
    } else {
        v
    }
}

fn put(out: &Path, rel: &str, text: &str) -> Result<()> {
    let p = out.join(rel);
    if let Some(d) = p.parent() {
        fs::create_dir_all(d)?;
    }
    fs::write(p, text)?;
    Ok(())
}

/// Write the preset files into the build folder `out`; returns a one-line note for the report.
pub fn write(out: &Path, name: &str, host: Host) -> Result<Option<String>> {
    let id = slug(name);
    let note = match host {
        Host::None => return Ok(None),
        Host::Itch => {
            put(out, "ITCH.md", &format!("# Upload to itch.io\n\n1. Upload `{id}.zip` (next to this folder) as an *HTML* project, tick \"This file will be played in the browser\".\n2. Or with butler: `butler push . YOUR_USER/{id}:html5`\n\nSet the viewport to the project's display size on the itch page.\n"))?;
            "itch: ITCH.md (zip is written next to the folder; upload it as an HTML project)"
        }
        Host::GithubPages => {
            put(out, ".nojekyll", "")?;
            let index = fs::read_to_string(out.join("index.html")).unwrap_or_default();
            put(out, "404.html", &index)?;
            put(out, ".github/workflows/pages.yml", "name: Deploy to GitHub Pages\non:\n  push:\n    branches: [main]\npermissions:\n  contents: read\n  pages: write\n  id-token: write\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment:\n      name: github-pages\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/configure-pages@v5\n      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: .\n      - uses: actions/deploy-pages@v4\n")?;
            "github-pages: .nojekyll, 404.html, .github/workflows/pages.yml (commit this folder as the repository root)"
        }
        Host::Netlify => {
            put(out, "netlify.toml", "[build]\n  publish = \".\"\n\n[[headers]]\n  for = \"/index.html\"\n  [headers.values]\n    Cache-Control = \"no-cache\"\n\n[[headers]]\n  for = \"/lib/*\"\n  [headers.values]\n    Cache-Control = \"public, max-age=31536000, immutable\"\n")?;
            put(out, "_headers", "/index.html\n  Cache-Control: no-cache\n/lib/*\n  Cache-Control: public, max-age=31536000, immutable\n")?;
            "netlify: netlify.toml + _headers (drag the folder onto netlify.com/drop)"
        }
        Host::Vercel => {
            put(out, "vercel.json", "{\n  \"cleanUrls\": true,\n  \"headers\": [\n    { \"source\": \"/index.html\", \"headers\": [{ \"key\": \"Cache-Control\", \"value\": \"no-cache\" }] },\n    { \"source\": \"/lib/(.*)\", \"headers\": [{ \"key\": \"Cache-Control\", \"value\": \"public, max-age=31536000, immutable\" }] }\n  ]\n}\n")?;
            "vercel: vercel.json (run `vercel --prod` inside the folder)"
        }
        Host::Docker => {
            put(out, "Dockerfile", "FROM nginx:alpine\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\nCOPY . /usr/share/nginx/html\nEXPOSE 80\n")?;
            put(out, "nginx.conf", "server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  gzip on;\n  gzip_types text/css application/javascript application/json application/wasm;\n  location = /index.html { add_header Cache-Control \"no-cache\"; }\n  location /lib/ { add_header Cache-Control \"public, max-age=31536000, immutable\"; }\n}\n")?;
            put(
                out,
                ".dockerignore",
                "Dockerfile\nnginx.conf\n.dockerignore\n",
            )?;
            "docker: Dockerfile + nginx.conf (`docker build -t game . && docker run -p 8080:80 game`)"
        }
    };
    Ok(Some(note.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(n: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("nord-host-{n}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("index.html"), "<html>x</html>").unwrap();
        d
    }

    #[test]
    fn every_preset_writes_its_files_and_none_writes_nothing() {
        for (h, file) in [
            (Host::Itch, "ITCH.md"),
            (Host::GithubPages, ".github/workflows/pages.yml"),
            (Host::GithubPages, "404.html"),
            (Host::Netlify, "netlify.toml"),
            (Host::Vercel, "vercel.json"),
            (Host::Docker, "Dockerfile"),
        ] {
            let d = tmp(h.as_str());
            assert!(write(&d, "My Game!", h).unwrap().is_some());
            assert!(d.join(file).exists(), "{h:?} should write {file}");
            let _ = fs::remove_dir_all(&d);
        }
        let d = tmp("none");
        assert!(write(&d, "x", Host::None).unwrap().is_none());
        assert_eq!(fs::read_dir(&d).unwrap().count(), 1);
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn names_are_slugged_before_they_reach_config_files() {
        let d = tmp("slug");
        write(&d, "A \"b\"\nc; rm -rf /", Host::Itch).unwrap();
        let t = fs::read_to_string(d.join("ITCH.md")).unwrap();
        assert!(t.contains("a--b--c--rm--rf") && !t.contains("rm -rf"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn parse_round_trips() {
        for h in Host::ALL {
            assert_eq!(h.as_str().parse::<Host>().unwrap(), h);
        }
        assert!("ftp".parse::<Host>().is_err());
    }
}
