//! Import an animated GIF as a spritesheet (M10-17): frames are laid out in a horizontal strip; the result is a PNG + `.meta.json`
//! with `frameWidth/frameHeight` and a `default` animation (fps from the GIF's frame delays, per-frame duration multipliers kept).
use image::{codecs::gif::GifDecoder, AnimationDecoder, RgbaImage};
use serde_json::{json, Value};
use std::io::Cursor;

pub struct Sheet {
    pub image: RgbaImage,
    pub meta: Value,
    pub frames: usize,
}

pub fn gif_to_sheet(bytes: &[u8]) -> Result<Sheet, String> {
    let dec = GifDecoder::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let frames = dec
        .into_frames()
        .collect_frames()
        .map_err(|e| e.to_string())?;
    if frames.is_empty() {
        return Err("the GIF has no frames".into());
    }
    let (w, h) = (frames[0].buffer().width(), frames[0].buffer().height());
    if frames.len() as u32 * w > 16384 {
        return Err(format!(
            "{} frames of {w}×{h} make a sheet wider than 16384 px",
            frames.len()
        ));
    }
    let mut sheet = RgbaImage::new(w * frames.len() as u32, h);
    let mut delays = vec![];
    for (i, f) in frames.iter().enumerate() {
        image::imageops::replace(&mut sheet, f.buffer(), (i as u32 * w) as i64, 0);
        let (n, d) = f.delay().numer_denom_ms();
        delays.push((n as f64 / d.max(1) as f64).max(10.0));
    }
    let avg = delays.iter().sum::<f64>() / delays.len() as f64;
    let fps = (1000.0 / avg).round().clamp(1.0, 60.0);
    let mult: Vec<f64> = delays
        .iter()
        .map(|d| ((d / avg) * 100.0).round() / 100.0)
        .collect();
    let mut anim =
        json!({ "frames": (0..frames.len()).collect::<Vec<_>>(), "fps": fps, "loop": true });
    if mult.iter().any(|m| (*m - 1.0).abs() > 0.01) {
        anim["frameDurations"] = json!(mult);
    }
    let meta = json!({ "type": "spritesheet", "frameWidth": w, "frameHeight": h, "anims": { "default": anim } });
    Ok(Sheet {
        image: sheet,
        meta,
        frames: frames.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{codecs::gif::GifEncoder, Delay, Frame, Rgba};

    fn gif(delays: &[u32]) -> Vec<u8> {
        let mut out = vec![];
        {
            let mut enc = GifEncoder::new(&mut out);
            for (i, d) in delays.iter().enumerate() {
                let img = RgbaImage::from_pixel(4, 3, Rgba([(i * 80) as u8, 0, 0, 255]));
                enc.encode_frame(Frame::from_parts(
                    img,
                    0,
                    0,
                    Delay::from_numer_denom_ms(*d, 1),
                ))
                .unwrap();
            }
        }
        out
    }

    #[test]
    fn gif_becomes_a_spritesheet_with_an_animation() {
        let s = gif_to_sheet(&gif(&[100, 100, 300])).unwrap();
        assert_eq!((s.image.width(), s.image.height(), s.frames), (12, 3, 3));
        assert_eq!(s.meta["frameWidth"], 4);
        assert_eq!(s.meta["anims"]["default"]["frames"], json!([0, 1, 2]));
        assert_eq!(s.meta["anims"]["default"]["fps"], 6.0, "avg 166 ms → 6 fps");
        let d = s.meta["anims"]["default"]["frameDurations"]
            .as_array()
            .unwrap();
        assert!(d[2].as_f64().unwrap() > d[0].as_f64().unwrap() * 2.0);
        assert_eq!(s.image.get_pixel(4, 0).0[0], 80, "frame 1 starts at x = 4");
        assert!(gif_to_sheet(b"not a gif").is_err());
    }
}
