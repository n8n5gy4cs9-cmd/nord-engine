"""Tileable 512px textures (+ normal maps), skyboxes, particle sprites. All procedural placeholders."""
from common import *

SZ = 512

def tint(h, lo, hi):
    """Map height field h∈[0,1] to colour ramp lo→hi (hex)."""
    lo, hi = np.array(hexrgb(lo), float), np.array(hexrgb(hi), float)
    return lo + (hi - lo) * h[..., None]

def normal_map(h, strength=3.0):
    gx = np.roll(h, -1, 1) - np.roll(h, 1, 1); gy = np.roll(h, -1, 0) - np.roll(h, 1, 0)
    n = np.dstack([-gx * strength, -gy * strength, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return to_img((n * .5 + .5) * 255)

def fbm(rng, cells=4, oct=5, size=SZ): return pnoise(size, size, cells, rng, oct)

def brick(rng):
    h = np.zeros((SZ, SZ)); col = np.zeros((SZ, SZ, 3))
    bh, bw, m = 64, 128, 6
    base = fbm(rng, 8, 3)
    for r in range(SZ // bh):
        off = (bw // 2) * (r % 2)
        for c in range(-1, SZ // bw + 1):
            x0 = c * bw + off; shade = rng.uniform(.75, 1.15)
            ys = slice(r * bh + m // 2, (r + 1) * bh - m // 2)
            for x in range(x0 + m // 2, x0 + bw - m // 2):
                col[ys, x % SZ] = np.array([170, 72, 52]) * shade
                h[ys, x % SZ] = 1
    col *= (.8 + .4 * base[..., None])
    mortar = (h == 0); col[mortar] = np.array([150, 145, 135]) * (.8 + .3 * base[mortar][:, None])
    return to_img(col), h * .8 + base * .2

def planks(rng):
    h = np.zeros((SZ, SZ)); col = np.zeros((SZ, SZ, 3)); n = 6; ph = SZ // n
    grain = pnoise(SZ, SZ, 2, rng, 1)
    for i in range(n):
        s = rng.uniform(.8, 1.15); y0 = i * ph
        stream = pnoise(SZ, ph, 3, rng, 4)
        g = np.sin((np.arange(SZ)[None, :] * 0.02 + stream * 14)) * .5 + .5
        col[y0:y0 + ph] = tint(g * .6 + stream * .4, "#6B4423", "#A9743D") * s
        col[y0:y0 + 3] *= .55; h[y0:y0 + ph] = .6 + g * .2; h[y0:y0 + 3] = 0
    return to_img(col), h

def stone(rng):
    # voronoi-ish cobbles
    pts = rng.random((48, 2)) * SZ; yy, xx = np.mgrid[0:SZ, 0:SZ]
    best = np.full((SZ, SZ), 1e9); second = best.copy(); idx = np.zeros((SZ, SZ), int)
    for i, (px, py) in enumerate(pts):
        for ox in (-SZ, 0, SZ):
            for oy in (-SZ, 0, SZ):
                d = np.hypot(xx - px - ox, yy - py - oy)
                m = d < best; second = np.where(m, best, np.minimum(second, d)); idx = np.where(m, i, idx); best = np.minimum(best, d)
    edge = np.clip((second - best) / 14, 0, 1); shade = rng.random(48)[idx] * .4 + .6
    n = fbm(rng, 16, 3)
    h = edge * (.6 + .2 * n); col = tint(shade * .7 + n * .3, "#55595F", "#9AA0A8") * (.4 + .6 * edge[..., None])
    return to_img(col), h

def metal(rng):
    n = pnoise(SZ, SZ, 2, rng, 1); stripes = np.tile(rng.random((SZ, 1)), (1, SZ)) * .5 + pnoise(SZ, SZ, 64, rng, 1) * .0
    base = .55 + .15 * stripes + .1 * n
    col = tint(np.clip(base, 0, 1), "#6C7480", "#B7C0CC")
    h = np.zeros((SZ, SZ))
    for k in (0, SZ // 2):  # panel seams + rivets
        col[k:k + 3] *= .5; col[:, k:k + 3] *= .5; h[k:k + 3] -= .4; h[:, k:k + 3] -= .4
    for cx in range(32, SZ, 224):
        for cy in range(32, SZ, 224):
            yy, xx = np.ogrid[:SZ, :SZ]; m = (xx - cx) ** 2 + (yy - cy) ** 2 < 100; col[m] *= 1.2; h[m] += .5
    return to_img(col), np.clip(h + .5, 0, 1)

def make(name, img, h=None):
    save(img, "textures", f"{name}.png")
    if h is not None: save(normal_map(h), "textures", f"{name}_n.png")

def skybox(name, top, horizon, ground, sun=None, stars=False, clouds=True, rng=None):
    S = 512; faces = {}
    for f in ("px", "nx", "py", "ny", "pz", "nz"):
        u, v = np.meshgrid(np.linspace(-1, 1, S), np.linspace(1, -1, S))
        o = np.ones_like(u)
        d = {"px": (o, v, -u), "nx": (-o, v, u), "py": (u, o, -v), "ny": (u, -o, v), "pz": (u, v, o), "nz": (-u, v, -o)}[f]
        d = np.dstack(d); d /= np.linalg.norm(d, axis=2, keepdims=True); y = d[..., 1]
        t = np.clip(y, 0, 1) ** .6
        sky = np.array(hexrgb(horizon)) * (1 - t[..., None]) + np.array(hexrgb(top)) * t[..., None]
        gr = np.clip(-y * 3, 0, 1)[..., None]; sky = sky * (1 - gr) + np.array(hexrgb(ground)) * gr
        if clouds:
            sx = d[..., 0] / (np.abs(y) + .35) * 2; sz = d[..., 2] / (np.abs(y) + .35) * 2
            n = _vnoise(sx, sz, rng)  # blobs
            c = np.clip((n - .55) * 3, 0, 1) * np.clip(y * 3, 0, 1)
            sky = sky * (1 - c[..., None] * .8) + 255 * c[..., None] * .8
        if sun:
            sd = np.array(sun[0]); sd = sd / np.linalg.norm(sd); dot = np.clip((d * sd).sum(2), 0, 1)
            sky += np.array(hexrgb(sun[1])) * (dot ** 400)[..., None] * 2.0 + np.array(hexrgb(sun[1])) * (dot ** 12)[..., None] * .25
        if stars:
            r2 = np.random.default_rng(hash(f) % 1000); s = r2.random((S, S)) > .9985
            sky = np.where(s[..., None], 255, sky) * (np.clip(y + .3, 0, 1)[..., None] * .6 + .4) if False else np.where(s[..., None] & (y[..., None] > -.1), 235, sky)
        faces[f] = to_img(sky)
    for f, im in faces.items(): save(im, "skybox", name, f"{f}.png")

def _vnoise(x, z, rng):
    out_ = np.zeros_like(x); amp = 1.0; norm = 0
    lat = rng.random((64, 64))
    for o in range(4):
        f = 2 ** o; xi = np.floor(x * f).astype(int); zi = np.floor(z * f).astype(int); fx = x * f - xi; fz = z * f - zi
        fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz)
        g = lambda a, b: lat[(a + 31 * o) % 64, (b + 17 * o) % 64]
        out_ += amp * (g(xi, zi) * (1 - fx) * (1 - fz) + g(xi + 1, zi) * fx * (1 - fz) + g(xi, zi + 1) * (1 - fx) * fz + g(xi + 1, zi + 1) * fx * fz)
        norm += amp; amp *= .5
    return out_ / norm

def particles():
    S = 128; yy, xx = np.mgrid[0:S, 0:S]; c = (S - 1) / 2; r = np.hypot(xx - c, yy - c) / c
    def white(a): 
        im = np.dstack([np.full((S, S), 255)] * 3 + [np.clip(a, 0, 1) * 255]); return Image.fromarray(im.astype(np.uint8), "RGBA")
    save(white(np.clip(1 - r, 0, 1) ** 2), "particles", "soft.png")
    save(white((r < .95).astype(float) * np.clip((.95 - r) * 20, 0, 1)), "particles", "circle.png")
    save(white(np.exp(-((r - .75) ** 2) / .008)), "particles", "ring.png")
    save(white(np.clip(1 - r, 0, 1) ** 4 + np.exp(-(np.abs(xx - c) / 3) ** 2) * np.clip(1 - r, 0, 1) + np.exp(-(np.abs(yy - c) / 3) ** 2) * np.clip(1 - r, 0, 1)), "particles", "spark.png")
    a = np.clip(1 - np.maximum(np.abs(xx - c), np.abs(yy - c)) / c * 1.05, 0, 1) > 0; save(white(a.astype(float)), "particles", "square.png")
    rng = np.random.default_rng(3); n = pnoise(S, S, 4, rng, 4); save(white(np.clip(1 - r, 0, 1) * n * 2.2), "particles", "smoke.png")
    fl = np.clip(1 - np.hypot((xx - c) / .7, (yy - c * 1.1 + (c - yy) * .2)) / c, 0, 1) ** 1.5; save(white(fl), "particles", "flame.png")
    star = Image.new("L", (S * 4, S * 4), 0); import math
    pts = [((S * 2) + math.cos(math.pi / 2 + i * math.pi / 5) * (S * 1.9 if i % 2 == 0 else S * .8), (S * 2) - math.sin(math.pi / 2 + i * math.pi / 5) * (S * 1.9 if i % 2 == 0 else S * .8)) for i in range(10)]
    ImageDraw.Draw(star).polygon(pts, fill=255); star = star.resize((S, S), Image.LANCZOS)
    save(Image.merge("RGBA", [Image.new("L", (S, S), 255)] * 3 + [star]), "particles", "star.png")
    save(white(np.exp(-((xx - c) / 6.0) ** 2) * np.clip(1 - np.abs(yy - c) / c, 0, 1)), "particles", "streak.png")

def run():
    rng = np.random.default_rng(42)
    n = lambda cells=4, o=5: fbm(rng, cells, o)
    h = n(6, 5); g = n(32, 2)
    col = tint(h, "#2F6B2A", "#6FB34A") * (.85 + .3 * g[..., None]); make("grass", to_img(col), h * .5 + g * .5)
    h = n(8, 5); make("dirt", to_img(tint(h, "#5A3A22", "#8B5E3C")), h)
    h = n(10, 4); make("sand", to_img(tint(h, "#D9C48A", "#F0E0A8")), h * .4)
    h = n(6, 5); make("snow", to_img(tint(h, "#DCE8F5", "#FFFFFF")), h * .3)
    im, hh = stone(rng); make("stone", im, hh)
    im, hh = brick(rng); make("brick", im, hh)
    im, hh = planks(rng); make("wood", im, hh)
    im, hh = metal(rng); make("metal", im, hh)
    h = n(4, 6); make("concrete", to_img(tint(h, "#7B7F85", "#A8ACB2")), h)
    h = n(6, 4); make("water", to_img(tint(np.abs(np.sin(h * 14)), "#1F5FA8", "#59A8E8")), np.abs(np.sin(h * 14)))
    h = n(5, 5); lava = np.clip(np.abs(h - .5) * 4, 0, 1); make("lava", to_img(tint(1 - lava, "#2A0A05", "#FFB030") * (.5 + .7 * (1 - lava[..., None]))), lava)
    h = n(8, 5); make("leaves", to_img(tint(h, "#1E5A2A", "#5FAE46")), h)
    make("noise", to_img(np.dstack([n(8, 6) * 255] * 3)))
    yy, xx = np.mgrid[0:SZ, 0:SZ]; chk = (((xx // 64) + (yy // 64)) % 2).astype(float)
    make("checker", to_img(tint(chk, "#3A3F47", "#C9CED6")))
    grid = np.zeros((SZ, SZ, 3)) + np.array([40, 50, 70]); grid[::64] = (90, 140, 220); grid[:, ::64] = (90, 140, 220)
    grid[::256] = (255, 255, 255); grid[:, ::256] = (255, 255, 255); make("grid_dev", to_img(grid))
    uv = np.dstack([xx / SZ * 255, yy / SZ * 255, np.full((SZ, SZ), 128)]); uv[::64] *= .6; uv[:, ::64] *= .6; make("uv_test", to_img(uv))
    skybox("day", "#2F79D6", "#CFE6FF", "#8FA3B5", sun=((.4, .6, .5), "#FFF2C0"), rng=rng)
    skybox("sunset", "#2B2F6B", "#FF9A5A", "#40303A", sun=((.8, .12, .3), "#FFC080"), rng=rng)
    skybox("night", "#05070F", "#142447", "#05070C", stars=True, clouds=False, rng=rng)
    particles()
    print("textures ok")
