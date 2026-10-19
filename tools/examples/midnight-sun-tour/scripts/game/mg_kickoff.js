// Five-shot roadside football challenge. Aim and beat the moving keeper; timed power rewards skill.
var C=require('./game_constants.js'),Art=require('./tour_art.js');
module.exports={
 start:function(gs){this.gs=gs;this.phase='ready';this.timer=0;this.shots=0;this.scoreA=0;this.aim=320;this.power=0;this.keeper=320;this.ball={x:320,y:275};this.message='';Audio.playMusic(C.MUSIC.KICKOFF,true);},
 update:function(dt){
  dt=Math.min(dt,0.05);
  if(this.phase==='ready'){this.timer+=dt;if(Input.getKeyDown('Return')||this.timer>=6){this.phase='aim';this.timer=0;}return null;}
  if(this.phase==='results')return Input.getKeyDown('Return')?{done:true,cashWon:this.scoreA*30,moraleGain:this.scoreA*2}:null;
  this.timer+=dt;this.keeper=320+Math.sin(this.timer*2.2)*90;
  if(this.phase==='aim'){
   var dir=(Input.getKey('Right')||Input.getKey('d')?1:0)-(Input.getKey('Left')||Input.getKey('a')?1:0);
   this.aim=Math.max(210,Math.min(430,this.aim+dir*160*dt));this.power=(Math.sin(this.timer*3.4)+1)/2;
   if(Input.getKeyDown('Space')||Input.getKeyDown('Return')){
    this.shotX=this.aim;this.saved=Math.abs(this.shotX-this.keeper)<30;this.wide=this.power<0.3||this.power>0.93;
    this.ball={x:320,y:275};this.flight=0;this.phase='flight';Audio.play(C.SFX.KICK_BALL,0.5);
   }
   if(this.timer>12){this.wide=true;this.saved=false;this.flight=0;this.shotX=this.aim;this.phase='flight';}
  } else if(this.phase==='flight'){
   this.flight+=dt;var t=Math.min(1,this.flight/0.65);
   this.ball.x=320+(this.shotX-320)*t;this.ball.y=275-155*t-(this.wide?55:0)*t;
   if(this.flight>=0.85){this.shots++;if(!this.saved&&!this.wide){this.scoreA++;this.message='GOAL!';Audio.play(C.SFX.GOAL_SCORED,0.5);}else{this.message=this.wide?'OVER THE BAR!':'SAVED!';Audio.play(C.SFX.WHISTLE,0.35);}this.phase='feedback';this.feedback=0;}
  } else if(this.phase==='feedback'){
   this.feedback+=dt;if(this.feedback>1.1){this.phase=this.shots>=5?'results':'aim';this.timer=0;this.ball={x:320,y:275};}
  }
  return null;
 },
 draw:function(w,h){
  Art.background(2,w,h,0.45);
  Draw2D.fillRect(110,90,420,225,0.14,0.30,0.22,1);
  for(var i=0;i<9;i++)Draw2D.fillRect(110,90+i*25,420,12,0.22,0.38,0.27,0.6);
  Draw2D.drawRect(135,100,370,205,0.85,0.83,0.64,1,1);
  Draw2D.drawRect(200,90,240,42,0.9,0.9,0.78,1,3);
  for(var x=210;x<440;x+=12)Draw2D.drawLine(x,94,x,130,0.6,0.62,0.56,0.5,1);
  for(var y=100;y<130;y+=8)Draw2D.drawLine(202,y,438,y,0.6,0.62,0.56,0.5,1);
  Art.sprite(11,this.keeper-18,98,36,44);Art.sprite(8,298,251,44,54);
  Draw2D.drawCircle(this.ball.x,this.ball.y,5,1,0.95,0.8,1);
  Draw2D.drawCircle(this.aim,118,9,1,0.72,0.3,1,1);
  Art.header('ROADSIDE SHOOTOUT','LEFT / RIGHT · aim     SPACE · shoot when the power is in the copper zone',w);
  Art.panel(12,150,92,130);Art.text(22,162,'GOALS '+this.scoreA,0.8);Art.text(22,188,'SHOT '+Math.min(5,this.shots+1)+'/5',0.65);
  Art.panel(12,288,w-24,55);Art.text(25,298,'POWER',0.6);
  Draw2D.fillRect(100,300,400,12,0.08,0.05,0.13,1);Draw2D.fillRect(220,300,252,12,0.66,0.35,0.23,1);Draw2D.fillRect(100+400*this.power,295,3,22,1,0.9,0.6,1);
  if(this.phase==='feedback')Art.text(245,210,this.message,1.1);
  if(this.phase==='ready')Art.results('FIVE SHOTS FOR THE TOUR FUND',['Beat the keeper. Watch the power meter.','30 FIM and +2 morale for every goal.','ENTER · kick off'],w,h);
  if(this.phase==='results')Art.results('FULL TIME',[this.scoreA+' goals from five shots','Tour fund +'+this.scoreA*30+' FIM · morale +'+this.scoreA*2],w,h);
 }
};
