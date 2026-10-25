#!/usr/bin/env python3
"""Generates examples/digital-clock (Examples page 3.6, "Build a digital clock": primitives + world-space text) and the page
from tools/digital-clock/docs/page.md. Run: python3 tools/make_digital_clock.py"""
import json, pathlib, re, shutil, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/digital-clock'
OUT = ROOT / 'examples/digital-clock'
_n = [0]


def ent(name, pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), comps=(), scripts=(), children=()):
    _n[0] += 1
    return {"id": f"dc{_n[0]:03d}", "name": name, "enabled": True, "tags": [], "layer": 0,
            "transform": {"pos": list(pos), "rot": list(rot), "scale": list(scale)}, "components": list(comps),
            "scripts": [{"path": p, "attributes": a} for p, a in scripts], "children": list(children), "prefab": None}


def part(name, shape, size, pos, material, rot=(0, 0, 0), scale=(1, 1, 1)):
    return ent(name, pos=pos, rot=rot, scale=scale, comps=[{"type": "mesh", "shape": shape, "size": list(size), "castShadow": True},
                                                          {"type": "material", "asset": f"assets/materials/{material}.mat.json"}])


def text(name, pos, value, size, color):
    return ent(name, pos=pos, comps=[{"type": "text", "text": value, "size": size, "color": color, "font": "Courier New, monospace", "bold": True, "align": "center"}])


MATERIALS = {'case': '#1b1f27', 'bezel': '#0b0d12', 'screen': '#0a2615', 'button': '#6b7380', 'led': '#e23b3b'}
# (name, shape, mesh size, position, material, scale): like in Unity, a cube is 1x1x1 and the Transform scale gives its size
PARTS = [
    ('Case', 'box', (1, 1, 1), (0, 0, 0.5), 'case', (10, 4, 1)),
    ('Bezel', 'box', (1, 1, 1), (0, 0.1, -0.1), 'bezel', (9.4, 3.4, 0.2)),
    ('Screen', 'box', (1, 1, 1), (0, 0.1, -0.25), 'screen', (9, 3, 0.1)),
    ('Button 1', 'box', (1, 1, 1), (-1.5, -1.75, -0.1), 'button', (0.8, 0.25, 0.2)),
    ('Button 2', 'box', (1, 1, 1), (0, -1.75, -0.1), 'button', (0.8, 0.25, 0.2)),
    ('Button 3', 'box', (1, 1, 1), (1.5, -1.75, -0.1), 'button', (0.8, 0.25, 0.2)),
    ('LED', 'sphere', (1, 1, 1), (4.3, -1.75, -0.1), 'led', (0.25, 0.25, 0.25)),
    ('Foot Left', 'cylinder', (1, 2, 1), (-3.5, -2.15, 0.5), 'bezel', (0.6, 0.3, 0.6)),
    ('Foot Right', 'cylinder', (1, 2, 1), (3.5, -2.15, 0.5), 'bezel', (0.6, 0.3, 0.6)),
]
TIME_TEXT = ('Time Text', (0, 0.45, -0.32), '12:34:56', 72, '#7dff9a')
DATE_TEXT = ('Date Text', (0, -0.85, -0.32), 'Thursday 1 January', 28, '#4fbf6a')


def build():
    for sub in ('scenes', 'scripts', 'assets/materials'):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    proj = {"format": 1, "name": "Digital Clock", "id": "com.crowelian.digitalclock", "type": "3d", "engineVersion": "0.1.0",
            "startScene": "scenes/main.scene.json",
            "display": {"width": 800, "height": 500, "scale": "fit", "pixelArt": False, "background": "#31506e"},
            "physics": {"engine": "none", "gravity": [0, 0, 0]},
            "input": {"actions": {"left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"], "down": ["KeyS", "ArrowDown"]}}}
    (OUT / 'nord.project.json').write_text(json.dumps(proj, indent=2) + '\n')
    for name, color in MATERIALS.items():
        (OUT / f'assets/materials/{name}.mat.json').write_text(json.dumps({"color": color, "metallic": 0, "roughness": 0.6}, indent=2) + '\n')
    kids = [part(n, sh, sz, p, m, scale=sc) for n, sh, sz, p, m, sc in PARTS] + [text(*TIME_TEXT), text(*DATE_TEXT)]
    clock = ent('Digital Clock', scripts=[('scripts/DigitalClock.js', {"timeText": "Time Text", "dateText": "Date Text", "use24Hour": True, "blinkColon": True})], children=kids)
    camera = ent('Main Camera', pos=(0, 0, -13), comps=[{"type": "camera", "fov": 60}])
    light = ent('Directional Light', pos=(0, 3, 0), comps=[{"type": "light", "kind": "directional", "intensity": 1, "color": "#ffffff", "direction": [-0.321, -0.766, 0.557]}])
    scene = {"format": 1, "name": "main", "settings": {"ambient": "#8a93a3", "ambientIntensity": 0.6}, "entities": [camera, light, clock]}
    (OUT / 'scenes/main.scene.json').write_text(json.dumps(scene, indent=2) + '\n')
    shutil.copy(SRC / 'DigitalClock.js', OUT / 'scripts/DigitalClock.js')
    html = (ROOT / 'examples/platformer3d/index.html').read_text().replace('3D Platformer', 'Digital Clock')
    (OUT / 'index.html').write_text(html)
    (OUT / 'README.md').write_text('# Digital Clock\n\nExamples page 3.6: a digital clock from primitives with world-space text (the `text` component in a 3D scene). Open it in the Nord editor, press Play.\n'
                                   'Regenerate: `python3 tools/make_digital_clock.py`.\n')


def table():
    fx = lambda v: ('0' if abs(v) < 1e-9 else f'{v:g}'.replace('-', '−'))
    rows = ['| Object | Create ▸ | Position | Scale | Material |', '|---|---|---|---|---|']
    kind = {'box': 'Cube', 'sphere': 'Sphere', 'cylinder': 'Cylinder'}
    for n, sh, sz, p, m, sc in PARTS:
        rows.append(f'| `{n}` | {kind[sh]} | {", ".join(fx(v) for v in p)} | {", ".join(fx(v) for v in sc)} | `{m}` |')
    return '\n'.join(rows)


def docs():
    pg = SRC / 'docs/page.md'
    if not pg.exists():
        return
    t = pg.read_text().replace('@@parts-table@@', table())
    t = re.sub(r'@@code ([^@|]+)\|([^@]+)@@', lambda m: f"**File: `scripts/{m.group(1).strip()}`** ({m.group(2).strip()})\n```js\n{(SRC / m.group(1).strip()).read_text().rstrip()}\n```", t)
    (ROOT / 'docs/manual-src/ex-digital-clock.md').write_text(t)
    (ROOT / 'docs/tutorial-downloads').mkdir(exist_ok=True)
    with zipfile.ZipFile(ROOT / 'docs/tutorial-downloads/digital-clock-source.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.rglob('*')):
            if f.is_file():
                zf.write(f, 'digital-clock/' + f.relative_to(OUT).as_posix())


if __name__ == '__main__':
    build()
    docs()
    print('ok')
