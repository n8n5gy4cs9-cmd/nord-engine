var R=require("./retro.js");
// ============================================================================
// MICRO-GIG SYSTEM — extracted from midnight_sun.js §11c
// 3-phase performance: Intro -> Performance (rhythm prompts) -> Results
// Usage: var Gig = require("./mg_gig.js");
// ============================================================================

var C = require("./game_constants.js");
var Tycoon = require("./mg_tycoon.js");
var SFX = C.SFX;
var MUSIC = C.MUSIC;

var GIG_KEYS = ["a", "s", "d", "f"];
var GIG_KEY_LABELS = ["A", "S", "D", "F"];
var GIG_INTRO_TIME = 6.0;
var GIG_PERF_DURATION = 20.0;
var GIG_PROMPT_COUNT = 24;
var GIG_HIT_ZONE_X = 80;
var GIG_HIT_WINDOW_PERFECT = 8;
var GIG_HIT_WINDOW_GOOD = 18;

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
        this.city = city || { id:"venue", name: "Unknown Venue", gig_fee_min:100, gig_fee_max:300 };
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
            var t = spacing * (i + 1);
            this.prompts.push({
                key: GIG_KEYS[[0, 1, 2, 1, 3, 2, 0, 3][i % 8]],
                time: t, x: 320, hit: false, result: "none"
            });
        }
        this.prompts.sort(function(a, b) { return a.time - b.time; });
        this.maxScore = GIG_PROMPT_COUNT * 100;

        console.log("[Gig] Started in " + this.city.name + " -- " + GIG_PROMPT_COUNT + " prompts");
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
                p.x = GIG_HIT_ZONE_X + (p.time - this.timer) * 130;
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
            if (this.timer >= GIG_INTRO_TIME || Input.getKeyDown("Return")) {
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

    // The real stage sits above a compact four-lane tracker, not behind floating stick figures.
    draw:function(w,h){
        Draw2D.fillRect(0,0,w,h,0.04,0.025,0.09,1);R.bg(2,w,200);
        for(var i=0;i<4;i++)if(this.gs.band[i]&&this.gs.band[i].present){
            var bounce=this.phase==='performance'?Math.sin(this.timer*6+i)*2:0;
            R.performer(i+(this.phase==='performance'?Math.floor(this.timer*4)%2*4:0),98+i*112,84+bounce,84,96);
        }
        R.header('ROADSIDE ENCORE · '+this.city.name,'A / S / D / F · play as the note crosses the copper pickup line',w);
        R.box(12,188,w-24,113);
        for(var i=0;i<4;i++){
            var y=207+i*20;Draw2D.drawLine(55,y,w-30,y,0.38,0.25,0.4,1,1);
            R.text(26,y-7,GIG_KEY_LABELS[i],0.65);
        }
        Draw2D.fillRect(GIG_HIT_ZONE_X-2,195,4,98,0.95,0.68,0.35,1);
        for(var i=0;i<this.prompts.length;i++){
            var p=this.prompts[i];if(p.result!=='none'||p.x<55||p.x>w-25)continue;
            var lane=GIG_KEYS.indexOf(p.key),y=207+lane*20;
            Draw2D.fillRect(p.x-7,y-6,14,12,0.9,0.60-lane*0.07,0.34+lane*0.1,1);R.text(p.x-3,y-6,GIG_KEY_LABELS[lane],0.52);
        }
        R.text(105,173,this.flashTimer>0?this.flashText:'KEEP THE BAND TOGETHER',0.65);
        R.text(360,173,'COMBO '+this.combo+' · SCORE '+this.score,0.65);
        if(this.phase==='intro')R.result('ONE MORE SONG',['A steady four-lane pattern. Watch the pickup line.','Good playing earns cash, hype and merch sales.','ENTER · count the band in'],w,h);
        if(this.phase==='results')R.result('THANK YOU, '+this.city.name.toUpperCase(),['Score '+this.score+'/'+this.maxScore+' · best combo '+this.maxCombo,'Gig fee '+this.payout+' FIM · hype '+this.hypeGain],w,h);
    }
};
module.exports=GigSystem;
