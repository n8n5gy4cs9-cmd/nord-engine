// ============================================================================
// YOAJO — Night driving survival with headlight cone
// Uses shared pseudo3d.js for road building + obstacle projection
// Custom per-scanline headlight falloff rendering
// 90 second survival — avoid obstacles you can barely see
// Usage: var Night = require("./mg_night.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var P3D = require("./pseudo3d.js");
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var NIGHT_DURATION = 90;
var NIGHT_MAX_SPEED = 9000;
var NIGHT_ACCEL = 1800;
var NIGHT_DECEL = -1500;
var NIGHT_BRAKE = -5000;
var NIGHT_OFFROAD_DECEL = -3000;
var NIGHT_CENTRIFUGAL = 0.10;
var STEER_RATE = 2.5;
var OBSTACLE_INTERVAL = 15;
var HEADLIGHT_RANGE = 20;

// Road sections — gentle Finnish night road
var NIGHT_SECTIONS = [
    { start: 30,  end: 70,  curve: 1.5 },
    { start: 100, end: 140, curve: -2.0 },
    { start: 180, end: 220, curve: 2.5 },
    { start: 280, end: 320, curve: -1.5 },
    { start: 370, end: 410, curve: 3.0 },
    { start: 440, end: 480, curve: -2.0 }
];

var road = null;

var NightSystem = {
    phase: "ready",
    timer: 0,
    gs: null,
    speed: 0,
    playerX: 0,
    position: 0,
    obstacles: [],
    hits: 0,
    dodged: 0,
    survived: false,

    start: function(gameState) {
        this.gs = gameState;
        this.phase = "ready";
        this.timer = 0;
        this.speed = 0;
        this.playerX = 0;
        this.position = 0;
        this.hits = 0;
        this.dodged = 0;
        this.survived = false;

        // Build road via shared pseudo3d module
        road = P3D.create({
            segLen: 200,
            roadW: 1800,
            drawDist: 40,
            camH: 1000,
            camDepth: 0.84,
            totalSegs: 500,
            lanes: 2
        });
        road.buildSections(NIGHT_SECTIONS);

        // Spawn obstacles along road
        this.obstacles = [];
        for (var seg = 20; seg < road.totalSegs; seg += OBSTACLE_INTERVAL) {
            var jitter = Math.floor(Math.random() * 8) - 4;
            this.obstacles.push({
                segIdx: seg + jitter,
                offset: (Math.random() - 0.5) * 1.6,
                type: Math.random() < 0.4 ? "moose" : "rock",
                hit: false,
                passed: false
            });
        }

        Audio.playMusic(MUSIC.NIGHT_DRIVE, true);
        console.log("[Night] Yoajo started! Drive " + NIGHT_DURATION + "s in darkness.");
    },

    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0) {
                this.phase = "driving";
                this.timer = NIGHT_DURATION;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true, survived: this.survived, hits: this.hits };
            }
            return null;
        }

        // ── Driving ─────────────────────────────────────────────
        this.timer -= dt;

        // Input
        if (Input.getKey("Up") || Input.getKey("w")) {
            this.speed += NIGHT_ACCEL * dt;
        } else if (Input.getKey("Down") || Input.getKey("s")) {
            this.speed += NIGHT_BRAKE * dt;
        } else {
            this.speed += NIGHT_DECEL * dt;
        }
        this.speed = Math.max(0, Math.min(NIGHT_MAX_SPEED, this.speed));

        // Steering
        var steer = STEER_RATE * (this.speed / NIGHT_MAX_SPEED);
        if (Input.getKey("Left") || Input.getKey("a")) this.playerX -= steer * dt;
        if (Input.getKey("Right") || Input.getKey("d")) this.playerX += steer * dt;

        // Centrifugal force from road curve
        var segIdx = Math.floor(this.position / road.segLen) % road.totalSegs;
        var seg = road.getSegment(segIdx);
        if (seg) {
            this.playerX -= seg.curve * NIGHT_CENTRIFUGAL * (this.speed / NIGHT_MAX_SPEED) * dt;
        }
        this.playerX = Math.max(-3, Math.min(3, this.playerX));

        // Off-road decel
        if (this.playerX < -1 || this.playerX > 1) {
            this.speed += NIGHT_OFFROAD_DECEL * dt;
            this.speed = Math.max(0, this.speed);
        }

        this.position += this.speed * dt;

        // Update P3D camera state (for obstacle projection)
        road.update(this.position, this.playerX);

        // Obstacle collision
        var playerSeg = this.position / road.segLen;
        for (var i = 0; i < this.obstacles.length; i++) {
            var obs = this.obstacles[i];
            if (obs.hit || obs.passed) continue;

            var relSeg = obs.segIdx - playerSeg;
            if (relSeg < -2) {
                obs.passed = true;
                this.dodged++;
                continue;
            }
            if (relSeg >= -1 && relSeg <= 1 && Math.abs(this.playerX - obs.offset) < 0.4) {
                obs.hit = true;
                this.hits++;
                var dmg = obs.type === "moose" ? 12 : 8;
                this.gs.bus.condition = Math.max(0, this.gs.bus.condition - dmg);
                this.speed *= 0.5;
                Audio.play(SFX.NIGHT_CRASH, 0.6);
            }
        }

        // End conditions
        if (this.timer <= 0 || this.gs.bus.condition <= 0) {
            this.survived = this.gs.bus.condition > 0;
            this.phase = "results";
        }

        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        // Pure black sky
        Draw2D.fillRect(0, 0, screenW, screenH, 0.01, 0.01, 0.03, 1, -5);

        if (this.phase === "ready") {
            Draw2D.drawCircle(screenW * 0.8, screenH * 0.12, 12, 0.80, 0.80, 0.70, 0.6);
            Draw2D.drawText(screenW / 2 - 40, screenH * 0.30, "YOAJO", 0.80, 0.80, 0.50, 1, F.TITLE_BIG);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.45, "Night driving! Stay on the road.", 0.50, 0.50, 0.60, 1, F.BODY);
            Draw2D.drawText(screenW / 2 - 85, screenH * 0.55, "[UP] Gas [DOWN] Brake [LEFT/RIGHT] Steer", 0.35, 0.35, 0.45, 1, F.SMALL);
            var blink = Math.sin(this.timer * 3) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 0.7, 0.7, 0.5, 1, F.UI);
            return;
        }

        // Update P3D for projection (also called in update, but needed here for draw-only access)
        road.update(this.position, this.playerX);
        this.drawNightRoad(screenW, screenH);
        this.drawHUD(screenW, screenH);

        if (this.phase === "results") {
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.55);
            this.drawResults(screenW, screenH);
        }
    },

    // Custom night road — per-scanline headlight brightness falloff
    drawNightRoad: function(screenW, screenH) {
        var baseSeg = road.getBaseSeg();

        // Moon/stars
        Draw2D.drawCircle(screenW * 0.82, 20, 8, 0.60, 0.60, 0.50, 0.4);
        for (var s = 0; s < 15; s++) {
            var sx = (s * 137 + 29) % (screenW - 10) + 5;
            var sy = (s * 83 + 17) % 50 + 5;
            Draw2D.fillRect(sx, sy, 1, 1, 0.5, 0.5, 0.6, 0.3);
        }

        // Use projectSprite on pairs of segments for road strip data
        var maxY = screenH;
        var drawDist = road.drawDist;

        for (var n = drawDist; n >= 1; n--) {
            var segI = baseSeg + n;
            var segP = baseSeg + n - 1;
            var s1 = road.getSegment(segI);
            if (!s1) continue;

            // Use projectSprite for screen positions
            var p1 = road.projectSprite(segI, 0, screenW, screenH);
            // For the previous segment, handle edge case (relSeg=0 not projected by P3D)
            var p0 = null;
            if (n > 1) {
                p0 = road.projectSprite(segP, 0, screenW, screenH);
            } else {
                // Nearest strip — extend to screen bottom
                p0 = { x: screenW / 2, y: screenH, w: p1.visible ? p1.w * 1.3 : 50, visible: true };
            }

            if (!p1.visible) continue;
            if (!p0.visible) {
                p0 = { x: screenW / 2, y: screenH, w: p1.w * 1.2, visible: true };
            }

            // Clip
            if (p1.y > maxY) continue;
            if (p0.y > maxY) p0.y = maxY;
            if (p1.y <= 0 && p0.y <= 0) continue;

            var stripH = p0.y - p1.y + 1;
            if (stripH <= 0) continue;

            // Headlight falloff
            var lightFrac = 1.0 - (n / HEADLIGHT_RANGE);
            lightFrac = Math.max(0.02, Math.min(1, lightFrac));

            // Grass (very dark, modulated by headlight)
            var grassG = 0.08 * lightFrac;
            Draw2D.fillRect(0, p1.y, screenW, stripH, 0.02, grassG, 0.02, 1);

            // Road
            var roadBright = s1.color ? 0.20 : 0.18;
            roadBright *= lightFrac;
            var maxW = Math.max(p1.w, p0.w);
            var roadCX = (p1.x + p0.x) / 2;
            Draw2D.fillRect(roadCX - maxW, p1.y, maxW * 2, stripH,
                roadBright, roadBright, roadBright + 0.02, 1);

            // Edge lines (reflective — brighter in headlights)
            if (s1.color && lightFrac > 0.1) {
                var edgeBright = 0.6 * lightFrac;
                var lw = Math.max(1, maxW / 20);
                Draw2D.fillRect(roadCX - maxW, p1.y, lw, stripH, edgeBright, edgeBright, edgeBright * 0.5, 1);
                Draw2D.fillRect(roadCX + maxW - lw, p1.y, lw, stripH, edgeBright, edgeBright, edgeBright * 0.5, 1);
            }

            // Center dashed line
            if (s1.color && lightFrac > 0.15) {
                var centerBright = 0.5 * lightFrac;
                Draw2D.fillRect(roadCX - 1, p1.y, 2, stripH,
                    centerBright, centerBright, centerBright * 0.3, 0.5);
            }

            maxY = p1.y;
        }

        // Headlight cone sprite overlay
        var coneW = screenW * 0.55;
        var coneH = screenH * 0.45;
        var coneX = screenW / 2 - coneW / 2;
        var coneY = screenH * 0.42;
        Draw2D.drawImage(coneX, coneY, coneW, coneH, SPRITES.HEADLIGHT_CONE, 0.9, 0.85, 0.6, 0.15);

        // Draw obstacles using P3D projection
        this.drawObstacles(screenW, screenH);

        // Player bus
        this.drawPlayerBus(screenW, screenH);
    },

    drawPlayerBus: function(screenW, screenH) {
        var scale = screenW / 320;
        var bw = 34 * scale;
        var bh = 20 * scale;
        var bx = screenW / 2 - bw / 2;
        var by = screenH - bh - 5 * scale;
        // Night bus sprite
        Draw2D.drawImage(bx, by, bw, bh, SPRITES.BUS_NIGHT, 1, 1, 1, 1);
    },

    drawObstacles: function(screenW, screenH) {
        var baseSeg = road.getBaseSeg();
        for (var i = 0; i < this.obstacles.length; i++) {
            var obs = this.obstacles[i];
            if (obs.hit) continue;

            var relSeg = obs.segIdx - baseSeg;
            if (relSeg < 1 || relSeg > HEADLIGHT_RANGE) continue;

            // Project obstacle using P3D
            var p = road.projectSprite(obs.segIdx, obs.offset, screenW, screenH);
            if (!p.visible) continue;

            var lightFrac = 1.0 - (relSeg / HEADLIGHT_RANGE);
            lightFrac = Math.max(0, Math.min(1, lightFrac));

            var ow = Math.max(3, p.w * 0.06);
            var oh = ow * 1.2;

            if (obs.type === "moose") {
                // Moose sprite — tinted by headlight distance
                Draw2D.drawImage(p.x - ow / 2, p.y - oh, ow, oh,
                    SPRITES.MOOSE_SILHOUETTE, lightFrac, lightFrac, lightFrac, lightFrac);
                // Glowing eyes when close enough
                if (lightFrac > 0.3) {
                    Draw2D.fillRect(p.x - 2, p.y - oh * 0.8, 1, 1, 0.95, 0.85, 0.2, lightFrac);
                    Draw2D.fillRect(p.x + 1, p.y - oh * 0.8, 1, 1, 0.95, 0.85, 0.2, lightFrac);
                }
            } else {
                // Rock sprite — tinted by headlight distance
                Draw2D.drawImage(p.x - ow / 2, p.y - oh * 0.5, ow, oh * 0.5,
                    SPRITES.ROCK_OBSTACLE, lightFrac, lightFrac, lightFrac, lightFrac);
            }
        }
    },

    drawHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 18, 0, 0, 0, 0.7);
        var timeLeft = Math.max(0, Math.ceil(this.timer));
        Draw2D.drawText(5, 3, "TIME: " + timeLeft + "s", 0.80, 0.80, 0.50, 1, F.BODY);

        var kmh = Math.round(this.speed * 0.012);
        Draw2D.drawText(screenW / 2 - 20, 3, kmh + " km/h", 0.75, 0.75, 0.88, 1, F.BODY);

        Draw2D.drawText(screenW - 70, 3, "Bus: " + this.gs.bus.condition + "%", 0.75, 0.75, 0.88, 1, F.BODY);

        if (this.hits > 0) {
            Draw2D.drawText(screenW - 130, 3, "Hits: " + this.hits, 1, 0.3, 0.3, 1, F.SMALL);
        }
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.12;
        var title = this.survived ? "DAWN BREAKS!" : "CRASHED!";
        Draw2D.drawText(screenW / 2 - 50, cy, title, 0.80, 0.80, 0.50, 1, F.HEADING);
        cy += 30;

        Draw2D.drawText(30, cy, "Obstacles hit: " + this.hits, 1, 0.4, 0.3, 1, F.UI);
        cy += 18;
        Draw2D.drawText(30, cy, "Obstacles dodged: " + this.dodged, 0.25, 0.88, 0.25, 1, F.UI);
        cy += 18;
        Draw2D.drawText(30, cy, "Bus condition: " + this.gs.bus.condition + "%", 0.75, 0.75, 0.88, 1, F.UI);
        cy += 25;

        var flavor = "";
        if (this.survived && this.hits === 0) flavor = "Not a scratch! Mikko drives like a Finn.";
        else if (this.survived) flavor = "Made it through. Hannele demands a coffee break.";
        else flavor = "The darkness won. Risto: 'I told you to slow down.'";
        Draw2D.drawText(30, cy, flavor, 0.62, 0.62, 0.75, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = NightSystem;
