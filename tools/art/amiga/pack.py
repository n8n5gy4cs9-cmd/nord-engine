"""Pack original ImageGen masters; python3 tools/art/amiga/pack.py (Pillow).
Reviewed source rectangles are explicit because generated grids are not pixel-exact.
No external images are copied. Sources and prompts remain authoritative.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[3]
SRC = Path(__file__).parent / 'sources'
OUT = ROOT / 'assets/packs/nord-amiga'
OUT.mkdir(parents=True, exist_ok=True)
catalog = []

def source(name):
    return Image.open(SRC / (name + '.png')).convert('RGBA')

def grid(name, cols=8, rows=4, ys=None):
    im = source(name)
    ys = ys or [round(i*im.height/rows) for i in range(rows+1)]
    return [im.crop((round(c*im.width/cols)+2, ys[r]+2,
                    round((c+1)*im.width/cols)-2, ys[r+1]-2))
            for r in range(rows) for c in range(cols)]

def save(name, cells, size, cols=8, anims=None, opaque=False, names=None, uniform=False):
    w,h = size
    clean = []
    for tile in cells:
        tile = tile.copy()
        if not opaque:
            tile.putalpha(tile.getchannel('A').point(lambda a: 255 if a>=128 else 0))
            bbox=tile.getbbox()
            tile=tile.crop(bbox) if bbox else Image.new('RGBA',(1,1))
        clean.append(tile)
    ratio=min((w-2)/max(t.width for t in clean),(h-2)/max(t.height for t in clean)) if uniform else None
    sheet=Image.new('RGBA',(cols*w,((len(cells)+cols-1)//cols)*h))
    for i,tile in enumerate(clean):
        if opaque:
            tile=tile.resize(size,Image.Resampling.NEAREST)
        else:
            scale=ratio or min((w-2)/tile.width,(h-2)/tile.height)
            tile=tile.resize((max(1,round(tile.width*scale)),max(1,round(tile.height*scale))),Image.Resampling.NEAREST)
        alpha=tile.getchannel('A')
        tile=tile.convert('RGB').quantize(colors=32,method=Image.Quantize.MEDIANCUT).convert('RGBA')
        tile.putalpha(alpha)
        frame=Image.new('RGBA',size)
        frame.alpha_composite(tile,((w-tile.width)//2,h-tile.height if uniform else (h-tile.height)//2))
        sheet.alpha_composite(frame,((i%cols)*w,(i//cols)*h))
    sheet.save(OUT/(name+'.png'))
    meta={'type':'spritesheet','frameWidth':w,'frameHeight':h,'filter':'nearest','anims':anims or {},'tags':['amiga','original','2d']}
    (OUT/(name+'.png.meta.json')).write_text(json.dumps(meta,indent=2)+'\n')
    catalog.append({'id':name,'file':name+'.png','frameWidth':w,'frameHeight':h,'columns':cols,'frames':len(cells),'names':names or [],'anims':anims or {}})

def anim(start,count=8,fps=10,loop=True):
    return {'frames':list(range(start,start+count)),'fps':fps,'loop':loop}

side=grid('side-characters')
for name,row in [('adventurer-run',0),('guard-run',2),('woman-run',3)]:
    save(name,side[row*8:row*8+8],(48,64),anims={'run':anim(0)},uniform=True)
    save(name+'-128x256',side[row*8:row*8+8],(128,256),anims={'run':anim(0)},uniform=True)
actions=['idle','crouch','jump-up','jump-down','punch','shoot','hurt','defeated']
save('adventurer-actions',side[8:16],(64,64),names=actions,uniform=True)
top=grid('topdown-characters')
save('investigator',top[:24],(32,48),anims={d:anim(i*8) for i,d in enumerate(['walk-south','walk-east','walk-north'])},uniform=True)
save('officer-walk-west',top[24:],(32,48),anims={'walk-west':anim(0)},uniform=True)
platform_names='grass-left grass-center grass-right dirt rock moss-stone cracked-stone gravel steel-left steel-center steel-right steel-wall grate vent pipes hazard sandstone-left sandstone-center sandstone-right brick masonry timber slate cobble water water-surface lava lava-crust ice snow ladder chain'.split()
tiles=grid('platform-tiles')
for size in [16,70,128]:
    save('platform-tiles-'+str(size),tiles,(size,size),opaque=True,names=platform_names)
world=grid('topdown-world',ys=[0,230,454,712,1024])
save('topdown-tiles',world[:16],(64,64),opaque=True,names='grass dirt cobble asphalt concrete timber stone water brick-wall brick-corner plaster industrial closed-door doorway window stairs'.split())
# The mixed master painted a checker pattern behind its props; use a replacement alpha master.
if (SRC/'props.png').exists():
    save('props',grid('props',4,4,ys=[0,314,624,959,1280]),(64,64),cols=4,names='crate barrel chest medkit locker lamp tree bush red-car blue-car motorcycle bench table chair terminal cone'.split())
sports=grid('sports',ys=[0,280,548,806,1024])
save('sports-side-actions',sports[:16],(32,48),anims={'red-run':anim(0),'blue-run':anim(8)},uniform=True)
save('sports-equipment',sports[24:],(64,64),names='football basketball tennis-ball american-football hockey tennis-racket goal cone'.split())
if (SRC/'soccer-overhead.png').exists():
    soccer=grid('soccer-overhead',ys=[0,390,610,900,1280])
    save('soccer-overhead',soccer,(21,31),anims={d:anim(i*8) for i,d in enumerate(['run-south','run-east','run-north','run-west'])},uniform=True)
if (SRC/'sports-tiles.png').exists():
    save('sports-tiles',grid('sports-tiles',8,2,ys=[0,348,768]),(64,64),opaque=True)
# UI source uses irregular column widths in first and last rows.
ui=source('ui')
rects=[]
for y0,y1,xs in [(0,302,[0,194,389,650,842,1016,1190,1360,1536]),(302,513,[0,194,389,650,842,1016,1190,1360,1536]),(513,753,[0,194,389,650,842,1016,1190,1360,1536]),(753,1024,[0,194,389,650,842,1016,1190,1420,1536])]:
    rects += [ui.crop((xs[c]+2,y0+2,xs[c+1]-2,y1-2)) for c in range(8)]
save('ui',rects,(64,64),names='panel slot dialogue tooltip button-normal button-hover button-pressed button-disabled bar-empty bar-red bar-green bar-blue check-off check-on radio-off radio-on up down left right sword shield key medkit joystick-base joystick-knob touch-button dpad cursor crosshair slider-track slider-knob'.split())
racing=grid('racing',ys=[0,230,422,706,1024])
save('racing-cars',racing[:16],(64,40),anims={'red-steer':anim(0,fps=6),'blue-steer':anim(8,fps=6)},uniform=True)
save('roadside',racing[16:24],(64,96),uniform=True)
save('overhead-vehicles',racing[24:],(64,64),names='red-coupe blue-coupe yellow-coupe van truck police motorcycle ambulance'.split(),uniform=True)
save('backgrounds',grid('backgrounds',2,2),(320,180),cols=2,opaque=True,names=['moor','dock','alpine','fortress'])
(OUT/'catalog.json').write_text(json.dumps({'credit':'Crowelian 2026 + Sonnet','license':'MIT','assets':catalog},indent=2)+'\n')
print(f'Packed {len(catalog)} sheets / {sum(x["frames"] for x in catalog)} cells into {OUT}')
