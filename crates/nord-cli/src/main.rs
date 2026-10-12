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
        /// html | 2d | 3d | wasm-game | wasm-app, or a starter id from templates/ (e.g. platformer, fps-arena)
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
    /// Build a static, offline web export (web-2d / web-3d / html / web-wasm-game / web-wasm-app) into a folder
    #[command(alias = "export")]
    Build {
        #[arg(default_value = ".")]
        project: PathBuf,
        /// auto | html | web-2d | web-3d | web-wasm-game | web-wasm-app
        #[arg(short, long, default_value = "auto")]
        target: String,
        /// Output folder (default: <project>/dist)
        #[arg(short, long)]
        out: Option<PathBuf>,
        /// Minify JS and JSON
        #[arg(long)]
        minify: bool,
        /// One index.html with everything inlined (works from file://)
        #[arg(long)]
        single_file: bool,
        /// Lossless PNG recompression, WAV→MP3 when ffmpeg is installed
        #[arg(long)]
        optimize: bool,
        /// Also write <out>.zip (for itch.io style uploads)
        #[arg(long)]
        zip: bool,
    },
    /// Build a Rust (wasm-game / wasm-app) project for `nord serve`: cargo build → target/web/
    BuildRust {
        #[arg(default_value = ".")]
        project: PathBuf,
        /// optimised build (slower, smaller)
        #[arg(long)]
        release: bool,
    },
    /// Wrap a web build (or a project, built first) into a macOS .app using the prebuilt nord-player shell
    BundleMac {
        /// A web build folder (nord build output) or a project folder
        #[arg(default_value = ".")]
        input: PathBuf,
        #[arg(long)]
        name: Option<String>,
        /// Output folder for the .app (default: current directory)
        #[arg(short, long, default_value = ".")]
        out: PathBuf,
        /// nord-player binary or NordPlayer.app (default: auto-detect)
        #[arg(long)]
        player: Option<PathBuf>,
        /// PNG for the app icon
        #[arg(long)]
        icon: Option<PathBuf>,
        /// Also create a .dmg (macOS only)
        #[arg(long)]
        dmg: bool,
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

fn new_project(dir: &Path, requested: &str) -> anyhow::Result<()> {
    let template = match requested {
        "wasm-game" => "rust-2d-game",
        "wasm-app" => "rust-egui-app",
        t => t,
    };
    // a starter from `templates/<id>` (see `templates/templates.json`) wins over the built-in project types
    if let Some(src) = nord_serve::engine_root()
        .map(|r| r.join("templates").join(template))
        .filter(|p| p.join(nord_core::io::PROJECT_FILE).exists())
    {
        return Ok(nord_core::project::create_from_template(&src, dir)?);
    }
    let kind: ProjectType = serde_json::from_value(serde_json::Value::String(requested.into()))
        .with_context(|| {
            format!("unknown template '{requested}' (html, 2d, 3d, wasm-game, wasm-app, or an id from templates/templates.json)")
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
        Cmd::BuildRust { project, release } => {
            let out = nord_export::rust::dev_build(&project, release, &mut |l| eprintln!("{l}"))?;
            println!(
                "Built {} — run `nord serve {}`",
                out.display(),
                project.display()
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
        Cmd::Build {
            project,
            target,
            out,
            minify,
            single_file,
            optimize,
            zip,
        } => {
            let engine =
                nord_serve::engine_root().context("engine root not found (set NORD_ROOT)")?;
            let r = nord_export::build(
                &project,
                &engine,
                &nord_export::Opts {
                    target: target.parse().map_err(anyhow::Error::msg)?,
                    out,
                    minify,
                    single_file,
                    optimize,
                    zip,
                },
            )?;
            print!("{}", r.summary());
        }
        Cmd::BundleMac {
            input,
            name,
            out,
            player,
            icon,
            dmg,
        } => {
            let engine =
                nord_serve::engine_root().context("engine root not found (set NORD_ROOT)")?;
            let is_dist = input.join("nord.json").exists() && input.join("index.html").exists();
            let dist = if is_dist {
                input.clone()
            } else {
                let tmp = std::env::temp_dir().join(format!("nord-bundle-{}", std::process::id()));
                let r = nord_export::build(
                    &input,
                    &engine,
                    &nord_export::Opts {
                        out: Some(tmp),
                        minify: true,
                        ..Default::default()
                    },
                )?;
                print!("{}", r.summary());
                r.out
            };
            std::fs::create_dir_all(&out)?;
            let app = nord_export::mac::bundle_mac(
                &dist,
                &engine,
                &nord_export::mac::BundleOpts {
                    name,
                    out_dir: out,
                    player,
                    icon,
                    dmg,
                },
            )?;
            println!("App: {}", app.display());
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
