"""Pixel-art placeholder sprites, spritesheets (+ .meta.json), tileset, parallax backgrounds, UI kit."""
import math
from common import *

def C(h, a=255): r, g, b = hexrgb(h); return (r, g, b, a)
OUT = C("#14182A")

class Cv:
    def __init__(s, w, h): s.im = Image.new("RGBA", (w, h), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.im)
    def r(s, x0, y0, x1, y1, c): s.d.rectangle([x0, y0, x1, y1], fill=c)
    def p(s, x, y, c): s.d.point((x, y), fill=c)
    def e(s, x0, y0, x1, y1, c): s.d.ellipse([x0, y0, x1, y1], fill=c)
    def outline(s, c=OUT):
        a = np.array(s.im); m = a[..., 3] > 0; o = np.zeros_like(m)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): o |= np.roll(np.roll(m, dx, 1), dy, 0)
        o &= ~m; a[o] = c; s.im = Image.fromarray(a, "RGBA"); s.d = ImageDraw.Draw(s.im); return s

def sheet(frames, name, anims=None, cell=None):
    w, h = frames[0].size; im = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames): im.paste(f, (i * w, 0))
    save(im, "sprites", f"{name}.png")
    meta = {"type": "spritesheet", "frameWidth": w, "frameHeight": h, "filter": "nearest", "anims": anims or {}}
    json.dump(meta, open(out("sprites", f"{name}.png.meta.json"), "w"), indent=2)

def one(cv, name): save(cv.outline().im if hasattr(cv, "outline") else cv, "sprites", f"{name}.png")

# ---------- characters (32x32 cells) ----------
def hero(frame):
    c = Cv(32, 32); bob = {0: 0, 1: -1, 2: 0, 3: -1, 4: 0, 5: -1}.get(frame, 0)
    skin, shirt, pants, hair, boots = C("#F2C79B"), C("#3E7BFA"), C("#2A3A66"), C("#5A3A22"), C("#222A44")
    leg = [(0, 0), (-2, 1), (0, 0), (2, 1)][frame - 2] if 2 <= frame <= 5 else (0, 0)
    jump = frame == 6; hurt = frame == 7
    y0 = 8 + bob + (-2 if jump else 0)
    # legs
    if jump: c.r(11, y0 + 14, 14, y0 + 18, pants); c.r(17, y0 + 13, 20, y0 + 17, pants); c.r(10, y0 + 18, 14, y0 + 19, boots); c.r(17, y0 + 17, 21, y0 + 18, boots)
    else:
        c.r(11 + leg[0], y0 + 15, 14 + leg[0], y0 + 21, pants); c.r(17 - leg[0], y0 + 15, 20 - leg[0], y0 + 21, pants)
        c.r(10 + leg[0], y0 + 21, 14 + leg[0], y0 + 22, boots); c.r(17 - leg[0], y0 + 21, 21 - leg[0], y0 + 22, boots)
    c.r(10, y0 + 8, 21, y0 + 15, shirt); c.r(10, y0 + 13, 21, y0 + 14, C("#2B5BC4"))   # torso + belt shade
    arm = (-2 if frame in (3, 5) else 2 if frame in (2, 4) else 0) if not jump else -4
    c.r(8, y0 + 9 + (arm // 2), 9, y0 + 13 + (arm // 2), skin); c.r(22, y0 + 9 - (arm // 2), 23, y0 + 13 - (arm // 2), skin)
    c.r(11, y0, 20, y0 + 8, skin); c.r(10, y0 - 1, 21, y0 + 2, hair); c.r(10, y0, 11, y0 + 4, hair)
    eye = C("#FF4D4D") if hurt else C("#14182A"); c.p(17, y0 + 4, eye); c.p(19, y0 + 4, eye)
    if hurt: c.r(12, y0 + 6, 16, y0 + 6, C("#B03030"))
    return c.outline().im

def slime(f):
    c = Cv(32, 32); sq = [0, 1, 2, 1][f]; w = 20 + sq * 2; h = 14 - sq * 2; x0 = 16 - w // 2; y0 = 30 - h
    c.e(x0, y0, x0 + w, 30, C("#52D273")); c.e(x0 + 2, y0 + 1, x0 + w - 3, y0 + h // 2, C("#7BE898"))
    c.r(x0 + 4, y0 + h // 2 + 1, x0 + 7, y0 + h // 2 + 4, C("#14182A")); c.r(x0 + w - 8, y0 + h // 2 + 1, x0 + w - 5, y0 + h // 2 + 4, C("#14182A"))
    c.p(x0 + 4, y0 + h // 2 + 1, C("#FFFFFF")); c.p(x0 + w - 8, y0 + h // 2 + 1, C("#FFFFFF"))
    return c.outline().im

def bat(f):
    c = Cv(32, 32); wing = [-5, 0, 5, 0][f]
    c.e(12, 12, 20, 22, C("#6B4C9A")); c.r(12, 10, 13, 13, C("#6B4C9A")); c.r(19, 10, 20, 13, C("#6B4C9A"))
    for sgn in (-1, 1):
        x = 16 + sgn * 4
        c.d.polygon([(x, 14), (x + sgn * 12, 10 + wing), (x + sgn * 10, 17 + wing // 2), (x + sgn * 6, 16), (x + sgn * 5, 20)], fill=C("#8A6BC4"))
    c.p(14, 15, C("#FFDD55")); c.p(18, 15, C("#FFDD55")); c.p(15, 19, C("#FFFFFF")); c.p(17, 19, C("#FFFFFF"))
    return c.outline().im

def robot(f):
    c = Cv(32, 32); leg = [(0, 0), (-2, 1), (0, 0), (2, 1)][f]
    c.r(10 + leg[0], 22, 13 + leg[0], 29, C("#7A8699")); c.r(18 - leg[0], 22, 21 - leg[0], 29, C("#7A8699"))
    c.r(8, 10, 23, 22, C("#B8C4D6")); c.r(8, 18, 23, 22, C("#8796AD")); c.r(9, 3, 22, 10, C("#CBD5E4"))
    c.r(11, 5, 14, 8, C("#FF4D4D")); c.r(17, 5, 20, 8, C("#FF4D4D")); c.r(15, 0, 16, 3, C("#8796AD")); c.p(15, 0, C("#FFDD55")); c.p(16, 0, C("#FFDD55"))
    c.r(13, 13, 18, 17, C("#4FA3FF"))
    return c.outline().im

# ---------- items (16x16) ----------
def coin(f):
    c = Cv(16, 16); w = [6, 5, 3, 1, 3, 5][f]
    c.e(8 - w, 1, 8 + w, 14, C("#E0A800")); c.e(8 - w + 1, 2, 8 + w - 1, 13, C("#FFD84A"))
    if w > 3: c.r(7, 5, 8, 10, C("#E0A800"))
    return c.outline().im

def gem(col, dark):
    c = Cv(16, 16); c.d.polygon([(8, 1), (14, 6), (8, 15), (2, 6)], fill=C(col)); c.d.polygon([(8, 1), (14, 6), (8, 6)], fill=C("#FFFFFF", 90))
    c.d.polygon([(8, 6), (14, 6), (8, 15)], fill=C(dark)); c.p(5, 5, C("#FFFFFF")); return c.outline().im

def heart(kind):
    c = Cv(16, 16); col = {"full": "#F0405A", "half": "#F0405A", "empty": "#3A2F45"}[kind]
    c.e(1, 2, 8, 9, C(col)); c.e(7, 2, 14, 9, C(col)); c.d.polygon([(1, 7), (14, 7), (8, 14)], fill=C(col))
    if kind == "half": c.r(8, 0, 15, 15, (0, 0, 0, 0)); c.d.rectangle([8, 0, 15, 15], fill=(0, 0, 0, 0))
    if kind == "half":
        im = c.im; a = np.array(im); a[:, 8:] = 0; im = Image.fromarray(a); c.im = im; c.d = ImageDraw.Draw(im)
        c.e(7, 2, 14, 9, C("#3A2F45")); c.d.polygon([(7, 7), (14, 7), (8, 14)], fill=C("#3A2F45"))
        a = np.array(c.im); left = np.array(Image.new("RGBA", (16, 16))); c.d = ImageDraw.Draw(c.im)
        c.e(1, 2, 8, 9, C("#F0405A")); c.d.polygon([(1, 7), (8, 7), (8, 14)], fill=C("#F0405A"))
    if kind != "empty": c.p(4, 4, C("#FFFFFF", 200)); c.p(5, 4, C("#FFFFFF", 200))
    return c.outline().im

def key():
    c = Cv(16, 16); c.e(1, 1, 7, 7, C("#FFD84A")); c.e(3, 3, 5, 5, (0, 0, 0, 0)); c.r(6, 6, 14, 8, C("#E0A800")); c.r(11, 8, 12, 11, C("#E0A800")); c.r(14, 8, 15, 10, C("#E0A800"))
    return c.outline().im

def potion(col):
    c = Cv(16, 16); c.r(6, 1, 9, 4, C("#C9B79C")); c.e(2, 4, 13, 14, C(col)); c.e(4, 6, 6, 8, C("#FFFFFF", 160)); c.r(5, 4, 10, 6, C(col)); return c.outline().im

def star():
    c = Cv(16, 16); pts = [(8 + math.cos(math.pi / 2 + i * math.pi / 5) * (7.5 if i % 2 == 0 else 3.2), 8 - math.sin(math.pi / 2 + i * math.pi / 5) * (7.5 if i % 2 == 0 else 3.2)) for i in range(10)]
    c.d.polygon(pts, fill=C("#FFD84A")); return c.outline().im

def crate():
    c = Cv(16, 16); c.r(0, 0, 15, 15, C("#B9803F")); c.r(1, 1, 14, 14, C("#D69A52")); c.r(2, 2, 13, 13, C("#B9803F"))
    c.d.line([(2, 2), (13, 13)], fill=C("#8C5E2C")); c.d.line([(13, 2), (2, 13)], fill=C("#8C5E2C")); c.r(0, 0, 15, 0, C("#8C5E2C")); return c.outline().im

def barrel():
    c = Cv(16, 16); c.e(1, 0, 14, 15, C("#9C6532")); c.r(1, 3, 14, 4, C("#5C5F66")); c.r(1, 11, 14, 12, C("#5C5F66")); c.r(5, 1, 6, 14, C("#B87C45")); return c.outline().im

def chest(open_):
    c = Cv(16, 16); c.r(1, 7, 14, 14, C("#9C6532")); c.r(1, 7, 14, 8, C("#6E4521"))
    if open_: c.r(1, 2, 14, 6, C("#B87C45")); c.r(3, 6, 12, 7, C("#FFD84A"))
    else: c.r(1, 3, 14, 7, C("#B87C45")); c.r(7, 6, 8, 9, C("#FFD84A"))
    c.r(1, 3 if not open_ else 2, 14, 3 if not open_ else 2, C("#6E4521")); return c.outline().im

def spikes():
    c = Cv(16, 16)
    for i in range(4): x = i * 4; c.d.polygon([(x, 15), (x + 2, 6), (x + 4, 15)], fill=C("#C9D2E0")); c.d.line([(x + 2, 6), (x + 2, 15)], fill=C("#8796AD"))
    return c.outline().im

def door():
    c = Cv(16, 32); c.r(1, 2, 14, 31, C("#8C5E2C")); c.r(3, 4, 12, 31, C("#B87C45")); c.r(10, 17, 11, 18, C("#FFD84A")); c.d.line([(8, 4), (8, 31)], fill=C("#8C5E2C")); return c.outline().im

def flag(f):
    c = Cv(16, 32); c.r(2, 0, 3, 31, C("#C9D2E0")); w = [0, 1, 0, -1][f]
    c.d.polygon([(4, 2), (14, 5 + w), (4, 10)], fill=C("#F0405A")); return c.outline().im

def torch(f):
    c = Cv(16, 24); c.r(7, 10, 9, 22, C("#8C5E2C")); fl = [0, 1, 0, -1][f]
    c.d.polygon([(8, 1 + fl), (12, 8), (8, 11), (4, 8)], fill=C("#FF8A2A")); c.d.polygon([(8, 4 + fl), (10, 8), (8, 10), (6, 8)], fill=C("#FFE07A")); return c.outline().im

def bullet():
    c = Cv(8, 8); c.e(1, 2, 6, 5, C("#FFE07A")); c.e(3, 3, 6, 4, C("#FFFFFF")); return c.im

def tree():
    c = Cv(48, 64); c.r(20, 36, 27, 63, C("#7A4A24")); c.r(22, 36, 23, 63, C("#8F5A2E"))
    for (x, y, r, col) in ((24, 18, 18, "#2F7A3A"), (13, 30, 13, "#2A6B33"), (35, 30, 13, "#2A6B33"), (24, 24, 14, "#3E9B4A")): c.e(x - r, y - r, x + r, y + r, C(col))
    c.e(14, 10, 22, 16, C("#5BC06A", 160)); return c.outline().im

def bush():
    c = Cv(32, 24); [c.e(x, y, x + 14, y + 14, C(col)) for (x, y, col) in ((1, 8, "#2A6B33"), (9, 3, "#3E9B4A"), (16, 8, "#2A6B33"))]; return c.outline().im

def rock():
    c = Cv(24, 16); c.d.polygon([(1, 15), (3, 6), (10, 1), (18, 3), (23, 10), (22, 15)], fill=C("#8A919C")); c.d.polygon([(3, 6), (10, 1), (18, 3), (12, 8)], fill=C("#B4BBC6")); return c.outline().im

def cloud():
    c = Cv(48, 24); [c.e(x, y, x + w, y + h, C("#FFFFFF", 235)) for (x, y, w, h) in ((2, 10, 20, 12), (12, 2, 26, 20), (28, 8, 18, 14))]; return c.im

# ---------- tileset ----------
def tileset():
    themes = [("grass", "#6B4A2B", "#8B5E3C", "#4FB04A"), ("stone", "#4A4F5A", "#6B7280", "#9AA3B2"), ("sand", "#B99A5B", "#D9C48A", "#F0E0A8"), ("snow", "#6C7F9C", "#8CA0BF", "#F4FAFF")]
    im = Image.new("RGBA", (16 * 8, 16 * 4), (0, 0, 0, 0)); rng = np.random.default_rng(5)
    for row, (_, dark, mid, top) in enumerate(themes):
        # variants: top, topL, topR, mid, left, right, bottom, single-platform
        for col in range(8):
            t = Cv(16, 16); t.r(0, 0, 15, 15, C(mid))
            for _ in range(22): x, y = rng.integers(0, 16, 2); t.p(x, y, C(dark))
            has_top = col in (0, 1, 2, 7); L = col in (1, 4, 7); R = col in (2, 5, 7); bot = col in (6, 7)
            if has_top: t.r(0, 0, 15, 3, C(top)); t.r(0, 4, 15, 4, C(dark))
            if L: t.r(0, 0, 1, 15, C(dark)) if not has_top else t.r(0, 0, 1, 15, C(dark))
            if R: t.r(14, 0, 15, 15, C(dark))
            if bot: t.r(0, 14, 15, 15, C(dark))
            im.paste(t.im, (col * 16, row * 16))
    save(im, "sprites", "tileset_platformer.png")
    json.dump({"type": "tileset", "tileWidth": 16, "tileHeight": 16, "filter": "nearest", "columns": 8,
               "layout": "cols: top, top-left, top-right, mid, left, right, bottom, platform; rows: grass, stone, sand, snow"}, open(out("sprites", "tileset_platformer.png.meta.json"), "w"), indent=2)

def backgrounds():
    W, H = 320, 180
    save(gradient(W, H, "#6EC0FF", "#E8F6FF", 90).convert("RGB"), "sprites", "backgrounds", "bg_sky.png")
    rng = np.random.default_rng(9)
    for name, col, amp, base in (("bg_hills_far", "#7FB8D8", 40, 120), ("bg_hills_near", "#4FA070", 30, 140), ("bg_trees", "#2F7A4A", 14, 160)):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); n = pnoise(W, 1, 4, rng, 3)[0]
        for x in range(W): d.line([(x, int(base - amp * n[x])), (x, H)], fill=C(col))
        save(im, "sprites", "backgrounds", f"{name}.png")
    c = cloud(); save(c, "sprites", "backgrounds", "bg_cloud.png")

# ---------- UI kit ----------
def ui():
    def panel(w, h, fill, border, r=6, bw=2):
        S = 4; im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, w * S - 1, h * S - 1], r * S, fill=C(border)); d.rounded_rectangle([bw * S, bw * S, (w - bw) * S - 1, (h - bw) * S - 1], max(r - bw, 1) * S, fill=C(fill))
        return im.resize((w, h), Image.LANCZOS)
    for st, (f, b) in {"normal": ("#2468C8", "#14305F"), "hover": ("#3A82E8", "#14305F"), "pressed": ("#1B4F9C", "#0E2243"), "disabled": ("#3A4150", "#232833")}.items():
        save(panel(64, 64, f, b, 12), "ui", f"button_{st}.png")
    save(panel(64, 64, "#1B2A42", "#2A3F5F", 10), "ui", "panel.png"); save(panel(64, 64, "#0E1626", "#2A3F5F", 10, 2), "ui", "panel_dark.png")
    save(panel(64, 64, "#EAF2FF", "#4FA3FF", 10), "ui", "panel_light.png"); save(panel(64, 24, "#0E1626", "#2A3F5F", 8, 2), "ui", "tooltip.png")
    save(panel(128, 16, "#0E1626", "#2A3F5F", 8, 2), "ui", "bar_bg.png")
    for n, col in (("green", "#4ADE80"), ("red", "#F87171"), ("blue", "#4FA3FF"), ("yellow", "#FBBF24")): save(panel(128, 16, col, "#FFFFFF", 8, 1), "ui", f"bar_fill_{n}.png")
    save(panel(24, 24, "#0E1626", "#4FA3FF", 6, 2), "ui", "checkbox_off.png")
    cb = panel(24, 24, "#4FA3FF", "#4FA3FF", 6, 2); d = ImageDraw.Draw(cb); d.line([(6, 12), (10, 17), (18, 7)], fill=(255, 255, 255, 255), width=3); save(cb, "ui", "checkbox_on.png")
    save(panel(128, 8, "#2A3F5F", "#2A3F5F", 4, 1), "ui", "slider_track.png")
    k = Image.new("RGBA", (32, 32), (0, 0, 0, 0)); ImageDraw.Draw(k).ellipse([2, 2, 29, 29], fill=C("#4FA3FF"), outline=C("#FFFFFF"), width=3); save(k, "ui", "slider_knob.png")
    j = Image.new("RGBA", (128, 128), (0, 0, 0, 0)); ImageDraw.Draw(j).ellipse([4, 4, 123, 123], fill=(255, 255, 255, 40), outline=(255, 255, 255, 140), width=3); save(j, "ui", "joystick_base.png")
    j = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); ImageDraw.Draw(j).ellipse([4, 4, 59, 59], fill=(255, 255, 255, 120), outline=(255, 255, 255, 220), width=3); save(j, "ui", "joystick_knob.png")
    for n, (cx, glyph) in {"btn_a": ("#4ADE80", "A"), "btn_b": ("#F87171", "B"), "btn_x": ("#4FA3FF", "X"), "btn_y": ("#FBBF24", "Y")}.items():
        im = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.ellipse([2, 2, 61, 61], fill=C(cx, 170), outline=(255, 255, 255, 230), width=3)
        d.text((32, 32), glyph, font=font("Bold", 30), fill="#FFFFFF", anchor="mm"); save(im, "ui", f"{n}.png")
    for n, pts in {"arrow_left": [(44, 12), (20, 32), (44, 52)], "arrow_right": [(20, 12), (44, 32), (20, 52)], "arrow_up": [(12, 44), (32, 20), (52, 44)], "arrow_down": [(12, 20), (32, 44), (52, 20)]}.items():
        im = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.rounded_rectangle([2, 2, 61, 61], 14, fill=(255, 255, 255, 50), outline=(255, 255, 255, 160), width=3); d.line(pts, fill="#FFFFFF", width=6, joint="curve"); save(im, "ui", f"{n}.png")
    cur = Image.new("RGBA", (24, 24), (0, 0, 0, 0)); ImageDraw.Draw(cur).polygon([(2, 2), (2, 19), (7, 15), (11, 22), (14, 20), (10, 14), (17, 14)], fill="#FFFFFF", outline="#14182A"); save(cur, "ui", "cursor.png")

def run():
    sheet([hero(i) for i in range(8)], "hero", {"idle": {"frames": [0, 1], "fps": 3, "loop": True}, "walk": {"frames": [2, 3, 4, 5], "fps": 10, "loop": True}, "jump": {"frames": [6], "fps": 1, "loop": False}, "hurt": {"frames": [7], "fps": 1, "loop": False}})
    sheet([slime(i) for i in range(4)], "enemy_slime", {"idle": {"frames": [0, 1, 2, 1], "fps": 6, "loop": True}})
    sheet([bat(i) for i in range(4)], "enemy_bat", {"fly": {"frames": [0, 1, 2, 3], "fps": 10, "loop": True}})
    sheet([robot(i) for i in range(4)], "enemy_robot", {"walk": {"frames": [0, 1, 2, 3], "fps": 8, "loop": True}})
    sheet([coin(i) for i in range(6)], "coin", {"spin": {"frames": [0, 1, 2, 3, 4, 5], "fps": 10, "loop": True}})
    sheet([flag(i) for i in range(4)], "flag", {"wave": {"frames": [0, 1, 2, 3], "fps": 6, "loop": True}})
    sheet([torch(i) for i in range(4)], "torch", {"burn": {"frames": [0, 1, 2, 3], "fps": 8, "loop": True}})
    for n, col, dk in (("blue", "#4FA3FF", "#2468C8"), ("green", "#4ADE80", "#1E9A52"), ("red", "#F87171", "#B03030"), ("yellow", "#FBBF24", "#B07A10")): save(gem(col, dk), "sprites", "items", f"gem_{n}.png")
    for k in ("full", "half", "empty"): save(heart(k), "sprites", "items", f"heart_{k}.png")
    for n, im in (("key", key()), ("potion_red", potion("#F0405A")), ("potion_blue", potion("#4FA3FF")), ("star", star()), ("crate", crate()), ("barrel", barrel()), ("chest_closed", chest(False)), ("chest_open", chest(True)), ("spikes", spikes()), ("door", door()), ("bullet", bullet())):
        save(im, "sprites", "items", f"{n}.png")
    for n, im in (("tree", tree()), ("bush", bush()), ("rock", rock()), ("cloud", cloud())): save(im, "sprites", "props", f"{n}.png")
    tileset(); backgrounds(); ui()
    print("sprites ok")
