//! Rust/WASM tier builds: `cargo build --target wasm32-unknown-unknown` (+ `wasm-opt`), dev staging to `target/web/` for `nord serve`,
//! and the `web-wasm-game` / `web-wasm-app` exports.
//!
//! * wasm-game (macroquad runtime): `game.wasm` + vendored `mq_js_bundle.js` + generated `index.html` + the project's data/assets.
//! * wasm-app (eframe): `cargo build` → `wasm-bindgen --target web` (CLI must match the `wasm-bindgen` crate version) → `app.js`/`app_bg.wasm` + `index.html`.
use anyhow::{bail, Context, Result};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

/// Rust ≥ 1.93 no longer links wasm32 with `--allow-undefined`; macroquad's audio/GL imports are provided by the JS bundle.
const WASM_FLAGS: &str =
    r#"target.wasm32-unknown-unknown.rustflags=["-C","link-arg=--allow-undefined"]"#;

fn tool_exists(name: &str, arg: &str) -> bool {
    Command::new(name)
        .arg(arg)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

fn wasm_target_installed() -> bool {
    Command::new("rustup")
        .args(["target", "list", "--installed"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("wasm32-unknown-unknown"))
        // no rustup (distro Rust): assume the user knows; cargo will complain clearly
        .unwrap_or(true)
}

/// Run `cargo build` for the wasm32 target in `project`, streaming each output line (short, colour-free diagnostics) to `on_line`.
/// Returns the path of the produced `.wasm` (inside `target/wasm32-unknown-unknown/<profile>/`).
pub fn cargo_build(
    project: &Path,
    release: bool,
    on_line: &mut dyn FnMut(&str),
) -> Result<PathBuf> {
    if !project.join("Cargo.toml").exists() {
        bail!(
            "{} has no Cargo.toml (not a Rust project)",
            project.display()
        );
    }
    if !tool_exists("cargo", "--version") {
        bail!("cargo not found — install Rust from https://rustup.rs");
    }
    if !wasm_target_installed() {
        bail!("the wasm32 target is missing: run `rustup target add wasm32-unknown-unknown`");
    }
    let mut cmd = Command::new("cargo");
    cmd.current_dir(project)
        .args([
            "build",
            "--target",
            "wasm32-unknown-unknown",
            "--color",
            "never",
            "--message-format",
            "short",
            "--config",
            WASM_FLAGS,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    if release {
        cmd.arg("--release");
    }
    let mut child = cmd.spawn().context("starting cargo")?;
    let mut tail: Vec<String> = vec![];
    if let Some(err) = child.stderr.take() {
        for line in BufReader::new(err).lines().map_while(|l| l.ok()) {
            on_line(&line);
            tail.push(line);
            if tail.len() > 30 {
                tail.remove(0);
            }
        }
    }
    let st = child.wait()?;
    if !st.success() {
        bail!("cargo build failed:\n{}", tail.join("\n"));
    }
    find_wasm(project, release)
}

fn find_wasm(project: &Path, release: bool) -> Result<PathBuf> {
    let dir = project
        .join("target/wasm32-unknown-unknown")
        .join(if release { "release" } else { "debug" });
    let mut found: Vec<(std::time::SystemTime, PathBuf)> = fs::read_dir(&dir)
        .with_context(|| format!("reading {}", dir.display()))?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "wasm"))
        .filter_map(|p| Some((fs::metadata(&p).ok()?.modified().ok()?, p)))
        .collect();
    found.sort_by_key(|b| std::cmp::Reverse(b.0));
    // prefer the conventional bin name
    found
        .iter()
        .find(|(_, p)| p.file_stem().is_some_and(|s| s == "game" || s == "app"))
        .or(found.first())
        .map(|(_, p)| p.clone())
        .with_context(|| format!("no .wasm produced in {}", dir.display()))
}

/// Dev build for the editor / `nord build-rust`: cargo build, then stage in `target/web/` — `game.wasm` for a wasm-game, wasm-bindgen output
/// (`app.js` + `app_bg.wasm`) for a wasm-app — which is what the project's dev `index.html` loads. Returns the main staged file.
pub fn dev_build(project: &Path, release: bool, on_line: &mut dyn FnMut(&str)) -> Result<PathBuf> {
    let kind = nord_core::io::load_project(project)?.kind;
    let wasm = cargo_build(project, release, on_line)?;
    let dir = project.join("target/web");
    fs::create_dir_all(&dir)?;
    if kind == nord_core::ProjectType::WasmApp {
        on_line("wasm-bindgen …");
        bindgen(&wasm, &dir)?;
        return Ok(dir.join("app.js"));
    }
    let dst = dir.join("game.wasm");
    fs::copy(&wasm, &dst)?;
    Ok(dst)
}

/// `file:line:col` of the first rustc diagnostic location in a `--message-format short` line (`src/main.rs:12:5: error[E0308]: …`).
pub fn parse_diagnostic(line: &str) -> Option<(String, u32, u32, bool)> {
    let mut it = line.splitn(4, ':');
    let (file, l, c, rest) = (it.next()?, it.next()?, it.next()?, it.next()?);
    let (l, c) = (l.trim().parse().ok()?, c.trim().parse().ok()?);
    if file.contains(' ') || !(rest.contains("error") || rest.contains("warning")) {
        return None;
    }
    Some((file.to_string(), l, c, rest.contains("error")))
}

/// Shrink with `wasm-opt -Oz` when available; returns a note either way.
pub fn optimize_wasm(wasm: &Path) -> String {
    if !tool_exists("wasm-opt", "--version") {
        return "wasm-opt not found: install binaryen for a smaller .wasm (skipped)".into();
    }
    let before = fs::metadata(wasm).map_or(0, |m| m.len());
    let tmp = wasm.with_extension("opt.wasm");
    let ok = Command::new("wasm-opt")
        .args(["-Oz", "--all-features", "-o"])
        .arg(&tmp)
        .arg(wasm)
        .status()
        .is_ok_and(|s| s.success());
    if ok && fs::rename(&tmp, wasm).is_ok() {
        format!(
            "wasm-opt: {} KB → {} KB",
            before / 1024,
            fs::metadata(wasm).map_or(0, |m| m.len()) / 1024
        )
    } else {
        let _ = fs::remove_file(&tmp);
        "wasm-opt failed (kept the unoptimised .wasm)".into()
    }
}

pub fn game_index_html(title: &str, background: &str, touch: &str) -> String {
    format!(
        "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{title}</title>\n<style>html,body{{margin:0;height:100%;background:{background};overflow:hidden}}canvas{{width:100vw;height:100vh;display:block}}</style></head>\n<body>\n<canvas id=\"glcanvas\" tabindex=\"1\"></canvas>\n<script src=\"mq_js_bundle.js\"></script>\n<script>load(\"game.wasm\");</script>\n{touch}\n</body></html>\n"
    )
}

pub fn app_index_html(title: &str, background: &str, touch: &str) -> String {
    format!(
        "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{title}</title>\n<style>html,body{{margin:0;height:100%;background:{background};overflow:hidden}}canvas{{width:100%;height:100%;display:block}}</style></head>\n<body>\n<canvas id=\"the_canvas_id\"></canvas>\n<script type=\"module\">\nimport init from './app.js';\ninit().catch((e) => {{ console.error(e); document.body.textContent = String(e); }});\n</script>\n{touch}\n</body></html>\n"
    )
}

/// Run the `wasm-bindgen` CLI (`--target web`) on a built wasm, writing `app.js` + `app_bg.wasm` into `out`.
pub fn bindgen(wasm: &Path, out: &Path) -> Result<()> {
    if !tool_exists("wasm-bindgen", "--version") {
        bail!("wasm-bindgen CLI not found: `cargo install wasm-bindgen-cli --version <the wasm-bindgen version in your Cargo.lock>`");
    }
    let st = Command::new("wasm-bindgen")
        .args([
            "--target",
            "web",
            "--no-typescript",
            "--out-name",
            "app",
            "--out-dir",
        ])
        .arg(out)
        .arg(wasm)
        .status()
        .context("running wasm-bindgen")?;
    if !st.success() {
        bail!("wasm-bindgen failed (its version must equal the `wasm-bindgen` crate version in Cargo.lock)");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_short_diagnostics() {
        assert_eq!(
            parse_diagnostic("src/main.rs:12:5: error[E0308]: mismatched types"),
            Some(("src/main.rs".into(), 12, 5, true))
        );
        assert_eq!(
            parse_diagnostic("src/lib.rs:3:1: warning: unused import: `x`"),
            Some(("src/lib.rs".into(), 3, 1, false))
        );
        assert_eq!(parse_diagnostic("   Compiling foo v0.1.0 (/x/y)"), None);
    }

    #[test]
    fn index_pages_reference_relative_files() {
        let g = game_index_html("T", "#000", "<!--t-->");
        assert!(g.contains("src=\"mq_js_bundle.js\"") && g.contains("load(\"game.wasm\")"));
        assert!(app_index_html("T", "#000", "").contains("./app.js"));
    }
}
