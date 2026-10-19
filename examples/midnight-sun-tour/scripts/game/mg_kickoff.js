// ============================================================================
// KICKOFF — Sensible Soccer-style 4v4 top-down football
// Ref: kickoff-master (LibGDX) — drag physics, circle collision
// Usage: var Kickoff = require("./mg_kickoff.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;

var MATCH_TIME = 60;     // seconds
var FIELD_X = 30;
var FIELD_Y = 20;
var FIELD_W = 260;
var FIELD_H = 216;
var GOAL_W = 40;
var GOAL_H = 6;
var PLAYER_SPEED = 110;
var PLAYER_R = 6;
var BALL_R = 4;
var BALL_DRAG = 0.82;    // K/M simplified
var KICK_POWER = 260;
var DRIBBLE_POWER = 140;
var AI_SPEED = 78;

var KickoffSystem = {
    phase: "ready",
    timer: 0,
    matchTimer: 0,
    scoreA: 0,    // player team
    scoreB: 0,    // AI team
    ball: null,
    players: [],
    aiPlayers: [],
    gs: null,
    goalFlash: 0,
    goalText: "",
    kickoffDelay: 0,

    start: function(gameState) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.KICKOFF, true);
        this.phase = "ready";
        this.timer = 0;
        this.matchTimer = MATCH_TIME;
        this.scoreA = 0;
        this.scoreB = 0;
        this.goalFlash = 0;
        this.goalText = "";
        this.kickoffDelay = 0;
        this.resetPositions();
        console.log("[Kickoff] Match started!");
    },

    resetPositions: function() {
        var cx = FIELD_X + FIELD_W / 2;
        var cy = FIELD_Y + FIELD_H / 2;

        this.ball = { x: cx, y: cy, vx: 0, vy: 0 };

        // Player team (left side, blue)
        this.players = [
            { x: cx - 80, y: cy, ctrl: true },     // controlled player
            { x: cx - 50, y: cy - 40, ctrl: false },
            { x: cx - 50, y: cy + 40, ctrl: false },
            { x: cx - 110, y: cy, ctrl: false }     // goalkeeper
        ];

        // AI team (right side, red)
        this.aiPlayers = [
            { x: cx + 80, y: cy, tx: 0, ty: 0 },
            { x: cx + 50, y: cy - 40, tx: 0, ty: 0 },
            { x: cx + 50, y: cy + 40, tx: 0, ty: 0 },
            { x: cx + 110, y: cy, tx: 0, ty: 0 }   // goalkeeper
        ];
    },

    dist: function(ax, ay, bx, by) {
        var dx = ax - bx;
        var dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    },

    // Returns null or { done: true }
    update: function(dt) {
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
                var cashWon = 0;
                if (this.scoreA > this.scoreB) cashWon = 50 + this.scoreA * 20;
                else if (this.scoreA === this.scoreB) cashWon = 25;
                if (cashWon > 0) this.gs.resources.cash += cashWon;
                var moraleGain = this.scoreA > this.scoreB ? 10 : (this.scoreA === this.scoreB ? 3 : 0);
                return { done: true, won: this.scoreA > this.scoreB, cashWon: cashWon, moraleGain: moraleGain };
            }
            return null;
        }

        if (this.phase === "goal") {
            this.goalFlash -= dt;
            if (this.goalFlash <= 0) {
                this.resetPositions();
                this.kickoffDelay = 1.0;
                this.phase = "playing";
            }
            return null;
        }

        // Playing phase
        if (this.kickoffDelay > 0) {
            this.kickoffDelay -= dt;
            return null;
        }

        this.matchTimer -= dt;
        if (this.matchTimer <= 0) {
            this.matchTimer = 0;
            this.phase = "results";
            this.timer = 0;
            Audio.play(SFX.WHISTLE, 0.6);
            return null;
        }

        // Player input — controlled player
        var cp = this.players[0];
        var dx = 0;
        var dy = 0;
        if (Input.getKey("Left") || Input.getKey("a")) dx -= 1;
        if (Input.getKey("Right") || Input.getKey("d")) dx += 1;
        if (Input.getKey("Up") || Input.getKey("w")) dy -= 1;
        if (Input.getKey("Down") || Input.getKey("s")) dy += 1;
        if (dx !== 0 || dy !== 0) {
            var len = Math.sqrt(dx * dx + dy * dy);
            cp.x += (dx / len) * PLAYER_SPEED * dt;
            cp.y += (dy / len) * PLAYER_SPEED * dt;
        }

        // Clamp player to field
        cp.x = Math.max(FIELD_X + PLAYER_R, Math.min(FIELD_X + FIELD_W - PLAYER_R, cp.x));
        cp.y = Math.max(FIELD_Y + PLAYER_R, Math.min(FIELD_Y + FIELD_H - PLAYER_R, cp.y));

        // Kick
        if (Input.getKeyDown("Space") || Input.getKeyDown("Return")) {
            if (this.dist(cp.x, cp.y, this.ball.x, this.ball.y) < PLAYER_R + BALL_R + 4) {
                var kx = this.ball.x - cp.x;
                var ky = this.ball.y - cp.y;
                var klen = Math.sqrt(kx * kx + ky * ky);
                if (klen > 0.1) {
                    this.ball.vx = (kx / klen) * KICK_POWER;
                    this.ball.vy = (ky / klen) * KICK_POWER;
                    Audio.play(SFX.KICK_BALL, 0.5);
                }
            }
        }

        // Dribble: controlled player pushes ball on contact
        if (this.dist(cp.x, cp.y, this.ball.x, this.ball.y) < PLAYER_R + BALL_R) {
            var pushX = this.ball.x - cp.x;
            var pushY = this.ball.y - cp.y;
            var plen = Math.sqrt(pushX * pushX + pushY * pushY);
            if (plen > 0.1) {
                this.ball.vx += (pushX / plen) * DRIBBLE_POWER * dt;
                this.ball.vy += (pushY / plen) * DRIBBLE_POWER * dt;
            }
        }

        // Distance from player to ball — used by friendly AI to back off
        var playerBallDist = this.dist(cp.x, cp.y, this.ball.x, this.ball.y);

        // Friendly AI teammates — role-based
        // [1] = midfielder (hold middle, support), [2] = forward (chase ball), [3] = goalkeeper
        for (var i = 1; i < this.players.length; i++) {
            var p = this.players[i];
            var targetX, targetY;
            var spd = AI_SPEED * 0.6;

            if (i === 3) {
                // Goalkeeper — stay near own goal, track ball Y
                targetX = FIELD_X + 20;
                targetY = Math.max(FIELD_Y + FIELD_H / 2 - 30,
                    Math.min(FIELD_Y + FIELD_H / 2 + 30, this.ball.y));
                spd = AI_SPEED * 0.7;
            } else if (i === 2) {
                // Forward — chases ball but backs off when player is close
                if (playerBallDist < 30) {
                    // Player is handling ball — move toward attacking position
                    targetX = this.ball.x + 40;
                    targetY = this.ball.y + (this.ball.y < FIELD_Y + FIELD_H / 2 ? 30 : -30);
                } else {
                    targetX = this.ball.x;
                    targetY = this.ball.y;
                    spd = AI_SPEED * 0.75;
                }
            } else {
                // Midfielder — hold center-left, lean toward ball Y
                targetX = FIELD_X + FIELD_W * 0.35;
                targetY = FIELD_Y + FIELD_H / 2 + (this.ball.y - FIELD_Y - FIELD_H / 2) * 0.5;
                spd = AI_SPEED * 0.55;
            }

            var tdx = targetX - p.x;
            var tdy = targetY - p.y;
            var tlen = Math.sqrt(tdx * tdx + tdy * tdy);
            if (tlen > 3) {
                p.x += (tdx / tlen) * spd * dt;
                p.y += (tdy / tlen) * spd * dt;
            }

            // Friendly kick — only if player is NOT near the ball
            if (playerBallDist > 25 && this.dist(p.x, p.y, this.ball.x, this.ball.y) < PLAYER_R + BALL_R + 1) {
                var goalX = FIELD_X + FIELD_W;
                var goalY = FIELD_Y + FIELD_H / 2 + (Math.random() - 0.5) * GOAL_W * 0.6;
                var gx = goalX - this.ball.x;
                var gy = goalY - this.ball.y;
                var gl = Math.sqrt(gx * gx + gy * gy);
                if (gl > 0.1) {
                    this.ball.vx = (gx / gl) * KICK_POWER * 0.6;
                    this.ball.vy = (gy / gl) * KICK_POWER * 0.6;
                }
            }
        }

        // Enemy AI
        this.updateAI(dt);

        // Separation — push apart overlapping players
        this.separatePlayers(dt);

        // Ball physics (drag)
        this.ball.vx -= BALL_DRAG * this.ball.vx * dt;
        this.ball.vy -= BALL_DRAG * this.ball.vy * dt;
        this.ball.x += this.ball.vx * dt;
        this.ball.y += this.ball.vy * dt;

        // Ball bounce off top/bottom walls
        if (this.ball.y < FIELD_Y + BALL_R) {
            this.ball.y = FIELD_Y + BALL_R;
            this.ball.vy = -this.ball.vy * 0.6;
        }
        if (this.ball.y > FIELD_Y + FIELD_H - BALL_R) {
            this.ball.y = FIELD_Y + FIELD_H - BALL_R;
            this.ball.vy = -this.ball.vy * 0.6;
        }

        // Goal detection
        var goalY1 = FIELD_Y + FIELD_H / 2 - GOAL_W / 2;
        var goalY2 = FIELD_Y + FIELD_H / 2 + GOAL_W / 2;
        var inGoalY = this.ball.y > goalY1 && this.ball.y < goalY2;

        // Left goal (AI scores)
        if (this.ball.x < FIELD_X + BALL_R && inGoalY) {
            this.scoreB++;
            this.goalFlash = 1.5;
            this.goalText = "GOAL! AI scores!";
            Audio.play(SFX.CROWD_BOO, 0.5);
            this.phase = "goal";
            return null;
        }
        // Right goal (player scores)
        if (this.ball.x > FIELD_X + FIELD_W - BALL_R && inGoalY) {
            this.scoreA++;
            this.goalFlash = 1.5;
            this.goalText = "GOOOL!";
            Audio.play(SFX.GOAL_SCORED, 0.6);
            this.phase = "goal";
            return null;
        }

        // Ball bounce off left/right walls (outside goal area only)
        if (this.ball.x < FIELD_X + BALL_R && !inGoalY) {
            this.ball.x = FIELD_X + BALL_R;
            this.ball.vx = -this.ball.vx * 0.5;
        }
        if (this.ball.x > FIELD_X + FIELD_W - BALL_R && !inGoalY) {
            this.ball.x = FIELD_X + FIELD_W - BALL_R;
            this.ball.vx = -this.ball.vx * 0.5;
        }

        return null;
    },

    updateAI: function(dt) {
        // Red AI: [0] = attacker (chases ball), [1,2] = midfield (support), [3] = goalkeeper
        for (var i = 0; i < this.aiPlayers.length; i++) {
            var ap = this.aiPlayers[i];
            var targetX, targetY;
            var spd = AI_SPEED;

            if (i === 3) {
                // Goalkeeper — track ball Y, stay near goal
                targetX = FIELD_X + FIELD_W - 18;
                targetY = Math.max(FIELD_Y + FIELD_H / 2 - 28,
                    Math.min(FIELD_Y + FIELD_H / 2 + 28, this.ball.y));
                spd = AI_SPEED * 0.8;
            } else if (i === 0) {
                // Main attacker — chase ball directly
                targetX = this.ball.x;
                targetY = this.ball.y;
                spd = AI_SPEED * 0.85;
            } else {
                // Support midfielders — lean toward ball but hold formation
                var homeX = FIELD_X + FIELD_W * 0.6;
                var homeY = FIELD_Y + FIELD_H * (i === 1 ? 0.3 : 0.7);
                targetX = homeX + (this.ball.x - homeX) * 0.4;
                targetY = homeY + (this.ball.y - homeY) * 0.5;
                spd = AI_SPEED * 0.65;
            }

            var adx = targetX - ap.x;
            var ady = targetY - ap.y;
            var alen = Math.sqrt(adx * adx + ady * ady);
            if (alen > 3) {
                ap.x += (adx / alen) * spd * dt;
                ap.y += (ady / alen) * spd * dt;
            }
            ap.x = Math.max(FIELD_X + PLAYER_R, Math.min(FIELD_X + FIELD_W - PLAYER_R, ap.x));
            ap.y = Math.max(FIELD_Y + PLAYER_R, Math.min(FIELD_Y + FIELD_H - PLAYER_R, ap.y));

            // AI kick on ball contact
            if (this.dist(ap.x, ap.y, this.ball.x, this.ball.y) < PLAYER_R + BALL_R + 2) {
                // Kick toward player goal (left)
                var goalX = FIELD_X;
                var goalY = FIELD_Y + FIELD_H / 2 + (Math.random() - 0.5) * GOAL_W * 0.8;
                var gx = goalX - this.ball.x;
                var gy = goalY - this.ball.y;
                var gl = Math.sqrt(gx * gx + gy * gy);
                if (gl > 0.1) {
                    var power = (i === 3) ? KICK_POWER * 0.6 : KICK_POWER * 0.5;
                    this.ball.vx = (gx / gl) * power;
                    this.ball.vy = (gy / gl) * power;
                }
            }
        }
    },

    // Push apart any two overlapping players (all teams)
    separatePlayers: function(dt) {
        var all = [];
        for (var i = 0; i < this.players.length; i++) all.push(this.players[i]);
        for (var i = 0; i < this.aiPlayers.length; i++) all.push(this.aiPlayers[i]);

        var minDist = PLAYER_R * 2.2;
        for (var a = 0; a < all.length; a++) {
            for (var b = a + 1; b < all.length; b++) {
                var d = this.dist(all[a].x, all[a].y, all[b].x, all[b].y);
                if (d < minDist && d > 0.01) {
                    var overlap = (minDist - d) * 0.5;
                    var sx = (all[a].x - all[b].x) / d;
                    var sy = (all[a].y - all[b].y) / d;
                    // Don't push the player-controlled character
                    if (!all[a].ctrl) { all[a].x += sx * overlap; all[a].y += sy * overlap; }
                    if (!all[b].ctrl) { all[b].x -= sx * overlap; all[b].y -= sy * overlap; }
                }
            }
        }
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        this._vp = C.viewport(screenW, screenH);
        // Sky
        Draw2D.fillRect(0, 0, screenW, screenH, 0.15, 0.30, 0.15, 1, -5);

        if (this.phase === "ready") {
            this.drawField(screenW, screenH);
            Draw2D.drawText(screenW / 2 - 50, screenH * 0.3, "KICKOFF!", 0.94, 0.75, 0.25, 1, F.TITLE_BIG);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.45, "4v4 Football! Score more goals!", 0.75, 0.75, 0.82, 1, F.BODY);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.55, "[ARROWS] Move  [SPACE] Kick", 0.50, 0.50, 0.63, 1, F.BODY);
            var blink = Math.sin(this.timer * 4) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 1, 1, 1, 1, F.UI);

        } else if (this.phase === "playing" || this.phase === "goal") {
            this.drawField(screenW, screenH);
            this.drawPlayers(screenW, screenH);
            this.drawBall(screenW, screenH);
            this.drawHUD(screenW, screenH);

            if (this.phase === "goal") {
                var alpha = Math.min(1, this.goalFlash);
                Draw2D.fillRect(0, screenH * 0.35, screenW, 40, 0, 0, 0, 0.6 * alpha);
                Draw2D.drawText(screenW / 2 - 40, screenH * 0.38, this.goalText, 1, 1, 0.3, alpha, F.TITLE);
            }

        } else if (this.phase === "results") {
            this.drawField(screenW, screenH);
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.65);
            this.drawResults(screenW, screenH);
        }
    },

    drawField: function(screenW, screenH) {
        var V = this._vp;
        // Pitch
        Draw2D.fillRect(V.x(FIELD_X), V.y(FIELD_Y), V.s(FIELD_W), V.s(FIELD_H), 0.20, 0.50, 0.15, 1);
        Draw2D.drawRect(V.x(FIELD_X), V.y(FIELD_Y), V.s(FIELD_W), V.s(FIELD_H), 0.75, 0.85, 0.75, 1, V.s(1));

        // Center line + circle
        var cx = FIELD_X + FIELD_W / 2;
        var cy = FIELD_Y + FIELD_H / 2;
        Draw2D.drawLine(V.x(cx), V.y(FIELD_Y), V.x(cx), V.y(FIELD_Y + FIELD_H), 0.75, 0.85, 0.75, 0.5, V.s(1));
        Draw2D.drawCircle(V.x(cx), V.y(cy), V.s(25), 0.75, 0.85, 0.75, 0.4, V.s(1));

        // Goals
        var goalY1 = cy - GOAL_W / 2;
        // Left goal
        Draw2D.drawRect(V.x(FIELD_X - GOAL_H), V.y(goalY1), V.s(GOAL_H), V.s(GOAL_W), 0.85, 0.85, 0.85, 1, V.s(2));
        // Right goal
        Draw2D.drawRect(V.x(FIELD_X + FIELD_W), V.y(goalY1), V.s(GOAL_H), V.s(GOAL_W), 0.85, 0.85, 0.85, 1, V.s(2));

        // Penalty areas
        Draw2D.drawRect(V.x(FIELD_X), V.y(cy - 35), V.s(30), V.s(70), 0.75, 0.85, 0.75, 0.3, V.s(1));
        Draw2D.drawRect(V.x(FIELD_X + FIELD_W - 30), V.y(cy - 35), V.s(30), V.s(70), 0.75, 0.85, 0.75, 0.3, V.s(1));
    },

    drawPlayers: function(screenW, screenH) {
        var V = this._vp;
        // Player team (blue)
        for (var i = 0; i < this.players.length; i++) {
            var p = this.players[i];
            var bright = p.ctrl ? 1.0 : 0.7;
            Draw2D.drawCircle(V.x(p.x), V.y(p.y), V.s(PLAYER_R), 0.2 * bright, 0.4 * bright, 0.85 * bright, 1);
            Draw2D.drawCircle(V.x(p.x), V.y(p.y), V.s(PLAYER_R), 0.3, 0.6, 1.0, 0.8, 1);
            if (p.ctrl) {
                // Arrow indicator
                Draw2D.fillRect(V.x(p.x) - V.s(2), V.y(p.y) - V.s(PLAYER_R + 5), V.s(4), V.s(4), 1, 1, 0.3, 1);
            }
        }

        // AI team (red)
        for (var i = 0; i < this.aiPlayers.length; i++) {
            var ap = this.aiPlayers[i];
            Draw2D.drawCircle(V.x(ap.x), V.y(ap.y), V.s(PLAYER_R), 0.85, 0.25, 0.20, 1);
            Draw2D.drawCircle(V.x(ap.x), V.y(ap.y), V.s(PLAYER_R), 1.0, 0.4, 0.3, 0.8, 1);
        }
    },

    drawBall: function(screenW, screenH) {
        var V = this._vp;
        Draw2D.drawCircle(V.x(this.ball.x), V.y(this.ball.y), V.s(BALL_R), 0.95, 0.95, 0.95, 1);
        Draw2D.drawCircle(V.x(this.ball.x), V.y(this.ball.y), V.s(BALL_R), 0.5, 0.5, 0.5, 0.8, 1);
    },

    drawHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 16, 0, 0, 0, 0.6);
        Draw2D.drawText(5, 2, "YOU: " + this.scoreA, 0.3, 0.6, 1, 1, F.BODY);
        Draw2D.drawText(screenW - 55, 2, "AI: " + this.scoreB, 1, 0.4, 0.3, 1, F.BODY);
        var timeLeft = Math.ceil(this.matchTimer);
        var min = Math.floor(timeLeft / 60);
        var sec = timeLeft % 60;
        var timeStr = min + ":" + (sec < 10 ? "0" : "") + sec;
        Draw2D.drawText(screenW / 2 - 15, 2, timeStr, 0.94, 0.75, 0.25, 1, F.BODY);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.15;
        Draw2D.drawText(screenW / 2 - 55, cy, "FULL TIME!", 0.94, 0.75, 0.25, 1, F.TITLE);
        cy += 35;
        Draw2D.drawText(screenW / 2 - 40, cy, this.scoreA + " — " + this.scoreB, 1, 1, 1, 1, F.TITLE_BIG);
        cy += 35;

        var flavor = "";
        if (this.scoreA > this.scoreB) flavor = "Victory! The crowd goes wild!";
        else if (this.scoreA === this.scoreB) flavor = "A draw. Mikko shrugs.";
        else flavor = "Defeat. Pekka blames the referee.";
        Draw2D.drawText(30, cy, flavor, 0.75, 0.75, 0.82, 1, F.UI);

        cy += 25;
        var cashWon = 0;
        if (this.scoreA > this.scoreB) cashWon = 50 + this.scoreA * 20;
        else if (this.scoreA === this.scoreB) cashWon = 25;
        if (cashWon > 0) {
            Draw2D.drawText(30, cy, "Won " + cashWon + " EUR!", 0.25, 0.88, 0.25, 1, F.UI);
        } else {
            Draw2D.drawText(30, cy, "No prize money.", 0.88, 0.50, 0.25, 1, F.UI);
        }

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = KickoffSystem;
