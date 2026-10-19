// Phone-booth sprint: fixed, reachable jumps, coyote time, jump buffering and three recoveries.
var C=require('./game_constants.js'), Art=require('./tour_art.js');
module.exports={
    start:function(gs){
        this.gs=gs; this.phase='ready'; this.timer=0; this.distance=0;
        this.playerX=90; this.playerY=254; this.vy=0; this.onGround=true;
        this.coyote=0.1; this.buffer=0; this.invuln=0; this.hearts=3; this.dead=false;
        this.next=360; this.obstacles=[]; this.coins=[]; this.collected=0;
        Audio.playMusic(C.MUSIC.RUNNER,true);
    },
    update:function(dt){
        dt=Math.min(dt,0.05);
        if(this.phase==='ready') {this.timer+=dt;if(Input.getKeyDown('Return')||this.timer>6)this.phase='running';return null;}
        if(this.phase==='results')return Input.getKeyDown('Return')?{done:true,reachedTarget:!this.dead,distance:Math.floor(this.distance)}:null;
        var jump=Input.getKeyDown('Space')||Input.getKeyDown('Up')||Input.getKeyDown('w');
        this.buffer=jump?0.14:Math.max(0,this.buffer-dt);
        this.coyote=this.onGround?0.1:Math.max(0,this.coyote-dt);
        if(this.buffer>0&&this.coyote>0){this.vy=-440;this.onGround=false;this.coyote=0;this.buffer=0;Audio.play(C.SFX.JUMP,0.4);}
        this.vy+=1000*dt; this.playerY+=this.vy*dt;
        if(this.playerY>=254){this.playerY=254;this.vy=0;this.onGround=true;}
        var speed=145+Math.min(45,this.distance/15);
        this.distance+=speed*dt/8; this.timer+=dt; this.invuln=Math.max(0,this.invuln-dt);
        this.next-=speed*dt;
        if(this.next<0){this.obstacles.push({x:670,w:24,h:this.obstacles.length%2?28:38,hit:false});this.coins.push({x:690,y:200,hit:false});this.next=250+(Math.sin(this.timer)*0.5+0.5)*90;}
        for(var i=0;i<this.obstacles.length;i++){
            var o=this.obstacles[i];o.x-=speed*dt;
            if(!o.hit&&this.invuln===0&&o.x<112&&o.x+o.w>90&&this.playerY+36>290-o.h){o.hit=true;this.hearts--;this.invuln=1.2;Audio.play(C.SFX.STUMBLE,0.4);}
        }
        for(var i=0;i<this.coins.length;i++) {var c=this.coins[i];c.x-=speed*dt;if(!c.hit&&Math.abs(c.x-102)<23&&Math.abs(c.y-this.playerY-18)<30){c.hit=true;this.collected++;Audio.play(C.SFX.ITEM_PICKUP,0.3);}}
        this.obstacles=this.obstacles.filter(function(o){return o.x>-50;});
        this.coins=this.coins.filter(function(o){return o.x>-50;});
        if(this.hearts<=0||this.distance>=500){this.dead=this.hearts<=0;this.phase='results';}
        return null;
    },
    draw:function(w,h){
        Art.background(0,w,h);
        Draw2D.fillRect(0,290,w,h-290,0.09,0.07,0.13,1);
        Draw2D.fillRect(0,289,w,3,0.7,0.48,0.34,1);
        for(var i=0;i<40;i++){var x=(i*23-this.distance*8)%w;Draw2D.fillRect(x,307+(i%3)*12,10,2,0.32,0.23,0.29,1);}
        Art.header('PHONE-BOOTH SPRINT','SPACE / UP · jump     Three stumbles allowed · reach 500 m',w);
        for(var i=0;i<this.obstacles.length;i++){var o=this.obstacles[i];Art.sprite(7,o.x,290-o.h,o.w,o.h);}
        for(var i=0;i<this.coins.length;i++){var c=this.coins[i];if(!c.hit)Draw2D.drawCircle(c.x,c.y,6,1,0.72,0.3,1);}
        if(this.invuln>2||this.invuln<=0||Math.floor(this.timer*12)%2===0)Art.sprite(this.onGround?9+Math.floor(this.timer*9)%2:8,80,this.playerY-9,44,48);
        Art.panel(w-180,65,170,50);Art.text(w-168,73,Math.floor(this.distance)+' / 500 m',0.8);Art.text(w-168,94,'CHANCES '+this.hearts+'   PICKS '+this.collected,0.6);
        if(this.phase==='ready')Art.results('THE BUS HAS STOPPED',['Get to the phone booth to call for help.','Jump over rocks. Catch golden picks.','ENTER · start sprint'],w,h);
        if(this.phase==='results')Art.results(this.dead?'TAKE A BREATHER':'PHONE REACHED!',[Math.floor(this.distance)+' metres · '+this.collected+' guitar picks',this.dead?'The crew brings you back to the bus.':'Help is coming. Bus +15 · morale +10'],w,h);
    }
};
