use anyhow::{bail, Context};
use clap::{Parser, Subcommand};
use nord_core::{assets, offline, thumbs, validate, ProjectType};
use std::path::{Path, PathBuf};

/// Nord Engine CLI — Crowelian 2026 + Sonnet.
#[derive(Parser)]
#[command(name = "nord", version, about)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Print engine info
    Info,
    /// Create a new project from a template
    New {
        /// Directory to create (its name becomes the project name)
        dir: PathBuf,
        /// html | 2d | 3d | wasm-game | wasm-app
        #[arg(short, long, default_value = "html")]
        template: String,
    },
    /// Check the toolchain and recommend a project tier
    Doctor,
    /// Generate thumbnails for all project assets into .nord-cache/thumbs
    Thumbs {
        #[arg(default_value = ".")]
        project: PathBuf,
    },
    /// Validate project + scenes (ids, missing files)
    Check {
        #[arg(default_value = ".")]
        project: PathBuf,
    },
    /// Dev server with live reload and /api/* editor backend
    Serve {
        #[arg(default_value = ".")]
        project: PathBuf,
        #[arg(short, long, default_value_t = 4173)]
        port: u16,
    },
    /// Fail if a directory (build output or project) references external http(s) hosts
    CheckOffline {
        #[arg(default_value = ".")]
        dir: PathBuf,
        /// Extra allowed host (repeatable); `.offline-allow` in the dir is also read
        #[arg(long)]
        allow: Vec<String>,
    },
    /// Vendored library tools
    Vendor {
        /// Verify sha256 of vendored files against vendor/VENDOR.json
        #[arg(long)]
        verify: bool,
    },
}

fn new_project(dir: &Path, template: &str) -> anyhow::Result<()> {
    let kind: ProjectType = serde_json::from_value(serde_json::Value::String(template.into()))
        .with_context(|| {
            format!("unknown template '{template}' (html, 2d, 3d, wasm-game, wasm-app)")
        })?;
    Ok(nord_core::project::create(dir, kind)?)
}

fn doctor() {
    fn ver(cmd: &str, arg: &str) -> Option<String> {
        let o = std::process::Command::new(cmd).arg(arg).output().ok()?;
        o.status.success().then(|| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string()
        })
    }
    let node = ver("node", "--version");
    let cargo = ver("cargo", "--version");
    let wasm = std::process::Command::new("rustup")
        .args(["target", "list", "--installed"])
        .output()
        .ok()
        .is_some_and(|o| String::from_utf8_lossy(&o.stdout).contains("wasm32-unknown-unknown"));
    let ffmpeg = ver("ffmpeg", "-version");
    let show =
        |n: &str, v: &Option<String>| println!("{:<8} {}", n, v.as_deref().unwrap_or("missing"));
    show("node", &node);
    show("cargo", &cargo);
    println!(
        "{:<8} {}",
        "wasm32",
        if wasm {
            "installed"
        } else {
            "missing (rustup target add wasm32-unknown-unknown)"
        }
    );
    show("ffmpeg", &ffmpeg);
    println!(
        "{:<8} {}",
        "engine",
        nord_serve::engine_root()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "not found (set NORD_ROOT)".into())
    );
    println!("\nRecommended tier:");
    println!(
        "  html / 2d / 3d  -> always available (vendored Phaser/Babylon, no toolchain needed)"
    );
    if cargo.is_some() && wasm {
        println!("  wasm-game / wasm-app -> available");
    } else {
        println!("  wasm-game / wasm-app -> needs cargo + wasm32 target");
    }
}

fn run_vendor_verify() -> anyhow::Result<()> {
    let root = nord_serve::engine_root().context("engine root not found (set NORD_ROOT)")?;
    let st = std::process::Command::new("node")
        .arg(root.join("tools/vendor.mjs"))
        .arg("--verify")
        .current_dir(&root)
        .status()
        .context("running node")?;
    if !st.success() {
        bail!("vendor verification failed");
    }
    Ok(())
}

fn main() -> anyhow::Result<()> {
    match Cli::parse().cmd {
        Cmd::Info => println!(
            "Nord Engine {} — Crowelian 2026 + Sonnet",
            env!("CARGO_PKG_VERSION")
        ),
        Cmd::New { dir, template } => {
            new_project(&dir, &template)?;
            println!(
                "Created {} project in {}\nNext: nord serve {}",
                template,
                dir.display(),
                dir.display()
            );
        }
        Cmd::Doctor => doctor(),
        Cmd::Thumbs { project } => {
            let a = assets::scan(&project)?;
            let (ok, skip, bad) = thumbs::generate_all(&project, &a);
            println!(
                "{ok} thumbnails ready, {skip} without thumbnail type, {} failed",
                bad.len()
            );
            bad.iter().for_each(|b| eprintln!("  {b}"));
            if !bad.is_empty() {
                std::process::exit(1);
            }
        }
        Cmd::Check { project } => {
            let issues = validate::validate_project(&project);
            issues
                .iter()
                .for_each(|i| eprintln!("{}: {}", i.file, i.msg));
            if !issues.is_empty() {
                bail!("{} problem(s) found", issues.len());
            }
            println!("OK");
        }
        Cmd::Serve { project, port } => {
            let engine =
                nord_serve::engine_root().context("engine root not found (set NORD_ROOT)")?;
            tokio::runtime::Runtime::new()?.block_on(nord_serve::run(project, engine, port))?;
        }
        Cmd::CheckOffline { dir, allow } => {
            let f = offline::scan_dir(&dir, &allow);
            f.iter()
                .for_each(|f| eprintln!("{}:{}: external URL {}", f.file, f.line, f.url));
            if !f.is_empty() {
                bail!("{} external reference(s) found", f.len());
            }
            println!("OK: no external references in {}", dir.display());
        }
        Cmd::Vendor { verify } => {
            if !verify {
                bail!("use --verify (install via `node tools/vendor.mjs`)");
            }
            run_vendor_verify()?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_html_project_is_valid() {
        let d = std::env::temp_dir().join(format!("nord-new-{}/My Game", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        new_project(&d, "html").unwrap();
        assert!(d.join("index.html").exists());
        let issues = nord_core::validate::validate_project(&d);
        assert!(issues.is_empty(), "{issues:?}");
        assert!(new_project(&d, "html").is_err());
        let d2 = d.with_file_name("g2d");
        new_project(&d2, "2d").unwrap();
        assert!(nord_core::validate::validate_project(&d2).is_empty());
    }
}
