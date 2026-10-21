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

def save(name, cells, size, cols=8, anims=None, opaque=False, names=None, uniform=False, native=None, colors=16, locked=False, register_head=False):
    w,h = native or size
    if register_head:
        # Generated cells put the same head at different coordinates. Register
        # the head, not the whole silhouette (swinging arms/legs change its bbox).
        registered=[]
        for tile in cells:
            tile=tile.copy()
            tile.putalpha(tile.getchannel('A').point(lambda a:255 if a>=128 else 0))
            box=tile.getbbox()
            if not box:
                registered.append(tile);continue
            band_height=max(1,round((box[3]-box[1])*.18))
            head=tile.getchannel('A').crop((0,box[1],tile.width,box[1]+band_height)).getbbox()
            anchor_x=(head[0]+head[2])//2
            canvas=Image.new('RGBA',(tile.width*2,tile.height*2))
            canvas.alpha_composite(tile,(tile.width-anchor_x,tile.height//2-box[1]))
            registered.append(canvas)
        cells=registered
    clean = []
    boxes=[]
    if locked:
        for tile in cells:
            alpha=tile.getchannel('A').point(lambda a:255 if a>=128 else 0)
            if alpha.getbbox(): boxes.append(alpha.getbbox())
    common=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes)) if boxes else None
    for tile in cells:
        tile = tile.copy()
        if not opaque:
            tile.putalpha(tile.getchannel('A').point(lambda a: 255 if a>=128 else 0))
            bbox=common or tile.getbbox()
            tile=tile.crop(bbox) if bbox else Image.new('RGBA',(1,1))
        clean.append(tile)
    ratio=min((w-2)/max(t.width for t in clean),(h-2)/max(t.height for t in clean)) if uniform else None
    sheet=Image.new('RGBA',(cols*size[0],((len(cells)+cols-1)//cols)*size[1]))
    for i,tile in enumerate(clean):
        if opaque:
            tile=tile.resize((w,h),Image.Resampling.NEAREST)
        else:
            scale=ratio or min((w-2)/tile.width,(h-2)/tile.height)
            tile=tile.resize((max(1,round(tile.width*scale)),max(1,round(tile.height*scale))),Image.Resampling.NEAREST)
        alpha=tile.getchannel('A')
        tile=tile.convert('RGB').quantize(colors=colors,method=Image.Quantize.MEDIANCUT).convert('RGBA')
        tile.putalpha(alpha)
        frame=Image.new('RGBA',(w,h))
        frame.alpha_composite(tile,((w-tile.width)//2,h-tile.height if uniform else (h-tile.height)//2))
        if native: frame=frame.resize(size,Image.Resampling.NEAREST)
        sheet.alpha_composite(frame,((i%cols)*size[0],(i//cols)*size[1]))
    sheet.save(OUT/(name+'.png'))
    meta={'type':'spritesheet','frameWidth':size[0],'frameHeight':size[1],'filter':'nearest','anims':anims or {},'tags':['amiga','original','2d']}
    (OUT/(name+'.png.meta.json')).write_text(json.dumps(meta,indent=2)+'\n')
    catalog.append({'id':name,'file':name+'.png','frameWidth':size[0],'frameHeight':size[1],'columns':cols,'frames':len(cells),'names':names or [],'anims':anims or {}})

def anim(start,count=4,fps=7,loop=True):
    return {'frames':list(range(start,start+count)),'fps':fps,'loop':loop}

side=grid('humans-simple',4,4,ys=[0,292,577,839,1145])
for name,row in [('adventurer-run',0),('guard-run',1),('woman-run',2)]:
    cells=side[row*4:row*4+4]
    save(name,cells,(48,64),cols=4,anims={'run':anim(0)},uniform=True,native=(24,32),colors=8,locked=True)
    save(name+'-128x256',cells,(128,256),cols=4,anims={'run':anim(0)},uniform=True,native=(16,32),colors=8,locked=True)
save('adventurer-actions',side[12:16],(64,64),cols=4,names=['idle','crouch','jump','punch'],uniform=True,native=(32,32),colors=8,locked=True)
top=grid('top-simple',4,4)
save('investigator',top,(32,48),cols=4,anims={d:anim(i*4) for i,d in enumerate(['walk-south','walk-east','walk-north','walk-west'])},uniform=True,native=(16,24),colors=8,locked=True,register_head=True)
save('officer-walk-west',top[12:],(32,48),cols=4,anims={'walk-west':anim(0)},uniform=True,native=(16,24),colors=8,locked=True,register_head=True)
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
save('sports-side-actions',side[4:12],(32,48),cols=4,anims={'guard-run':anim(0),'woman-run':anim(4)},uniform=True,native=(16,24),colors=8,locked=True)
save('sports-equipment',sports[24:],(64,64),names='football basketball tennis-ball american-football hockey tennis-racket goal cone'.split())
soccer=grid('soccer-simple',4,4)
# Keep the source pack's canvas, but the player itself is only 8x12 pixels.
# Extra padding is intentional: the old version filled the canvas with a giant human.
soccer_small=[]
for cell in soccer:
    cell.putalpha(cell.getchannel('A').point(lambda a:255 if a>=128 else 0))
    b=cell.getbbox()
    tile=cell.crop(b).resize((8,12),Image.Resampling.NEAREST)
    padded=Image.new('RGBA',(21,31));padded.alpha_composite(tile,(6,10));soccer_small.append(padded)
save('soccer-overhead',soccer_small,(21,31),cols=4,anims={d:anim(i*4,fps=7) for i,d in enumerate(['run-south','run-east','run-north','run-west'])},colors=6,opaque=True)
if (SRC/'sports-tiles.png').exists():
    save('sports-tiles',grid('sports-tiles',8,2,ys=[0,348,768]),(64,64),opaque=True)
# UI source uses irregular column widths in first and last rows.
ui=source('ui')
rects=[]
for y0,y1,xs in [(0,302,[0,194,389,650,842,1016,1190,1360,1536]),(302,513,[0,194,389,650,842,1016,1190,1360,1536]),(513,753,[0,194,389,650,842,1016,1190,1360,1536]),(753,1024,[0,194,389,650,842,1016,1190,1420,1536])]:
    rects += [ui.crop((xs[c]+2,y0+2,xs[c+1]-2,y1-2)) for c in range(8)]
save('ui',rects,(64,64),names='panel slot dialogue tooltip button-normal button-hover button-pressed button-disabled bar-empty bar-red bar-green bar-blue check-off check-on radio-off radio-on up down left right sword shield key medkit joystick-base joystick-knob touch-button dpad cursor crosshair slider-track slider-knob'.split())
racing=grid('racing',ys=[0,230,422,706,1024])
save('racing-cars',grid('cars-simple',4,2),(64,40),cols=4,names=['red-left','red-back','red-right','red-front','white-left','white-back','white-right','white-front'],uniform=True,native=(64,40),colors=8,locked=True)
save('roadside',racing[16:24],(64,96),uniform=True)
save('overhead-vehicles',racing[24:],(64,64),names='red-coupe blue-coupe yellow-coupe van truck police motorcycle ambulance'.split(),uniform=True)
save('backgrounds',grid('backgrounds',2,2),(320,180),cols=2,opaque=True,names=['moor','dock','alpine','fortress'])
(OUT/'catalog.json').write_text(json.dumps({'credit':'Crowelian 2026 + Sonnet','license':'MIT','assets':catalog},indent=2)+'\n')
print(f'Packed {len(catalog)} sheets / {sum(x["frames"] for x in catalog)} cells into {OUT}')
