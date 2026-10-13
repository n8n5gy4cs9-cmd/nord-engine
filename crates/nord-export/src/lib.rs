//! `nord build`: turn a project into a static, offline web build (see docs/EXPORT_TARGETS.md).
//!
//! Pipeline: validate → stage (project files + runtime + vendored libs + generated index.html) → optimise (optional)
//! → minify | single-file bundle (Node + vendored esbuild-wasm, optional) → nord.json manifest → offline check → zip.
pub mod mac;
pub mod portable;
pub mod rust;

use anyhow::{bail, Context, Result};
use base64::Engine as _;
use nord_core::{assets, io, offline, validate, ProjectType};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

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
        if p.is_dir() {
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
    if !src.is_dir() {
        bail!(
            "vendor/{lib} missing in {} (run `node tools/vendor.mjs`)",
            engine.display()
        );
    }
    for f in files {
        if !src.join(f).exists() {
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
    if !script.exists() || !engine.join("vendor/esbuild-wasm/browser.js").exists() {
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
                if sidecar.exists() {
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

pub fn build(project: &Path, engine: &Path, o: &Opts) -> Result<Report> {
    let project = project
        .canonicalize()
        .with_context(|| format!("project {}", project.display()))?;
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
    let out = out.canonicalize()?;
    if out == project || project.starts_with(&out) {
        bail!("output folder {} would contain the project", out.display());
    }
    if fs::read_dir(&out)?.next().is_some() {
        if !out.join("nord.json").exists() && !out.join("index.html").exists() {
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
    let tmp = std::env::temp_dir().join(format!("nord-build-{}", std::process::id()));
    fs::create_dir_all(&tmp)?;
    let mut notes = vec![];

    // 1. project files
    let out_in_project = out
        .strip_prefix(&project)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"));
    let generated_index = target != Target::Html;
    copy_tree(&project, &out, &|r| {
        let name = r.rsplit('/').next().unwrap_or(r);
        skip_name(name)
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
            .replace("{{main}}", &main)
            .replace("{{touch}}", &touch_tag(engine, &proj));
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
    let zip = if o.zip {
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
            if !bundle.exists() {
                bail!("vendor/macroquad/mq_js_bundle.js missing (run `node tools/vendor.mjs --crates`)");
            }
            copy_to(&bundle, &out.join("mq_js_bundle.js"))?;
            copy_to(&wasm, &out.join("game.wasm"))?;
            io::write_atomic(
                &out.join("index.html"),
                rust::game_index_html(&title, &name, &touch_tag(engine, proj)).as_bytes(),
            )?;
            if o.optimize {
                notes.push(rust::optimize_wasm(&out.join("game.wasm")));
            }
        }
        _ => {
            rust::bindgen(&wasm, out)?;
            io::write_atomic(
                &out.join("index.html"),
                rust::app_index_html(&title, &name, &touch_tag(engine, proj)).as_bytes(),
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
        .replace('"', "&quot;")
}

/// Inline `<script>` with the on-screen touch controls (`runtime/touch/nord-touch.js`). It reads the project's
/// `input.actions` to build buttons, shows only on touch devices and feeds the game ordinary keyboard events.
/// Empty if the runtime file is missing (e.g. a trimmed engine checkout).
fn touch_tag(engine: &Path, proj: &nord_core::Project) -> String {
    let Ok(src) = fs::read_to_string(engine.join("runtime/touch/nord-touch.js")) else {
        return String::new();
    };
    let actions = serde_json::to_string(&proj.input.actions).unwrap_or_else(|_| "{}".into());
    format!(
        "<script data-actions=\"{}\">\n{}\n</script>",
        html_escape(&actions),
        inline_safe(&src)
    )
}

fn css_safe(s: &str) -> String {
    if s.chars().all(|c| c.is_ascii_alphanumeric() || c == '#') && !s.is_empty() {
        s.to_string()
    } else {
        "#101418".into()
    }
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
    let mut z = zip::ZipWriter::new(fs::File::create(&zp)?);
    let opt = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (p, r) in files {
        z.start_file(r.as_str(), opt)?;
        z.write_all(&fs::read(p)?)?;
    }
    z.finish()?;
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
        .replace("{{touch}}", &touch_tag(engine, p))
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
        if p.is_dir() {
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
            assert!(out.join(f).exists(), "{f}");
        }
        assert!(r.zip.as_ref().unwrap().exists());
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
        assert!(foreign.join("keep.txt").exists());
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
        assert!(out.join("index.html").exists() && !out.join("runtime").exists());
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
