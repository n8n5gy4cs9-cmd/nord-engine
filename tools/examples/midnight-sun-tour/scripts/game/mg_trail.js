// Woodland Shortcut: three illustrated route decisions with explicit costs, no hidden resource scale.
var C=require('./game_constants.js'),R=require('./retro.js');
var stops=[
 {name:'THE OLD FERRY',text:'A little ferry crosses the lake. The bridge is a long detour.',options:['Ferry · 25 FIM','Detour · 8 litres'],kind:9},
 {name:'THE VILLAGE MARKET',text:'Smoked fish and coffee. The band has not eaten since morning.',options:['Buy supper · 20 FIM / food +2','Busk for supper · morale +4'],kind:3},
 {name:'THE PLANK BRIDGE',text:'The planks look tired. So does the old bus.',options:['Cross slowly · bus -3','Pay the farmer · 30 FIM'],kind:10}
];
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.stop=0;this.choice=0;this.message='';Audio.playMusic(C.MUSIC.TRAIL,true);},
 update:function(dt){
  if(this.phase==='ready'){this.timer+=Math.min(dt,0.05);if(R.key('Return')||this.timer>6)this.phase='choose';return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true}:null;
  if(this.phase==='report'){if(R.key('Return')){this.stop++;this.choice=0;this.phase=this.stop>=3?'results':'choose';}return null;}
  if(R.key('Up')||R.key('Down')||R.key('Left')||R.key('Right'))this.choice=1-this.choice;
  if(R.key('Return')||R.key('Space')){
   var gs=this.gs,cost=this.stop===0&&this.choice===0?25:this.stop===1&&this.choice===0?20:this.stop===2&&this.choice===1?30:0;
   if(gs.resources.cash<cost){this.message='Not enough cash. Choose the other route.';return null;}
   if(this.stop===0&&this.choice===1&&gs.bus.gas<8){this.message='Not enough fuel for the detour.';return null;}
   gs.resources.cash-=cost;
   if(this.stop===0&&this.choice===1)gs.bus.gas-=8;
   if(this.stop===1&&this.choice===0)gs.resources.food=Math.min(10,gs.resources.food+2);
   if(this.stop===1&&this.choice===1)gs.resources.morale=Math.min(100,gs.resources.morale+4);
   if(this.stop===2&&this.choice===0)gs.bus.condition=Math.max(1,gs.bus.condition-3);
   this.message='The crew makes it through. '+stops[this.stop].options[this.choice];this.phase='report';Audio.play(C.SFX.UI_CONFIRM,0.4);
  }
  return null;
 },
 draw:function(w,h){
  R.bg(3,w,h);R.header('WOODLAND SHORTCUT','UP / DOWN · choose a route     ENTER · commit     Every cost is shown before you choose',w);
  var points=[[100,190],[320,115],[535,190]];
  Draw2D.drawLine(100,190,320,115,0.8,0.65,0.42,1,5);Draw2D.drawLine(320,115,535,190,0.8,0.65,0.42,1,5);
  for(var i=0;i<3;i++){var p=points[i];Draw2D.drawCircle(p[0],p[1],25,i<=this.stop?0.9:0.3,0.55,0.3,1,2);if(R.prop)R.prop(stops[i].kind,p[0]-35,p[1]-32,70,64);}
  var p=points[Math.min(2,this.stop)];R.band(4,p[0]-15,p[1]+25,38,58);
  R.box(14,247,w-28,98);
  if(this.phase==='report')R.text(28,265,this.message,0.65);
  else if(this.phase!=='results'){
   var stop=stops[Math.min(2,this.stop)];R.text(28,255,stop.name,0.8);R.text(28,278,stop.text,0.61);
   for(var i=0;i<2;i++)R.text(28+i*300,308,(this.choice===i?'> ':'  ')+stop.options[i],0.63);
  }
  if(this.phase==='report')R.text(28,313,'ENTER · continue through the forest',0.65);
  if(this.phase==='ready')R.result('THE SCENIC ROUTE',['Three stops on a lakeside shortcut.','Pay, conserve fuel, or help the band eat.','ENTER · leave the highway'],w,h);
  if(this.phase==='results')R.result('BACK ON THE HIGHWAY',['Cash '+this.gs.resources.cash+' FIM · food '+this.gs.resources.food+'/10','Bus '+this.gs.bus.condition+'% · fuel '+this.gs.bus.gas+' L'],w,h);
 }
};
