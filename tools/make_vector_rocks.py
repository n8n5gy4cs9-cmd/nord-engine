#!/usr/bin/env python3
"""Generates examples/vector-rocks (the Unity-style Asteroids of the Examples section): project, scene, prefabs, scripts, assets.
Scripts: tools/vector-rocks/*.js. Art: python3 tools/gen_vector_rocks_art.py. Run: python3 tools/make_vector_rocks.py"""
import json, shutil, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/vector-rocks'
OUT = ROOT / 'examples/vector-rocks'
T = lambda n: f'assets/sprites/{n}.png'

def ent(i, name, x, y, z=0, comps=(), scripts=(), tags=(), children=(), enabled=True):
    return {"id": f"vr{i:05d}", "name": name, "enabled": enabled, "tags": list(tags), "layer": 0,
            "transform": {"pos": [x, y, z], "rot": [0, 0, 0], "scale": [1, 1, 1]}, "components": list(comps),
            "scripts": [{"path": f"scripts/{p}.js", "attributes": a} for p, a in scripts], "children": list(children), "prefab": None}
spr = lambda tex, w, h, **k: {"type": "sprite", "texture": T(tex), "size": [w, h], "tint": "#ffffff", "alpha": 1, **k}
body = {"type": "rigidbody", "mode": "dynamic"}
circle = lambda r: {"type": "collider", "shape": "circle", "radius": r, "size": [r * 2, r * 2], "trigger": True}
def particles(**k):
    base = {"type": "particles", "texture": "assets/particles/streak.png", "tint": "#b8ffc8", "tintEnd": "#19c452", "lifespan": 700, "speed": [60, 260],
            "scale": [0.7, 0], "alpha": [1, 0], "emitting": False, "burst": 20}
    base.update(k); return base

def build():
    for sub in ('scenes', 'scripts', 'prefabs', 'assets/particles', 'assets/audio/sfx'): (OUT / sub).mkdir(parents=True, exist_ok=True)
    proj = {"format": 1, "name": "Vector Rocks", "id": "com.crowelian.vector-rocks", "type": "2d", "engineVersion": "0.1.0", "startScene": "scenes/main.scene.json",
            "display": {"width": 800, "height": 600, "scale": "fit", "pixelArt": False, "background": "#010a03"},
            "physics": {"engine": "arcade", "gravity": [0, 0, 0]},
            "input": {"actions": {"left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"], "down": ["KeyS", "ArrowDown"],
                                  "fire": ["Space"], "interact": ["Enter"]}}}
    (OUT / 'nord.project.json').write_text(json.dumps(proj, indent=2) + '\n')
    ship = ent(2, 'Ship', 400, 300, 2, [spr('ship', 64, 64), body, circle(12)], [('Ship', {})], ['Player'], [
        ent(3, 'Flame', 0, 0, -1, [spr('flame', 64, 64)], enabled=False), ent(4, 'Shield', 0, 0, 1, [spr('shield', 80, 80)], enabled=False)])
    scene = {"format": 1, "name": "main",
             "settings": {"effects": [{"type": "crt", "intensity": 0.35}]},
             "entities": [ent(1, 'Camera', 400, 300, 10, [{"type": "camera", "zoom": 1}]), ent(5, 'Game', 0, 0, 0, [], [('Game', {})]), ship, ent(6, 'Hud', 0, 0, 0, [], [('Hud', {})])]}
    (OUT / 'scenes/main.scene.json').write_text(json.dumps(scene, indent=2) + '\n')
    prefabs = {'bullet': ent(1, 'Bullet', 0, 0, 2, [spr('bullet', 10, 10), body, circle(4), particles(texture='assets/particles/soft.png', burst=0, emitting=True, frequency=18, lifespan=260, speed=[0, 6], scale=[0.14, 0], alpha=[0.45, 0], tint="#7dffa3", tintEnd="#19c452")],
                             [('Bullet', {})], ['Bullet']),
               'explosion': ent(1, 'Explosion', 0, 0, 3, [particles()]),
               'nova': ent(1, 'Nova', 0, 0, 3, [particles(texture='assets/particles/ring.png', burst=1, speed=[0, 0], scale=[0.2, 7], alpha=[1, 0], lifespan=800, tint="#d8ffe3", tintEnd="#19c452")])}
    for tag, size, r, s in (('large', 120, 44, 2), ('medium', 72, 26, 1), ('small', 40, 13, 0)):
        for v in range(3):
            prefabs[f'rock-{tag}-{v}'] = ent(1, 'Rock', 0, 0, 1, [spr(f'rock_{tag[0]}{v}', size, size), body, circle(r)], [('Rock', {"size": s})], ['Rock'])
    for t in ('shield', 'rapid', 'triple', 'nova', 'life'):
        prefabs[f'pu-{t}'] = ent(1, 'PowerUp', 0, 0, 2, [spr(f'pu_{t}', 40, 40), body, circle(18)], [('PowerUp', {"type": t})], ['PowerUp'])
    for name, root in prefabs.items():
        (OUT / f'prefabs/{name}.prefab.json').write_text(json.dumps({"format": 1, "root": root}, indent=2) + '\n')
    for f in SRC.glob('*.js'): shutil.copy(f, OUT / 'scripts' / f.name)
    A = ROOT / 'assets'
    for n in ('streak', 'soft', 'ring'): shutil.copy(A / f'particles/{n}.png', OUT / f'assets/particles/{n}.png')
    for n in ('laser', 'explosion', 'explosion_small', 'death', 'powerup', 'teleport', 'tick'): shutil.copy(A / f'audio/sfx/{n}.wav', OUT / f'assets/audio/sfx/{n}.wav')
    html = (ROOT / 'examples/topdown/index.html').read_text().replace('background:#101418', 'background:#050606')
    (OUT / 'index.html').write_text(html)
    (OUT / 'README.md').write_text('# Vector Rocks\n\nAsteroids on an old green XY vector monitor, written Unity-style (MonoBehaviour, Singleton, Instantiate, coroutines, triggers). '
        'Controls: A/D or arrows turn, W/Up thrust, Space fire, Shift hyperspace. Power-ups: shield, rapid fire, triple shot, nova, extra life.\nArt: `python3 tools/gen_vector_rocks_art.py`. Project: `python3 tools/make_vector_rocks.py`. Page: examples page 44.\n')
def docs():
    import zipfile
    text = (SRC / 'docs/page.md').read_text()
    text = re.sub(r'@@code (\S+)@@', lambda m: '```js\n' + (SRC / m.group(1)).read_text().rstrip() + '\n```', text)
    (ROOT / 'docs/manual-src/ex-vector-rocks.md').write_text(text)
    (ROOT / 'docs/tutorial-downloads').mkdir(exist_ok=True)
    with zipfile.ZipFile(ROOT / 'docs/tutorial-downloads/vector-rocks-source.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.rglob('*')):
            if f.is_file(): zf.write(f, 'vector-rocks/' + f.relative_to(OUT).as_posix())
if __name__ == '__main__':
    build(); docs(); print('ok')
