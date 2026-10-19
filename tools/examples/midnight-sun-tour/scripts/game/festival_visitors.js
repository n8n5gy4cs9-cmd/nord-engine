// Small purpose-built visitor simulation: connected footpaths, needs, fair queues and paid services.
// Each visible visitor represents a share of the gate count; no external AI framework.
var nodes=[[320,236],[320,207],[200,207],[85,170],[320,170],[440,207],[550,170],[70,153],[188,195],[306,153],[424,195],[542,153]];
var edges=[[1],[0,2,4,5],[1,3,4,8],[2,4,7],[1,2,3,5,6,9],[1,4,6,10],[4,5,11],[3],[2],[4],[5],[6]];
var places=['food','toilets','merch','stage','camp'];
var colors=[[0.75,0.25,0.34],[0.2,0.46,0.65],[0.65,0.5,0.27],[0.3,0.6,0.43],[0.65,0.34,0.7],[0.8,0.6,0.5],[0.28,0.27,0.4],[0.85,0.75,0.35]];
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function route(from,to){
 var todo=[from],previous={};previous[from]=-1;
 for(var i=0;i<todo.length;i++){
  var n=todo[i];if(n===to)break;
  for(var j=0;j<edges[n].length;j++){var next=edges[n][j];if(previous[next]===undefined){previous[next]=n;todo.push(next);}}
 }
 var path=[],p=to;while(p!==from&&p!==-1){path.unshift(p);p=previous[p];}return path;
}
function goal(s,a,index){a.target=index;a.path=route(a.node,7+index);a.phase='walking';a.wait=0;}
function next(s,a){
 // People alternate a set with food, toilets, browsing merch or the campsite.
 a.visits++;
 var interest=a.visits%2===0?3:Math.floor(random(s)*5);
 goal(s,a,interest);
}
module.exports={
 create:function(count,seed){return {seed:seed||1991,target:Math.min(60,Math.max(0,Math.ceil(count))),weight:count/Math.max(1,Math.min(60,Math.ceil(count))),agents:[],spawn:0,clock:0,served:0,lost:0,waitTotal:0,income:0,exited:0,closing:false};},
 update:function(s,dt,facilities,live){
  if(!s)return;dt=Math.min(dt,0.1);s.clock+=dt;s.spawn+=dt;
  while(s.agents.length<s.target&&s.spawn>=0.5){
   s.spawn-=0.5;var id=s.agents.length;
   var a={id:id,x:320+(id%3-1)*4,y:236,node:0,path:[],phase:'walking',target:3,timer:0,wait:0,visits:0,speed:24+random(s)*12,hair:random(s),skin:0.65+random(s)*0.3};
   goal(s,a,id%4===0?Math.floor(random(s)*5):3);s.agents.push(a);
  }
  var busy=[0,0,0,0,0];
  s.agents.forEach(function(a){if(a.phase==='service')busy[a.target]++;});
  for(var i=0;i<s.agents.length;i++){
   var a=s.agents[i];
   if(a.phase==='gone')continue;
   if(a.phase==='walking'||a.phase==='leaving'){
    if(a.path.length){
     var n=a.path[0],p=nodes[n],dx=p[0]-a.x,dy=p[1]-a.y,d=Math.hypot(dx,dy),step=a.speed*dt;
     if(d<=step){a.x=p[0];a.y=p[1];a.node=n;a.path.shift();}
     else{a.x+=dx/d*step;a.y+=dy/d*step;}
    }else if(a.phase==='leaving'){a.phase='gone';s.exited++;}
    else {a.phase=a.target===3?'watching':'queue';a.timer=7+random(s)*8;}
   }else if(a.phase==='queue'){
    a.wait+=dt;
    var lv=facilities[places[a.target]],slots=lv+1;
    // FIFO: an earlier arrival at this counter has priority.
    var ahead=s.agents.some(function(b){return b!==a&&b.phase==='queue'&&b.target===a.target&&(b.wait>a.wait+dt||Math.abs(b.wait-a.wait)<dt&&b.id<a.id);});
    if(lv>0&&busy[a.target]<slots&&!ahead){a.phase='service';a.timer=a.target===1?3.5:2;busy[a.target]++;s.waitTotal+=a.wait;}
    else if(a.wait>8){s.lost++;a.phase='watching';a.timer=3;}
   }else if(a.phase==='service'){
    a.timer-=dt;
    if(a.timer<=0){
     var lv=facilities[places[a.target]],fee=a.target===0?3:a.target===2?4:a.target===4?2:0;
     if(live)s.income+=fee*lv*s.weight;
     s.served++;a.phase='watching';a.timer=5+random(s)*5;
    }
   }else if(a.phase==='watching'){
    a.timer-=dt;
    if(a.timer<=0){
     if(s.closing){a.phase='leaving';a.path=route(a.node,0);}
     else next(s,a);
    }
   }
  }
 },
 draw:function(s){
  if(!s)return;
  // Footpath network beneath customers.
  for(var i=0;i<edges.length;i++)for(var j=0;j<edges[i].length;j++){
   var k=edges[i][j];if(k<i)continue;
   Draw2D.drawLine(nodes[i][0],nodes[i][1],nodes[k][0],nodes[k][1],0.76,0.61,0.45,0.28,5);
  }
  var order=s.agents.filter(function(a){return a.phase!=='gone';}).sort(function(a,b){return a.y-b.y;});
  for(var i=0;i<order.length;i++){
   var a=order[i],x=a.x+(a.id%3-1)*2,y=a.y+(a.id%2)*2;
   if(a.phase==='queue'||a.phase==='service'||a.phase==='watching'){
    x+=(a.id%5-2)*5;y+=Math.floor(a.id%15/5)*5;
   }
   var step=a.phase==='walking'||a.phase==='leaving'?Math.sin(s.clock*9+a.id)*2:0,c=colors[a.id%colors.length];
   Draw2D.drawCircle(x,y+1,3,0,0,0,0.3);
   Draw2D.fillRect(x-2,y-8,4,5,c[0],c[1],c[2],1);
   Draw2D.fillRect(x-2,y-12,4,4,a.skin,a.skin*0.76,a.skin*0.61,1);
   Draw2D.fillRect(x-2,y-13,4,2,a.hair*0.5+0.08,a.hair*0.3+0.05,0.12,1);
   Draw2D.fillRect(x-2,y-3,1.5,4+step,0.12,0.10,0.20,1);
   Draw2D.fillRect(x+0.5,y-3,1.5,4-step,0.12,0.10,0.20,1);
   if(a.phase==='queue')Draw2D.drawCircle(x,y-16,1.5,1,0.7,0.25,1);
   if(a.phase==='service')Draw2D.drawCircle(x,y-16,1.5,0.4,0.9,0.5,1);
  }
 },
 satisfaction:function(s){if(!s)return 0;return Math.max(-12,Math.min(8,Math.round((s.served-s.lost)*0.25)));},
 nodes:nodes,edges:edges
};
