var Art=require("./tour_art.js");
// ============================================================================
// BAND MOOD SYSTEM — require("./band_mood.js")
// Individual band member moods, travel events, mood warnings + departures
// ============================================================================

// 8 Finnish-humor travel events — triggered once per route in random order
var C = require("./game_constants.js");
var F = C.FONT;

var TRAVEL_EVENTS = [
    {
        id: "leningrad_cowboys",
        text: "Pekka found a Leningrad Cowboys cassette! Everyone sings along.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) band[i].mood = Math.min(100, band[i].mood + 8);
        }
    },
    {
        id: "last_makkara",
        text: "Risto ate the last makkara without asking. Everyone glares at him.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) {
                if (band[i].id === "risto") band[i].mood = Math.min(100, band[i].mood + 5);
                else band[i].mood = Math.max(0, band[i].mood - 6);
            }
        }
    },
    {
        id: "tikkupeli",
        text: "Hannele beat everyone at tikkupeli at a rest stop. Smug for hours.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) {
                if (band[i].id === "hannele") band[i].mood = Math.min(100, band[i].mood + 6);
                else band[i].mood = Math.max(0, band[i].mood - 3);
            }
        }
    },
    {
        id: "ievan_polkka",
        text: "Mikko sang 'Ievan Polkka' for 2 hours straight. Nobody asked.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) {
                if (band[i].id === "mikko") band[i].mood = Math.min(100, band[i].mood + 10);
                else band[i].mood = Math.max(0, band[i].mood - 5);
            }
        }
    },
    {
        id: "lake_swim",
        text: "Band found a lake — spontaneous swim break! Refreshing.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) band[i].mood = Math.min(100, band[i].mood + 10);
        }
    },
    {
        id: "drive_argument",
        text: "Argument about whose turn to drive. Risto and Pekka not speaking.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) {
                if (band[i].id === "risto" || band[i].id === "pekka")
                    band[i].mood = Math.max(0, band[i].mood - 8);
            }
        }
    },
    {
        id: "radio_song",
        text: "Radio played their own song! Everyone cheers and cranks the volume.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) band[i].mood = Math.min(100, band[i].mood + 12);
        }
    },
    {
        id: "broken_ac",
        text: "Bus AC broken — everyone sweating in silence for the whole drive.",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) band[i].mood = Math.max(0, band[i].mood - 6);
        }
    },
    {
        id: "burial_tape",
        text: "Radio played Burial. Hannele stares out the window for an hour. 'This is art.'",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) {
                if (band[i].id === "hannele") band[i].mood = Math.min(100, band[i].mood + 12);
                else band[i].mood = Math.max(0, band[i].mood - 2);
            }
        }
    },
    {
        id: "bjm_debate",
        text: "Pekka and Risto argue whether Brian Jonestown Massacre or Dandy Warhols are better. Mikko: 'Both.'",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) {
                if (band[i].id === "pekka" || band[i].id === "risto")
                    band[i].mood = Math.max(0, band[i].mood - 5);
                else band[i].mood = Math.min(100, band[i].mood + 3);
            }
        }
    },
    {
        id: "islaja_roadside",
        text: "Passed a hand-painted sign: 'ISLAJA LIVE TONIGHT'. Mikko: 'We should have gone.'",
        effects: function(band) {
            for (var i = 0; i < band.length; i++) band[i].mood = Math.max(0, band[i].mood - 4);
        }
    }
];

// Tracks which events have been used
var usedEventIds = [];

// Last triggered event text (for display in city)
var lastEventText = "";
var lastEventTimer = 0;

// Warning messages from mood checks
var warnings = [];

var BandMoodSystem = {

    // Called after each route completes — drift moods, roll travel event, check thresholds
    onRouteComplete: function(gameState) {
        lastEventText = "";
        warnings = [];

        // 1. Drift all moods gently toward 50
        this.driftMoods(gameState);

        // 2. 60% chance of travel event per route
        if (Math.random() < 0.60) {
            this.rollTravelEvent(gameState);
        }

        // 3. Check thresholds — warnings at 25, departure at 0
        this.checkMoodThresholds(gameState);
    },

    // Drift individual moods toward 50 by ±2 per route
    driftMoods: function(gameState) {
        for (var i = 0; i < gameState.band.length; i++) {
            var m = gameState.band[i];
            if (!m.present) continue;
            if (m.mood > 50) m.mood = Math.max(50, m.mood - 2);
            else if (m.mood < 50) m.mood = Math.min(50, m.mood + 2);
        }
    },

    // Roll and apply a random travel event
    rollTravelEvent: function(gameState) {
        var available = [];
        for (var i = 0; i < TRAVEL_EVENTS.length; i++) {
            if (usedEventIds.indexOf(TRAVEL_EVENTS[i].id) === -1) {
                available.push(TRAVEL_EVENTS[i]);
            }
        }
        if (available.length === 0) {
            // All events used — reset pool
            usedEventIds = [];
            available = TRAVEL_EVENTS.slice();
        }

        var idx = Math.floor(Math.random() * available.length);
        var evt = available[idx];
        usedEventIds.push(evt.id);

        // Only apply to present members
        var presentBand = gameState.band.filter(function(m) { return m.present; });
        evt.effects(presentBand);

        lastEventText = evt.text;
        lastEventTimer = 4.0; // show for 4 seconds
    },

    // Check mood thresholds — warn at 25, remove at 0
    checkMoodThresholds: function(gameState) {
        for (var i = 0; i < gameState.band.length; i++) {
            var m = gameState.band[i];
            if (!m.present) continue;

            if (m.mood <= 0) {
                // Member leaves!
                m.present = false;
                m.mood = 0;
                warnings.push(m.name + " has had enough and LEFT THE BAND!");
                console.log("[BandMood] " + m.name + " left the band (mood 0)");
            } else if (m.mood <= 25) {
                warnings.push(m.name + " is miserable — \"I'll quit unless things improve...\"");
                console.log("[BandMood] WARNING: " + m.name + " mood at " + m.mood);
            }
        }
    },

    // Get gig performance modifier: average mood → 0.90x to 1.10x (gentle)
    getGigModifier: function(gameState) {
        var total = 0;
        var count = 0;
        for (var i = 0; i < gameState.band.length; i++) {
            if (gameState.band[i].present) {
                total += gameState.band[i].mood;
                count++;
            }
        }
        if (count === 0) return 1.0;
        var avg = total / count;
        // Map 0-100 mood to 0.90-1.10 modifier
        return 0.90 + (avg / 100) * 0.20;
    },

    // Get average band mood (0-100)
    getAverageMood: function(gameState) {
        var total = 0;
        var count = 0;
        for (var i = 0; i < gameState.band.length; i++) {
            if (gameState.band[i].present) {
                total += gameState.band[i].mood;
                count++;
            }
        }
        return count > 0 ? Math.floor(total / count) : 0;
    },

    // Draw mood bars in city menu — call from CityMenu.draw
    drawMoodBars: function(gameState, x, y, w) {
        Draw2D.drawText(x, y, "Band Mood", 0.75, 0.75, 0.85, 1, F.LABEL);
        y += 14;

        for (var i = 0; i < gameState.band.length; i++) {
            var m = gameState.band[i];
            if (!m.present) {
                Draw2D.drawText(x, y, m.name + " (LEFT)", 0.4, 0.2, 0.2, 1, F.TINY);
                y += 12;
                continue;
            }

            Art.sprite(24+i,x,y-2,30,30);
            // Name
            Draw2D.drawText(x+36, y, m.name, 0.7, 0.7, 0.8, 1, F.TINY);

            // Bar background
            var barX = x + 95;
            var barW = w - 113;
            var barH = 6;
            Draw2D.fillRect(barX, y + 2, barW, barH, 0.15, 0.15, 0.25, 1);

            // Bar fill — color based on mood level
            var ratio = m.mood / 100;
            var fillW = barW * ratio;
            var cr = 0, cg = 0, cb = 0;
            if (m.mood <= 25) {
                cr = 0.9; cg = 0.2; cb = 0.2; // red — danger
            } else if (m.mood <= 50) {
                cr = 0.9; cg = 0.7; cb = 0.2; // yellow — meh
            } else {
                cr = 0.3; cg = 0.8; cb = 0.3; // green — good
            }
            if (fillW > 0) Draw2D.fillRect(barX, y + 2, fillW, barH, cr, cg, cb, 1);

            // Mood number
            Draw2D.drawText(barX + barW + 3, y, "" + m.mood, cr, cg, cb, 1, F.TINY);

            y += 34;
        }

        return y; // return final Y for caller to continue drawing below
    },

    // Draw travel event text (fades out over time)
    drawEventText: function(screenW, screenH, dt) {
        if (lastEventTimer <= 0) return;
        lastEventTimer -= dt;
        var alpha = Math.min(1, lastEventTimer / 1.0); // fade in last second

        // Event text at top of screen
        var textW = Draw2D.measureText ? Draw2D.measureText(lastEventText, F.SMALL) : lastEventText.length * 4.5;
        var tx = (screenW - textW) / 2;
        Draw2D.fillRect(tx - 8, 4, textW + 16, 18, 0.08, 0.08, 0.15, alpha * 0.85);
        Draw2D.drawText(tx, 7, lastEventText, 1, 0.95, 0.6, alpha, F.SMALL);
    },

    // Draw mood warnings (shown in city menu as red text)
    drawWarnings: function(x, y) {
        for (var i = 0; i < warnings.length; i++) {
            Draw2D.drawText(x, y, warnings[i], 1, 0.25, 0.25, 1, F.SMALL);
            y += 12;
        }
        return y;
    },

    // Get warnings array (for external checks)
    getWarnings: function() {
        return warnings;
    },

    // Get last event text
    getLastEventText: function() {
        return lastEventText;
    },

    // Reset on new game
    reset: function() {
        usedEventIds = [];
        lastEventText = "";
        lastEventTimer = 0;
        warnings = [];
    }
};

module.exports = BandMoodSystem;
