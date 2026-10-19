"""Pack ImageGen sources; redraw code-native UI. Never touches the owner title.
No API calls. Run from repository root: python3 tools/art/midnight/pack.py.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import math
ROOT=Path(__file__).resolve().parents[2]/'examples/midnight-sun-tour/assets/sprites'
source=Image.open(ROOT/'tour_cast_source.png').convert('RGBA')
# Reviewed bounds: generator did not obey equal source cells. Repack to exact cells.
rows=[(0,260,[0,397,567,747,966,1140,1300,1575,1774]),
      (260,503,[0,210,442,689,910,1130,1350,1560,1774]),
      (503,681,[0,200,490,720,951,1130,1330,1588,1774]),
      (681,887,[0,210,430,635,829,1140,1350,1550,1774])]
cells=[]
for y0,y1,xs in rows:
 for a,b in zip(xs,xs[1:]):
  tile=source.crop((a,y0,b,y1)); bbox=tile.getbbox()
  if bbox:tile=tile.crop(bbox)
  cells.append(tile)
atlas=Image.new('RGBA',(2048,1024))
for i,tile in enumerate(cells):
 tile=tile.copy();tile.thumbnail((240,240),Image.Resampling.NEAREST)
 atlas.alpha_composite(tile,((i%8)*256+(256-tile.width)//2,(i//8)*256+256-tile.height))
atlas.save(ROOT/'tour_cast.png')
assets={0:['bus_side','bus_broken','bus_sauna'],1:['bus_front'],2:['bus_player','bus_night','mg_dodge_bus'],3:['lada_red'],4:['tree_pine','mg_dodge_trees'],5:['tree_birch'],6:['mg_dodge_moose','moose_silhouette'],7:['rock_obstacle','mg_dodge_pothole'],8:['band_mikko_sprite'],11:['band_pekka_sprite'],12:['band_risto_sprite'],13:['band_hannele_sprite'],16:['mg_gear_guitar_amp','pack_O_amp'],17:['mg_gear_drum_kit','pack_Z_drums'],18:['mg_gear_pa_speakers','pack_T_speaker'],19:['mg_gear_merch_box','pack_J_merch','pack_L_roadcase'],20:['mg_gear_spare_tire'],21:['mg_gear_beer_crate'],22:['mg_gear_guitar_case','pack_I_guitar_case','pack_S_keyboard'],23:['fuel_pump'],24:['band_mikko_portrait'],25:['band_pekka_portrait'],26:['band_risto_portrait'],27:['band_hannele_portrait'],29:['mg_sound_mixer']}
changed=set()
for i,names in assets.items():
 for name in names:
  p=ROOT/(name+'.png');size=Image.open(p).size
  im=Image.new('RGBA',size);t=cells[i].copy();t.thumbnail(size,Image.Resampling.NEAREST);im.alpha_composite(t,((size[0]-t.width)//2,size[1]-t.height));im.save(p);changed.add(p.name)
events=Image.open(ROOT/'tour_events_source.png')
names=['enc_moose_road','enc_sauna','enc_speed_camera','enc_karaoke_bar','enc_wrong_turn','enc_rainstorm','enc_hitchhiker','enc_roadwork','enc_local_band','enc_broken_bridge','enc_festival_rumour','enc_midsummer','end_legendary','end_great','end_decent','end_disaster']
for i,name in enumerate(names+['end_poor']):
 j=min(i,15);p=ROOT/(name+'.png');size=Image.open(p).size
 events.crop(((j%4)*events.width//4,(j//4)*events.height//4,(j%4+1)*events.width//4,(j//4+1)*events.height//4)).resize(size,Image.Resampling.NEAREST).save(p);changed.add(p.name)
p=ROOT/'map_finland.png';Image.open(ROOT/'tour_map_source.png').resize((640,360),Image.Resampling.NEAREST).save(p);changed.add(p.name)
env=Image.open(ROOT/'tour_environments.png');p=ROOT/'fuel_station_bg.png';env.crop((0,0,env.width//2,env.height//2)).resize(Image.open(p).size,Image.Resampling.NEAREST).save(p);changed.add(p.name)
# Existing UI is code-native; replace its raster exports with the matching copper kit.
for p in sorted(ROOT.glob('*.png')):
 if p.name in changed or p.name.startswith('tour_') or p.name=='MikkoLevon_title.png':continue
 w,h=Image.open(p).size;im=Image.new('RGBA',(w,h),(0,0,0,0));d=ImageDraw.Draw(im)
 if 'fog' in p.stem:
  for y in range(h):d.line((0,y,w,y),fill=(15,8,37,int(100+100*y/max(1,h))))
 elif 'headlight' in p.stem:
  d.polygon([(w//2,h),(0,0),(w,0)],fill=(255,230,161,100))
 elif 'puff' in p.stem or 'thud' in p.stem or 'stars' in p.stem:
  for i in range(7):
   x=int(w/2+math.cos(i*7)*w*.25);y=int(h/2+math.sin(i*7)*h*.25);r=max(1,min(w,h)//7);d.ellipse((x-r,y-r,x+r,y+r),fill=(225,163,126,170))
 elif 'cursor' in p.stem:
  d.polygon([(1,1),(1,h-2),(w//3,h*2//3),(w-2,h//2)],fill='#ffd09b',outline='#24102f')
 elif 'road' in p.stem:
  d.rectangle((0,0,w-1,h-1),fill='#383142');d.line((w//2,0,w//2,h),fill='#c79c77',width=max(1,w//15))
 elif 'water' in p.stem:
  d.rectangle((0,0,w,h),fill='#181b48')
  for y in range(2,h,5):d.line((y%5,y,w,y),fill='#343962')
 elif 'tree' in p.stem or 'forest' in p.stem or 'tundra' in p.stem:
  d.rectangle((0,0,w,h),fill='#263735')
  for x in range(2,w,8):d.polygon([(x,1),(x-4,h-3),(x+4,h-3)],fill='#46614b')
 elif 'city' in p.stem or 'settlement' in p.stem:
  d.rectangle((2,h//3,w-3,h-2),fill='#d59e68',outline='#382039');d.polygon([(0,h//3),(w//2,0),(w,h//3)],fill='#8f4652')
 else:
  d.rectangle((0,0,w-1,h-1),fill='#151020',outline='#a4677c');d.line((1,1,w-2,1),fill='#f0bb81');d.line((1,h-2,w-2,h-2),fill='#46263e')
  if 'grid' in p.stem:
   for x in range(0,w,16):d.line((x,0,x,h),fill='#4b324d')
   for y in range(0,h,16):d.line((0,y,w,y),fill='#4b324d')
  if 'gauge' in p.stem:
   d.arc((2,2,w-3,h*2-4),180,360,fill='#ffd09b',width=2)
  if 'vu' in p.stem or 'bar' in p.stem:
   for y in range(3,h-2,4):d.rectangle((3,y,w-4,y+1),fill='#b5bd87')
 im.save(p);changed.add(p.name)
print('Repacked/redrawn',len(changed),'legacy images; title untouched; exact 32-cell atlas written.')
# Reviewed facility boundaries; transparent padding is trimmed before equal-cell packing.
source=Image.open(ROOT/'tour_facilities_source.png').convert('RGBA')
fac=Image.new('RGBA',(2560,512))
bounds=[0,390,780,1170,1645,2048]
for i in range(5):
 tile=source.crop((round(bounds[i]*source.width/2048),0,round(bounds[i+1]*source.width/2048),source.height))
 tile=tile.crop(tile.getbbox());tile.thumbnail((492,492),Image.Resampling.NEAREST)
 fac.alpha_composite(tile,(i*512+(512-tile.width)//2,512-tile.height))
fac.save(ROOT/'tour_facilities.png')
