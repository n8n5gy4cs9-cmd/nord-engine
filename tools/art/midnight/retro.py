"""Pack reviewed ImageGen art into native-resolution, nearest-neighbor runtime assets.
Run AFTER pack.py if both are needed. This pass owns retro_* and the band overrides only.
"""
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]/'examples/midnight-sun-tour/assets/sprites'

def native(tile,size):
 tile=tile.convert('RGBA');tile.putalpha(tile.getchannel('A').point(lambda v:255 if v>=128 else 0));box=tile.getbbox()
 if box:tile=tile.crop(box)
 tile.thumbnail(size,Image.Resampling.NEAREST)
 alpha=tile.getchannel('A').point(lambda v:255 if v>=128 else 0)
 rgb=tile.convert('RGB').quantize(colors=64,method=Image.Quantize.MEDIANCUT).convert('RGBA');rgb.putalpha(alpha)
 return rgb

def pack(name,rows,body=False):
 source=Image.open(ROOT/(name+'_source.png')).convert('RGBA');out=Image.new('RGBA',(256,192));frames=[]
 for row,(y0,y1,xs) in enumerate(rows):
  for col,(x0,x1) in enumerate(zip(xs,xs[1:])):
   tile=source.crop((x0,y0,x1,y1));tile=native(tile,(32,48) if body and row else (62,62))
   frame=Image.new('RGBA',(64,64));frame.alpha_composite(tile,((64-tile.width)//2,64-tile.height));out.alpha_composite(frame,(col*64,row*64));frames.append(frame)
 out.save(ROOT/(name+'.png'));return frames

band=pack('retro_band',[(0,344,[0,362,724,1086,1448]),(344,732,[0,362,724,1086,1448]),(732,1086,[0,362,724,1086,1448])],True)
pack('retro_objects',[(0,391,[0,362,724,1086,1448]),(391,745,[0,362,724,1086,1448]),(745,1086,[0,380,686,1156,1448])])
pack('retro_props',[(0,370,[0,350,736,1068,1448]),(370,693,[0,395,702,1055,1448]),(693,1086,[0,462,780,1067,1448])])
source=Image.open(ROOT/'retro_scenes_source.png').convert('RGB');out=Image.new('RGB',(640,360))
for i in range(4):
 tile=source.crop((i%2*836,i//2*941//2,(i%2+1)*836,(i//2+1)*941//2)).resize((320,180),Image.Resampling.NEAREST)
 tile=tile.quantize(colors=64,method=Image.Quantize.MEDIANCUT).convert('RGB');out.paste(tile,(i%2*320,i//2*180))
out.save(ROOT/'retro_scenes.png')
for i,name in enumerate(['mikko','pekka','risto','hannele']):
 for suffix,frame in [('portrait',band[i]),('sprite',band[i+4])]:
  p=ROOT/f'band_{name}_{suffix}.png';size=Image.open(p).size;frame.resize(size,Image.Resampling.NEAREST).save(p)
# A side-view bus is needed at the forecourt; the reviewed existing illustration is packed at 96x48.
source=Image.open(ROOT/'tour_cast_source.png').crop((0,0,397,260));tile=native(source,(94,46));out=Image.new('RGBA',(96,48));out.alpha_composite(tile,((96-tile.width)//2,48-tile.height));out.save(ROOT/'retro_sidebus.png')
print('Packed 36 native-pixel sprite cells, four 320x180 scenes, side bus and eight legacy band overrides.')
source=Image.open(ROOT/'retro_performers_source.png').convert('RGBA');out=Image.new('RGBA',(256,128))
for i in range(8):
 tile=source.crop((i%4*source.width//4,i//4*source.height//2,(i%4+1)*source.width//4,(i//4+1)*source.height//2));tile=native(tile,(60,62))
 out.alpha_composite(tile,(i%4*64+(64-tile.width)//2,i//4*64+64-tile.height))
out.save(ROOT/'retro_performers.png')
