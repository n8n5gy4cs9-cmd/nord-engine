// Bus vs Lada: one compact lap with cornering, grass drag and a visible rival.
var C=require('./game_constants.js'),R=require('./retro.js');
function position(angle){return {x:320+220*Math.cos(angle),y:190+92*Math.sin(angle)};}
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.angle=Math.PI/2;this.rival=Math.PI/2-0.12;this.progress=0;this.rivalProgress=0;this.speed=0;this.offset=0;this.playerAhead=false;Audio.playMusic(C.MUSIC.RACE,true);},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>6){this.phase='playing';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,won:this.playerAhead,cashWon:this.playerAhead?120:20}:null;
  this.timer+=dt;
  var steer=(R.held('Right')||R.held('d')?1:0)-(R.held('Left')||R.held('a')?1:0);
  var curve=Math.sin(this.angle*2)*0.7;
  this.offset+=steer*85*dt+curve*this.speed*0.25*dt;
  var gas=R.held('Up')||R.held('w')||R.held('Space');
  this.speed=Math.max(0,Math.min(145,this.speed+(gas?55:-35)*dt));
  if(R.held('Down')||R.held('s'))this.speed=Math.max(0,this.speed-100*dt);
  if(Math.abs(this.offset)>24)this.speed=Math.max(30,this.speed-150*dt);
  this.offset=Math.max(-48,Math.min(48,this.offset));
  var move=this.speed/180*dt;this.angle+=move;this.progress+=move;
  var rm=(0.58+Math.sin(this.timer*0.5)*0.05)*dt;this.rival+=rm;this.rivalProgress+=rm;
  if(this.progress>=Math.PI*4||this.rivalProgress>=Math.PI*4||this.timer>=35){this.playerAhead=this.progress>this.rivalProgress;this.phase='results';}
  return null;
 },
 draw:function(w,h){
  R.bg(3,w,h);
  // Scan-converted asphalt rings avoid seams between rotated line segments.
  for(var y=70;y<=310;y++){
   var dy=y-190,outer=250*Math.sqrt(Math.max(0,1-dy*dy/(120*120))),inner=Math.abs(dy)<65?190*Math.sqrt(1-dy*dy/(65*65)):0;
   var shade=Math.floor(y/10)%2?0.20:0.22;
   if(inner){Draw2D.fillRect(320-outer,y,outer-inner,1,shade,shade-0.03,shade+0.05,1);Draw2D.fillRect(320+inner,y,outer-inner,1,shade,shade-0.03,shade+0.05,1);}
   else Draw2D.fillRect(320-outer,y,outer*2,1,shade,shade-0.03,shade+0.05,1);
  }
  for(var i=0;i<12;i++){var bright=(Math.floor(i/2)+i%2)%2;Draw2D.fillRect(308+i%2*6,255+Math.floor(i/2)*6,6,6,bright?0.9:0.08,bright?0.85:0.06,bright?0.7:0.12,1);}
  var p=position(this.angle),q=position(this.rival);p.x+=Math.cos(this.angle)*this.offset;p.y+=Math.sin(this.angle)*this.offset*0.5;
  R.rotated(6,q.x-16,q.y-25,32,50,Math.atan2(92*Math.cos(this.rival),-220*Math.sin(this.rival))+Math.PI/2);R.rotated(0,p.x-22,p.y-31,44,62,Math.atan2(92*Math.cos(this.angle),-220*Math.sin(this.angle))+Math.PI/2);
  R.header('BUS vs LADA · THE SAUNA CIRCUIT','UP / SPACE · accelerate    LEFT / RIGHT · hold your line    DOWN · brake',w);
  R.box(223,143,194,90);R.band(2,230,151,58,58);R.text(290,153,Math.floor(this.speed)+' KM/H',0.9);R.text(290,178,'LAP '+Math.min(2,1+Math.floor(this.progress/(Math.PI*2)))+'/2',0.7);R.text(236,213,Math.abs(this.offset)>24?'GRASS! GET BACK ON TRACK':'KEEP IT ON THE TARMAC',0.55);
  if(this.phase==='ready')R.result('THE LADA DRIVER LAUGHS',['Two laps around the campsite circuit.','Accelerate, but steer against the corner drift.','ENTER · take the bet'],w,h);
  if(this.phase==='results')R.result(this.playerAhead?'THE BUS WINS!':'THE LADA TAKES IT',[this.playerAhead?'Tour fund +120 FIM':'Consolation prize +20 FIM','Pekka insists the sauna made the difference.'],w,h);
 }
};
