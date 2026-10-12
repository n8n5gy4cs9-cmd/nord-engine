//! `nord bundle-mac`: wrap a web build into `<Name>.app` using the prebuilt `nord-player` shell (resource swap, no per-game compile).
//! The bundle layout is assembled on any OS (so it is testable on Linux); `codesign`/`hdiutil` only run on macOS.
use anyhow::{bail, Context, Result};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug, Clone, Default)]
pub struct BundleOpts {
    /// App name (default: the project name from nord.json)
    pub name: Option<String>,
    /// Folder the `.app` is written into
    pub out_dir: PathBuf,
    /// `nord-player` binary, or a prebuilt `NordPlayer.app` (default: looked up next to the executable / in the engine folder)
    pub player: Option<PathBuf>,
    /// PNG used for the app icon (default: `icon.png` in the build, else the Nord logo)
    pub icon: Option<PathBuf>,
    pub dmg: bool,
}

fn copy_dir(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for e in fs::read_dir(src)?.flatten() {
        let (p, d) = (e.path(), dst.join(e.file_name()));
        if p.is_dir() {
            copy_dir(&p, &d)?;
        } else {
            fs::copy(&p, &d)?;
        }
    }
    Ok(())
}

pub fn find_player(engine: &Path) -> Option<PathBuf> {
    let mut c = vec![];
    if let Ok(exe) = std::env::current_exe() {
        if let Some(d) = exe.parent() {
            c.push(d.join("nord-player"));
            c.push(d.join("../Resources/NordPlayer.app"));
        }
    }
    c.push(engine.join("NordPlayer.app"));
    for p in ["target/release/nord-player", "target/debug/nord-player"] {
        c.push(engine.join(p));
    }
    c.into_iter().find(|p| p.exists())
}

/// PNG-in-ICNS (macOS 10.7+): header `icns` + total length, then `ic07..ic10` chunks (128, 256, 512, 1024 px).
pub fn make_icns(png: &Path) -> Result<Vec<u8>> {
    use image::{codecs::png::PngEncoder, imageops::FilterType, ImageEncoder};
    let img = image::open(png).with_context(|| format!("icon {}", png.display()))?;
    let mut body = vec![];
    for (tag, px) in [
        (b"ic07", 128u32),
        (b"ic08", 256),
        (b"ic09", 512),
        (b"ic10", 1024),
    ] {
        let r = img.resize_exact(px, px, FilterType::Lanczos3).to_rgba8();
        let mut buf = vec![];
        PngEncoder::new(&mut buf).write_image(&r, px, px, image::ExtendedColorType::Rgba8)?;
        body.extend_from_slice(tag);
        body.extend_from_slice(&(buf.len() as u32 + 8).to_be_bytes());
        body.extend_from_slice(&buf);
    }
    let mut out = b"icns".to_vec();
    out.extend_from_slice(&(body.len() as u32 + 8).to_be_bytes());
    out.extend_from_slice(&body);
    Ok(out)
}

fn xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// `desktop.schemes` → CFBundleURLTypes, `desktop.fileTypes` (`[{name, ext:[..]}]`) → CFBundleDocumentTypes, microphone etc. are not requested.
pub fn plist_extras(desktop: &serde_json::Value) -> String {
    let mut o = String::new();
    let schemes: Vec<&str> = desktop["schemes"]
        .as_array()
        .map(|a| a.iter().filter_map(|x| x.as_str()).collect())
        .unwrap_or_default();
    if !schemes.is_empty() {
        o.push_str("\n  <key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>Nord app link</string><key>CFBundleURLSchemes</key><array>");
        for s in schemes {
            o.push_str(&format!("<string>{}</string>", xml(s)));
        }
        o.push_str("</array></dict></array>");
    }
    let types = desktop["fileTypes"].as_array().cloned().unwrap_or_default();
    if !types.is_empty() {
        o.push_str("\n  <key>CFBundleDocumentTypes</key><array>");
        for t in types {
            let exts: Vec<String> = t["ext"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|x| {
                            x.as_str().map(|e| {
                                format!("<string>{}</string>", xml(e.trim_start_matches('.')))
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            o.push_str(&format!("<dict><key>CFBundleTypeName</key><string>{}</string><key>CFBundleTypeRole</key><string>Editor</string><key>LSHandlerRank</key><string>Alternate</string><key>CFBundleTypeExtensions</key><array>{}</array></dict>", xml(t["name"].as_str().unwrap_or("Document")), exts.concat()));
        }
        o.push_str("</array>");
    }
    o
}

fn bundle_id(id: &str) -> String {
    let s: String = id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect();
    if s.is_empty() {
        "com.crowelian.game".into()
    } else {
        s
    }
}

/// `dist` = a web build folder (index.html + nord.json). Returns the `.app` path.
pub fn bundle_mac(dist: &Path, engine: &Path, o: &BundleOpts) -> Result<PathBuf> {
    if !dist.join("index.html").exists() {
        bail!(
            "{} is not a web build (no index.html); run `nord build` first",
            dist.display()
        );
    }
    let m: serde_json::Value = fs::read(dist.join("nord.json"))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default();
    let name = o
        .name
        .clone()
        .or_else(|| m["name"].as_str().map(String::from))
        .unwrap_or_else(|| "Nord Game".into());
    let safe: String = name
        .chars()
        .filter(|c| !"/\\:*?\"<>|".contains(*c))
        .collect();
    let player = o
        .player
        .clone()
        .or_else(|| find_player(engine))
        .context("nord-player not found: build it (`cargo build --release -p nord-player --features shell`) or pass --player")?;
    let app = o.out_dir.join(format!("{safe}.app"));
    let _ = fs::remove_dir_all(&app);
    let (macos, res) = (app.join("Contents/MacOS"), app.join("Contents/Resources"));
    let exe_name;
    if player.is_dir() {
        // prebuilt NordPlayer.app: copy the whole bundle, then swap resources
        copy_dir(&player, &app)?;
        let _ = fs::remove_dir_all(res.join("game"));
        exe_name = fs::read_dir(&macos)?
            .flatten()
            .next()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .context("NordPlayer.app has no executable")?;
    } else {
        fs::create_dir_all(&macos)?;
        fs::create_dir_all(&res)?;
        exe_name = "NordPlayer".into();
        let dst = macos.join(&exe_name);
        fs::copy(&player, &dst)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&dst, fs::Permissions::from_mode(0o755))?;
        }
    }
    copy_dir(dist, &res.join("game"))?;

    let icon_src = o
        .icon
        .clone()
        .or_else(|| Some(dist.join("icon.png")).filter(|p| p.exists()))
        .or_else(|| Some(engine.join("assets/brand/logo-512.png")).filter(|p| p.exists()));
    if let Some(i) = icon_src {
        fs::write(res.join("AppIcon.icns"), make_icns(&i)?)?;
    }
    let version = m["version"]
        .as_str()
        .filter(|v| !v.is_empty())
        .unwrap_or(env!("CARGO_PKG_VERSION"));
    let extra = plist_extras(&m["desktop"]);
    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>{n}</string>
  <key>CFBundleDisplayName</key><string>{n}</string>
  <key>CFBundleIdentifier</key><string>{id}</string>
  <key>CFBundleExecutable</key><string>{exe}</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>{v}</string>
  <key>CFBundleVersion</key><string>{v}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.games</string>
  <key>NSHumanReadableCopyright</key><string>Made with Nord Engine (Crowelian 2026 + Sonnet)</string>{extra}
</dict></plist>
"#,
        n = xml(&name),
        id = xml(&bundle_id(m["id"].as_str().unwrap_or(""))),
        exe = xml(&exe_name),
        v = xml(version),
        extra = extra
    );
    fs::write(app.join("Contents/Info.plist"), plist)?;

    if cfg!(target_os = "macos") {
        let ok = Command::new("codesign")
            .args(["--force", "--deep", "--sign", "-"])
            .arg(&app)
            .status()
            .is_ok_and(|s| s.success());
        if !ok {
            bail!("codesign failed for {}", app.display());
        }
        if o.dmg {
            let dmg = o.out_dir.join(format!("{safe}.dmg"));
            let _ = fs::remove_file(&dmg);
            let ok = Command::new("hdiutil")
                .args([
                    "create",
                    "-volname",
                    &safe,
                    "-ov",
                    "-format",
                    "UDZO",
                    "-srcfolder",
                ])
                .arg(&app)
                .arg(&dmg)
                .status()
                .is_ok_and(|s| s.success());
            if !ok {
                bail!("hdiutil failed");
            }
        }
    } else if o.dmg {
        bail!(".dmg can only be created on macOS (hdiutil)");
    }
    Ok(app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plist_extras_for_schemes_and_file_types() {
        let e = plist_extras(
            &serde_json::json!({"schemes":["nordnotes"],"fileTypes":[{"name":"Markdown","ext":["md",".txt"]}]}),
        );
        assert!(
            e.contains("<key>CFBundleURLSchemes</key><array><string>nordnotes</string>")
                && e.contains("<string>md</string><string>txt</string>")
        );
        assert!(plist_extras(&serde_json::Value::Null).is_empty());
    }

    #[test]
    fn bundle_layout_from_a_web_build() {
        let d = std::env::temp_dir().join(format!("nord-mac-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        let proj = d.join("My Game");
        nord_core::project::create(&proj, nord_core::ProjectType::TwoD).unwrap();
        let engine = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
        let dist = d.join("dist");
        crate::build(
            &proj,
            &engine,
            &crate::Opts {
                out: Some(dist.clone()),
                ..Default::default()
            },
        )
        .unwrap();
        let fake = d.join("player");
        fs::write(&fake, b"#!/bin/sh\n").unwrap();
        let app = bundle_mac(
            &dist,
            &engine,
            &BundleOpts {
                out_dir: d.clone(),
                player: Some(fake),
                ..Default::default()
            },
        )
        .unwrap();
        assert!(app.ends_with("My Game.app"));
        assert!(app.join("Contents/MacOS/NordPlayer").exists());
        assert!(app.join("Contents/Resources/game/index.html").exists());
        let plist = fs::read_to_string(app.join("Contents/Info.plist")).unwrap();
        assert!(
            plist.contains("<string>My Game</string>") && plist.contains("com.crowelian.mygame"),
            "{plist}"
        );
        let icns = fs::read(app.join("Contents/Resources/AppIcon.icns")).unwrap();
        assert_eq!(&icns[..4], b"icns");
        assert_eq!(
            u32::from_be_bytes(icns[4..8].try_into().unwrap()) as usize,
            icns.len()
        );
        assert!(
            bundle_mac(&d, &engine, &BundleOpts::default()).is_err(),
            "not a web build"
        );
    }
}
