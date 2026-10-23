"""Splash + app icon cut from the owner's reference image (assets/brand/reference-splash-icon.jpg, 2026-10-23).
Overrides the procedural brand art from brand.py; run via `python3 tools/gen_assets.py brand`."""
import os
from PIL import Image, ImageDraw

REF = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "brand", "reference-splash-icon.jpg")

def apply(save, out, icns):
    src = Image.open(REF).convert("RGB")
    ic = src.crop((637, 219, 957, 549)).resize((1024, 1024), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (2048, 2048), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 2047, 2047), radius=int(2048 * 0.225), fill=255)
    ic.putalpha(m.resize((1024, 1024), Image.LANCZOS))
    save(ic, "brand", "logo.png"); save(ic, "brand", "logo-mark-transparent.png")
    for n in (512, 256): save(ic.resize((n, n), Image.LANCZOS), "brand", f"logo-{n}.png")
    for n in (16, 32, 48, 64, 128, 180, 256, 512): save(ic.resize((n, n), Image.LANCZOS), "brand", "icons", f"icon-{n}.png")
    save(ic.resize((64, 64), Image.LANCZOS), "brand", "favicon.png")
    ic.save(out("brand", "icon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    open(out("brand", "icon.icns"), "wb").write(icns(ic))
    sp = src.crop((40, 165, 566, 626))
    save(sp.resize((1052, 922), Image.LANCZOS), "brand", "splash.png")
    save(sp.resize((600, 526), Image.LANCZOS), "brand", "splash-600x526.png")
