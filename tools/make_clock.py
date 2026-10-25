#!/usr/bin/env python3
"""Generates examples/clock (Examples page 3.5, "Build a clock": the Unity Basics 'Game Objects and Scripts' exercise ported to Nord)
and the page itself from tools/clock/docs/page.md. All numbers (scales, positions, rotations, hex colours) are the ones of the Unity exercise.
Run: python3 tools/make_clock.py"""
import json, math, pathlib, re, shutil, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/clock'
OUT = ROOT / 'examples/clock'
_n = [0]


def ent(name, pos=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), comps=(), scripts=(), children=(), tags=()):
    _n[0] += 1
    return {"id": f"ck{_n[0]:03d}", "name": name, "enabled": True, "tags": list(tags), "layer": 0,
            "transform": {"pos": list(pos), "rot": list(rot), "scale": list(scale)}, "components": list(comps),
            "scripts": [{"path": p, "attributes": a} for p, a in scripts], "children": list(children), "prefab": None}


def mesh(shape, size):
    return {"type": "mesh", "shape": shape, "size": list(size), "castShadow": True}


def mat(asset=None, color=None):
    return {"type": "material", **({"asset": asset} if asset else {}), **({"color": color} if color else {})}


# --- the numbers of the exercise -------------------------------------------------------------------------------------------------------
INDICATOR_SCALE = (0.5, 1, 0.1)
RADIUS = 4
Z = -0.25
HOURS = []
for h in range(1, 13):
    a = math.radians(30 * h)                      # each hour is 30 degrees clockwise, starting at the top
    x, y = round(RADIUS * math.sin(a), 3), round(RADIUS * math.cos(a), 3)
    rz = -30 * h                                  # Unity's Z rotation is counterclockwise, so clockwise is negative
    rz = ((rz + 90) % 180) - 90                   # a block looks the same turned half a circle: keep the number small, like the exercise
    if h in (3, 9): rz = 90                       # the exercise turns these two a quarter circle
    HOURS.append((h, 0 + x, 0 + y, rz))


def build():
    for sub in ('scenes', 'scripts', 'assets/materials'):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    proj = {"format": 1, "name": "Clock", "id": "com.crowelian.clock", "type": "3d", "engineVersion": "0.1.0", "startScene": "scenes/main.scene.json",
            "display": {"width": 600, "height": 600, "scale": "fit", "pixelArt": False, "background": "#31506e"},
            "physics": {"engine": "none", "gravity": [0, 0, 0]},
            "input": {"actions": {"left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"], "down": ["KeyS", "ArrowDown"]}}}
    (OUT / 'nord.project.json').write_text(json.dumps(proj, indent=2) + '\n')
    for name, color in (('hour-indicator', '#494949'), ('clock-arm', '#000000'), ('seconds-arm', '#B30000')):
        (OUT / f'assets/materials/{name}.mat.json').write_text(json.dumps({"color": color, "metallic": 0, "roughness": 0.5}, indent=2) + '\n')

    face = ent('Face', rot=(90, 0, 0), scale=(10, 0.2, 10), comps=[mesh('cylinder', (1, 2, 1)), mat(color='#ffffff')])
    indicators = [ent(f'Hour Indicator {h}', pos=(x, y, Z), rot=(0, 0, rz), scale=INDICATOR_SCALE,
                      comps=[mesh('box', (1, 1, 1)), mat('assets/materials/hour-indicator.mat.json')]) for h, x, y, rz in HOURS]

    def arm(name, scale, y, z, material):
        return ent(f'{name} Pivot', children=[ent(name, pos=(0, y, z), scale=scale, comps=[mesh('box', (1, 1, 1)), mat(f'assets/materials/{material}.mat.json')])])

    clock = ent('Clock', scripts=[('scripts/Clock.js', {"hoursPivot": "Hours Arm Pivot", "minutesPivot": "Minutes Arm Pivot", "secondsPivot": "Seconds Arm Pivot"})],
                children=[face, *indicators,
                          arm('Hours Arm', (0.3, 2.5, 0.1), 0.75, -0.25, 'clock-arm'),
                          arm('Minutes Arm', (0.2, 4, 0.1), 1, -0.35, 'clock-arm'),
                          arm('Seconds Arm', (0.1, 5, 0.1), 1.25, -0.45, 'seconds-arm')])
    camera = ent('Main Camera', pos=(0, 0, -14), comps=[{"type": "camera", "fov": 60}])
    # Unity's default light turned (50, -30, 0): its direction as a vector
    light = ent('Directional Light', pos=(0, 3, 0), comps=[{"type": "light", "kind": "directional", "intensity": 1, "color": "#ffffff", "direction": [-0.321, -0.766, 0.557]}])
    scene = {"format": 1, "name": "main", "settings": {"ambient": "#8a93a3", "ambientIntensity": 0.6}, "entities": [camera, light, clock]}
    (OUT / 'scenes/main.scene.json').write_text(json.dumps(scene, indent=2) + '\n')
    shutil.copy(SRC / 'Clock.js', OUT / 'scripts/Clock.js')
    html = (ROOT / 'examples/platformer3d/index.html').read_text().replace('3D Platformer', 'Clock')
    (OUT / 'index.html').write_text(html)
    (OUT / 'README.md').write_text('# Clock\n\nExamples page 3.5: the Unity Basics "Game Objects and Scripts" exercise, built from cylinders and cubes. Open it in the Nord editor, press Play.\n'
                                   'Regenerate: `python3 tools/make_clock.py`. Screenshots: `node tools/clock-shots.mjs`.\n')


def table():
    rows = ['| Hour | X | Y | Z | Rotation Z |', '|---|---|---|---|---|']
    for h, x, y, rz in HOURS:
        fx = lambda v: ('0' if abs(v) < 1e-9 else (f'{v:g}'.replace('-', '−')))
        rows.append(f'| {h} | {fx(x)} | {fx(y)} | −0.25 | {fx(rz)} |')
    return '\n'.join(rows)


def docs():
    text = (SRC / 'docs/page.md').read_text()
    text = text.replace('@@hours-table@@', table())

    def code(m):
        spec = m.group(1)
        name, _, note = [x.strip() for x in spec.partition('|')]
        body = (SRC / name).read_text().rstrip()
        return f'**File: `scripts/Clock.js`** ({note})\n```js\n{body}\n```'
    text = re.sub(r'@@code ([^@]+)@@', code, text)
    (ROOT / 'docs/manual-src/ex-clock.md').write_text(text)
    (ROOT / 'docs/tutorial-downloads').mkdir(exist_ok=True)
    with zipfile.ZipFile(ROOT / 'docs/tutorial-downloads/clock-source.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.rglob('*')):
            if f.is_file():
                zf.write(f, 'clock/' + f.relative_to(OUT).as_posix())


if __name__ == '__main__':
    build()
    if (SRC / 'docs/page.md').exists():
        docs()
    print('ok')
