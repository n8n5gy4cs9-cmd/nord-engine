// Midnight Moose Run: visible overhead bus, animated wildlife and guaranteed open lanes.
var C=require('./game_constants.js'),R=require('./retro.js');
module.exports={
 start:function(gs,route){this.gs=gs;this.route=route||{};this.phase='ready';this.timer=0;this.lane=1;this.busX=320;this.obstacles=[];this.spawnTimer=0;this.scrollY=0;this.damageTaken=0;this.hits=0;this.dodged=0;this.invincible=0;this.steer=0;this.pattern=0;Audio.playMusic(C.MUSIC.MOOSE_DODGE,true);},
 spawnObstacle:function(){
  var safe=Math.floor(Math.random()*3),lanes=this.pattern++%3===2?[(safe+1)%3,(safe+2)%3]:[(safe+1)%3];
  for(var i=0;i<lanes.length;i++)this.obstacles.push({lane:lanes[i],y:54,type:(this.pattern+i)%3===0?'pothole':'moose',hit:false,counted:false});
 },
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>=6){this.phase='playing';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,arrivedCity:this.gs.journey.current_city}:null;
  this.timer+=dt;this.scrollY+=130*dt;this.spawnTimer+=dt;this.steer-=dt;this.invincible=Math.max(0,this.invincible-dt);
  if(this.steer<=0){
   if(R.key('Left')||R.key('a')||R.held('Left')||R.held('a')){this.lane=Math.max(0,this.lane-1);this.steer=0.2;}
   if(R.key('Right')||R.key('d')||R.held('Right')||R.held('d')){this.lane=Math.min(2,this.lane+1);this.steer=0.2;}
  }
  this.busX+=(243.33+this.lane*77.33-this.busX)*Math.min(1,dt*16);
  if(this.spawnTimer>=1.5){this.spawnTimer-=1.5;this.spawnObstacle();}
  for(var i=0;i<this.obstacles.length;i++){
   var o=this.obstacles[i];o.y+=105*dt;
   if(!o.hit&&this.invincible<=0&&Math.abs(243.33+o.lane*77.33-this.busX)<30&&o.y>238&&o.y<310){
    o.hit=true;this.hits++;var damage=o.type==='moose'?12:5;this.damageTaken+=damage;this.gs.bus.condition=Math.max(0,this.gs.bus.condition-damage);this.invincible=1;Audio.play(o.type==='moose'?C.SFX.MOOSE_GRUNT:C.SFX.POTHOLE,0.45);
   }
   if(o.y>330&&!o.hit&&!o.counted){o.counted=true;this.dodged++;}
  }
  this.obstacles=this.obstacles.filter(function(o){return o.y<390;});
  if(this.timer>=20||this.gs.bus.condition<=0)this.phase='results';return null;
 },
 draw:function(w,h){
  R.road(this.scrollY,w,h,false);
  for(var i=0;i<this.obstacles.length;i++){
   var o=this.obstacles[i],x=243.33+o.lane*77.33;
   R.object(o.type==='pothole'?3:1+Math.floor(this.timer*5)%2,x-30,o.y-22,60,44,o.hit?0.35:1);
  }
  R.object(0,this.busX-25,238,50,82,this.invincible>0&&Math.floor(this.timer*12)%2?0.5:1);
  R.header('MIDNIGHT MOOSE RUN','LEFT / RIGHT or A / D · steer     Keep the rusty bus in the clear lane',w);
  R.box(10,76,165,105);R.band(0,18,84,58,58);R.text(82,91,'BUS '+this.gs.bus.condition+'%',0.7);R.text(82,115,'HITS '+this.hits,0.65);R.text(22,151,'MOOSE CROSSING',0.64);
  R.box(465,76,165,85);R.text(478,89,Math.max(0,Math.ceil(20-this.timer))+' SEC TO SAFETY',0.72);R.text(478,115,'DODGED '+this.dodged,0.7);R.text(478,139,'ONE LANE STAYS OPEN',0.53);
  if(this.phase==='ready')R.result('MOOSE ON THE ROAD!',['Twenty seconds through the Finnish forest.','Watch the antlers. Avoid the cracked asphalt.','ENTER · start driving'],w,h);
  if(this.phase==='results')R.result('ROAD CLEAR',[this.dodged+' avoided · '+this.hits+' collisions','Bus damage '+this.damageTaken+'% · condition '+this.gs.bus.condition+'%'],w,h);
 }
};
