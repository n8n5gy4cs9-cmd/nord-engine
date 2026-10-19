// ============================================================================
// SOUND CHECK MINIGAME — extracted from midnight_sun.js §11e
// Pre-gig mixer: adjust 4 channel sliders to match hidden targets.
// Usage: var SC = require("./mg_soundcheck.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;
var SPRITES = C.SPRITES;

var SC_CHANNEL_NAMES = ["Vocals", "Guitar", "Bass", "Drums"];
var SC_CHANNEL_COLORS = [
    [0.88, 0.25, 0.25],
    [0.25, 0.63, 0.88],
    [0.25, 0.88, 0.38],
    [0.88, 0.75, 0.25]
];
var SC_DURATION = 10.0;
var SC_TARGET_ZONE_WIDTH = 15;

var SoundCheckSystem = {
    phase: "mixing",
    timer: 0,
    channel: 0,
    sliders: [50, 50, 50, 50],
    targets: [0, 0, 0, 0],
    bonus: 1.0,
    city: null,
    quality: 0,
    gs: null,

    start: function(gameState, city) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.SOUNDCHECK, true);
        this.city = city;
        this.phase = "ready";
        this.timer = 0;
        this.channel = 0;
        this.bonus = 1.0;
        this.quality = 0;

        for (var i = 0; i < 4; i++) {
            this.sliders[i] = 30 + Math.floor(Math.random() * 40);
        }

        var band = gameState.band;
        for (var i = 0; i < 4; i++) {
            var skill = band[i] ? band[i].skill : 5;
            var spread = 80 - skill * 4;
            var center = 50;
            this.targets[i] = Math.floor(center - spread / 2 + Math.random() * spread);
            this.targets[i] = Math.max(10, Math.min(90, this.targets[i]));
        }
        console.log("[SoundCheck] Started -- targets: " + this.targets.join(", "));
    },

    calculateResults: function() {
        var totalAccuracy = 0;
        for (var i = 0; i < 4; i++) {
            var dist = Math.abs(this.sliders[i] - this.targets[i]);
            var accuracy = Math.max(0, 1 - dist / 50);
            totalAccuracy += accuracy;
        }
        this.quality = Math.floor((totalAccuracy / 4) * 100);

        if (this.quality >= 80) {
            this.bonus = 1.2 + (this.quality - 80) * 0.005;
        } else if (this.quality >= 50) {
            this.bonus = 1.0 + (this.quality - 50) * (0.2 / 30);
        } else {
            this.bonus = 0.8 + this.quality * (0.2 / 50);
        }
        this.bonus = Math.round(this.bonus * 100) / 100;
        console.log("[SoundCheck] Quality: " + this.quality + "% Bonus: " + this.bonus + "x");
    },

    // Returns null or { done: true, bonus }
    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0 || Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                this.phase = "mixing";
                this.timer = 0;
            }
            return null;
        }

        if (this.phase === "mixing") {
            this.timer += dt;

            if (Input.getKeyDown("Left") || Input.getKeyDown("a")) {
                this.channel = (this.channel - 1 + 4) % 4;
            }
            if (Input.getKeyDown("Right") || Input.getKeyDown("d")) {
                this.channel = (this.channel + 1) % 4;
            }

            var speed = 50;
            if (Input.getKey("Up") || Input.getKey("w")) {
                this.sliders[this.channel] = Math.min(100, this.sliders[this.channel] + speed * dt);
            }
            if (Input.getKey("Down") || Input.getKey("s")) {
                this.sliders[this.channel] = Math.max(0, this.sliders[this.channel] - speed * dt);
            }

            for (var i = 0; i < 4; i++) {
                if (Input.getKeyDown("" + (i + 1))) this.channel = i;
            }

            if (this.timer >= SC_DURATION || Input.getKeyDown("Return")) {
                this.calculateResults();
                this.phase = "results";
                this.timer = 0;
            }

        } else if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true, bonus: this.bonus, city: this.city };
            }
        }
        return null;
    },

    draw: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, screenH, 0.06, 0.05, 0.12, 1, -5);
        if (this.phase === "ready") {
            this.drawReady(screenW, screenH);
        } else if (this.phase === "mixing") {
            this.drawMixing(screenW, screenH);
        } else {
            this.drawResults(screenW, screenH);
        }
    },

    drawReady: function(screenW, screenH) {
        // Mixer sprite background
        Draw2D.drawImage(screenW * 0.15, screenH * 0.05, screenW * 0.7, screenH * 0.35,
            SPRITES.MG_SOUND_MIXER, 1, 1, 1, 0.3);

        Draw2D.drawText(screenW / 2 - 65, screenH * 0.15, "SOUND CHECK", 0.94, 0.75, 0.25, 1, F.TITLE_BIG);
        Draw2D.drawText(screenW / 2 - 95, screenH * 0.32, "Match each channel to its sweet spot!",
            0.75, 0.75, 0.88, 1, F.LABEL);

        var cy = screenH * 0.46;
        Draw2D.drawText(20, cy, "HOW TO PLAY:", 0.94, 0.75, 0.25, 1, F.UI);
        cy += 20;
        Draw2D.drawText(30, cy, "[LEFT / RIGHT]  Switch channel", 0.63, 0.63, 0.82, 1, F.BODY);
        cy += 16;
        Draw2D.drawText(30, cy, "[UP / DOWN]     Move the slider", 0.63, 0.63, 0.82, 1, F.BODY);
        cy += 16;
        Draw2D.drawText(30, cy, "[1-4]           Quick-select channel", 0.63, 0.63, 0.82, 1, F.BODY);
        cy += 16;
        Draw2D.drawText(30, cy, "[ENTER]         Finish early", 0.63, 0.63, 0.82, 1, F.BODY);
        cy += 25;
        Draw2D.drawText(20, cy, "The glow shows how close you are — brighter = better!",
            0.50, 0.88, 0.50, 1, F.BODY);
        cy += 16;
        Draw2D.drawText(20, cy, "You have " + SC_DURATION + " seconds. Good luck!",
            0.50, 0.50, 0.63, 1, F.BODY);

        var blink = Math.sin(this.timer * 4) > 0;
        if (blink) {
            Draw2D.drawText(screenW / 2 - 60, screenH - 28, "Press ENTER to start",
                1, 1, 1, 1, F.UI);
        }
    },

    drawMixing: function(screenW, screenH) {
        Draw2D.drawText(screenW / 2 - 60, 8, "SOUND CHECK", 0.94, 0.75, 0.25, 1, F.HEADING);

        var timeLeft = Math.max(0, SC_DURATION - this.timer);
        var timeFrac = timeLeft / SC_DURATION;
        Draw2D.fillRect(10, 28, screenW - 20, 4, 0.15, 0.15, 0.22, 1);
        var tr = timeFrac > 0.3 ? 0.25 : 1;
        var tg = timeFrac > 0.3 ? 0.63 : 0.25;
        Draw2D.fillRect(10, 28, (screenW - 20) * timeFrac, 4, tr, tg, 0.25, 1);

        var sliderX = 30;
        var sliderW = 50;
        var channelSpacing = (screenW - 60) / 4;
        var sliderTop = 50;
        var sliderH = 140;

        for (var i = 0; i < 4; i++) {
            var cx = sliderX + i * channelSpacing;
            var isSel = (this.channel === i);
            var col = SC_CHANNEL_COLORS[i];

            var labelAlpha = isSel ? 1 : 0.5;
            Draw2D.drawText(cx, sliderTop - 12, SC_CHANNEL_NAMES[i],
                col[0], col[1], col[2], labelAlpha, 0.5);

            var trackX = cx + sliderW / 2 - 3;
            Draw2D.fillRect(trackX, sliderTop, 6, sliderH, 0.15, 0.15, 0.22, 1);

            var targetY = sliderTop + sliderH - (this.targets[i] / 100) * sliderH;
            var dist = Math.abs(this.sliders[i] - this.targets[i]);
            var hintAlpha = 0.1 + Math.max(0, 1 - dist / 30) * 0.3;
            Draw2D.fillRect(trackX - 4, targetY - SC_TARGET_ZONE_WIDTH / 2, 14, SC_TARGET_ZONE_WIDTH,
                col[0], col[1], col[2], hintAlpha);

            var handleY = sliderTop + sliderH - (this.sliders[i] / 100) * sliderH;
            var handleW = isSel ? 30 : 20;
            var handleH = 8;
            var hx = cx + sliderW / 2 - handleW / 2;
            Draw2D.fillRect(hx, handleY - handleH / 2, handleW, handleH,
                col[0], col[1], col[2], isSel ? 1 : 0.6);

            if (isSel) {
                Draw2D.drawRect(hx - 2, handleY - handleH / 2 - 2, handleW + 4, handleH + 4,
                    1, 1, 1, 0.8, 1);
            }

            var vuH = sliderH * (this.sliders[i] / 100);
            var vuBottom = sliderTop + sliderH;
            var barCount = Math.floor(vuH / 5);
            for (var b = 0; b < barCount; b++) {
                var by = vuBottom - (b + 1) * 5;
                var frac = (b + 1) / (sliderH / 5);
                var br = frac > 0.8 ? 1 : col[0] * 0.7;
                var bg = frac > 0.8 ? 0.2 : col[1] * 0.7;
                var bb = frac > 0.8 ? 0.2 : col[2] * 0.7;
                Draw2D.fillRect(cx + sliderW + 5, by, 8, 3, br, bg, bb, 0.6);
            }

            var memberName = this.gs.band[i] ? this.gs.band[i].name : "???";
            Draw2D.drawText(cx + 5, sliderTop + sliderH + 8, memberName,
                0.50, 0.50, 0.63, 1, F.TINY);
        }

        Draw2D.drawText(10, screenH - 30, "[LEFT/RIGHT] Channel  [UP/DOWN] Adjust  [ENTER] Done",
            0.38, 0.38, 0.50, 1, F.TINY);
        Draw2D.drawText(screenW - 60, screenH - 30, Math.ceil(timeLeft) + "s left",
            0.63, 0.63, 0.75, 1, F.BODY);
    },

    drawResults: function(screenW, screenH) {
        var cy = screenH * 0.10;
        Draw2D.drawText(screenW / 2 - 80, cy, "SOUND CHECK DONE", 0.94, 0.75, 0.25, 1, F.HEADING);
        cy += 30;

        for (var i = 0; i < 4; i++) {
            var dist = Math.abs(this.sliders[i] - this.targets[i]);
            var accuracy = Math.max(0, Math.floor((1 - dist / 50) * 100));
            var col = SC_CHANNEL_COLORS[i];
            var grade = accuracy >= 80 ? "GREAT" : (accuracy >= 50 ? "OK" : "OFF");
            Draw2D.drawText(30, cy, SC_CHANNEL_NAMES[i] + ": " + grade + " (" + accuracy + "%)",
                col[0], col[1], col[2], 1, 0.5);
            cy += 16;
        }

        cy += 10;
        Draw2D.fillRect(20, cy, screenW - 40, 1, 0.29, 0.29, 0.42, 1);
        cy += 10;

        var qCol = this.quality >= 70 ? [0.25, 0.88, 0.25] : (this.quality >= 40 ? [0.88, 0.88, 0.25] : [0.88, 0.25, 0.25]);
        Draw2D.drawText(30, cy, "Sound Quality: " + this.quality + "%",
            qCol[0], qCol[1], qCol[2], 1, 0.7);
        cy += 25;
        Draw2D.drawText(30, cy, "Gig bonus: " + this.bonus + "x", 0.75, 0.75, 0.88, 1, F.UI);
        cy += 20;

        var flavor = "";
        if (this.quality >= 80) flavor = "Crystal clear! The crowd will love this.";
        else if (this.quality >= 60) flavor = "Sounds pretty good. Should be a decent show.";
        else if (this.quality >= 40) flavor = "A bit muddy. Hope the crowd doesn't notice.";
        else flavor = "Total mess. Mikko's mic is feeding back.";
        Draw2D.drawText(30, cy, flavor, 0.63, 0.63, 0.75, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Start the gig!", 0.38, 0.38, 0.50, 1, F.BODY);
    }
};

module.exports = SoundCheckSystem;
