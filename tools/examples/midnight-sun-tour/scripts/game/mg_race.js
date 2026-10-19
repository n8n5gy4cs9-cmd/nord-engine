// ============================================================================
// MOOTTORITIE ON KUUMA — OutRun-style pseudo-3D racing (bus vs Lada)
// Uses shared pseudo3d.js sprite scaler engine
// Usage: var Race = require("./mg_race.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var P3D = require("./pseudo3d.js");
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var RACE_DURATION = 45;
var MAX_SPEED = 12000;
var ACCEL = 2400;
var DECEL = -2400;
var BRAKE = -6000;
var OFFROAD_DECEL = -4000;
var OFFROAD_LIMIT = 3000;
var CENTRIFUGAL = 0.12;
var STEER_RATE = 3.0;

// Road sections — OutRun-style winding Finnish highway
var ROAD_SECTIONS = [
    { start: 50,  end: 100, curve: 2.5 },
    { start: 150, end: 200, curve: -3.0 },
    { start: 250, end: 280, curve: 4.0 },
    { start: 350, end: 400, curve: -2.0 },
    { start: 450, end: 500, curve: 3.0 },
    { start: 80,  end: 120, hill: function(i) { return Math.sin(i * 0.05) * 1500; } },
    { start: 200, end: 240, hill: function(i) { return Math.sin(i * 0.04) * 2000; } },
    { start: 400, end: 440, hill: function(i) { return Math.sin(i * 0.06) * 1200; } }
];

var road = null;

var RaceSystem = {
    phase: "ready",
    timer: 0,
    raceTimer: 0,
    speed: 0,
    playerX: 0,
    position: 0,
    lada: null,
    gs: null,
    lapDist: 0,
    finished: false,
    playerAhead: false,

    start: function(gameState) {
        this.gs = gameState;
        this.phase = "ready";
        this.timer = 0;
        this.raceTimer = RACE_DURATION;
        this.speed = 0;
        this.playerX = 0;
        this.position = 0;
        this.lapDist = 0;
        this.finished = false;
        this.playerAhead = false;

        // Build pseudo-3D road from shared module
        road = P3D.create({
            segLen: 200,
            roadW: 2000,
            drawDist: 80,
            camH: 1000,
            camDepth: 0.84,
            totalSegs: 600,
            lanes: 2
        });
        road.buildSections(ROAD_SECTIONS);

        // Lada starts slightly behind player
        this.lada = {
            offset: 0.3,
            speed: MAX_SPEED * 0.55,
            position: 400,
            targetSpeed: MAX_SPEED * 0.55,
            aggression: 0.6 + Math.random() * 0.15
        };

        Audio.playMusic(MUSIC.RACE, true);
        console.log("[Race] Moottoritie on Kuuma started!");
    },

    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0 || Input.getKeyDown("Return")) {
                this.phase = "playing";
                this.timer = 0;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                var cashWon = this.playerAhead ? 80 : 0;
                return { done: true, won: this.playerAhead, cashWon: cashWon };
            }
            return null;
        }

        // ── Playing ─────────────────────────────────────────────
        this.raceTimer -= dt;

        // Input
        if (Input.getKey("Up") || Input.getKey("w")) {
            this.speed += ACCEL * dt;
        } else if (Input.getKey("Down") || Input.getKey("s")) {
            this.speed += BRAKE * dt;
        } else {
            this.speed += DECEL * dt;
        }

        // Off-road deceleration
        if (this.playerX < -1 || this.playerX > 1) {
            this.speed += OFFROAD_DECEL * dt;
            if (this.speed > OFFROAD_LIMIT) this.speed = OFFROAD_LIMIT;
        }

        this.speed = Math.max(0, Math.min(MAX_SPEED, this.speed));

        // Steering
        var steer = STEER_RATE * (this.speed / MAX_SPEED);
        if (Input.getKey("Left") || Input.getKey("a")) {
            this.playerX -= steer * dt;
        }
        if (Input.getKey("Right") || Input.getKey("d")) {
            this.playerX += steer * dt;
        }

        // Curve centrifugal force
        var segIdx = Math.floor(this.position / road.segLen) % road.totalSegs;
        var seg = road.getSegment(segIdx);
        if (seg) {
            this.playerX -= seg.curve * CENTRIFUGAL * (this.speed / MAX_SPEED) * dt;
        }

        this.playerX = Math.max(-3, Math.min(3, this.playerX));

        // Move forward
        this.position += this.speed * dt;
        this.lapDist = this.position;

        // ── Lada AI ─────────────────────────────────────────────
        // Adaptive speed: Lada tries to stay competitive with the player
        var gap = this.position - this.lada.position;
        if (gap > road.segLen * 8) {
            // Player far ahead — Lada speeds up aggressively
            this.lada.targetSpeed = MAX_SPEED * (0.7 + this.lada.aggression * 0.15);
        } else if (gap > road.segLen * 3) {
            // Player moderately ahead — Lada increases pace
            this.lada.targetSpeed = MAX_SPEED * (0.6 + this.lada.aggression * 0.1);
        } else if (gap < -road.segLen * 3) {
            // Lada ahead — ease off slightly
            this.lada.targetSpeed = MAX_SPEED * 0.45;
        } else {
            // Close race — competitive speed
            this.lada.targetSpeed = MAX_SPEED * (0.55 + this.lada.aggression * 0.1);
        }
        // Smooth speed transition + random jitter
        this.lada.speed += (this.lada.targetSpeed - this.lada.speed) * 1.5 * dt;
        this.lada.speed += (Math.random() - 0.5) * 300 * dt;
        this.lada.speed = Math.max(MAX_SPEED * 0.35, Math.min(MAX_SPEED * 0.85, this.lada.speed));
        this.lada.position += this.lada.speed * dt;

        var ladaSegIdx = Math.floor(this.lada.position / road.segLen) % road.totalSegs;
        var ladaSeg = road.getSegment(ladaSegIdx);
        if (ladaSeg) {
            this.lada.offset -= ladaSeg.curve * 0.003 * dt;
            this.lada.offset = Math.max(-0.8, Math.min(0.8, this.lada.offset));
        }

        // Lada collision
        var playerSegF = this.position / road.segLen;
        var ladaSegF = this.lada.position / road.segLen;
        if (Math.abs(playerSegF - ladaSegF) < 2 && Math.abs(this.playerX - this.lada.offset) < 0.5) {
            this.speed *= 0.6;
            Audio.play(SFX.LADA_HORN, 0.5);
        }

        this.playerAhead = this.position > this.lada.position;

        // Time up
        if (this.raceTimer <= 0) {
            this.raceTimer = 0;
            this.phase = "results";
            this.timer = 0;
            Audio.play(SFX.WHISTLE, 0.5);
        }

        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        if (this.phase === "ready") {
            // Sky + ground placeholder
            Draw2D.fillRect(0, 0, screenW, screenH * 0.45, 0.35, 0.55, 0.80, 1, -5);
            Draw2D.fillRect(0, screenH * 0.35, screenW, screenH * 0.15, 0.15, 0.30, 0.15, 1);
            Draw2D.fillRect(0, screenH * 0.45, screenW, screenH * 0.55, 0.25, 0.25, 0.28, 1);

            Draw2D.drawText(screenW / 2 - 80, screenH * 0.20, "MOOTTORITIE ON KUUMA", 0.94, 0.75, 0.25, 1, F.LARGE);
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.38, "Race your bus vs a Lada!", 0.75, 0.75, 0.82, 1, F.BODY);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.48, "[UP] Gas [DOWN] Brake [LEFT/RIGHT] Steer", 0.50, 0.50, 0.63, 1, F.SMALL);
            var countdown = Math.ceil(2.5 - this.timer);
            if (countdown > 0) {
                Draw2D.drawText(screenW / 2 - 10, screenH * 0.65, "" + countdown, 1, 1, 0.3, 1, F.TITLE_XL);
            }
            return;
        }

        // ── Pseudo-3D road via shared module ────────────────────
        road.update(this.position, this.playerX);
        var maxClipY = road.draw(screenW, screenH, P3D.THEME_DAY);

        // ── Roadside scenery (trees, signs) — sprite textures ─
        var baseS = road.getBaseSeg();
        for (var n = road.drawDist; n >= 2; n--) {
            var sIdx = baseS + n;
            // Trees every 8 segments — alternating pine/birch
            if (sIdx % 8 === 0) {
                var pL = road.projectSprite(sIdx, -1.8, screenW, screenH);
                var pR = road.projectSprite(sIdx, 1.8, screenW, screenH);
                road.drawSpriteImageAt(pL, 300, 600, SPRITES.TREE_PINE, screenW, screenH);
                road.drawSpriteImageAt(pR, 300, 600, SPRITES.TREE_BIRCH, screenW, screenH);
            }
            // Road signs every 50 segments
            if (sIdx % 50 === 0) {
                var pSign = road.projectSprite(sIdx, -1.5, screenW, screenH);
                road.drawSpriteImageAt(pSign, 150, 400, SPRITES.ROAD_SIGN, screenW, screenH);
            }
        }

        // ── Lada (opponent car) — sprite texture ────────────
        var ladaSegIdx = Math.floor(this.lada.position / road.segLen);
        var ladaP = road.projectSprite(ladaSegIdx, this.lada.offset, screenW, screenH);
        if (ladaP.visible) {
            var carW = Math.max(4, ladaP.w * 0.15);
            var carH = carW * 0.83;
            Draw2D.drawImage(ladaP.x - carW / 2, ladaP.y - carH, carW, carH, SPRITES.LADA_RED, 1, 1, 1, 1);
        }

        // ── Player bus (fixed at screen bottom) ─────────────────
        this.drawPlayerBus(screenW, screenH);

        // ── HUD ─────────────────────────────────────────────────
        this.drawHUD(screenW, screenH);

        if (this.phase === "results") {
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.6);
            this.drawResults(screenW, screenH);
        }
    },

    drawPlayerBus: function(screenW, screenH) {
        var scale = screenW / 320;
        var bw = 36 * scale;
        var bh = 22 * scale;
        var bx = screenW / 2 - bw / 2;
        var by = screenH - bh - 6 * scale;
        // Bus sprite
        Draw2D.drawImage(bx, by, bw, bh, SPRITES.BUS_PLAYER, 1, 1, 1, 1);
        // Exhaust puff sprite
        if (this.speed > MAX_SPEED * 0.3 && Math.random() > 0.5) {
            Draw2D.drawImage(bx + bw, by + bh - 10 * scale, 12 * scale, 8 * scale, SPRITES.EXHAUST_PUFF, 1, 1, 1, 0.6);
        }
    },

    drawHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 18, 0, 0, 0, 0.6);

        var timeLeft = Math.ceil(this.raceTimer);
        Draw2D.drawText(5, 2, "TIME: " + timeLeft, 0.94, 0.75, 0.25, 1, F.BODY);

        var kmh = Math.round(this.speed * 0.01);
        Draw2D.drawText(screenW / 2 - 20, 2, kmh + " km/h", 0.75, 0.75, 0.88, 1, F.BODY);

        var posText = this.playerAhead ? "1st" : "2nd";
        var posR = this.playerAhead ? 0.25 : 1;
        var posG = this.playerAhead ? 0.88 : 0.4;
        Draw2D.drawText(screenW - 40, 2, posText, posR, posG, 0.25, 1, F.BODY);

        // Speed bar
        var speedFrac = this.speed / MAX_SPEED;
        Draw2D.fillRect(5, screenH - 10, screenW - 10, 5, 0.15, 0.15, 0.20, 1);
        var sr = speedFrac > 0.8 ? 1 : 0.25;
        var sg = speedFrac > 0.8 ? 0.25 : 0.65;
        Draw2D.fillRect(5, screenH - 10, (screenW - 10) * speedFrac, 5, sr, sg, 0.25, 1);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.12;
        var title = this.playerAhead ? "YOU WIN!" : "LADA WINS!";
        Draw2D.drawText(screenW / 2 - 50, cy, title, 0.94, 0.75, 0.25, 1, F.TITLE);
        cy += 35;

        var flavor = this.playerAhead
            ? "The bus actually beat a Lada! Risto is speechless."
            : "A Lada? You lost to a Lada? Pekka won't let you forget this.";
        Draw2D.drawText(30, cy, flavor, 0.75, 0.75, 0.82, 1, F.BODY);
        cy += 25;

        if (this.playerAhead) {
            Draw2D.drawText(30, cy, "Prize: 80 EUR!", 0.25, 0.88, 0.25, 1, F.UI);
        } else {
            Draw2D.drawText(30, cy, "No prize. Shame only.", 0.88, 0.50, 0.25, 1, F.UI);
        }

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = RaceSystem;
