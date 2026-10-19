//! Pixel-art drawing primitives for the sprite editor (M10-15). Plain functions on `image::RgbaImage`: no blending (a pixel is replaced),
//! so what you paint is exactly what is stored. Coordinates outside the image are ignored.
use image::{Rgba, RgbaImage};

pub type Color = [u8; 4];

fn put(img: &mut RgbaImage, x: i32, y: i32, c: Color) {
    if x >= 0 && y >= 0 && (x as u32) < img.width() && (y as u32) < img.height() {
        img.put_pixel(x as u32, y as u32, Rgba(c));
    }
}

pub fn get(img: &RgbaImage, x: i32, y: i32) -> Option<Color> {
    (x >= 0 && y >= 0 && (x as u32) < img.width() && (y as u32) < img.height()).then(|| img.get_pixel(x as u32, y as u32).0)
}

/// Square brush of `size` pixels centred on (x, y) (size 1 = single pixel).
pub fn brush(img: &mut RgbaImage, x: i32, y: i32, size: i32, c: Color) {
    let size = size.max(1);
    let (x0, y0) = (x - (size - 1) / 2, y - (size - 1) / 2);
    for dy in 0..size {
        for dx in 0..size {
            put(img, x0 + dx, y0 + dy, c);
        }
    }
}

/// Bresenham line with a brush of `size`.
pub fn line(img: &mut RgbaImage, x0: i32, y0: i32, x1: i32, y1: i32, size: i32, c: Color) {
    let (mut x, mut y) = (x0, y0);
    let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
    let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
    let mut err = dx + dy;
    loop {
        brush(img, x, y, size, c);
        if x == x1 && y == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x += sx;
        }
        if e2 <= dx {
            err += dx;
            y += sy;
        }
    }
}

pub fn rect(img: &mut RgbaImage, x0: i32, y0: i32, x1: i32, y1: i32, size: i32, c: Color, filled: bool) {
    let (ax, bx, ay, by) = (x0.min(x1), x0.max(x1), y0.min(y1), y0.max(y1));
    if filled {
        for y in ay..=by {
            for x in ax..=bx {
                put(img, x, y, c);
            }
        }
    } else {
        line(img, ax, ay, bx, ay, size, c);
        line(img, bx, ay, bx, by, size, c);
        line(img, bx, by, ax, by, size, c);
        line(img, ax, by, ax, ay, size, c);
    }
}

/// Ellipse inscribed in the box (x0,y0)-(x1,y1).
pub fn ellipse(img: &mut RgbaImage, x0: i32, y0: i32, x1: i32, y1: i32, size: i32, c: Color, filled: bool) {
    let (ax, bx, ay, by) = (x0.min(x1), x0.max(x1), y0.min(y1), y0.max(y1));
    let (cx, cy) = ((ax + bx) as f64 / 2.0, (ay + by) as f64 / 2.0);
    let (rx, ry) = (((bx - ax) as f64 / 2.0).max(0.5), ((by - ay) as f64 / 2.0).max(0.5));
    let inside = |x: i32, y: i32| ((x as f64 - cx) / rx).powi(2) + ((y as f64 - cy) / ry).powi(2) <= 1.0 + 1e-9;
    for y in ay..=by {
        for x in ax..=bx {
            if !inside(x, y) {
                continue;
            }
            // outline = inside pixels with an outside 4-neighbour within the brush thickness
            let t = size.max(1);
            let edge = !inside(x + t, y) || !inside(x - t, y) || !inside(x, y + t) || !inside(x, y - t);
            if filled || edge {
                put(img, x, y, c);
            }
        }
    }
}

/// Flood fill from (x, y); `tolerance` = max per-channel difference counted as the same colour. Returns pixels changed.
pub fn fill(img: &mut RgbaImage, x: i32, y: i32, c: Color, tolerance: u8) -> usize {
    let Some(target) = get(img, x, y) else { return 0 };
    if target == c {
        return 0;
    }
    let same = |p: Color| p.iter().zip(target.iter()).all(|(a, b)| a.abs_diff(*b) <= tolerance);
    let mut stack = vec![(x, y)];
    let mut seen = vec![false; (img.width() * img.height()) as usize];
    let mut n = 0;
    while let Some((px, py)) = stack.pop() {
        let Some(cur) = get(img, px, py) else { continue };
        let i = (py as u32 * img.width() + px as u32) as usize;
        if seen[i] || !same(cur) {
            continue;
        }
        seen[i] = true;
        put(img, px, py, c);
        n += 1;
        stack.extend([(px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)]);
    }
    n
}

pub fn flip_h(img: &RgbaImage) -> RgbaImage {
    image::imageops::flip_horizontal(img)
}
pub fn flip_v(img: &RgbaImage) -> RgbaImage {
    image::imageops::flip_vertical(img)
}
pub fn rotate_cw(img: &RgbaImage) -> RgbaImage {
    image::imageops::rotate90(img)
}
pub fn rotate_ccw(img: &RgbaImage) -> RgbaImage {
    image::imageops::rotate270(img)
}

/// Copy the box (x0,y0)-(x1,y1) (inclusive, clamped) out of the image.
pub fn crop(img: &RgbaImage, x0: i32, y0: i32, x1: i32, y1: i32) -> RgbaImage {
    let (ax, bx) = (x0.min(x1).max(0), x0.max(x1).min(img.width() as i32 - 1));
    let (ay, by) = (y0.min(y1).max(0), y0.max(y1).min(img.height() as i32 - 1));
    if bx < ax || by < ay {
        return RgbaImage::new(1, 1);
    }
    image::imageops::crop_imm(img, ax as u32, ay as u32, (bx - ax + 1) as u32, (by - ay + 1) as u32).to_image()
}

/// Make the box transparent.
pub fn clear_box(img: &mut RgbaImage, x0: i32, y0: i32, x1: i32, y1: i32) {
    rect(img, x0, y0, x1, y1, 1, [0, 0, 0, 0], true);
}

/// Paste `src` with its top-left at (x, y); transparent source pixels leave the destination alone.
pub fn paste(img: &mut RgbaImage, src: &RgbaImage, x: i32, y: i32) {
    for (sx, sy, p) in src.enumerate_pixels() {
        if p.0[3] > 0 {
            put(img, x + sx as i32, y + sy as i32, p.0);
        }
    }
}

pub fn parse_hex(s: &str) -> Option<Color> {
    let h = s.trim().trim_start_matches('#');
    let v = u32::from_str_radix(h, 16).ok()?;
    match h.len() {
        6 => Some([(v >> 16) as u8, (v >> 8) as u8, v as u8, 255]),
        8 => Some([(v >> 24) as u8, (v >> 16) as u8, (v >> 8) as u8, v as u8]),
        _ => None,
    }
}

/// Outline of the opaque area (alpha > threshold) as a simplified polygon in image pixel coordinates (the convex hull, then thinned
/// to at most `max_points`). For collision shapes (M10-16). Empty when nothing is opaque.
pub fn auto_trace(img: &RgbaImage, threshold: u8, max_points: usize) -> Vec<[f64; 2]> {
    let mut pts: Vec<(i64, i64)> = vec![];
    for (x, y, p) in img.enumerate_pixels() {
        if p.0[3] > threshold {
            let (x, y) = (x as i64, y as i64);
            pts.extend([(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]);
        }
    }
    if pts.is_empty() {
        return vec![];
    }
    pts.sort();
    pts.dedup();
    let cross = |o: (i64, i64), a: (i64, i64), b: (i64, i64)| (a.0 - o.0) * (b.1 - o.1) - (a.1 - o.1) * (b.0 - o.0);
    let mut hull: Vec<(i64, i64)> = vec![];
    for pass in 0..2 {
        let start = hull.len();
        let it: Box<dyn Iterator<Item = &(i64, i64)>> = if pass == 0 { Box::new(pts.iter()) } else { Box::new(pts.iter().rev()) };
        for &p in it {
            while hull.len() >= start + 2 && cross(hull[hull.len() - 2], hull[hull.len() - 1], p) <= 0 {
                hull.pop();
            }
            hull.push(p);
        }
        hull.pop();
    }
    let mut poly: Vec<[f64; 2]> = hull.iter().map(|p| [p.0 as f64, p.1 as f64]).collect();
    // thin out: repeatedly drop the vertex whose removal changes the area least
    while poly.len() > max_points.max(3) {
        let n = poly.len();
        let (mut best, mut best_a) = (0, f64::MAX);
        for i in 0..n {
            let (a, b, c) = (poly[(i + n - 1) % n], poly[i], poly[(i + 1) % n]);
            let area = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])).abs() / 2.0;
            if area < best_a {
                best_a = area;
                best = i;
            }
        }
        poly.remove(best);
    }
    poly
}

#[cfg(test)]
mod tests {
    use super::*;

    const R: Color = [255, 0, 0, 255];
    const T: Color = [0, 0, 0, 0];

    fn count(img: &RgbaImage, c: Color) -> usize {
        img.pixels().filter(|p| p.0 == c).count()
    }

    #[test]
    fn line_rect_ellipse_and_clipping() {
        let mut i = RgbaImage::new(8, 8);
        line(&mut i, 0, 0, 7, 7, 1, R);
        assert_eq!(count(&i, R), 8);
        let mut j = RgbaImage::new(8, 8);
        rect(&mut j, 1, 1, 4, 3, 1, R, true);
        assert_eq!(count(&j, R), 12);
        rect(&mut j, 0, 0, 7, 7, 1, T, true);
        rect(&mut j, 1, 1, 4, 4, 1, R, false);
        assert_eq!(count(&j, R), 12, "4×4 outline = 12 pixels");
        let mut k = RgbaImage::new(9, 9);
        ellipse(&mut k, 0, 0, 8, 8, 1, R, true);
        assert!(get(&k, 4, 4) == Some(R) && get(&k, 0, 0) == Some(T), "disc: centre set, corner empty");
        let n = count(&k, R);
        assert!((44..=56).contains(&n), "disc area ≈ π·4² ({n})");
        brush(&mut k, -5, -5, 3, T); // off-canvas: ignored, no panic
        brush(&mut i, 7, 0, 3, R);
    }

    #[test]
    fn fill_respects_walls_and_tolerance() {
        let mut i = RgbaImage::new(6, 6);
        rect(&mut i, 3, 0, 3, 5, 1, [0, 0, 255, 255], true); // wall at x=3
        assert_eq!(fill(&mut i, 0, 0, R, 0), 18, "left side only");
        assert_eq!(get(&i, 5, 5), Some(T));
        assert_eq!(fill(&mut i, 0, 0, R, 0), 0, "same colour: nothing to do");
        let mut g = RgbaImage::from_pixel(4, 1, Rgba([100, 100, 100, 255]));
        g.put_pixel(2, 0, Rgba([104, 100, 100, 255]));
        assert_eq!(fill(&mut g.clone(), 0, 0, R, 0), 2);
        assert_eq!(fill(&mut g, 0, 0, R, 8), 4, "tolerance spans the near colour");
    }

    #[test]
    fn transforms_crop_paste_hex_trace() {
        let mut i = RgbaImage::new(4, 2);
        i.put_pixel(0, 0, Rgba(R));
        assert_eq!(get(&flip_h(&i), 3, 0), Some(R));
        assert_eq!(get(&flip_v(&i), 0, 1), Some(R));
        let r = rotate_cw(&i);
        assert_eq!((r.width(), r.height()), (2, 4));
        assert_eq!(get(&r, 1, 0), Some(R));
        assert_eq!(get(&rotate_ccw(&r), 0, 0), Some(R));
        let c = crop(&i, 0, 0, 1, 1);
        assert_eq!((c.width(), c.height()), (2, 2));
        let mut d = RgbaImage::new(4, 4);
        paste(&mut d, &c, 2, 2);
        assert_eq!(get(&d, 2, 2), Some(R));
        assert_eq!(parse_hex("#ff8000"), Some([255, 128, 0, 255]));
        assert_eq!(parse_hex("00ff0080"), Some([0, 255, 0, 128]));
        assert_eq!(parse_hex("xyz"), None);
        let mut s = RgbaImage::new(10, 10);
        rect(&mut s, 2, 2, 7, 7, 1, R, true);
        let poly = auto_trace(&s, 0, 4);
        assert_eq!(poly.len(), 4);
        let xs: Vec<f64> = poly.iter().map(|p| p[0]).collect();
        assert!(xs.iter().all(|x| *x == 2.0 || *x == 8.0));
        assert!(auto_trace(&RgbaImage::new(3, 3), 0, 8).is_empty());
    }
}
