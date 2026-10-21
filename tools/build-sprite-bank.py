#!/usr/bin/env python3
"""Bundle owner-supplied CC0 PNGs unchanged and index Nord's original Amiga sheets.
No art is generated or altered. Rebuild requires TEMP/ART; shipped bank does not.
"""
from pathlib import Path
import json, shutil, hashlib, re
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/packs/level2d-kenney'
entries = []
def entry(id, title, source, category, pack, frame=0, fw=None, fh=None, columns=1, anims=None):
    w,h = Image.open(ROOT/source).size
    entries.append(dict(id=id, title=title, source=source, category=category, pack=pack,
        width=fw or w, height=fh or h, columns=columns, frame=frame, anims=anims or {},
        sha256=hashlib.sha256((ROOT/source).read_bytes()).hexdigest()))
for a in json.loads((ROOT/'assets/packs/nord-amiga/catalog.json').read_text())['assets']:
    source = 'assets/packs/nord-amiga/'+a['file']
    cat = 'Characters' if a['anims'] else ('Terrain' if 'tiles' in a['id'] else 'Backgrounds' if a['id']=='backgrounds' else 'Props')
    frames = [0] if a['anims'] else range(a['frames'])
    for f in frames:
        name = a['names'][f] if f < len(a['names']) else str(f+1)
        entry('amiga-'+a['id']+('-'+str(f) if not a['anims'] else ''), a['id'].replace('-',' ').title()+(' · '+name if not a['anims'] else ''),source,cat,'Nord Amiga',f,a['frameWidth'],a['frameHeight'],a['columns'],a['anims'])
packs = [
 ('kenney_platformer-pack-remastered','Platformer','PNG/Tiles','Terrain'),
 ('kenney_platformer-pack-remastered','Platformer','PNG/Items','Pickups'),
 ('kenney_platformer-pack-remastered','Platformer','PNG/Enemies','Enemies'),
 ('kenney_platformer-pack-remastered','Platformer','PNG/Players/128x256/Blue','Characters'),
 ('kenney_tiny-dungeon','Tiny Dungeon','Tiles','Dungeon'),
 ('kenney_top-down-shooter','Top-down Shooter','PNG','Top-down'),
 ('kenney_platformer-pack-industrial','Industrial','PNG','Terrain'),
 ('kenney_sports-pack','Sports','PNG','Sports'),
]
for folder, pack, sub, cat in packs:
    src = ROOT/'TEMP/ART'/folder
    if not (src/'License.txt').exists() or 'CC0' not in (src/'License.txt').read_text():
        raise RuntimeError('Missing CC0 licence: '+folder)
    target = OUT/folder
    target.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src/'License.txt',target/'LICENSE.md')
    for p in sorted((src/sub).rglob('*.png')):
        if '@2' in p.name or '2X' in p.name: continue
        rel = p.relative_to(src)
        dst = target/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(p,dst)
        Path(str(dst)+".meta.json").write_text(json.dumps({"type":"image","filter":"nearest"})+"\n")
        id = re.sub(r'[^a-z0-9]+','-',str(Path(folder)/rel.with_suffix('')).lower()).strip('-')
        entry(id,p.stem.replace('_',' '),str(dst.relative_to(ROOT)),cat,pack)
manifest = dict(format='nord-sprite-bank/1',credit='Crowelian 2026 + Sonnet; Kenney (CC0)',entries=entries)
(ROOT/'editor/level2d/bank.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'{len(entries)} bank entries; {len(set(e["source"] for e in entries))} images')
