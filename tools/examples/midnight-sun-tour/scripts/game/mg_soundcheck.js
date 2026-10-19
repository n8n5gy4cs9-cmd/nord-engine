// Four-channel line check: visible targets, hardware faders, individual band feedback.
var C=require('./game_constants.js'),R=require('./retro.js');
var names=['MIKKO / VOCAL','PEKKA / GUITAR','RISTO / BASS','HANNELE / DRUMS'];
module.exports={
 start:function(gs,city){this.gs=gs;this.city=city;this.phase='ready';this.timer=0;this.channel=0;this.sliders=[30,35,40,45];this.targets=[65,55,70,60].map(function(v){return v+Math.floor(Math.random()*15)-7;});this.bonus=1;this.quality=0;Audio.playMusic(C.MUSIC.SOUNDCHECK,true);},
 calculateResults:function(){var error=0;for(var i=0;i<4;i++)error+=Math.abs(this.sliders[i]-this.targets[i]);this.quality=Math.max(0,Math.round(100-error/2));this.bonus=Math.round((0.8+this.quality*0.005)*100)/100;},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>6){this.phase='mixing';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,bonus:this.bonus,city:this.city}:null;
  this.timer+=dt;
  if(R.key('Left')||R.key('a'))this.channel=(this.channel+3)%4;if(R.key('Right')||R.key('d'))this.channel=(this.channel+1)%4;
  for(var i=0;i<4;i++)if(R.key(''+(i+1)))this.channel=i;
  var dir=(R.held('Up')||R.held('w')?1:0)-(R.held('Down')||R.held('s')?1:0);
  this.sliders[this.channel]=Math.max(0,Math.min(100,this.sliders[this.channel]+dir*40*dt));
  if(this.timer>=24||R.key('Return')){this.calculateResults();this.phase='results';}return null;
 },
 draw:function(w,h){
  R.bg(2,w,h);R.header('LINE CHECK · FOUR TIRED MUSICIANS','LEFT / RIGHT or 1–4 · channel    UP / DOWN · fader    ENTER · lock the mix',w);
  if(R.prop)R.prop(8,35,122,570,180,0.5);
  for(var i=0;i<4;i++){
   var x=36+i*145,selected=this.channel===i,top=157,height=103;
   R.box(x,64,133,226);R.band(i,x+6,69,60,60);R.text(x+70,78,''+(i+1),1.1);R.text(x+69,106,'SET '+this.targets[i],0.58);R.text(x+8,133,names[i],0.53);
   Draw2D.fillRect(x+62,top,7,height,0.025,0.015,0.06,1);
   var ty=top+height*(1-this.targets[i]/100),sy=top+height*(1-this.sliders[i]/100);
   Draw2D.fillRect(x+44,ty-5,42,10,0.7,0.48,0.25,0.9);Draw2D.fillRect(x+49,sy-4,31,8,selected?1:0.5,0.78,0.59,1);
   var good=Math.abs(this.sliders[i]-this.targets[i])<5;R.text(x+10,272,good?'SWEET SPOT':Math.round(this.sliders[i])+' / '+this.targets[i],0.65);
   if(selected)Draw2D.drawRect(x-1,63,135,228,1,0.65,0.35,1,2);
  }
  R.box(12,291,w-24,13);R.text(24,291,'TIME '+Math.max(0,Math.ceil(24-this.timer))+'s     Keep every fader inside its copper target band.',0.53);
  if(this.phase==='ready')R.result('CAN YOU HEAR ME?',['Match all four channels to their marked levels.','No guessing. No hidden targets.','ENTER · start the line check'],w,h);
  if(this.phase==='results')R.result('THE MIX IS LOCKED',['Sound quality '+this.quality+'% · gig multiplier '+this.bonus+'x','ENTER starts the roadside gig.'],w,h);
 }
};
