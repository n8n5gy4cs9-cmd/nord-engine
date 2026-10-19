var R=require("./retro.js");
// ============================================================================
// GEAR PACK MINIGAME — extracted from midnight_sun.js §11f
// Tetris-style spatial packing: fit gear into the 8x5 bus cargo grid.
// Usage: var GearPack = require("./mg_gearpack.js");
// ============================================================================

var C = require("./game_constants.js");
var SFX = C.SFX;
var MUSIC = C.MUSIC;

var GP_COLS = 8;
var GP_ROWS = 5;
var GP_TIME_LIMIT = 90;

var GearPackSystem = {
    phase: "packing",
    timer: 0,
    cursorX: 0,
    cursorY: 0,
    selected: 0,
    flashTimer: 0,
    flashText: "",
    grid: [],
    pieces: [],
    gs: null,
    gearData: null,

    start: function(gameState, gearData) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.TITLE, true);
        this.gearData = gearData;
        this.phase = "packing";
        this.timer = 0;
        this.cursorX = 0;
        this.cursorY = 0;
        this.selected = 0;
        this.flashTimer = 0;
        this.flashText = "";

        this.grid = [];
        for (var r = 0; r < GP_ROWS; r++) {
            this.grid[r] = [];
            for (var c = 0; c < GP_COLS; c++) {
                this.grid[r][c] = 0;
            }
        }

        this.pieces = [];
        for (var i = 0; i < gearData.length; i++) {
            var g = gearData[i];
            this.pieces.push({
                id: g.id, name: g.name,
                w: g.size[0], h: g.size[1],
                mandatory: g.mandatory,
                placed: false, gridX: -1, gridY: -1
            });
        }
        console.log("[GearPack] Started — " + this.pieces.length + " items to pack in " + GP_COLS + "x" + GP_ROWS + " grid");
    },

    canPlace: function(piece, gx, gy) {
        if (gx < 0 || gy < 0 || gx + piece.w > GP_COLS || gy + piece.h > GP_ROWS) return false;
        for (var r = gy; r < gy + piece.h; r++) {
            for (var c = gx; c < gx + piece.w; c++) {
                if (this.grid[r][c] !== 0) return false;
            }
        }
        return true;
    },

    placePiece: function(piece, gx, gy) {
        for (var r = gy; r < gy + piece.h; r++) {
            for (var c = gx; c < gx + piece.w; c++) {
                this.grid[r][c] = piece.id;
            }
        }
        piece.placed = true;
        piece.gridX = gx;
        piece.gridY = gy;
    },

    removePiece: function(piece) {
        if (!piece.placed) return;
        for (var r = piece.gridY; r < piece.gridY + piece.h; r++) {
            for (var c = piece.gridX; c < piece.gridX + piece.w; c++) {
                if (this.grid[r][c] === piece.id) this.grid[r][c] = 0;
            }
        }
        piece.placed = false;
        piece.gridX = -1;
        piece.gridY = -1;
    },

    rotatePiece: function(piece) {
        if (piece.placed) return;
        var tmp = piece.w;
        piece.w = piece.h;
        piece.h = tmp;
    },

    flash: function(text) {
        this.flashTimer = 1.0;
        this.flashText = text;
    },

    // Returns null or { done: true, packedItems: [...] }
    update: function(dt) {
        if (this.phase === "packing") {
            this.timer += dt;
            if (this.flashTimer > 0) this.flashTimer -= dt;

            var piece = this.pieces[this.selected];

            // Piece selection
            if (Input.getKeyDown("Tab") || Input.getKeyDown("q")) {
                this.selected = (this.selected + 1) % this.pieces.length;
                this.flash(this.pieces[this.selected].name);
            }
            if (Input.getKeyDown("Backquote")) {
                this.selected = (this.selected - 1 + this.pieces.length) % this.pieces.length;
                this.flash(this.pieces[this.selected].name);
            }

            piece=this.pieces[this.selected];
            // Cursor
            if (Input.getKeyDown("Left") || Input.getKeyDown("a")) this.cursorX = Math.max(0, this.cursorX - 1);
            if (Input.getKeyDown("Right") || Input.getKeyDown("d")) this.cursorX = Math.min(GP_COLS - 1, this.cursorX + 1);
            if (Input.getKeyDown("Up") || Input.getKeyDown("w")) this.cursorY = Math.max(0, this.cursorY - 1);
            if (Input.getKeyDown("Down") || Input.getKeyDown("s")) this.cursorY = Math.min(GP_ROWS - 1, this.cursorY + 1);

            // Rotate
            if (Input.getKeyDown("r")) {
                this.rotatePiece(piece);
                this.flash("Rotated");
            }

            // Place / pick up
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                if (piece.placed) {
                    this.removePiece(piece);
                    this.flash("Removed " + piece.name);
                } else {
                    if (this.canPlace(piece, this.cursorX, this.cursorY)) {
                        this.placePiece(piece, this.cursorX, this.cursorY);
                        this.flash("Placed " + piece.name + "!");
                        Audio.play(SFX.ITEM_PICKUP, 0.4);
                        for (var i = 1; i <= this.pieces.length; i++) {
                            var nextIdx = (this.selected + i) % this.pieces.length;
                            if (!this.pieces[nextIdx].placed) {
                                this.selected = nextIdx;
                                break;
                            }
                        }
                    } else {
                        this.flash("Doesn't fit!");
                    }
                }
            }

            // Finish early or time up
            if (Input.getKeyDown("Escape") || this.timer >= GP_TIME_LIMIT) {
                this.calculateResults();
                this.phase = "results";
                this.timer = 0;
            }

            // All items placed
            var allPlaced = true;
            for (var i = 0; i < this.pieces.length; i++) {
                if (!this.pieces[i].placed) { allPlaced = false; break; }
            }
            if (allPlaced) {
                this.calculateResults();
                this.phase = "results";
                this.timer = 0;
            }

        } else if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true, packedItems: this.gs.inventory };
            }
        }
        return null;
    },

    calculateResults: function() {
        var packedItems = [];
        var missingMandatory = [];
        for (var i = 0; i < this.pieces.length; i++) {
            var p = this.pieces[i];
            if (p.placed) {
                for (var j = 0; j < this.gearData.length; j++) {
                    if (this.gearData[j].id === p.id) {
                        packedItems.push(JSON.parse(JSON.stringify(this.gearData[j])));
                        break;
                    }
                }
            } else if (p.mandatory) {
                missingMandatory.push(p);
            }
        }

        this.gs.inventory = packedItems;

        for (var i = 0; i < missingMandatory.length; i++) {
            var m = missingMandatory[i];
            if (m.id === "pa_speakers") {
                this.gs.resources.hype = Math.max(0, this.gs.resources.hype - 20);
            } else if (m.id === "guitar_amp") {
                this.gs.resources.hype = Math.max(0, this.gs.resources.hype - 10);
            } else if (m.id === "drum_kit") {
                this.gs.resources.hype = Math.max(0, this.gs.resources.hype - 15);
                this.gs.resources.morale = Math.max(0, this.gs.resources.morale - 10);
            } else if (m.id === "guitar_case") {
                this.gs.resources.morale = Math.max(0, this.gs.resources.morale - 5);
            }
        }

        if (missingMandatory.length === 0 && packedItems.length === this.pieces.length) {
            this.gs.resources.morale = Math.min(100, this.gs.resources.morale + 5);
        }

        console.log("[GearPack] Packed " + packedItems.length + "/" + this.pieces.length +
            " items, " + missingMandatory.length + " mandatory missing");
    },

    // Large cargo bay with actual equipment illustrations instead of colored placeholder blocks.
    draw:function(w,h){
        R.bg(3,w,h);R.header('LOAD THE SAUNA BUS','ARROWS · move    ENTER · place / pick up    R · rotate    TAB · next item    ESC · depart',w);
        R.box(14,72,263,218);R.band(3,28,78,40,40);R.text(78,84,'HANNELE: MAKE IT FIT.',0.65);
        var gx=33,gy=126,cell=28;
        for(var y=0;y<5;y++)for(var x=0;x<8;x++){
            Draw2D.fillRect(gx+x*cell,gy+y*cell,cell-1,cell-1,0.12,0.10,0.17,1);
            Draw2D.drawRect(gx+x*cell,gy+y*cell,cell,cell,0.35,0.25,0.36,1,1);
        }
        var icons={guitar_amp:0,drum_kit:1,pa_speakers:2,merch_box:3,spare_tire:5,beer_crate:6,guitar_case:4};
        for(var i=0;i<this.pieces.length;i++){
            var p=this.pieces[i];
            if(p.placed){Draw2D.fillRect(gx+p.gridX*cell+1,gy+p.gridY*cell+1,p.w*cell-2,p.h*cell-2,0.23,0.17,0.27,1);if(R.prop)R.prop(icons[p.id],gx+p.gridX*cell+2,gy+p.gridY*cell+2,p.w*cell-4,p.h*cell-4);}
            var yy=78+i*28;R.box(296,yy,329,26);
            if(i===this.selected)Draw2D.drawRect(296,yy,329,26,1,0.65,0.3,1,2);
            if(R.prop)R.prop(icons[p.id],301,yy,26,26);
            R.text(336,yy+6,(p.mandatory?'* ':'')+p.name+'  '+(p.placed?'PACKED':p.w+'x'+p.h),0.63);
        }
        var p=this.pieces[this.selected];
        if(!p.placed){var fits=this.canPlace(p,this.cursorX,this.cursorY);Draw2D.drawRect(gx+this.cursorX*cell,gy+this.cursorY*cell,Math.min(p.w,8-this.cursorX)*cell,Math.min(p.h,5-this.cursorY)*cell,fits?0.9:1,fits?0.7:0.15,0.3,1,2);}
        R.box(12,304,w-24,40);R.text(24,315,this.flashTimer>0?this.flashText:'TIME '+Math.ceil(Math.max(0,GP_TIME_LIMIT-this.timer))+'s     * Mandatory gear · every item affects the tour',0.65);
        if(this.phase==='results'){
            var count=this.pieces.filter(function(p){return p.placed;}).length;
            R.result('THE CARGO DOORS CLOSE',[count+'/'+this.pieces.length+' items loaded','ENTER · hit the road with the gear you packed'],w,h);
        }
    }
};
module.exports=GearPackSystem;
