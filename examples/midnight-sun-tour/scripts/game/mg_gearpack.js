var Art = require("./tour_art.js");
// ============================================================================
// GEAR PACK MINIGAME — extracted from midnight_sun.js §11f
// Tetris-style spatial packing: fit gear into the 8x5 bus cargo grid.
// Usage: var GearPack = require("./mg_gearpack.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var GP_COLS = 8;
var GP_ROWS = 5;
var GP_CELL = 16;
var GP_TIME_LIMIT = 90;

var GP_COLORS = {
    guitar_amp:   [0.88, 0.44, 0.13],
    drum_kit:     [0.25, 0.63, 0.88],
    pa_speakers:  [0.88, 0.25, 0.25],
    merch_box:    [0.88, 0.75, 0.25],
    spare_tire:   [0.50, 0.50, 0.50],
    beer_crate:   [0.25, 0.88, 0.38],
    guitar_case:  [0.75, 0.38, 0.88]
};

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

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, screenH, 0.06, 0.05, 0.12, 1, -5);
        Art.background(2,screenW,screenH,0.45);
        if (this.phase === "packing") {
            this.drawPacking(screenW, screenH);
        } else {
            this.drawResults(screenW, screenH);
        }
    },

    drawPacking: function(screenW, screenH) {
        Draw2D.drawText(screenW / 2 - 56, 6, "PACK THE BUS", 0.94, 0.75, 0.25, 1, F.HEADING);

        // Timer bar
        var timeLeft = Math.max(0, GP_TIME_LIMIT - this.timer);
        var timeFrac = timeLeft / GP_TIME_LIMIT;
        Draw2D.fillRect(10, 22, screenW - 20, 4, 0.15, 0.15, 0.22, 1);
        var tr = timeFrac > 0.3 ? 0.25 : 1;
        var tg = timeFrac > 0.3 ? 0.63 : 0.25;
        Draw2D.fillRect(10, 22, (screenW - 20) * timeFrac, 4, tr, tg, 0.25, 1);
        Draw2D.drawText(screenW - 55, 12, Math.ceil(timeLeft) + "s", 0.63, 0.63, 0.75, 1, F.BODY);

        // Grid
        var gridW = GP_COLS * GP_CELL;
        var gridH = GP_ROWS * GP_CELL;
        var gridX = (screenW - gridW) / 2;
        var gridY = 35;

        Draw2D.fillRect(gridX - 2, gridY - 2, gridW + 4, gridH + 4, 0.12, 0.10, 0.18, 1);

        for (var r = 0; r < GP_ROWS; r++) {
            for (var c = 0; c < GP_COLS; c++) {
                var cx = gridX + c * GP_CELL;
                var cy = gridY + r * GP_CELL;
                var cellId = this.grid[r][c];
                if (cellId !== 0) {
                    var col = GP_COLORS[cellId] || [0.5, 0.5, 0.5];
                    Draw2D.fillRect(cx + 1, cy + 1, GP_CELL - 2, GP_CELL - 2, col[0], col[1], col[2], 0.85);
                    Draw2D.drawRect(cx, cy, GP_CELL, GP_CELL, col[0] * 0.7, col[1] * 0.7, col[2] * 0.7, 0.5, 1);
                } else {
                    Draw2D.drawRect(cx, cy, GP_CELL, GP_CELL, 0.20, 0.20, 0.30, 0.4, 1);
                }
            }
        }

        // Ghost preview
        var piece = this.pieces[this.selected];
        if (!piece.placed) {
            var canFit = this.canPlace(piece, this.cursorX, this.cursorY);
            var ghostCol = GP_COLORS[piece.id] || [0.5, 0.5, 0.5];
            var ghostAlpha = canFit ? 0.4 : 0.15;
            for (var pr = 0; pr < piece.h; pr++) {
                for (var pc = 0; pc < piece.w; pc++) {
                    var gx = this.cursorX + pc;
                    var gy = this.cursorY + pr;
                    if (gx < GP_COLS && gy < GP_ROWS) {
                        var px = gridX + gx * GP_CELL;
                        var py = gridY + gy * GP_CELL;
                        Draw2D.fillRect(px + 1, py + 1, GP_CELL - 2, GP_CELL - 2, ghostCol[0], ghostCol[1], ghostCol[2], ghostAlpha);
                    }
                }
            }
        }

        // Cursor
        Draw2D.drawRect(gridX + this.cursorX * GP_CELL - 1, gridY + this.cursorY * GP_CELL - 1,
            GP_CELL + 2, GP_CELL + 2, 1, 1, 1, 0.8, 1);

        // Piece list
        var listX = gridX + gridW + 15;
        var listY = 35;
        Draw2D.drawText(listX, listY, "GEAR:", 0.75, 0.75, 0.88, 1, F.BODY);
        listY += 14;

        for (var i = 0; i < this.pieces.length; i++) {
            var p = this.pieces[i];
            var isSel = (i === this.selected);
            var col = GP_COLORS[p.id] || [0.5, 0.5, 0.5];
            var alpha = p.placed ? 0.35 : (isSel ? 1 : 0.65);
            if (isSel) Draw2D.drawText(listX - 8, listY, ">", 1, 1, 1, 1, F.TINY);
            var status = p.placed ? " [OK]" : " " + p.w + "x" + p.h;
            var label = p.name + status;
            if (p.mandatory) label = "*" + label;
            Draw2D.drawText(listX, listY, label, col[0], col[1], col[2], alpha, F.TINY);
            listY += 11;
        }
        listY += 6;
        Draw2D.drawText(listX, listY, "* = mandatory", 0.50, 0.50, 0.63, 1, F.TINY);

        // Flash text
        if (this.flashTimer > 0) {
            var fAlpha = Math.min(1, this.flashTimer * 2);
            Draw2D.drawText(gridX + gridW / 2 - 30, gridY + gridH + 5, this.flashText, 1, 1, 0.75, fAlpha, F.BODY);
        }

        // Instructions
        Draw2D.drawText(10, screenH - 30, "[ARROWS] Move  [ENTER] Place/Pick  [R] Rotate  [TAB] Next  [ESC] Done",
            0.38, 0.38, 0.50, 1, F.TINY);

        var placedCount = 0;
        for (var i = 0; i < this.pieces.length; i++) {
            if (this.pieces[i].placed) placedCount++;
        }
        Draw2D.drawText(10, screenH - 16, "Packed: " + placedCount + "/" + this.pieces.length, 0.63, 0.63, 0.75, 1, F.TINY);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.08;
        Draw2D.drawText(screenW / 2 - 70, cy, "BUS PACKED!", 0.94, 0.75, 0.25, 1, F.HEADING);
        cy += 28;

        var packedCount = 0;
        var mandatoryMissing = 0;
        for (var i = 0; i < this.pieces.length; i++) {
            var p = this.pieces[i];
            var col = GP_COLORS[p.id] || [0.5, 0.5, 0.5];
            if (p.placed) {
                packedCount++;
                Draw2D.drawText(30, cy, p.name + ": PACKED", col[0], col[1], col[2], 1, F.BODY);
            } else {
                var statusText = p.mandatory ? "MISSING!" : "Left behind";
                if (p.mandatory) mandatoryMissing++;
                var r = p.mandatory ? 1 : 0.50;
                var g = p.mandatory ? 0.25 : 0.50;
                Draw2D.drawText(30, cy, p.name + ": " + statusText, r, g, 0.25, 1, F.BODY);
            }
            cy += 14;
        }

        cy += 10;
        Draw2D.fillRect(20, cy, screenW - 40, 1, 0.29, 0.29, 0.42, 1);
        cy += 10;

        Draw2D.drawText(30, cy, "Total: " + packedCount + "/" + this.pieces.length + " packed", 0.75, 0.75, 0.88, 1, F.UI);
        cy += 18;

        if (mandatoryMissing > 0) {
            Draw2D.drawText(30, cy, mandatoryMissing + " mandatory item(s) missing — penalties applied!",
                1, 0.35, 0.25, 1, F.BODY);
            cy += 16;
        }
        if (packedCount === this.pieces.length) {
            Draw2D.drawText(30, cy, "Everything fits! Morale +5", 0.25, 0.88, 0.25, 1, F.BODY);
            cy += 16;
        }

        cy += 8;
        var flavor = "";
        if (packedCount === this.pieces.length) flavor = "Hannele nods approvingly. \"Efficient.\"";
        else if (mandatoryMissing === 0) flavor = "\"At least we have the essentials,\" sighs Mikko.";
        else if (mandatoryMissing === 1) flavor = "Pekka: \"We forgot something important...\"";
        else flavor = "Risto: \"This is going to be a very acoustic tour.\"";
        Draw2D.drawText(30, cy, flavor, 0.63, 0.63, 0.75, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Hit the road!", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = GearPackSystem;
