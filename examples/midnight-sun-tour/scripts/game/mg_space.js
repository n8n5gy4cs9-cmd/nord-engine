// ============================================================================
// AVARUUSHYOKKAYS — Space Invaders with glow + vector/stroke graphics
// No sprites — everything drawn with lines, rects, circles + additive glow
// Usage: var Space = require("./mg_space.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;

var FIELD_L = 20;
var FIELD_R = 300;
var FIELD_T = 30;
var FIELD_B = 246;
var PLAYER_W = 16;
var PLAYER_H = 8;
var PLAYER_SPEED = 120;
var BULLET_SPEED = 200;
var BULLET_W = 2;
var BULLET_H = 6;
var ENEMY_COLS = 8;
var ENEMY_ROWS = 4;
var ENEMY_W = 14;
var ENEMY_H = 10;
var ENEMY_SPACING_X = 22;
var ENEMY_SPACING_Y = 16;
var ENEMY_DROP = 8;
var ENEMY_BULLET_SPEED = 90;
var ENEMY_FIRE_CHANCE = 0.008;  // per enemy per frame
var WAVE_SPEED_BASE = 18;
var WAVE_SPEED_INC = 4;        // per killed enemy, speeds up
var MAX_PLAYER_BULLETS = 3;
var GAME_DURATION = 90;

var SpaceSystem = {
    phase: "ready",
    timer: 0,
    score: 0,
    lives: 3,
    playerX: 0,
    playerBullets: [],
    enemyBullets: [],
    enemies: [],
    enemyDir: 1,
    enemyMoveTimer: 0,
    explosions: [],
    wave: 1,
    gs: null,
    glowPulse: 0,    // for glow effect cycling

    start: function(gameState) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.ARCADE, true);
        this.phase = "ready";
        this.timer = 0;
        this.score = 0;
        this.lives = 3;
        this.playerX = (FIELD_L + FIELD_R) / 2;
        this.playerBullets = [];
        this.enemyBullets = [];
        this.explosions = [];
        this.wave = 1;
        this.glowPulse = 0;
        this.spawnWave();
        console.log("[Space] Avaruushyokkays started!");
    },

    spawnWave: function() {
        this.enemies = [];
        this.enemyDir = 1;
        this.enemyMoveTimer = 0;
        var startX = FIELD_L + 20;
        var startY = FIELD_T + 10;
        for (var r = 0; r < ENEMY_ROWS; r++) {
            for (var c = 0; c < ENEMY_COLS; c++) {
                this.enemies.push({
                    x: startX + c * ENEMY_SPACING_X,
                    y: startY + r * ENEMY_SPACING_Y,
                    alive: true,
                    type: r,    // 0=top row (more points), 3=bottom
                    flash: 0
                });
            }
        }
    },

    // Returns null or { done: true }
    update: function(dt) {
        this.glowPulse += dt * 3.0;

        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0) {
                this.phase = "playing";
                this.timer = 0;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                var cashWon = Math.floor(this.score / 5);
                this.gs.resources.cash += cashWon;
                return { done: true, score: this.score, cashWon: cashWon };
            }
            return null;
        }

        // Playing
        this.timer += dt;

        // Update explosions
        for (var i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].t -= dt;
            if (this.explosions[i].t <= 0) this.explosions.splice(i, 1);
        }

        // Player movement
        if (Input.getKey("Left") || Input.getKey("a")) {
            this.playerX -= PLAYER_SPEED * dt;
        }
        if (Input.getKey("Right") || Input.getKey("d")) {
            this.playerX += PLAYER_SPEED * dt;
        }
        this.playerX = Math.max(FIELD_L + PLAYER_W / 2, Math.min(FIELD_R - PLAYER_W / 2, this.playerX));

        // Player fire
        if (Input.getKeyDown("Space") || Input.getKeyDown("Up") || Input.getKeyDown("w")) {
            if (this.playerBullets.length < MAX_PLAYER_BULLETS) {
                this.playerBullets.push({ x: this.playerX, y: FIELD_B - 18 });
                Audio.play(SFX.LASER_SHOOT, 0.3);
            }
        }

        // Update player bullets
        for (var i = this.playerBullets.length - 1; i >= 0; i--) {
            this.playerBullets[i].y -= BULLET_SPEED * dt;
            if (this.playerBullets[i].y < FIELD_T) {
                this.playerBullets.splice(i, 1);
                continue;
            }
            // Hit test against enemies
            var b = this.playerBullets[i];
            if (!b) continue;
            var hitEnemy = false;
            for (var e = 0; e < this.enemies.length; e++) {
                var en = this.enemies[e];
                if (!en.alive) continue;
                if (b.x > en.x - ENEMY_W / 2 && b.x < en.x + ENEMY_W / 2 &&
                    b.y > en.y - ENEMY_H / 2 && b.y < en.y + ENEMY_H / 2) {
                    en.alive = false;
                    hitEnemy = true;
                    this.score += (4 - en.type) * 10;
                    this.explosions.push({ x: en.x, y: en.y, t: 0.4 });
                    Audio.play(SFX.ALIEN_HIT, 0.4);
                    break;
                }
            }
            if (hitEnemy) {
                this.playerBullets.splice(i, 1);
            }
        }

        // Enemy movement (step-based like classic invaders)
        var aliveCount = 0;
        for (var i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].alive) aliveCount++;
        }

        if (aliveCount === 0) {
            this.wave++;
            this.spawnWave();
            return null;
        }

        var moveInterval = Math.max(0.05, 0.5 - (ENEMY_COLS * ENEMY_ROWS - aliveCount) * 0.012);
        this.enemyMoveTimer += dt;
        if (this.enemyMoveTimer >= moveInterval) {
            this.enemyMoveTimer -= moveInterval;
            var stepX = WAVE_SPEED_BASE + (ENEMY_COLS * ENEMY_ROWS - aliveCount) * WAVE_SPEED_INC * 0.1;
            var needDrop = false;

            for (var i = 0; i < this.enemies.length; i++) {
                if (!this.enemies[i].alive) continue;
                if ((this.enemies[i].x + stepX * this.enemyDir > FIELD_R - 10) ||
                    (this.enemies[i].x + stepX * this.enemyDir < FIELD_L + 10)) {
                    needDrop = true;
                    break;
                }
            }

            if (needDrop) {
                this.enemyDir *= -1;
                for (var i = 0; i < this.enemies.length; i++) {
                    if (this.enemies[i].alive) this.enemies[i].y += ENEMY_DROP;
                }
            } else {
                for (var i = 0; i < this.enemies.length; i++) {
                    if (this.enemies[i].alive) this.enemies[i].x += stepX * this.enemyDir;
                }
            }
        }

        // Enemy firing
        for (var i = 0; i < this.enemies.length; i++) {
            var en = this.enemies[i];
            if (!en.alive) continue;
            if (Math.random() < ENEMY_FIRE_CHANCE) {
                this.enemyBullets.push({ x: en.x, y: en.y + ENEMY_H / 2 });
            }
        }

        // Update enemy bullets
        for (var i = this.enemyBullets.length - 1; i >= 0; i--) {
            this.enemyBullets[i].y += ENEMY_BULLET_SPEED * dt;
            if (this.enemyBullets[i].y > FIELD_B) {
                this.enemyBullets.splice(i, 1);
                continue;
            }
            // Hit test player
            var eb = this.enemyBullets[i];
            if (!eb) continue;
            if (eb.x > this.playerX - PLAYER_W / 2 && eb.x < this.playerX + PLAYER_W / 2 &&
                eb.y > FIELD_B - 18 && eb.y < FIELD_B - 10) {
                this.lives--;
                this.enemyBullets.splice(i, 1);
                this.explosions.push({ x: this.playerX, y: FIELD_B - 14, t: 0.5 });
                Audio.play(SFX.ALIEN_BOMB, 0.5);
                if (this.lives <= 0) {
                    this.phase = "results";
                    this.timer = 0;
                }
            }
        }

        // Enemy reached bottom
        for (var i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].alive && this.enemies[i].y > FIELD_B - 25) {
                this.lives = 0;
                this.phase = "results";
                this.timer = 0;
                return null;
            }
        }

        // Time limit
        if (this.timer >= GAME_DURATION) {
            this.phase = "results";
            this.timer = 0;
        }
        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        var V = C.viewport(screenW, screenH);
        this._vp = V;

        // Deep space background
        Draw2D.fillRect(0, 0, screenW, screenH, 0.02, 0.01, 0.06, 1, -5);

        // Starfield (static seeded by position)
        for (var i = 0; i < 40; i++) {
            var sx = ((i * 137 + 53) % 280) + 20;
            var sy = ((i * 97 + 31) % 230) + 15;
            var sb = 0.3 + 0.3 * Math.sin(this.glowPulse + i);
            Draw2D.fillRect(V.x(sx), V.y(sy), V.s(1), V.s(1), sb, sb, sb * 1.2, 1);
        }

        if (this.phase === "ready") {
            this.drawField(screenW, screenH);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.3, "AVARUUSHYOKKAYS", 0.3, 0.9, 0.3, 1, F.HEADING);
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.45, "Destroy the alien fleet!", 0.5, 0.8, 0.5, 1, F.BODY);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.55, "[LEFT/RIGHT] Move  [SPACE] Fire", 0.3, 0.5, 0.3, 1, F.BODY);
            var blink = Math.sin(this.timer * 4) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 0.3, 1, 0.3, 1, F.UI);

        } else if (this.phase === "playing") {
            this.drawField(screenW, screenH);
            this.drawEnemies(screenW, screenH);
            this.drawPlayer(screenW, screenH);
            this.drawBullets(screenW, screenH);
            this.drawExplosions(screenW, screenH);
            this.drawPlayHUD(screenW, screenH);

        } else if (this.phase === "results") {
            this.drawField(screenW, screenH);
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.65);
            this.drawResultsScreen(screenW, screenH);
        }
    },

    drawField: function(screenW, screenH) {
        var V = this._vp;
        // Scanline border (vector style)
        Draw2D.drawRect(V.x(FIELD_L), V.y(FIELD_T), V.s(FIELD_R - FIELD_L), V.s(FIELD_B - FIELD_T),
            0.1, 0.4, 0.1, 0.6, V.s(1));
    },

    drawPlayer: function(screenW, screenH) {
        var V = this._vp;
        var px = this.playerX;
        var py = FIELD_B - 14;
        var glow = 0.5 + 0.2 * Math.sin(this.glowPulse);

        // Glow halo
        Draw2D.fillRect(V.x(px - PLAYER_W / 2 - 3), V.y(py - 2), V.s(PLAYER_W + 6), V.s(PLAYER_H + 4),
            0, 0.3, 0.8, 0.15 * glow);

        // Ship body — vector style (rects + lines)
        Draw2D.fillRect(V.x(px - PLAYER_W / 2), V.y(py), V.s(PLAYER_W), V.s(PLAYER_H), 0.1, 0.2, 0.4, 1);
        Draw2D.drawRect(V.x(px - PLAYER_W / 2), V.y(py), V.s(PLAYER_W), V.s(PLAYER_H), 0.3, 0.7, 1.0, 0.9, V.s(1));
        // Cockpit
        Draw2D.fillRect(V.x(px - 2), V.y(py - 3), V.s(4), V.s(4), 0.3, 0.8, 1.0, 1);
        Draw2D.drawRect(V.x(px - 2), V.y(py - 3), V.s(4), V.s(4), 0.5, 0.9, 1.0, 0.8, V.s(1));
        // Wing tips
        Draw2D.drawLine(V.x(px - PLAYER_W / 2), V.y(py + PLAYER_H), V.x(px - PLAYER_W / 2 - 3), V.y(py + PLAYER_H + 2),
            0.3, 0.7, 1.0, 0.6, V.s(1));
        Draw2D.drawLine(V.x(px + PLAYER_W / 2), V.y(py + PLAYER_H), V.x(px + PLAYER_W / 2 + 3), V.y(py + PLAYER_H + 2),
            0.3, 0.7, 1.0, 0.6, V.s(1));
        // Engine glow
        Draw2D.fillRect(V.x(px - 3), V.y(py + PLAYER_H), V.s(6), V.s(2), 0.2, 0.5 + glow * 0.5, 1.0, 0.8);
    },

    drawEnemies: function(screenW, screenH) {
        var V = this._vp;
        for (var i = 0; i < this.enemies.length; i++) {
            var en = this.enemies[i];
            if (!en.alive) continue;

            var glow = 0.5 + 0.2 * Math.sin(this.glowPulse + i * 0.5);
            var hw = ENEMY_W / 2;
            var hh = ENEMY_H / 2;

            // Type-based colors (all vector/glow style)
            var cr, cg, cb;
            if (en.type === 0) { cr = 1.0; cg = 0.2; cb = 0.2; }       // red — top row
            else if (en.type === 1) { cr = 1.0; cg = 0.6; cb = 0.1; }   // orange
            else if (en.type === 2) { cr = 0.8; cg = 0.8; cb = 0.2; }   // yellow
            else { cr = 0.4; cg = 0.9; cb = 0.3; }                       // green — bottom row

            // Glow halo
            Draw2D.fillRect(V.x(en.x - hw - 2), V.y(en.y - hh - 2), V.s(ENEMY_W + 4), V.s(ENEMY_H + 4),
                cr * 0.3, cg * 0.3, cb * 0.3, 0.2 * glow);

            // Body (vector outline + fill)
            Draw2D.fillRect(V.x(en.x - hw), V.y(en.y - hh), V.s(ENEMY_W), V.s(ENEMY_H), cr * 0.15, cg * 0.15, cb * 0.15, 1);
            Draw2D.drawRect(V.x(en.x - hw), V.y(en.y - hh), V.s(ENEMY_W), V.s(ENEMY_H), cr, cg, cb, 0.8, V.s(1));

            // Eyes (two small rects)
            Draw2D.fillRect(V.x(en.x - 3), V.y(en.y - 1), V.s(2), V.s(2), cr, cg, cb, 1);
            Draw2D.fillRect(V.x(en.x + 1), V.y(en.y - 1), V.s(2), V.s(2), cr, cg, cb, 1);

            // Antennae (lines)
            Draw2D.drawLine(V.x(en.x - 3), V.y(en.y - hh), V.x(en.x - 5), V.y(en.y - hh - 3), cr, cg, cb, 0.6, V.s(1));
            Draw2D.drawLine(V.x(en.x + 3), V.y(en.y - hh), V.x(en.x + 5), V.y(en.y - hh - 3), cr, cg, cb, 0.6, V.s(1));

            // Legs (bottom lines)
            Draw2D.drawLine(V.x(en.x - hw), V.y(en.y + hh), V.x(en.x - hw - 2), V.y(en.y + hh + 2), cr, cg, cb, 0.5, V.s(1));
            Draw2D.drawLine(V.x(en.x + hw), V.y(en.y + hh), V.x(en.x + hw + 2), V.y(en.y + hh + 2), cr, cg, cb, 0.5, V.s(1));
        }
    },

    drawBullets: function(screenW, screenH) {
        var V = this._vp;
        // Player bullets — bright cyan with glow
        for (var i = 0; i < this.playerBullets.length; i++) {
            var b = this.playerBullets[i];
            // Glow
            Draw2D.fillRect(V.x(b.x - 3), V.y(b.y - 1), V.s(6), V.s(BULLET_H + 2), 0, 0.4, 0.8, 0.2);
            // Core
            Draw2D.fillRect(V.x(b.x - BULLET_W / 2), V.y(b.y), V.s(BULLET_W), V.s(BULLET_H), 0.4, 0.9, 1.0, 1);
        }

        // Enemy bullets — red/orange with glow
        for (var i = 0; i < this.enemyBullets.length; i++) {
            var eb = this.enemyBullets[i];
            Draw2D.fillRect(V.x(eb.x - 3), V.y(eb.y - 1), V.s(6), V.s(BULLET_H + 2), 0.8, 0.2, 0, 0.2);
            Draw2D.fillRect(V.x(eb.x - BULLET_W / 2), V.y(eb.y), V.s(BULLET_W), V.s(BULLET_H), 1.0, 0.5, 0.1, 1);
        }
    },

    drawExplosions: function(screenW, screenH) {
        var V = this._vp;
        for (var i = 0; i < this.explosions.length; i++) {
            var ex = this.explosions[i];
            var frac = ex.t / 0.4;
            var r = 8 * (1 - frac) + 4;

            // Expanding glow ring
            Draw2D.drawCircle(V.x(ex.x), V.y(ex.y), V.s(r + 4), 1.0, 0.6, 0.1, 0.15 * frac);
            Draw2D.drawCircle(V.x(ex.x), V.y(ex.y), V.s(r), 1.0, 0.8, 0.3, 0.5 * frac);
            Draw2D.drawCircle(V.x(ex.x), V.y(ex.y), V.s(r + 2), 1.0, 0.4, 0.1, 0.6 * frac, 1);

            // Debris lines
            for (var d = 0; d < 6; d++) {
                var angle = d * 1.047 + ex.x * 0.1;
                var dist = (1 - frac) * 12;
                var lx = ex.x + Math.cos(angle) * dist;
                var ly = ex.y + Math.sin(angle) * dist;
                Draw2D.drawLine(V.x(ex.x), V.y(ex.y), V.x(lx), V.y(ly), 1, 0.7, 0.2, 0.4 * frac, V.s(1));
            }
        }
    },

    drawPlayHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 22, 0, 0, 0, 0.7);
        Draw2D.drawText(5, 4, "SCORE: " + this.score, 0.3, 0.9, 0.3, 1, F.BODY);
        Draw2D.drawText(screenW / 2 - 25, 4, "WAVE " + this.wave, 0.9, 0.9, 0.3, 1, F.BODY);

        // Lives as small ship icons
        for (var i = 0; i < this.lives; i++) {
            var lx = screenW - 50 + i * 14;
            Draw2D.fillRect(lx, 6, 8, 5, 0.1, 0.3, 0.6, 1);
            Draw2D.drawRect(lx, 6, 8, 5, 0.3, 0.7, 1.0, 0.8, 1);
        }

        // Time
        var timeLeft = Math.max(0, Math.ceil(GAME_DURATION - this.timer));
        Draw2D.drawText(screenW - 95, 4, timeLeft + "s", 0.5, 0.5, 0.6, 1, F.BODY);
    },

    drawResultsScreen: function(screenW, screenH) {
        var cy = screenH * 0.12;
        var win = this.lives > 0;

        // Glowing title
        var glow = 0.5 + 0.3 * Math.sin(this.glowPulse);
        var title = win ? "MISSION COMPLETE" : "GAME OVER";
        Draw2D.drawText(screenW / 2 - 70, cy, title,
            0.3 * glow + 0.5, 0.9, 0.3 * glow + 0.3, 1, 0.9);
        cy += 35;

        Draw2D.drawText(30, cy, "Final Score: " + this.score, 0.3, 0.9, 0.3, 1, F.UI);
        cy += 20;
        Draw2D.drawText(30, cy, "Waves cleared: " + (this.wave - 1), 0.5, 0.8, 0.5, 1, F.BODY);
        cy += 20;

        var cashWon = Math.floor(this.score / 5);
        if (cashWon > 0) {
            Draw2D.drawText(30, cy, "Prize: " + cashWon + " EUR", 0.25, 0.88, 0.25, 1, F.UI);
        }

        cy += 30;
        var flavor = "";
        if (this.score >= 500) flavor = "Risto: 'I could do that with my eyes closed.'";
        else if (this.score >= 200) flavor = "Pekka: 'Not bad for a bass player.'";
        else flavor = "Hannele: 'Maybe stick to music.'";
        Draw2D.drawText(30, cy, flavor, 0.5, 0.5, 0.6, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.3, 0.5, 0.3, 1, F.BODY);
    }
};

module.exports = SpaceSystem;
