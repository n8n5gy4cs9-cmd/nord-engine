var Art = require("./tour_art.js");
// ============================================================================
// TANKKAUS — Stop-the-needle fuel gauge minigame
// Hit SPACE when the needle passes the green zone for bonus fuel.
// Usage: var Fuel = require("./mg_fuel.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var GAUGE_ROUNDS = 5;
var NEEDLE_SPEED_BASE = 2.5;   // radians per second
var NEEDLE_SPEED_INC = 0.4;    // acceleration per round
var GREEN_WIDTH = 0.4;         // radians of sweet spot (starts wide, shrinks)
var GREEN_SHRINK = 0.04;       // per round

var FuelSystem = {
    phase: "ready",
    timer: 0,
    gs: null,
    round: 1,
    needleAngle: 0,
    needleSpeed: 0,
    needleDir: 1,
    greenStart: 0,
    greenWidth: 0,
    hitZone: false,
    roundResult: "",
    resultTimer: 0,
    totalFuel: 0,
    perfectCount: 0,
    missCount: 0,

    start: function(gameState) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.FUEL, true);
        this.phase = "ready";
        this.timer = 0;
        this.round = 1;
        this.totalFuel = 0;
        this.perfectCount = 0;
        this.missCount = 0;
        this.setupRound();
        console.log("[Fuel] Tankkaus started!");
    },

    setupRound: function() {
        this.needleAngle = 0;
        this.needleDir = 1;
        this.needleSpeed = NEEDLE_SPEED_BASE + (this.round - 1) * NEEDLE_SPEED_INC;
        this.greenWidth = Math.max(0.15, GREEN_WIDTH - (this.round - 1) * GREEN_SHRINK);
        this.greenStart = 0.5 + Math.random() * (Math.PI - this.greenWidth - 0.5);
        this.hitZone = false;
        this.roundResult = "";
        this.resultTimer = 0;
    },

    // Returns null or { done: true, fuelAdded }
    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0 || Input.getKeyDown("Return")) {
                this.phase = "pumping";
                this.timer = 0;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true, totalFuel: this.totalFuel };
            }
            return null;
        }

        if (this.phase === "round_result") {
            this.resultTimer += dt;
            if (this.resultTimer >= 1.0) {
                this.round++;
                if (this.round > GAUGE_ROUNDS) {
                    this.phase = "results";
                    this.timer = 0;
                } else {
                    this.setupRound();
                    this.phase = "pumping";
                }
            }
            return null;
        }

        // Pumping phase
        this.needleAngle += this.needleSpeed * this.needleDir * dt;
        if (this.needleAngle >= Math.PI) {
            this.needleAngle = Math.PI;
            this.needleDir = -1;
        }
        if (this.needleAngle <= 0) {
            this.needleAngle = 0;
            this.needleDir = 1;
        }

        if (Input.getKeyDown("Space") || Input.getKeyDown("Return")) {
            // Check if in green zone
            if (this.needleAngle >= this.greenStart && this.needleAngle <= this.greenStart + this.greenWidth) {
                // Perfect hit
                var closeness = 1.0 - Math.abs(this.needleAngle - (this.greenStart + this.greenWidth / 2)) / (this.greenWidth / 2);
                var fuelGain = Math.floor(8 + closeness * 7);
                this.totalFuel += fuelGain;
                this.perfectCount++;
                this.roundResult = "+" + fuelGain + "% fuel!";
                this.hitZone = true;
                Audio.play(SFX.FUEL_STOP, 0.5);
            } else {
                // Miss
                this.totalFuel += 2;
                this.missCount++;
                this.roundResult = "Missed! +2% only";
                this.hitZone = false;
                Audio.play(SFX.FUEL_TICK, 0.4);
            }
            this.phase = "round_result";
            this.resultTimer = 0;
        }

        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, screenH, 0.10, 0.08, 0.06, 1, -5);
        Art.background(0,screenW,screenH,0.45);

        if (this.phase === "ready") {
            this.drawPump(screenW, screenH);
            Draw2D.drawText(screenW / 2 - 50, screenH * 0.25, "TANKKAUS!", 0.94, 0.75, 0.25, 1, F.HEADING);
            Draw2D.drawText(screenW / 2 - 90, screenH * 0.40, "Stop the needle in the green zone!", 0.75, 0.75, 0.82, 1, F.BODY);
            Draw2D.drawText(screenW / 2 - 60, screenH * 0.50, "[SPACE] Stop needle", 0.50, 0.50, 0.63, 1, F.BODY);
            var blink = Math.sin(this.timer * 4) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 1, 1, 1, 1, F.UI);

        } else if (this.phase === "pumping" || this.phase === "round_result") {
            this.drawPump(screenW, screenH);
            this.drawGauge(screenW, screenH);
            this.drawHUD(screenW, screenH);

            if (this.phase === "round_result") {
                var col = this.hitZone ? [0.25, 0.88, 0.25] : [1, 0.4, 0.3];
                Draw2D.fillRect(screenW / 2 - 60, screenH * 0.15, 120, 22, 0, 0, 0, 0.7);
                Draw2D.drawText(screenW / 2 - 50, screenH * 0.16, this.roundResult, col[0], col[1], col[2], 1, F.UI);
            }

        } else if (this.phase === "results") {
            this.drawPump(screenW, screenH);
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.6);
            this.drawResults(screenW, screenH);
        }
    },

    drawPump: function(screenW, screenH) {
        // Station background sprite
        Draw2D.drawImage(0, 0, screenW, screenH, SPRITES.MG_FUEL_STATION, 1, 1, 1, 1);
        // Pump sprite
        Draw2D.drawImage(screenW * 0.22, screenH * 0.32, 70, 90, SPRITES.MG_FUEL_PUMP, 1, 1, 1, 1);
        // Hose sprite
        Draw2D.drawImage(screenW * 0.34, screenH * 0.50, 60, 30, SPRITES.MG_FUEL_HOSE, 1, 1, 1, 1);
        // Ground
        Draw2D.fillRect(0, screenH * 0.80, screenW, screenH * 0.20, 0.18, 0.18, 0.20, 1);
    },

    drawGauge: function(screenW, screenH) {
        var cx = screenW * 0.65;
        var cy = screenH * 0.55;
        var gaugeR = 40;

        // Gauge background sprite
        Draw2D.drawImage(cx - gaugeR - 8, cy - gaugeR - 8, (gaugeR + 8) * 2, (gaugeR + 8) * 2, SPRITES.MG_FUEL_GAUGE, 1, 1, 1, 1);

        // Draw arc zones (simplified as segments)
        var steps = 24;
        for (var i = 0; i < steps; i++) {
            var a1 = Math.PI * (i / steps);
            var a2 = Math.PI * ((i + 1) / steps);
            var midA = (a1 + a2) / 2;

            var inGreen = midA >= this.greenStart && midA <= this.greenStart + this.greenWidth;
            var r = inGreen ? 0.15 : 0.25;
            var g = inGreen ? 0.65 : 0.18;
            var b = inGreen ? 0.15 : 0.18;

            var x1 = cx + Math.cos(Math.PI - a1) * (gaugeR - 8);
            var y1 = cy - Math.sin(Math.PI - a1) * (gaugeR - 8);
            var x2 = cx + Math.cos(Math.PI - a2) * (gaugeR - 8);
            var y2 = cy - Math.sin(Math.PI - a2) * (gaugeR - 8);

            Draw2D.drawLine(x1, y1, x2, y2, r, g, b, 1, 3);
        }

        // Needle
        var nx = cx + Math.cos(Math.PI - this.needleAngle) * (gaugeR - 5);
        var ny = cy - Math.sin(Math.PI - this.needleAngle) * (gaugeR - 5);
        Draw2D.drawLine(cx, cy, nx, ny, 0.95, 0.25, 0.15, 1, 2);
        Draw2D.drawCircle(cx, cy, 3, 0.80, 0.20, 0.10, 1);

        // Labels
        Draw2D.drawText(cx - gaugeR - 5, cy + 5, "E", 0.88, 0.25, 0.25, 1, F.TINY);
        Draw2D.drawText(cx + gaugeR - 2, cy + 5, "F", 0.25, 0.88, 0.25, 1, F.TINY);
    },

    drawHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 18, 0, 0, 0, 0.6);
        Draw2D.drawText(5, 3, "Round " + this.round + "/" + GAUGE_ROUNDS, 0.75, 0.75, 0.88, 1, F.BODY);
        Draw2D.drawText(screenW / 2 - 25, 3, "Fuel: +" + this.totalFuel + "%", 0.25, 0.88, 0.25, 1, F.BODY);
        Draw2D.drawText(screenW - 60, 3, "[SPACE] Stop!", 0.94, 0.75, 0.25, 1, F.SMALL);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.12;
        Draw2D.drawText(screenW / 2 - 55, cy, "TANK FULL!", 0.94, 0.75, 0.25, 1, F.HEADING);
        cy += 30;

        Draw2D.drawText(30, cy, "Fuel added: +" + this.totalFuel + "%", 0.25, 0.88, 0.25, 1, F.UI);
        cy += 18;
        Draw2D.drawText(30, cy, "Perfect stops: " + this.perfectCount + "/" + GAUGE_ROUNDS, 0.75, 0.75, 0.88, 1, F.BODY);
        cy += 18;
        Draw2D.drawText(30, cy, "Missed: " + this.missCount, 0.88, 0.50, 0.25, 1, F.BODY);
        cy += 25;

        Draw2D.drawText(30, cy, "Bus fuel now: " + Math.min(this.gs.bus.max_gas, this.gs.bus.gas + this.totalFuel) + "%",
            0.75, 0.75, 0.88, 1, F.UI);
        cy += 25;

        var flavor = "";
        if (this.perfectCount >= 4) flavor = "Expert fueling! Hannele: 'You could work here.'";
        else if (this.perfectCount >= 2) flavor = "Decent. The bus will make it.";
        else flavor = "Risto: 'My grandma fuels better than that.'";
        Draw2D.drawText(30, cy, flavor, 0.62, 0.62, 0.75, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = FuelSystem;
