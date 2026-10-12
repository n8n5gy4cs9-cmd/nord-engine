use clap::{Parser, Subcommand};

/// Nord Engine CLI — Crowelian 2026 + Sonnet.
#[derive(Parser)]
#[command(name = "nord", version, about)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Print engine info (placeholder until M1: new, serve, build, export, thumbs, check-offline, bundle-mac, doctor)
    Info,
}

fn main() -> anyhow::Result<()> {
    match Cli::parse().cmd {
        Cmd::Info => println!(
            "Nord Engine {} — Crowelian 2026 + Sonnet",
            env!("CARGO_PKG_VERSION")
        ),
    }
    Ok(())
}
