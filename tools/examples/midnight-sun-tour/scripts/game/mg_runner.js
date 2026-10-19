// ============================================================================
// MURTOMAAJUOKSU — Auto-runner after bus breakdown
// Ref: canabalt (auto-run, gravity, jump, platform generation, obstacles)
// Usage: var Runner = require("./mg_runner.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;

var RUN_GRAVITY = 1200;
var RUN_MAX_FALL = 300;
var RUN_INIT_SPEED = 80;
var RUN_MAX_SPEED = 250;
var RUN_JUMP_VEL = -280;
var RUN_SHORT_JUMP = -180;
var JUMP_HOLD_MAX = 0.25;
var GROUND_Y = 190;
var PLAYER_W = 8;
var PLAYER_H = 14;
var PLATFORM_MIN_W = 50;
var PLATFORM_MAX_W = 120;
var PLATFORM_GAP_MIN = 25;
var PLATFORM_GAP_MAX = 60;
var PLATFORM_H_VAR = 30;
var OBSTACLE_CHANCE = 0.2;
var STUMBLE_MULT = 0.7;
var TARGET_DIST = 800;   // reach phone booth at 800m

var RunnerSystem = {
    phase: "ready",
    timer: 0,
    gs: null,
    playerX: 60,
    playerY: 0,
    velX: 0,
    velY: 0,
    onGround: false,
    jumping: false,
    jumpTimer: 0,
    distance: 0,
    scrollX: 0,
    platforms: [],
    obstacles: [],
    dead: false,
    stumbled: false,
    stumbleTimer: 0,
    legFrame: 0,

    start: function(gameState) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.RUNNER, true);
        this.phase = "ready";
        this.timer = 0;
        this.playerX = 60;
        this.playerY = GROUND_Y - PLAYER_H;
        this.velX = RUN_INIT_SPEED;
        this.velY = 0;
        this.onGround = true;
        this.jumping = false;
        this.jumpTimer = 0;
        this.distance = 0;
        this.scrollX = 0;
        this.dead = false;
        this.stumbled = false;
        this.stumbleTimer = 0;
        this.legFrame = 0;

        // Initial platforms
        this.platforms = [];
        this.platforms.push({ x: 0, y: GROUND_Y, w: 200, type: "ground" });
        var px = 200;
        for (var i = 0; i < 10; i++) {
            var gap = PLATFORM_GAP_MIN + Math.random() * (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN);
            var pw = PLATFORM_MIN_W + Math.random() * (PLATFORM_MAX_W - PLATFORM_MIN_W);
            var py = GROUND_Y + (Math.random() - 0.5) * PLATFORM_H_VAR;
            py = Math.max(GROUND_Y - 30, Math.min(GROUND_Y + 20, py));
            px += gap;
            this.platforms.push({ x: px, y: py, w: pw, type: "roof" });
            px += pw;
        }

        this.obstacles = [];
        this.spawnObstacles();

        console.log("[Runner] Murtomaajuoksu started! Run " + TARGET_DIST + "m to phone booth.");
    },

    spawnObstacles: function() {
        for (var i = 2; i < this.platforms.length; i++) {
            var plat = this.platforms[i];
            if (Math.random() < OBSTACLE_CHANCE) {
                this.obstacles.push({
                    x: plat.x + plat.w * 0.3 + Math.random() * plat.w * 0.4,
                    y: plat.y - 10,
                    w: 6,
                    h: 10,
                    hit: false
                });
            }
        }
    },

    // Returns null or { done: true }
    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0) {
                this.phase = "running";
                this.timer = 0;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true, reachedTarget: !this.dead, distance: Math.floor(this.distance) };
            }
            return null;
        }

        if (this.dead) {
            this.timer += dt;
            if (this.timer >= 1.5) {
                this.phase = "results";
                this.timer = 0;
            }
            return null;
        }

        // Running phase
        this.legFrame += dt * this.velX * 0.1;

        // Speed progression
        if (this.velX < 100) this.velX += 30 * dt;
        else if (this.velX < 150) this.velX += 15 * dt;
        else if (this.velX < 200) this.velX += 8 * dt;
        else this.velX += 3 * dt;
        this.velX = Math.min(RUN_MAX_SPEED, this.velX);

        // Stumble recovery
        if (this.stumbled) {
            this.stumbleTimer -= dt;
            if (this.stumbleTimer <= 0) this.stumbled = false;
        }

        // Jump input
        if (Input.getKeyDown("Space") || Input.getKeyDown("Up") || Input.getKeyDown("w")) {
            if (this.onGround) {
                this.jumping = true;
                this.jumpTimer = 0;
                this.velY = RUN_SHORT_JUMP;
                this.onGround = false;
                Audio.play(SFX.JUMP, 0.4);
            }
        }

        // Hold jump for higher
        if (this.jumping && (Input.getKey("Space") || Input.getKey("Up") || Input.getKey("w"))) {
            this.jumpTimer += dt;
            if (this.jumpTimer < JUMP_HOLD_MAX) {
                this.velY = RUN_JUMP_VEL;
            } else {
                this.jumping = false;
            }
        }
        if (Input.getKeyUp("Space") || Input.getKeyUp("Up") || Input.getKeyUp("w")) {
            this.jumping = false;
        }

        // Gravity
        this.velY += RUN_GRAVITY * dt;
        if (this.velY > RUN_MAX_FALL) this.velY = RUN_MAX_FALL;

        // Move
        this.scrollX += this.velX * dt;
        this.distance = this.scrollX / 10;
        this.playerY += this.velY * dt;

        // Platform collision (from above)
        this.onGround = false;
        var worldPlayerX = this.playerX + this.scrollX;
        for (var i = 0; i < this.platforms.length; i++) {
            var p = this.platforms[i];
            if (worldPlayerX + PLAYER_W > p.x && worldPlayerX < p.x + p.w) {
                if (this.playerY + PLAYER_H >= p.y && this.playerY + PLAYER_H <= p.y + 15 && this.velY >= 0) {
                    this.playerY = p.y - PLAYER_H;
                    this.velY = 0;
                    this.onGround = true;
                    break;
                }
            }
        }

        // Obstacle collision
        for (var i = 0; i < this.obstacles.length; i++) {
            var obs = this.obstacles[i];
            if (obs.hit) continue;
            var ox = obs.x - this.scrollX;
            if (Math.abs(this.playerX + PLAYER_W / 2 - ox) < (PLAYER_W + obs.w) / 2 &&
                this.playerY + PLAYER_H > obs.y && this.playerY < obs.y + obs.h) {
                obs.hit = true;
                this.velX *= STUMBLE_MULT;
                this.stumbled = true;
                this.stumbleTimer = 0.5;
                Audio.play(SFX.STUMBLE, 0.5);
            }
        }

        // Fell off screen
        if (this.playerY > 280) {
            this.dead = true;
            this.timer = 0;
        }

        // Reached target
        if (this.distance >= TARGET_DIST) {
            this.phase = "results";
            this.timer = 0;
        }

        // Generate more platforms ahead
        var lastPlat = this.platforms[this.platforms.length - 1];
        while (lastPlat.x + lastPlat.w - this.scrollX < 400) {
            var gap = PLATFORM_GAP_MIN + Math.random() * (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN);
            gap *= (1 + this.velX / RUN_MAX_SPEED * 0.5);
            var pw = PLATFORM_MIN_W + Math.random() * (PLATFORM_MAX_W - PLATFORM_MIN_W);
            var py = GROUND_Y + (Math.random() - 0.5) * PLATFORM_H_VAR;
            py = Math.max(GROUND_Y - 30, Math.min(GROUND_Y + 20, py));
            var nx = lastPlat.x + lastPlat.w + gap;
            this.platforms.push({ x: nx, y: py, w: pw, type: "roof" });
            if (Math.random() < OBSTACLE_CHANCE) {
                this.obstacles.push({
                    x: nx + pw * 0.3 + Math.random() * pw * 0.4,
                    y: py - 10, w: 6, h: 10, hit: false
                });
            }
            lastPlat = this.platforms[this.platforms.length - 1];
        }

        // Cleanup old platforms
        while (this.platforms.length > 0 && this.platforms[0].x + this.platforms[0].w < this.scrollX - 100) {
            this.platforms.shift();
        }
        while (this.obstacles.length > 0 && this.obstacles[0].x < this.scrollX - 100) {
            this.obstacles.shift();
        }

        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        var V = C.viewport(screenW, screenH);
        this._vp = V;

        // Grey sky (urban/industrial) — fullscreen
        Draw2D.fillRect(0, 0, screenW, screenH, 0.18, 0.18, 0.22, 1, -5);

        // Parallax city silhouette — game-space (base y=140, above GROUND_Y=190)
        var parallax = this.scrollX * 0.1;
        for (var b = 0; b < 8; b++) {
            var bx = (b * 50 - parallax % 400 + 400) % 400 - 50;
            var bh = 30 + (b * 17) % 40;
            Draw2D.fillRect(V.x(bx), V.y(140 - bh), V.s(35), V.s(bh), 0.12, 0.12, 0.16, 1);
        }

        if (this.phase === "ready") {
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.25, "MURTOMAAJUOKSU", 0.94, 0.75, 0.25, 1, F.HEADING);
            Draw2D.drawText(screenW / 2 - 90, screenH * 0.40, "Bus broke down! Run to the phone booth!", 0.75, 0.75, 0.82, 1, F.SMALL);
            Draw2D.drawText(screenW / 2 - 60, screenH * 0.50, "[SPACE] Jump  (hold = higher)", 0.50, 0.50, 0.63, 1, F.BODY);
            var blink = Math.sin(this.timer * 4) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 1, 1, 1, 1, F.UI);
            return;
        }

        // Draw platforms — game-space through viewport
        for (var i = 0; i < this.platforms.length; i++) {
            var p = this.platforms[i];
            var px = p.x - this.scrollX;
            if (px > 340 || px + p.w < -20) continue;
            Draw2D.fillRect(V.x(px), V.y(p.y), V.s(p.w), V.s(40), 0.25, 0.22, 0.20, 1);
            Draw2D.fillRect(V.x(px), V.y(p.y), V.s(p.w), V.s(3), 0.40, 0.35, 0.30, 1);
            // Detail lines
            for (var d = 0; d < p.w; d += 16) {
                Draw2D.drawLine(V.x(px + d), V.y(p.y + 3), V.x(px + d), V.y(p.y + 40), 0.20, 0.18, 0.16, 0.3, V.s(1));
            }
        }

        // Draw obstacles — game-space through viewport
        for (var i = 0; i < this.obstacles.length; i++) {
            var obs = this.obstacles[i];
            var ox = obs.x - this.scrollX;
            if (ox > 340 || ox < -20) continue;
            if (!obs.hit) {
                Draw2D.fillRect(V.x(ox - obs.w / 2), V.y(obs.y), V.s(obs.w), V.s(obs.h), 0.55, 0.45, 0.35, 1);
                Draw2D.drawRect(V.x(ox - obs.w / 2), V.y(obs.y), V.s(obs.w), V.s(obs.h), 0.70, 0.55, 0.40, 1, V.s(1));
            }
        }

        // Draw player
        if (!this.dead) {
            this.drawPlayer(screenW, screenH);
        }

        // HUD
        this.drawRunHUD(screenW, screenH);

        if (this.phase === "results") {
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.55);
            this.drawResults(screenW, screenH);
        }
    },

    drawPlayer: function(screenW, screenH) {
        var V = this._vp;
        var px = this.playerX;
        var py = this.playerY;
        var alpha = this.stumbled ? (Math.sin(this.stumbleTimer * 20) > 0 ? 1 : 0.3) : 1;

        // Body
        Draw2D.fillRect(V.x(px), V.y(py), V.s(PLAYER_W), V.s(PLAYER_H - 4), 0.20, 0.35, 0.65, alpha);
        // Head
        Draw2D.fillRect(V.x(px + 1), V.y(py - 4), V.s(PLAYER_W - 2), V.s(5), 0.85, 0.70, 0.55, alpha);
        // Legs (animated)
        var leg = Math.sin(this.legFrame) > 0;
        if (this.onGround) {
            Draw2D.fillRect(V.x(px + 1), V.y(py + PLAYER_H - 4), V.s(3), V.s(4), 0.15, 0.15, 0.15, alpha);
            Draw2D.fillRect(V.x(px + PLAYER_W - 4), V.y(py + PLAYER_H - 4 + (leg ? -1 : 1)), V.s(3), V.s(4), 0.15, 0.15, 0.15, alpha);
        } else {
            // Airborne pose
            Draw2D.fillRect(V.x(px + 1), V.y(py + PLAYER_H - 4), V.s(3), V.s(3), 0.15, 0.15, 0.15, alpha);
            Draw2D.fillRect(V.x(px + PLAYER_W - 4), V.y(py + PLAYER_H - 3), V.s(3), V.s(3), 0.15, 0.15, 0.15, alpha);
        }
    },

    drawRunHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 18, 0, 0, 0, 0.6);
        Draw2D.drawText(5, 3, Math.floor(this.distance) + "m / " + TARGET_DIST + "m", 0.75, 0.75, 0.88, 1, F.BODY);
        var speedPct = Math.floor(this.velX / RUN_MAX_SPEED * 100);
        Draw2D.drawText(screenW - 70, 3, "Speed: " + speedPct + "%", 0.94, 0.75, 0.25, 1, F.SMALL);

        // Distance progress bar
        var prog = Math.min(1, this.distance / TARGET_DIST);
        Draw2D.fillRect(screenW * 0.3, 8, screenW * 0.4, 4, 0.15, 0.15, 0.20, 1);
        Draw2D.fillRect(screenW * 0.3, 8, screenW * 0.4 * prog, 4, 0.25, 0.65, 0.25, 1);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.12;
        var won = !this.dead && this.distance >= TARGET_DIST;

        Draw2D.drawText(screenW / 2 - 60, cy,
            won ? "PHONE REACHED!" : "GAME OVER!",
            0.94, 0.75, 0.25, 1, F.HEADING);
        cy += 30;

        Draw2D.drawText(30, cy, "Distance: " + Math.floor(this.distance) + "m", 0.75, 0.75, 0.88, 1, F.UI);
        cy += 25;

        var flavor = "";
        if (won) {
            flavor = "You reach the phone booth! Help is on the way.";
            this.gs.resources.morale = Math.min(100, this.gs.resources.morale + 10);
        } else {
            flavor = "You didn't make it. The band waits by the bus.";
            this.gs.resources.morale = Math.max(0, this.gs.resources.morale - 10);
        }
        Draw2D.drawText(30, cy, flavor, 0.62, 0.62, 0.75, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = RunnerSystem;
