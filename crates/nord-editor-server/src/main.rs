//! `nord-editor-server` — run the Nord editor in browsers, from a Linux (or any) machine. See docs/WEB_EDITOR.md.
use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use nord_editor_server::{hash_password, parse_users, router, AuthMode, Config};
use std::{net::SocketAddr, path::PathBuf, time::Duration};

#[derive(Parser)]
#[command(version, about = "Nord Engine editor in the browser: serves the web editor and a project API for several users", long_about = "Serves the wasm editor (build it with tools/build-web-editor.sh) and keeps projects in <workspace>/<user>/<project>.\nBinds 127.0.0.1 by default; put nginx/Caddy with TLS in front for remote use (see docs/WEB_EDITOR.md).\nBackups: the workspace folder is plain files — back it up with rsync/restic/ZFS snapshots.")]
struct Cli {
    #[command(subcommand)]
    cmd: Option<Cmd>,
    #[command(flatten)]
    serve: ServeArgs,
}

#[derive(Subcommand)]
enum Cmd {
    /// Print an argon2 hash for a users-file line (`name:hash`); reads the password from stdin
    HashPassword,
}

#[derive(clap::Args)]
struct ServeArgs {
    /// Address to listen on (default: loopback only)
    #[arg(long, default_value = "127.0.0.1:8787")]
    listen: SocketAddr,
    /// Where users' projects live: <workspace>/<user>/<project>
    #[arg(long, default_value = "./nord-workspace")]
    workspace: PathBuf,
    /// Built web editor folder (tools/build-web-editor.sh → dist/web-editor)
    #[arg(long, default_value = "dist/web-editor")]
    web: PathBuf,
    /// Engine folder for export jobs (NORD_ROOT); default: $NORD_ROOT or walk up from the executable
    #[arg(long)]
    engine: Option<PathBuf>,
    /// The `nord` CLI that runs export jobs (default: next to this executable, else PATH)
    #[arg(long)]
    nord: Option<PathBuf>,
    /// One shared login token (default: a random one is printed at start-up)
    #[arg(long, env = "NORD_TOKEN")]
    token: Option<String>,
    /// Users file: one `name:argon2-hash` per line (see `hash-password`); each user gets their own workspace
    #[arg(long)]
    users: Option<PathBuf>,
    /// No login at all (only accepted on a loopback address)
    #[arg(long)]
    no_auth: bool,
    /// Per-user workspace limit in MB
    #[arg(long, default_value_t = 2048)]
    quota_mb: u64,
    /// Largest single upload in MB
    #[arg(long, default_value_t = 256)]
    max_upload_mb: usize,
    /// Export job time limit in seconds
    #[arg(long, default_value_t = 600)]
    job_timeout: u64,
    /// Parallel jobs per user
    #[arg(long, default_value_t = 2)]
    jobs_per_user: usize,
    /// Allow Rust/WASM project builds (cargo executes project code: only inside a container)
    #[arg(long)]
    allow_rust_jobs: bool,
    /// Mark the session cookie Secure (use when served over HTTPS)
    #[arg(long)]
    secure_cookies: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    if let Some(Cmd::HashPassword) = cli.cmd {
        let mut pw = String::new();
        std::io::stdin().read_line(&mut pw)?;
        println!("{}", hash_password(pw.trim_end_matches(['\r', '\n']))?);
        return Ok(());
    }
    let a = cli.serve;
    let mut cfg = Config::new(a.workspace.clone());
    cfg.web = a.web.join("index.html").is_file().then(|| a.web.clone());
    cfg.engine = a.engine.clone().or_else(|| std::env::var_os("NORD_ROOT").map(PathBuf::from));
    cfg.nord_bin = a.nord.clone();
    cfg.quota_bytes = a.quota_mb << 20;
    cfg.max_upload = a.max_upload_mb << 20;
    cfg.job_timeout = Duration::from_secs(a.job_timeout);
    cfg.max_jobs_per_user = a.jobs_per_user.max(1);
    cfg.allow_rust_jobs = a.allow_rust_jobs;
    cfg.secure_cookies = a.secure_cookies;
    let mut shown_token = None;
    cfg.auth = if let Some(f) = &a.users {
        let users = parse_users(&std::fs::read_to_string(f).with_context(|| f.display().to_string())?);
        if users.is_empty() {
            bail!("{} has no valid `name:argon2-hash` lines", f.display());
        }
        AuthMode::Users(users)
    } else if a.no_auth {
        if !a.listen.ip().is_loopback() {
            bail!("--no-auth is only allowed on a loopback address (127.0.0.1 / ::1)");
        }
        AuthMode::None
    } else if let Some(t) = a.token {
        if t.len() < 12 {
            bail!("--token must be at least 12 characters");
        }
        AuthMode::Token(t)
    } else {
        let mut b = [0u8; 18];
        getrandom_fill(&mut b)?;
        let t: String = b.iter().map(|x| format!("{x:02x}")).collect();
        shown_token = Some(t.clone());
        AuthMode::Token(t)
    };
    if cfg.web.is_none() {
        eprintln!("note: {} has no index.html — serving the API only (run tools/build-web-editor.sh)", a.web.display());
    }
    let listener = tokio::net::TcpListener::bind(a.listen).await.with_context(|| format!("cannot listen on {}", a.listen))?;
    println!("Nord editor server on http://{}", listener.local_addr()?);
    println!("workspace: {}", a.workspace.display());
    if let Some(t) = shown_token {
        println!("login token: {t}   (pass --token to choose your own)");
    }
    if !a.listen.ip().is_loopback() {
        println!("warning: listening beyond loopback — put TLS (nginx/Caddy) in front and use --secure-cookies");
    }
    axum::serve(listener, router(cfg)).await?;
    Ok(())
}

fn getrandom_fill(b: &mut [u8]) -> Result<()> {
    getrandom::getrandom(b).map_err(|e| anyhow::anyhow!("no OS randomness: {e}"))
}
