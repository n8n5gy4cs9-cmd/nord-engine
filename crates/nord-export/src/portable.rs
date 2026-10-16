//! `nord bundle-portable`: Windows / Linux desktop bundle = renamed `nord-player` + `game/` (resource swap, no per-game compile).
//! Output: a folder and a `.zip` (Windows) / `.tar.gz` (Linux, needs `tar`). Linux also gets a `.desktop` file (file types, URL schemes),
//! Windows gets `register.reg` (per-user file associations / URL schemes; edit the install path inside, then double-click). No signing: see docs/PACKAGING.md.
use anyhow::{bail, Context, Result};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Os {
    Windows,
    Linux,
}

#[derive(Debug, Clone)]
pub struct Opts {
    pub os: Os,
    pub name: Option<String>,
    pub out_dir: PathBuf,
    pub player: Option<PathBuf>,
    pub icon: Option<PathBuf>,
    pub archive: bool,
}

/// PNG-in-ICO (Vista+): ICONDIR + one 256×256 entry holding the PNG.
pub fn make_ico(png: &Path) -> Result<Vec<u8>> {
    use image::{codecs::png::PngEncoder, imageops::FilterType, ImageEncoder};
    let img = image::open(png)?
        .resize_exact(256, 256, FilterType::Lanczos3)
        .to_rgba8();
    let mut buf = vec![];
    PngEncoder::new(&mut buf).write_image(&img, 256, 256, image::ExtendedColorType::Rgba8)?;
    let mut o = vec![0, 0, 1, 0, 1, 0]; // reserved, type=1 (icon), count=1
    o.extend_from_slice(&[0, 0, 0, 0, 1, 0, 32, 0]); // 256x256 (0 = 256), no palette, planes 1, 32 bpp
    o.extend_from_slice(&(buf.len() as u32).to_le_bytes());
    o.extend_from_slice(&22u32.to_le_bytes());
    o.extend_from_slice(&buf);
    Ok(o)
}

fn slug(s: &str) -> String {
    let t: String = s
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    t.trim_matches('-').to_string()
}

fn copy_dir(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for e in fs::read_dir(src)?.flatten() {
        let (p, d) = (e.path(), dst.join(e.file_name()));
        if p.is_dir() {
            copy_dir(&p, &d)?
        } else {
            fs::copy(&p, &d)?;
        }
    }
    Ok(())
}

pub fn desktop_entry(name: &str, exe: &str, desktop: &serde_json::Value) -> String {
    let mut mimes = vec![];
    for t in desktop["fileTypes"].as_array().into_iter().flatten() {
        if let Some(m) = t["mime"].as_str() {
            mimes.push(m.to_string());
        }
    }
    for s in desktop["schemes"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s.as_str())
    {
        mimes.push(format!("x-scheme-handler/{s}"));
    }
    let mime = if mimes.is_empty() {
        String::new()
    } else {
        format!("MimeType={};\n", mimes.join(";"))
    };
    format!("[Desktop Entry]\nType=Application\nName={name}\nExec={exe} %U\nIcon={}\nCategories=Utility;\nTerminal=false\n{mime}", slug(name))
}

pub fn reg_file(name: &str, exe: &str, desktop: &serde_json::Value) -> String {
    let q = |s: &str| s.replace('\\', "\\\\").replace('"', "\\\"");
    let mut r = String::from("Windows Registry Editor Version 5.00\r\n\r\n");
    let prog = format!("{}App", slug(name));
    r.push_str(&format!("[HKEY_CURRENT_USER\\Software\\Classes\\{prog}\\shell\\open\\command]\r\n@=\"\\\"{}\\\" \\\"%1\\\"\"\r\n\r\n", q(exe)));
    for t in desktop["fileTypes"].as_array().into_iter().flatten() {
        for e in t["ext"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|e| e.as_str())
        {
            r.push_str(&format!("[HKEY_CURRENT_USER\\Software\\Classes\\.{}\\OpenWithProgids]\r\n\"{prog}\"=\"\"\r\n\r\n", e.trim_start_matches('.')));
        }
    }
    for s in desktop["schemes"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|s| s.as_str())
    {
        r.push_str(&format!("[HKEY_CURRENT_USER\\Software\\Classes\\{s}]\r\n@=\"URL:{name}\"\r\n\"URL Protocol\"=\"\"\r\n\r\n[HKEY_CURRENT_USER\\Software\\Classes\\{s}\\shell\\open\\command]\r\n@=\"\\\"{}\\\" \\\"%1\\\"\"\r\n\r\n", q(exe)));
    }
    r
}

/// `dist` = web build (index.html + nord.json). Returns the bundle folder (and writes the archive next to it when `archive`).
pub fn bundle(dist: &Path, engine: &Path, o: &Opts) -> Result<PathBuf> {
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
    let player = o.player.clone().or_else(|| crate::mac::find_player(engine).filter(|p| p.is_file())).context("nord-player not found: build it (`cargo build --release -p nord-player --features shell`) or pass --player")?;
    let folder = o.out_dir.join(&safe);
    let _ = fs::remove_dir_all(&folder);
    fs::create_dir_all(&folder)?;
    let exe = if o.os == Os::Windows {
        format!("{safe}.exe")
    } else {
        slug(&name)
    };
    fs::copy(&player, folder.join(&exe))?;
    if o.os == Os::Windows {
        if let Some(dir) = player.parent() {
            for name in [
                "WebView2Loader.dll",
                "libgcc_s_seh-1.dll",
                "libwinpthread-1.dll",
                "libstdc++-6.dll",
                "libssp-0.dll",
            ] {
                let dll = dir.join(name);
                if dll.is_file() {
                    fs::copy(&dll, folder.join(name))?;
                }
            }
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(folder.join(&exe), fs::Permissions::from_mode(0o755))?;
    }
    copy_dir(dist, &folder.join("game"))?;
    let icon = o
        .icon
        .clone()
        .or_else(|| Some(dist.join("icon.png")).filter(|p| p.exists()))
        .or_else(|| Some(engine.join("assets/brand/logo-512.png")).filter(|p| p.exists()));
    if let Some(i) = &icon {
        match o.os {
            Os::Windows => fs::write(folder.join("icon.ico"), make_ico(i)?)?,
            Os::Linux => {
                let img =
                    image::open(i)?.resize_exact(256, 256, image::imageops::FilterType::Lanczos3);
                img.save(folder.join(format!("{}.png", slug(&name))))?;
            }
        }
    }
    match o.os {
        Os::Windows => fs::write(
            folder.join("register.reg"),
            reg_file(&name, &format!("C:\\Path\\To\\{exe}"), &m["desktop"]),
        )?,
        Os::Linux => fs::write(
            folder.join(format!("{}.desktop", slug(&name))),
            desktop_entry(&name, &exe, &m["desktop"]),
        )?,
    }
    if o.archive {
        match o.os {
            Os::Windows => {
                let zp = o.out_dir.join(format!("{safe}-windows.zip"));
                let _ = fs::remove_file(&zp);
                let mut z = zip::ZipWriter::new(fs::File::create(&zp)?);
                let opt = zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated);
                fn add(
                    z: &mut zip::ZipWriter<fs::File>,
                    base: &Path,
                    d: &Path,
                    opt: zip::write::SimpleFileOptions,
                ) -> Result<()> {
                    use std::io::Write;
                    for e in fs::read_dir(d)?.flatten() {
                        let p = e.path();
                        if p.is_dir() {
                            add(z, base, &p, opt)?
                        } else {
                            z.start_file(
                                format!(
                                    "{}/{}",
                                    base.file_name().unwrap().to_string_lossy(),
                                    p.strip_prefix(base)?.to_string_lossy().replace('\\', "/")
                                ),
                                opt,
                            )?;
                            z.write_all(&fs::read(&p)?)?;
                        }
                    }
                    Ok(())
                }
                add(&mut z, &folder, &folder, opt)?;
                z.finish()?;
            }
            Os::Linux => {
                let tp = o.out_dir.join(format!("{}-linux.tar.gz", slug(&name)));
                let ok = Command::new("tar")
                    .arg("-C")
                    .arg(&o.out_dir)
                    .arg("-czf")
                    .arg(&tp)
                    .arg(&safe)
                    .status()
                    .is_ok_and(|s| s.success());
                if !ok {
                    bail!("tar failed (is `tar` installed?)");
                }
            }
        }
    }
    Ok(folder)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn ico_header_and_entries() {
        let d = std::env::temp_dir().join(format!("nord-ico-{}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        image::RgbaImage::from_pixel(64, 64, image::Rgba([10, 20, 30, 255]))
            .save(d.join("i.png"))
            .unwrap();
        let ico = make_ico(&d.join("i.png")).unwrap();
        assert_eq!(&ico[..6], &[0, 0, 1, 0, 1, 0]);
        let len = u32::from_le_bytes(ico[14..18].try_into().unwrap()) as usize;
        assert_eq!(ico.len(), 22 + len);
        assert_eq!(&ico[22..26], b"\x89PNG");
    }
    #[test]
    fn desktop_entry_and_reg_register_types_and_schemes() {
        let d = json!({"schemes": ["nordnotes"], "fileTypes": [{"name": "Markdown", "ext": ["md", ".txt"], "mime": "text/markdown"}]});
        let e = desktop_entry("My Notes", "my-notes", &d);
        assert!(
            e.contains("Exec=my-notes %U")
                && e.contains("MimeType=text/markdown;x-scheme-handler/nordnotes;")
                && e.contains("Icon=my-notes")
        );
        let r = reg_file("My Notes", "C:\\Apps\\My Notes.exe", &d);
        assert!(
            r.contains(".md\\OpenWithProgids")
                && r.contains(".txt\\OpenWithProgids")
                && r.contains("URL Protocol")
                && r.contains("C:\\\\Apps\\\\My Notes.exe")
        );
    }
    #[test]
    fn bundles_folder_and_archives() {
        let d = std::env::temp_dir().join(format!("nord-portable-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        let dist = d.join("dist");
        fs::create_dir_all(&dist).unwrap();
        fs::write(dist.join("index.html"), "<html>").unwrap();
        fs::write(
            dist.join("nord.json"),
            r#"{"name":"My App","desktop":{"schemes":["x"]}}"#,
        )
        .unwrap();
        fs::write(d.join("player"), "bin").unwrap();
        fs::write(d.join("WebView2Loader.dll"), "loader").unwrap();
        for os in [Os::Windows, Os::Linux] {
            let out = d.join(format!("out-{os:?}"));
            fs::create_dir_all(&out).unwrap();
            let f = bundle(
                &dist,
                &d,
                &Opts {
                    os,
                    name: None,
                    out_dir: out.clone(),
                    player: Some(d.join("player")),
                    icon: None,
                    archive: true,
                },
            )
            .unwrap();
            assert!(f.join("game/index.html").exists());
            match os {
                Os::Windows => assert!(
                    f.join("My App.exe").exists()
                        && f.join("WebView2Loader.dll").exists()
                        && f.join("register.reg").exists()
                        && out.join("My App-windows.zip").exists()
                ),
                Os::Linux => assert!(
                    f.join("my-app").exists()
                        && f.join("my-app.desktop").exists()
                        && out.join("my-app-linux.tar.gz").exists()
                ),
            }
        }
    }
}
