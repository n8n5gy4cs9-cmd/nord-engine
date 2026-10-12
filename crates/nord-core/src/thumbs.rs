//! Thumbnail generator with sha256-keyed cache in `.nord-cache/thumbs/`.
//! Images/spritesheets: downscaled PNG. Audio: waveform PNG (WAV natively; other formats via optional ffmpeg).
use crate::assets::{Asset, AssetType};
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

/// Returns the cached thumbnail path for an asset (generating it if needed), or `None` if the type has no thumbnail.
pub fn thumb_for(root: &Path, a: &Asset) -> Result<Option<PathBuf>> {
    let out = root
        .join(".nord-cache/thumbs")
        .join(format!("{}.png", a.sha256));
    if out.exists() {
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
        AssetType::Audio => {
            let bytes = std::fs::read(&src).map_err(|e| io::io_err(&src, e))?;
            match wav_samples(&bytes).or_else(|| ffmpeg_samples(&src)) {
                Some(s) if !s.is_empty() => waveform(&s),
                _ => return Ok(None),
            }
        }
        _ => return Ok(None),
    };
    std::fs::create_dir_all(out.parent().unwrap()).map_err(|e| io::io_err(&out, e))?;
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
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(d.join("assets")).unwrap();
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
        std::fs::write(d.join("assets/s.wav"), w).unwrap();
        let assets = crate::assets::scan(&d).unwrap();
        let (ok, skip, bad) = generate_all(&d, &assets);
        assert_eq!((ok, skip, bad.len()), (2, 0, 0), "{bad:?}");
        let t = image::open(thumb_for(&d, &assets[0]).unwrap().unwrap()).unwrap();
        assert_eq!((t.width(), t.height()), (128, 64));
    }
}
