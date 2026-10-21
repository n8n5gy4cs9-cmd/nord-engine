// Extended from Nord's own Amiga Showcase road/sprite presentation.
import {curve,hill,COURSE} from './track.js';
export function drawView(g,p,cars,others,images,w,h){
 const horizon=h*.36;g.fillStyle='#82bbce';g.fillRect(0,0,w,h);g.fillStyle='#eac48d';g.fillRect(0,horizon*.65,w,h*.2);
 g.fillStyle='#657e86';g.beginPath();g.moveTo(0,horizon);for(let x=0;x<=w;x+=20)g.lineTo(x,horizon-18-Math.sin(x*.02+p.z*.00005)*12);g.lineTo(w,horizon+30);g.lineTo(0,horizon+30);g.fill();
 g.fillStyle='#487650';g.fillRect(0,horizon,w,h-horizon);
 const SEG=200,road=2000,points=[];let x=0,dx=0;
 for(let i=1;i<=180;i++){const z=p.z+i*SEG;dx+=curve(z);x+=dx;const scale=.85/(i*SEG);points.push({z,scale,x:w/2+(x-p.x*road)*scale*w/2,y:horizon+(hill(p.z)+950-hill(z))*scale*h/2,half:road*scale*w/2});}
 const quad=(a,b,ratio,color)=>{g.fillStyle=color;g.beginPath();g.moveTo(a.x-a.half*ratio,a.y);g.lineTo(a.x+a.half*ratio,a.y);g.lineTo(b.x+b.half*ratio,b.y);g.lineTo(b.x-b.half*ratio,b.y);g.closePath();g.fill();};
 for(let i=points.length-2;i>=0;i--){const a=points[i],b=points[i+1];if(b.y>=a.y||b.y>h)continue;const stripe=Math.floor(a.z/1200)%2;quad(a,b,1.08,stripe?'#eee0c4':'#9a4e45');quad(a,b,1,stripe?'#444750':'#4c4e56');if(stripe){for(const lane of [-.33,.33]){const aa={...a,x:a.x+a.half*lane,half:a.half*.014},bb={...b,x:b.x+b.half*lane,half:b.half*.014};quad(aa,bb,1,'#d7d5bb');}}
 }
 const sprite=(image,frame,fw,fh,cols,cx,cy,sw,sh)=>{g.imageSmoothingEnabled=false;g.drawImage(image,(frame%cols)*fw,Math.floor(frame/cols)*fh,fw,fh,Math.round(cx-sw/2),Math.round(cy-sh),Math.round(sw),Math.round(sh));};
 const objects=[];
 for(let i=0;i<32;i++){const z=Math.floor(p.z/1900)*1900+i*1900;objects.push({z,x:i%2?-1.45:1.45,scenery:true,id:i});}
 for(const car of [...cars,...others.filter(o=>o!==p)])if(car.z>p.z+250&&car.z<p.z+35000)objects.push(car);
 objects.sort((a,b)=>b.z-a.z);
 for(const o of objects){const depth=o.z-p.z,index=Math.round(depth/SEG)-1,point=points[index];if(!point||depth<250)continue;const xx=point.x+o.x*point.half,yy=point.y,size=Math.min(w*.4,point.scale*w*260);
  if(o.scenery)sprite(images.roadside,o.id%8,64,96,8,xx,yy,size*1.2,size*1.8);
  else sprite(images.cars,o.index===0?1:5,64,40,4,xx,yy,size,size*.625);
 }
 const carW=Math.min(w*.25,h*.6),frame=(p.index?4:0)+(p.steer<-.15?0:p.steer>.15?2:1);
 sprite(images.cars,frame,64,40,4,w/2,h*.91,carW,carW*.625);
 g.fillStyle='#101a2bdf';g.fillRect(0,0,w,37);g.fillStyle=p.index?'#f4eee2':'#ffae9b';g.font=`bold ${h<250?11:14}px monospace`;g.fillText(`P${p.index+1}  ${Math.round(p.speed/20)} KM/H  TIME ${Math.ceil(p.time)}  ${Math.round(p.z/COURSE.length*100)}%`,8,16);g.fillText(`NITRO ${Math.round(p.nitro*100)}%  CP ${p.checkpoint}/2  HITS ${p.hits}`,8,31);
 if(p.finished||p.lost){g.fillStyle='#081326dd';g.fillRect(w*.12,h*.4,w*.76,60);g.fillStyle='#ffe4a1';g.font='bold 18px monospace';g.fillText(p.finished?`FINISH ${p.elapsed.toFixed(1)}s`:'TIME UP',w*.2,h*.54);}
}
