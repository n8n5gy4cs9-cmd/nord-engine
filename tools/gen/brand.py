"""Logo, wordmark, splash, app icons, palette."""
import struct, io, random
from common import *

N_POLY = [(300, 760), (300, 270), (392, 270), (634, 590), (634, 270), (724, 270), (724, 760), (632, 760), (390, 440), (390, 760)]
STAR = [(790, 150), (810, 230), (890, 250), (810, 270), (790, 350), (770, 270), (690, 250), (770, 230)]

def mark(size=1024, with_bg=True):
    ss = 2; S = size * ss; k = S / 1024
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    if with_bg:
        bg = gradient(S, S, "#0B1830", "#173A6B", 60)
        img.paste(bg, (0, 0), rounded_mask((S, S), int(224 * k), 1))
        # subtle inner glow
        glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([S * .1, S * .55, S * .9, S * 1.3], fill=(79, 163, 255, 70))
        glow = glow.filter(ImageFilter.GaussianBlur(S * .08))
        m = rounded_mask((S, S), int(224 * k), 1)
        img = Image.composite(Image.alpha_composite(img, glow), img, m)
    def poly(pts, c0, c1):
        mask = Image.new("L", (S, S), 0); ImageDraw.Draw(mask).polygon([(x * k, y * k) for x, y in pts], fill=255)
        g = gradient(S, S, c0, c1, 90)
        img.paste(g, (0, 0), mask)
    poly(N_POLY, "#FFFFFF", "#8CCBFF")
    poly(STAR, "#FFE9A3", "#FFC83D")
    return img.resize((size, size), Image.LANCZOS)

def logo_svg():
    pts = lambda P: " ".join(f"{x},{y}" for x, y in P)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0B1830"/><stop offset="1" stop-color="#173A6B"/></linearGradient>
    <linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#8CCBFF"/></linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9A3"/><stop offset="1" stop-color="#FFC83D"/></linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>
  <polygon points="{pts(N_POLY)}" fill="url(#n)"/>
  <polygon points="{pts(STAR)}" fill="url(#s)"/>
</svg>
'''

def icns(png1024):
    """Minimal .icns writer (PNG-compressed chunks)."""
    chunks = []
    for tag, px in ((b"icp4", 16), (b"icp5", 32), (b"ic07", 128), (b"ic08", 256), (b"ic09", 512), (b"ic10", 1024), (b"ic11", 32), (b"ic12", 64), (b"ic13", 256), (b"ic14", 512)):
        b = io.BytesIO(); png1024.resize((px, px), Image.LANCZOS).save(b, "PNG")
        chunks.append(tag + struct.pack(">I", len(b.getvalue()) + 8) + b.getvalue())
    body = b"".join(chunks)
    return b"icns" + struct.pack(">I", len(body) + 8) + body

def splash():
    W, H = 1280, 720
    img = gradient(W, H, "#050912", "#0F2547", 35).convert("RGBA")
    rnd = random.Random(7)
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    # faint grid
    for x in range(0, W, 64): d.line([(x, 0), (x, H)], fill=(79, 163, 255, 14))
    for y in range(0, H, 64): d.line([(0, y), (W, y)], fill=(79, 163, 255, 14))
    # stars
    for _ in range(140):
        x, y, r = rnd.randint(0, W), rnd.randint(0, H), rnd.choice([1, 1, 1, 2, 2, 3])
        a = rnd.randint(60, 200); d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 225, 255, a))
    img = Image.alpha_composite(img, ov)
    # horizon glow
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-200, H - 160, W + 200, H + 380], fill=(79, 163, 255, 90))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(90)))
    # mountains silhouette (Nord = north)
    pts = [(0, H)]
    x = 0
    while x <= W:
        pts.append((x, H - 60 - 70 * abs(np.sin(x / 190.0)) - 40 * abs(np.sin(x / 71.0)))); x += 16
    pts.append((W, H))
    ImageDraw.Draw(img).polygon(pts, fill=(6, 12, 24, 255))
    m = mark(380); img.alpha_composite(m, (110, 150))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.text((540, 190), "NORD", font=font("ExtraBold", 150), fill="#FFFFFF")
    d.text((548, 345), "ENGINE", font=font("SemiBold", 78), fill=PALETTE["accent"])
    d.text((552, 450), "Game & app engine · builds for the web", font=font("Medium", 30), fill=PALETTE["muted"])
    d.text((552, 640), "Crowelian 2026 + Sonnet", font=font("Medium", 26), fill=PALETTE["muted"])
    d.text((W - 190, 640), "v0.0.1", font=font("Medium", 26), fill=PALETTE["muted"])
    # loading bar
    d.rounded_rectangle([552, 560, 1130, 572], 6, fill=(255, 255, 255, 30))
    d.rounded_rectangle([552, 560, 900, 572], 6, fill=PALETTE["accent"])
    return Image.alpha_composite(img, ov).convert("RGB")

def wordmark():
    img = Image.new("RGBA", (1100, 260), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    img.alpha_composite(mark(240), (0, 10))
    d.text((280, 20), "NORD", font=font("ExtraBold", 150), fill="#FFFFFF")
    d.text((780, 78), "ENGINE", font=font("SemiBold", 66), fill=PALETTE["accent"])
    return img

def run():
    m = mark(1024)
    save(m, "brand", "logo.png"); save(mark(512), "brand", "logo-512.png"); save(mark(256), "brand", "logo-256.png")
    save(mark(1024, with_bg=False), "brand", "logo-mark-transparent.png")
    open(out("brand", "logo.svg"), "w").write(logo_svg())
    save(wordmark(), "brand", "wordmark.png")
    s = splash(); save(s, "brand", "splash.png"); save(s.resize((640, 360), Image.LANCZOS), "brand", "splash-640x360.png")
    for px in (16, 32, 48, 64, 128, 180, 256, 512): save(m.resize((px, px), Image.LANCZOS), "brand", "icons", f"icon-{px}.png")
    open(out("brand", "icon.icns"), "wb").write(icns(m))
    m.save(out("brand", "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    save(m.resize((64, 64), Image.LANCZOS), "brand", "favicon.png")
    json.dump({"name": "Nord", "colors": PALETTE, "fonts": {"ui": "Inter", "code": "JetBrains Mono"}}, open(out("brand", "palette.json"), "w"), indent=2)
    print("brand ok")
