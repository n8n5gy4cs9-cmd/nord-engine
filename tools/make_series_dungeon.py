#!/usr/bin/env python3
"""Generates the six project snapshots of the "Nord Dungeon" tutorial series into examples/series-dungeon/part1..6.
Scripts live in tools/series-dungeon/partN/*.js (what the tutorial prints); this tool only writes project.json, scenes and assets.
Re-run after editing a script:  python3 tools/make_series_dungeon.py"""
import json, os, shutil, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools/series-dungeon'
OUT = ROOT / 'examples/series-dungeon'

def ent(i, name, x, y, z=0, comps=(), scripts=(), tags=()):
    return {"id": f"sd{i:05d}", "name": name, "enabled": True, "tags": list(tags), "layer": 0,
            "transform": {"pos": [x, y, z], "rot": [0, 0, 0], "scale": [1, 1, 1]},
            "components": list(comps), "scripts": [{"path": p, "attributes": a} for p, a in scripts], "children": [], "prefab": None}
sq = lambda w, h, c: {"type": "sprite", "texture": "assets/sprites/square.png", "size": [w, h], "tint": c, "alpha": 1}
body = lambda mode: {"type": "rigidbody", "mode": mode}
box = lambda w, h, trigger=False: {"type": "collider", "shape": "box", "size": [w, h], **({"trigger": True} if trigger else {})}

def project(name, part, w=640, h=360):
    return {"format": 1, "name": name, "id": f"com.crowelian.series-dungeon-{part}", "type": "2d", "engineVersion": "0.1.0",
            "startScene": "scenes/main.scene.json",
            "display": {"width": w, "height": h, "scale": "fit", "pixelArt": False, "background": "#14161c"},
            "physics": {"engine": "arcade", "gravity": [0, 0, 0]},
            "input": {"actions": {"left": ["KeyA", "ArrowLeft"], "right": ["KeyD", "ArrowRight"], "up": ["KeyW", "ArrowUp"],
                                  "down": ["KeyS", "ArrowDown"], "interact": ["KeyE", "Enter"]}}}

def write_part(n, name, entities, prefabs=None):
    d = OUT / f'part{n}'
    (d / 'scenes').mkdir(parents=True, exist_ok=True); (d / 'scripts').mkdir(exist_ok=True); (d / 'assets/sprites').mkdir(parents=True, exist_ok=True)
    (d / 'nord.project.json').write_text(json.dumps(project(name, n), indent=2) + '\n')
    (d / 'scenes/main.scene.json').write_text(json.dumps({"format": 1, "name": "main", "settings": {}, "entities": entities}, indent=2) + '\n')
    if prefabs:
        (d / 'prefabs').mkdir(exist_ok=True)
        for pname, root in prefabs.items(): (d / f'prefabs/{pname}.prefab.json').write_text(json.dumps({'format': 1, 'root': root}, indent=2) + '\n')
    for s in ('square.png', 'circle.png'):
        shutil.copy(ROOT / 'examples/topdown/assets/sprites' / s, d / 'assets/sprites' / s)
    src = SRC / f'part{n}'
    for f in src.glob('*.js'):
        shutil.copy(f, d / 'scripts' / f.name)
    shutil.copy(ROOT / 'examples/topdown/index.html', d / 'index.html')
    (d / 'README.md').write_text(f'# {name}\n\nSnapshot of the Nord Dungeon tutorial series, part {n}. Open this folder in the Nord editor or run `nord serve examples/series-dungeon/part{n}`.\n')

# ---- the dungeon (parts 3-6): 40 x 22 tiles of 32 px ----
W, H = 40, 22
g = [['#'] * W for _ in range(H)]
def room(x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = '.'
def hall(x0, y0, x1, y1):
    room(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
room(2, 2, 9, 7); room(14, 2, 23, 8); room(29, 2, 37, 7); room(2, 12, 11, 19); room(16, 13, 25, 19); room(30, 12, 37, 19)
hall(10, 4, 13, 5); hall(24, 4, 28, 5); hall(5, 8, 6, 11); hall(18, 9, 19, 12); hall(33, 8, 34, 11); hall(12, 15, 15, 16); hall(26, 15, 29, 16)
for x, y in [(6, 5), (7, 5), (18, 5), (19, 5), (20, 5), (33, 4), (34, 4), (6, 15), (7, 15), (20, 16), (21, 16), (34, 15), (35, 15)]: g[y][x] = '#'
def put(ch, x, y): g[y][x] = ch
put('P', 3, 3)
for x, y in [(8, 6), (22, 3), (16, 7), (35, 3), (31, 6), (4, 18), (10, 13), (17, 18), (24, 14), (36, 18), (31, 13), (3, 14)]: put('o', x, y)
for x, y in [(15, 3), (22, 7), (35, 6), (9, 17), (24, 18), (32, 17)]: put('e', x, y)
MAP = [''.join(r) for r in g]
def map_js(keep):
    rows = [''.join(c if c in keep or c == '#' or c == '.' else '.' for c in r) for r in MAP]
    return 'export const MAP = [\n' + ''.join(f"  '{r}',\n" for r in rows) + '];\n'
if __name__ == '__main__':
    camera = lambda z=0: ent(1, 'Camera', 320, 180, 10, [{"type": "camera", "zoom": 1}], [("scripts/follow.js", {})] if z else [])
    # part 1
    write_part(1, 'Nord Dungeon 1: A hero that moves', [
        ent(1, 'Camera', 320, 180, 10, [{"type": "camera", "zoom": 1}]),
        ent(2, 'Floor', 320, 180, -5, [sq(640, 360, '#2e3440')]),
        ent(3, 'Hero', 320, 180, 2, [sq(24, 24, '#88c0d0')], [("scripts/hero.js", {"speed": 160})], ['Hero'])])
    # part 2
    (SRC / 'part2').mkdir(parents=True, exist_ok=True)
    m2 = ['####################', '#P.......#.........#', '#.........#........#', '#....##...#...###..#', '#....##........#...#', '#..........##..#...#',
          '#...###....##......#', '#.....#............#', '#.....#....####....#', '#..................#', '####################']
    assert all(len(r) == 20 for r in m2)
    (SRC / 'part2/map.js').write_text('export const MAP = [\n' + ''.join(f"  '{r}',\n" for r in m2) + '];\n')
    for n, keep in ((3, ''), (4, 'o'), (5, 'oe'), (6, 'oe')):
        (SRC / f'part{n}').mkdir(parents=True, exist_ok=True)
        (SRC / f'part{n}/map.js').write_text(map_js(keep))
    cam = [{"type": "camera", "zoom": 1}]
    sprite = lambda tex, w, h, c: {"type": "sprite", "texture": f"assets/sprites/{tex}.png", "size": [w, h], "tint": c, "alpha": 1}
    floor_pf = ent(1, 'Floor', 0, 0, -5, [sprite('square', 640, 352, '#2e3440')])
    wall_pf = lambda occ=False: ent(1, 'Wall', 0, 0, 1, [sprite('square', 32, 32, '#4c566a'), body('static'), box(32, 32)],
                                    [("scripts/light2d-occluder.js", {"static": True})] if occ else [], ['solid'])
    coin_pf = ent(1, 'Coin', 0, 0, 1, [sprite('circle', 14, 14, '#ebcb8b'), body('static'), box(16, 16, trigger=True)], [("scripts/coin.js", {})], ['coin'])
    enemy_pf = ent(1, 'Enemy', 0, 0, 2, [sprite('square', 22, 22, '#bf616a'), body('dynamic'), box(22, 22)], [("scripts/enemy.js", {})], ['enemy'])
    hero = lambda x, y, attrs, extra=(): ent(3, 'Hero', x, y, 2, [sprite('square', 24, 24, '#88c0d0'), body('dynamic'), box(24, 24)], [("scripts/hero.js", attrs)] + list(extra), ['Hero'])
    gm = lambda lives=3: ent(7, 'GameManager', 0, 0, 0, [], [("scripts/GameManager.js", {"startLives": lives})])
    write_part(2, 'Nord Dungeon 2: Walls', [
        ent(1, 'Camera', 320, 176, 10, cam), ent(2, 'Level', 0, 0, 0, [], [("scripts/level.js", {"tile": 32})]), hero(48, 48, {"speed": 160})],
        {'wall': wall_pf(), 'floor': floor_pf})
    follow = lambda: ent(1, 'Camera', 320, 180, 10, cam, [("scripts/follow.js", {"target": "Hero"})])
    level = lambda: ent(2, 'Level', 0, 0, 0, [], [("scripts/level.js", {"tile": 32})])
    write_part(3, 'Nord Dungeon 3: Camera and a bigger level', [follow(), level(), hero(96, 96, {"speed": 170})], {'wall': wall_pf(), 'floor': floor_pf})
    write_part(4, 'Nord Dungeon 4: Coins and score', [follow(), gm(), level(), ent(4, 'Hud', 0, 0, 0, [], [("scripts/hud.js", {})]), hero(96, 96, {"speed": 170})],
               {'wall': wall_pf(), 'floor': floor_pf, 'coin': coin_pf})
    write_part(5, 'Nord Dungeon 5: Enemies and health', [follow(), gm(), level(), ent(4, 'Hud', 0, 0, 0, [], [("scripts/hud.js", {})]),
               hero(96, 96, {"speed": 170}, [("scripts/health.js", {"grace": 1})])], {'wall': wall_pf(), 'floor': floor_pf, 'coin': coin_pf, 'enemy': enemy_pf})
    write_part(6, 'Nord Dungeon 6: Light and shipping', [follow(), gm(), level(),
        ent(5, 'Light2D', 0, 0, 0, [], [("scripts/light2d.js", {"ambient": "#0a0c12", "scale": 7.5, "shadows": True, "softShadows": 40})]),
        ent(4, 'Hud', 0, 0, 0, [], [("scripts/hud.js", {})]),
        {**hero(96, 96, {"speed": 170}, [("scripts/health.js", {"grace": 1})]), "children": [
            ent(6, 'Lantern', 0, 0, 0, [], [("scripts/light2d-source.js", {"color": "#ffb86b", "radius": 190, "intensity": 0.9, "falloff": 1.4, "softness": 5, "flicker": 0.08})])]}],
        {'wall': wall_pf(True), 'floor': floor_pf, 'coin': coin_pf, 'enemy': enemy_pf})
    # ---- tutorial pages + downloads ----
    import re, zipfile
    names = {49: 'ex-dungeon-1-hero', 50: 'ex-dungeon-2-walls', 51: 'ex-dungeon-3-camera', 52: 'ex-dungeon-4-coins', 53: 'ex-dungeon-5-enemies', 54: 'ex-dungeon-6-light'}
    for t, stem in names.items():
        if not (SRC / f'docs/e{t}.md').exists(): continue
        text = (SRC / f'docs/e{t}.md').read_text()
        text = re.sub(r'@@code (\S+)@@', lambda m: '```js\n' + (SRC / m.group(1)).read_text().rstrip() + '\n```', text)
        (ROOT / f'docs/manual-src/{stem}.md').write_text(text)
    (ROOT / 'docs/tutorial-downloads').mkdir(exist_ok=True)
    for n in range(1, 7):
        z = ROOT / f'docs/tutorial-downloads/series-dungeon-part{n}-source.zip'
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in sorted((OUT / f'part{n}').rglob('*')):
                if f.is_file(): zf.write(f, f'dungeon-part{n}/' + f.relative_to(OUT / f'part{n}').as_posix())
    print('ok')
