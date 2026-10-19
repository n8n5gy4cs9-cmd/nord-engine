// ============================================================================
// MICRO-GIG SYSTEM — extracted from midnight_sun.js §11c
// 3-phase performance: Intro -> Performance (rhythm prompts) -> Results
// Usage: var Gig = require("./mg_gig.js");
// ============================================================================

var C = require("./game_constants.js");
var Tycoon = require("./mg_tycoon.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var GIG_KEYS = ["a", "s", "d", "f"];
var GIG_KEY_LABELS = ["A", "S", "D", "F"];
var GIG_INTRO_TIME = 6.0;
var GIG_PERF_DURATION = 12.0;
var GIG_PROMPT_COUNT = 10;
var GIG_HIT_ZONE_X = 40;
var GIG_HIT_WINDOW_PERFECT = 8;
var GIG_HIT_WINDOW_GOOD = 18;
var GIG_SCROLL_SPEED_MIN = 130;
var GIG_SCROLL_SPEED_MAX = 260;

var GIG_VENUE_NAMES = [
    "Rusty Barrel Pub", "Town Hall Basement", "Library Community Room",
    "Gas Station Parking Lot", "Youth Center Stage", "Market Square",
    "Lakeside Pavilion", "Hotel Lobby Bar", "Community Sauna Yard",
    "Old Fire Station", "Church Basement (shh)", "Ice Rink Canteen"
];

var GigSystem = {
    // State
    phase: "intro",
    timer: 0,
    city: null,
    prompts: [],
    promptIdx: 0,
    score: 0,
    maxScore: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
    combo: 0,
    maxCombo: 0,
    payout: 0,
    hypeGain: 0,
    moraleGain: 0,
    crowdText: "",
    flashTimer: 0,
    flashText: "",
    flashColor: [1,1,1,1],
    gs: null,
    soundBonus: 1.0,
    moodBonus: 1.0,

    // Start a new gig
    start: function(gameState, city, soundBonus, moodBonus) {
        this.gs = gameState;
        this.city = city || { name: "Unknown Venue" };
        this.soundBonus = soundBonus || 1.0;
        this.moodBonus = moodBonus || 1.0;
        this.phase = "intro";
        this.timer = 0;
        this.score = 0;
        this.maxScore = 0;
        this.perfects = 0;
        this.goods = 0;
        this.misses = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.payout = 0;
        this.hypeGain = 0;
        this.moraleGain = 0;
        this.crowdText = "";
        this.flashTimer = 0;
        this.flashText = "";
        this.promptIdx = 0;

        Audio.playMusic(MUSIC.GIG, true);

        this.prompts = [];
        var spacing = GIG_PERF_DURATION / (GIG_PROMPT_COUNT + 1);
        for (var i = 0; i < GIG_PROMPT_COUNT; i++) {
            var t = spacing * (i + 1) + (Math.random() - 0.5) * spacing * 0.4;
            var spd = GIG_SCROLL_SPEED_MIN + (i / Math.max(1, GIG_PROMPT_COUNT - 1)) * (GIG_SCROLL_SPEED_MAX - GIG_SCROLL_SPEED_MIN);
            this.prompts.push({
                key: GIG_KEYS[Math.floor(Math.random() * GIG_KEYS.length)],
                time: t, x: 320, hit: false, result: "none", speed: spd
            });
        }
        this.prompts.sort(function(a, b) { return a.time - b.time; });
        this.maxScore = GIG_PROMPT_COUNT * 100;

        console.log("[Gig] Started in " + city.name + " -- " + GIG_PROMPT_COUNT + " prompts");
    },

    showFlash: function(text, r, g, b) {
        this.flashText = text;
        this.flashTimer = 0.6;
        this.flashColor = [r, g, b, 1];
    },

    tryHit: function(key) {
        var bestIdx = -1;
        var bestDist = 999;
        for (var i = 0; i < this.prompts.length; i++) {
            var p = this.prompts[i];
            if (p.result !== "none") continue;
            if (p.key !== key) continue;
            var dist = Math.abs(p.x - GIG_HIT_ZONE_X);
            if (dist < bestDist && dist < GIG_HIT_WINDOW_GOOD + 5) {
                bestDist = dist;
                bestIdx = i;
            }
        }
        if (bestIdx === -1) return;

        var p = this.prompts[bestIdx];
        var dist = Math.abs(p.x - GIG_HIT_ZONE_X);

        if (dist <= GIG_HIT_WINDOW_PERFECT) {
            p.result = "perfect"; p.hit = true;
            this.score += 100; this.perfects++;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            this.showFlash("PERFECT!", 1, 1, 0.25);
            Audio.play(SFX.GUITAR_STRUM, 0.5);
        } else if (dist <= GIG_HIT_WINDOW_GOOD) {
            p.result = "good"; p.hit = true;
            this.score += 50; this.goods++;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            this.showFlash("GOOD", 0.25, 1, 0.25);
            Audio.play(SFX.DRUM_HIT, 0.4);
        } else {
            p.result = "miss"; p.hit = false;
            this.misses++; this.combo = 0;
            this.showFlash("MISS", 1, 0.3, 0.3);
        }
        if (bestIdx >= this.promptIdx) this.promptIdx = bestIdx + 1;
    },

    updatePerformance: function(dt) {
        this.timer += dt;

        for (var i = 0; i < this.prompts.length; i++) {
            var p = this.prompts[i];
            if (p.result === "none") {
                var elapsed = this.timer - p.time + (280 / p.speed);
                p.x = 280 - elapsed * p.speed;
                if (p.x < GIG_HIT_ZONE_X - GIG_HIT_WINDOW_GOOD - 10) {
                    p.result = "miss"; p.hit = false;
                    this.misses++; this.combo = 0;
                    this.showFlash("MISS", 1, 0.3, 0.3);
                    if (i >= this.promptIdx) this.promptIdx = i + 1;
                }
            }
        }

        for (var k = 0; k < GIG_KEYS.length; k++) {
            if (Input.getKeyDown(GIG_KEYS[k])) {
                this.tryHit(GIG_KEYS[k]);
            }
        }

        if (this.flashTimer > 0) this.flashTimer -= dt;

        if (this.timer >= GIG_PERF_DURATION + 1.0) {
            for (var i = 0; i < this.prompts.length; i++) {
                if (this.prompts[i].result === "none") {
                    this.prompts[i].result = "miss";
                    this.misses++;
                }
            }
            this.calculateResults();
            this.phase = "results";
            this.timer = 0;
            // SFX based on performance
            var ratio = this.maxScore > 0 ? this.score / this.maxScore : 0;
            if (ratio >= 0.5) {
                Audio.play(SFX.CROWD_CHEER, 0.6);
            } else {
                Audio.play(SFX.CROWD_BOO, 0.5);
            }
        }
    },

    calculateResults: function() {
        var ratio = this.maxScore > 0 ? this.score / this.maxScore : 0;
        var feeMin = this.city.gig_fee_min;
        var feeMax = this.city.gig_fee_max;
        this.payout = Math.floor((feeMin + ratio * (feeMax - feeMin)) * this.soundBonus * this.moodBonus * Tycoon.gigMul(this.gs));

        if (ratio >= 0.9) {
            this.hypeGain = 15; this.moraleGain = 10;
            var sTexts = [
                "The crowd goes wild! Standing ovation!",
                "Someone yells 'Better than Brian Jonestown Massacre!'",
                "'Move over Aldous Harding!' Standing ovation!",
                "Karhumauri fans in the crowd convert on the spot!"
            ];
            this.crowdText = sTexts[Math.floor(Math.random() * sTexts.length)];
        } else if (ratio >= 0.7) {
            this.hypeGain = 10; this.moraleGain = 5;
            var aTexts = [
                "Great show! People are clapping and cheering.",
                "'Almost as good as Islaja!' — high praise from a local.",
                "A guy in a Burial t-shirt gives a thumbs up."
            ];
            this.crowdText = aTexts[Math.floor(Math.random() * aTexts.length)];
        } else if (ratio >= 0.5) {
            this.hypeGain = 5; this.moraleGain = 2;
            this.crowdText = "Decent gig. A few people nod along.";
        } else if (ratio >= 0.3) {
            this.hypeGain = 2; this.moraleGain = -5;
            this.crowdText = "Rough night. Someone asks for their money back.";
        } else {
            this.hypeGain = -3; this.moraleGain = -10;
            this.crowdText = "Disaster. The bartender pulls the plug early.";
        }

        var gs = this.gs;
        gs.resources.cash += this.payout;
        gs.resources.hype = Math.max(0, Math.min(100, gs.resources.hype + this.hypeGain));
        gs.resources.morale = Math.max(0, Math.min(100, gs.resources.morale + this.moraleGain));
        gs.journey.gigs_played++;
        gs.journey.time_of_day = "night";
        this.tycoon = Tycoon.afterGig(gs, this.city, ratio, this.payout);

        console.log("[Gig] Results -- Score: " + this.score + "/" + this.maxScore +
            " Payout: " + this.payout + " FIM");
    },

    // Handle input — returns null or { done: true }
    handleInput: function(dt) {
        if (this.phase === "intro") {
            this.timer += dt;
            if (this.timer >= GIG_INTRO_TIME) {
                this.phase = "performance";
                this.timer = 0;
                console.log("[Gig] Performance started!");
            }
        } else if (this.phase === "performance") {
            this.updatePerformance(dt);
        } else if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true };
            }
        }
        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, screenH, 0.05, 0.04, 0.10, 1, -5);
        if (this.phase === "intro") {
            this.drawIntro(screenW, screenH);
        } else if (this.phase === "performance") {
            this.drawPerformance(screenW, screenH);
        } else if (this.phase === "results") {
            this.drawResults(screenW, screenH);
        }
    },

    drawIntro: function(screenW, screenH) {
        var venueIdx = Math.abs(this.city.id.charCodeAt(0) + this.city.id.charCodeAt(1)) % GIG_VENUE_NAMES.length;
        var venueName = GIG_VENUE_NAMES[venueIdx];

        Draw2D.drawText(screenW / 2 - 60, screenH * 0.12, "MICRO-GIG", 0.94, 0.75, 0.25, 1, F.TITLE_BIG);
        Draw2D.drawText(screenW / 2 - 80, screenH * 0.26, venueName, 0.75, 0.75, 0.88, 1, F.LARGE);
        Draw2D.drawText(screenW / 2 - 50, screenH * 0.36, this.city.name, 0.50, 0.50, 0.63, 1, F.UI);

        // Prominent instructions box
        var boxY = screenH * 0.46;
        Draw2D.fillRect(15, boxY - 5, screenW - 30, 52, 0.10, 0.08, 0.20, 0.9);
        Draw2D.drawRect(15, boxY - 5, screenW - 30, 52, 0.94, 0.75, 0.25, 0.6, 1);
        Draw2D.drawText(20, boxY, "HOW TO PLAY:", 0.94, 0.75, 0.25, 1, F.LABEL);
        Draw2D.drawText(20, boxY + 16, "Notes scroll RIGHT to LEFT. Press [A] [S] [D] [F]",
            0.82, 0.82, 0.95, 1, F.BODY);
        Draw2D.drawText(20, boxY + 30, "when they cross the yellow line! Timing is everything.",
            0.82, 0.82, 0.95, 1, F.BODY);

        var bandY = screenH * 0.69;
        Draw2D.drawText(20, bandY, "Tonight's lineup:", 0.63, 0.63, 0.75, 1, F.BODY);
        for (var i = 0; i < this.gs.band.length; i++) {
            var m = this.gs.band[i];
            if (!m.present) continue;
            var mc = m.mood > 60 ? [0.25, 0.88, 0.25] : (m.mood > 30 ? [0.88, 0.88, 0.25] : [0.88, 0.25, 0.25]);
            Draw2D.drawText(30, bandY + 16 + i * 14, m.name + " (" + m.role + ") mood:" + m.mood,
                mc[0], mc[1], mc[2], 1, 0.5);
        }

        var blink = Math.sin(this.timer * 4) > 0;
        if (blink) {
            Draw2D.drawText(screenW / 2 - 40, screenH - 22, "GET READY...", 1, 1, 1, 1, F.UI);
        }
    },

    drawPerformance: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, screenH * 0.35, 0.08, 0.06, 0.15, 1);

        var stageY = screenH * 0.05;
        var bandPresent = 0;
        for (var i = 0; i < this.gs.band.length; i++) {
            if (this.gs.band[i].present) bandPresent++;
        }
        var memberSpacing = screenW / (bandPresent + 1);
        var mIdx = 0;
        for (var i = 0; i < this.gs.band.length; i++) {
            if (!this.gs.band[i].present) continue;
            var mx = memberSpacing * (mIdx + 1) - 8;
            Draw2D.fillRect(mx, stageY, 16, 28, 0.25, 0.20, 0.38, 1);
            Draw2D.drawText(mx - 2, stageY + 30, this.gs.band[i].name.charAt(0),
                0.63, 0.63, 0.75, 1, F.TINY);
            mIdx++;
        }

        var hitX = GIG_HIT_ZONE_X;
        var laneY = screenH * 0.40;
        var laneH = screenH * 0.35;
        Draw2D.drawLine(hitX, laneY, hitX, laneY + laneH, 0.94, 0.75, 0.25, 0.7, 2);

        var laneSpacing = laneH / 4;
        for (var k = 0; k < 4; k++) {
            var ly = laneY + laneSpacing * k + laneSpacing / 2 - 5;
            Draw2D.drawText(5, ly, GIG_KEY_LABELS[k], 0.50, 0.50, 0.63, 1, F.BODY);
        }

        for (var i = 0; i < this.prompts.length; i++) {
            var p = this.prompts[i];
            if (p.result !== "none" && p.result !== "perfect" && p.result !== "good") continue;
            if (p.x < -20 || p.x > screenW + 20) continue;
            var keyIdx = GIG_KEYS.indexOf(p.key);
            var py = laneY + laneSpacing * keyIdx + laneSpacing / 2 - 6;
            if (p.result === "perfect" || p.result === "good") {
                Draw2D.fillRect(p.x - 6, py, 12, 12, 0.25, 0.88, 0.25, 0.3);
            } else {
                var pr = 1, pg = 0.75, pb = 0.25;
                var dist = Math.abs(p.x - hitX);
                if (dist < GIG_HIT_WINDOW_GOOD) { pr = 1; pg = 1; pb = 1; }
                Draw2D.fillRect(p.x - 6, py, 12, 12, pr, pg, pb, 1);
                Draw2D.drawText(p.x - 3, py + 1, GIG_KEY_LABELS[keyIdx], 0.05, 0.05, 0.10, 1, F.TINY);
            }
        }

        if (this.flashTimer > 0) {
            var alpha = Math.min(1, this.flashTimer / 0.3);
            Draw2D.drawText(hitX + 20, laneY - 15, this.flashText,
                this.flashColor[0], this.flashColor[1], this.flashColor[2], alpha, 0.7);
        }

        var barY = laneY + laneH + 8;
        Draw2D.drawText(10, barY, "Score: " + this.score, 0.75, 0.75, 0.88, 1, F.BODY);
        Draw2D.drawText(screenW / 2 - 30, barY, "Combo: " + this.combo, 0.94, 0.75, 0.25, 1, F.BODY);

        var progW = screenW - 20;
        var progFill = Math.min(1, this.timer / GIG_PERF_DURATION);
        Draw2D.fillRect(10, barY + 16, progW, 4, 0.15, 0.15, 0.22, 1);
        Draw2D.fillRect(10, barY + 16, progW * progFill, 4, 0.25, 0.63, 0.88, 1);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.08;
        Draw2D.drawText(screenW / 2 - 60, cy, "GIG RESULTS", 0.94, 0.75, 0.25, 1, F.TITLE);
        cy += 35;

        var ratio = this.maxScore > 0 ? this.score / this.maxScore : 0;
        var grade = ratio >= 0.9 ? "S" : (ratio >= 0.7 ? "A" : (ratio >= 0.5 ? "B" : (ratio >= 0.3 ? "C" : "D")));
        Draw2D.drawText(screenW / 2 - 15, cy, "Grade: " + grade, 1, 1, 1, 1, F.HEADING);
        cy += 28;

        Draw2D.drawText(30, cy, "Perfect: " + this.perfects, 1, 1, 0.25, 1, F.BODY);
        Draw2D.drawText(130, cy, "Good: " + this.goods, 0.25, 1, 0.25, 1, F.BODY);
        Draw2D.drawText(210, cy, "Miss: " + this.misses, 1, 0.3, 0.3, 1, F.BODY);
        cy += 18;
        Draw2D.drawText(30, cy, "Best Combo: " + this.maxCombo, 0.75, 0.75, 0.88, 1, F.BODY);
        Draw2D.drawText(170, cy, "Score: " + this.score + "/" + this.maxScore, 0.75, 0.75, 0.88, 1, F.BODY);

        cy += 20;
        Draw2D.fillRect(20, cy, screenW - 40, 1, 0.29, 0.29, 0.42, 1);
        cy += 10;
        Draw2D.drawText(30, cy, "Payout: +" + this.payout + " FIM", 0.25, 0.88, 0.25, 1, F.UI);
        if (this.tycoon && this.tycoon.revenue > 0) {
            Draw2D.drawText(190, cy, "Merch: +" + this.tycoon.revenue + " FIM", 0.95, 0.80, 0.35, 1, F.UI);
            Draw2D.drawText(190, cy + 12, this.tycoon.text, 0.6, 0.6, 0.72, 1, F.SMALL);
        }
        cy += 18;

        var hypeLabel = this.hypeGain >= 0 ? "+" + this.hypeGain : "" + this.hypeGain;
        var moraleLabel = this.moraleGain >= 0 ? "+" + this.moraleGain : "" + this.moraleGain;
        Draw2D.drawText(30, cy, "Hype: " + hypeLabel, 0.63, 0.63, 0.50, 1, F.BODY);
        Draw2D.drawText(130, cy, "Morale: " + moraleLabel, 0.63, 0.63, 0.50, 1, F.BODY);
        if (this.tycoon) Draw2D.drawText(230, cy, "Fame: " + (this.tycoon.fame >= 0 ? "+" : "") + this.tycoon.fame, 0.63, 0.63, 0.50, 1, F.BODY);
        cy += 25;
        Draw2D.drawText(30, cy, this.crowdText, 0.75, 0.75, 0.82, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Back to city", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = GigSystem;
