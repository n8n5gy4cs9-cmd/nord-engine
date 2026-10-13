#!/usr/bin/env python3
"""Original placeholder art for examples/angry-touch (crowelian 2026 + sonnet). Re-runnable: python3 tools/gen_angry_touch_assets.py"""
from PIL import Image, ImageDraw
import os
out = os.path.join(os.path.dirname(__file__), '..', 'examples', 'angry-touch', 'assets', 'sprites')
S = 4  # supersample

def canvas(n=64):
    return Image.new('RGBA', (n * S, n * S), (0, 0, 0, 0))

def save(im, name):
    im.resize((im.width // S, im.height // S), Image.LANCZOS).save(os.path.join(out, name))

def face(d, cx, cy, r, body, edge, eye_dx=.34, snout=False, brow=False):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=body, outline=edge, width=3 * S)
    for sx in (-1, 1):
        ex, ey = cx + sx * r * eye_dx, cy - r * .18
        d.ellipse([ex - r * .2, ey - r * .22, ex + r * .2, ey + r * .22], fill='white')
        d.ellipse([ex - r * .09 + sx * -r * .03, ey - r * .1, ex + r * .09 + sx * -r * .03, ey + r * .14], fill='#2e3440')
        if brow: d.line([ex - sx * r * .38, ey - r * .42 - sx * r * .14 * -1, ex + sx * r * .1, ey - r * .22 + sx * r * .0], fill='#2e3440', width=3 * S)
    if snout:
        d.ellipse([cx - r * .32, cy + r * .0, cx + r * .32, cy + r * .5], fill='#a3be8c', outline=edge, width=2 * S)
        for sx in (-1, 1): d.ellipse([cx + sx * r * .13 - r * .05, cy + r * .2, cx + sx * r * .13 + r * .05, cy + r * .34], fill='#4c6a3c')

# bird: red round, angry brows, yellow beak
im = canvas(); d = ImageDraw.Draw(im); c = 32 * S
d.polygon([(c + 20 * S, c - 2 * S), (c + 31 * S, c + 4 * S), (c + 20 * S, c + 10 * S)], fill='#ebcb8b', outline='#a07a2a')
face(d, c, c, 26 * S, '#bf616a', '#7a2f36', brow=True); save(im, 'bird.png')
# pig: green round with snout
im = canvas(); d = ImageDraw.Draw(im)
for sx in (-1, 1): d.polygon([(c + sx * 14 * S, c - 22 * S), (c + sx * 24 * S, c - 30 * S), (c + sx * 26 * S, c - 14 * S)], fill='#8fb573', outline='#4c6a3c')
face(d, c, c, 27 * S, '#a3be8c', '#4c6a3c', snout=True); save(im, 'pig.png')

def block(name, base, dark, light, kind):
    im = canvas(); d = ImageDraw.Draw(im); n = 64 * S
    d.rectangle([0, 0, n - 1, n - 1], fill=base, outline=dark, width=3 * S)
    if kind == 'wood':
        for y in (16, 32, 48): d.line([(4 * S, y * S), (60 * S, y * S)], fill=light, width=2 * S)
        d.line([(4 * S, 4 * S), (60 * S, 60 * S)], fill=dark, width=1 * S)
    elif kind == 'stone':
        for (x0, y0, x1, y1) in [(6, 6, 30, 26), (34, 10, 58, 30), (8, 36, 36, 58), (40, 38, 58, 56)]:
            d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], 6 * S, outline=dark, fill=light, width=2 * S)
    else:  # ice
        d.polygon([(6 * S, 6 * S), (30 * S, 6 * S), (6 * S, 30 * S)], fill=light)
        d.line([(34 * S, 60 * S), (60 * S, 34 * S)], fill='white', width=3 * S)
    save(im, name)
block('wood.png', '#c9a06a', '#7a5a2a', '#dfbb86', 'wood')
block('stone.png', '#9aa3b2', '#4c566a', '#b7bfcc', 'stone')
block('ice.png', '#a8d8e8', '#5e9fb8', '#d6f0f8', 'ice')

# plain solid tile + hill (no soft edges, unlike the shared circle/square placeholders)
Image.new('RGBA', (8, 8), (255, 255, 255, 255)).save(os.path.join(out, 'solid.png'))
im = Image.new('RGBA', (512 * 2, 256 * 2), (0, 0, 0, 0)); ImageDraw.Draw(im).ellipse([0, 0, 1023, 511], fill='white')
im.resize((512, 256), Image.LANCZOS).save(os.path.join(out, 'hill.png'))
