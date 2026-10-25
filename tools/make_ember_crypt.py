#!/usr/bin/env python3
"""Generates examples/ember-crypt (the T61 tutorial game): project file, title + game scenes, map.js and the assets it uses.
Scripts live in tools/ember-crypt/*.js and are copied as they are.   Run: python3 tools/make_ember_crypt.py"""
import re, json, shutil, pathlib, re, zipfile
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/ember-crypt'
OUT = ROOT / 'examples/ember-crypt'
W, H = 40, 22
g = [['#'] * W for _ in range(H)]
def room(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = '.'
room(2, 2, 9, 7); room(14, 2, 23, 8); room(29, 2, 37, 7); room(2, 12, 11, 19); room(16, 13, 25, 19); room(30, 12, 37, 19)
for a in [(10, 4, 13, 5), (24, 4, 28, 5), (5, 8, 6, 11), (18, 9, 19, 12), (33, 8, 34, 11), (12, 15, 15, 16)]: room(*a)
def put(ch, x, y): g[y][x] = ch
for x, y in [(6, 5), (7, 5), (18, 5), (19, 5), (20, 5), (6, 15), (7, 15), (20, 16), (21, 16)]: put('#', x, y)
put('P', 3, 3)
for x, y in [(8, 6), (22, 3), (16, 7), (35, 3), (31, 6), (4, 18), (10, 13), (17, 18), (24, 14), (36, 18), (31, 13), (3, 14), (21, 7), (32, 4)]: put('o', x, y)
for x, y in [(15, 3), (22, 7), (9, 17), (24, 18), (31, 17)]: put('s', x, y)
for x, y in [(35, 6), (20, 14), (6, 13)]: put('b', x, y)
put('k', 10, 18); put('k', 36, 3)
for y in (4, 5): put('D', 26, y)
for x in (33, 34): put('D', x, 9)
for x, y in [(3, 5), (12, 7), (22, 5), (30, 3), (4, 17), (20, 17), (36, 14), (14, 12)][:0]: pass
for x, y in [(8, 3), (14, 9), (35, 13), (17, 14)]: put('+', x, y) if g[y][x] == '.' else None
for x, y in [(3, 7), (23, 2), (36, 7), (3, 12), (25, 19), (30, 19), (10, 7)]: put('B', x, y) if g[y][x] == '.' else None
for x, y in [(8, 4), (4, 6), (15, 6), (23, 6), (34, 13), (35, 16), (18, 18), (4, 15)]: put('c', x, y) if g[y][x] == '.' else None
for x, y in [(11, 4), (12, 5), (27, 4), (34, 10), (33, 11), (14, 15)]: put('^', x, y) if g[y][x] == '.' else None
put('C', 24, 16); put('X', 35, 17)
MAP = [''.join(r) for r in g]

def ent(i, name, x, y, z=0, comps=(), scripts=(), tags=(), layer=0, children=()):
    return {"id": f"ec{i:05d}", "name": name, "enabled": True, "tags": list(tags), "layer": layer,
            "transform": {"pos": [x, y, z], "rot": [0, 0, 0], "scale": [1, 1, 1]}, "components": list(comps),
            "scripts": [{"path": p, "attributes": a} for p, a in scripts], "children": list(children), "prefab": None}

KEEP = {'map.js', 'light2d.js', 'light2d-source.js', 'light2d-occluder.js'}

def code_block(base, spec):
    """@@code path | note@@ -> a labelled fence: **File: `scripts/<file>`** (note) + the file content."""
    path, _, note = [x.strip() for x in spec.partition('|')]
    f = base / path if (base / path).exists() else None
    if f is None: f = OUT / 'scripts' / pathlib.Path(path).name
    name = 'scripts/' + pathlib.Path(path).name
    body = f.read_text().rstrip()
    out = f'**File: `{name}`** ({note or "new file, the whole file"})\n```js\n' + body + '\n```'
    m = re.search(r'attach it to (.+)$', note)
    if m and 'nothing' not in m.group(1):
        target = m.group(1)
        make = ' If the object does not exist yet, create it first with @ui[Hierarchy ▸ + Create ▸ Empty] and rename it.' if re.search(r'`(Game|Hud|Level|Run|GameManager|Title)`', target) else ''
        prefab = ' Prefabs: first @ui[Assets ▸ right-click the prefab ▸ Open prefab].' if 'prefab' in target else ''
        out += f'\n\n**In the editor:** select {target}, then @ui[Inspector ▸ + Add script ▸ {name}].{make}{prefab} The scene or prefab file then lists the script under `"scripts"`.\n'
    return out

def build():
    for sub in ('scenes', 'scripts', 'prefabs'): (OUT / sub).mkdir(parents=True, exist_ok=True)
    proj = {"format": 1, "name": "Ember Crypt", "id": "com.crowelian.ember-crypt", "type": "2d", "engineVersion": "0.1.0",
            "startScene": "scenes/title.scene.json",
            "display": {"width": 640, "height": 360, "scale": "fit", "pixelArt": True, "background": "#07080c"},
            "physics": {"engine": "arcade", "gravity": [0, 0, 0]},
            "input": {"actions": {"left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"], "down": ["KeyS", "ArrowDown"],
                                  "attack": ["Space", "KeyJ", "Mouse0"], "interact": ["KeyE", "Enter"]}}}
    (OUT / 'nord.project.json').write_text(json.dumps(proj, indent=2) + '\n')
    cam = [{"type": "camera", "zoom": 1}]
    img = lambda tex, w, h, tint="#ffffff": {"type": "sprite", "texture": f"assets/{tex}", "size": [w, h], "tint": tint, "alpha": 1}
    body = lambda m: {"type": "rigidbody", "mode": m}
    box = lambda w, h, trig=False: {"type": "collider", "shape": "box", "size": [w, h], **({"trigger": True} if trig else {})}
    occ = ("scripts/light2d-occluder.js", {"static": True})
    light = lambda color, r, i, fl, sh=True: ("scripts/light2d-source.js", {"color": color, "radius": r, "intensity": i, "falloff": 1.3, "softness": 4, "flicker": fl, "shadows": sh})
    P = {
        'floor': ent(1, 'Floor', 0, 0, -5, [img('sprites/floor.png', 1280, 800)]),
        'wall-tile': ent(1, 'WallTile', 0, 0, 1, [img('sprites/wall.png', 32, 32)]),
        'wall-body': ent(1, 'Wall', 0, 0, 0, [body('static'), box(32, 32)], [occ], ['solid']),
        'crate': ent(1, 'Crate', 0, 0, 2, [img('sprites/items/crate.png', 26, 26), body('static'), box(24, 24)], [occ], ['solid']),
        'barrel': ent(1, 'Barrel', 0, 0, 2, [img('sprites/items/barrel.png', 26, 26), body('static'), box(24, 24)], [occ], ['solid']),
        'coin': ent(1, 'Coin', 0, 0, 2, [{"type": "animatedSprite", "texture": "assets/sprites/coin.png", "anim": "spin"}, body('static'), box(14, 14, True)], [("scripts/Pickup.js", {"kind": "coin"})], ['Coin']),
        'key': ent(1, 'Key', 0, 0, 2, [img('sprites/items/key.png', 20, 20), body('static'), box(16, 16, True)], [("scripts/Pickup.js", {"kind": "key"})]),
        'potion': ent(1, 'Potion', 0, 0, 2, [img('sprites/items/potion_red.png', 20, 20), body('static'), box(16, 16, True)], [("scripts/Pickup.js", {"kind": "potion"})]),
        'chest': ent(1, 'Chest', 0, 0, 2, [img('sprites/items/chest_closed.png', 28, 28), body('static'), box(24, 24, True)], [("scripts/Pickup.js", {"kind": "chest"})]),
        'door': ent(1, 'Door', 0, 0, 2, [img('sprites/gate.png', 32, 32), body('static'), box(32, 32)], [("scripts/Door.js", {}), occ], ['Door', 'solid']),
        'spikes': ent(1, 'Spikes', 0, 0, 1, [img('sprites/items/spikes.png', 28, 28)], [("scripts/Spikes.js", {})]),
        'brazier': ent(1, 'Brazier', 0, 0, 2, [img('sprites/brazier.png', 26, 26)], [light('#ff9a45', 120, 0.8, 0.3)]),
        'exit': ent(1, 'Exit', 0, 0, 1, [img('sprites/rune.png', 40, 40)], [("scripts/Exit.js", {}), light('#7fd6ff', 110, 0.9, 0.1, True)]),
        'slime': ent(1, 'Slime', 0, 0, 3, [{"type": "animatedSprite", "texture": "assets/sprites/enemy_slime.png", "anim": "idle"}, body('dynamic'), box(18, 12)],
                     [("scripts/Enemy.js", {"speed": 55, "hp": 2, "sight": 150, "zigzag": 0})], ['Enemy']),
        'bat': ent(1, 'Bat', 0, 0, 4, [{"type": "animatedSprite", "texture": "assets/sprites/enemy_bat.png", "anim": "fly"}, body('dynamic'), box(14, 10)],
                   [("scripts/Enemy.js", {"speed": 95, "hp": 1, "sight": 190, "zigzag": 1})], ['Enemy']),
        'floattext': ent(1, 'FloatText', 0, 0, 5, [{"type": "text", "text": "1", "size": 12, "color": "#ffffff", "bold": True, "stroke": "#000000", "strokeThickness": 3}], [("scripts/FloatText.js", {})], layer=1),
        'burst': ent(1, 'Burst', 0, 0, 6, [{"type": "particles", "texture": "assets/particles/spark.png", "tint": "#ffd27a", "tintEnd": "#ff5a1f", "burst": 14, "emitting": False,
                                           "lifespan": 450, "speed": [40, 140], "scale": [0.5, 0], "alpha": [1, 0]}], layer=1),
        'slash': ent(1, 'Slash', 0, 0, 6, [{"type": "sprite", "texture": "assets/sprites/circle.png", "size": [24, 24], "tint": "#fff2c9", "alpha": 0.7}], [("scripts/Slash.js", {})], layer=1),
    }
    for name, root in P.items(): (OUT / f'prefabs/{name}.prefab.json').write_text(json.dumps({"format": 1, "root": root}, indent=2) + '\n')
    title = [ent(1, 'Camera', 320, 180, 10, cam), ent(2, 'Title', 0, 0, 0, [], [("scripts/Title.js", {})]),
             ent(3, 'Floor', 320, 400, -5, [img('sprites/floor.png', 1280, 800, '#3a3a4a')]),
             ent(4, 'Embers', 320, 370, 1, [{"type": "particles", "texture": "assets/particles/spark.png", "tint": "#ffb86b", "tintEnd": "#ff4a1c", "frequency": 70, "lifespan": 3200,
                                            "speed": [15, 40], "angle": [255, 285], "emitRadius": 280, "scale": [0.5, 0], "alpha": [1, 0]}]),
             ent(5, 'Hero', 250, 246, 3, [{"type": "animatedSprite", "texture": "assets/sprites/hero.png", "anim": "idle"}]),
             ent(6, 'Slime', 392, 252, 3, [{"type": "animatedSprite", "texture": "assets/sprites/enemy_slime.png", "anim": "idle"}]),
             ent(7, 'Brazier', 320, 244, 3, [img('sprites/brazier.png', 40, 40)])]
    game = [
        ent(1, 'Camera', 320, 180, 10, cam, [("scripts/Follow.js", {"target": "Hero"})]),
        ent(2, 'GameManager', 0, 0, 0, [], [("scripts/GameManager.js", {"startLives": 5})]),
        ent(3, 'Run', 0, 0, 0, [], [("scripts/Run.js", {})]),
        ent(4, 'Level', 0, 0, 0, [], [("scripts/Level.js", {"tile": 32})]),
        ent(5, 'Light2D', 0, 0, 0, [], [("scripts/light2d.js", {"ambient": "#0a0b12", "scale": 7.5, "shadows": True, "softShadows": 40})]),
        ent(6, 'Hud', 0, 0, 0, [], [("scripts/Hud.js", {})]),
        ent(7, 'Hero', 112, 112, 3, [{"type": "animatedSprite", "texture": "assets/sprites/hero.png", "anim": "idle"}, body('dynamic'), box(14, 16)],
            [("scripts/Hero.js", {}), ("scripts/Health.js", {"grace": 1})], ['Hero'],
            children=[ent(8, 'Lantern', 0, 0, 0, [], [light('#ffb86b', 200, 0.95, 0.07)[0:0] or ("scripts/light2d-source.js", {"color": "#ffb86b", "radius": 200, "intensity": 0.95, "falloff": 1.3, "softness": 5, "flicker": 0.07})])])]
    for name, ents in (('title', title), ('main', game)):
        (OUT / f'scenes/{name}.scene.json').write_text(json.dumps({"format": 1, "name": name, "settings": {}, "entities": ents}, indent=2) + '\n')
    (OUT / 'scripts/map.js').write_text('/** The dungeon. # wall, . floor, P hero start, o coin, k key, D door (2 tiles), + potion, B brazier, c crate or barrel,\n *  ^ spikes, C chest, s slime, b bat, X exit. 40 x 22 tiles of 32 px. */\nexport const MAP = [\n' + ''.join(f"  '{r}',\n" for r in MAP) + '];\n')
    for f in SRC.glob('*.js'): shutil.copy(f, OUT / 'scripts' / f.name)
    L = ROOT / 'examples/light2d/assets/sprites'; A = ROOT / 'assets'
    files = {'sprites/hero.png': L / 'hero.png', 'sprites/hero.png.meta.json': L / 'hero.png.meta.json', 'sprites/wall.png': L / 'wall.png',
             'sprites/floor.png': L / 'floor.png', 'sprites/gate.png': L / 'gate.png', 'sprites/brazier.png': L / 'brazier.png',
             'sprites/rune.png': L / 'rune.png', 'sprites/circle.png': L / 'circle.png', 'sprites/square.png': L / 'square.png'}
    for n in ('enemy_slime', 'enemy_bat', 'coin'):
        files[f'sprites/{n}.png'] = A / f'sprites/{n}.png'; files[f'sprites/{n}.png.meta.json'] = A / f'sprites/{n}.png.meta.json'
    for n in ('key', 'potion_red', 'heart_full', 'heart_empty', 'chest_closed', 'crate', 'barrel', 'spikes'): files[f'sprites/items/{n}.png'] = A / f'sprites/items/{n}.png'
    for n in ('spark', 'flame', 'smoke', 'soft'): files[f'particles/{n}.png'] = A / f'particles/{n}.png'
    for n in ('swing', 'hit', 'hurt', 'coin', 'pickup', 'door', 'error', 'heal', 'death', 'win', 'lose', 'chest', 'click', 'confirm'): files[f'audio/sfx/{n}.wav'] = A / f'audio/sfx/{n}.wav'
    for n in ('music_menu_chill', 'music_adventure', 'jingle_victory', 'jingle_game_over'): files[f'audio/music/{n}.mp3'] = A / f'audio/music/{n}.mp3'
    for rel, src in files.items():
        d = OUT / 'assets' / rel; d.parent.mkdir(parents=True, exist_ok=True); shutil.copy(src, d)
    shutil.copy(ROOT / 'examples/topdown/index.html', OUT / 'index.html')
    (OUT / 'README.md').write_text('# Ember Crypt\n\nThe finished game of example page 55, written Unity-style. Controls: WASD / arrows move, Space or J attacks, E confirms, Esc pauses.\nArt: Nord Engine bundled pixel art. Generated by `python3 tools/make_ember_crypt.py` (scripts in `tools/ember-crypt/`).\n')
def docs():
    text = (SRC / 'docs/page.md').read_text()
    text = re.sub(r'@@code ([^@]+)@@', lambda m: code_block(SRC, m.group(1)), text)
    (ROOT / 'docs/manual-src/ex-ember-crypt.md').write_text(text)
    (ROOT / 'docs/tutorial-downloads').mkdir(exist_ok=True)
    with zipfile.ZipFile(ROOT / 'docs/tutorial-downloads/ember-crypt-source.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.rglob('*')):
            if f.is_file(): zf.write(f, 'ember-crypt/' + f.relative_to(OUT).as_posix())
def strip_scripts(node):
    if isinstance(node, dict):
        if 'scripts' in node and isinstance(node['scripts'], list):
            node['scripts'] = [s for s in node['scripts'] if s['path'].split('/')[-1] in KEEP]
        for v in node.values(): strip_scripts(v)
    elif isinstance(node, list):
        for v in node: strip_scripts(v)

def starter():
    """The Unity-style starter project: all art, sound, prefabs and scenes set up, but none of the game code."""
    import zipfile, tempfile
    dst = pathlib.Path(tempfile.mkdtemp()) / 'ember-crypt-starter'
    shutil.copytree(OUT, dst)
    for f in (dst / 'scripts').glob('*.js'):
        if f.name not in KEEP: f.unlink()
    for f in list(dst.glob('scenes/*.json')) + list(dst.glob('prefabs/*.json')):
        d = json.loads(f.read_text()); strip_scripts(d); f.write_text(json.dumps(d, indent=2) + '\n')
    (dst / 'README.md').write_text('# Ember Crypt starter\n\nAll art, sound, prefabs and scenes are ready; the game scripts are not. Write them following the tutorial page and attach each one to the object the page names.\n')
    with zipfile.ZipFile(ROOT / 'docs/tutorial-downloads/ember-crypt-starter.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(dst.rglob('*')):
            if f.is_file(): zf.write(f, 'ember-crypt-starter/' + f.relative_to(dst).as_posix())

if __name__ == '__main__':
    build()
    if (SRC / 'docs/page.md').exists(): docs()
    starter()
    print('ok')
