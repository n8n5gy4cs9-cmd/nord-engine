// ============================================================================
// TELTANPYSTYTYS — Simon Says tent assembly minigame
// Memorize & repeat button sequences to set up the tent. 30s time limit.
// Usage: var Tent = require("./mg_tent.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var TENT_TIME_LIMIT = 30;
var TENT_BUTTONS = ["Up", "Down", "Left", "Right"];
var TENT_LABELS = ["UP", "DOWN", "LEFT", "RIGHT"];
var TENT_COLORS = [
    [0.25, 0.63, 0.88],   // up = blue
    [0.88, 0.44, 0.13],   // down = orange
    [0.25, 0.88, 0.38],   // left = green
    [0.88, 0.25, 0.25]    // right = red
];

var TentSystem = {
    phase: "ready",
    timer: 0,
    gameTimer: 0,
    gs: null,
    sequence: [],
    playerInput: [],
    showingIdx: 0,
    showTimer: 0,
    round: 1,
    maxRounds: 7,
    inputIdx: 0,
    flashBtn: -1,
    flashTimer: 0,
    successCount: 0,
    failCount: 0,
    tentProgress: 0,  // 0.0 to 1.0

    start: function(gameState) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.TENT, true);
        this.phase = "ready";
        this.timer = 0;
        this.gameTimer = TENT_TIME_LIMIT;
        this.round = 1;
        this.successCount = 0;
        this.failCount = 0;
        this.tentProgress = 0;
        this.flashBtn = -1;
        this.flashTimer = 0;
        this.showGap = false;
        this.generateSequence();
        console.log("[Tent] Teltanpystytys started!");
    },

    generateSequence: function() {
        this.sequence = [];
        var seqLen = Math.min(2 + this.round, 8);
        for (var i = 0; i < seqLen; i++) {
            var dir;
            do {
                dir = Math.floor(Math.random() * 4);
            } while (i > 0 && dir === this.sequence[i - 1]);
            this.sequence.push(dir);
        }
        this.showingIdx = 0;
        this.showTimer = 0;
        this.showGap = false;
        this.inputIdx = 0;
        this.playerInput = [];
    },

    // Returns null or { done: true, restBonus }
    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0) {
                this.phase = "showing";
                this.timer = 0;
                this.showingIdx = 0;
                this.showTimer = 0;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                // Rest bonus: better tent = better rest
                var restBonus = Math.floor(this.tentProgress * 30);
                this.gs.resources.morale = Math.min(100, this.gs.resources.morale + restBonus);
                return { done: true, restBonus: restBonus };
            }
            return null;
        }

        this.gameTimer -= dt;
        if (this.gameTimer <= 0) {
            this.phase = "results";
            this.timer = 0;
            Audio.play(SFX.TENT_DONE, 0.7);
            return null;
        }

        // Flash effect
        if (this.flashTimer > 0) this.flashTimer -= dt;

        // -- "transition" phase: brief pause before accepting input --
        if (this.phase === "transition") {
            this.timer += dt;
            if (this.timer >= 0.8) {
                this.phase = "input";
                this.inputIdx = 0;
                this.timer = 0;
            }
            return null;
        }

        // -- "correct" phase: brief feedback before next round --
        if (this.phase === "correct") {
            this.timer += dt;
            if (this.timer >= 0.6) {
                this.round++;
                if (this.round > this.maxRounds) {
                    this.phase = "results";
                    this.timer = 0;
                    Audio.play(SFX.TENT_DONE, 0.7);
                } else {
                    this.generateSequence();
                    this.phase = "showing";
                    this.showTimer = 0;
                    this.showingIdx = 0;
                }
            }
            return null;
        }

        // -- "wrong" phase: brief feedback before next round --
        if (this.phase === "wrong") {
            this.timer += dt;
            if (this.timer >= 0.7) {
                this.round++;
                if (this.round > this.maxRounds) {
                    this.phase = "results";
                    this.timer = 0;
                    Audio.play(SFX.TENT_DONE, 0.7);
                } else {
                    this.generateSequence();
                    this.phase = "showing";
                    this.showTimer = 0;
                    this.showingIdx = 0;
                }
            }
            return null;
        }

        if (this.phase === "showing") {
            this.showTimer += dt;
            if (this.showGap) {
                // Brief blank gap between directions
                if (this.showTimer >= 0.2) {
                    this.showTimer = 0;
                    this.showGap = false;
                }
            } else if (this.showTimer >= 0.6) {
                this.showTimer = 0;
                this.showingIdx++;
                if (this.showingIdx >= this.sequence.length) {
                    this.phase = "transition";
                    this.timer = 0;
                } else {
                    this.showGap = true;
                }
            }
            return null;
        }

        if (this.phase === "input") {
            for (var i = 0; i < TENT_BUTTONS.length; i++) {
                if (Input.getKeyDown(TENT_BUTTONS[i])) {
                    this.flashBtn = i;
                    this.flashTimer = 0.3;
                    if (i === this.sequence[this.inputIdx]) {
                        Audio.play(SFX.TENT_SNAP, 0.5);
                        this.inputIdx++;
                        if (this.inputIdx >= this.sequence.length) {
                            // Round complete — show "CORRECT!" feedback
                            this.successCount++;
                            this.tentProgress = Math.min(1, this.successCount / this.maxRounds);
                            this.phase = "correct";
                            this.timer = 0;
                        }
                    } else {
                        // Wrong button — show "WRONG!" feedback
                        Audio.play(SFX.FEEDBACK, 0.4);
                        this.failCount++;
                        this.phase = "wrong";
                        this.timer = 0;
                    }
                    break;
                }
            }
            return null;
        }

        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        // Night sky
        Draw2D.fillRect(0, 0, screenW, screenH, 0.04, 0.04, 0.10, 1, -5);
        // Stars
        for (var s = 0; s < 25; s++) {
            var sx = (s * 113 + 37) % (screenW - 10) + 5;
            var sy = (s * 79 + 13) % 60 + 5;
            Draw2D.fillRect(sx, sy, 1, 1, 0.8, 0.8, 0.9, 0.5);
        }

        if (this.phase === "ready") {
            this.drawCampsite(screenW, screenH);
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.25, "TELTANPYSTYTYS", 0.94, 0.75, 0.25, 1, F.HEADING);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.40, "Memorize the sequence, then repeat!", 0.75, 0.75, 0.82, 1, F.BODY);
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.50, "[ARROWS] Input directions", 0.50, 0.50, 0.63, 1, F.BODY);
            var blink = Math.sin(this.timer * 4) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 1, 1, 1, 1, F.UI);

        } else {
            this.drawCampsite(screenW, screenH);
            this.drawTent(screenW, screenH);
            this.drawButtons(screenW, screenH);
            this.drawHUD(screenW, screenH);

            if (this.phase === "showing") {
                this.drawSequenceShow(screenW, screenH);
            } else if (this.phase === "transition") {
                // "YOUR TURN" banner with blink before input starts
                Draw2D.fillRect(screenW / 2 - 70, 25, 140, 26, 0.05, 0.15, 0.05, 0.85);
                var blink = Math.sin(this.timer * 8) > 0;
                if (blink) Draw2D.drawText(screenW / 2 - 45, 28, "YOUR TURN!", 0.30, 0.95, 0.30, 1, F.LARGE);
            } else if (this.phase === "input") {
                this.drawInputPrompt(screenW, screenH);
            } else if (this.phase === "correct") {
                // "CORRECT!" feedback banner
                Draw2D.fillRect(screenW / 2 - 60, 25, 120, 26, 0.05, 0.20, 0.05, 0.85);
                Draw2D.drawText(screenW / 2 - 40, 28, "CORRECT!", 0.25, 1, 0.25, 1, F.LARGE);
                // Progress dots all lit
                var dotY = 56;
                for (var i = 0; i < this.sequence.length; i++) {
                    var dx = screenW / 2 - (this.sequence.length * 6) + i * 12;
                    Draw2D.fillRect(dx, dotY, 8, 8, 0.25, 0.95, 0.25, 1);
                }
            } else if (this.phase === "wrong") {
                // "WRONG!" feedback banner
                Draw2D.fillRect(screenW / 2 - 50, 25, 100, 26, 0.25, 0.05, 0.05, 0.85);
                Draw2D.drawText(screenW / 2 - 35, 28, "WRONG!", 1, 0.25, 0.25, 1, F.LARGE);
            } else if (this.phase === "results") {
                Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.5);
                this.drawResults(screenW, screenH);
            }
        }
    },

    drawCampsite: function(screenW, screenH) {
        // Ground
        Draw2D.fillRect(0, screenH * 0.65, screenW, screenH * 0.35, 0.10, 0.14, 0.06, 1);
        // Trees
        for (var t = 0; t < 5; t++) {
            var tx = 20 + t * 65;
            Draw2D.fillRect(tx, screenH * 0.45, 8, screenH * 0.2, 0.25, 0.15, 0.08, 1);
            Draw2D.fillRect(tx - 10, screenH * 0.35, 28, 20, 0.06, 0.20, 0.06, 1);
        }
        // Campfire
        var fireX = screenW * 0.7;
        var fireY = screenH * 0.75;
        Draw2D.fillRect(fireX - 5, fireY - 3, 10, 4, 0.90, 0.40, 0.10, 0.8);
        Draw2D.fillRect(fireX - 3, fireY - 7, 6, 5, 0.95, 0.65, 0.15, 0.6);
        Draw2D.fillRect(fireX - 1, fireY - 10, 2, 4, 0.95, 0.85, 0.30, 0.4);
    },

    drawTent: function(screenW, screenH) {
        var tx = screenW * 0.35;
        var ty = screenH * 0.55;
        var tentW = 50;
        var tentH = 30;

        // Tent body (grows with progress)
        var prog = this.tentProgress;
        var h = tentH * prog;
        if (prog > 0) {
            Draw2D.fillRect(tx, ty - h, tentW, h, 0.60, 0.25, 0.12, 0.8);
            Draw2D.drawRect(tx, ty - h, tentW, h, 0.75, 0.40, 0.20, 1, 1);
            // Door
            if (prog > 0.5) {
                Draw2D.fillRect(tx + tentW * 0.35, ty - h * 0.6, tentW * 0.3, h * 0.6, 0.35, 0.15, 0.06, 1);
            }
            // Poles
            if (prog > 0.3) {
                Draw2D.drawLine(tx + tentW / 2, ty - h - 5, tx + tentW / 2, ty, 0.6, 0.5, 0.3, 1, 1);
            }
        }

        // Progress label
        Draw2D.drawText(tx, ty + 5, Math.floor(prog * 100) + "% built", 0.75, 0.75, 0.88, 1, F.TINY);
    },

    drawButtons: function(screenW, screenH) {
        // 4 direction buttons at bottom
        var bx = screenW / 2;
        var by = screenH * 0.88;
        var bs = 16;
        var gap = 22;

        var positions = [
            [bx, by - gap],      // Up
            [bx, by + gap],      // Down
            [bx - gap, by],      // Left
            [bx + gap, by]       // Right
        ];

        for (var i = 0; i < 4; i++) {
            var px = positions[i][0] - bs / 2;
            var py = positions[i][1] - bs / 2;
            var col = TENT_COLORS[i];
            var bright = (this.flashBtn === i && this.flashTimer > 0) ? 1.5 : 0.6;
            bright = Math.min(1, bright);

            Draw2D.fillRect(px, py, bs, bs, col[0] * bright, col[1] * bright, col[2] * bright, 0.8);
            Draw2D.drawRect(px, py, bs, bs, col[0], col[1], col[2], 1, 1);
            Draw2D.drawText(px + 2, py + 3, TENT_LABELS[i], 1, 1, 1, 0.8, F.MICRO);
        }
    },

    drawSequenceShow: function(screenW, screenH) {
        Draw2D.fillRect(screenW / 2 - 60, 25, 120, 22, 0, 0, 0, 0.7);
        Draw2D.drawText(screenW / 2 - 40, 28, "WATCH!", 0.94, 0.88, 0.30, 1, F.UI);

        // Highlight current shown button (blank during gap)
        if (this.showingIdx < this.sequence.length && !this.showGap) {
            var btnIdx = this.sequence[this.showingIdx];
            var col = TENT_COLORS[btnIdx];
            var bx = screenW / 2;
            var by = screenH * 0.88;
            var gap = 22;
            var positions = [
                [bx, by - gap], [bx, by + gap],
                [bx - gap, by], [bx + gap, by]
            ];
            var px = positions[btnIdx][0];
            var py = positions[btnIdx][1];
            // Glow effect on active button
            Draw2D.drawCircle(px, py, 14, col[0], col[1], col[2], 0.4);
        }
    },

    drawInputPrompt: function(screenW, screenH) {
        Draw2D.fillRect(screenW / 2 - 60, 25, 120, 22, 0, 0, 0, 0.7);
        Draw2D.drawText(screenW / 2 - 40, 28, "YOUR TURN!", 0.30, 0.90, 0.30, 1, F.UI);

        // Show progress dots
        var dotY = 52;
        for (var i = 0; i < this.sequence.length; i++) {
            var dx = screenW / 2 - (this.sequence.length * 6) + i * 12;
            var done = i < this.inputIdx;
            var r = done ? 0.25 : 0.30;
            var g = done ? 0.88 : 0.30;
            var b = done ? 0.25 : 0.35;
            Draw2D.fillRect(dx, dotY, 8, 8, r, g, b, 1);
        }
    },

    drawHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 18, 0, 0, 0, 0.6);
        Draw2D.drawText(5, 3, "Round " + Math.min(this.round, this.maxRounds) + "/" + this.maxRounds,
            0.75, 0.75, 0.88, 1, F.BODY);
        var timeLeft = Math.ceil(this.gameTimer);
        Draw2D.drawText(screenW / 2 - 10, 3, timeLeft + "s", 0.94, 0.75, 0.25, 1, F.BODY);
        Draw2D.drawText(screenW - 80, 3, "OK: " + this.successCount + " Fail: " + this.failCount,
            0.63, 0.63, 0.75, 1, F.SMALL);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.12;
        var quality = this.tentProgress >= 0.8 ? "GREAT" : (this.tentProgress >= 0.4 ? "OK" : "POOR");

        Draw2D.drawText(screenW / 2 - 60, cy, "TENT " + quality + "!", 0.94, 0.75, 0.25, 1, F.HEADING);
        cy += 30;

        Draw2D.drawText(30, cy, "Tent completion: " + Math.floor(this.tentProgress * 100) + "%",
            0.75, 0.75, 0.88, 1, F.UI);
        cy += 18;
        Draw2D.drawText(30, cy, "Correct sequences: " + this.successCount + "/" + this.maxRounds,
            0.25, 0.88, 0.25, 1, F.BODY);
        cy += 18;
        Draw2D.drawText(30, cy, "Failed: " + this.failCount, 1, 0.4, 0.3, 1, F.BODY);
        cy += 25;

        var restBonus = Math.floor(this.tentProgress * 30);
        Draw2D.drawText(30, cy, "Rest bonus: +" + restBonus + " morale", 0.25, 0.88, 0.25, 1, F.UI);
        cy += 25;

        var flavor = "";
        if (this.tentProgress >= 0.8) flavor = "A proper tent! Hannele approves of the craftsmanship.";
        else if (this.tentProgress >= 0.4) flavor = "It leans a bit. Risto: 'It'll hold. Probably.'";
        else flavor = "More of a blanket fort. Pekka sleeps in the bus.";
        Draw2D.drawText(30, cy, flavor, 0.62, 0.62, 0.75, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Rest up", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = TentSystem;
