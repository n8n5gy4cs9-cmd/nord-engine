#!/usr/bin/env python3
"""Generates examples/ember-crypt (the T61 tutorial game): project file, title + game scenes, map.js and the assets it uses.
Scripts live in tools/ember-crypt/*.js and are copied as they are.   Run: python3 tools/make_ember_crypt.py"""
import json, shutil, pathlib, re, zipfile
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

def build():
    (OUT / 'scenes').mkdir(parents=True, exist_ok=True); (OUT / 'scripts').mkdir(exist_ok=True)
    proj = {"format": 1, "name": "Ember Crypt", "id": "com.crowelian.ember-crypt", "type": "2d", "engineVersion": "0.1.0",
            "startScene": "scenes/title.scene.json",
            "display": {"width": 640, "height": 360, "scale": "fit", "pixelArt": True, "background": "#07080c"},
            "physics": {"engine": "arcade", "gravity": [0, 0, 0]},
            "input": {"actions": {"left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"], "down": ["KeyS", "ArrowDown"],
                                  "attack": ["Space", "KeyJ", "Mouse0"], "interact": ["KeyE", "Enter"]}}}
    (OUT / 'nord.project.json').write_text(json.dumps(proj, indent=2) + '\n')
    cam = [{"type": "camera", "zoom": 1}]
    title = [ent(1, 'Camera', 320, 180, 10, cam), ent(2, 'Title', 0, 0, 0, [], [("scripts/title.js", {})])]
    game = [
        ent(1, 'Camera', 320, 180, 10, cam, [("scripts/follow.js", {"target": "Hero"})]),
        ent(2, 'Game', 0, 0, 0, [], [("scripts/state.js", {})]),
        ent(3, 'Level', 0, 0, 0, [], [("scripts/level.js", {"tile": 32})]),
        ent(4, 'Light2D', 0, 0, 0, [], [("scripts/light2d.js", {"ambient": "#0a0b12", "scale": 7.5, "shadows": True, "softShadows": 40})]),
        ent(5, 'Hud', 0, 0, 0, [], [("scripts/hud.js", {})]),
        ent(6, 'Hero', 112, 112, 3,
            [{"type": "animatedSprite", "texture": "assets/sprites/hero.png", "anim": "idle"}, {"type": "rigidbody", "mode": "dynamic"},
             {"type": "collider", "shape": "box", "size": [14, 16]}],
            [("scripts/hero.js", {}), ("scripts/health.js", {"max": 5})], ['hero'],
            children=[ent(7, 'Lantern', 0, 0, 0, [], [("scripts/light2d-source.js", {"color": "#ffb86b", "radius": 200, "intensity": 0.95, "falloff": 1.3, "softness": 5, "flicker": 0.07})])])]
    for name, ents in (('title', title), ('main', game)):
        (OUT / f'scenes/{name}.scene.json').write_text(json.dumps({"format": 1, "name": name, "settings": {}, "entities": ents}, indent=2) + '\n')
    (OUT / 'scripts/map.js').write_text('/** The dungeon. # wall, . floor, P hero start, o coin, k key, D door (2 tiles), + potion, B brazier, c crate,\n *  ^ spikes, C chest, s slime, b bat, X exit. 40 x 22 tiles of 32 px. */\nexport const MAP = [\n' + ''.join(f"  '{r}',\n" for r in MAP) + '];\n')
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
    (OUT / 'README.md').write_text('# Ember Crypt\n\nThe finished game of tutorial T61. Controls: WASD / arrows move, Space or J attacks, E confirms, Esc pauses.\nArt: Nord Engine bundled pixel art. Generated by `python3 tools/make_ember_crypt.py` (scripts in `tools/ember-crypt/`).\n')
def docs():
    text = (SRC / 'docs/t61.md').read_text()
    text = re.sub(r'@@code (\S+)@@', lambda m: '```js\n' + (SRC / m.group(1) if (SRC / m.group(1)).exists() else OUT / 'scripts' / m.group(1)).read_text().rstrip() + '\n```', text)
    (ROOT / 'docs/manual-src/tut-t61-ember-crypt.md').write_text(text)
    (ROOT / 'docs/tutorial-downloads').mkdir(exist_ok=True)
    with zipfile.ZipFile(ROOT / 'docs/tutorial-downloads/ember-crypt-source.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.rglob('*')):
            if f.is_file(): zf.write(f, 'ember-crypt/' + f.relative_to(OUT).as_posix())
if __name__ == '__main__':
    build()
    if (SRC / 'docs/t61.md').exists(): docs()
    print('ok')
