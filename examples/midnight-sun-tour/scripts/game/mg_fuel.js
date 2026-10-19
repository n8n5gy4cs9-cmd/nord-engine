// Petrol Stop: a large mechanical pump face, visible target band and five short fills.
var C=require('./game_constants.js'),R=require('./retro.js');
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.round=1;this.totalFuel=0;this.perfectCount=0;this.missCount=0;this.marks=[];this.setupRound();Audio.playMusic(C.MUSIC.FUEL,true);},
 setupRound:function(){this.needle=0;this.direction=1;this.target=0.3+Math.random()*0.4;this.zone=0.18-(this.round-1)*0.012;this.speed=0.6+(this.round-1)*0.1;this.resultTimer=0;this.roundResult='';},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(R.key('Return')||this.timer>=6){this.phase='pumping';this.timer=0;}return null;}
  if(this.phase==='results')return R.key('Return')||R.key('Space')?{done:true,totalFuel:this.totalFuel}:null;
  if(this.phase==='round_result'){
   this.resultTimer+=dt;if(this.resultTimer>0.8){this.round++;if(this.round>5)this.phase='results';else{this.setupRound();this.phase='pumping';}}return null;
  }
  this.timer+=dt;this.needle+=this.direction*this.speed*dt;
  if(this.needle>=1){this.needle=1;this.direction=-1;}if(this.needle<=0){this.needle=0;this.direction=1;}
  if(R.key('Space')||R.key('Return')||this.timer>12){
   var dist=Math.abs(this.needle-this.target),good=dist<=this.zone/2,litres=good?Math.round(10+5*(1-dist/(this.zone/2))):4;
   this.totalFuel+=litres;this.perfectCount+=good?1:0;this.missCount+=good?0:1;this.marks.push(good);this.roundResult=(good?'CLEAN FILL!  +':'SPLUTTER...  +')+litres+' L';this.phase='round_result';this.resultTimer=0;this.timer=0;Audio.play(good?C.SFX.FUEL_STOP:C.SFX.FUEL_TICK,0.5);
  }
  return null;
 },
 draw:function(w,h){
  R.bg(1,w,h);R.header('LAST PUMP BEFORE TURKU','SPACE · stop the pump marker inside the amber band     Five fills · no fuel is lost',w);
  // Illustrated forecourt and the actual touring crew.
  R.sidebus(24,193,170,85);R.band(4,180,185,55,82);R.object(7,237,161,49,99);
  Draw2D.drawLine(255,220,231,242,0.035,0.025,0.06,1,3);Draw2D.drawLine(231,242,205,228,0.035,0.025,0.06,1,3);
  R.box(295,78,325,210);R.text(315,91,'PETROL / BENSIINI',1);R.text(315,119,'FILL '+Math.min(5,this.round)+' OF 5',0.68);
  R.box(315,143,285,48);R.text(330,152,('000'+this.totalFuel).slice(-3)+' LITRES',1.2);
  var x=320,y=214,width=275;
  Draw2D.fillRect(x,y,width,24,0.08,0.05,0.13,1);
  Draw2D.fillRect(x+(this.target-this.zone/2)*width,y,this.zone*width,24,0.84,0.54,0.24,1);
  for(var i=0;i<=10;i++)Draw2D.fillRect(x+i*width/10,y+24,1,5,0.75,0.68,0.62,1);
  Draw2D.fillRect(x+this.needle*width-2,y-8,4,40,1,0.9,0.67,1);
  R.text(320,252,this.phase==='round_result'?this.roundResult:'WAIT FOR THE BAND · SPACE',0.7);
  R.box(12,298,w-24,47);R.band(3,20,301,38,38);R.text(70,307,'Hannele: "Steady hands, Mikko. We need every litre."',0.68);
  for(var i=0;i<5;i++)Draw2D.fillRect(525+i*15,325,10,8,i<this.marks.length?(this.marks[i]?0.5:0.8):0.2,i<this.marks.length?0.65:0.15,0.35,1);
  if(this.phase==='ready')R.result('NIGHT-SHIFT PETROL',['Five short fills. Stop in the amber sweet spot.','A wide, readable target. Four litres even on a miss.','ENTER · pick up the nozzle'],w,h);
  if(this.phase==='results')R.result('BACK ON THE ROAD',['Fuel loaded: '+Math.min(this.totalFuel,this.gs.bus.max_gas-this.gs.bus.gas)+' L','Clean fills '+this.perfectCount+'/5 · bus tank '+Math.min(this.gs.bus.max_gas,this.gs.bus.gas+this.totalFuel)+'/'+this.gs.bus.max_gas+' L'],w,h);
 }
};
