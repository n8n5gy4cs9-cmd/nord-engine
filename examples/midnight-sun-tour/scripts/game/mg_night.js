// Night Watch: read the reflectors, switch lanes and flash the headlights to reveal wildlife.
var C=require('./game_constants.js'),R=require('./retro.js');
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.lane=1;this.x=320;this.scroll=0;this.obstacles=[];this.spawn=0;this.flash=0;this.hits=0;this.survived=true;this.steer=0;Audio.playMusic(C.MUSIC.NIGHT_DRIVE,true);},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>6){this.phase='playing';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,survived:this.survived}:null;
  this.timer+=dt;this.scroll+=110*dt;this.spawn+=dt;this.flash=Math.max(0,this.flash-dt);this.steer-=dt;
  if(R.key('Space')){this.flash=1.4;Audio.play(C.SFX.HEADLIGHT_ON,0.3);}
  if(this.steer<=0){if(R.held('Left')||R.held('a')||R.key('Left')){this.lane=Math.max(0,this.lane-1);this.steer=0.2;}if(R.held('Right')||R.held('d')||R.key('Right')){this.lane=Math.min(2,this.lane+1);this.steer=0.2;}}
  this.x+=(243.33+77.33*this.lane-this.x)*Math.min(1,dt*14);
  if(this.spawn>1.8){this.spawn=0;this.obstacles.push({x:243.33+Math.floor(Math.random()*3)*77.33,y:48,hit:false});}
  for(var i=0;i<this.obstacles.length;i++){var o=this.obstacles[i];o.y+=98*dt;if(!o.hit&&Math.abs(o.x-this.x)<28&&o.y>248&&o.y<302){o.hit=true;this.hits++;this.gs.bus.condition=Math.max(0,this.gs.bus.condition-7);Audio.play(C.SFX.NIGHT_CRASH,0.4);}}
  this.obstacles=this.obstacles.filter(function(o){return o.y<390;});
  if(this.timer>24||this.gs.bus.condition<=0){this.survived=this.gs.bus.condition>0;this.phase='results';}return null;
 },
 draw:function(w,h){
  R.road(this.scroll,w,h,true);
  // Pixel-stepped headlight pool; it reveals the hazard before collision range.
  for(var j=0;j<12;j++){var yy=95+j*13,wide=105-j*6;Draw2D.fillRect(this.x-wide,yy,wide*2,14,0.8,0.73,0.46,this.flash>0?0.15:0.07);}
  for(var i=0;i<8;i++){var yy=(i*48+this.scroll)%h;Draw2D.fillRect(194,yy,4,6,0.9,0.65,0.3,1);Draw2D.fillRect(442,yy,4,6,0.9,0.65,0.3,1);}
  for(var i=0;i<this.obstacles.length;i++){var o=this.obstacles[i];R.object(1+Math.floor(this.timer*5)%2,o.x-29,o.y-20,58,40,o.hit?0.2:this.flash>0||o.y>175?1:0.25);}
  R.object(0,this.x-25,240,50,82);R.header('NIGHT WATCH','LEFT / RIGHT · steer    SPACE · high beams    Read the roadside reflectors',w);
  R.box(12,82,165,100);R.band(0,20,88,58,58);R.text(82,93,'BUS '+this.gs.bus.condition+'%',0.7);R.text(82,117,'HITS '+this.hits,0.65);R.text(22,154,'KEEP THE LIGHTS UP',0.6);
  R.box(468,82,160,70);R.text(480,95,Math.max(0,Math.ceil(24-this.timer))+' SEC TO DAWN',0.7);R.text(480,122,this.flash>0?'HIGH BEAMS':'DIPPED BEAMS',0.65);
  if(this.phase==='ready')R.result('LAST NIGHT ON THE ROAD',['Follow the amber reflectors through the woods.','Flash SPACE to see the crossing moose early.','ENTER · start the night shift'],w,h);
  if(this.phase==='results')R.result('DAWN BREAKS',[this.hits+' scrapes · bus '+this.gs.bus.condition+'%','The crew spots the first lights of town.'],w,h);
 }
};
