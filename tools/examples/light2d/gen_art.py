#!/usr/bin/env python3
"""Procedural art for the Crypt of Embers example (original, deterministic). usage: python3 tools/examples/light2d/gen_art.py"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), 'assets/sprites')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(7)
clamp = lambda v: max(0, min(255, int(v)))


def floor(W=1280, H=800, T=64):
    im = Image.new('RGB', (W, H), (96, 92, 108))
    d = ImageDraw.Draw(im)
    for ty in range(0, H, T):
        for tx in range(0, W, T):
            v = rnd.randint(-12, 12)
            base = (104 + v, 100 + v, 116 + v)
            d.rectangle([tx, ty, tx + T - 1, ty + T - 1], fill=base)
            for _ in range(70):  # speckle
                x, y = tx + rnd.randrange(T), ty + rnd.randrange(T)
                k = rnd.randint(-18, 14)
                d.point((x, y), fill=(clamp(base[0] + k), clamp(base[1] + k), clamp(base[2] + k)))
            d.line([tx, ty, tx + T - 1, ty], fill=(base[0] - 26, base[1] - 26, base[2] - 24))
            d.line([tx, ty, tx, ty + T - 1], fill=(base[0] - 26, base[1] - 26, base[2] - 24))
            d.line([tx + 1, ty + 1, tx + T - 2, ty + 1], fill=(base[0] + 10, base[1] + 10, base[2] + 12))
            if rnd.random() < 0.18:  # crack
                x, y = tx + rnd.randrange(8, T - 8), ty + rnd.randrange(8, T - 8)
                for _ in range(rnd.randint(4, 8)):
                    nx, ny = x + rnd.randint(-7, 7), y + rnd.randint(-7, 7)
                    d.line([x, y, nx, ny], fill=(58, 54, 68))
                    x, y = nx, ny
    im.save(os.path.join(OUT, 'floor.png'))


def wall(S=32):
    im = Image.new('RGB', (S, S), (92, 84, 108))
    d = ImageDraw.Draw(im)
    for r in range(4):
        y = r * 8
        off = 0 if r % 2 == 0 else 8
        for x in range(-16, S + 16, 16):
            bx = x + off
            v = rnd.randint(-10, 10)
            d.rectangle([bx, y, bx + 14, y + 6], fill=(98 + v, 90 + v, 116 + v))
            d.line([bx, y, bx + 14, y], fill=(120 + v, 112 + v, 138 + v))
            d.line([bx, y + 6, bx + 14, y + 6], fill=(66, 60, 82))
    im.save(os.path.join(OUT, 'wall.png'))


def pillar(S=48):
    im = Image.new('RGBA', (S * 4, S * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c, R = S * 2, S * 2 - 6
    for i in range(R, 0, -1):  # radial shading, light from top-left
        t = i / R
        v = 70 + (1 - t) * 70
        d.ellipse([c - i, c - i, c + i, c + i], fill=(clamp(v), clamp(v - 4), clamp(v + 14), 255))
    d.ellipse([c - R, c - R, c + R, c + R], outline=(44, 40, 58, 255), width=5)
    d.ellipse([c - R * 0.62, c - R * 0.62, c + R * 0.62, c + R * 0.62], outline=(138, 132, 152, 255), width=3)
    im = im.resize((S, S), Image.LANCZOS)
    im.save(os.path.join(OUT, 'pillar.png'))


def brazier(S=64):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S // 2
    d.ellipse([6, 6, S - 6, S - 6], fill=(34, 30, 40, 255), outline=(16, 14, 22, 255), width=3)
    d.ellipse([12, 12, S - 12, S - 12], fill=(62, 56, 70, 255))
    for i in range(14, 0, -1):  # glowing coals
        t = i / 14
        d.ellipse([c - i, c - i, c + i, c + i], fill=(clamp(200 + 55 * (1 - t)), clamp(70 + 120 * (1 - t) ** 2), clamp(20 + 30 * (1 - t)), 255))
    for a in range(8):  # rim studs
        x, y = c + math.cos(a * math.pi / 4) * 26, c + math.sin(a * math.pi / 4) * 26
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(110, 104, 124, 255))
    im.save(os.path.join(OUT, 'brazier.png'))


def gate(W=80, H=32):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], fill=(44, 40, 56, 255), outline=(20, 18, 30, 255), width=2)
    for x in range(8, W - 4, 11):
        d.rectangle([x, 3, x + 4, H - 4], fill=(120, 116, 136, 255), outline=(30, 28, 40, 255))
        d.line([x + 1, 4, x + 1, H - 5], fill=(170, 166, 186, 255))
    d.rectangle([2, 12, W - 3, 15], fill=(88, 84, 104, 255))
    im.save(os.path.join(OUT, 'gate.png'))


def shade(S=40):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = im.load()
    c = S / 2
    for y in range(S):
        for x in range(S):
            dx, dy = x - c + .5, y - c + .5
            a = math.atan2(dy, dx)
            r = math.hypot(dx, dy)
            edge = 12 + 4.5 * math.sin(a * 5 + 1.3) + 3 * math.sin(a * 9)  # wispy outline
            t = 1 - r / edge
            if t > 0:
                v = clamp(255 * min(1, t * 2.2))
                px[x, y] = (30 + int(24 * t), 14 + int(10 * t), 52 + int(30 * t), v)
    im.save(os.path.join(OUT, 'shade.png'))


def rune(S=96):  # glowing exit sigil
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = S // 2
    d.ellipse([6, 6, S - 6, S - 6], outline=(255, 255, 255, 255), width=3)
    d.ellipse([20, 20, S - 20, S - 20], outline=(255, 255, 255, 255), width=2)
    for a in range(6):
        t = a * math.pi / 3
        d.line([c + math.cos(t) * 22, c + math.sin(t) * 22, c + math.cos(t + 2 * math.pi / 3 * 1) * 22, c + math.sin(t + 2 * math.pi / 3) * 22], fill=(255, 255, 255, 255), width=2)
    im.save(os.path.join(OUT, 'rune.png'))


def eyes(W=16, H=8):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for cx in (4, 11):
        d.ellipse([cx - 3, 1, cx + 3, 7], fill=(255, 255, 255, 70))
        d.ellipse([cx - 1.5, 2.5, cx + 1.5, 5.5], fill=(255, 255, 255, 255))
    im.save(os.path.join(OUT, 'eyes.png'))


for f in (floor, wall, pillar, brazier, gate, shade, rune, eyes):
    f()
print('wrote', sorted(os.listdir(OUT)))
