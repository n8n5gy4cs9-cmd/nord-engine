//! Export templates (idea from Godot's export templates / Unity's build-support modules): a prebuilt `nord-player` per OS + arch, stored in
//! `<config>/templates/<engine version>/<platform>/` next to a `manifest.json` (engine version + sha256). Desktop export wraps them,
//! so any editor can make Mac / Windows / Linux apps without a compiler. Also: the desktop export entry point used by the editor and CLI.
use crate::{mac, portable};
use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    MacArm64,
    MacX64,
    WindowsX64,
    LinuxX64,
    LinuxArm64,
}

impl Platform {
    pub const ALL: [Platform; 5] = [
        Platform::MacArm64,
        Platform::MacX64,
        Platform::WindowsX64,
        Platform::LinuxX64,
        Platform::LinuxArm64,
    ];
    pub fn id(self) -> &'static str {
        match self {
            Platform::MacArm64 => "mac-arm64",
            Platform::MacX64 => "mac-x64",
            Platform::WindowsX64 => "windows-x64",
            Platform::LinuxX64 => "linux-x64",
            Platform::LinuxArm64 => "linux-arm64",
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Platform::MacArm64 => "Mac (Apple silicon)",
            Platform::MacX64 => "Mac (Intel)",
            Platform::WindowsX64 => "Windows (x64)",
            Platform::LinuxX64 => "Linux (x64)",
            Platform::LinuxArm64 => "Linux (arm64)",
        }
    }
    pub fn from_id(s: &str) -> Option<Platform> {
        Platform::ALL.into_iter().find(|p| p.id() == s)
    }
    pub fn is_mac(self) -> bool {
        matches!(self, Platform::MacArm64 | Platform::MacX64)
    }
    pub fn is_windows(self) -> bool {
        self == Platform::WindowsX64
    }
    /// File name of the player inside a template.
    pub fn player_file(self) -> &'static str {
        if self.is_windows() {
            "nord-player.exe"
        } else {
            "nord-player"
        }
    }
    /// The platform this editor runs on (its own bundled player is used when no template is installed).
    pub fn host() -> Option<Platform> {
        match (std::env::consts::OS, std::env::consts::ARCH) {
            ("macos", "aarch64") => Some(Platform::MacArm64),
            ("macos", "x86_64") => Some(Platform::MacX64),
            ("windows", "x86_64") => Some(Platform::WindowsX64),
            ("linux", "x86_64") => Some(Platform::LinuxX64),
            ("linux", "aarch64") => Some(Platform::LinuxArm64),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub engine_version: String,
    pub platform: String,
    /// player file name inside the template folder
    pub file: String,
    pub sha256: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Status {
    Missing,
    /// version, size of the player in bytes
    Installed(String, u64),
    /// manifest unreadable, wrong version or wrong checksum
    Bad(String),
}

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn dir(p: Platform) -> PathBuf {
    nord_core::io::config_dir()
        .join("templates")
        .join(version())
        .join(p.id())
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut f = fs::File::open(path)?;
    let (mut h, mut buf) = (Sha256::new(), vec![0u8; 1 << 16]);
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Checks manifest, engine version and sha256 of a template folder; returns the player path.
fn verify(d: &Path) -> Result<PathBuf> {
    let m: Manifest = serde_json::from_slice(&fs::read(d.join("manifest.json"))?)
        .context("manifest.json is not valid")?;
    if m.engine_version != version() {
        bail!(
            "template is for Nord {} but this editor is {}",
            m.engine_version,
            version()
        );
    }
    let player = d.join(&m.file);
    if sha256_file(&player).context("template player file is missing")? != m.sha256 {
        bail!("checksum (sha256) does not match: the template is damaged, install it again");
    }
    Ok(player)
}

pub fn status(p: Platform) -> Status {
    let d = dir(p);
    if !d.join("manifest.json").exists() {
        return Status::Missing;
    }
    match verify(&d) {
        Ok(f) => Status::Installed(
            version().into(),
            fs::metadata(f).map(|m| m.len()).unwrap_or(0),
        ),
        Err(e) => Status::Bad(format!("{e:#}")),
    }
}

/// Install a freshly built player (plus sibling files such as Windows DLLs) as the template for `p`.
pub fn install_files(p: Platform, player: &Path, extra: &[PathBuf]) -> Result<()> {
    let d = dir(p);
    let _ = fs::remove_dir_all(&d);
    fs::create_dir_all(&d)?;
    fs::copy(player, d.join(p.player_file()))?;
    for f in extra {
        if let Some(n) = f.file_name() {
            fs::copy(f, d.join(n))?;
        }
    }
    let m = Manifest {
        engine_version: version().into(),
        platform: p.id().into(),
        file: p.player_file().into(),
        sha256: sha256_file(&d.join(p.player_file()))?,
    };
    fs::write(d.join("manifest.json"), serde_json::to_vec_pretty(&m)?)?;
    Ok(())
}

/// Install a `.nordtemplates` zip (`manifest.json` + files at the top level). Returns the platform it was for.
pub fn install_zip(zip_path: &Path) -> Result<Platform> {
    let mut z = zip::ZipArchive::new(fs::File::open(zip_path).context("cannot open the file")?)
        .context("not a .nordtemplates file (zip expected)")?;
    let m: Manifest = {
        let mut s = String::new();
        z.by_name("manifest.json")
            .context("manifest.json missing in the template file")?
            .read_to_string(&mut s)?;
        serde_json::from_str(&s)?
    };
    if m.engine_version != version() {
        bail!(
            "template is for Nord {} but this editor is {}; get the matching one",
            m.engine_version,
            version()
        );
    }
    let p = Platform::from_id(&m.platform)
        .ok_or_else(|| anyhow!("unknown platform '{}' in the template", m.platform))?;
    let tmp = dir(p).with_extension("installing");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp)?;
    for i in 0..z.len() {
        let mut f = z.by_index(i)?;
        let Some(name) = f
            .enclosed_name()
            .and_then(|n| n.file_name().map(PathBuf::from))
        else {
            continue;
        };
        if f.is_dir() {
            continue;
        }
        let mut out = fs::File::create(tmp.join(name))?;
        std::io::copy(&mut f, &mut out)?;
    }
    if let Err(e) = verify(&tmp) {
        let _ = fs::remove_dir_all(&tmp);
        return Err(e);
    }
    let d = dir(p);
    let _ = fs::remove_dir_all(&d);
    fs::rename(&tmp, &d)?;
    Ok(p)
}

/// Pack an installed template into `<out_dir>/nord-player-<platform>-<version>.nordtemplates` (CI uploads these).
pub fn pack(p: Platform, player: &Path, extra: &[PathBuf], out_dir: &Path) -> Result<PathBuf> {
    let m = Manifest {
        engine_version: version().into(),
        platform: p.id().into(),
        file: p.player_file().into(),
        sha256: sha256_file(player)?,
    };
    let out = out_dir.join(format!("nord-player-{}.nordtemplates", p.id()));
    let mut z = zip::ZipWriter::new(fs::File::create(&out)?);
    let opt = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);
    z.start_file("manifest.json", opt)?;
    z.write_all(&serde_json::to_vec_pretty(&m)?)?;
    z.start_file(p.player_file(), opt)?;
    z.write_all(&fs::read(player)?)?;
    for f in extra {
        if let Some(n) = f.file_name() {
            z.start_file(n.to_string_lossy(), opt)?;
            z.write_all(&fs::read(f)?)?;
        }
    }
    z.finish()?;
    Ok(out)
}

pub fn remove(p: Platform) -> Result<()> {
    let d = dir(p);
    if d.exists() {
        fs::remove_dir_all(&d)
            .context("cannot remove the template folder (no write permission?)")?;
    }
    Ok(())
}

pub fn download_url(p: Platform) -> String {
    format!(
        "https://github.com/n8n5gy4cs9-cmd/nord-engine/releases/download/v{}/nord-player-{}.nordtemplates",
        version(),
        p.id()
    )
}

/// Download the template of this exact version with `curl` (ships with macOS, Windows 10+ and Linux). Never panics; offline gives an error.
pub fn download(p: Platform) -> Result<()> {
    let tmp = std::env::temp_dir().join(format!(
        "nord-{}-{}.nordtemplates",
        p.id(),
        std::process::id()
    ));
    let ok = Command::new("curl")
        .args(["-fsSL", "--max-time", "600", "-o"])
        .arg(&tmp)
        .arg(download_url(p))
        .status()
        .map_err(|_| anyhow!("curl not found; download the .nordtemplates file in a browser and use Install from file"))?
        .success();
    if !ok {
        let _ = fs::remove_file(&tmp);
        bail!(
            "download failed (offline, or no release v{} with this template yet); use Install from file instead",
            version()
        );
    }
    let r = install_zip(&tmp);
    let _ = fs::remove_file(&tmp);
    r.map(|_| ())
}

#[derive(Debug, Clone)]
pub struct DesktopOpts {
    pub platform: Platform,
    pub name: Option<String>,
    pub out_dir: PathBuf,
    pub icon: Option<PathBuf>,
    /// Mac: make a .dmg (Mac host only). Windows / Linux: .zip / .tar.gz. Mac without dmg: a .zip of the .app.
    pub archive: bool,
}

/// The template player for `p`, else this editor's own bundled player when `p` is the host platform.
fn player_for(p: Platform, engine: &Path) -> Result<PathBuf> {
    match status(p) {
        Status::Installed(..) => return verify(&dir(p)),
        Status::Bad(e) => bail!("{} template: {e}", p.label()),
        Status::Missing => {}
    }
    if Platform::host() == Some(p) {
        if let Some(f) = mac::find_player(engine) {
            return Ok(f);
        }
    }
    bail!(
        "No {} template installed. Open Project ▸ Export templates… and install or download it.",
        p.label()
    )
}

/// Zip a folder (e.g. `X.app`) keeping the executable bit, so the archive works on Mac / Linux after unzipping.
pub fn zip_folder(folder: &Path, out: &Path) -> Result<()> {
    fn add(z: &mut zip::ZipWriter<fs::File>, base: &Path, d: &Path) -> Result<()> {
        for e in fs::read_dir(d)?.flatten() {
            let p = e.path();
            let rel = format!(
                "{}/{}",
                base.file_name().unwrap_or_default().to_string_lossy(),
                p.strip_prefix(base)?.to_string_lossy().replace('\\', "/")
            );
            if p.is_dir() {
                add(z, base, &p)?;
                continue;
            }
            #[cfg(unix)]
            let mode = {
                use std::os::unix::fs::PermissionsExt;
                fs::metadata(&p)?.permissions().mode() & 0o777
            };
            #[cfg(not(unix))]
            let mode = if p.parent().is_some_and(|d| d.ends_with("MacOS")) {
                0o755
            } else {
                0o644
            };
            let opt = zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(mode);
            z.start_file(rel, opt)?;
            z.write_all(&fs::read(&p)?)?;
        }
        Ok(())
    }
    let _ = fs::remove_file(out);
    let mut z = zip::ZipWriter::new(fs::File::create(out)?);
    add(&mut z, folder, folder)?;
    z.finish()?;
    Ok(())
}

/// Wrap the web build `dist` into a desktop app for `o.platform`. Returns the app / folder path and a list of notes for the Console.
pub fn export_desktop(
    dist: &Path,
    engine: &Path,
    o: &DesktopOpts,
) -> Result<(PathBuf, Vec<String>)> {
    fs::create_dir_all(&o.out_dir).with_context(|| {
        format!(
            "cannot write to {} (no write permission?)",
            o.out_dir.display()
        )
    })?;
    let player = player_for(o.platform, engine)?;
    let mut notes = vec![];
    let app = if o.platform.is_mac() {
        let host_mac = cfg!(target_os = "macos");
        let app = mac::bundle_mac(
            dist,
            engine,
            &mac::BundleOpts {
                name: o.name.clone(),
                out_dir: o.out_dir.clone(),
                player: Some(player),
                icon: o.icon.clone(),
                dmg: o.archive && host_mac,
            },
        )?;
        if host_mac {
            notes.push("Signed ad-hoc (fine for your own Mac; on another Mac: right-click ▸ Open the first time).".into());
        } else {
            notes.push("Not signed: this computer is not a Mac (no codesign). On the Mac, right-click ▸ Open the first time; see docs/PACKAGING.md.".into());
        }
        if o.archive {
            let zip = app.with_extension("zip");
            zip_folder(&app, &zip)?;
            notes.push(format!("Wrote {}", zip.display()));
        }
        app
    } else {
        portable::bundle(
            dist,
            engine,
            &portable::Opts {
                os: if o.platform.is_windows() {
                    portable::Os::Windows
                } else {
                    portable::Os::Linux
                },
                name: o.name.clone(),
                out_dir: o.out_dir.clone(),
                player: Some(player),
                icon: o.icon.clone(),
                archive: o.archive,
            },
        )?
    };
    Ok((app, notes))
}
