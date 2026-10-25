#!/usr/bin/env python3
"""Contact sheets of the starter-project assets for the Vector Rocks and Ember Crypt pages
(docs/screenshots/vector-rocks-assets.png, ember-crypt-assets.png). Run: python3 tools/make_asset_sheets.py"""
import pathlib
from PIL import Image, ImageDraw, ImageFont
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/screenshots'
def font(sz):
    for f in ('/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Monaco.ttf', 'DejaVuSansMono.ttf'):
        try: return ImageFont.truetype(f, sz)
        except Exception: pass
    return ImageFont.load_default()
def sheet(items, bg, name, cols, cell, scale=lambda im: 1):
    rows = (len(items) + cols - 1) // cols
    W = Image.new('RGBA', (cols * cell[0], rows * cell[1]), bg)
    d = ImageDraw.Draw(W)
    for i, (label, path, frame) in enumerate(items):
        im = Image.open(path).convert('RGBA')
        if frame: im = im.crop((0, 0, frame, frame))
        k = scale(im); im = im.resize((int(im.width * k), int(im.height * k)), Image.NEAREST if k > 1 else Image.LANCZOS)
        x, y = (i % cols) * cell[0], (i // cols) * cell[1]
        W.alpha_composite(im, (x + (cell[0] - im.width) // 2, y + 6 + (cell[1] - 28 - im.height) // 2))
        d.text((x + cell[0] // 2, y + cell[1] - 12), label, font=font(11), fill=(150, 170, 160, 255), anchor='mm')
    W.convert('RGB').save(OUT / name)
V = ROOT / 'examples/vector-rocks/assets/sprites'
sheet([(n, V / f'{n}.png', 0) for n in ('ship', 'flame', 'bullet', 'shield', 'rock_l0', 'rock_l1', 'rock_l2', 'rock_m0', 'rock_m1', 'rock_m2', 'rock_s0', 'rock_s1', 'rock_s2',
                                          'pu_shield', 'pu_rapid', 'pu_triple', 'pu_nova', 'pu_life')], (2, 10, 4, 255), 'vector-rocks-assets.png', 6, (130, 150))
E = ROOT / 'examples/ember-crypt/assets/sprites'
items = [('hero (frames)', E / 'hero.png', 0), ('slime', E / 'enemy_slime.png', 0), ('bat', E / 'enemy_bat.png', 0), ('coin', E / 'coin.png', 0), ('wall', E / 'wall.png', 0),
         ('gate', E / 'gate.png', 0), ('brazier', E / 'brazier.png', 0), ('rune', E / 'rune.png', 0)] + [(n, E / f'items/{n}.png', 0) for n in ('key', 'potion_red', 'chest_closed', 'crate', 'barrel', 'spikes', 'heart_full', 'heart_empty')]
sheet(items, (20, 22, 30, 255), 'ember-crypt-assets.png', 6, (190, 120), lambda im: max(1, min(4, 84 // max(im.width, im.height))))
print('ok')
