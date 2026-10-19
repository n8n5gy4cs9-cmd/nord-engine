var Visitors=require("./festival_visitors.js");
var Art = require("./tour_art.js");
// ============================================================================
// MG_FESTIVAL — Ruisrock Festival Management (3-day sim)
// Phase 17: Mikko accidentally becomes Ruisrock manager
// Module: require("./mg_festival.js")
// ============================================================================
var C = require("./game_constants.js");
var Tycoon = require("./mg_tycoon.js");
var F = C.FONT;
var MUSIC = C.MUSIC;
var SFX = C.SFX;
var SPRITES = C.SPRITES;
var PALETTE = C.PALETTE;
var BAND_MUSIC = C.BAND_MUSIC;

// ── BAND POOL ───────────────────────────────────────────────────────────────
var FEST_BANDS = [
    { id: "queen",  name: "Queen",                    genre: "Rock",          cost: 5000, pop: 100, music: BAND_MUSIC.QUEEN },
    { id: "bjm",    name: "Brian Jonestown Massacre", genre: "Psych Rock",    cost: 2500, pop: 90, music: BAND_MUSIC.BJM },
    { id: "aldous", name: "Aldous Harding",           genre: "Art Folk",      cost: 2000, pop: 80, music: BAND_MUSIC.ALDOUS_HARDING },
    { id: "burial", name: "Burial",                   genre: "Electronic",    cost: 2800, pop: 85, music: BAND_MUSIC.BURIAL },
    { id: "islaja", name: "Islaja",                   genre: "Experimental",  cost: 1500, pop: 70, music: BAND_MUSIC.ISLAJA },
    { id: "karhu",  name: "Karhumauri",               genre: "Noise Punk",    cost: 1000, pop: 60, music: BAND_MUSIC.KARHUMAURI },
    { id: "muumi",  name: "Muumipeikon Paluu",        genre: "Synth Pop",     cost: 800,  pop: 50, music: null },
    { id: "sahko",  name: "Sähkö-Sauna",              genre: "Techno",        cost: 600,  pop: 45, music: null },
    { id: "rdc",    name: "Reindeer Death Cult",      genre: "Death Metal",   cost: 700,  pop: 55, music: null },
    { id: "jaatelo",name: "Jäätelöbaari",             genre: "Indie Pop",     cost: 500,  pop: 40, music: null },
    { id: "tundra", name: "Tundra Express",           genre: "Post-Punk",     cost: 900,  pop: 65, music: null }
];

// ── HIRVIPORUKKA EVENTS ─────────────────────────────────────────────────────
// Mikko's friend group — music, art, and art-people jokes
var HIRVIPORUKKA = [
    { name: "Juha",    text: "Juha insists on DJing between sets. He plays 40 minutes of Aphex Twin B-sides. The crowd is confused but intrigued.",
      effect: "happiness", value: -3, flavor: "\"It's AMBIENT, you wouldn't understand.\"" },
    { name: "Akseli",  text: "Akseli 'curates' the food stalls. He replaces every makkara stand with 'deconstructed Nordic tapas'. Price: 45mk per plate.",
      effect: "happiness", value: -8, flavor: "\"The foam represents the Finnish summer.\"" },
    { name: "Arttu",   text: "Arttu paints a live mural on the main stage backdrop. It's beautiful but the paint fumes make the front row dizzy.",
      effect: "happiness", value: 5, flavor: "\"Art requires sacrifice. Mostly from the audience.\"" },
    { name: "Harri",   text: "Harri starts a 2-hour debate about the 'conceptual meaning' of the stage layout with your crew chief.",
      effect: "happiness", value: -5, flavor: "\"The PA speakers face AWAY from the crowd? That's actually genius.\"" },
    { name: "Ilmari",  text: "Ilmari organizes a poetry slam in the beer tent. It devolves into a shouting match about Sibelius vs. Burial.",
      effect: "happiness", value: 3, flavor: "\"BURIAL IS THE SIBELIUS OF OUR TIME\" — Ilmari, standing on a table" },
    { name: "Jukka",   text: "Jukka projects his experimental film on the main screen between acts. It's 20 minutes of a rotating potato.",
      effect: "happiness", value: -4, flavor: "\"The potato symbolizes Finland. Obviously.\"" },
    { name: "Akseli",  text: "Akseli convinces a band to perform 'acoustically' by unplugging all their amps. The drummer plays on overturned buckets.",
      effect: "happiness", value: -6, flavor: "\"RAW. AUTHENTIC. The way music was MEANT to be heard.\"" },
    { name: "Juha",    text: "Juha sets up an 'art installation' in the toilet queue. It's a mirror with 'YOU ARE THE ART' written on it.",
      effect: "happiness", value: 2, flavor: "People take selfies. Juha calls it 'participatory post-irony'." },
    { name: "Harri",   text: "Harri redesigns all the festival signage in an 'avant-garde' font. Nobody can read anything.",
      effect: "happiness", value: -7, flavor: "\"Legibility is a bourgeois construct.\"" },
    { name: "Arttu",   text: "Arttu body-paints festival volunteers as 'living sculptures'. They stand very still and scare children.",
      effect: "happiness", value: -2, flavor: "\"Don't touch the art. The art is Derek from accounting.\"" },
    { name: "Ilmari",  text: "Ilmari writes a 12-page festival program in iambic pentameter. It's actually quite beautiful.",
      effect: "happiness", value: 4, flavor: "\"Day one doth break with thunder from the stage / Where Burial spins beats for every age\"" },
    { name: "Jukka",   text: "Jukka opens a pop-up 'gallery' selling Polaroids of clouds for 200mk each. He sells three.",
      effect: "cash", value: 600, flavor: "\"Art has no price. Except 200mk per cloud.\"" }
];

// ── RANDOM EVENTS ───────────────────────────────────────────────────────────
var FESTIVAL_EVENTS = [
    { id: "rain",    name: "SUDDEN DOWNPOUR", text: "Rain hammers the festival grounds. Mud everywhere.",
      needsStaff: null, happyDelta: -10, costDelta: 0 },
    { id: "mosh",    name: "MOSH PIT CHAOS", text: "A massive mosh pit breaks out during the headliner.",
      needsStaff: "security", happyWithout: -15, happyWith: -3, costDelta: 0 },
    { id: "pa",      name: "PA BLOWOUT", text: "The main PA system blows a fuse mid-song!",
      needsStaff: "crew", happyWithout: -20, happyWith: -5, costDelta: 200 },
    { id: "guest",   name: "SURPRISE GUEST!", text: "A mystery headliner appears unannounced on the side stage!",
      needsStaff: null, happyDelta: 20, costDelta: 0 },
    { id: "sauna",   name: "SAUNA TENT FIRE", text: "The sauna tent catches fire! Classic Finland.",
      needsStaff: null, happyDelta: -10, costDelta: 500 },
    { id: "kosku",   name: "KOSKENKORVA INCIDENT", text: "Someone spiked the lemonade stand with Koskenkorva.",
      needsStaff: "security", happyWithout: -12, happyWith: -3, costDelta: 0 },
    { id: "bonfire", name: "MIDSUMMER BONFIRE", text: "Spontaneous midsummer bonfire by the lake. Everyone gathers!",
      needsStaff: null, happyDelta: 15, costDelta: 0 },
    { id: "merch",   name: "MERCH RUSH", text: "Your band's merch sells out! Fans are wearing Mikko T-shirts everywhere.",
      needsStaff: null, happyDelta: 5, costDelta: -800 }
];

// ── INTRO CUTSCENE ──────────────────────────────────────────────────────────
var INTRO_PAGES = [
    "You roll into Turku. The bus is held together\nby duct tape and Finnish stubbornness.\n\nRuisrock is TOMORROW.",
    "Hannele runs up, waving a piece of paper:\n\n\"Mikko! The festival manager — Seppo Virtanen —\nfell off the sauna bench! Broke both legs\nand his pride!\"",
    "\"Somehow your name was on the backup\nmanager contract. Don't ask how. Pekka might\nhave forged it when he was drunk in Oulu.\"",
    "\"The Hirviporukka are already here.\nJuha, Akseli, Arttu, Harri, Ilmari, Jukka, Henrikki.\nThey 'volunteered' to help.\n\nGod help us all.\"",
    "You are now the MANAGER of\n\n      R U I S R O C K  1 9 9 1\n\nYour band still plays. But YOU run the show.\nThree days. Don't burn it down."
];

// ── STATE ───────────────────────────────────────────────────────────────────
var fest = null;

function createFestState(gs) {
    var merch = Tycoon.festivalMerch(gs);
    gs.resources.cash += merch.revenue;
    var budget = gs.resources.cash + gs.resources.hype * 50;
    var bandPop = 30 + Math.floor(gs.resources.hype / 2) + Math.floor(Tycoon.fame(gs) / 4);
    return {
        phase: "intro",
        introPage: 0,
        fame: Tycoon.fame(gs),
        merchRevenue: merch.revenue,
        day: 1,
        budget: budget,
        startBudget: budget,
        mikkoPop: bandPop,
        facilities:{food:0,toilets:0,merch:0,stage:0,camp:0},buildCursor:0,buildMessage:'',buildCosts:0,
        preview:Visitors.create(18,1991),
        weather:[pickRandom(['SUN','SUN','RAIN']),pickRandom(['SUN','RAIN','WIND']),pickRandom(['SUN','SUN','WIND'])],
        // per-day data
        dayLineup: [],        // [{band, band}] selected this day
        offered: [],           // 4 offered bands for current day
        cursor: 0,
        selected: [],          // indices of selected bands (max 2)
        confirmed: false,
        // staff & prices
        staff: { cleaners: false, security: false, crew: false },
        staffCursor: 0,
        ticketPrice: 40,
        pricePhase: "staff",   // "staff" or "price" sub-phase
        // simulate
        simTimer: 0,
        simDuration: 10,
        simLog: [],
        simLogTimer: 0,
        simEvents: [],
        simPlaying: false,
        // daily tracking
        dayAttendees: 0,
        dayRevenue: 0,
        dayCosts: 0,
        dayHappiness: 70,
        dayIncidents: [],
        dayHirviEvent: null,
        // totals
        totalRevenue: 0,
        totalCosts: 0,
        totalHappiness: 0,
        totalIncidents: 0,
        allLineups: [],
        usedBandIds: [],
        usedHirviIdx: [],
        // results
        festivalRating: 0,
        journeyScore: 0,
        finalScore: 0,
        endingTier: "",
        // gamestate ref
        gs: gs
    };
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function wrapText(text, maxChars) {
    var words = text.split(" ");
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
        if (line.length + words[i].length + 1 > maxChars) {
            lines.push(line);
            line = words[i];
        } else {
            line = line ? (line + " " + words[i]) : words[i];
        }
    }
    if (line) lines.push(line);
    return lines;
}

function offerBands() {
    var available = [];
    for (var i = 0; i < FEST_BANDS.length; i++) {
        if (fest.usedBandIds.indexOf(FEST_BANDS[i].id) < 0) {
            available.push(FEST_BANDS[i]);
        }
    }
    var recorded=shuffle(available.filter(function(b){return !!b.music;}));
    var local=shuffle(available.filter(function(b){return !b.music;}));
    fest.offered=recorded.slice(0,2).concat(local.slice(0,2));
    fest.cursor = 0;
    fest.selected = [];
    fest.confirmed = false;
}

function calcJourneyScore(gs) {
    var score = 0;
    score += gs.resources.hype * 2;
    score += gs.resources.morale;
    score += gs.journey.gigs_played * 10;
    score += gs.journey.encounters_survived * 5;
    var members = 0;
    for (var i = 0; i < gs.band.length; i++) {
        if (gs.band[i].present) members++;
    }
    score += members * 15;
    score += Math.floor(gs.bus.condition / 2);
    score += Tycoon.journeyBonus(gs);
    return score;
}

// ── START ───────────────────────────────────────────────────────────────────
function start(gs) {
    fest = createFestState(gs);
    Audio.playMusic(MUSIC.FESTIVAL_GOOD, true);
}

// ── UPDATE ──────────────────────────────────────────────────────────────────
function update(dt) {
    if (!fest) return null;
    if(fest.phase==='grounds'){
        if(fest.groundsReturn==='simulate'){updateSimulate(dt,true);if(fest.phase!=='grounds')return null;}
        else Visitors.update(fest.preview,dt,fest.facilities,false);
    }

    if((fest.phase==='book'||fest.phase==='staff'||fest.phase==='simulate')&&Input.getKeyDown('g')){fest.groundsReturn=fest.phase;fest.phase='grounds';return null;}
    switch (fest.phase) {
        case "grounds":  return updateGrounds(dt);
        case "intro":    return updateIntro(dt);
        case "book":     return updateBook(dt);
        case "staff":    return updateStaff(dt);
        case "simulate": return updateSimulate(dt);
        case "report":   return updateReport(dt);
        case "results":  return updateResults(dt);
    }
    return null;
}

// ── INTRO ───────────────────────────────────────────────────────────────────
function updateIntro(dt) {
    if (Input.getKeyDown("enter") || Input.getKeyDown("space")) {
        fest.introPage++;
        Audio.play(SFX.UI_CLICK, 0.3);
        if (fest.introPage >= INTRO_PAGES.length) {
            fest.phase = "book";
            offerBands();
        }
    }
    return null;
}

function drawIntro(sw, sh) {
    // Dark background
    Draw2D.fillRect(0, 0, sw, sh, 0.04, 0.02, 0.10, 1);
    Art.background(1,sw,sh,0.28);

    // Ruisrock header
    Draw2D.drawText(sw / 2 - 70, sh * 0.06, "RUISROCK 1991",
        0.94, 0.75, 0.25, 1, F.HEADING);

    // Page text
    var page = INTRO_PAGES[fest.introPage] || "";
    var lines = page.split("\n");
    var startY = sh * 0.22;
    for (var i = 0; i < lines.length; i++) {
        Draw2D.drawText(sw * 0.08, startY + i * 14, lines[i],
            0.85, 0.85, 0.90, 1, F.BODY);
    }

    // Budget display on last page
    if (fest.introPage === INTRO_PAGES.length - 1) {
        Draw2D.drawText(sw * 0.08, sh * 0.75, "Festival budget: " + fest.budget + " mk",
            0.25, 0.88, 0.25, 1, F.UI);
        Draw2D.drawText(sw * 0.08, sh * 0.75 + 16, "Fame " + fest.fame + "/100 fills the field. Gate merch sales: +" + fest.merchRevenue + " mk.",
            0.95, 0.80, 0.35, 1, F.BODY);
    }

    // Prompt
    var blink = (Math.floor(Time.getTime() * 2) % 2 === 0);
    if (blink) {
        Draw2D.drawText(sw / 2 - 50, sh * 0.90, "[ENTER] Continue",
            0.5, 0.5, 0.5, 1, F.SMALL);
    }

    // Page indicator
    Draw2D.drawText(sw - 40, sh * 0.92, (fest.introPage + 1) + "/" + INTRO_PAGES.length,
        0.4, 0.4, 0.4, 1, F.TINY);
}


// ── BOOK ACTS ───────────────────────────────────────────────────────────────
function updateBook(dt) {
    var maxSel = 2;
    var total = fest.offered.length + 1; // +1 for Mikko's band row

    if (Input.getKeyDown("up"))   { fest.cursor = (fest.cursor - 1 + total) % total; Audio.play(SFX.UI_CLICK, 0.2); }
    if (Input.getKeyDown("down")) { fest.cursor = (fest.cursor + 1) % total; Audio.play(SFX.UI_CLICK, 0.2); }

    if (Input.getKeyDown("enter") || Input.getKeyDown("space")) {
        if (fest.cursor < fest.offered.length) {
            // Toggle band selection
            var idx = fest.selected.indexOf(fest.cursor);
            if (idx >= 0) {
                fest.selected.splice(idx, 1);
                Audio.play(SFX.UI_CLICK, 0.3);
            } else if (fest.selected.length < maxSel) {
                // Check budget
                var band = fest.offered[fest.cursor];
                var committed=fest.selected.reduce(function(sum,i){return sum+fest.offered[i].cost;},0);
                if (fest.budget >= committed+band.cost) {
                    fest.selected.push(fest.cursor);
                    Audio.play(SFX.UI_CONFIRM, 0.4);
                } else {
                    Audio.play(SFX.FEEDBACK, 0.3);
                }
            }
        } else {
            // Mikko's band row — auto-included, this is the CONFIRM action
            // A free Mikko-only day remains possible even with an empty budget.
            if (fest.selected.reduce(function(n,i){return n+fest.offered[i].cost;},0)<=fest.budget) {
                // Deduct costs & lock in
                var dayBands = [];
                fest.prepaidActs=0;
                for (var i = 0; i < fest.selected.length; i++) {
                    var b = fest.offered[fest.selected[i]];
                    fest.budget -= b.cost;
                    fest.prepaidActs+=b.cost;
                    fest.usedBandIds.push(b.id);
                    dayBands.push(b);
                }
                fest.dayLineup = dayBands;
                fest.allLineups.push(dayBands.slice());
                fest.phase = "staff";
                fest.staffCursor = 0;
                fest.pricePhase = "staff";
                Audio.play(SFX.CASH_REGISTER, 0.5);
            }
        }
    }
    return null;
}

function drawBook(sw, sh) {
    Draw2D.fillRect(0, 0, sw, sh, 0.05, 0.05, 0.15, 1);
    Art.background(1,sw,sh,0.28);

    // Header
    Draw2D.drawText(sw / 2 - 80, 8, "DAY " + fest.day + " — BOOK ACTS",
        0.94, 0.75, 0.25, 1, F.LARGE);
    Draw2D.drawText(sw - 120, 8, "Budget: " + fest.budget + " mk",
        0.25, 0.88, 0.25, 1, F.BODY);

    // Instructions
    Draw2D.drawText(10, 30, "Book up to 2 acts. Mikko plays free. [G] Build grounds.",
        0.55, 0.55, 0.65, 1, F.TINY);

    Draw2D.drawText(10,sh-44,'CAPACITY '+capacity()+' · FORECAST '+fest.weather[fest.day-1]+' · UPKEEP '+facilityUpkeep()+' mk/day',0.8,0.7,0.55,1,F.TINY);
    // Band list
    var startY = 48;
    var rowH = 28;
    for (var i = 0; i < fest.offered.length; i++) {
        var b = fest.offered[i];
        var y = startY + i * rowH;
        var isSelected = fest.selected.indexOf(i) >= 0;
        var isCursor = fest.cursor === i;

        // Row background
        if (isCursor) {
            Draw2D.fillRect(4, y - 2, sw - 8, rowH - 2, 0.20, 0.20, 0.35, 1);
        }
        if (isSelected) {
            Draw2D.fillRect(4, y - 2, 3, rowH - 2, 0.25, 0.88, 0.25, 1);
        }

        // Cursor arrow
        if (isCursor) {
            Draw2D.drawText(6, y + 2, ">", 0.94, 0.75, 0.25, 1, F.BODY);
        }

        // Band info
        var sel = isSelected ? "[X] " : "[ ] ";
        Draw2D.drawText(18, y + 2, sel + b.name,
            0.85, 0.85, 0.90, 1, F.SMALL);
        Draw2D.drawText(sw - 150, y + 2, b.genre,
            0.55, 0.55, 0.75, 1, F.TINY);
        Draw2D.drawText(sw - 65, y + 2, b.cost + " mk",
            b.cost > fest.budget ? 0.8 : 0.25, b.cost > fest.budget ? 0.2 : 0.8, 0.2, 1, 0.42);

        // Popularity bar
        var barX = sw - 155;
        var barW = 40;
        var barY = y + 16;
        Draw2D.fillRect(barX, barY, barW, 4, 0.15, 0.15, 0.25, 1);
        Draw2D.fillRect(barX, barY, barW * (b.pop / 100), 4, 0.25, 0.65, 0.88, 1);
    }

    // Mikko's band row (always last + confirm)
    var mY = startY + fest.offered.length * rowH;
    var mCursor = fest.cursor === fest.offered.length;
    if (mCursor) {
        Draw2D.fillRect(4, mY - 2, sw - 8, rowH - 2, 0.20, 0.25, 0.20, 1);
        Draw2D.drawText(6, mY + 2, ">", 0.94, 0.75, 0.25, 1, F.BODY);
    }
    Draw2D.drawText(18, mY + 2, "[*] Mikko Levon Band (YOUR BAND — FREE)",
        0.25, 0.88, 0.65, 1, F.SMALL);

    // The Mikko row confirms any affordable selection, including no paid acts.
    if (mCursor) {
        var blink = (Math.floor(Time.getTime() * 3) % 2 === 0);
        if (blink) {
            var confirmText = fest.selected.length === 0 ? "[ENTER] MIKKO ONLY — GO!" : "[ENTER] CONFIRM LINEUP";
            Draw2D.drawText(sw / 2 - 55, sh - 22, confirmText,
                0.25, 0.88, 0.25, 1, F.SMALL);
        }

    }
}

// Persistent park-style facilities, paid once on construction and maintained each day.
var FACILITIES=[
 {id:'food',name:'Food stalls',cost:600,upkeep:80,desc:'3 mk per guest / level; happier visitors',sprite:21},
 {id:'toilets',name:'Toilets',cost:450,upkeep:40,desc:'Serve 80 more guests / level; prevent queues',sprite:19},
 {id:'merch',name:'Merch pavilion',cost:750,upkeep:60,desc:'4 mk per guest / level',sprite:19},
 {id:'stage',name:'Stage roof / PA',cost:1000,upkeep:100,desc:'Weather protection; +3 happiness / level',sprite:18},
 {id:'camp',name:'Camping field',cost:900,upkeep:70,desc:'+70 capacity / level; 2 mk per guest / level',sprite:28}
];
function capacity(){return 100+fest.facilities.camp*70;}
function facilityUpkeep(){return FACILITIES.reduce(function(n,f){return n+fest.facilities[f.id]*f.upkeep;},0);}
function updateGrounds(dt){
 if(Input.getKeyDown('Left')||Input.getKeyDown('Up'))fest.buildCursor=(fest.buildCursor+FACILITIES.length-1)%FACILITIES.length;
 if(Input.getKeyDown('Right')||Input.getKeyDown('Down'))fest.buildCursor=(fest.buildCursor+1)%FACILITIES.length;
 if(Input.getKeyDown('Escape')||Input.getKeyDown('g')){fest.phase=fest.groundsReturn;return null;}
 if(Input.getKeyDown('Return')){
  var f=FACILITIES[fest.buildCursor],lv=fest.facilities[f.id],cost=f.cost*(lv+1);
  if(lv>=3)fest.buildMessage='Maximum level reached.';
  else if(fest.budget<cost)fest.buildMessage='Not enough budget.';
  else {fest.budget-=cost;fest.totalCosts+=cost;fest.buildCosts+=cost;fest.facilities[f.id]++;if(fest.groundsReturn==='simulate')fest.dayCosts+=f.upkeep;fest.buildMessage=f.name+' upgraded. -'+cost+' mk';Audio.play(SFX.CASH_REGISTER,0.4);}
 }
 return null;
}
function drawGrounds(sw,sh){
 Art.background(2,sw,sh);
 Art.header('RUISROCK · FESTIVAL GROUNDS','ARROWS · select plot    ENTER · build/upgrade    G / ESC · return to planning',sw);
 for(var i=0;i<FACILITIES.length;i++){
  var f=FACILITIES[i],x=70+i*118,y=125+(i%2)*45,selected=i===fest.buildCursor;
  Draw2D.drawCircle(x,y,30,selected?1:0.4,selected?0.72:0.4,0.3,0.9,1);
  Art.facility(i,x-50,y-55,100,80,fest.facilities[f.id]>0?1:0.55);
  Art.panel(x-47,y+30,94,35);Art.text(x-40,y+34,f.name,0.53);Art.text(x-40,y+50,'LEVEL '+fest.facilities[f.id]+'/3',0.53);
 }
 Visitors.draw(fest.groundsReturn==='simulate'?fest.visitors:fest.preview);
 var f=FACILITIES[fest.buildCursor],lv=fest.facilities[f.id];
 Art.panel(10,244,sw-20,106);
 Art.text(22,254,f.name+' · '+(lv>=3?'MAX':f.cost*(lv+1)+' mk to upgrade'),0.85);
 Art.text(22,277,f.desc,0.65);
 Art.text(22,298,'BUDGET '+fest.budget+' mk   CAPACITY '+capacity()+'   UPKEEP '+facilityUpkeep()+' / day',0.65);
 Art.text(22,322,fest.buildMessage||(fest.groundsReturn==='simulate'?'Festival open · customers and artist sets continue.':'Grounds preview · facilities stay for all three days.'),0.6);
}

// ── STAFF & PRICES ──────────────────────────────────────────────────────────
var STAFF_ITEMS = [
    { key: "cleaners", name: "Cleaners", cost: 300, desc: "Keeps grounds clean" },
    { key: "security", name: "Security", cost: 400, desc: "Handles fights & chaos" },
    { key: "crew",     name: "Stage Crew", cost: 500, desc: "Fixes PA & tech issues" }
];

function updateStaff(dt) {
    if (fest.pricePhase === "staff") {
        if (Input.getKeyDown("up"))   { fest.staffCursor = (fest.staffCursor - 1 + STAFF_ITEMS.length) % STAFF_ITEMS.length; Audio.play(SFX.UI_CLICK, 0.2); }
        if (Input.getKeyDown("down")) { fest.staffCursor = (fest.staffCursor + 1) % STAFF_ITEMS.length; Audio.play(SFX.UI_CLICK, 0.2); }

        if (Input.getKeyDown("enter") || Input.getKeyDown("space")) {
            var si = STAFF_ITEMS[fest.staffCursor];
            fest.staff[si.key] = !fest.staff[si.key];
            Audio.play(SFX.UI_CONFIRM, 0.3);
        }

        if (Input.getKeyDown("tab") || Input.getKeyDown("right")) {
            fest.pricePhase = "price";
            Audio.play(SFX.UI_CLICK, 0.2);
        }
    } else {
        // price adjustment
        if (Input.getKeyDown("left"))  { fest.ticketPrice = Math.max(10, fest.ticketPrice - 5); Audio.play(SFX.UI_CLICK, 0.2); }
        if (Input.getKeyDown("right")) { fest.ticketPrice = Math.min(100, fest.ticketPrice + 5); Audio.play(SFX.UI_CLICK, 0.2); }

        if (Input.getKeyDown("tab") || Input.getKeyDown("left") && fest.ticketPrice <= 10) {
            fest.pricePhase = "staff";
            Audio.play(SFX.UI_CLICK, 0.2);
        }

        if (Input.getKeyDown("enter") || Input.getKeyDown("space")) {
            // Confirm → start simulation
            startSimulation();
            Audio.play(SFX.UI_CONFIRM, 0.5);
        }
    }
    return null;
}

function drawStaff(sw, sh) {
    Draw2D.fillRect(0, 0, sw, sh, 0.05, 0.05, 0.15, 1);
    Art.background(1,sw,sh,0.28);

    Draw2D.drawText(sw / 2 - 80, 8, "DAY " + fest.day + " — SETUP",
        0.94, 0.75, 0.25, 1, F.LARGE);
    Draw2D.drawText(sw - 120, 8, "Budget: " + fest.budget + " mk",
        0.25, 0.88, 0.25, 1, F.BODY);

    // Staff panel (left)
    var onStaff = fest.pricePhase === "staff";
    Draw2D.drawText(15, 35, "HIRE STAFF (per day)", onStaff ? 0.94 : 0.5, onStaff ? 0.75 : 0.5, onStaff ? 0.25 : 0.5, 1, F.BODY);

    for (var i = 0; i < STAFF_ITEMS.length; i++) {
        var si = STAFF_ITEMS[i];
        var y = 55 + i * 26;
        var hired = fest.staff[si.key];
        var cursor = onStaff && fest.staffCursor === i;

        if (cursor) Draw2D.fillRect(8, y - 2, sw / 2 - 16, 22, 0.20, 0.20, 0.35, 1);

        var tag = hired ? "[X] " : "[ ] ";
        Draw2D.drawText(15, y + 2, (cursor ? "> " : "  ") + tag + si.name,
            0.85, 0.85, 0.90, 1, F.SMALL);
        Draw2D.drawText(15, y + 14, "  " + si.cost + " mk/day — " + si.desc,
            0.50, 0.50, 0.60, 1, F.TINY);
    }

    // Staff cost total
    var staffCost = 0;
    for (var k in fest.staff) { if (fest.staff[k]) { for (var s = 0; s < STAFF_ITEMS.length; s++) { if (STAFF_ITEMS[s].key === k) staffCost += STAFF_ITEMS[s].cost; } } }
    Draw2D.drawText(15, 140, "Staff cost: " + staffCost + " mk/day",
        0.65, 0.55, 0.55, 1, F.TINY);

    // Price panel (right)
    var onPrice = fest.pricePhase === "price";
    Draw2D.drawText(sw / 2 + 10, 35, "TICKET PRICE", onPrice ? 0.94 : 0.5, onPrice ? 0.75 : 0.5, onPrice ? 0.25 : 0.5, 1, F.BODY);

    // Big price display
    Draw2D.fillRect(sw / 2 + 10, 55, sw / 2 - 25, 40, 0.10, 0.10, 0.20, 1);
    Draw2D.drawText(sw / 2 + 35, 60, fest.ticketPrice + " mk",
        0.94, 0.88, 0.35, 1, F.TITLE_BIG);
    if (onPrice) {
        Draw2D.drawText(sw / 2 + 15, 65, "<", 0.65, 0.65, 0.65, 1, F.UI);
        Draw2D.drawText(sw - 28, 65, ">", 0.65, 0.65, 0.65, 1, F.UI);
    }

    // Attendance estimate
    var avgPop = 0;
    for (var d = 0; d < fest.dayLineup.length; d++) avgPop += fest.dayLineup[d].pop;
    avgPop = (avgPop / Math.max(1, fest.dayLineup.length) + fest.mikkoPop) / 2;
    var weatherMul=fest.weather[fest.day-1]==='SUN'?1:fest.weather[fest.day-1]==='RAIN'?0.82:0.9;
    var estAttendees = Math.min(capacity(),Math.floor((avgPop + 20) * (110 - fest.ticketPrice) / 80*weatherMul));
    Draw2D.drawText(sw / 2 + 10, 102, "Est. attendance: ~" + estAttendees,
        0.55, 0.75, 0.55, 1, F.TINY);
    Draw2D.drawText(sw / 2 + 10, 116, "Est. gate: ~" + (estAttendees * fest.ticketPrice) + " mk",
        0.55, 0.75, 0.55, 1, F.TINY);

    Draw2D.drawText(sw/2+10,134,'Stalls: ~'+estAttendees*(fest.facilities.food*3+fest.facilities.merch*4+fest.facilities.camp*2)+' mk',0.8,0.7,0.55,1,F.TINY);
    Draw2D.drawText(sw/2+10,152,'Grounds: '+facilityUpkeep()+' mk/day · '+fest.weather[fest.day-1],0.8,0.7,0.55,1,F.TINY);
    // Lineup reminder
    Draw2D.drawText(10, sh - 62, "Today's lineup:", 0.55, 0.55, 0.65, 1, F.TINY);
    for (var l = 0; l < fest.dayLineup.length; l++) {
        Draw2D.drawText(18, sh - 48 + l * 12, "- " + fest.dayLineup[l].name,
            0.70, 0.70, 0.80, 1, F.TINY);
    }
    Draw2D.drawText(18, sh - 48 + fest.dayLineup.length * 12, "- Mikko Levon Band",
        0.25, 0.88, 0.65, 1, F.TINY);

    // Navigation hints
    Draw2D.drawText(sw / 2 - 80, sh - 16, "[TAB] Panel  [ENTER] Start day  [G] Grounds",
        0.45, 0.45, 0.55, 1, F.TINY);
}

// ── SIMULATE DAY ────────────────────────────────────────────────────────────
function startSimulation() {
    // Calculate staff cost
    var staffCost = 0;
    for (var i = 0; i < STAFF_ITEMS.length; i++) {
        if (fest.staff[STAFF_ITEMS[i].key]) staffCost += STAFF_ITEMS[i].cost;
    }
    var actCost = 0;
    for (var a = 0; a < fest.dayLineup.length; a++) actCost += fest.dayLineup[a].cost;

    fest.dayCosts = staffCost + actCost + facilityUpkeep();

    // Calculate attendees
    var avgPop = 0;
    for (var p = 0; p < fest.dayLineup.length; p++) avgPop += fest.dayLineup[p].pop;
    avgPop = (avgPop / Math.max(1, fest.dayLineup.length) + fest.mikkoPop) / 2;
    var base = (avgPop + 20) * (110 - fest.ticketPrice) / 80;
    var weatherMul=fest.weather[fest.day-1]==='RAIN'?0.82:fest.weather[fest.day-1]==='WIND'?0.9:1;
    fest.dayAttendees = Math.min(capacity(),Math.floor(base * weatherMul * (0.85 + Math.random() * 0.30)));
    fest.gateRevenue=fest.dayAttendees*fest.ticketPrice;
    fest.stallRevenue=0;
    fest.visitors=Visitors.create(fest.dayAttendees,1991+fest.day*7919);
    fest.dayRevenue = fest.gateRevenue+fest.stallRevenue;
    var toiletShortfall=Math.max(0,fest.dayAttendees-(80+fest.facilities.toilets*80));
    fest.dayHappiness = 70+fest.facilities.food*2+fest.facilities.stage*3-Math.min(25,Math.floor(toiletShortfall/3));
    if(fest.weather[fest.day-1]!=='SUN'&&fest.facilities.stage===0)fest.dayHappiness-=10;
    fest.dayIncidents = [];
    fest.dayHirviEvent = null;

    // Build simulation log
    fest.simLog = [];
    fest.simLog.push("RUISROCK DAY " + fest.day + " — GATES OPEN!");
    fest.simLog.push(fest.dayAttendees + " festival-goers pour through the gates.");
    fest.simLog.push('FORECAST: '+fest.weather[fest.day-1]+' · capacity '+capacity());
    fest.simLog.push('Gate '+fest.gateRevenue+' mk · stalls '+fest.stallRevenue+' mk · grounds upkeep '+facilityUpkeep()+' mk');
    if(toiletShortfall>0)fest.simLog.push('Toilet queues hurt happiness. Expand before tomorrow.');

    // Acts performing
    for (var n = 0; n < fest.dayLineup.length; n++) {
        fest.simLog.push(fest.dayLineup[n].name + " takes the stage! [" + fest.dayLineup[n].genre + "]");
    }
    fest.simLog.push("Mikko Levon Band rocks the main stage!");

    // Random events (1-2)
    var numEvents = 1 + (Math.random() < 0.5 ? 1 : 0);
    var shuffledEvents = shuffle(FESTIVAL_EVENTS);
    for (var e = 0; e < numEvents && e < shuffledEvents.length; e++) {
        var ev = shuffledEvents[e];
        fest.simLog.push("EVENT: " + ev.name + " — " + ev.text);
        fest.dayIncidents.push(ev.name);

        if (ev.needsStaff) {
            if (fest.staff[ev.needsStaff]) {
                fest.dayHappiness += ev.happyWith;
                fest.simLog.push("Your " + ev.needsStaff + " handle it. Minor disruption.");
            } else {
                fest.dayHappiness += ev.happyWithout;
                fest.simLog.push("No " + ev.needsStaff + "! Situation gets bad.");
            }
        } else {
            fest.dayHappiness += ev.happyDelta;
        }
        fest.dayCosts += ev.costDelta;
    }

    // Hirviporukka event (1 per day)
    var hirviPool = [];
    for (var h = 0; h < HIRVIPORUKKA.length; h++) {
        if (fest.usedHirviIdx.indexOf(h) < 0) hirviPool.push(h);
    }
    if (hirviPool.length > 0) {
        var hIdx = hirviPool[Math.floor(Math.random() * hirviPool.length)];
        fest.usedHirviIdx.push(hIdx);
        var hev = HIRVIPORUKKA[hIdx];
        fest.dayHirviEvent = hev;
        fest.simLog.push("HIRVIPORUKKA: " + hev.text);
        fest.simLog.push(hev.flavor);
        if (hev.effect === "happiness") {
            fest.dayHappiness += hev.value;
        } else if (hev.effect === "cash") {
            fest.dayRevenue += Math.abs(hev.value);
            fest.simLog.push("+" + Math.abs(hev.value) + " mk from Jukka's art sales!");
        }
    }

    fest.dayHappiness = clamp(fest.dayHappiness, 0, 100);

    fest.simLog.push("Day " + fest.day + " winds down... the crowd drifts to the campfires.");

    // Every paid act plays its own recording only during its booked set.
    var first=fest.dayLineup[0];
    Audio.playMusic(first&&first.music?first.music:MUSIC.GIG,true);
    fest.simDuration=(fest.dayLineup.length+1)*90;
    fest.lastStallRevenue=0;
    fest.simTimer = 0;
    fest.simLogTimer = 0;
    fest.simPlaying = true;
    fest.simCurrentActIdx = 0; // track which act is playing for music rotation
    fest.phase = "simulate";
}

function updateSimulate(dt,building) {
    fest.simTimer += dt;
    fest.simLogTimer += dt;
    fest.visitors.closing=fest.simTimer>=fest.simDuration-20;
    Visitors.update(fest.visitors,dt,fest.facilities,true);
    fest.stallRevenue=Math.floor(fest.visitors.income);
    // Event income is retained; service income is added only once per change.
    fest.dayRevenue+=fest.stallRevenue-(fest.lastStallRevenue||0);fest.lastStallRevenue=fest.stallRevenue;
    if(Input.getKeyDown('n'))fest.simTimer=Math.min(fest.simDuration,(Math.floor(fest.simTimer/90)+1)*90);

    // Rotate music when the displayed act changes
    var totalActs = fest.dayLineup.length + 1; // +1 for Mikko
    var actIdx = Math.min(Math.floor(fest.simTimer / (fest.simDuration / totalActs)), fest.dayLineup.length);
    if (actIdx !== fest.simCurrentActIdx) {
        fest.simCurrentActIdx = actIdx;
        var act=fest.dayLineup[actIdx];
        Audio.playMusic(act&&act.music?act.music:MUSIC.GIG,true);
    }

    if (fest.simTimer >= fest.simDuration || !building&&(Input.getKeyDown("enter") || Input.getKeyDown("space"))) {
        if (fest.simTimer < fest.simDuration && Input.getKeyDown("enter")) {
            fest.simTimer = fest.simDuration; // skip to end
            return null;
        }
        // Closing/skip settles the day using the service visits actually completed.
        fest.dayHappiness=clamp(fest.dayHappiness+Visitors.satisfaction(fest.visitors),0,100);
        fest.simLog.push('Customer service: '+fest.visitors.served+' served · '+fest.visitors.lost+' abandoned queues.');
        // Transition to report
        fest.budget += fest.dayRevenue - (fest.dayCosts-(fest.prepaidActs||0));
        fest.totalRevenue += fest.dayRevenue;
        fest.totalCosts += fest.dayCosts;
        fest.totalHappiness += fest.dayHappiness;
        fest.totalIncidents += fest.dayIncidents.length;
        fest.phase = "report";
        Audio.play(SFX.UI_CONFIRM, 0.5);
    }
    return null;
}

function drawSimulate(sw,sh){
 Art.background(2,sw,sh);
 var idx=Math.min(Math.floor(fest.simTimer/90),fest.dayLineup.length),act=fest.dayLineup[idx];
 Art.header('RUISROCK · DAY '+fest.day+' · '+fest.weather[fest.day-1],'ON STAGE: '+(act?act.name:'Mikko Levon Band')+'     [G] Build   [N] Next set   [ENTER] Close day',sw);
 for(var i=0;i<FACILITIES.length;i++){
  var f=FACILITIES[i],x=70+i*118,y=125+(i%2)*45;
  Art.facility(i,x-45,y-50,90,75,i===3||fest.facilities[f.id]>0?1:0.35);
  Art.text(x-40,y+26,f.name+' '+fest.facilities[f.id],0.5);
 }
 Visitors.draw(fest.visitors);
 Art.panel(8,250,sw-16,102);
 Art.text(18,259,'GATE '+fest.dayAttendees+' / '+capacity()+'   STALLS '+fest.stallRevenue+' mk   BUDGET '+fest.budget+' mk',0.65);
 Art.text(18,280,'SERVED '+fest.visitors.served+'   LOST QUEUES '+fest.visitors.lost+'   HAPPINESS '+clamp(fest.dayHappiness+Visitors.satisfaction(fest.visitors),0,100)+'%',0.65);
 var visible=Math.min(fest.simLog.length,Math.floor(fest.simTimer/fest.simDuration*(fest.simLog.length-1))+1),line=fest.simLog[Math.max(0,visible-1)]||'Gates open.';
 Draw2D.drawText(18,302,line.slice(0,100),0.8,0.75,0.85,1,0.55);
 Draw2D.fillRect(18,332,sw-36,5,0.18,0.10,0.26,1);
 Draw2D.fillRect(18,332,(sw-36)*clamp(fest.simTimer/fest.simDuration,0,1),5,0.9,0.55,0.35,1);
}

// ── DAILY REPORT ────────────────────────────────────────────────────────────
function updateReport(dt) {
    if (Input.getKeyDown("enter") || Input.getKeyDown("space")) {
        Audio.play(SFX.UI_CONFIRM, 0.4);
        if (fest.day >= 3) {
            // Festival over → results
            calcFinalResults();
            fest.phase = "results";
            var goodFest = fest.festivalRating >= 50;
            Audio.playMusic(goodFest ? MUSIC.FESTIVAL_GOOD : MUSIC.FESTIVAL_BAD, false);
        } else {
            fest.day++;
            fest.phase = "book";
            offerBands();
        }
    }
    return null;
}

function drawReport(sw, sh) {
    Draw2D.fillRect(0, 0, sw, sh, 0.92, 0.88, 0.78, 1);
    Art.background(1,sw,sh,0.28); // newspaper bg

    // Newspaper header
    Draw2D.fillRect(10, 8, sw - 20, 28, 0.08, 0.06, 0.04, 1);
    Draw2D.drawText(sw / 2 - 55, 12, "TURUN SANOMAT",
        0.92, 0.88, 0.78, 1, F.LARGE);

    // Headline
    var profit = fest.dayRevenue - fest.dayCosts;
    var headline;
    if (fest.dayHappiness >= 80) headline = "INCREDIBLE DAY " + fest.day + " AT RUISROCK!";
    else if (fest.dayHappiness >= 60) headline = "Solid Day " + fest.day + " — Crowds Pleased";
    else if (fest.dayHappiness >= 40) headline = "Mixed Reactions to Day " + fest.day;
    else headline = "DISASTER: Day " + fest.day + " Goes Wrong";

    Draw2D.drawText(14, 44, headline, 0.08, 0.06, 0.04, 1, F.LABEL);

    // divider
    Draw2D.fillRect(10, 58, sw - 20, 1, 0.25, 0.22, 0.18, 1);

    // Stats
    var col1 = 18;
    var col2 = sw / 2 + 10;
    var y = 66;
    var lh = 14;
    var ink = [0.12, 0.10, 0.08, 1];

    Draw2D.drawText(col1, y, "Attendees: " + fest.dayAttendees, ink[0], ink[1], ink[2], ink[3], F.TINY);
    Draw2D.drawText(col2, y, "Happiness: " + fest.dayHappiness + "%", ink[0], ink[1], ink[2], ink[3], F.TINY);
    y += lh;
    Draw2D.drawText(col1, y, "Revenue: +" + fest.dayRevenue + " mk", 0.10, 0.40, 0.10, 1, F.TINY);
    Draw2D.drawText(col2, y, "Costs: -" + fest.dayCosts + " mk", 0.55, 0.15, 0.10, 1, F.TINY);
    y += lh;
    var profitColor = profit >= 0 ? [0.10, 0.45, 0.10] : [0.65, 0.10, 0.10];
    Draw2D.drawText(col1, y, "Profit: " + (profit >= 0 ? "+" : "") + profit + " mk",
        profitColor[0], profitColor[1], profitColor[2], 1, 0.48);
    Draw2D.drawText(col2, y, "Budget: " + fest.budget + " mk", ink[0], ink[1], ink[2], ink[3], F.TINY);

    // divider
    y += lh + 4;
    Draw2D.fillRect(10, y, sw - 20, 1, 0.25, 0.22, 0.18, 1);
    y += 6;

    // Incidents
    if (fest.dayIncidents.length > 0) {
        Draw2D.drawText(col1, y, "Incidents:", ink[0], ink[1], ink[2], ink[3], F.TINY);
        y += lh;
        for (var i = 0; i < fest.dayIncidents.length; i++) {
            Draw2D.drawText(col1 + 8, y, "- " + fest.dayIncidents[i],
                0.55, 0.25, 0.15, 1, F.TINY);
            y += 12;
        }
    }

    // Hirviporukka highlight
    if (fest.dayHirviEvent) {
        y += 4;
        Draw2D.drawText(col1, y, "HIRVIPORUKKA WATCH:", 0.35, 0.15, 0.50, 1, F.TINY);
        y += lh;
        var hLines = wrapText(fest.dayHirviEvent.text, 50);
        for (var h = 0; h < hLines.length; h++) {
            Draw2D.drawText(col1 + 4, y, hLines[h], 0.30, 0.20, 0.45, 1, F.TINY);
            y += 11;
        }
        y += 2;
        Draw2D.drawText(col1 + 4, y, fest.dayHirviEvent.flavor, 0.45, 0.30, 0.55, 1, F.TINY);
    }

    // Continue prompt
    var nextText = fest.day >= 3 ? "[ENTER] Final Results" : "[ENTER] Day " + (fest.day + 1);
    var blink = (Math.floor(Time.getTime() * 2) % 2 === 0);
    if (blink) {
        Draw2D.drawText(sw / 2 - 55, sh - 18, nextText,
            0.35, 0.30, 0.25, 1, F.TINY);
    }
}

// ── FINAL RESULTS ───────────────────────────────────────────────────────────
function calcFinalResults() {
    // Festival rating: happiness (40%) + profit (30%) - incidents (30%)
    var avgHappy = fest.totalHappiness / 3;
    var totalProfit = fest.totalRevenue - fest.totalCosts;
    var profitScore = clamp(50 + totalProfit / 100, 0, 100);
    var incidentPenalty = fest.totalIncidents * 8;

    fest.festivalRating = Math.floor(
        avgHappy * 0.40 +
        profitScore * 0.30 +
        Math.max(0, 100 - incidentPenalty) * 0.30
    );
    fest.festivalRating = clamp(fest.festivalRating, 0, 100);

    fest.journeyScore = calcJourneyScore(fest.gs);
    fest.finalScore = fest.journeyScore + fest.festivalRating;

    // 5 tiers
    if (fest.finalScore >= 180) fest.endingTier = "legendary";
    else if (fest.finalScore >= 140) fest.endingTier = "great";
    else if (fest.finalScore >= 100) fest.endingTier = "decent";
    else if (fest.finalScore >= 60) fest.endingTier = "poor";
    else fest.endingTier = "disaster";
}

var ENDING_TEXTS = {
    legendary: "LEGENDARY! Ruisrock 1991 goes down in history.\nMikko Levon — musician, manager, madman.\nThe Hirviporukka take a bow.\nFinland will never be the same.",
    great:     "GREAT festival! Some hiccups, but the crowd\nloved it. Mikko's band gets a record deal.\nJuha claims partial credit.\n\"I curated the VIBE.\"",
    decent:    "DECENT. Not the best Ruisrock, not the worst.\nMikko survives. The bus does not.\nAkseli critiques the 'lack of conceptual depth'.\nEveryone ignores him.",
    poor:      "POOR showing. The crowd was disappointed.\nMikko swears he's done with management.\nThe Hirviporukka blame each other.\nThe bus smells like regret.",
    disaster:  "TOTAL DISASTER. Ruisrock 1991 is cancelled\nby day 3. Mikko flees in the bus.\nHarri writes a 40-page essay about it.\n\"Actually, the failure WAS the art.\""
};

var ENDING_SPRITES = {
    legendary: SPRITES.END_LEGENDARY,
    great:     SPRITES.END_GREAT,
    decent:    SPRITES.END_DECENT,
    poor:      SPRITES.END_POOR,
    disaster:  SPRITES.END_DISASTER
};

function updateResults(dt) {
    if (Input.getKeyDown("r")) {
        return { done: true, restart: true };
    }
    return null;
}

function drawResults(sw, sh) {
    Draw2D.fillRect(0, 0, sw, sh, 0.04, 0.02, 0.10, 1);
    Art.background(1,sw,sh,0.28);

    // Ending sprite (if exists)
    var sprite = ENDING_SPRITES[fest.endingTier];
    if (sprite) {
        Draw2D.drawImage(sw / 2 - 64, sh * 0.04, 128, 80, sprite, 1, 1, 1, 0.8);
    }

    // Title
    var tierUpper = fest.endingTier.toUpperCase();
    Draw2D.drawText(sw / 2 - 70, sh * 0.38, tierUpper + "!",
        0.94, 0.75, 0.25, 1, F.TITLE_BIG);

    // Ending text
    var endText = ENDING_TEXTS[fest.endingTier] || "";
    var lines = endText.split("\n");
    for (var i = 0; i < lines.length; i++) {
        Draw2D.drawText(sw * 0.06, sh * 0.48 + i * 14, lines[i],
            0.80, 0.80, 0.88, 1, F.TINY);
    }

    // Score breakdown
    var scoreY = sh * 0.72;
    Draw2D.fillRect(10, scoreY - 4, sw - 20, 50, 0.08, 0.06, 0.15, 1);
    Draw2D.drawText(15, scoreY, "Journey Score: " + fest.journeyScore,
        0.60, 0.60, 0.75, 1, F.SMALL);
    Draw2D.drawText(15, scoreY + 14, "Festival Rating: " + fest.festivalRating + "/100",
        0.60, 0.60, 0.75, 1, F.SMALL);
    Draw2D.drawText(15, scoreY + 30, "FINAL SCORE: " + fest.finalScore,
        0.94, 0.88, 0.35, 1, F.LABEL);

    // Ruisrock lineup recap
    Draw2D.drawText(sw / 2 + 10, scoreY, "RUISROCK 91 LINEUP:",
        0.55, 0.55, 0.65, 1, F.TINY);
    var allBands = [];
    for (var d = 0; d < fest.allLineups.length; d++) {
        for (var b = 0; b < fest.allLineups[d].length; b++) {
            var name = fest.allLineups[d][b].name;
            if (allBands.indexOf(name) < 0) allBands.push(name);
        }
    }
    allBands.push("Mikko Levon Band");
    for (var lb = 0; lb < allBands.length && lb < 4; lb++) {
        Draw2D.drawText(sw / 2 + 14, scoreY + 12 + lb * 10, "- " + allBands[lb],
            0.55, 0.55, 0.70, 1, F.MICRO);
    }

    // Restart prompt
    var blink = (Math.floor(Time.getTime() * 2) % 2 === 0);
    if (blink) {
        Draw2D.drawText(sw / 2 - 60, sh - 16, "[R] Play again from the beginning",
            0.5, 0.5, 0.5, 1, F.TINY);
    }
}

// ── MAIN DRAW ───────────────────────────────────────────────────────────────
function draw(screenW, screenH) {
    if (!fest) return;

    switch (fest.phase) {
        case "grounds":  drawGrounds(screenW,screenH); break;
        case "intro":    drawIntro(screenW, screenH); break;
        case "book":     drawBook(screenW, screenH); break;
        case "staff":    drawStaff(screenW, screenH); break;
        case "simulate": drawSimulate(screenW, screenH); break;
        case "report":   drawReport(screenW, screenH); break;
        case "results":  drawResults(screenW, screenH); break;
    }
}

// ── MODULE EXPORT ───────────────────────────────────────────────────────────
module.exports = {
    get state() { return fest; },
    cheat: function(phase,day,perfect) {
        fest.day=day;
        if(phase==='book'||phase==='grounds')offerBands();
        if(phase==='grounds')fest.groundsReturn='book';
        if(phase==='staff'||phase==='simulate'||phase==='report'){
            fest.dayLineup=[];fest.prepaidActs=0;
            if(phase!=='staff'){startSimulation();if(phase==='report'){fest.simTimer=fest.simDuration;updateSimulate(0);}}
        }
        if(phase==='results'){
            if(perfect){fest.totalHappiness=300;fest.totalRevenue=100000;fest.totalCosts=0;fest.totalIncidents=0;fest.budget=100000;}
            calcFinalResults();
        }
        fest.phase=phase;
    },
    start: start,
    update: update,
    draw: draw
};
