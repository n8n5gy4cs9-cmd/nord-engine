// Two short original arcade jobs. No external game code or network dependencies.
var C=require('./game_constants.js'), Art=require('./tour_art.js');
module.exports={
    start:function(gs,mode){this.gs=gs;this.mode=mode||0;this.phase='ready';this.time=45;this.x=320;this.y=255;this.score=0;this.lives=3;this.flash=0;this.carry=false;this.pickup=0;this.elapsed=0;this.targets=[{x:145,y:135},{x:320,y:108},{x:485,y:150}];this.hazards=[];Audio.playMusic(C.MUSIC.ARCADE,true);},
    update:function(dt){
        dt=Math.min(dt,0.05);
        if(this.phase==='ready'){
            if(Input.getKeyDown('Left')||Input.getKeyDown('Right'))this.mode=1-this.mode;
            if(Input.getKeyDown('Return'))this.phase='playing';
            if(Input.getKeyDown('Escape'))return {done:true,cashWon:0};
            return null;
        }
        if(this.phase==='results')return Input.getKeyDown('Return')?{done:true,cashWon:this.score*20,job:this.mode}:null;
        this.time=Math.max(0,this.time-dt);this.elapsed+=dt;this.flash=Math.max(0,this.flash-dt);
        var dx=(Input.getKey('Right')||Input.getKey('d')?1:0)-(Input.getKey('Left')||Input.getKey('a')?1:0);
        var dy=(Input.getKey('Down')||Input.getKey('s')?1:0)-(Input.getKey('Up')||Input.getKey('w')?1:0);
        var mag=Math.hypot(dx,dy)||1, speed=this.mode?150:(this.carry?115:160);
        this.x=Math.max(65,Math.min(575,this.x+dx/mag*speed*dt));this.y=Math.max(95,Math.min(295,this.y+dy/mag*speed*dt));
        if(this.mode===0){
            if(!this.carry&&Math.hypot(this.x-320,this.y-280)<35){this.carry=true;Audio.play(C.SFX.ITEM_PICKUP,0.3);}
            var target=this.targets[this.score%3];
            if(this.carry&&Math.hypot(this.x-target.x,this.y-target.y)<30){this.carry=false;this.score++;Audio.play(C.SFX.CASH_REGISTER,0.4);}
        } else {
            var target=this.targets[this.score%3];
            if(Math.hypot(this.x-target.x,this.y-target.y)<30){this.score++;Audio.play(C.SFX.ITEM_PICKUP,0.3);}
        }
        // Readable crossing hazards on fixed, predictable lanes; never spawn on the player.
        for(var i=0;i<3;i++){
            var hx=65+((this.elapsed*(65+i*15)+i*190)%510),hy=175+i*43;
            if(!this.god&&this.flash===0&&Math.hypot(this.x-hx,this.y-hy)<23){this.lives--;this.flash=1.5;Audio.play(C.SFX.STUMBLE,0.3);}
        }
        if(this.time<=0||this.lives<=0||this.score>=9)this.phase='results';
        return null;
    },
    draw:function(w,h){
        Art.background(this.mode?3:2,w,h);
        Art.header(this.mode?'HARBOR RESCUE':'BACKSTAGE EXPRESS',this.mode?'WASD / ARROWS · collect the glowing life rings · avoid driftwood':'WASD / ARROWS · collect a case at the bus, take it to the glowing stage',w);
        Art.panel(10,h-37,w-20,29);Art.text(22,h-30,'TIME '+Math.ceil(this.time)+'     DELIVERIES '+this.score+'/9     CHANCES '+this.lives+'     FEE '+(this.score*20)+' FIM',0.7);
        var target=this.targets[this.score%3];
        Draw2D.drawCircle(target.x,target.y,22,1,0.69,0.3,0.7,1);
        Art.sprite(this.mode?15:18,target.x-16,target.y-16,32,32);
        if(!this.mode){Art.sprite(0,275,264,90,40);Art.text(285,307,'PICK UP',0.6);}
        for(var i=0;i<3;i++){
            var hx=65+((this.elapsed*(65+i*15)+i*190)%510),hy=175+i*43;
            Art.sprite(this.mode?7:11,hx-16,hy-16,32,32);
        }
        if(this.flash===0||Math.floor(this.elapsed*10)%2===0)Art.sprite(this.mode?14:9+Math.floor(this.elapsed*8)%2,this.x-20,this.y-26,40,42);
        if(this.carry&&!this.mode)Art.sprite(19,this.x+10,this.y-18,22,22);
        if(this.phase==='ready')Art.results(this.mode?'RESCUE THE SWIMMERS':'THE STAGE NEEDS ITS GEAR',['45 seconds · 20 FIM for each delivery','LEFT / RIGHT · choose the other job','ENTER · start     ESC · leave'],w,h);
        if(this.phase==='results')Art.results('SHIFT COMPLETE',[this.score+' deliveries · '+this.score*20+' FIM','Each job pays once per town.'],w,h);
    }
};
