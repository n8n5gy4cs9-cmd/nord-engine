// ============================================================================
// MOOSE DODGE MINIGAME — extracted from midnight_sun.js §11d
// Top-down driving: bus in 3 lanes, dodge moose + potholes.
// Usage: var Dodge = require("./mg_moosedodge.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var DODGE_DURATION = 15.0;
var DODGE_SCROLL_SPEED = 120;
var DODGE_SPAWN_INTERVAL = 0.8;
var DODGE_OBSTACLE_SPEED = 100;
var DODGE_LANE_WIDTH = 36;
var DODGE_ROAD_X = 110;
var DODGE_BUS_Y = 200;
var DODGE_BUS_W = 20;
var DODGE_BUS_H = 30;

var MooseDodgeSystem = {
    phase: "ready",
    timer: 0,
    lane: 1,
    obstacles: [],
    spawnTimer: 0,
    scrollY: 0,
    damageTaken: 0,
    hits: 0,
    dodged: 0,
    distance: 0,
    invincible: 0,
    route: null,
    gs: null,

    start: function(gameState, route) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.MOOSE_DODGE, true);
        this.route = route;
        this.phase = "ready";
        this.timer = 0;
        this.lane = 1;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.scrollY = 0;
        this.damageTaken = 0;
        this.hits = 0;
        this.dodged = 0;
        this.distance = 0;
        this.invincible = 0;
        console.log("[MooseDodge] Started on route " + route.from + " -> " + route.to);
    },

    spawnObstacle: function() {
        var lane = Math.floor(Math.random() * 3);
        var type = Math.random() < 0.4 ? "moose" : "pothole";

        var tooClose = false;
        for (var i = 0; i < this.obstacles.length; i++) {
            if (this.obstacles[i].lane === lane && this.obstacles[i].y < 30) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) lane = (lane + 1) % 3;

        this.obstacles.push({
            type: type, lane: lane, y: -20, hit: false, counted: false
        });
    },

    // Returns null or { done: true, arrivedCity }
    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0 || Input.getKeyDown("Return")) {
                this.phase = "playing";
                this.timer = 0;
                this.spawnTimer = 0;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true, arrivedCity: this.gs.journey.current_city };
            }
            return null;
        }

        // Playing phase
        this.timer += dt;
        this.distance += DODGE_SCROLL_SPEED * dt;
        this.scrollY += DODGE_SCROLL_SPEED * dt;

        if (this.invincible > 0) this.invincible -= dt;

        if (Input.getKeyDown("Left") || Input.getKeyDown("a")) {
            if (this.lane > 0) this.lane--;
        }
        if (Input.getKeyDown("Right") || Input.getKeyDown("d")) {
            if (this.lane < 2) this.lane++;
        }

        this.spawnTimer += dt;
        if (this.spawnTimer >= DODGE_SPAWN_INTERVAL) {
            this.spawnTimer -= DODGE_SPAWN_INTERVAL;
            this.spawnObstacle();
        }

        for (var i = this.obstacles.length - 1; i >= 0; i--) {
            var obs = this.obstacles[i];
            obs.y += DODGE_OBSTACLE_SPEED * dt;

            if (!obs.hit && this.invincible <= 0) {
                if (obs.lane === this.lane && obs.y >= DODGE_BUS_Y - 10 && obs.y <= DODGE_BUS_Y + DODGE_BUS_H) {
                    obs.hit = true;
                    this.hits++;
                    var dmg = obs.type === "moose" ? 15 : 5;
                    this.damageTaken += dmg;
                    this.gs.bus.condition = Math.max(0, this.gs.bus.condition - dmg);
                    this.invincible = 0.5;
                    Audio.play(obs.type === "moose" ? SFX.MOOSE_GRUNT : SFX.POTHOLE, 0.5);
                    console.log("[MooseDodge] Hit " + obs.type + "! -" + dmg + " condition");
                }
            }

            if (obs.y > 270 && !obs.hit && !obs.counted) {
                obs.counted = true;
                this.dodged++;
            }

            if (obs.y > 300) {
                this.obstacles.splice(i, 1);
            }
        }

        if (this.timer >= DODGE_DURATION || this.gs.bus.condition <= 0) {
            this.phase = "results";
            this.timer = 0;
        }
        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, screenH, 0.12, 0.18, 0.08, 1, -5);
        if (this.phase === "ready") {
            this.drawRoad(screenW, screenH);
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.3, "MOOSE DODGE!", 0.94, 0.75, 0.25, 1, F.TITLE_BIG);
            Draw2D.drawText(screenW / 2 - 90, screenH * 0.45, "Dodge moose and potholes!", 0.75, 0.75, 0.82, 1, F.BODY);
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.55, "[LEFT/RIGHT] Switch lanes", 0.50, 0.50, 0.63, 1, F.BODY);
            var blink = Math.sin(this.timer * 4) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 1, 1, 1, 1, F.UI);

        } else if (this.phase === "playing") {
            this.drawRoad(screenW, screenH);
            this.drawObstacles(screenW, screenH);
            this.drawBus(screenW, screenH);
            this.drawPlayingHUD(screenW, screenH);

        } else if (this.phase === "results") {
            this.drawRoad(screenW, screenH);
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.6);
            this.drawResultsScreen(screenW, screenH);
        }
    },

    drawObstacles: function(screenW, screenH) {
        for (var i = 0; i < this.obstacles.length; i++) {
            var obs = this.obstacles[i];
            if (obs.y < -20 || obs.y > 270) continue;
            var ox = DODGE_ROAD_X + obs.lane * DODGE_LANE_WIDTH + (DODGE_LANE_WIDTH - 14) / 2;
            var oy = obs.y;
            if (obs.hit) {
                Draw2D.fillRect(ox - 2, oy - 2, 18, 18, 1, 0.3, 0.3, 0.4);
            } else if (obs.type === "moose") {
                Draw2D.fillRect(ox, oy, 14, 16, 0.45, 0.30, 0.15, 1);
                Draw2D.fillRect(ox - 3, oy - 4, 5, 5, 0.45, 0.30, 0.15, 1);
                Draw2D.fillRect(ox + 12, oy - 4, 5, 5, 0.45, 0.30, 0.15, 1);
                Draw2D.drawText(ox + 2, oy + 2, "M", 0.9, 0.8, 0.6, 1, F.TINY);
            } else {
                Draw2D.fillRect(ox + 2, oy + 2, 10, 8, 0.10, 0.10, 0.10, 1);
                Draw2D.drawRect(ox + 2, oy + 2, 10, 8, 0.25, 0.25, 0.25, 1, 1);
            }
        }
    },

    drawBus: function(screenW, screenH) {
        var busX = DODGE_ROAD_X + this.lane * DODGE_LANE_WIDTH + (DODGE_LANE_WIDTH - DODGE_BUS_W) / 2;
        var busY = DODGE_BUS_Y;
        var busAlpha = 1;
        if (this.invincible > 0) {
            busAlpha = Math.sin(this.invincible * 20) > 0 ? 1 : 0.3;
        }
        Draw2D.fillRect(busX, busY, DODGE_BUS_W, DODGE_BUS_H, 0.18, 0.35, 0.65, busAlpha);
        Draw2D.drawRect(busX, busY, DODGE_BUS_W, DODGE_BUS_H, 0.25, 0.50, 0.80, busAlpha, 1);
        Draw2D.fillRect(busX + 3, busY + 2, DODGE_BUS_W - 6, 8, 0.50, 0.70, 0.90, busAlpha);
        Draw2D.fillRect(busX - 2, busY + 4, 3, 6, 0.15, 0.15, 0.15, busAlpha);
        Draw2D.fillRect(busX + DODGE_BUS_W - 1, busY + 4, 3, 6, 0.15, 0.15, 0.15, busAlpha);
        Draw2D.fillRect(busX - 2, busY + DODGE_BUS_H - 8, 3, 6, 0.15, 0.15, 0.15, busAlpha);
        Draw2D.fillRect(busX + DODGE_BUS_W - 1, busY + DODGE_BUS_H - 8, 3, 6, 0.15, 0.15, 0.15, busAlpha);
    },

    drawPlayingHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 18, 0, 0, 0, 0.6);
        Draw2D.drawText(5, 3, "Bus: " + this.gs.bus.condition + "%", 0.75, 0.75, 0.88, 1, F.BODY);
        var timeLeft = Math.max(0, Math.ceil(DODGE_DURATION - this.timer));
        Draw2D.drawText(screenW / 2 - 15, 3, "" + timeLeft + "s", 0.94, 0.75, 0.25, 1, F.BODY);
        Draw2D.drawText(screenW - 80, 3, "Dodged: " + this.dodged, 0.25, 0.88, 0.25, 1, F.BODY);
        if (this.invincible > 0.3) {
            Draw2D.fillRect(0, 0, screenW, screenH, 1, 0, 0, 0.15);
        }
    },

    drawResultsScreen: function(screenW, screenH) {
        var cy = screenH * 0.12;
        Draw2D.drawText(screenW / 2 - 70, cy, "ROAD CLEAR!", 0.94, 0.75, 0.25, 1, F.TITLE);
        cy += 35;
        Draw2D.drawText(30, cy, "Obstacles dodged: " + this.dodged, 0.25, 0.88, 0.25, 1, F.UI);
        cy += 22;
        Draw2D.drawText(30, cy, "Hits taken: " + this.hits, 1, 0.3, 0.3, 1, F.UI);
        cy += 22;
        Draw2D.drawText(30, cy, "Bus damage: -" + this.damageTaken + "%", 0.88, 0.50, 0.25, 1, F.UI);
        cy += 22;
        Draw2D.drawText(30, cy, "Bus condition: " + this.gs.bus.condition + "%", 0.75, 0.75, 0.88, 1, F.UI);
        cy += 30;

        var flavor = "";
        if (this.hits === 0) flavor = "Perfect run! Not a scratch!";
        else if (this.damageTaken <= 10) flavor = "Minor scrapes. The bus has seen worse.";
        else if (this.damageTaken <= 30) flavor = "Rough road. Hannele grips the dashboard.";
        else flavor = "Total carnage. Risto spilled his beer. Twice.";
        Draw2D.drawText(30, cy, flavor, 0.75, 0.75, 0.82, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.38, 0.38, 0.50, 1, F.BODY);
    },

    drawRoad: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, DODGE_ROAD_X - 5, screenH, 0.08, 0.20, 0.05, 1);
        var roadRight = DODGE_ROAD_X + DODGE_LANE_WIDTH * 3 + 5;
        Draw2D.fillRect(roadRight, 0, screenW - roadRight, screenH, 0.08, 0.20, 0.05, 1);

        for (var ty = 0; ty < screenH; ty += 22) {
            var treeOff = ((ty + Math.floor(this.scrollY)) % 44) < 22 ? 0.03 : 0;
            Draw2D.fillRect(DODGE_ROAD_X - 35, ty, 25, 18, 0.05 + treeOff, 0.15 + treeOff, 0.03, 1);
            Draw2D.fillRect(roadRight + 8, ty, 25, 18, 0.05 + treeOff, 0.15 + treeOff, 0.03, 1);
        }

        var roadW = DODGE_LANE_WIDTH * 3;
        Draw2D.fillRect(DODGE_ROAD_X, 0, roadW, screenH, 0.22, 0.22, 0.25, 1);
        Draw2D.fillRect(DODGE_ROAD_X - 2, 0, 2, screenH, 0.55, 0.55, 0.55, 1);
        Draw2D.fillRect(DODGE_ROAD_X + roadW, 0, 2, screenH, 0.55, 0.55, 0.55, 1);

        for (var l = 1; l < 3; l++) {
            var lx = DODGE_ROAD_X + l * DODGE_LANE_WIDTH;
            for (var dy = 0; dy < screenH + 20; dy += 20) {
                var dashY = (dy + Math.floor(this.scrollY) % 20);
                if ((dashY % 20) < 12) {
                    Draw2D.fillRect(lx - 1, dy, 2, 10, 0.55, 0.55, 0.40, 0.5);
                }
            }
        }
    }
};

module.exports = MooseDodgeSystem;
