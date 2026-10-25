//! Optional "Build templates" via Colima/Docker (or Podman): builds the Linux / Windows `nord-player` in a container so a Mac editor
//! needs no CI. The repo is mounted read-only, output goes to a volume, then `templates::install_files` writes manifest + sha256.
//! Mac players cannot be built in a container (Apple SDK): use a Mac host or CI.
use crate::templates::{self, Platform};
use anyhow::{bail, Context, Result};
use std::{
    io::{BufRead, BufReader},
    path::Path,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    time::Duration,
};

fn on_path(cmd: &str) -> bool {
    let probe = if cfg!(windows) { "where" } else { "which" };
    Command::new(probe)
        .arg(cmd)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

/// `docker` or `podman`, whichever is on the PATH.
pub fn container_tool() -> Option<&'static str> {
    ["docker", "podman"].into_iter().find(|c| on_path(c))
}

pub fn has_colima() -> bool {
    on_path("colima")
}

/// Exact install steps for this OS, shown when the tools are missing (nothing is ever installed silently).
pub fn install_steps() -> &'static str {
    if cfg!(target_os = "macos") {
        "Install once in Terminal:  brew install colima docker   then   colima start"
    } else if cfg!(windows) {
        "Install Docker Desktop (or Podman Desktop) from its website, start it, then press Check again."
    } else {
        "Install docker or podman with your package manager (e.g. sudo apt install docker.io), start it, then press Check again."
    }
}

/// Targets a container can build: Linux and Windows only.
pub fn buildable(p: Platform) -> bool {
    !p.is_mac()
}

fn run_streamed(mut c: Command, log: &dyn Fn(String), cancel: &Arc<AtomicBool>) -> Result<()> {
    let mut child = c
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("cannot start the container tool")?;
    let (tx, rx) = mpsc::channel::<String>();
    for pipe in [
        child
            .stdout
            .take()
            .map(|p| Box::new(p) as Box<dyn std::io::Read + Send>),
        child
            .stderr
            .take()
            .map(|p| Box::new(p) as Box<dyn std::io::Read + Send>),
    ]
    .into_iter()
    .flatten()
    {
        let tx = tx.clone();
        std::thread::spawn(move || {
            for l in BufReader::new(pipe).lines().map_while(Result::ok) {
                let _ = tx.send(l);
            }
        });
    }
    drop(tx);
    loop {
        match rx.recv_timeout(Duration::from_millis(200)) {
            Ok(l) => log(l),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
        if cancel.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            bail!("cancelled");
        }
    }
    if !child.wait()?.success() {
        bail!("the container command failed (see the log above)");
    }
    Ok(())
}

/// Build the template for `p` from the repo at `engine` and install it. Blocking: run it on a worker thread.
pub fn build(
    p: Platform,
    engine: &Path,
    log: &dyn Fn(String),
    cancel: &Arc<AtomicBool>,
) -> Result<()> {
    if !buildable(p) {
        bail!(
            "Mac players can only be built on a Mac (or CI): Apple's SDK cannot run in a container"
        );
    }
    let tool = container_tool()
        .with_context(|| format!("docker/podman not found. {}", install_steps()))?;
    let dockerfile = engine.join(format!("docker/Dockerfile.{}", p.id()));
    if !dockerfile.exists() {
        bail!(
            "{} not found: the engine folder has no docker/ directory",
            dockerfile.display()
        );
    }
    if has_colima()
        && !Command::new("colima")
            .arg("status")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    {
        log("Starting Colima…".into());
        run_streamed(
            {
                let mut c = Command::new("colima");
                c.arg("start");
                c
            },
            log,
            cancel,
        )?;
    }
    let image = format!("nord-template-{}", p.id());
    let platform = if p == Platform::LinuxArm64 {
        "linux/arm64"
    } else {
        "linux/amd64"
    };
    log(format!(
        "Building image {image} (first time 10-30 minutes)…"
    ));
    let mut b = Command::new(tool);
    b.args(["build", "--platform", platform, "-t", &image, "-f"])
        .arg(&dockerfile)
        .arg(engine.join("docker"));
    run_streamed(b, log, cancel)?;
    let out = std::env::temp_dir().join(format!("nord-tpl-out-{}-{}", p.id(), std::process::id()));
    let _ = std::fs::remove_dir_all(&out);
    std::fs::create_dir_all(&out)?;
    log("Compiling nord-player in the container…".into());
    let mut r = Command::new(tool);
    r.args(["run", "--rm", "--platform", platform, "-v"])
        .arg(format!("{}:/src:ro", engine.display()))
        .arg("-v")
        .arg(format!("{}:/out", out.display()))
        .arg(&image);
    run_streamed(r, log, cancel)?;
    let player = out.join(p.player_file());
    if !player.is_file() {
        bail!("the container finished but produced no {}", p.player_file());
    }
    let extra: Vec<_> = std::fs::read_dir(&out)?
        .flatten()
        .map(|e| e.path())
        .filter(|f| f.extension().is_some_and(|e| e == "dll"))
        .collect();
    templates::install_files(p, &player, &extra)?;
    let _ = std::fs::remove_dir_all(&out);
    Ok(())
}
