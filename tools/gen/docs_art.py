"""Manual graphics: banner, tutorial cover template, 17 section icon badges (Lucide SVG rasterised via headless Chromium)."""
import glob, subprocess, tempfile
from common import *
from brand import mark

SECTIONS = ["rocket", "layout-dashboard", "folder-open", "code", "layers", "box", "magnet", "music", "layout-template", "gamepad-2",
            "images", "library", "cpu", "upload", "gauge", "book-open", "info"]
CHROME = glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome")[0]

def badges():
    cells = []
    for i, n in enumerate(SECTIONS):
        svg = open(os.path.join(A, "icons/lucide", f"{n}.svg")).read().replace('width="24"', 'width="64"').replace('height="24"', 'height="64"')
        cells.append(f'<div class="b" style="left:{i * 128}px">{svg}</div>')
    html = f'''<html><body style="margin:0;background:transparent"><style>.b{{position:absolute;top:0;width:128px;height:128px;border-radius:32px;
    background:linear-gradient(135deg,#2468C8,#4FA3FF);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -6px 0 rgba(0,0,0,.18)}}</style>{''.join(cells)}</body></html>'''
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "b.html"); shot = os.path.join(td, "b.png"); open(p, "w").write(html)
        subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                        f"--window-size={128 * len(SECTIONS)},400", f"--screenshot={shot}", f"file://{p}"], check=True, capture_output=True)
        sheet = Image.open(shot).convert("RGBA")
    for i, n in enumerate(SECTIONS): save(sheet.crop((i * 128, 0, i * 128 + 128, 128)), "docs", "icons", f"{i + 1:02d}-{n}.png")

def banner():
    W, H = 1600, 320
    im = gradient(W, H, "#0A1426", "#173A6B", 20).convert("RGBA"); rnd = np.random.default_rng(2)
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for _ in range(90): x, y, r = int(rnd.integers(0, W)), int(rnd.integers(0, H)), int(rnd.choice([1, 1, 2])); d.ellipse([x - r, y - r, x + r, y + r], fill=(210, 230, 255, int(rnd.integers(60, 200))))
    im = Image.alpha_composite(im, ov); im.alpha_composite(mark(200), (70, 60)); d = ImageDraw.Draw(im)
    d.text((300, 70), "Nord Engine", font=font("ExtraBold", 96), fill="#FFFFFF"); d.text((304, 190), "Manual · Guides · Tutorials", font=font("Medium", 40), fill=PALETTE["accent2"])
    save(im.convert("RGB"), "docs", "manual-banner.png")

def cover():
    W, H = 800, 450; im = gradient(W, H, "#0E1626", "#1B3A66", 45).convert("RGBA"); d = ImageDraw.Draw(im)
    im.alpha_composite(mark(110), (30, 30)); d.text((30, 330), "TUTORIAL", font=font("SemiBold", 28), fill=PALETTE["accent"]); d.text((30, 365), "Title goes here", font=font("Bold", 52), fill="#FFFFFF")
    save(im.convert("RGB"), "docs", "tutorial-cover-template.png")

def run(): badges(); banner(); cover(); print("docs art ok")
