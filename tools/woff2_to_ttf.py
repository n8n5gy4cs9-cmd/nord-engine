#!/usr/bin/env python3
"""Convert vendored latin woff2 fonts (400/700) to TTF for the egui editor (egui cannot read woff2).
Output: assets/fonts/skins/<dir>-{regular,bold}.ttf. Needs: pip install fonttools brotli."""
import pathlib
from fontTools.ttLib import TTFont
root = pathlib.Path(__file__).resolve().parent.parent
out = root / "assets/fonts/skins"; out.mkdir(parents=True, exist_ok=True)
for d in sorted((root / "vendor/fonts").iterdir()):
    for w, n in ((400, "regular"), (700, "bold")):
        src = d / f"{d.name}-latin-{w}-normal.woff2"
        if src.exists():
            f = TTFont(src); f.flavor = None; f.save(out / f"{d.name}-{n}.ttf"); print(out / f"{d.name}-{n}.ttf")
