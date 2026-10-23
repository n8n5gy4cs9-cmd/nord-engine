#!/usr/bin/env python3
"""Generate examples/neon-harbor — the T48 showcase project (3D harbour + 2D HUD) — and docs/tutorial-downloads/neon-harbor-source.zip.

Everything is deterministic (seeded) and written as plain, hand-editable project files. Run from the repo root:
    python3 tools/make-neon-harbor.py
"""
import json, math, os, random, shutil, zipfile, pathlib
from PIL import Image, ImageDraw

R = pathlib.Path(__file__).resolve().parent.parent
P = R / "examples" / "neon-harbor"
ENGINE_ASSETS = R / "assets"

if P.exists():
    shutil.rmtree(P)
for d in ["scenes", "scripts", "prefabs", "ui", "graphs", "events", "assets/materials", "assets/textures", "assets/ui", "assets/audio/sfx", "assets/audio/music", "assets/models"]:
    (P / d).mkdir(parents=True, exist_ok=True)


def wjson(rel, obj):
    (P / rel).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def wtext(rel, text):
    (P / rel).write_text(text)


# ------------------------------------------------------------------ ids / entity helpers
_n = [0]


def eid(prefix="nh"):
    _n[0] += 1
    return f"{prefix}{_n[0]:06x}"[:8]


def ent(name, pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), comps=None, scripts=None, children=None, tags=None, **extra):
    e = {"id": eid(), "name": name, "enabled": True, "tags": tags or [], "layer": 0,
         "transform": {"pos": list(pos), "rot": list(rot), "scale": list(scale)},
         "components": comps or [], "scripts": scripts or [], "children": children or [], "prefab": None}
    e.update(extra)
    return e


def mesh(shape, size, **kw):
    return {"type": "mesh", "shape": shape, "size": list(size), **kw}


def mat(asset, **kw):
    return {"type": "material", "asset": f"assets/materials/{asset}.mat.json", **kw}


def script(path, **attrs):
    return {"path": f"scripts/{path}.js", "attributes": attrs}


def light(kind, color, intensity, **kw):
    return {"type": "light", "kind": kind, "color": color, "intensity": intensity, **kw}


def instance(name, prefab, pos, rot=(0, 0, 0), overrides=None, tags=None):
    e = ent(name, pos, rot, tags=tags)
    e["prefab"] = {"path": f"prefabs/{prefab}.prefab.json", "overrides": overrides or {}}
    return e


# ------------------------------------------------------------------ assets: copied from the engine
def cp(src, dst):
    (P / dst).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(src, P / dst)


shutil.copytree(ENGINE_ASSETS / "skybox" / "night", P / "assets/skybox/night")
for n in ["coin", "bell", "confirm", "click", "hover", "alarm", "heal", "hit", "checkpoint", "back"]:
    cp(ENGINE_ASSETS / "audio/sfx" / f"{n}.wav", f"assets/audio/sfx/{n}.wav")
for n in ["music_action", "jingle_victory", "jingle_game_over"]:
    cp(ENGINE_ASSETS / "audio/music" / f"{n}.mp3", f"assets/audio/music/{n}.mp3")
kenney = ENGINE_ASSETS / "packs/kenney-platformer-3d/models"
cp(kenney / "character.glb", "assets/models/character.glb")
if (kenney / "Textures").exists():
    shutil.copytree(kenney / "Textures", P / "assets/models/Textures")
cp(R / "examples/platformer3d/index.html", "index.html")
html = (P / "index.html").read_text().replace("3D Platformer", "Neon Harbor")
(P / "index.html").write_text(html)

# ------------------------------------------------------------------ generated pictures (PIL)
rng = random.Random(48)


def make_grid(path, size=256, bg=(7, 14, 34), line=(0, 190, 255)):
    im = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(im)
    for i in range(0, size, 32):
        d.line([(i, 0), (i, size)], fill=line, width=1)
        d.line([(0, i), (size, i)], fill=line, width=1)
    d.line([(0, 0), (size, 0)], fill=line, width=2)
    d.line([(0, 0), (0, size)], fill=line, width=2)
    im.save(P / path)


def make_windows(path, w=128, h=256):
    im = Image.new("RGB", (w, h), (14, 16, 30))
    d = ImageDraw.Draw(im)
    pal = [(255, 214, 120), (255, 80, 200), (60, 220, 255), (255, 214, 120)]
    for y in range(8, h - 8, 16):
        for x in range(8, w - 8, 16):
            if rng.random() < 0.55:
                c = pal[rng.randrange(len(pal))]
                d.rectangle([x, y, x + 8, y + 9], fill=c)
            else:
                d.rectangle([x, y, x + 8, y + 9], fill=(24, 28, 52))
    im.save(P / path)


def slice9(path, border, fill, glow, size=48, radius=8):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([1, 1, size - 2, size - 2], radius=radius, fill=fill, outline=glow, width=1)
    d.rounded_rectangle([3, 3, size - 4, size - 4], radius=radius - 2, outline=border, width=2)
    im.save(P / path)


make_grid("assets/textures/grid.png")
make_windows("assets/textures/windows.png")
slice9("assets/ui/button.png", (0, 200, 255, 255), (12, 24, 52, 235), (0, 90, 140, 255))
slice9("assets/ui/button-hover.png", (120, 255, 255, 255), (20, 52, 96, 240), (0, 160, 220, 255))
slice9("assets/ui/button-pressed.png", (255, 80, 200, 255), (60, 16, 70, 245), (180, 30, 140, 255))
slice9("assets/ui/button-disabled.png", (70, 80, 100, 255), (16, 20, 30, 200), (40, 46, 60, 255))
slice9("assets/ui/chip.png", (255, 255, 255, 255), (255, 255, 255, 60), (255, 255, 255, 120), radius=10)  # white: tinted by the skin
slice9("assets/ui/frame.png", (0, 200, 255, 255), (6, 12, 30, 215), (0, 80, 120, 255), radius=10)
mk = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
ImageDraw.Draw(mk).polygon([(8, 1), (14, 14), (8, 11), (2, 14)], fill=(255, 255, 255, 255))
mk.save(P / "assets/ui/marker.png")

# import settings next to the pictures (sidecar .meta.json, see Inspector > Texture import)
wjson("assets/textures/windows.png.meta.json", {"wrap": "repeat"})
wjson("assets/ui/marker.png.meta.json", {"filter": "nearest", "pivot": "center", "ppu": 1})
wjson("assets/textures/grid.png.meta.json", {"wrap": "repeat", "filter": "linear", "maxSize": 512})
wjson("assets/models/character.glb.meta.json", {"scale": 1.4, "materials": {"colormap": "assets/materials/worker.mat.json"}})

# ------------------------------------------------------------------ material assets (*.mat.json)
MATS = {
    "water": {"color": "#06122c", "metallic": 0.5, "roughness": 0.2, "texture": "assets/textures/grid.png", "uvScale": [40, 40], "emissiveMap": "assets/textures/grid.png", "emissive": "#2a6a9a", "alpha": 1},
    "concrete": {"color": "#2b3350", "metallic": 0.1, "roughness": 0.8},
    "tower": {"color": "#3a4268", "metallic": 0.2, "roughness": 0.55, "texture": "assets/textures/windows.png", "uvScale": [2, 4], "emissiveMap": "assets/textures/windows.png", "emissive": "#ffffff"},
    "neon-pink": {"color": "#ff3fb8", "metallic": 0, "roughness": 0.3, "emissive": "#ff1fa5"},
    "neon-cyan": {"color": "#25e8ff", "metallic": 0, "roughness": 0.25, "emissive": "#00d0ff"},
    "hull": {"color": "#e8ecff", "metallic": 0.5, "roughness": 0.3},
    "glass": {"color": "#38d6ff", "metallic": 0.9, "roughness": 0.05, "emissive": "#0a5a7a", "alpha": 0.85},
    "pier": {"color": "#3a3144", "metallic": 0.05, "roughness": 0.9},
    "worker": {"color": "#ffd166", "metallic": 0.1, "roughness": 0.5, "emissive": "#3d2a08"},
}
for k, v in MATS.items():
    wjson(f"assets/materials/{k}.mat.json", v)

# ------------------------------------------------------------------ prefabs
TOWER_SIZE = [6, 18, 6]


def tower_root():
    return ent("Tower", (0, 9, 0), comps=[mesh("box", TOWER_SIZE), mat("tower")], tags=["solid"], children=[
        ent("Roof light", (0, 9.4, 0), comps=[mesh("box", [1.2, 0.8, 1.2]), mat("neon-pink"), light("point", "#ff3fb8", 1.4, range=16)]),
    ])


def write_prefab(name, root, **extra):
    wjson(f"prefabs/{name}.prefab.json", {"format": 1, **extra, "root": root})


write_prefab("tower", tower_root())
tall_root = tower_root()
tall_root["components"][0]["size"] = [5, 28, 5]
tall_root["transform"]["pos"][1] = 14
tall_root["children"][0]["transform"]["pos"][1] = 14.4
tall_root["children"][0]["components"][2]["color"] = "#25e8ff"
write_prefab("tower-tall", tall_root, variantOf="prefabs/tower.prefab.json",
             overrides={"components": {"0": {"size": [5, 28, 5]}}, "children": {"0": {"transform": {"pos": [0, 14.4, 0]}, "components": {"2": {"color": "#25e8ff"}}}}})
write_prefab("lamp", ent("Lamp", (0, 0, 0), comps=[], children=[
    ent("Pole", (0, 2.2, 0), comps=[mesh("cylinder", [0.22, 4.4, 0.22]), mat("pier")]),
    ent("Bulb", (0, 4.5, 0), comps=[mesh("sphere", [0.55, 0.55, 0.55]), mat("neon-pink"), light("point", "#ff4fd8", 1.1, range=13, flicker=0.15)]),
]))
write_prefab("orb", ent("Orb", (0, 1.1, 0), comps=[mesh("sphere", [0.9, 0.9, 0.9]), mat("neon-cyan"), light("point", "#25e8ff", 1.0, range=9)],
                        tags=["orb"], scripts=[script("spin", speed=70, axis="y"), script("bob", amplitude=0.25, speed=2), script("orb", value=10, radius=1.8)]))
block_children = [
    ent("Pier", (0, 0.5, 0), comps=[mesh("box", [22, 1, 16]), mat("pier")]),
    ent("Tower A", (-6, 10, 0), comps=[mesh("box", [6, 18, 6]), mat("tower")], tags=["solid"]),
    ent("Tower B", (6, 7, 2), comps=[mesh("box", [5, 12, 5]), mat("tower")], tags=["solid"]),
]
lamp_in_block = ent("Lamp", (0, 1, 7))
lamp_in_block["prefab"] = {"path": "prefabs/lamp.prefab.json", "overrides": {}}
block_children.append(lamp_in_block)
write_prefab("block", ent("Block", (0, 0, 0), children=block_children))

# ------------------------------------------------------------------ scenes
random.seed(4801)
SOLID = []  # (x, z, radius) of things orbs must avoid


def free_spot(rmin, rmax, avoid, margin):
    for _ in range(400):
        a = random.uniform(0, 2 * math.pi)
        r = random.uniform(rmin, rmax)
        x, z = math.cos(a) * r, math.sin(a) * r
        if all(math.hypot(x - ax, z - az) > ar + margin for ax, az, ar in avoid):
            return round(x, 1), round(z, 1)
    raise RuntimeError("no free spot")


def environment(with_water_lock=True):
    return ent("Environment", children=[
        ent("Moon", (0, 30, 0), (48, -35, 0), comps=[light("directional", "#7f98ff", 0.4)]),
        ent("Ambient", comps=[light("hemispheric", "#3a4688", 0.3)]),
        ent("Sky", comps=[{"type": "skybox", "path": "assets/skybox/night"}]),
        ent("Water", (0, 0, 0), comps=[mesh("ground", [260, 0.2, 260]), mat("water")], locked=with_water_lock),
    ])


def camera_entity(pos, rot, scripts):
    return ent("Camera", pos, rot, comps=[{"type": "camera", "fov": 62},
                                         {"type": "postProcess", "fxaa": True, "bloom": True, "bloomThreshold": 0.55, "bloomWeight": 0.55, "vignette": 0.35, "tonemap": True, "exposure": 1.1}],
               scripts=scripts)


# --- harbour scene
BLOCKS = [(-34, -30), (34, -32), (-40, 22), (42, 26)]
for bx, bz in BLOCKS:
    SOLID.append((bx, bz, 15))
TOWERS = [(0, 52), (-16, 48), (22, 46)]
TALL = [(-52, -4), (54, -4)]
for tx, tz in TOWERS + TALL:
    SOLID.append((tx, tz, 6))

districts = []
for i, (bx, bz) in enumerate(BLOCKS):
    ov = {}
    if i == 2:  # a child override: Tower B of this block glows cyan (see tutorial step on prefab children)
        ov = {"children": {"2": {"components": {"1": {"asset": "assets/materials/neon-cyan.mat.json"}}}}}
    districts.append(instance(f"Block {i + 1}", "block", (bx, 0, bz), overrides=ov))
for i, (tx, tz) in enumerate(TOWERS):
    districts.append(instance(f"Tower {i + 1}", "tower", (tx, 9, tz)))
for i, (tx, tz) in enumerate(TALL):
    districts.append(instance(f"Tall tower {i + 1}", "tower-tall", (tx, 14, tz)))

lamps = []
for i in range(8):
    x = -28 + i * 8
    lamp = instance(f"Lamp {i + 1}", "lamp", (x, 0, -58))
    lamps.append(lamp)
# a disabled component, kept for later: stored as an override on the instance (instance-level components are not read)
lamps[3]["prefab"]["overrides"] = {"components": {"0": light("spot", "#ffffff", 0.8, range=18) | {"componentEnabled": False}}}

orbs = []
orb_spots = []
for i in range(14):
    x, z = free_spot(10, 48, SOLID + [(0, 0, 8)] + [(ox, oz, 6) for ox, oz in orb_spots], 3)
    orb_spots.append((x, z))
    orbs.append(instance(f"Orb {i + 1}", "orb", (x, 1.1, z), tags=["orb"]))

workers = []
for i, x in enumerate([-12, -4, 6]):
    workers.append(ent(f"Dockworker {i + 1}", (x, 1, -58 + 3), (0, 160 + i * 25, 0), comps=[{"type": "model", "path": "assets/models/character.glb", "animation": "idle"}]))

skiff = ent("Skiff", (0, 0.35, 0), tags=["player"], scripts=[script("skiff", maxSpeed=14, boostSpeed=26, accel=16, turnRate=92, bounds=70)], children=[
    ent("Hull", (0, 0, 0), comps=[mesh("box", [1.5, 0.5, 3.2]), mat("hull")]),
    ent("Bow", (0, 0.05, 1.8), (0, 0, 0), comps=[mesh("box", [0.9, 0.35, 0.9]), mat("neon-cyan")]),
    ent("Cabin", (0, 0.5, -0.3), comps=[mesh("box", [1.0, 0.5, 1.2]), mat("glass")]),
    ent("Glow", (0, 1.4, 0), comps=[light("point", "#25e8ff", 1.2, range=11)]),
])
debug = ent("Debug markers", hidden=True, children=[
    ent("Start marker", (0, 3, 0), comps=[mesh("sphere", [0.6, 0.6, 0.6]), mat("neon-pink")]),
    ent("Bounds marker", (70, 3, 70), comps=[mesh("sphere", [0.6, 0.6, 0.6]), mat("neon-pink")]),
])
director = ent("Director", scripts=[script("game-manager", startLives=1), script("harbor", timeLimit=100, orbsToWin=14)])

harbor = {
    "format": 1, "name": "harbor",
    "settings": {"eventSheet": "events/rules.events.json", "graphs": ["graphs/toasts.graph.json"]},
    "entities": [
        camera_entity((0, 7, -14), (22, 0, 0), [script("chase-cam", target="Skiff", offset=[0, 7, -13], smoothing=4)]),
        environment(),
        skiff,
        ent("Districts", children=districts),
        ent("Lamps", children=lamps),
        ent("Data cores", children=orbs),
        ent("Workers", children=workers),
        debug,
        director,
    ],
}
wjson("scenes/harbor.scene.json", harbor)

# --- menu scene (title screen with a slow fly-over)
menu = {
    "format": 1, "name": "menu", "settings": {},
    "entities": [
        camera_entity((0, 14, -60), (14, 0, 0), [script("orbit-cam", radius=70, height=18, speed=6)]),
        environment(),
        ent("Districts", children=[instance(f"Block {i + 1}", "block", (bx, 0, bz)) for i, (bx, bz) in enumerate(BLOCKS)]
            + [instance(f"Tall tower {i + 1}", "tower-tall", (tx, 14, tz)) for i, (tx, tz) in enumerate(TALL)]),
        ent("Director", scripts=[script("menu")]),
    ],
}
wjson("scenes/menu.scene.json", menu)

# ------------------------------------------------------------------ UI scenes
SKIN = "ui/neon.skin.json"
wjson("ui/neon.skin.json", {
    "tokens": {"accent": "#25e8ff", "hot": "#ff3fb8", "fg": "#e6f6ff", "panel": "#06101f"},
    "styles": {
        "label": {"color": "$fg", "textShadow": "0 0 8px #00b8ff"},
        ".title": {"color": "$accent", "textShadow": "0 0 18px #00d0ff, 0 0 4px #ffffff"},
        ".hot": {"color": "$hot", "textShadow": "0 0 14px #ff3fb8"},
        ".chip": {"image": {"src": "assets/ui/chip.png", "slice": [10, 10, 10, 10], "scale": 1, "tint": "#25e8ff"}, "padding": [6, 14, 6, 14], "color": "$fg"},
        ".card": {"image": {"src": "assets/ui/frame.png", "slice": [10, 10, 10, 10], "scale": 1}, "padding": 22, "color": "$fg"},
        "bar": {"background": "#0a1a30", "border": "1px solid #1d6a8a", "borderRadius": 6, "height": 14},
    },
})

# banner = a UI prefab used by the HUD and the end screen
wjson("ui/banner.ui.json", {"version": 1, "name": "banner", "skin": SKIN, "theme": {}, "root": {
    "type": "hbox", "name": "root", "class": "chip", "style": {"justifyContent": "center"}, "children": [
        {"type": "label", "name": "toast", "text": "", "size": 26, "bold": True, "class": "hot"}]}})

BTN = {"normal": "assets/ui/button.png", "hover": "assets/ui/button-hover.png", "pressed": "assets/ui/button-pressed.png",
       "disabled": "assets/ui/button-disabled.png", "slice": [14, 14, 14, 14], "scale": 1}


def button(name, text, action, **kw):
    return {"type": "button", "name": name, "text": text, "size": 22, "on": {"pressed": action}, "sprites": dict(BTN),
            "style": {"minWidth": 220, "minHeight": 54, "color": "#e6f6ff"}, **kw}


wjson("ui/hud.ui.json", {"version": 1, "name": "hud", "skin": SKIN, "theme": {},
    "scaler": {"mode": "scale", "ref": [1280, 720], "match": 0.5},
    "root": {"type": "panel", "name": "root", "anchor": "fill", "style": {"background": "none", "border": "none", "boxShadow": "none", "padding": 0}, "children": [
        {"type": "hbox", "name": "stats", "anchor": "tl", "x": 18, "y": 14, "gap": 10, "children": [
            {"type": "label", "name": "score", "text": "SCORE {score}", "class": "chip", "size": 22, "bold": True},
            {"type": "label", "name": "orbs", "text": "CORES {orbs}", "class": "chip", "size": 22, "bold": True},
            {"type": "label", "name": "time", "text": "TIME {time}", "class": "chip", "size": 22, "bold": True}]},
        {"type": "vbox", "name": "energyBox", "anchor": "bl", "x": 18, "y": -18, "gap": 4, "w": 320, "children": [
            {"type": "label", "name": "energyLabel", "text": "BOOST ENERGY", "size": 14},
            {"type": "bar", "name": "energy", "value": 1, "color": "#25e8ff", "bind": {"value": "energy"}}]},
        {"type": "panel", "name": "mapFrame", "anchor": "tr", "x": -18, "y": 14, "w": 196, "h": 196, "class": "card", "style": {"padding": 10}, "children": [
            {"type": "canvas", "name": "minimap", "w": 168, "h": 168}]},
        {"type": "instance", "name": "banner", "ref": "ui/banner.ui.json", "anchor": "t", "y": 84},
        {"type": "label", "name": "hint", "text": "W/S throttle · A/D steer · SHIFT boost · P pause", "anchor": "b", "y": -16, "size": 14}]}})

wjson("ui/pause.ui.json", {"version": 1, "name": "pause", "skin": SKIN, "theme": {}, "visible": False,
    "scaler": {"mode": "scale", "ref": [1280, 720], "match": 0.5},
    "root": {"type": "panel", "name": "root", "anchor": "fill", "style": {"background": "#02060fb0", "border": "none", "boxShadow": "none", "padding": 0}, "children": [
        {"type": "vbox", "name": "card", "anchor": "c", "class": "card", "gap": 14, "style": {"alignItems": "center"}, "children": [
            {"type": "label", "name": "t", "text": "PAUSED", "size": 44, "class": "title"},
            button("resume", "Resume", "resume"), button("menu", "Main menu", "menu")]}]}})

wjson("ui/gameover.ui.json", {"version": 1, "name": "gameover", "skin": SKIN, "theme": {}, "visible": False,
    "scaler": {"mode": "scale", "ref": [1280, 720], "match": 0.5},
    "root": {"type": "panel", "name": "root", "anchor": "fill", "style": {"background": "#02060fc0", "border": "none", "boxShadow": "none", "padding": 0}, "children": [
        {"type": "vbox", "name": "card", "anchor": "c", "class": "card", "gap": 12, "style": {"alignItems": "center", "minWidth": 380}, "children": [
            {"type": "label", "name": "result", "text": "{result}", "size": 46, "class": "title"},
            {"type": "label", "name": "final", "text": "Score {score} · Best {best}", "size": 24},
            {"type": "label", "name": "detail", "text": "{detail}", "size": 16},
            button("retry", "Fly again", "retry"), button("menu", "Main menu", "menu")]}]}})

wjson("ui/menu.ui.json", {"version": 1, "name": "menu", "skin": SKIN, "theme": {},
    "scaler": {"mode": "scale", "ref": [1280, 720], "match": 0.5},
    "root": {"type": "panel", "name": "root", "anchor": "fill", "style": {"background": "#02060f70", "border": "none", "boxShadow": "none", "padding": 0}, "children": [
        {"type": "vbox", "name": "box", "anchor": "c", "gap": 14, "style": {"alignItems": "center"}, "children": [
            {"type": "label", "name": "title", "text": "NEON HARBOR", "size": 84, "bold": True, "class": "title"},
            {"type": "label", "name": "sub", "text": "Collect all 14 data cores before the night ends.", "size": 20},
            {"type": "spacer", "h": 18},
            button("play", "Start the run", "play"),
            {"type": "label", "name": "best", "text": "Best score {best}", "size": 18, "class": "hot"}]},
        {"type": "label", "name": "credit", "text": "A Nord Engine showcase · models CC0 by Kenney", "anchor": "br", "x": -16, "y": -12, "size": 13, "wrap": False}]}})

# ------------------------------------------------------------------ node graphs
_gid = [0]


def gnode(graph, ntype, x, y, props=None, ins=None, outs=None):
    _gid[0] += 1
    nid = _gid[0]
    graph["nodes"].append({"id": nid, "type": ntype, "pos": [x, y], "size": [230, 80], "flags": {}, "order": nid, "mode": 0,
                           "inputs": [{"name": n, "type": t, "link": None} for n, t in (ins or [])],
                           "outputs": [{"name": n, "type": t, "links": None} for n, t in (outs or [])],
                           "properties": props or {}})
    return nid


def glink(graph, a, aslot, b, bslot):
    lid = graph["last_link_id"] + 1
    graph["last_link_id"] = lid
    na = next(n for n in graph["nodes"] if n["id"] == a)
    nb = next(n for n in graph["nodes"] if n["id"] == b)
    t = na["outputs"][aslot]["type"]
    na["outputs"][aslot]["links"] = (na["outputs"][aslot]["links"] or []) + [lid]
    nb["inputs"][bslot]["link"] = lid
    graph["links"].append([lid, a, aslot, b, bslot, t])
    graph["last_node_id"] = max(graph["last_node_id"], a, b)


def new_graph():
    return {"last_node_id": 0, "last_link_id": 0, "nodes": [], "links": [], "groups": [], "config": {}, "extra": {}, "version": 0.4,
            "nord": {"version": 1, "vars": {}}}


EX = ("exec", "exec")
THEN = ("then", "exec")

# subgraph: toast(a = text) — show a banner for a moment, then clear it
sub = new_graph()
s0 = gnode(sub, "event/start", 40, 40, outs=[THEN])
s1 = gnode(sub, "ui/set-text", 300, 40, {"screen": "hud", "node": "toast", "text": ""}, [EX, ("screen", "string"), ("node", "string"), ("text", "any")], [THEN])
sv = gnode(sub, "var/get", 40, 200, {"name": "a"}, [], [("value", "any")])
s2 = gnode(sub, "flow/delay", 560, 40, {"seconds": 1.4}, [EX, ("seconds", "number")], [THEN])
s3 = gnode(sub, "ui/set-text", 820, 40, {"screen": "hud", "node": "toast", "text": ""}, [EX, ("screen", "string"), ("node", "string"), ("text", "any")], [THEN])
glink(sub, s0, 0, s1, 0); glink(sub, sv, 0, s1, 3); glink(sub, s1, 0, s2, 0); glink(sub, s2, 0, s3, 0)
wjson("graphs/toast.graph.json", sub)

g = new_graph()
e1 = gnode(g, "event/game", 40, 40, {"name": "orb"}, [], [THEN, ("data", "any")])
c1 = gnode(g, "flow/call-graph", 340, 40, {"file": "graphs/toast.graph.json", "a": "DATA CORE +10"}, [EX, ("file", "string"), ("a", "any"), ("b", "any")], [THEN, ("a", "any"), ("b", "any")])
glink(g, e1, 0, c1, 0)
e2 = gnode(g, "event/game", 40, 260, {"name": "overdrive"}, [], [THEN, ("data", "any")])
a2 = gnode(g, "audio/play", 340, 260, {"clip": "assets/audio/sfx/bell.wav", "volume": 0.9, "bus": "sfx"}, [EX, ("clip", "string"), ("volume", "number")], [THEN])
c2 = gnode(g, "flow/call-graph", 640, 260, {"file": "graphs/toast.graph.json", "a": "OVERDRIVE  +5s"}, [EX, ("file", "string"), ("a", "any"), ("b", "any")], [THEN, ("a", "any"), ("b", "any")])
glink(g, e2, 0, a2, 0); glink(g, a2, 0, c2, 0)
e3 = gnode(g, "event/game", 40, 480, {"name": "low-time"}, [], [THEN, ("data", "any")])
a3 = gnode(g, "audio/play", 340, 480, {"clip": "assets/audio/sfx/alarm.wav", "volume": 0.5, "bus": "sfx"}, [EX, ("clip", "string"), ("volume", "number")], [THEN])
c3 = gnode(g, "flow/call-graph", 640, 480, {"file": "graphs/toast.graph.json", "a": "10 SECONDS LEFT"}, [EX, ("file", "string"), ("a", "any"), ("b", "any")], [THEN, ("a", "any"), ("b", "any")])
glink(g, e3, 0, a3, 0); glink(g, a3, 0, c3, 0)
g["groups"] = [{"title": "Reactions to the game's events", "bounding": [20, -20, 960, 640], "color": "#3f789e", "font_size": 24}]
wjson("graphs/toasts.graph.json", g)

# ------------------------------------------------------------------ event sheet
wjson("events/rules.events.json", {"format": 1, "name": "rules", "events": [
    {"type": "comment", "text": "Neon Harbor rules, no code: three data cores in a row trigger OVERDRIVE (+5 s, full energy). The combo fades if you wait too long."},
    {"type": "variable", "name": "combo", "valueType": "number", "value": 0},
    {"type": "variable", "name": "overdrives", "valueType": "number", "value": 0},
    {"type": "group", "title": "Combo", "active": True, "children": [
        {"type": "event", "conditions": [{"object": "Events", "id": "on-event", "params": {"name": "orb"}}],
         "actions": [{"object": "System", "id": "add-to-var", "params": {"variable": "combo", "value": "1"}}]},
        {"type": "event", "conditions": [{"object": "System", "id": "compare-variable", "params": {"variable": "combo", "comparison": ">=", "value": "3"}}],
         "actions": [{"object": "Events", "id": "emit", "params": {"name": "overdrive"}},
                     {"object": "System", "id": "set-var", "params": {"variable": "combo", "value": "0"}},
                     {"object": "System", "id": "add-to-var", "params": {"variable": "overdrives", "value": "1"}}]},
        {"type": "event", "conditions": [{"object": "System", "id": "every-x-seconds", "params": {"seconds": "6"}},
                                         {"object": "System", "id": "compare-variable", "params": {"variable": "combo", "comparison": ">", "value": "0"}}],
         "actions": [{"object": "System", "id": "subtract-from-var", "params": {"variable": "combo", "value": "1"}}]}]},
]})

# ------------------------------------------------------------------ scripts (Unity style)
wtext("scripts/game-manager.js", """// The ready-made GameManager (score, state, events) attached to the Director. Not persistent: every run owns its manager.
import { GameManager } from 'nord';

GameManager.persistent = false;
export default GameManager;
""")

wtext("scripts/skiff.js", """// The player's skiff: throttle/steer/boost, a little banking, obstacle push-out and the world bounds.
import { MonoBehaviour, SerializeField, Mathf } from 'nord';

export default class Skiff extends MonoBehaviour {
  static attributes = SerializeField({ maxSpeed: 14, boostSpeed: 26, accel: 16, turnRate: 92, bounds: 70 });

  Awake() {
    this.speed = 0;
    this.heading = 0; // degrees, 0 = +Z
    this.energy = 100;
    this.boosting = false;
    this.frozen = false;
    this.solids = [];
  }

  Start() {
    // everything tagged "solid" (towers, piers) becomes a rectangle the skiff cannot enter
    for (const e of this.FindGameObjectsWithTag('solid')) {
      const m = e.getComponent('mesh')?.data?.size;
      if (!m) continue;
      const p = e.worldPos, s = e.scale;
      this.solids.push({ x: p[0], z: p[2], hx: (m[0] * s[0]) / 2, hz: (m[2] * s[2]) / 2 });
    }
  }

  Update(dt) {
    if (this.frozen) return;
    const input = this.game.input;
    const throttle = input.axis('down', 'up');
    const steer = input.axis('left', 'right');
    this.boosting = input.down('boost') && throttle > 0 && this.energy > 0;
    const top = this.boosting ? this.boostSpeed : this.maxSpeed;
    const target = throttle * top * (throttle < 0 ? 0.4 : 1);
    this.speed = Mathf.MoveTowards(this.speed, target, this.accel * dt);
    this.heading += steer * this.turnRate * dt * Math.min(1, Math.abs(this.speed) / 4 + 0.25);
    this.energy = Math.min(100, Math.max(0, this.energy + (this.boosting ? -28 : 7) * dt));

    const r = (this.heading * Math.PI) / 180;
    let x = this.entity.pos[0] + Math.sin(r) * this.speed * dt;
    let z = this.entity.pos[2] + Math.cos(r) * this.speed * dt;
    for (const s of this.solids) { // push the skiff out of boxes (radius 1.3)
      const dx = x - s.x, dz = z - s.z, ox = s.hx + 1.3 - Math.abs(dx), oz = s.hz + 1.3 - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) x += Math.sign(dx || 1) * ox; else z += Math.sign(dz || 1) * oz; this.speed *= 0.6; }
    }
    x = Math.max(-this.bounds, Math.min(this.bounds, x));
    z = Math.max(-this.bounds, Math.min(this.bounds, z));
    const bob = Math.sin(this.game.time.elapsed * 3) * 0.06;
    this.entity.pos = [x, 0.35 + bob, z];
    this.entity.rot = [Math.sin(this.game.time.elapsed * 2) * 1.5, this.heading, -steer * Math.min(1, Math.abs(this.speed) / 10) * 9];
  }
}
""")

wtext("scripts/chase-cam.js", """// Chase camera: follows the target from behind its heading and looks at it.
import { MonoBehaviour, SerializeField } from 'nord';

export default class ChaseCam extends MonoBehaviour {
  static attributes = { target: { type: 'string', default: 'Skiff' }, offset: { type: 'vec3', default: [0, 7, -13] }, smoothing: { type: 'number', default: 4 } };

  Start() { this.t = this.Find(this.target); }

  LateUpdate(dt) {
    if (!this.t || this.t.destroyed) return;
    const tp = this.t.worldPos, h = (this.t.rot[1] * Math.PI) / 180, o = this.offset;
    // offset[2] is how far behind the skiff (negative) along its heading, offset[1] the height
    const want = [tp[0] + Math.sin(h) * o[2], tp[1] + o[1], tp[2] + Math.cos(h) * o[2]];
    const k = Math.min(1, this.smoothing * dt), p = this.entity.pos;
    const np = [p[0] + (want[0] - p[0]) * k, p[1] + (want[1] - p[1]) * k, p[2] + (want[2] - p[2]) * k];
    this.entity.pos = np;
    const d = [tp[0] - np[0], tp[1] + 1 - np[1], tp[2] - np[2]];
    this.entity.rot = [(-Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0];
  }
}
""")

wtext("scripts/orbit-cam.js", """// Slow fly-over for the title screen.
import { MonoBehaviour } from 'nord';

export default class OrbitCam extends MonoBehaviour {
  static attributes = { radius: { type: 'number', default: 70 }, height: { type: 'number', default: 18 }, speed: { type: 'number', default: 6 } };

  Update(dt) {
    this.a = (this.a ?? 200) + this.speed * dt;
    const r = (this.a * Math.PI) / 180;
    this.entity.pos = [Math.sin(r) * this.radius, this.height, Math.cos(r) * this.radius];
    const d = [-this.entity.pos[0], 6 - this.height, -this.entity.pos[2]];
    this.entity.rot = [(-Math.atan2(d[1], Math.hypot(d[0], d[2])) * 180) / Math.PI, (Math.atan2(d[0], d[2]) * 180) / Math.PI, 0];
  }
}
""")

wtext("scripts/spin.js", """// Spin: rotates the entity continuously around one axis.
import { MonoBehaviour } from 'nord';

export default class Spin extends MonoBehaviour {
  static attributes = { speed: { type: 'number', default: 90 }, axis: { type: 'enum', options: ['x', 'y', 'z'], default: 'y' } };

  Update(dt) {
    const r = [...this.entity.rot];
    r[{ x: 0, y: 1, z: 2 }[this.axis]] += this.speed * dt;
    this.entity.rot = r;
  }
}
""")

wtext("scripts/bob.js", """// Bob: floats the entity up and down around its start height.
import { MonoBehaviour } from 'nord';

export default class Bob extends MonoBehaviour {
  static attributes = { amplitude: { type: 'number', default: 0.25 }, speed: { type: 'number', default: 2 } };

  Start() { this.y0 = this.entity.pos[1]; this.phase = (this.entity.pos[0] + this.entity.pos[2]) * 0.37; }

  Update() {
    const p = this.entity.pos;
    this.entity.pos = [p[0], this.y0 + Math.sin(this.game.time.elapsed * this.speed + this.phase) * this.amplitude, p[2]];
  }
}
""")

wtext("scripts/orb.js", """// A data core: collected when the skiff gets close. Tells the game ('orb' event); the event sheet and the graph react.
import { MonoBehaviour, GameManager } from 'nord';

export default class Orb extends MonoBehaviour {
  static attributes = { value: { type: 'number', default: 10 }, radius: { type: 'number', default: 1.8 } };

  Start() { this.skiff = this.FindWithTag('player'); }

  Update() {
    if (!this.skiff || this.skiff.destroyed || this.collected) return;
    const a = this.entity.worldPos, b = this.skiff.worldPos;
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) > this.radius + 0.8) return;
    this.collected = true;
    GameManager.instance?.AddScore(this.value);
    this.game.audio?.play('assets/audio/sfx/coin.wav', { bus: 'sfx', volume: 0.8 });
    this.game.events.emit('orb', { value: this.value, at: a });
    this.Destroy();
  }
}
""")

wtext("scripts/harbor.js", """// The director of a run: HUD, timer, minimap, pause, win/lose. Scripts, an event sheet and a graph all take part.
import { MonoBehaviour, GameManager } from 'nord';

export default class Harbor extends MonoBehaviour {
  static attributes = { timeLimit: { type: 'number', default: 100 }, orbsToWin: { type: 'number', default: 14 } };

  async Start() {
    this.left = this.timeLimit;
    this.collected = 0;
    this.over = false;
    this.skiff = this.Find('Skiff');
    this.skiffScript = this.skiff?.scripts.find((s) => s.constructor.name === 'Skiff');
    this.hud = await this.game.ui.load('ui/hud.ui.json');
    this.pause = await this.game.ui.load('ui/pause.ui.json');
    this.end = await this.game.ui.load('ui/gameover.ui.json');
    this.pause.on('resume', () => this.SetPaused(false));
    this.pause.on('menu', () => this.game.loadScene('scenes/menu.scene.json'));
    this.end.on('retry', () => this.game.restart());
    this.end.on('menu', () => this.game.loadScene('scenes/menu.scene.json'));
    this.offs = [
      this.game.events.on('orb', () => this.OnOrb()),
      this.game.events.on('overdrive', () => { this.left += 5; if (this.skiffScript) this.skiffScript.energy = 100; this.game.audio?.play('assets/audio/sfx/heal.wav', { bus: 'sfx' }); }),
    ];
    this.game.audio?.play('assets/audio/music/music_action.mp3', { bus: 'music', loop: true, volume: 0.35 });
    // the game loop stops while paused, so P / Esc is a plain DOM key listener (the loop cannot poll it)
    this.onKey = (e) => { if (!e.repeat && (e.code === 'KeyP' || e.code === 'Escape')) this.SetPaused(!this.paused); };
    addEventListener('keydown', this.onKey);
    this.Refresh();
    this.lowWarned = false;
  }

  OnDestroy() { removeEventListener('keydown', this.onKey); for (const o of this.offs ?? []) o(); for (const s of [this.hud, this.pause, this.end]) s?.destroy(); this.game.audio?.stopMusic?.(); }

  OnOrb() {
    this.collected++;
    if (this.collected >= this.orbsToWin) this.Finish(true);
    this.Refresh();
  }

  SetPaused(on) {
    if (this.over) return;
    this.paused = on;
    on ? this.pause.show() : this.pause.hide();
    on ? this.game.pause() : this.game.resume();
  }

  Finish(won) {
    if (this.over) return;
    this.over = true;
    const gm = GameManager.instance;
    const best = gm?.SaveHighScore('neon-harbor-best') ?? 0;
    const bonus = won ? Math.round(this.left * 5) : 0;
    gm?.AddScore(bonus);
    this.end.set({ result: won ? 'ALL CORES SECURED' : 'NIGHT FALLS', score: gm?.score ?? 0, best: Math.max(best, gm?.score ?? 0), detail: won ? `Time bonus ${bonus}` : `${this.collected} of ${this.orbsToWin} cores` });
    gm?.SaveHighScore('neon-harbor-best');
    if (this.skiffScript) this.skiffScript.frozen = true;
    this.game.audio?.play(won ? 'assets/audio/music/jingle_victory.mp3' : 'assets/audio/music/jingle_game_over.mp3', { bus: 'music' });
    this.end.show();
  }

  Refresh() {
    if (!this.hud) return;
    const gm = GameManager.instance;
    this.hud.set({ score: gm?.score ?? 0, orbs: `${this.collected}/${this.orbsToWin}`, time: Math.ceil(this.left), energy: (this.skiffScript?.energy ?? 100) / 100 });
  }

  Update(dt) {
    if (this.over || !this.hud) return; // Start() is async: the screens may not be loaded yet
    this.left -= dt;
    if (this.left <= 10 && !this.lowWarned) { this.lowWarned = true; this.game.events.emit('low-time'); }
    if (this.left <= 0) { this.left = 0; this.Finish(false); }
    this.tick = (this.tick ?? 0) + dt;
    if (this.tick > 0.08) { this.tick = 0; this.Refresh(); this.DrawMinimap(); }
  }

  DrawMinimap() {
    const cv = this.hud.get('minimap')?.el; const g = cv?.getContext?.('2d'); if (!g) return;
    const S = cv.width, k = S / 150; // 150 world units across (bounds are +-70)
    const px = (x) => S / 2 + x * k, pz = (z) => S / 2 - z * k;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#04122a'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#0b3a5a'; g.lineWidth = 1;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo((S * i) / 6, 0); g.lineTo((S * i) / 6, S); g.moveTo(0, (S * i) / 6); g.lineTo(S, (S * i) / 6); g.stroke(); }
    g.fillStyle = '#ff3fb8';
    for (const e of this.FindGameObjectsWithTag('solid')) { const p = e.worldPos; g.fillRect(px(p[0]) - 3, pz(p[2]) - 3, 6, 6); }
    g.fillStyle = '#25e8ff';
    for (const e of this.FindGameObjectsWithTag('orb')) { const p = e.worldPos; g.beginPath(); g.arc(px(p[0]), pz(p[2]), 3, 0, 7); g.fill(); }
    if (this.skiff) {
      const p = this.skiff.worldPos, h = (this.skiff.rot[1] * Math.PI) / 180;
      g.save(); g.translate(px(p[0]), pz(p[2])); g.rotate(h);
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore();
    }
  }
}
""")

wtext("scripts/menu.js", """// Title screen: loads the menu UI and starts a run.
import { MonoBehaviour } from 'nord';

export default class Menu extends MonoBehaviour {
  async Start() {
    this.screen = await this.game.ui.load('ui/menu.ui.json');
    this.screen.set('best', this.game.save.get('neon-harbor-best', 0));
    this.screen.on('play', () => { this.game.audio?.play('assets/audio/sfx/confirm.wav', { bus: 'ui' }); this.game.loadScene('scenes/harbor.scene.json'); });
    this.game.audio?.play('assets/audio/music/music_action.mp3', { bus: 'music', loop: true, volume: 0.2 });
  }

  OnDestroy() { this.screen?.destroy(); this.game.audio?.stopMusic?.(); }
}
""")

# ------------------------------------------------------------------ project file, readme, license
project = {
    "format": 1, "name": "Neon Harbor", "id": "com.crowelian.neonharbor", "type": "3d", "engineVersion": "0.1.0",
    "startScene": "scenes/menu.scene.json",
    "display": {"width": 1280, "height": 720, "scale": "fit", "pixelArt": False, "background": "#050a18"},
    "physics": {"engine": "havok", "gravity": [0, -9.81, 0]},
    "input": {"actions": {
        "left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"], "down": ["KeyS", "ArrowDown"],
        "boost": ["ShiftLeft", "ShiftRight"], "pause": ["KeyP", "Escape"]}},
    "plugins": ["ui", "audio"],
    "ui": {"theme": "nord"},
}
wjson("nord.project.json", project)

wtext("README.md", """# Neon Harbor — Nord Engine showcase

A night-time harbour: fly a neon skiff through a 3D city, collect 14 data cores before the timer ends. The world is 3D (towers, water, lights, bloom); everything you read and click is a 2D UI layer (HUD, minimap, menus).

Open `nord.project.json` in Nord Engine and press **Play** (F5). **W/S** throttle, **A/D** steer, **Shift** boost, **P** pause.

It is the project of tutorial **T48 Neon Harbor** and uses: material assets, prefabs (nested, variant, child overrides), a model with import settings, the UI Designer (canvas scaler, UI prefab, sprite-state buttons, skin tint), an event sheet, node graphs with a subgraph, Unity-style scripts and a GameManager.

Credits: character model CC0 by Kenney (Starter Kit 3D Platformer); skybox, sounds and music from the Nord Engine library; everything else generated for this project (`tools/make-neon-harbor.py`).
""")
wtext("LICENSE", "Neon Harbor project files: MIT (c) Crowelian 2026 + Sonnet. character.glb: CC0 by Kenney. See the Nord Engine repository for the other bundled assets.\n")

# ------------------------------------------------------------------ download zip
out = R / "docs" / "tutorial-downloads"
out.mkdir(parents=True, exist_ok=True)
zp = out / "neon-harbor-source.zip"
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(P.rglob("*")):
        if f.is_file():
            z.write(f, pathlib.Path("neon-harbor") / f.relative_to(P))
print("wrote", P, "and", zp, f"({zp.stat().st_size // 1024} KB)")


# ------------------------------------------------------------------ tutorial page (T48) with the real script listings
tmpl = (R / "tools" / "neon-harbor-tutorial.md").read_text()
def listing(name):
    t = (P / "scripts" / f"{name}.js").read_text()
    return t if t.endswith("\n") else t + "\n"
page = (tmpl.replace("{ORB_JS}", listing("orb")).replace("{SKIFF_JS}", listing("skiff")).replace("{HARBOR_JS}", listing("harbor")))
(R / "docs" / "manual-src" / "tut-t48-neon-harbor.md").write_text(page)
print("wrote tutorial page")
