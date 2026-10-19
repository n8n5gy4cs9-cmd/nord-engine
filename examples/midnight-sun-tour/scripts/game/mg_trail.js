// ============================================================================
// ERAMAA EXPRESS — Oregon Trail style survival text adventure
// Random events during wilderness shortcut, resource management
// Usage: var Trail = require("./mg_trail.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;

var TRAIL_DAYS = 2;      // journey takes 2 "days"
var DAY_DURATION = 8;    // seconds per day

var EVENTS = [
    {
        text: "The road is washed out. A farmer offers to tow you across for 30 EUR.",
        choices: ["Pay 30 EUR", "Try to cross alone"],
        results: [
            { cash: -30, text: "Safe crossing. The farmer waves goodbye." },
            { bus: -15, text: "The bus gets stuck! You push it out but damage the undercarriage." }
        ]
    },
    {
        text: "A roadside market sells smoked fish and lingonberry jam.",
        choices: ["Buy food (20 EUR)", "Keep driving"],
        results: [
            { cash: -20, food: 25, text: "Delicious! The band's spirits lift." },
            { morale: -5, text: "Stomachs grumble. The band looks at you." }
        ]
    },
    {
        text: "Risto spots a bear on the road! It's blocking the way.",
        choices: ["Honk the horn", "Wait it out", "Drive around through the ditch"],
        results: [
            { text: "The bear moves! But it scratched the bus first.", bus: -10 },
            { text: "10 minutes later, the bear wanders off. Time lost.", morale: -5 },
            { text: "Made it! Close call through the ditch.", bus: -5 }
        ]
    },
    {
        text: "A hitchhiker flags you down. Looks like a fellow musician.",
        choices: ["Pick them up", "Drive past"],
        results: [
            { morale: 10, hype: 5, text: "Turns out it's a local radio DJ! Free publicity!" },
            { text: "You drive past. Pekka: 'That was cold.'" }
        ]
    },
    {
        text: "The engine starts overheating. Smoke from under the hood!",
        choices: ["Stop and cool down", "Push through"],
        results: [
            { text: "30 minute break. Hannele fixes it with duct tape.", morale: 5 },
            { bus: -20, text: "The engine suffers. This will cost money later." }
        ]
    },
    {
        text: "A beautiful lake appears by the road. Perfect for a break.",
        choices: ["Stop for a swim", "No time, keep driving"],
        results: [
            { morale: 15, text: "Best swim ever. Risto does a cannonball. Band morale soars!" },
            { text: "The band stares longingly as you pass. 'We never have fun.'" , morale: -5}
        ]
    },
    {
        text: "You find a gas station, but prices are double the usual.",
        choices: ["Fill up (40 EUR)", "Buy just a little (15 EUR)", "Skip it"],
        results: [
            { cash: -40, fuel: 40, text: "Full tank. Expensive but safe." },
            { cash: -15, fuel: 15, text: "Enough to keep going. Barely." },
            { text: "Hope the next station is cheaper..." }
        ]
    },
    {
        text: "Rain starts pouring. Visibility drops to almost nothing.",
        choices: ["Slow down", "Keep speed"],
        results: [
            { text: "Safe but slow. You arrive a bit late.", morale: -3 },
            { bus: -10, text: "Hydroplaning! The bus slides into a ditch briefly." }
        ]
    },
    {
        text: "Pekka sees a sign: 'Karaoke Bar — 500m'. His eyes light up.",
        choices: ["Quick karaoke stop", "No detours!"],
        results: [
            { morale: 20, cash: -10, text: "Pekka sings 'Sandstorm'. Standing ovation. Money well spent." },
            { morale: -10, text: "Pekka sulks for the next 50 km." }
        ]
    },
    {
        text: "The road splits: shortcut through a logging road or stay on the highway.",
        choices: ["Logging road", "Highway"],
        results: [
            { bus: -8, text: "Bumpy! But you save 30 minutes. The bus rattles." },
            { fuel: -10, text: "Longer but smoother. Uses more fuel though." }
        ]
    }
];

var TrailSystem = {
    phase: "ready",
    timer: 0,
    day: 1,
    dayTimer: 0,
    gs: null,
    currentEvent: null,
    selectedChoice: 0,
    eventResult: null,
    resultTimer: 0,
    usedEvents: [],
    travelDist: 0,
    totalDist: 0,

    start: function(gameState, route) {
        this.gs = gameState;
        Audio.playMusic(MUSIC.TRAIL, true);
        this.phase = "ready";
        this.timer = 0;
        this.day = 1;
        this.dayTimer = 0;
        this.currentEvent = null;
        this.selectedChoice = 0;
        this.eventResult = null;
        this.resultTimer = 0;
        this.usedEvents = [];
        this.travelDist = 0;
        this.totalDist = TRAIL_DAYS * DAY_DURATION;
        console.log("[Trail] Eramaa Express started! " + TRAIL_DAYS + " days ahead.");
    },

    pickEvent: function() {
        var available = [];
        for (var i = 0; i < EVENTS.length; i++) {
            var used = false;
            for (var j = 0; j < this.usedEvents.length; j++) {
                if (this.usedEvents[j] === i) { used = true; break; }
            }
            if (!used) available.push(i);
        }
        if (available.length === 0) {
            // No more events — skip event this day
            return null;
        }
        var pick = available[Math.floor(Math.random() * available.length)];
        this.usedEvents.push(pick);
        return EVENTS[pick];
    },

    applyResult: function(result) {
        if (result.cash) this.gs.resources.cash = Math.max(0, this.gs.resources.cash + result.cash);
        if (result.morale) this.gs.resources.morale = Math.max(0, Math.min(100, this.gs.resources.morale + result.morale));
        if (result.hype) this.gs.resources.hype = Math.max(0, Math.min(100, this.gs.resources.hype + result.hype));
        if (result.bus) this.gs.bus.condition = Math.max(10, Math.min(100, this.gs.bus.condition + result.bus));
        if (result.fuel) this.gs.bus.gas = Math.max(0, Math.min(this.gs.bus.max_gas, this.gs.bus.gas + result.fuel));
        if (result.food) this.gs.resources.food = Math.max(0, Math.min(100, (this.gs.resources.food || 50) + result.food));
    },

    // Returns null or { done: true }
    update: function(dt) {
        if (this.phase === "ready") {
            this.timer += dt;
            if (this.timer >= 6.0) {
                this.phase = "traveling";
                this.timer = 0;
                this.dayTimer = 0;
            }
            return null;
        }

        if (this.phase === "results") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return { done: true };
            }
            return null;
        }

        if (this.phase === "traveling") {
            this.dayTimer += dt;
            this.travelDist += dt;

            // Trigger event midway through each day
            if (this.dayTimer >= DAY_DURATION * 0.5 && !this.currentEvent) {
                var evt = this.pickEvent();
                if (evt) {
                    this.currentEvent = evt;
                    this.selectedChoice = 0;
                    this.phase = "event";
                }
                return null;
            }

            // Day complete
            if (this.dayTimer >= DAY_DURATION) {
                this.day++;
                this.dayTimer = 0;
                this.gs.bus.gas = Math.max(0, this.gs.bus.gas - 8);

                if (this.day > TRAIL_DAYS || this.gs.bus.condition <= 0) {
                    this.phase = "results";
                    this.timer = 0;
                }
            }
            return null;
        }

        if (this.phase === "event") {
            // Navigate choices
            if (Input.getKeyDown("Up") || Input.getKeyDown("w")) {
                this.selectedChoice = Math.max(0, this.selectedChoice - 1);
            }
            if (Input.getKeyDown("Down") || Input.getKeyDown("s")) {
                this.selectedChoice = Math.min(this.currentEvent.choices.length - 1, this.selectedChoice + 1);
            }
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                this.eventResult = this.currentEvent.results[this.selectedChoice];
                this.applyResult(this.eventResult);
                Audio.play(SFX.UI_CONFIRM, 0.4);
                this.phase = "event_result";
                this.resultTimer = 0;
            }
            return null;
        }

        if (this.phase === "event_result") {
            this.resultTimer += dt;
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                this.currentEvent = null;
                this.eventResult = null;
                this.phase = "traveling";
            }
            return null;
        }

        return null;
    },

    // ── DRAWING ─────────────────────────────────────────────────────
    draw: function(screenW, screenH) {
        // Forest green/brown background
        Draw2D.fillRect(0, 0, screenW, screenH, 0.05, 0.08, 0.04, 1, -5);

        if (this.phase === "ready") {
            this.drawLandscape(screenW, screenH);
            Draw2D.drawText(screenW / 2 - 70, screenH * 0.25, "ERAMAA EXPRESS", 0.94, 0.75, 0.25, 1, F.HEADING);
            Draw2D.drawText(screenW / 2 - 90, screenH * 0.40, "Survival road trip through the wilderness", 0.62, 0.75, 0.50, 1, F.SMALL);
            Draw2D.drawText(screenW / 2 - 80, screenH * 0.50, "Make choices. Manage resources. Survive.", 0.50, 0.60, 0.40, 1, F.SMALL);
            var blink = Math.sin(this.timer * 4) > 0;
            if (blink) Draw2D.drawText(screenW / 2 - 40, screenH * 0.7, "GET READY...", 0.8, 0.9, 0.6, 1, F.UI);

        } else if (this.phase === "traveling") {
            this.drawLandscape(screenW, screenH);
            this.drawTravelHUD(screenW, screenH);
            this.drawBusDriving(screenW, screenH);

        } else if (this.phase === "event" || this.phase === "event_result") {
            this.drawLandscape(screenW, screenH);
            this.drawEventScreen(screenW, screenH);

        } else if (this.phase === "results") {
            this.drawLandscape(screenW, screenH);
            Draw2D.fillRect(0, 0, screenW, screenH, 0, 0, 0, 0.6);
            this.drawResultsScreen(screenW, screenH);
        }
    },

    drawLandscape: function(screenW, screenH) {
        // Sky gradient (simplified)
        Draw2D.fillRect(0, 0, screenW, screenH * 0.4, 0.15, 0.25, 0.40, 1);
        // Tree line
        for (var tx = 0; tx < screenW; tx += 12) {
            var th = 20 + Math.sin(tx * 0.3) * 10;
            Draw2D.fillRect(tx, screenH * 0.4 - th, 10, th, 0.08, 0.18 + (tx % 3) * 0.02, 0.06, 1);
        }
        // Ground
        Draw2D.fillRect(0, screenH * 0.4, screenW, screenH * 0.6, 0.12, 0.15, 0.08, 1);
        // Road
        Draw2D.fillRect(screenW * 0.1, screenH * 0.55, screenW * 0.8, 30, 0.20, 0.20, 0.22, 1);
        Draw2D.fillRect(screenW * 0.1, screenH * 0.55 + 14, screenW * 0.8, 2, 0.45, 0.45, 0.30, 0.5);
    },

    drawBusDriving: function(screenW, screenH) {
        var busX = screenW * 0.3 + Math.sin(this.dayTimer * 2) * 3;
        var busY = screenH * 0.55 - 10;
        Draw2D.fillRect(busX, busY, 28, 16, 0.18, 0.35, 0.65, 1);
        Draw2D.drawRect(busX, busY, 28, 16, 0.25, 0.50, 0.80, 1, 1);
        Draw2D.fillRect(busX + 3, busY + 2, 22, 6, 0.50, 0.70, 0.90, 0.8);
        // Wheels
        Draw2D.fillRect(busX + 2, busY + 14, 5, 4, 0.15, 0.15, 0.15, 1);
        Draw2D.fillRect(busX + 21, busY + 14, 5, 4, 0.15, 0.15, 0.15, 1);
    },

    drawTravelHUD: function(screenW, screenH) {
        Draw2D.fillRect(0, 0, screenW, 22, 0, 0, 0, 0.65);
        Draw2D.drawText(5, 4, "Day " + this.day + "/" + TRAIL_DAYS, 0.94, 0.75, 0.25, 1, F.BODY);
        Draw2D.drawText(80, 4, "Bus: " + this.gs.bus.condition + "%", 0.75, 0.75, 0.88, 1, F.BODY);
        Draw2D.drawText(160, 4, "Fuel: " + this.gs.bus.gas + "%", 0.88, 0.75, 0.25, 1, F.BODY);
        Draw2D.drawText(230, 4, "Cash: " + this.gs.resources.cash, 0.25, 0.88, 0.25, 1, F.BODY);

        // Progress bar
        var prog = this.travelDist / this.totalDist;
        Draw2D.fillRect(10, screenH - 15, screenW - 20, 6, 0.15, 0.15, 0.20, 1);
        Draw2D.fillRect(10, screenH - 15, (screenW - 20) * Math.min(1, prog), 6, 0.25, 0.65, 0.25, 1);
        Draw2D.drawText(screenW / 2 - 30, screenH - 14, Math.floor(prog * 100) + "% complete", 0.5, 0.5, 0.6, 1, F.TINY);
    },

    drawEventScreen: function(screenW, screenH) {
        Draw2D.fillRect(10, 20, screenW - 20, screenH - 40, 0.08, 0.08, 0.06, 0.92);
        Draw2D.drawRect(10, 20, screenW - 20, screenH - 40, 0.50, 0.40, 0.25, 0.8, 1);

        Draw2D.drawText(20, 30, "DAY " + this.day + " EVENT", 0.94, 0.75, 0.25, 1, F.UI);

        if (this.phase === "event" && this.currentEvent) {
            // Word-wrap the event text (simple approach)
            var lines = this.wrapText(this.currentEvent.text, 40);
            var ty = 55;
            for (var i = 0; i < lines.length; i++) {
                Draw2D.drawText(25, ty, lines[i], 0.80, 0.80, 0.70, 1, F.BODY);
                ty += 14;
            }

            ty += 10;
            Draw2D.fillRect(20, ty, screenW - 40, 1, 0.40, 0.35, 0.25, 0.5);
            ty += 10;

            for (var c = 0; c < this.currentEvent.choices.length; c++) {
                var sel = (c === this.selectedChoice);
                var prefix = sel ? "> " : "  ";
                var cr = sel ? 0.94 : 0.55;
                var cg = sel ? 0.88 : 0.55;
                var cb = sel ? 0.30 : 0.50;
                Draw2D.drawText(30, ty, prefix + this.currentEvent.choices[c], cr, cg, cb, 1, F.BODY);
                ty += 16;
            }

            Draw2D.drawText(20, screenH - 40, "[UP/DOWN] Choose  [ENTER] Select", 0.38, 0.38, 0.50, 1, F.TINY);

        } else if (this.phase === "event_result" && this.eventResult) {
            var lines = this.wrapText(this.eventResult.text, 40);
            var ty = 55;
            for (var i = 0; i < lines.length; i++) {
                Draw2D.drawText(25, ty, lines[i], 0.80, 0.90, 0.60, 1, F.BODY);
                ty += 14;
            }

            ty += 15;
            // Show stat changes
            if (this.eventResult.cash) {
                var sign = this.eventResult.cash > 0 ? "+" : "";
                Draw2D.drawText(30, ty, "Cash: " + sign + this.eventResult.cash + " EUR",
                    this.eventResult.cash > 0 ? 0.25 : 1, this.eventResult.cash > 0 ? 0.88 : 0.4, 0.25, 1, 0.5);
                ty += 14;
            }
            if (this.eventResult.bus) {
                var sign = this.eventResult.bus > 0 ? "+" : "";
                Draw2D.drawText(30, ty, "Bus: " + sign + this.eventResult.bus + "%",
                    this.eventResult.bus > 0 ? 0.25 : 1, this.eventResult.bus > 0 ? 0.88 : 0.4, 0.25, 1, 0.5);
                ty += 14;
            }
            if (this.eventResult.morale) {
                var sign = this.eventResult.morale > 0 ? "+" : "";
                Draw2D.drawText(30, ty, "Morale: " + sign + this.eventResult.morale,
                    this.eventResult.morale > 0 ? 0.25 : 1, this.eventResult.morale > 0 ? 0.88 : 0.4, 0.25, 1, 0.5);
                ty += 14;
            }
            if (this.eventResult.fuel) {
                var sign = this.eventResult.fuel > 0 ? "+" : "";
                Draw2D.drawText(30, ty, "Fuel: " + sign + this.eventResult.fuel + "%",
                    this.eventResult.fuel > 0 ? 0.25 : 1, this.eventResult.fuel > 0 ? 0.88 : 0.4, 0.25, 1, 0.5);
                ty += 14;
            }
            if (this.eventResult.hype) {
                var sign = this.eventResult.hype > 0 ? "+" : "";
                Draw2D.drawText(30, ty, "Hype: " + sign + this.eventResult.hype,
                    this.eventResult.hype > 0 ? 0.25 : 1, this.eventResult.hype > 0 ? 0.88 : 0.4, 0.25, 1, 0.5);
            }

            Draw2D.drawText(20, screenH - 40, "[ENTER] Continue journey", 0.38, 0.38, 0.50, 1, F.TINY);
        }
    },

    drawResultsScreen: function(screenW, screenH) {
        var cy = screenH * 0.12;
        var survived = this.gs.bus.condition > 0;

        Draw2D.drawText(screenW / 2 - 70, cy,
            survived ? "JOURNEY COMPLETE!" : "BUS BROKE DOWN!",
            0.94, 0.75, 0.25, 1, F.HEADING);
        cy += 30;

        Draw2D.drawText(30, cy, "Days survived: " + Math.min(this.day, TRAIL_DAYS) + "/" + TRAIL_DAYS,
            0.75, 0.75, 0.88, 1, F.UI);
        cy += 18;
        Draw2D.drawText(30, cy, "Bus condition: " + this.gs.bus.condition + "%",
            0.75, 0.75, 0.88, 1, F.UI);
        cy += 18;
        Draw2D.drawText(30, cy, "Cash remaining: " + this.gs.resources.cash + " EUR",
            0.75, 0.75, 0.88, 1, F.UI);
        cy += 25;

        var flavor = "";
        if (survived && this.gs.bus.condition > 60) flavor = "The wilderness was kind. Hannele is impressed.";
        else if (survived) flavor = "Battered but alive. Mikko lights a cigarette.";
        else flavor = "You're stranded. Time to call a tow truck.";
        Draw2D.drawText(30, cy, flavor, 0.62, 0.62, 0.75, 1, F.BODY);

        Draw2D.drawText(20, screenH - 25, "[ENTER] Continue", 0.38, 0.38, 0.50, 1, F.BODY);
    },

    // Simple word-wrap helper
    wrapText: function(text, charLimit) {
        var words = text.split(" ");
        var lines = [];
        var line = "";
        for (var i = 0; i < words.length; i++) {
            if (line.length + words[i].length + 1 > charLimit) {
                lines.push(line);
                line = words[i];
            } else {
                line = line.length > 0 ? line + " " + words[i] : words[i];
            }
        }
        if (line.length > 0) lines.push(line);
        return lines;
    }
};

module.exports = TrailSystem;
