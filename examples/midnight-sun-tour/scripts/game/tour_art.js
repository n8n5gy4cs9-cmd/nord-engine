// Shared art and readable copper/steel chrome. Raster sources and prompts: ASSETS.md.
var D = Draw2D;
var colors = [[0.05,0.025,0.12],[0.18,0.09,0.28],[0.72,0.31,0.49],[1,0.72,0.35]];
module.exports = {
    background: function(index,w,h,alpha) {
        if (D.drawRegion) D.drawRegion(0,0,w,h,'assets/sprites/tour_environments.png',index%2/2,Math.floor(index/2)/2,0.5,0.5,alpha == null ? 1 : alpha);
    },
    sprite: function(index,x,y,w,h) {
        var band={8:4,9:8,10:9,11:5,12:6,13:7,24:0,25:1,26:2,27:3};
        if(band[index]!=null){var i=band[index];if(D.drawRegion)D.drawRegion(x,y,w,h,'assets/sprites/retro_band.png',i%4/4,Math.floor(i/4)/3,0.25,1/3,1);return;}
        if (D.drawRegion) D.drawRegion(x,y,w,h,'assets/sprites/tour_cast.png',index%8/8,Math.floor(index/8)/4,1/8,1/4,1);
    },
    facility:function(index,x,y,w,h,a) {
        if(D.drawRegion)D.drawRegion(x,y,w,h,'assets/sprites/tour_facilities.png',index/5,0,1/5,1,a==null?1:a);
    },
    panel: function(x,y,w,h) {
        D.fillRect(x+3,y+3,w,h,0,0,0,0.6);
        D.fillRect(x,y,w,h,0.055,0.035,0.12,0.96);
        D.drawRect(x,y,w,h,0.61,0.35,0.5,1,1);
        D.fillRect(x+1,y+1,w-2,2,0.95,0.63,0.35,1);
    },
    text: function(x,y,t,size) { D.drawText(x,y,t,1,0.85,0.65,1,size || 0.7); },
    header: function(title,sub,w) {
        this.panel(8,6,w-16,46); this.text(20,13,title,0.95);
        D.drawText(20,34,sub,0.75,0.73,0.85,1,0.57);
    },
    results: function(title,lines,w,h,prompt) {
        this.panel(w/2-205,h/2-85,410,170);
        this.text(w/2-185,h/2-67,title,1.1);
        for(var i=0;i<lines.length;i++) this.text(w/2-185,h/2-32+i*23,lines[i],0.72);
        this.text(w/2-185,h/2+57,prompt||'ENTER · continue',0.65);
    }
};
