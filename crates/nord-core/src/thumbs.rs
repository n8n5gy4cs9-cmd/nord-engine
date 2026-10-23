//! Thumbnail generator with sha256-keyed cache in `.nord-cache/thumbs/`.
//! Images/spritesheets: downscaled PNG. Audio: waveform PNG (WAV natively; other formats via optional ffmpeg).
use crate::assets::{Asset, AssetType};
use crate::vfs::PathExt;
use crate::{io, Error, Result};
use image::{Rgba, RgbaImage};
use std::path::{Path, PathBuf};

pub const SIZE: u32 = 128;

fn waveform(samples: &[i16]) -> RgbaImage {
    let (w, h) = (SIZE, SIZE / 2);
    let mut img = RgbaImage::from_pixel(w, h, Rgba([24, 28, 34, 255]));
    let per = (samples.len() / w as usize).max(1);
    for x in 0..w {
        let s = &samples
            [(x as usize * per).min(samples.len())..((x as usize + 1) * per).min(samples.len())];
        let peak = s.iter().map(|v| v.unsigned_abs() as u32).max().unwrap_or(0);
        let amp = (peak * (h / 2 - 1) / 32768).max(1);
        for y in (h / 2 - amp)..=(h / 2 + amp) {
            img.put_pixel(x, y.min(h - 1), Rgba([110, 200, 255, 255]));
        }
    }
    img
}

fn wav_samples(b: &[u8]) -> Option<Vec<i16>> {
    if b.len() < 44 || &b[0..4] != b"RIFF" || &b[8..12] != b"WAVE" {
        return None;
    }
    let (mut i, mut ch, mut bits) = (12, 1usize, 16u16);
    while i + 8 <= b.len() {
        let id = &b[i..i + 4];
        let len = u32::from_le_bytes(b[i + 4..i + 8].try_into().ok()?) as usize;
        let body = &b[i + 8..(i + 8 + len).min(b.len())];
        if id == b"fmt " && body.len() >= 16 {
            ch = u16::from_le_bytes([body[2], body[3]]) as usize;
            bits = u16::from_le_bytes([body[14], body[15]]);
        } else if id == b"data" {
            if bits != 16 {
                return None;
            }
            return Some(
                body.chunks_exact(2 * ch.max(1))
                    .map(|c| i16::from_le_bytes([c[0], c[1]]))
                    .collect(),
            );
        }
        i += 8 + len + (len & 1);
    }
    None
}

fn ffmpeg_samples(p: &Path) -> Option<Vec<i16>> {
    let out = std::process::Command::new("ffmpeg")
        .args(["-v", "quiet", "-i"])
        .arg(p)
        .args(["-ac", "1", "-ar", "8000", "-t", "30", "-f", "s16le", "-"])
        .output()
        .ok()?;
    out.status.success().then(|| {
        out.stdout
            .chunks_exact(2)
            .map(|c| i16::from_le_bytes([c[0], c[1]]))
            .collect()
    })
}

fn hex3(s: &str) -> [f32; 3] {
    let h = s.trim_start_matches('#');
    let h = if h.len() == 3 {
        h.chars().flat_map(|c| [c, c]).collect::<String>()
    } else {
        h.to_string()
    };
    let b = |i: usize| {
        h.get(i..i + 2)
            .and_then(|x| u8::from_str_radix(x, 16).ok())
            .map_or(0.8, |v| v as f32 / 255.0)
    };
    [b(0), b(2), b(4)]
}

/// CPU-lit sphere preview of a `*.mat.json` (colour, texture with tiling/offset, metallic, roughness, emissive, alpha):
/// Lambert + Blinn-Phong with a metal-tinted specular and a Fresnel rim. Used for Project thumbnails and the Inspector preview.
pub fn render_material(
    root: &Path,
    mat: &serde_json::Map<String, serde_json::Value>,
    size: u32,
) -> RgbaImage {
    let num = |k: &str, d: f32| mat.get(k).and_then(|v| v.as_f64()).map_or(d, |v| v as f32);
    let base = hex3(
        mat.get("color")
            .and_then(|v| v.as_str())
            .unwrap_or("#cccccc"),
    );
    let emissive = mat
        .get("emissive")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(hex3)
        .unwrap_or([0.0; 3]);
    let (metal, rough, alpha) = (
        num("metallic", 0.0).clamp(0.0, 1.0),
        num("roughness", 0.8).clamp(0.02, 1.0),
        num("alpha", 1.0),
    );
    let vec2 = |k: &str, d: [f32; 2]| {
        mat.get(k).and_then(|v| v.as_array()).map_or(d, |a| {
            [
                a.first()
                    .and_then(|x| x.as_f64())
                    .map_or(d[0], |x| x as f32),
                a.get(1).and_then(|x| x.as_f64()).map_or(d[1], |x| x as f32),
            ]
        })
    };
    let (tile, off) = (vec2("uvScale", [1.0, 1.0]), vec2("uvOffset", [0.0, 0.0]));
    let tex = mat
        .get("texture")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty() && !s.contains(".."))
        .and_then(|p| image::open(root.join(p)).ok())
        .map(|i| i.thumbnail(256, 256).to_rgba8());
    let l = {
        let v = [-0.45f32, 0.55, 0.7];
        let n = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
        [v[0] / n, v[1] / n, v[2] / n]
    };
    let h = {
        let v = [l[0], l[1], l[2] + 1.0];
        let n = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
        [v[0] / n, v[1] / n, v[2] / n]
    };
    let shin = (2.0 / (rough * rough + 1e-3)).clamp(4.0, 600.0);
    let r = size as f32 / 2.0 - 2.0;
    let mut img = RgbaImage::new(size, size);
    for y in 0..size {
        for x in 0..size {
            let (px, py) = (
                (x as f32 + 0.5 - size as f32 / 2.0) / r,
                -(y as f32 + 0.5 - size as f32 / 2.0) / r,
            );
            let d2 = px * px + py * py;
            if d2 > 1.0 {
                continue;
            }
            let n = [px, py, (1.0 - d2).sqrt()];
            let mut albedo = base;
            if let Some(t) = &tex {
                let u = (n[0].atan2(n[2]) / std::f32::consts::TAU + 0.5) * tile[0] + off[0];
                let v = (n[1].clamp(-1.0, 1.0).acos() / std::f32::consts::PI) * tile[1] + off[1];
                let (tw, th) = t.dimensions();
                let p = t.get_pixel(
                    ((u.rem_euclid(1.0)) * tw as f32) as u32 % tw,
                    ((v.rem_euclid(1.0)) * th as f32) as u32 % th,
                );
                for i in 0..3 {
                    albedo[i] *= (p[i] as f32 / 255.0).powf(2.2);
                }
            } else {
                for a in &mut albedo {
                    *a = a.powf(2.2);
                }
            }
            let ndl = (n[0] * l[0] + n[1] * l[1] + n[2] * l[2]).max(0.0);
            let ndh = (n[0] * h[0] + n[1] * h[1] + n[2] * h[2]).max(0.0);
            let spec = ndh.powf(shin) * (shin + 8.0) / 40.0 * ndl.max(0.15);
            let fres = (1.0 - n[2]).powi(4) * (1.0 - rough) * 0.6;
            let mut px_out = [0u8; 4];
            for i in 0..3 {
                let f0 = 0.04 * (1.0 - metal) + albedo[i] * metal;
                let c = albedo[i] * (1.0 - metal) * (0.14 + 0.9 * ndl)
                    + albedo[i] * metal * 0.1
                    + f0 * spec
                    + fres * (0.2 + 0.8 * f0)
                    + emissive[i].powf(2.2);
                px_out[i] = (c.clamp(0.0, 1.0).powf(1.0 / 2.2) * 255.0) as u8;
            }
            px_out[3] = (alpha.clamp(0.1, 1.0) * 255.0) as u8;
            img.put_pixel(x, y, Rgba(px_out));
        }
    }
    img
}

/// Cache file of an asset's thumbnail. Materials also depend on the pictures they reference, so their key mixes in those files:
/// replacing the texture a material points at gives a fresh thumbnail even though the `.mat.json` itself did not change.
pub fn thumb_path(root: &Path, a: &Asset) -> PathBuf {
    let mut key = a.sha256.clone();
    if a.kind == AssetType::Material {
        if let Some(m) = crate::vfs::read_to_string(root.join(&a.path))
            .ok()
            .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        {
            for k in ["texture", "normalMap", "emissiveMap"] {
                if let Some(p) = m[k].as_str().filter(|p| !p.is_empty() && !p.contains("..")) {
                    // size + mtime is enough to notice a replaced picture without hashing it every frame
                    if let Ok(md) = crate::vfs::metadata(root.join(p)) {
                        let t = md
                            .modified()
                            .ok()
                            .and_then(|t| t.duration_since(web_time::SystemTime::UNIX_EPOCH).ok())
                            .map_or(0, |d| d.as_millis());
                        key.push_str(&format!("|{p}|{}|{t}", md.len()));
                    }
                }
            }
        }
        if key != a.sha256 {
            key = crate::assets::sha256_bytes(key.as_bytes());
        }
    }
    root.join(".nord-cache/thumbs").join(format!("{key}.png"))
}

/// Returns the cached thumbnail path for an asset (generating it if needed), or `None` if the type has no thumbnail.
pub fn thumb_for(root: &Path, a: &Asset) -> Result<Option<PathBuf>> {
    let out = thumb_path(root, a);
    if out.v_exists() {
        return Ok(Some(out));
    }
    let src = root.join(&a.path);
    let img = match a.kind {
        AssetType::Image | AssetType::Spritesheet => {
            if a.path.ends_with(".svg") {
                return Ok(None);
            }
            let im = image::open(&src).map_err(|e| Error::Msg(format!("{}: {e}", a.path)))?;
            im.thumbnail(SIZE, SIZE).to_rgba8()
        }
        AssetType::Material => {
            let txt = crate::vfs::read_to_string(&src).map_err(|e| io::io_err(&src, e))?;
            let mat: serde_json::Map<String, serde_json::Value> =
                serde_json::from_str(&txt).unwrap_or_default();
            render_material(root, &mat, SIZE)
        }
        AssetType::Audio => {
            let bytes = crate::vfs::read(&src).map_err(|e| io::io_err(&src, e))?;
            match wav_samples(&bytes).or_else(|| ffmpeg_samples(&src)) {
                Some(s) if !s.is_empty() => waveform(&s),
                _ => return Ok(None),
            }
        }
        _ => return Ok(None),
    };
    crate::vfs::create_dir_all(out.parent().unwrap()).map_err(|e| io::io_err(&out, e))?;
    img.save(&out)
        .map_err(|e| Error::Msg(format!("{}: {e}", out.display())))?;
    Ok(Some(out))
}

/// Generate thumbnails for every asset; returns (generated_or_cached, skipped_without_thumbnail, failed).
pub fn generate_all(root: &Path, assets: &[Asset]) -> (usize, usize, Vec<String>) {
    let (mut ok, mut skip, mut bad) = (0, 0, vec![]);
    for a in assets {
        match thumb_for(root, a) {
            Ok(Some(_)) => ok += 1,
            Ok(None) => skip += 1,
            Err(e) => bad.push(e.to_string()),
        }
    }
    (ok, skip, bad)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_and_wav_thumbs() {
        let d = std::env::temp_dir().join(format!("nord-thumb-{}", std::process::id()));
        let _ = crate::vfs::remove_dir_all(&d);
        crate::vfs::create_dir_all(d.join("assets")).unwrap();
        RgbaImage::from_pixel(400, 200, Rgba([255, 0, 0, 255]))
            .save(d.join("assets/a.png"))
            .unwrap();
        // 0.1 s mono 16-bit 8 kHz sine-ish WAV
        let pcm: Vec<u8> = (0..800i32)
            .flat_map(|i| ((((i % 40) - 20) * 800) as i16).to_le_bytes())
            .collect();
        let mut w = b"RIFF".to_vec();
        w.extend((36 + pcm.len() as u32).to_le_bytes());
        w.extend(b"WAVEfmt ");
        w.extend(16u32.to_le_bytes());
        for v in [1u16, 1] {
            w.extend(v.to_le_bytes());
        }
        w.extend(8000u32.to_le_bytes());
        w.extend(16000u32.to_le_bytes());
        for v in [2u16, 16] {
            w.extend(v.to_le_bytes());
        }
        w.extend(b"data");
        w.extend((pcm.len() as u32).to_le_bytes());
        w.extend(pcm);
        crate::vfs::write(d.join("assets/s.wav"), w).unwrap();
        let assets = crate::assets::scan(&d).unwrap();
        let (ok, skip, bad) = generate_all(&d, &assets);
        assert_eq!((ok, skip, bad.len()), (2, 0, 0), "{bad:?}");
        let t = image::open(thumb_for(&d, &assets[0]).unwrap().unwrap()).unwrap();
        assert_eq!((t.width(), t.height()), (128, 64));
    }
}

#[cfg(test)]
mod material_tests {
    use super::*;

    #[test]
    fn material_thumbnail_key_follows_its_texture() {
        let d = std::env::temp_dir().join(format!("nord-thumb-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("a.mat.json"), r##"{"texture":"t.png"}"##).unwrap();
        std::fs::write(d.join("t.png"), b"one").unwrap();
        let a = Asset {
            path: "a.mat.json".into(),
            kind: AssetType::Material,
            size: 0,
            sha256: "same".into(),
            meta: None,
        };
        let k1 = thumb_path(&d, &a);
        std::fs::write(d.join("t.png"), b"another picture").unwrap();
        assert_ne!(k1, thumb_path(&d, &a), "new texture bytes, new thumbnail");
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn lit_sphere_is_shaded_and_round() {
        let m: serde_json::Map<String, serde_json::Value> =
            serde_json::json!({"color": "#cc3333", "roughness": 0.3})
                .as_object()
                .cloned()
                .unwrap_or_default();
        let img = render_material(Path::new("."), &m, 64);
        assert_eq!(img.get_pixel(0, 0)[3], 0, "corner is outside the sphere");
        let (lit, dark) = (img.get_pixel(24, 20), img.get_pixel(46, 50));
        assert!(lit[0] > dark[0], "light comes from the upper left");
    }
}
