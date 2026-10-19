// Four Stakes: stop each knot at its tension mark to pitch the camp before the rain.
var C=require('./game_constants.js'),R=require('./retro.js');
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.stake=0;this.needle=0;this.dir=1;this.tentProgress=0;this.scores=[];this.flash=0;Audio.playMusic(C.MUSIC.TENT,true);},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>6){this.phase='pitching';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,restBonus:Math.round(this.tentProgress*30)}:null;
  if(this.flash>0){this.flash-=dt;if(this.flash<=0){this.stake++;this.needle=0;this.dir=1;if(this.stake>=4)this.phase='results';}return null;}
  this.timer+=dt;this.needle+=this.dir*dt*(0.75+this.stake*0.15);if(this.needle>=1){this.needle=1;this.dir=-1;}if(this.needle<=0){this.needle=0;this.dir=1;}
  if(R.key('Space')||R.key('Return')||this.timer>10){var quality=Math.max(0,1-Math.abs(this.needle-0.65)/0.45);this.scores.push(quality);this.tentProgress=this.scores.reduce(function(a,b){return a+b;},0)/4;this.flash=0.7;this.timer=0;Audio.play(C.SFX.TENT_SNAP,0.45);}
  return null;
 },
 draw:function(w,h){
  R.bg(3,w,h);if(R.prop)R.prop(7,210,100,225,150,0.7+this.tentProgress*0.3);R.band(4,130,160,60,90);R.band(7,455,160,60,90);
  for(var i=0;i<4;i++){var x=220+i%2*200,y=175+Math.floor(i/2)*65;Draw2D.drawLine(x,y,x+(i%2?-18:18),y-14,0.8,0.64,0.4,1,2);Draw2D.fillRect(x-3,y,6,12,i<this.scores.length?0.8:0.35,0.55,0.3,1);}
  R.header('FOUR STAKES BEFORE THE RAIN','SPACE · pull the guy rope when the marker reaches the copper band',w);
  R.box(70,258,500,85);R.text(88,268,'STAKE '+Math.min(4,this.stake+1)+'/4     TENT QUALITY '+Math.round(this.tentProgress*100)+'%',0.7);
  Draw2D.fillRect(90,300,460,14,0.07,0.04,0.12,1);Draw2D.fillRect(90+0.55*460,300,0.2*460,14,0.75,0.48,0.2,1);Draw2D.fillRect(90+this.needle*460-2,294,4,26,1,0.9,0.65,1);
  if(this.phase==='ready')R.result('MAKE CAMP',['Four stakes. Four well-timed pulls.','Better tension means better sleep for the crew.','ENTER · unpack the tent'],w,h);
  if(this.phase==='results')R.result('CAMP IS READY',['Tent quality '+Math.round(this.tentProgress*100)+'%','Rest bonus '+Math.round(this.tentProgress*30)+' · the crew can finally sleep.'],w,h);
 }
};
