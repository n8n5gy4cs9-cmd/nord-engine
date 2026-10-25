#!/usr/bin/env python3
"""Generates the vector-monitor art of examples/vector-rocks: glowing green line drawings (ship, rocks, bullet, shield, power-up icons) and
an 800x600 monitor bezel with a transparent screen. Deterministic (seeded). Run: python3 tools/gen_vector_rocks_art.py"""
import math, random, pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'examples/vector-rocks/assets/sprites'
OUT.mkdir(parents=True, exist_ok=True)
SS = 4                                   # supersampling for clean lines
CORE, MID, HALO = (205, 255, 215), (70, 255, 120), (20, 190, 70)

def glow_canvas(size, strokes, width=2.0, closed=()):
    """strokes: list of polylines in pixel coords (centre origin). Returns an RGBA image of a phosphor line drawing with halo."""
    w = h = size
    layer = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(layer)
    for pts in strokes:
        p = [((x + w / 2) * SS, (y + h / 2) * SS) for x, y in pts]
        d.line(p, fill=255, width=int(width * SS), joint='curve')
        for q in (p[0], p[-1]): d.ellipse([q[0] - width * SS / 2, q[1] - width * SS / 2, q[0] + width * SS / 2, q[1] + width * SS / 2], fill=255)
    core = layer.resize((w, h), Image.LANCZOS)
    tight = core.filter(ImageFilter.GaussianBlur(1.6))
    wide = core.filter(ImageFilter.GaussianBlur(5.5))
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    def put(mask, color, gain):
        solid = Image.new('RGBA', (w, h), color + (0,))
        solid.putalpha(mask.point(lambda v: min(255, int(v * gain))))
        img.alpha_composite(solid)
    put(wide, HALO, 1.1); put(tight, MID, 1.5); put(core, CORE, 1.0)
    return img

def poly(r, n, jitter, seed):
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        a = i / n * math.tau
        rr = r * (1 - jitter + rnd.random() * jitter * 2)
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    return pts + [pts[0]]

def save(name, img): img.save(OUT / name)

# ---- ship (points up), flame, bullet, shield
save('ship.png', glow_canvas(64, [[(0, -22), (15, 18), (0, 10), (-15, 18), (0, -22)]], 2.2))
save('flame.png', glow_canvas(64, [[(-7, 14), (0, 28), (7, 14)], [(-3, 14), (0, 21), (3, 14)]], 2.0))
save('bullet.png', glow_canvas(16, [[(0, 0), (0.2, 0.2)]], 4.2))
ring = [(math.cos(i / 48 * math.tau) * 29, math.sin(i / 48 * math.tau) * 29) for i in range(49)]
save('shield.png', glow_canvas(80, [ring], 1.6))
# ---- rocks: three sizes, three shapes each
for tag, size, r, n in (('l', 120, 46, 12), ('m', 72, 27, 10), ('s', 40, 14, 8)):
    for v in range(3):
        pts = poly(r, n, 0.22, 100 * v + size)
        save(f'rock_{tag}{v}.png', glow_canvas(size, [pts], 2.0 if tag != 's' else 1.8))

# ---- power-up icons: a ring with a vector symbol inside
def icon(name, strokes):
    ringp = [(math.cos(i / 40 * math.tau) * 17, math.sin(i / 40 * math.tau) * 17) for i in range(41)]
    save(f'pu_{name}.png', glow_canvas(48, [ringp] + strokes, 1.7))
icon('shield', [[(0, -8), (7, -5), (6, 3), (0, 9), (-6, 3), (-7, -5), (0, -8)]])
icon('rapid', [[(-6, -7), (0, -1), (6, -7)], [(-6, 1), (0, 7), (6, 1)]])
icon('triple', [[(0, 8), (0, -8)], [(0, 8), (-8, -6)], [(0, 8), (8, -6)]])
icon('nova', [[(math.cos(a) * 3, math.sin(a) * 3), (math.cos(a) * 9, math.sin(a) * 9)] for a in [i / 8 * math.tau for i in range(8)]])
icon('life', [[(-7, 0), (7, 0)], [(0, -7), (0, 7)]])
icon('slow', [[(-6, -8), (6, -8), (-6, 8), (6, 8), (-6, -8)]])

# ---- the monitor bezel: 800x600, transparent opening
W, H = 800, 600
X0, Y0, X1, Y1, R = 38, 34, 762, 566, 54
bez = Image.new('RGBA', (W, H), (0, 0, 0, 0))
base = Image.new('RGB', (W, H))
bd = ImageDraw.Draw(base)
for y in range(H):                                          # brushed dark plastic, lighter on top
    k = 1 - abs(y - H * 0.35) / H * 0.55
    bd.line([(0, y), (W, y)], fill=(int(30 * k), int(33 * k), int(34 * k)))
rnd = random.Random(7)
noise = Image.effect_noise((W, H), 14).convert('L')
base = ImageChops.add(base, Image.merge('RGB', (noise.point(lambda v: v // 14),) * 3))
mask = Image.new('L', (W, H), 255)
ImageDraw.Draw(mask).rounded_rectangle([X0, Y0, X1, Y1], R, fill=0)
bez.paste(base, (0, 0), mask)
# bevel highlight and recess shadow around the opening
ring_l = Image.new('L', (W, H), 0)
ImageDraw.Draw(ring_l).rounded_rectangle([X0 - 3, Y0 - 3, X1 + 3, Y1 + 3], R + 3, outline=255, width=6)
shadow = ring_l.filter(ImageFilter.GaussianBlur(7))
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sh.putalpha(shadow.point(lambda v: int(v * 0.95)))
hl = Image.new('RGBA', (W, H), (120, 130, 130, 0))
hl_m = Image.new('L', (W, H), 0); ImageDraw.Draw(hl_m).rounded_rectangle([X0 - 9, Y0 - 9, X1 + 9, Y1 + 9], R + 9, outline=255, width=2)
hl.putalpha(hl_m.filter(ImageFilter.GaussianBlur(1)).point(lambda v: int(v * 0.5)))
bez.alpha_composite(hl)
open_mask = Image.new('L', (W, H), 0); ImageDraw.Draw(open_mask).rounded_rectangle([X0, Y0, X1, Y1], R, fill=255)
inner = shadow.point(lambda v: int(v * 0.9)); inner = ImageChops.multiply(inner, open_mask)
sh2 = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sh2.putalpha(inner)
bez.alpha_composite(sh2)
# CRT roundness: darker toward the corners of the glass, plus a glass reflection streak
vig = Image.new('L', (W, H), 0); vd = ImageDraw.Draw(vig)
for i in range(60):
    vd.rounded_rectangle([X0 + i * 2, Y0 + i * 2, X1 - i * 2, Y1 - i * 2], max(8, R - i), outline=int(150 * (1 - i / 60) ** 2.2), width=3)
vig = ImageChops.multiply(vig.filter(ImageFilter.GaussianBlur(5)), open_mask)
vg = Image.new('RGBA', (W, H), (0, 0, 0, 0)); vg.putalpha(vig); bez.alpha_composite(vg)
streak = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(streak)
sd.polygon([(X0 + 40, Y0 + 14), (X0 + 330, Y0 + 14), (X0 + 120, Y0 + 220), (X0 + 14, Y0 + 220)], fill=26)
streak = ImageChops.multiply(streak.filter(ImageFilter.GaussianBlur(18)), open_mask)
gl = Image.new('RGBA', (W, H), (190, 255, 215, 0)); gl.putalpha(streak); bez.alpha_composite(gl)
# nameplate, LED, screws, vents
d = ImageDraw.Draw(bez)
def font(sz):
    for f in ('/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Monaco.ttf', '/System/Library/Fonts/Supplemental/Courier New Bold.ttf', 'DejaVuSansMono-Bold.ttf'):
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()
d.rounded_rectangle([300, 572, 500, 592], 4, fill=(18, 20, 21, 255), outline=(60, 64, 64, 255))
d.text((400, 582), 'XY-1  VECTOR DISPLAY', font=font(11), fill=(150, 160, 155, 255), anchor='mm')
d.ellipse([706, 574, 718, 586], fill=(60, 255, 120, 255)); 
led = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(led).ellipse([700, 568, 724, 592], fill=(60, 255, 120, 90)); bez.alpha_composite(led.filter(ImageFilter.GaussianBlur(5)))
for x, y in ((16, 16), (784, 16), (16, 584), (784, 584)):
    d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(52, 55, 56, 255), outline=(12, 13, 13, 255)); d.line([x - 4, y - 3, x + 4, y + 3], fill=(18, 19, 19, 255), width=2)
for i in range(7): d.rounded_rectangle([60 + i * 14, 574, 66 + i * 14, 590], 2, fill=(10, 11, 11, 255))
save('bezel.png', bez)
print('wrote', len(list(OUT.glob('*.png'))), 'images to', OUT)
