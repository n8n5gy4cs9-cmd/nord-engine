// ============================================================================
// ENCOUNTER SYSTEM — extracted from midnight_sun.js §11b
// Triggers random encounters during travel. One-per-route, no repeats.
// Usage: var Enc = require("./mg_encounters.js");
// ============================================================================

var C = require("./game_constants.js");
var Tycoon = require("./mg_tycoon.js");
var F = C.FONT;
var SFX = C.SFX;

var EncounterSystem = {
    // State
    active: null,           // current ENCOUNTERS[] entry or null
    choice: 0,              // selected choice index
    phase: "choosing",      // "choosing" | "outcome"
    outcomeText: "",        // result description
    outcomeOk: true,        // true=success, false=fail
    route: null,            // route that triggered the encounter
    usedIds: [],            // IDs already seen this playthrough
    dryRouteCount: 0,       // consecutive routes with no event

    // Reset tracking for new game
    reset: function() {
        this.usedIds = [];
        this.dryRouteCount = 0;
    },

    // Roll for encounter on a route. Returns encounter object or null.
    rollEncounter: function(route, encounters) {
        var guaranteed = this.dryRouteCount >= 2;
        if (!guaranteed && Math.random() > route.encounter_rate) return null;

        var self = this;
        var available = encounters.filter(function(enc) {
            return self.usedIds.indexOf(enc.id) === -1;
        });
        if (available.length === 0) return null;

        var idx = Math.floor(Math.random() * available.length);
        return available[idx];
    },

    // Start an encounter
    start: function(encounter, route, gameState) {
        this.active = encounter;
        this.choice = 0;
        this.phase = "choosing";
        this.outcomeText = "";
        this.outcomeOk = true;
        this.route = route;
        this.usedIds.push(encounter.id);
        Audio.play(SFX.ENCOUNTER, 0.5);
        this.gs = gameState;
        gameState.journey.encounters_survived++;
        console.log("[Encounter] Started: " + encounter.name);
    },

    // Apply the selected choice
    resolveChoice: function(choiceIdx) {
        var choice = this.active.choices[choiceIdx];
        if (!choice) return;

        var failed = Math.random() < (choice.fail_chance || 0);
        var outcome = failed ? (choice.fail || choice.success) : choice.success;

        this.outcomeOk = !failed;
        this.outcomeText = outcome.description || "Nothing happens.";

        // Apply effects
        var gs = this.gs;
        if (outcome.cash) gs.resources.cash = Math.max(0, gs.resources.cash + outcome.cash);
        if (outcome.gas) gs.bus.gas = Math.max(0, Math.min(gs.bus.max_gas, gs.bus.gas + outcome.gas));
        if (outcome.food) gs.resources.food = Math.max(0, Math.min(10, gs.resources.food + outcome.food));
        if (outcome.morale) gs.resources.morale = Math.max(0, Math.min(100, gs.resources.morale + outcome.morale));
        if (outcome.hype) gs.resources.hype = Math.max(0, Math.min(100, gs.resources.hype + outcome.hype));
        if (outcome.bus_condition) gs.bus.condition = Math.max(0, Math.min(100, gs.bus.condition + outcome.bus_condition));
        Tycoon.applyEffects(gs, outcome);
        if (outcome.band_mood) {
            for (var i = 0; i < gs.band.length; i++) {
                gs.band[i].mood = Math.max(0, Math.min(100, gs.band[i].mood + outcome.band_mood));
            }
        }

        this.phase = "outcome";
        console.log("[Encounter] Choice: " + choice.text + " -> " + (failed ? "FAIL" : "OK"));
    },

    // End encounter — returns { done: true, arrivedCity, trigger? }
    finish: function() {
        var arrivedCity = this.gs.journey.current_city;
        // Check if the selected choice has a trigger for a minigame
        var trigger = null;
        if (this.active && this.active.choices && this.active.choices[this.choice]) {
            trigger = this.active.choices[this.choice].trigger || null;
        }
        this.active = null;
        this.route = null;
        return { done: true, arrivedCity: arrivedCity, trigger: trigger };
    },

    // Draw encounter UI
    draw: function(screenW, screenH) {
        if (!this.active) return;

        Draw2D.fillRect(0, 0, screenW, screenH, 0.06, 0.06, 0.12, 1, -5);

        var imgY = 15;
        var imgH = screenH * 0.3;
        Draw2D.drawImage(screenW * 0.3, imgY, screenW * 0.4, imgH,
            this.active.sprite, 1, 1, 1, 1);

        var panelY = imgY + imgH + 10;
        Draw2D.drawText(screenW / 2 - 100, panelY, this.active.name,
            0.94, 0.75, 0.25, 1, F.HEADING);

        var descY = panelY + 25;
        var words = this.active.description.split(" ");
        var lines = [];
        var line = "";
        for (var i = 0; i < words.length; i++) {
            if ((line + " " + words[i]).length > 50 && line.length > 0) {
                lines.push(line);
                line = words[i];
            } else {
                line = line.length > 0 ? line + " " + words[i] : words[i];
            }
        }
        if (line.length > 0) lines.push(line);

        for (var i = 0; i < lines.length; i++) {
            Draw2D.drawText(20, descY + i * 14, lines[i],
                0.75, 0.75, 0.82, 1, F.BODY);
        }

        var choiceY = descY + lines.length * 14 + 15;

        if (this.phase === "choosing") {
            Draw2D.fillRect(10, choiceY - 5, screenW - 20, 1, 0.29, 0.29, 0.42, 1);
            choiceY += 5;

            var choices = this.active.choices;
            for (var i = 0; i < choices.length; i++) {
                var isSel = (this.choice === i);
                var cr = isSel ? 1 : 0.63;
                var cg = isSel ? 1 : 0.63;
                var cb = isSel ? 0.25 : 0.75;
                var prefix = isSel ? "> " : "  ";
                Draw2D.drawText(30, choiceY, prefix + (i + 1) + ". " + choices[i].text,
                    cr, cg, cb, 1, 0.6);
                choiceY += 20;
            }
            Draw2D.drawText(20, screenH - 25, "[UP/DOWN] Select  [ENTER] Choose",
                0.38, 0.38, 0.50, 1, F.BODY);

        } else if (this.phase === "outcome") {
            Draw2D.fillRect(10, choiceY - 5, screenW - 20, 1, 0.29, 0.29, 0.42, 1);
            choiceY += 5;

            var okR = this.outcomeOk ? 0.25 : 1;
            var okG = this.outcomeOk ? 0.88 : 0.25;
            var okB = this.outcomeOk ? 0.25 : 0.25;
            var okLabel = this.outcomeOk ? "SUCCESS" : "FAILURE";
            Draw2D.drawText(30, choiceY, okLabel, okR, okG, okB, 1, F.LARGE);

            var oWords = this.outcomeText.split(" ");
            var oLines = [];
            var oLine = "";
            for (var i = 0; i < oWords.length; i++) {
                if ((oLine + " " + oWords[i]).length > 55 && oLine.length > 0) {
                    oLines.push(oLine);
                    oLine = oWords[i];
                } else {
                    oLine = oLine.length > 0 ? oLine + " " + oWords[i] : oWords[i];
                }
            }
            if (oLine.length > 0) oLines.push(oLine);

            for (var i = 0; i < oLines.length; i++) {
                Draw2D.drawText(30, choiceY + 22 + i * 14, oLines[i],
                    0.75, 0.75, 0.82, 1, F.BODY);
            }

            var deltaY = choiceY + 22 + oLines.length * 14 + 10;
            var choice = this.active.choices[this.choice];
            var failed = !this.outcomeOk;
            var outcome = failed ? (choice.fail || choice.success) : choice.success;
            var statLine = "";
            if (outcome.cash) statLine += "Cash " + (outcome.cash > 0 ? "+" : "") + outcome.cash + "  ";
            if (outcome.gas) statLine += "Gas " + (outcome.gas > 0 ? "+" : "") + outcome.gas + "  ";
            if (outcome.food) statLine += "Food " + (outcome.food > 0 ? "+" : "") + outcome.food + "  ";
            if (outcome.morale) statLine += "Morale " + (outcome.morale > 0 ? "+" : "") + outcome.morale + "  ";
            if (outcome.hype) statLine += "Hype " + (outcome.hype > 0 ? "+" : "") + outcome.hype + "  ";
            if (outcome.bus_condition) statLine += "Bus " + (outcome.bus_condition > 0 ? "+" : "") + outcome.bus_condition + "%  ";
            if (statLine.length > 0) {
                Draw2D.drawText(30, deltaY, statLine, 0.63, 0.63, 0.50, 1, F.BODY);
            }

            Draw2D.drawText(20, screenH - 25, "[ENTER] Continue",
                0.38, 0.38, 0.50, 1, F.BODY);
        }
    },

    // Handle input — returns null or { done: true, arrivedCity }
    handleInput: function() {
        if (!this.active) return null;

        if (this.phase === "choosing") {
            var numChoices = this.active.choices.length;
            if (Input.getKeyDown("Up") || Input.getKeyDown("w")) {
                this.choice = (this.choice - 1 + numChoices) % numChoices;
            }
            if (Input.getKeyDown("Down") || Input.getKeyDown("s")) {
                this.choice = (this.choice + 1) % numChoices;
            }
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                this.resolveChoice(this.choice);
            }
            for (var i = 0; i < Math.min(numChoices, 3); i++) {
                if (Input.getKeyDown("" + (i + 1))) {
                    this.choice = i;
                    this.resolveChoice(i);
                }
            }
        } else if (this.phase === "outcome") {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
                return this.finish();
            }
        }
        return null;
    }
};

module.exports = EncounterSystem;
