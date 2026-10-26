//! `nord build`: turn a project into a static, offline web build (see docs/EXPORT_TARGETS.md).
//!
//! Pipeline: validate → stage (project files + runtime + vendored libs + generated index.html) → optimise (optional)
//! → minify | single-file bundle (Node + vendored esbuild-wasm, optional) → nord.json manifest → offline check → zip.
pub mod addon;
pub mod bundle;
pub mod localbuild;
pub mod mac;
pub mod portable;
pub mod rust;
pub mod templates;

use anyhow::{bail, Context, Result};
use base64::Engine as _;
use nord_core::vfs::{self as fs, PathExt};
use nord_core::{assets, io, offline, validate, ProjectType};
use std::{
    path::{Path, PathBuf},
    process::Command,
};

pub mod hosting;
pub use hosting::Host;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Target {
    /// Pick from the project type.
    Auto,
    /// Copy the project folder as-is (your own HTML/JS).
    Html,
    Web2d,
    Web3d,
    /// 3D with the optional PlayCanvas engine (no physics yet)
    Web3dPc,
    /// Rust game (macroquad runtime) → `game.wasm` + JS loader
    WasmGame,
    /// Rust egui/eframe app → wasm-bindgen output
    WasmApp,
}

impl std::str::FromStr for Target {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, String> {
        Ok(match s {
            "auto" => Self::Auto,
            "html" => Self::Html,
            "web-2d" => Self::Web2d,
            "web-3d" => Self::Web3d,
            "web-3d-pc" => Self::Web3dPc,
            "web-wasm-game" => Self::WasmGame,
            "web-wasm-app" => Self::WasmApp,
            _ => {
                return Err(format!(
                    "unknown target '{s}' (auto, html, web-2d, web-3d, web-3d-pc, web-wasm-game, web-wasm-app)"
                ))
            }
        })
    }
}

impl Target {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Html => "html",
            Self::Web2d => "web-2d",
            Self::Web3d => "web-3d",
            Self::Web3dPc => "web-3d-pc",
            Self::WasmGame => "web-wasm-game",
            Self::WasmApp => "web-wasm-app",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Opts {
    pub target: Target,
    /// Output folder (default `<project>/dist`).
    pub out: Option<PathBuf>,
    pub minify: bool,
    /// One `index.html` with everything inlined (works from `file://`).
    pub single_file: bool,
    /// Lossless PNG recompression + optional wav→mp3 via ffmpeg.
    pub optimize: bool,
    /// Also write `<out>.zip`.
    pub zip: bool,
    /// Installable offline web app: `manifest.webmanifest` + `sw.js` (precache, cache-first) + registration in index.html.
    pub pwa: bool,
    /// Hosting preset: extra deploy files for itch.io / GitHub Pages / Netlify / Vercel / Docker (see `hosting.rs`).
    pub host: Host,
    /// Compile event sheets to JavaScript in the build output (needs Node; skipped with a note when unavailable). On by default.
    pub compile_events: bool,
}

impl Default for Opts {
    fn default() -> Self {
        Self {
            target: Target::Auto,
            out: None,
            minify: false,
            single_file: false,
            optimize: false,
            zip: false,
            pwa: false,
            host: Host::None,
            compile_events: true,
        }
    }
}

#[derive(Debug)]
pub struct Report {
    pub target: Target,
    pub out: PathBuf,
    /// (relative path, bytes), largest first
    pub files: Vec<(String, u64)>,
    pub zip: Option<PathBuf>,
    pub notes: Vec<String>,
}

impl Report {
    pub fn total(&self) -> u64 {
        self.files.iter().map(|f| f.1).sum()
    }
    /// Bytes per top-level area: `assets`, `runtime`, `vendor`, `scenes`, … (sorted by size).
    pub fn by_area(&self) -> Vec<(String, u64)> {
        let mut m = std::collections::BTreeMap::<String, u64>::new();
        for (p, n) in &self.files {
            let k = p
                .split('/')
                .next()
                .filter(|_| p.contains('/'))
                .unwrap_or("(root)");
            *m.entry(k.to_string()).or_default() += n;
        }
        let mut v: Vec<_> = m.into_iter().collect();
        v.sort_by_key(|a| std::cmp::Reverse(a.1));
        v
    }
    pub fn summary(&self) -> String {
        let kb = |n: u64| format!("{:.1} KB", n as f64 / 1024.0);
        let mut s = format!(
            "Built {} → {}\n{} files, {} total\n",
            self.target.as_str(),
            self.out.display(),
            self.files.len(),
            kb(self.total())
        );
        for (k, n) in self.by_area() {
            s += &format!("  {k:<10} {}\n", kb(n));
        }
        s += "largest:\n";
        for (p, n) in self.files.iter().take(5) {
            s += &format!("  {:>10}  {p}\n", kb(*n));
        }
        for n in &self.notes {
            s += &format!("note: {n}\n");
        }
        if let Some(z) = &self.zip {
            s += &format!("zip: {}\n", z.display());
        }
        s
    }
}

// ---------------------------------------------------------------------------------------------------------------------

const TEMPLATE: &str = include_str!("../templates/web.html");
const MAIN_MODULE: &str = include_str!("../templates/main-module.js");

fn skip_name(name: &str) -> bool {
    name.starts_with('.') || matches!(name, "dist" | "target" | "node_modules")
}

fn walk(dir: &Path, rel: &str, out: &mut Vec<(PathBuf, String)>, skip: &dyn Fn(&str) -> bool) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    let mut es: Vec<_> = rd.flatten().collect();
    es.sort_by_key(|e| e.file_name());
    for e in es {
        let name = e.file_name().to_string_lossy().into_owned();
        let r = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };
        if skip(&r) {
            continue;
        }
        let p = e.path();
        if p.v_is_dir() {
            walk(&p, &r, out, skip);
        } else {
            out.push((p, r));
        }
    }
}

fn copy_to(from: &Path, to: &Path) -> Result<()> {
    if let Some(d) = to.parent() {
        fs::create_dir_all(d)?;
    }
    fs::copy(from, to).with_context(|| format!("copy {}", from.display()))?;
    Ok(())
}

fn copy_tree(src: &Path, dst: &Path, skip: &dyn Fn(&str) -> bool) -> Result<()> {
    let mut v = vec![];
    walk(src, "", &mut v, skip);
    for (p, r) in v {
        copy_to(&p, &dst.join(r))?;
    }
    Ok(())
}

/// Files of a vendored lib to ship: the named ones plus any licence file in the same folder.
fn copy_lib(engine: &Path, out: &Path, lib: &str, files: &[&str]) -> Result<()> {
    let src = engine.join("vendor").join(lib);
    if !src.v_is_dir() {
        bail!(
            "vendor/{lib} missing in {} (run `node tools/vendor.mjs`)",
            engine.display()
        );
    }
    for f in files {
        if !src.join(f).v_exists() {
            bail!("vendor/{lib}/{f} missing (run `node tools/vendor.mjs`)");
        }
        copy_to(&src.join(f), &out.join("vendor").join(lib).join(f))?;
    }
    for e in fs::read_dir(&src)?.flatten() {
        let n = e.file_name().to_string_lossy().into_owned();
        if n.to_lowercase().contains("licen") {
            copy_to(&e.path(), &out.join("vendor").join(lib).join(&n))?;
        }
    }
    Ok(())
}

struct Plan {
    backend: &'static str,
    /// (lib folder, file) classic scripts, in load order
    scripts: Vec<(&'static str, &'static str)>,
}

fn plan(target: Target, p: &nord_core::Project) -> Plan {
    match target {
        Target::Web3d => Plan {
            backend: "babylon",
            scripts: vec![
                ("babylonjs", "babylon.js"),
                ("babylonjs-loaders", "babylonjs.loaders.min.js"),
                ("babylonjs-gui", "babylon.gui.min.js"),
                ("havok", "HavokPhysics_umd.js"),
            ],
        },
        Target::Web3dPc => Plan {
            backend: "playcanvas",
            scripts: vec![("playcanvas", "playcanvas.min.js")],
        },
        _ => Plan {
            backend: "phaser",
            scripts: vec![(
                "phaser",
                if p.physics.engine == "matter" {
                    "phaser.min.js"
                } else {
                    "phaser-arcade-physics.min.js"
                },
            )],
        },
    }
}

fn run_node(engine: &Path, spec: &serde_json::Value, tmp: &Path) -> Result<()> {
    let script = engine.join("tools/export-bundle.mjs");
    if !script.v_exists() || !engine.join("vendor/esbuild-wasm/browser.js").v_exists() {
        bail!("minify/single-file need tools/export-bundle.mjs + vendor/esbuild-wasm (run `node tools/vendor.mjs`)");
    }
    let sp = tmp.join("spec.json");
    fs::write(&sp, serde_json::to_vec(spec)?)?;
    let o = Command::new("node")
        .arg(&script)
        .arg(&sp)
        .output()
        .context("Node.js is required for --minify / --single-file (install Node 18+)")?;
    if !o.status.success() {
        bail!(
            "bundler failed: {}",
            String::from_utf8_lossy(&o.stderr).trim()
        );
    }
    Ok(())
}

/// `node tools/compile-sheets.mjs <out> --annotate`; `None` when the build has no event sheets.
fn compile_event_sheets(engine: &Path, out: &Path) -> Result<Option<String>> {
    let mut files = vec![];
    walk(out, "", &mut files, &|r| {
        r.starts_with("vendor/") || r.starts_with("runtime/")
    });
    if !files.iter().any(|(_, r)| r.ends_with(".events.json")) {
        return Ok(None);
    }
    let script = engine.join("tools/compile-sheets.mjs");
    if !script.v_exists() {
        bail!("tools/compile-sheets.mjs not found");
    }
    let o = Command::new("node")
        .arg(&script)
        .arg(out)
        .arg("--annotate")
        .output()
        .context("Node.js not found")?;
    if !o.status.success() {
        bail!("{}", String::from_utf8_lossy(&o.stderr).trim());
    }
    let text = String::from_utf8_lossy(&o.stdout);
    Ok(Some(format!(
        "event sheets: {}",
        text.lines().last().unwrap_or("compiled").trim()
    )))
}

fn mime(path: &str) -> &'static str {
    match path
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "json" => "application/json",
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        "wasm" => "application/wasm",
        "ttf" => "font/ttf",
        "woff2" => "font/woff2",
        "txt" | "glsl" | "wgsl" => "text/plain",
        _ => "application/octet-stream",
    }
}

fn data_uri(path: &Path, rel: &str) -> Result<String> {
    Ok(format!(
        "data:{};base64,{}",
        mime(rel),
        base64::engine::general_purpose::STANDARD.encode(fs::read(path)?)
    ))
}

fn js_str(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_default()
}

/// `</script` inside an inline script would end it early.
fn inline_safe(js: &str) -> String {
    js.replace("</script", "<\\/script")
        .replace("</SCRIPT", "<\\/SCRIPT")
}

// ---- optimisation ----------------------------------------------------------------------------------------------------

/// Lossless PNG recompress (kept only if smaller) and wav→mp3 (ffmpeg, only if present). Returns notes.
fn optimize(out: &Path) -> Result<Vec<String>> {
    use image::{codecs::png, ImageEncoder};
    let mut notes = vec![];
    let mut files = vec![];
    walk(out, "", &mut files, &|r| {
        r.starts_with("vendor/") || r.starts_with("runtime/")
    });
    let (mut saved, mut pngs) = (0i64, 0);
    for (p, r) in &files {
        if !r.to_lowercase().ends_with(".png") {
            continue;
        }
        let Ok(img) = image::open(p) else { continue };
        let mut buf = vec![];
        let enc = png::PngEncoder::new_with_quality(
            &mut buf,
            png::CompressionType::Best,
            png::FilterType::Adaptive,
        );
        let rgba = img.to_rgba8();
        if enc
            .write_image(
                &rgba,
                rgba.width(),
                rgba.height(),
                image::ExtendedColorType::Rgba8,
            )
            .is_err()
        {
            continue;
        }
        let old = fs::metadata(p)?.len() as i64;
        if (buf.len() as i64) < old {
            fs::write(p, &buf)?;
            saved += old - buf.len() as i64;
            pngs += 1;
        }
    }
    notes.push(format!(
        "optimize: {pngs} PNG(s) recompressed losslessly, {} KB saved",
        saved / 1024
    ));

    let have_ffmpeg = Command::new("ffmpeg")
        .arg("-version")
        .output()
        .is_ok_and(|o| o.status.success());
    let wavs: Vec<_> = files
        .iter()
        .filter(|(p, r)| {
            r.to_lowercase().ends_with(".wav") && fs::metadata(p).is_ok_and(|m| m.len() > 64 * 1024)
        })
        .collect();
    if !wavs.is_empty() && !have_ffmpeg {
        notes.push("optimize: ffmpeg not found, WAV files left as they are".into());
    } else if have_ffmpeg {
        let mut renames: Vec<(String, String)> = vec![];
        for (p, r) in wavs {
            let mp3 = p.with_extension("mp3");
            let ok = Command::new("ffmpeg")
                .args(["-y", "-loglevel", "error", "-i"])
                .arg(p)
                .args(["-c:a", "libmp3lame", "-q:a", "4"])
                .arg(&mp3)
                .status()
                .is_ok_and(|s| s.success());
            if ok
                && fs::metadata(&mp3)
                    .is_ok_and(|m| m.len() < fs::metadata(p).map_or(0, |m| m.len()))
            {
                fs::remove_file(p)?;
                let sidecar = PathBuf::from(format!("{}.meta.json", p.display()));
                if sidecar.v_exists() {
                    fs::rename(&sidecar, format!("{}.meta.json", mp3.display()))?;
                }
                renames.push((
                    r.clone(),
                    format!(
                        "{}.mp3",
                        r.trim_end_matches(".wav").trim_end_matches(".WAV")
                    ),
                ));
            } else {
                let _ = fs::remove_file(&mp3);
            }
        }
        if !renames.is_empty() {
            let mut texts = vec![];
            walk(out, "", &mut texts, &|r| {
                r.starts_with("vendor/") || r.starts_with("runtime/")
            });
            for (p, r) in texts {
                if !(r.ends_with(".json") || r.ends_with(".js") || r.ends_with(".html")) {
                    continue;
                }
                let Ok(mut s) = fs::read_to_string(&p) else {
                    continue;
                };
                let before = s.clone();
                for (a, b) in &renames {
                    s = s.replace(a.as_str(), b);
                }
                if s != before {
                    fs::write(&p, s)?;
                }
            }
            notes.push(format!(
                "optimize: {} WAV file(s) → MP3 (references rewritten)",
                renames.len()
            ));
        }
    }
    Ok(notes)
}

// ---- main entry --------------------------------------------------------------------------------------------------

/// Android / iOS: a ready-to-open Capacitor project. The game is built as a normal web folder into `<out>/www`; `package.json`
/// and `capacitor.config.json` wrap it, `README-MOBILE.md` lists the two commands that create the native projects
/// (they need Node plus Android Studio / Xcode, which this engine does not bundle).
pub fn build_mobile(project: &Path, engine: &Path, o: &Opts) -> Result<Report> {
    let proj = io::load_project(project)?;
    let out = o.out.clone().unwrap_or_else(|| project.join("dist/mobile"));
    let mut opts = o.clone();
    opts.out = Some(out.join("www"));
    opts.single_file = false;
    opts.pwa = false;
    opts.zip = false;
    let mut report = build(project, engine, &opts)?;
    let slug: String = proj
        .name
        .to_lowercase()
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .collect();
    let slug = if slug.is_empty() {
        "game".to_string()
    } else {
        slug
    };
    let mobile = proj.export.get("mobile");
    let app_id = mobile
        .and_then(|m| m.get("appId"))
        .and_then(|v| v.as_str())
        .map_or_else(|| format!("com.nord.{slug}"), String::from);
    let cap = serde_json::json!({
        "appId": app_id,
        "appName": proj.name,
        "webDir": "www",
        "backgroundColor": proj.display.background,
        "server": { "androidScheme": "https" }
    });
    let pkg = serde_json::json!({
        "name": slug,
        "version": "1.0.0",
        "private": true,
        "scripts": { "sync": "cap sync", "android": "cap open android", "ios": "cap open ios" },
        "dependencies": {
            "@capacitor/core": "^6.0.0", "@capacitor/android": "^6.0.0", "@capacitor/ios": "^6.0.0"
        },
        "devDependencies": { "@capacitor/cli": "^6.0.0" }
    });
    let readme = format!(
        "# {name} — mobile project (Capacitor)\n\nGenerated by Nord Engine. `www/` is the exported game; re-export to refresh it.\n\n```sh\nnpm install\nnpx cap add android   # needs Android Studio\nnpx cap add ios       # macOS + Xcode only\nnpx cap sync\nnpm run android       # or: npm run ios\n```\n\nApp id: `{app_id}` (change it with `export.mobile.appId` in nord.project.json).\n",
        name = proj.name
    );
    for (name, body) in [
        ("capacitor.config.json", serde_json::to_string_pretty(&cap)?),
        ("package.json", serde_json::to_string_pretty(&pkg)?),
        ("README-MOBILE.md", readme),
        (".gitignore", "node_modules\nandroid\nios\n".to_string()),
    ] {
        fs::write(out.join(name), body)?;
    }
    report.out = out;
    report.notes.push(
        "mobile: Capacitor project (see README-MOBILE.md for `npx cap add android|ios`)".into(),
    );
    Ok(report)
}

pub fn build(project: &Path, engine: &Path, o: &Opts) -> Result<Report> {
    let project =
        fs::canonicalize(project).with_context(|| format!("project {}", project.display()))?;
    let issues = validate::validate_project(&project);
    if !issues.is_empty() {
        bail!(
            "project has {} problem(s), fix them first:\n{}",
            issues.len(),
            issues
                .iter()
                .map(|i| format!("  {}: {}", i.file, i.msg))
                .collect::<Vec<_>>()
                .join("\n")
        );
    }
    let proj = io::load_project(&project)?;
    let target = match (o.target, proj.kind) {
        (Target::Auto, ProjectType::Html) => Target::Html,
        (Target::Auto, ProjectType::TwoD) => Target::Web2d,
        (Target::Auto, ProjectType::ThreeD) => Target::Web3d,
        (Target::Auto, ProjectType::WasmGame) => Target::WasmGame,
        (Target::Auto, ProjectType::WasmApp) => Target::WasmApp,
        (t, _) => t,
    };
    if target == Target::Web2d && proj.kind == ProjectType::ThreeD
        || matches!(target, Target::Web3d | Target::Web3dPc) && proj.kind == ProjectType::TwoD
    {
        bail!(
            "target {} does not fit a {} project",
            target.as_str(),
            proj.kind.as_str()
        );
    }
    if o.pwa && (o.single_file || matches!(target, Target::WasmGame | Target::WasmApp)) {
        bail!("--pwa needs a folder build (web-2d / web-3d / web-3d-pc / html); single-file and Rust/WASM exports cannot register a service worker");
    }
    if target == Target::Html && (o.single_file || o.minify) {
        bail!("--single-file/--minify apply to the web-2d / web-3d / web-3d-pc targets; html projects are copied as you wrote them");
    }

    if matches!(target, Target::WasmGame | Target::WasmApp) {
        if !matches!(proj.kind, ProjectType::WasmGame | ProjectType::WasmApp) {
            bail!(
                "target {} needs a wasm-game / wasm-app (Rust) project, this is a {} project",
                target.as_str(),
                proj.kind.as_str()
            );
        }
        if o.single_file || o.minify {
            bail!("--single-file/--minify do not apply to Rust/WASM targets (use --optimize for wasm-opt)");
        }
    } else if matches!(proj.kind, ProjectType::WasmGame | ProjectType::WasmApp) {
        bail!(
            "a {} project exports with --target web-wasm-game / web-wasm-app",
            proj.kind.as_str()
        );
    }

    // output dir: refuse to wipe anything that is not an earlier build
    let out = o.out.clone().unwrap_or_else(|| project.join("dist"));
    fs::create_dir_all(&out)?;
    let out = fs::canonicalize(&out)?;
    if out == project || project.starts_with(&out) {
        bail!("output folder {} would contain the project", out.display());
    }
    if fs::read_dir(&out)?.next().is_some() {
        if !out.join("nord.json").v_exists() && !out.join("index.html").v_exists() {
            bail!(
                "{} is not empty and does not look like a Nord build; pick another --out",
                out.display()
            );
        }
        fs::remove_dir_all(&out)?;
        fs::create_dir_all(&out)?;
    }
    if matches!(target, Target::WasmGame | Target::WasmApp) {
        return build_rust(&project, engine, &out, &proj, target, o);
    }
    let tmp = fs::temp_dir().join(format!("nord-build-{}", fs::unique_tag()));
    fs::create_dir_all(&tmp)?;
    let mut notes = vec![];

    // 1. project files
    let out_in_project = out
        .strip_prefix(&project)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"));
    let generated_index = target != Target::Html;
    // Build Settings ▸ scenes not "in build": `export.excludeScenes` (project-relative paths). The start scene is never dropped.
    let excluded: Vec<String> = proj
        .export
        .get("excludeScenes")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|s| s.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    copy_tree(&project, &out, &|r| {
        let name = r.rsplit('/').next().unwrap_or(r);
        skip_name(name)
            || (r != proj.start_scene && excluded.iter().any(|x| x == r))
            || (generated_index && r == "index.html")
            || out_in_project.as_deref().is_some_and(|d| r == d)
    })?;

    // 2. runtime + libs
    let pl = plan(target, &proj);
    if generated_index {
        let rt = engine.join("runtime");
        for d in ["core", pl.backend] {
            copy_tree(&rt.join(d), &out.join("runtime").join(d), &|r| {
                r.ends_with(".test.mjs")
            })?;
        }
        for (lib, file) in &pl.scripts {
            copy_lib(engine, &out, lib, &[file])?;
        }
        if target == Target::Web3d {
            copy_lib(
                engine,
                &out,
                "havok",
                &["HavokPhysics_umd.js", "HavokPhysics.wasm"],
            )?;
        }
        copy_tree(
            &engine.join("vendor/fonts"),
            &out.join("vendor/fonts"),
            &|_| false,
        )?;

        // 3. index.html
        let libs = pl
            .scripts
            .iter()
            .map(|(l, f)| format!("<script src=\"vendor/{l}/{f}\"></script>"))
            .collect::<Vec<_>>()
            .join("\n");
        let main = format!(
            "<script type=\"importmap\">{{\"imports\":{{\"nord\":\"./runtime/core/index.js\"}}}}</script>\n<script type=\"module\">\n{}</script>",
            MAIN_MODULE.replace("{{backend}}", pl.backend)
        );
        // import map must precede module scripts: it goes into <head>
        let (head, main) = main
            .split_once('\n')
            .map(|(a, b)| (a.to_string(), b.to_string()))
            .unwrap();
        let html = TEMPLATE
            .replace("{{name}}", &html_escape(&proj.name))
            .replace("{{background}}", &css_safe(&proj.display.background))
            .replace("{{head}}", &head)
            .replace("{{libs}}", &libs)
            .replace("{{main}}", &main);
        io::write_atomic(&out.join("index.html"), html.as_bytes())?;
    }

    // 4. optimise
    if o.optimize {
        notes.extend(optimize(&out)?);
    }

    // offline guarantee: our own files only — vendored libs carry unused default CDN strings (never fetched by the runtime)
    let allow_file = project.join(".offline-allow");
    let extra: Vec<String> = fs::read_to_string(allow_file)
        .map(|s| {
            s.lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        })
        .unwrap_or_default();
    let ext = offline::scan_dir(&out, &extra);
    let ext: Vec<_> = ext
        .into_iter()
        .filter(|f| !f.file.starts_with("vendor/"))
        .collect();
    if !ext.is_empty() {
        bail!(
            "build references external hosts (offline guarantee):\n{}",
            ext.iter()
                .map(|f| format!("  {}:{}: {}", f.file, f.line, f.url))
                .collect::<Vec<_>>()
                .join("\n")
        );
    }

    // 5. minify | single file
    if o.single_file {
        single_file(engine, &out, &tmp, &proj, &pl, o.minify)?;
    } else if o.minify {
        let mut js = vec![];
        walk(&out, "", &mut js, &|r| r.starts_with("vendor/"));
        let files: Vec<_> = js
            .iter()
            .filter(|(_, r)| (r.ends_with(".js") || r.ends_with(".mjs")) && !r.contains(".min."))
            .map(|(p, _)| p.to_string_lossy().into_owned())
            .collect();
        if !files.is_empty() {
            run_node(
                engine,
                &serde_json::json!({"mode":"minify","files":files}),
                &tmp,
            )?;
        }
        let mut n = 0;
        let mut all = vec![];
        walk(&out, "", &mut all, &|r| r.starts_with("vendor/"));
        for (p, r) in all {
            if r.ends_with(".json") {
                if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&fs::read(&p)?) {
                    fs::write(&p, serde_json::to_vec(&v)?)?;
                    n += 1;
                }
            }
        }
        notes.push(format!(
            "minify: {} JS file(s) + {n} JSON file(s)",
            files.len()
        ));
    }

    // 5a. event sheets → JavaScript (ahead of time); the runtime falls back to interpreting when a module is missing
    if o.compile_events && !o.single_file && out.join("runtime/core/eventsheet/expr.js").v_exists()
    {
        match compile_event_sheets(engine, &out) {
            Ok(Some(msg)) => notes.push(msg),
            Ok(None) => {}
            Err(e) => notes.push(format!(
                "event sheets not compiled (they run interpreted): {e}"
            )),
        }
    }

    // 5b. PWA: manifest + service worker (before nord.json so both are covered by the file list)
    if o.pwa {
        write_pwa(&project, engine, &out, &proj)?;
        notes.push("pwa: manifest.webmanifest + sw.js (offline after first load, needs https or localhost)".into());
    }

    // 5c. hosting preset files (also covered by the file list below)
    if o.host != Host::None {
        if matches!(target, Target::WasmGame | Target::WasmApp) && o.host == Host::GithubPages {
            notes.push("github-pages: Rust/WASM builds need the right MIME for .wasm; GitHub Pages serves it correctly".into());
        }
        if let Some(n) = hosting::write(&out, &proj.name, o.host)? {
            notes.push(n);
        }
    }

    // 6. manifest (folder builds)
    if !o.single_file {
        write_manifest(&out, &proj, target, &pl)?;
    }

    // 8. report (+ zip)
    let mut files = vec![];
    walk(&out, "", &mut files, &|_| false);
    let mut sizes: Vec<(String, u64)> = files
        .iter()
        .map(|(p, r)| (r.clone(), fs::metadata(p).map_or(0, |m| m.len())))
        .collect();
    sizes.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    notes.extend(size_checks(&sizes));
    let zip = if o.zip || o.host == Host::Itch {
        Some(write_zip(&out, &files)?)
    } else {
        None
    };
    let _ = fs::remove_dir_all(&tmp);
    Ok(Report {
        target,
        out,
        files: sizes,
        zip,
        notes,
    })
}

/// web-wasm-game / web-wasm-app: cargo build (release) → stage data + loader → offline check → zip.
fn build_rust(
    project: &Path,
    engine: &Path,
    out: &Path,
    proj: &nord_core::Project,
    target: Target,
    o: &Opts,
) -> Result<Report> {
    let mut notes = vec![];
    let wasm = rust::cargo_build(project, true, &mut |l| eprintln!("{l}"))?;
    let name = css_safe(&proj.display.background);
    let title = html_escape(&proj.name);
    // project data + assets (no sources, no dev page)
    copy_tree(project, out, &|r| {
        let n = r.rsplit('/').next().unwrap_or(r);
        skip_name(n)
            || matches!(r, "Cargo.toml" | "Cargo.lock" | "index.html")
            || r.starts_with("src/")
    })?;
    match target {
        Target::WasmGame => {
            let bundle = engine.join("vendor/macroquad/mq_js_bundle.js");
            if !bundle.v_exists() {
                bail!("vendor/macroquad/mq_js_bundle.js missing (run `node tools/vendor.mjs --crates`)");
            }
            copy_to(&bundle, &out.join("mq_js_bundle.js"))?;
            copy_to(&wasm, &out.join("game.wasm"))?;
            io::write_atomic(
                &out.join("index.html"),
                rust::game_index_html(&title, &name).as_bytes(),
            )?;
            if o.optimize {
                notes.push(rust::optimize_wasm(&out.join("game.wasm")));
            }
        }
        _ => {
            rust::bindgen(&wasm, out)?;
            io::write_atomic(
                &out.join("index.html"),
                rust::app_index_html(&title, &name).as_bytes(),
            )?;
            if o.optimize {
                notes.push(rust::optimize_wasm(&out.join("app_bg.wasm")));
            }
        }
    }
    // offline guarantee on our own files (the JS loader / wasm are third-party binaries)
    let ext: Vec<_> = offline::scan_dir(out, &[])
        .into_iter()
        .filter(|f| {
            !matches!(f.file.as_str(), "mq_js_bundle.js" | "app.js") && !f.file.ends_with(".wasm")
        })
        .collect();
    if !ext.is_empty() {
        bail!(
            "build references external hosts (offline guarantee):\n{}",
            ext.iter()
                .map(|f| format!("  {}:{}: {}", f.file, f.line, f.url))
                .collect::<Vec<_>>()
                .join("\n")
        );
    }
    let mut files = vec![];
    walk(out, "", &mut files, &|_| false);
    let mut sizes: Vec<(String, u64)> = files
        .iter()
        .map(|(p, r)| (r.clone(), fs::metadata(p).map_or(0, |m| m.len())))
        .collect();
    sizes.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    let zip = if o.zip {
        Some(write_zip(out, &files)?)
    } else {
        None
    };
    Ok(Report {
        target,
        out: out.to_path_buf(),
        files: sizes,
        zip,
        notes,
    })
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn css_safe(s: &str) -> String {
    if s.chars().all(|c| c.is_ascii_alphanumeric() || c == '#') && !s.is_empty() {
        s.to_string()
    } else {
        "#101418".into()
    }
}

/// Export wizard checks: things worth knowing before uploading (shown in the report / export dialog).
pub fn size_checks(files: &[(String, u64)]) -> Vec<String> {
    let mb = |n: u64| n as f64 / 1048576.0;
    let total: u64 = files.iter().map(|f| f.1).sum();
    let mut notes = vec![];
    if mb(total) > 100.0 {
        notes.push(format!("check: build is {:.0} MB — large for the web; try --optimize, shorter music, smaller textures", mb(total)));
    }
    for (p, n) in files
        .iter()
        .filter(|(p, n)| mb(*n) > 8.0 && !p.starts_with("vendor/") && !p.starts_with("runtime/"))
        .take(5)
    {
        notes.push(format!("check: {p} is {:.1} MB", mb(*n)));
    }
    notes
}

fn pwa_icon(project: &Path, engine: &Path, proj: &nord_core::Project) -> Option<PathBuf> {
    let configured = proj
        .export
        .get("web")
        .and_then(|w| w["icon"].as_str())
        .map(|s| project.join(s));
    [
        configured,
        Some(project.join("icon.png")),
        Some(engine.join("assets/brand/logo-512.png")),
    ]
    .into_iter()
    .flatten()
    .find(|p| p.v_is_file())
}

/// `manifest.webmanifest`, `sw.js` and the tags in index.html that make the build installable and playable offline.
fn write_pwa(project: &Path, engine: &Path, out: &Path, proj: &nord_core::Project) -> Result<()> {
    let web = proj
        .export
        .get("web")
        .and_then(|w| w.get("pwa"))
        .cloned()
        .unwrap_or_default();
    let display = web["display"].as_str().unwrap_or("fullscreen");
    let bg = css_safe(&proj.display.background);
    let mut icons = vec![];
    if let Some(src) = pwa_icon(project, engine, proj) {
        fs::create_dir_all(out.join("icons"))?;
        fs::copy(&src, out.join("icons/app-icon.png"))?;
        let (w, h) = image::image_dimensions(&src).unwrap_or((512, 512));
        icons.push(serde_json::json!({"src":"icons/app-icon.png","sizes":format!("{w}x{h}"),"type":"image/png","purpose":"any"}));
    }
    let short: String = proj.name.chars().take(12).collect();
    let mut m = serde_json::json!({
        "name": proj.name, "short_name": web["shortName"].as_str().unwrap_or(&short),
        "start_url": "./", "scope": "./", "display": display,
        "background_color": bg, "theme_color": bg, "icons": icons,
    });
    if let Some(o) = web["orientation"].as_str() {
        m["orientation"] = serde_json::json!(o);
    }
    io::write_atomic(
        &out.join("manifest.webmanifest"),
        serde_json::to_string_pretty(&m)?.as_bytes(),
    )?;

    // service worker: precache every file of this build; the cache name changes when any file changes, so updates replace old caches
    let mut files = vec![];
    walk(out, "", &mut files, &|r| r == "sw.js");
    let mut list: Vec<String> = vec!["./".into()];
    let mut stamp = String::new();
    for (p, r) in &files {
        list.push(r.clone());
        stamp += &format!("{r}:{};", fs::metadata(p).map_or(0, |m| m.len()));
    }
    let hash = assets::sha256_bytes(stamp.as_bytes());
    let sw = format!(
        "// generated by `nord build --pwa`\nconst CACHE = 'nord-{id}-{ver}';\nconst FILES = {files};\n\
self.addEventListener('install', (e) => {{ e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); }});\n\
self.addEventListener('activate', (e) => {{ e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('nord-{id}-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); }});\n\
self.addEventListener('fetch', (e) => {{ if (e.request.method !== 'GET') return; e.respondWith(caches.match(e.request, {{ ignoreSearch: true }}).then((hit) => hit || fetch(e.request))); }});\n",
        id = proj.id,
        ver = &hash[..12.min(hash.len())],
        files = serde_json::to_string(&list)?,
    );
    io::write_atomic(&out.join("sw.js"), sw.as_bytes())?;

    let idx = out.join("index.html");
    let html = fs::read_to_string(&idx).context("index.html")?;
    let head = format!("<link rel=\"manifest\" href=\"manifest.webmanifest\"><meta name=\"theme-color\" content=\"{bg}\">");
    let reg = "<script>if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});</script>";
    let html = html
        .replacen("</head>", &format!("{head}</head>"), 1)
        .replacen("</body>", &format!("{reg}</body>"), 1);
    io::write_atomic(&idx, html.as_bytes())?;
    Ok(())
}

fn write_manifest(out: &Path, p: &nord_core::Project, target: Target, pl: &Plan) -> Result<()> {
    let mut files = vec![];
    walk(out, "", &mut files, &|_| false);
    let list: Vec<_> = files
        .iter()
        .filter(|(_, r)| r != "nord.json")
        .map(|(f, r)| {
            serde_json::json!({
                "path": r,
                "size": fs::metadata(f).map_or(0, |m| m.len()),
                "sha256": assets::sha256_file(f).unwrap_or_default(),
            })
        })
        .collect();
    let m = serde_json::json!({
        "name": p.name,
        "id": p.id,
        "target": target.as_str(),
        "engine": format!("nord {}", env!("CARGO_PKG_VERSION")),
        "backend": pl.backend,
        "startScene": p.start_scene,
        "display": p.display,
        "desktop": p.desktop,
        "files": list,
    });
    io::write_atomic(
        &out.join("nord.json"),
        serde_json::to_string_pretty(&m)?.as_bytes(),
    )?;
    Ok(())
}

fn write_zip(out: &Path, files: &[(PathBuf, String)]) -> Result<PathBuf> {
    use std::io::Write;
    let zp = out.with_extension("zip");
    let mut z = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let opt = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (p, r) in files {
        z.start_file(r.as_str(), opt)?;
        z.write_all(&fs::read(p)?)?;
    }
    fs::write(&zp, z.finish()?.into_inner())?;
    Ok(zp)
}

/// Replace the staged folder by a single `index.html` (all scripts, project data and assets inlined) + the font files.
fn single_file(
    engine: &Path,
    out: &Path,
    tmp: &Path,
    p: &nord_core::Project,
    pl: &Plan,
    minify: bool,
) -> Result<()> {
    let mut staged = vec![];
    walk(out, "", &mut staged, &|_| false);
    let is_script = |r: &str| r.starts_with("scripts/") && r.ends_with(".js");
    let scripts: Vec<&(PathBuf, String)> = staged.iter().filter(|(_, r)| is_script(r)).collect();

    // bundle entry: runtime + user scripts as static imports
    let mut e = format!(
        "import {{ boot }} from {};\n",
        js_str(
            &out.join("runtime")
                .join(pl.backend)
                .join("index.js")
                .to_string_lossy()
        )
    );
    for (i, (f, _)) in scripts.iter().enumerate() {
        e += &format!("import * as S{i} from {};\n", js_str(&f.to_string_lossy()));
    }
    e += "const scripts = {\n";
    for (i, (_, r)) in scripts.iter().enumerate() {
        e += &format!("  {}: S{i},\n", js_str(r));
    }
    e += "};\nconst FILES = {\n";
    for (f, r) in &staged {
        let keep = !is_script(r)
            && !r.starts_with("runtime/")
            && !r.starts_with("vendor/")
            && r != "index.html"
            && r != "nord.project.json";
        if keep {
            e += &format!("  {}: {},\n", js_str(r), js_str(&data_uri(f, r)?));
        }
    }
    e += "};\nglobalThis.__NORD_FILES__ = FILES;\n";
    let project_json = fs::read_to_string(out.join("nord.project.json"))?;
    e += &format!("const project = JSON.parse({});\n", js_str(&project_json));
    let havok = if pl.backend == "babylon" {
        js_str(&data_uri(
            &out.join("vendor/havok/HavokPhysics.wasm"),
            "x.wasm",
        )?)
    } else {
        "null".into()
    };
    e += &format!(
        "const HAVOK = {havok};\n(async () => {{ try {{\n  await boot(project, {{ container: document.getElementById('stage'), libBase: './vendor', files: FILES, inlineOnly: true,\n    importScript: async (p) => {{ const m = scripts[p.split('?')[0]]; if (!m) throw new Error('script not bundled: ' + p); return m; }},\n    locateLib: (f) => (f.endsWith('.wasm') ? HAVOK : null) }});\n  window.__nord_ready = true;\n}} catch (e) {{ console.error(e); window.__nord_error = String(e); }} }})();\n"
    );
    let entry = tmp.join("entry.mjs");
    fs::write(&entry, e)?;
    let bundle = tmp.join("bundle.js");
    run_node(
        engine,
        &serde_json::json!({
            "mode": "bundle", "entry": entry, "out": bundle, "minify": minify,
            "alias": { "nord": out.join("runtime/core/index.js") },
        }),
        tmp,
    )?;

    let mut libs = String::new();
    for (lib, file) in &pl.scripts {
        let src = fs::read_to_string(out.join("vendor").join(lib).join(file))?;
        libs += &format!("<script>\n{}\n</script>\n", inline_safe(&src));
    }
    let html = TEMPLATE
        .replace("{{name}}", &html_escape(&p.name))
        .replace("{{background}}", &css_safe(&p.display.background))
        .replace("{{head}}", "")
        .replace("{{libs}}", &libs)
        .replace(
            "{{main}}",
            &format!(
                "<script>\n{}\n</script>",
                inline_safe(&fs::read_to_string(&bundle)?)
            ),
        );

    // keep only index.html + fonts
    let fonts = tmp.join("fonts");
    copy_tree(&out.join("vendor/fonts"), &fonts, &|_| false)?;
    for e in fs::read_dir(out)?.flatten() {
        let p = e.path();
        if p.v_is_dir() {
            fs::remove_dir_all(p)?;
        } else {
            fs::remove_file(p)?;
        }
    }
    copy_tree(&fonts, &out.join("vendor/fonts"), &|_| false)?;
    io::write_atomic(&out.join("index.html"), html.as_bytes())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn engine() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..")
    }

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("nord-export-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn mobile_export_writes_a_capacitor_project() {
        let d = tmp("mobile");
        let proj = d.join("game");
        nord_core::project::create(&proj, ProjectType::TwoD).unwrap();
        let out = d.join("m");
        let r = build_mobile(
            &proj,
            &engine(),
            &Opts {
                out: Some(out.clone()),
                ..Opts::default()
            },
        )
        .unwrap();
        assert_eq!(r.out, out);
        assert!(out.join("www/index.html").v_exists(), "game lives in www/");
        let cap: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(out.join("capacitor.config.json")).unwrap())
                .unwrap();
        assert_eq!(cap["webDir"], "www");
        assert!(cap["appId"].as_str().unwrap().starts_with("com.nord."));
        assert!(out.join("package.json").v_exists() && out.join("README-MOBILE.md").v_exists());
        assert!(r.notes.iter().any(|n| n.contains("Capacitor")));
    }

    #[test]
    fn builds_2d_with_zip_and_refuses_foreign_dirs() {
        let d = tmp("two");
        let proj = d.join("game");
        nord_core::project::create(&proj, ProjectType::TwoD).unwrap();
        let out = d.join("out");
        let r = build(
            &proj,
            &engine(),
            &Opts {
                out: Some(out.clone()),
                zip: true,
                ..Opts::default()
            },
        )
        .unwrap();
        assert_eq!(r.target, Target::Web2d);
        for f in [
            "index.html",
            "nord.json",
            "nord.project.json",
            "runtime/phaser/index.js",
            "vendor/phaser/phaser-arcade-physics.min.js",
        ] {
            assert!(out.join(f).v_exists(), "{f}");
        }
        assert!(r.zip.as_ref().unwrap().v_exists());
        // rebuild over an earlier build is fine; over a foreign folder it is not
        build(
            &proj,
            &engine(),
            &Opts {
                out: Some(out.clone()),
                ..Opts::default()
            },
        )
        .unwrap();
        let foreign = d.join("docs");
        fs::create_dir_all(&foreign).unwrap();
        fs::write(foreign.join("keep.txt"), "x").unwrap();
        let e = build(
            &proj,
            &engine(),
            &Opts {
                out: Some(foreign.clone()),
                ..Opts::default()
            },
        )
        .unwrap_err();
        assert!(e.to_string().contains("not empty"), "{e}");
        assert!(foreign.join("keep.txt").v_exists());
        // the project itself is never a valid output
        assert!(build(
            &proj,
            &engine(),
            &Opts {
                out: Some(proj.clone()),
                ..Opts::default()
            }
        )
        .is_err());
    }

    #[test]
    fn html_target_copies_project_and_rejects_wasm() {
        let d = tmp("html");
        let proj = d.join("page");
        nord_core::project::create(&proj, ProjectType::Html).unwrap();
        let out = d.join("out");
        let r = build(
            &proj,
            &engine(),
            &Opts {
                out: Some(out.clone()),
                ..Opts::default()
            },
        )
        .unwrap();
        assert_eq!(r.target, Target::Html);
        assert!(out.join("index.html").v_exists() && !out.join("runtime").v_exists());
        let w = d.join("w");
        nord_core::project::create(&w, ProjectType::WasmGame).unwrap();
        let e = build(
            &w,
            &engine(),
            &Opts {
                out: Some(d.join("o2")),
                ..Opts::default()
            },
        )
        .unwrap_err();
        assert!(e.to_string().contains("Cargo.toml"), "{e}");
    }

    #[test]
    fn pwa_export_writes_manifest_service_worker_and_registers_it() {
        let d = tmp("pwa");
        let proj = d.join("game");
        nord_core::project::create(&proj, ProjectType::TwoD).unwrap();
        let out = d.join("out");
        let r = build(
            &proj,
            &engine(),
            &Opts {
                out: Some(out.clone()),
                pwa: true,
                ..Opts::default()
            },
        )
        .unwrap();
        assert!(r.notes.iter().any(|n| n.starts_with("pwa:")));
        let m: serde_json::Value =
            serde_json::from_slice(&fs::read(out.join("manifest.webmanifest")).unwrap()).unwrap();
        assert_eq!(m["display"], "fullscreen");
        assert_eq!(m["start_url"], "./");
        assert!(out.join(m["icons"][0]["src"].as_str().unwrap()).v_is_file());
        let sw = fs::read_to_string(out.join("sw.js")).unwrap();
        assert!(
            sw.contains("\"runtime/phaser/index.js\"")
                && sw.contains("manifest.webmanifest")
                && !sw.contains("\"sw.js\"")
        );
        let html = fs::read_to_string(out.join("index.html")).unwrap();
        assert!(html.contains("rel=\"manifest\"") && html.contains("serviceWorker"));
        // single-file builds cannot be PWAs
        let e = build(
            &proj,
            &engine(),
            &Opts {
                out: Some(d.join("o2")),
                pwa: true,
                single_file: true,
                ..Opts::default()
            },
        )
        .unwrap_err();
        assert!(format!("{e}").contains("--pwa"));
    }

    #[test]
    fn size_checks_flag_big_files() {
        let n = size_checks(&[
            ("assets/music/a.mp3".into(), 20 << 20),
            ("vendor/x.js".into(), 30 << 20),
        ]);
        assert_eq!(n.len(), 1);
        assert!(n.iter().any(|s| s.contains("a.mp3")));
    }

    #[test]
    fn target_parse() {
        assert_eq!("web-2d".parse::<Target>().unwrap(), Target::Web2d);
        assert!("nope".parse::<Target>().is_err());
    }

    #[test]
    fn inline_script_escape() {
        assert_eq!(inline_safe("a</script>b"), "a<\\/script>b");
    }

    #[test]
    fn report_areas() {
        let r = Report {
            target: Target::Web2d,
            out: "x".into(),
            files: vec![
                ("assets/a.png".into(), 10),
                ("index.html".into(), 5),
                ("assets/b.png".into(), 1),
            ],
            zip: None,
            notes: vec![],
        };
        assert_eq!(r.total(), 16);
        assert_eq!(r.by_area()[0], ("assets".to_string(), 11));
    }
}
