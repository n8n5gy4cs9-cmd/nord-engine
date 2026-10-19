// One native-pixel art contract shared by the remade activities; no external assets or libraries.
var Art=require('./tour_art.js'),D=Draw2D;
module.exports={
 bg:function(i,w,h,a){if(D.drawRegion)D.drawRegion(0,0,w,h,'assets/sprites/retro_scenes.png',i%2/2,Math.floor(i/2)/2,0.5,0.5,a==null?1:a);},
 object:function(i,x,y,w,h,a){if(D.drawRegion)D.drawRegion(x,y,w,h,'assets/sprites/retro_objects.png',i%4/4,Math.floor(i/4)/3,0.25,1/3,a==null?1:a);},
 rotated:function(i,x,y,w,h,angle){if(D.drawRegionRotated)D.drawRegionRotated(x,y,w,h,'assets/sprites/retro_objects.png',i%4/4,Math.floor(i/4)/3,0.25,1/3,angle);else this.object(i,x,y,w,h);},
 prop:function(i,x,y,w,h,a){if(D.drawRegion)D.drawRegion(x,y,w,h,'assets/sprites/retro_props.png',i%4/4,Math.floor(i/4)/3,0.25,1/3,a==null?1:a);},
 sidebus:function(x,y,w,h){D.drawImage(x,y,w,h,'assets/sprites/retro_sidebus.png',1,1,1,1);},
 performer:function(i,x,y,w,h){if(D.drawRegion)D.drawRegion(x,y,w,h,'assets/sprites/retro_performers.png',i%4/4,Math.floor(i/4)/2,0.25,0.5,1);},
 band:function(i,x,y,w,h,a){if(D.drawRegion)D.drawRegion(x,y,w,h,'assets/sprites/retro_band.png',i%4/4,Math.floor(i/4)/3,0.25,1/3,a==null?1:a);},
 text:Art.text,box:Art.panel,panel:Art.panel,header:Art.header,result:Art.results,
 road:function(scroll,w,h,night){
  this.bg(0,w,h);D.fillRect(204,0,232,h,0.20,0.18,0.25,1);
  for(var y=-24;y<h+24;y+=24){var py=y+scroll%24;D.fillRect(204,py,232,12,0.23,0.21,0.28,1);}
  for(var i=0;i<3;i++)for(var j=0;j<12;j++){
   var x=210+((i*53+j*37)%220),yy=(j*37+scroll)%h;D.fillRect(x,yy,2,1,0.32,0.29,0.36,1);
  }
  D.fillRect(200,0,4,h,0.78,0.62,0.45,1);D.fillRect(436,0,4,h,0.78,0.62,0.45,1);
  for(var l=1;l<3;l++)for(var y=-40;y<h;y+=40)D.fillRect(204+l*232/3-1,y+scroll%40,2,22,0.90,0.79,0.57,1);
  if(night)D.fillRect(0,0,w,h,0.015,0.01,0.06,0.72);
 },
 stars:function(time,w,h){D.fillRect(0,0,w,h,0.025,0.015,0.09,1);for(var i=0;i<80;i++){var x=(i*139+17)%w,y=(i*73+time*(12+i%3*8))%h;D.fillRect(x,y,i%5===0?2:1,2,0.4+i%3*0.2,0.38+i%3*0.2,0.6+i%2*0.3,1);}},
 key:function(k){return Input.getKeyDown(k);},held:function(k){return Input.getKey(k);}
};
