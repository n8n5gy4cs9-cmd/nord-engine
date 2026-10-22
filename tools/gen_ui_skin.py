#!/usr/bin/env python3
"""Generate the sample 9-slice UI skin (assets/ui/skin/*.png + pixel.skin.json). Re-runnable; art is original (Nord, CC0-style)."""
import json, os
from PIL import Image, ImageDraw
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'ui', 'skin')
os.makedirs(OUT, exist_ok=True)

def frame(size, fill, edge, hi, lo, r=4):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, size - 1, size - 1), r, fill=edge)
    d.rounded_rectangle((1, 1, size - 2, size - 2), r - 1, fill=fill)
    d.line((r, 1, size - r - 1, 1), fill=hi)          # top highlight
    d.line((r, size - 2, size - r - 1, size - 2), fill=lo)  # bottom shade
    return im

panel = frame(24, '#2b3a55', '#0c1424', '#46628e', '#1d2940', 5)
panel.save(f'{OUT}/panel.png')
for name, fill, hi, lo in (('button', '#3f6fa8', '#7fb0e8', '#2a4d7a'), ('button-hover', '#4f86c6', '#a5ccf5', '#35629a'), ('button-down', '#2f5788', '#4f86c6', '#274a73'), ('button-danger', '#a8434f', '#e88a93', '#7a2a33')):
    frame(16, fill, '#0c1424', hi, lo, 3).save(f'{OUT}/{name}.png')
bar = Image.new('RGBA', (8, 8), (0, 0, 0, 0)); d = ImageDraw.Draw(bar)
d.rectangle((0, 0, 7, 7), fill='#0c1424'); d.rectangle((1, 1, 6, 6), fill='#1d2940'); bar.save(f'{OUT}/bar-back.png')
skin = {
  "tokens": {"fg": "#e8f0ff", "accent": "#7fb0e8", "good": "#6fcf7a", "font-ui": "system-ui, sans-serif"},
  "styles": {
    "panel": {"image": {"src": "assets/ui/skin/panel.png", "slice": [8, 8, 8, 8], "scale": 2, "pixelated": True}, "padding": 4, "boxShadow": "none"},
    "button": {"image": {"src": "assets/ui/skin/button.png", "slice": [5, 5, 5, 5], "scale": 3, "pixelated": True}, "color": "$fg", "fontWeight": 700, "padding": "4px 14px", "borderRadius": 0,
               "background": "none", "hover": {"image": {"src": "assets/ui/skin/button-hover.png", "slice": [5, 5, 5, 5], "scale": 3, "pixelated": True}},
               "pressed": {"image": {"src": "assets/ui/skin/button-down.png", "slice": [5, 5, 5, 5], "scale": 3, "pixelated": True}, "transform": "translateY(1px)"},
               "disabled": {"opacity": 0.5}},
    ".danger": {"extends": "button", "image": {"src": "assets/ui/skin/button-danger.png", "slice": [5, 5, 5, 5], "scale": 3, "pixelated": True}},
    ".title": {"fontSize": 40, "fontWeight": 800, "color": "$accent", "textShadow": "0 3px 0 #0c1424"},
    "bar": {"image": {"src": "assets/ui/skin/bar-back.png", "slice": [2, 2, 2, 2], "scale": 2, "pixelated": True}, "height": 20}
  }
}
json.dump(skin, open(f'{OUT}/pixel.skin.json', 'w'), indent=2); open(f'{OUT}/pixel.skin.json', 'a').write('\n')
print('wrote', os.listdir(OUT))
