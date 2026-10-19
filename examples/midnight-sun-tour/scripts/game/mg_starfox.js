// Tähtialus: an illustrated vertical shooter with a mothership finale, replacing flattened 3D boxes.
var C=require('./game_constants.js'),R=require('./retro.js');
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.x=320;this.y=270;this.shields=100;this.score=0;this.bombs=3;this.invuln=0;this.shots=[];this.bullets=[];this.enemies=[];this.spawn=0;this.cool=0;this.bossHP=35;this.bossX=320;this.bossFire=0;this.allEntities=[];Audio.playMusic(C.MUSIC.STARFOX_1,true);},
 cleanup:function(){this.allEntities=[];},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>6){this.phase='corridor';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,cashWon:Math.floor(this.score/2),score:this.score}:null;
  this.timer+=dt;this.cool-=dt;this.spawn+=dt;this.invuln=Math.max(0,this.invuln-dt);
  var dx=(R.held('Right')||R.held('d')?1:0)-(R.held('Left')||R.held('a')?1:0),dy=(R.held('Down')||R.held('s')?1:0)-(R.held('Up')||R.held('w')?1:0),len=Math.hypot(dx,dy)||1;
  this.x=Math.max(30,Math.min(610,this.x+dx/len*220*dt));this.y=Math.max(100,Math.min(290,this.y+dy/len*220*dt));
  if((R.held('Space')||R.key('Space'))&&this.cool<=0){this.cool=0.16;this.shots.push({x:this.x-7,y:this.y},{x:this.x+7,y:this.y});Audio.play(C.SFX.LASER_SHOOT,0.18);}
  if(R.key('z')&&this.bombs>0){this.bombs--;this.bullets=[];this.enemies=[];this.bossHP-=8;this.score+=75;this.invuln=1.5;Audio.play(C.SFX.ALIEN_BOMB,0.45);}
  if(this.phase==='corridor'&&this.spawn>0.8){this.spawn=0;this.enemies.push({x:80+Math.random()*480,y:55,hp:2,fire:0.7});}
  if(this.timer>=25&&this.phase==='corridor'){this.phase='boss';this.enemies=[];this.bossFire=0;}
  if(this.phase==='boss'){
   this.bossX=320+Math.sin(this.timer*1.4)*170;this.bossFire-=dt;
   if(this.bossFire<=0){this.bossFire=0.65;for(var j=-2;j<=2;j++)this.bullets.push({x:this.bossX,y:138,vx:j*36,vy:110});}
  }
  for(var i=0;i<this.enemies.length;i++){
   var e=this.enemies[i];e.y+=55*dt;e.fire-=dt;if(e.fire<=0){e.fire=1.4;this.bullets.push({x:e.x,y:e.y,vx:0,vy:125});}
   if(Math.hypot(e.x-this.x,e.y-this.y)<28&&this.invuln<=0){this.shields-=12;this.invuln=0.8;e.hp=0;}
  }
  for(var i=0;i<this.shots.length;i++){
   var b=this.shots[i];b.y-=350*dt;
   if(this.phase==='boss'&&b.y<130&&b.y>70&&Math.abs(b.x-this.bossX)<62){this.bossHP--;b.y=-99;this.score+=3;}
   for(var j=0;j<this.enemies.length;j++){var e=this.enemies[j];if(e.hp>0&&Math.hypot(e.x-b.x,e.y-b.y)<23){e.hp--;b.y=-99;if(e.hp<=0){this.score+=30;Audio.play(C.SFX.ALIEN_HIT,0.25);}break;}}
  }
  for(var i=0;i<this.bullets.length;i++){var b=this.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;if(this.invuln<=0&&Math.hypot(b.x-this.x,b.y-this.y)<18){this.shields-=10;this.invuln=0.8;b.y=999;}}
  this.shots=this.shots.filter(function(b){return b.y>50;});this.bullets=this.bullets.filter(function(b){return b.y<340;});this.enemies=this.enemies.filter(function(e){return e.hp>0&&e.y<330;});
  if(this.bossHP<=0){this.score+=500;this.phase='results';}else if(this.shields<=0||this.timer>=55)this.phase='results';return null;
 },
 draw:function(w,h){
  R.stars(this.timer*1.7,w,h);R.header('TÄHTIALUS · MIDNIGHT FLIGHT','ARROWS / WASD · fly    HOLD SPACE · twin lasers    Z · smart bomb',w);
  for(var i=0;i<this.enemies.length;i++){var e=this.enemies[i];R.object(9,e.x-22,e.y-18,44,36);}
  if(this.phase==='boss'){R.object(10,this.bossX-75,63,150,91);Draw2D.fillRect(this.bossX-60,154,120*Math.max(0,this.bossHP)/35,4,0.9,0.35,0.5,1);}
  for(var i=0;i<this.shots.length;i++){var b=this.shots[i];Draw2D.fillRect(b.x-1,b.y,3,9,0.4,0.95,0.8,1);}
  for(var i=0;i<this.bullets.length;i++){var b=this.bullets[i];Draw2D.fillRect(b.x-3,b.y-3,6,6,1,0.55,0.25,1);}
  if(this.invuln===0||Math.floor(this.timer*15)%2===0)R.object(8,this.x-24,this.y-20,48,45);
  R.box(12,316,w-24,30);R.text(24,324,'SHIELDS '+Math.max(0,this.shields)+'%    BOMBS '+this.bombs+'    SCORE '+this.score+'    '+(this.phase==='boss'?'MOTHERSHIP':'PATROL'),0.7);
  if(this.phase==='ready')R.result('TAKE THE NIGHT FLIGHT',['A short patrol, then the mothership.','Move in both axes. Save smart bombs for trouble.','ENTER · launch'],w,h);
  if(this.phase==='results')R.result(this.bossHP<=0?'MOTHERSHIP DOWN!':'FLIGHT COMPLETE',['Score '+this.score+' · tour fund +'+Math.floor(this.score/2)+' FIM','The arcade crowd makes room for Mikko.'],w,h);
 }
};
