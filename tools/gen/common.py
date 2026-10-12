"""Shared helpers for placeholder asset generation (Crowelian 2026 + Sonnet). Re-runnable, deterministic."""
import os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
A = os.path.join(ROOT, "assets")
FONT_DIR = "/usr/share/fonts/opentype/inter"
PALETTE = {
    "bg0": "#070B14", "bg1": "#0E1626", "bg2": "#16243A", "panel": "#1B2A42", "line": "#2A3F5F",
    "accent": "#4FA3FF", "accent2": "#7CC4FF", "accentDark": "#2468C8", "text": "#E8F0FF", "muted": "#8FA5C7",
    "ok": "#4ADE80", "warn": "#FBBF24", "err": "#F87171", "star": "#FFD86B",
}

def out(*p):
    path = os.path.join(A, *p)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path

def hexrgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def font(weight="Bold", size=48):
    return ImageFont.truetype(os.path.join(FONT_DIR, f"Inter-{weight}.otf"), size)

def lerp(a, b, t):
    return a + (b - a) * t

def gradient(w, h, c0, c1, angle_deg=90):
    """Linear gradient RGBA image. angle 90 = top→bottom."""
    c0, c1 = np.array(hexrgb(c0) if isinstance(c0, str) else c0, float), np.array(hexrgb(c1) if isinstance(c1, str) else c1, float)
    th = np.radians(angle_deg)
    y, x = np.mgrid[0:h, 0:w]
    t = ((x / max(w - 1, 1) - .5) * np.cos(th) + (y / max(h - 1, 1) - .5) * np.sin(th)) + .5
    t = np.clip(t, 0, 1)[..., None]
    rgb = c0 * (1 - t) + c1 * t
    return Image.fromarray(np.dstack([rgb, np.full((h, w, 1), 255)]).astype(np.uint8), "RGBA")

def rounded_mask(size, radius, ss=4):
    m = Image.new("L", (size[0] * ss, size[1] * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * ss - 1, size[1] * ss - 1], radius * ss, fill=255)
    return m.resize(size, Image.LANCZOS)

def save(img, *p):
    path = out(*p); img.save(path); return path

# ---- noise (periodic => tileable) ----
def _smooth(t): return t * t * t * (t * (t * 6 - 15) + 10)

def pnoise(w, h, cells, rng, octaves=1, persistence=.5):
    """Periodic fractal value noise in [0,1], shape (h,w). Tileable."""
    total = np.zeros((h, w)); amp = 1.0; norm = 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        lat = rng.random((c, c))
        ys = np.linspace(0, c, h, endpoint=False); xs = np.linspace(0, c, w, endpoint=False)
        y0 = ys.astype(int); x0 = xs.astype(int); fy = _smooth(ys - y0)[:, None]; fx = _smooth(xs - x0)[None, :]
        y1 = (y0 + 1) % c; x1 = (x0 + 1) % c
        a = lat[y0][:, x0]; b = lat[y0][:, x1]; cc = lat[y1][:, x0]; d = lat[y1][:, x1]
        total += amp * (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + cc * (1 - fx) * fy + d * fx * fy)
        norm += amp; amp *= persistence
    return total / norm

def to_img(arr_rgb):
    return Image.fromarray(np.clip(arr_rgb, 0, 255).astype(np.uint8), "RGB")
