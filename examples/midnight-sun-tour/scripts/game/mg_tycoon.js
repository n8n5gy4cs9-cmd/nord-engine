// ============================================================================
// TYCOON LAYER — "Tour Office": garage upgrades, merch stall, promo, ledger, fame and daily wages.
// Usage: var Tycoon = require("./mg_tycoon.js");  State lives in gs.tycoon (created lazily, so old saves load).
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;

var UPGRADES = [
    { id: "engine", name: "Tuned Engine",     desc: "-12% gas use per level",        max: 3, cost: [300, 600, 1000] },
    { id: "tires",  name: "Winter Tires",     desc: "-15% bus wear per level",       max: 3, cost: [250, 500, 900] },
    { id: "tank",   name: "Long-range Tank",  desc: "+20 max gas per level",         max: 2, cost: [300, 600] },
    { id: "sauna",  name: "Sauna Module",     desc: "+4 morale when resting",        max: 2, cost: [400, 800] },
    { id: "pa",     name: "Big PA System",    desc: "+10% gig fee per level",        max: 3, cost: [350, 700, 1200] }
];

var MERCH = [
    { id: "shirts",   name: "Tour T-shirts", wholesale: 12, base: 35, appeal: 1.0, size: 2 },
    { id: "records",  name: "Cassettes",     wholesale: 20, base: 55, appeal: 0.7, size: 1 },
    { id: "stickers", name: "Stickers",      wholesale: 3,  base: 10, appeal: 1.4, size: 1 }
];

var PROMOS = [
    { id: "posters", name: "Poster run",           cost: 60,  hype: 6,  fame: 0, desc: "Staple posters on every lamp post" },
    { id: "radio",   name: "Local radio spot",     cost: 200, hype: 12, fame: 1, desc: "Thirty seconds between two tango songs" },
    { id: "press",   name: "Newspaper interview",  cost: 350, hype: 10, fame: 3, desc: "Mikko says something quotable" }
];

var TABS = ["GARAGE", "MERCH", "PROMO", "LEDGER"];
var WAGE_PER_MEMBER = 8; // per crew member per leg of the journey
var BATCH = 10;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function ensure(gs) {
    if (!gs.tycoon) {
        gs.tycoon = {
            fame: 0, upgrades: {}, merch: { shirts: 0, records: 0, stickers: 0 },
            prices: { shirts: 35, records: 55, stickers: 10 }, promoDone: {}, promoBonus: 0,
            income: { gigs: 0, merch: 0 }, expense: { garage: 0, stock: 0, promo: 0, wages: 0 },
            merchSold: 0, cashMark: gs.resources.cash, lastGig: null
        };
    }
    return gs.tycoon;
}

function level(gs, id) { return ensure(gs).upgrades[id] || 0; }

function stockCount(gs) {
    var t = ensure(gs), n = 0;
    for (var i = 0; i < MERCH.length; i++) n += (t.merch[MERCH[i].id] || 0) * MERCH[i].size;
    return n;
}

function stockCapacity(gs) {
    var box = false;
    for (var i = 0; i < gs.inventory.length; i++) if (gs.inventory[i].id === "merch_box") box = true;
    return box ? 80 : 24;
}

function stockValue(gs) {
    var t = ensure(gs), v = 0;
    for (var i = 0; i < MERCH.length; i++) v += (t.merch[MERCH[i].id] || 0) * MERCH[i].wholesale;
    return v;
}

// Cash not explained by a tracked sale/purchase (fuel, food, events, fines) shows up on the ledger as "other".
function other(gs) { var t = ensure(gs); return gs.resources.cash - t.cashMark; }

function track(gs, kind, cat, amount) {
    var t = ensure(gs);
    t[kind][cat] = (t[kind][cat] || 0) + amount;
    t.cashMark = gs.resources.cash;
}

var Tycoon = {
    UPGRADES: UPGRADES, MERCH: MERCH, PROMOS: PROMOS, ensure: ensure, level: level, stockCount: stockCount, stockCapacity: stockCapacity,

    // ── MODIFIERS used by the rest of the game ───────────────────────
    gasMul: function(gs) { return 1 - 0.12 * level(gs, "engine"); },
    wearMul: function(gs) { return 1 - 0.15 * level(gs, "tires"); },
    restMorale: function(gs) { return 4 * level(gs, "sauna"); },
    applyTank: function(gs) { gs.bus.max_gas = 80 + 20 * level(gs, "tank"); },
    gigMul: function(gs) {
        var t = ensure(gs);
        return (1 + 0.10 * level(gs, "pa")) * (1 + t.fame / 200) * (1 + t.promoBonus);
    },
    fame: function(gs) { return Math.round(ensure(gs).fame); },

    // Encounter outcome keys added by the tycoon layer: fame, stock (+n shirts), merch_cash handled by normal cash.
    applyEffects: function(gs, outcome) {
        var t = ensure(gs);
        if (outcome.fame) t.fame = clamp(t.fame + outcome.fame, 0, 100);
        if (outcome.stock) {
            var room = Math.max(0, stockCapacity(gs) - stockCount(gs));
            t.merch.shirts += Math.min(room / 2, outcome.stock) | 0;
        }
        if (outcome.sell) {
            var sold = 0, rev = 0;
            for (var i = 0; i < MERCH.length; i++) {
                var m = MERCH[i], n = Math.min(t.merch[m.id], outcome.sell);
                t.merch[m.id] -= n; sold += n; rev += n * t.prices[m.id];
            }
            gs.resources.cash += rev; t.merchSold += sold; track(gs, "income", "merch", rev);
        }
    },

    // ── EVERY LEG OF THE JOURNEY: per diem + hype fades ──────────────
    onLeg: function(gs) {
        var t = ensure(gs), crew = 0;
        for (var i = 0; i < gs.band.length; i++) if (gs.band[i].present) crew++;
        var due = crew * WAGE_PER_MEMBER, paid = Math.min(due, gs.resources.cash);
        gs.resources.cash -= paid;
        track(gs, "expense", "wages", paid);
        gs.resources.hype = Math.max(0, gs.resources.hype - 1);
        var msg = "Per diem paid: " + paid + " FIM.";
        if (paid < due) { gs.resources.morale = Math.max(0, gs.resources.morale - 8); msg += " Short on cash! Crew grumbles."; }
        Tycoon.toast(msg, paid < due ? [1, 0.45, 0.35] : [0.9, 0.85, 0.5]);
    },

    // ── GIG: fame + merch table after the show ───────────────────────
    afterGig: function(gs, city, ratio, payout) {
        var t = ensure(gs);
        t.promoBonus = 0;
        track(gs, "income", "gigs", payout);
        var fameGain = ratio >= 0.9 ? 4 : ratio >= 0.7 ? 3 : ratio >= 0.5 ? 1.5 : ratio >= 0.3 ? 0 : -1;
        t.fame = clamp(t.fame + fameGain, 0, 100);
        var crowd = (city.gig_fee_max / 150) + gs.resources.hype / 25 + t.fame / 20;
        var demand = crowd * (0.4 + ratio), lines = [], revenue = 0, units = 0;
        for (var i = 0; i < MERCH.length; i++) {
            var m = MERCH[i], price = t.prices[m.id];
            var pf = clamp(1.6 - 0.9 * (price / m.base), 0.05, 1.4);
            var n = Math.min(t.merch[m.id], Math.round(demand * m.appeal * pf));
            if (n > 0) { t.merch[m.id] -= n; revenue += n * price; units += n; lines.push(n + " " + m.name.toLowerCase()); }
        }
        if (revenue > 0) { gs.resources.cash += revenue; t.merchSold += units; track(gs, "income", "merch", revenue); }
        t.lastGig = { fame: fameGain, revenue: revenue, units: units, text: lines.join(", ") };
        return t.lastGig;
    },

    // ── FESTIVAL: remaining stock sold to the Ruisrock crowd at a fair price ───
    festivalMerch: function(gs) {
        var t = ensure(gs), rev = 0, units = 0;
        for (var i = 0; i < MERCH.length; i++) {
            var m = MERCH[i], n = t.merch[m.id];
            rev += n * m.base; units += n; t.merch[m.id] = 0;
        }
        t.merchSold += units;
        if (rev > 0) track(gs, "income", "merch", rev);
        return { revenue: rev, units: units };
    },
    journeyBonus: function(gs) {
        var t = ensure(gs), ups = 0;
        for (var i = 0; i < UPGRADES.length; i++) ups += level(gs, UPGRADES[i].id);
        return Math.round(t.fame * 2 + ups * 5 + t.merchSold / 2);
    },

    // ── TOAST ────────────────────────────────────────────────────────
    _toast: null,
    toast: function(text, col) { Tycoon._toast = { text: text, t: 4, col: col || [1, 1, 1] }; },
    drawToast: function(screenW, dt) {
        var k = Tycoon._toast;
        if (!k) return;
        k.t -= dt;
        if (k.t <= 0) { Tycoon._toast = null; return; }
        var a = Math.min(1, k.t);
        Draw2D.fillRect(0, 4, screenW, 18, 0.05, 0.04, 0.10, 0.85 * a);
        Draw2D.drawTextAligned(screenW / 2, 6, k.text, "center", k.col[0], k.col[1], k.col[2], a, F.BODY);
    },

    // ── TOUR OFFICE (sub-screen) ─────────────────────────────────────
    ui: { open: false, tab: 0, sel: 0, msg: "", gs: null, city: null },

    open: function(gs, city) {
        ensure(gs);
        Tycoon.ui = { open: true, tab: 0, sel: 0, msg: "", gs: gs, city: city };
    },

    listSize: function() {
        var u = Tycoon.ui;
        return u.tab === 0 ? UPGRADES.length : u.tab === 1 ? MERCH.length : u.tab === 2 ? PROMOS.length : 0;
    },

    say: function(text) { Tycoon.ui.msg = text; },

    buyUpgrade: function(up) {
        var u = Tycoon.ui, gs = u.gs, lv = level(gs, up.id);
        if (u.city.services.indexOf("mechanic") === -1) return Tycoon.say("No garage in " + u.city.name + ". Find a mechanic.");
        if (lv >= up.max) return Tycoon.say(up.name + " is maxed out.");
        var cost = up.cost[lv];
        if (gs.resources.cash < cost) return Tycoon.say("Need " + cost + " FIM.");
        gs.resources.cash -= cost; track(gs, "expense", "garage", cost);
        ensure(gs).upgrades[up.id] = lv + 1;
        if (up.id === "tank") { Tycoon.applyTank(gs); gs.bus.gas = Math.min(gs.bus.max_gas, gs.bus.gas + 20); }
        Audio.play(SFX.LEVEL_UP, 0.5);
        Tycoon.say(up.name + " installed (lvl " + (lv + 1) + ").");
    },

    buyStock: function(m) {
        var u = Tycoon.ui, gs = u.gs, t = ensure(gs);
        if (stockCount(gs) + m.size * BATCH > stockCapacity(gs)) return Tycoon.say("Bus is full. Pack the Merch Box for more room.");
        var cost = m.wholesale * BATCH;
        if (gs.resources.cash < cost) return Tycoon.say("Need " + cost + " FIM.");
        gs.resources.cash -= cost; track(gs, "expense", "stock", cost);
        t.merch[m.id] += BATCH;
        Audio.play(SFX.ITEM_PICKUP, 0.5);
        Tycoon.say("Bought " + BATCH + " " + m.name.toLowerCase() + " for " + cost + " FIM.");
    },

    buyPromo: function(p) {
        var u = Tycoon.ui, gs = u.gs, t = ensure(gs), key = u.city.id + ":" + p.id;
        if (!u.city.gig_available) return Tycoon.say("Nobody to promote to in " + u.city.name + ".");
        if (t.promoDone[key]) return Tycoon.say("Already done in " + u.city.name + ".");
        if (gs.resources.cash < p.cost) return Tycoon.say("Need " + p.cost + " FIM.");
        gs.resources.cash -= p.cost; track(gs, "expense", "promo", p.cost);
        t.promoDone[key] = true;
        gs.resources.hype = Math.min(100, gs.resources.hype + p.hype);
        t.fame = clamp(t.fame + p.fame, 0, 100);
        t.promoBonus = Math.min(0.5, t.promoBonus + p.hype / 100);
        Audio.play(SFX.CASH_REGISTER, 0.5);
        Tycoon.say(p.name + ": +" + p.hype + " hype, next gig +" + p.hype + "% fee.");
    },

    // Returns "close" when the player leaves; otherwise null.
    handleInput: function() {
        var u = Tycoon.ui, gs = u.gs, t = ensure(gs);
        if (Input.getKeyDown("Escape")) { u.open = false; return "close"; }
        if (Input.getKeyDown("Tab")) { u.tab = (u.tab + 1) % TABS.length; u.sel = 0; u.msg = ""; }
        for (var i = 0; i < TABS.length; i++) if (Input.getKeyDown("" + (i + 1))) { u.tab = i; u.sel = 0; u.msg = ""; }
        var n = Tycoon.listSize();
        if (n > 0) {
            if (Input.getKeyDown("Up") || Input.getKeyDown("w")) u.sel = (u.sel - 1 + n) % n;
            if (Input.getKeyDown("Down") || Input.getKeyDown("s")) u.sel = (u.sel + 1) % n;
        }
        if (u.tab === 1) {
            var m = MERCH[u.sel];
            if (Input.getKeyDown("Left") || Input.getKeyDown("a")) t.prices[m.id] = Math.max(m.wholesale, t.prices[m.id] - Math.max(1, Math.round(m.base / 12)));
            if (Input.getKeyDown("Right") || Input.getKeyDown("d")) t.prices[m.id] = Math.min(m.base * 3, t.prices[m.id] + Math.max(1, Math.round(m.base / 12)));
        }
        if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
            if (u.tab === 0) Tycoon.buyUpgrade(UPGRADES[u.sel]);
            else if (u.tab === 1) Tycoon.buyStock(MERCH[u.sel]);
            else if (u.tab === 2) Tycoon.buyPromo(PROMOS[u.sel]);
        }
        return null;
    },

    draw: function(screenW, screenH) {
        var u = Tycoon.ui, gs = u.gs, t = ensure(gs);
        Draw2D.fillRect(0, 0, screenW, screenH, 0.06, 0.05, 0.11, 1);
        Draw2D.fillRect(0, 0, screenW, 26, 0.12, 0.10, 0.22, 1);
        Draw2D.drawText(12, 4, "TOUR OFFICE - " + u.city.name, 0.95, 0.80, 0.35, 1, F.HEADING);
        Draw2D.drawTextAligned(screenW - 12, 6, "CASH " + gs.resources.cash + " FIM   FAME " + Math.round(t.fame), "right", 0.9, 0.9, 0.9, 1, F.UI);

        for (var i = 0; i < TABS.length; i++) {
            var x = 12 + i * 100, on = (u.tab === i);
            Draw2D.fillRect(x, 32, 94, 18, on ? 0.35 : 0.14, on ? 0.25 : 0.12, on ? 0.50 : 0.24, 1);
            Draw2D.drawTextAligned(x + 47, 35, (i + 1) + " " + TABS[i], "center", on ? 1 : 0.6, on ? 0.9 : 0.6, on ? 0.4 : 0.7, 1, F.BODY);
        }
        var y = 62;
        if (u.tab === 0) {
            var garage = u.city.services.indexOf("mechanic") !== -1;
            Draw2D.drawText(12, y - 2, garage ? "Garage open. Upgrades stay with the bus." : "No garage in this town - upgrades are sold where a mechanic works.", garage ? 0.5 : 0.9, garage ? 0.85 : 0.5, garage ? 0.5 : 0.4, 1, F.BODY);
            y += 18;
            for (var a = 0; a < UPGRADES.length; a++) {
                var up = UPGRADES[a], lv = level(gs, up.id), sel = (u.sel === a);
                if (sel) Draw2D.fillRect(8, y - 2, screenW - 16, 30, 0.22, 0.16, 0.36, 1);
                Draw2D.drawText(14, y, (sel ? "> " : "  ") + up.name + "  [" + lv + "/" + up.max + "]", sel ? 1 : 0.8, sel ? 0.95 : 0.8, sel ? 0.4 : 0.85, 1, F.UI);
                Draw2D.drawText(14, y + 14, "   " + up.desc, 0.6, 0.6, 0.72, 1, F.SMALL);
                var cost = lv >= up.max ? "MAX" : up.cost[lv] + " FIM";
                Draw2D.drawTextAligned(screenW - 16, y + 2, cost, "right", lv >= up.max ? 0.5 : (gs.resources.cash >= up.cost[lv] ? 0.4 : 0.9), lv >= up.max ? 0.9 : (gs.resources.cash >= up.cost[lv] ? 0.9 : 0.4), 0.4, 1, F.UI);
                y += 34;
            }
        } else if (u.tab === 1) {
            Draw2D.drawText(12, y - 2, "Stock " + stockCount(gs) + "/" + stockCapacity(gs) + " slots   (Merch Box in the bus = more room)   [ENTER] buy " + BATCH + "   [LEFT/RIGHT] price", 0.6, 0.85, 0.7, 1, F.SMALL);
            y += 18;
            for (var b = 0; b < MERCH.length; b++) {
                var m = MERCH[b], s2 = (u.sel === b), price = t.prices[m.id];
                var pf = clamp(1.6 - 0.9 * (price / m.base), 0.05, 1.4);
                if (s2) Draw2D.fillRect(8, y - 2, screenW - 16, 38, 0.22, 0.16, 0.36, 1);
                Draw2D.drawText(14, y, (s2 ? "> " : "  ") + m.name + "   in stock: " + t.merch[m.id], s2 ? 1 : 0.8, s2 ? 0.95 : 0.8, s2 ? 0.4 : 0.85, 1, F.UI);
                Draw2D.drawText(14, y + 14, "   wholesale " + m.wholesale + " FIM   your price " + price + " FIM   profit " + (price - m.wholesale) + "/pc", 0.6, 0.6, 0.72, 1, F.SMALL);
                var dem = pf > 0.9 ? "hot" : pf > 0.5 ? "steady" : "slow";
                Draw2D.drawText(14, y + 25, "   demand at this price: " + dem, pf > 0.9 ? 0.4 : pf > 0.5 ? 0.9 : 0.9, pf > 0.9 ? 0.9 : pf > 0.5 ? 0.85 : 0.4, 0.4, 1, F.SMALL);
                y += 44;
            }
            Draw2D.drawText(12, y + 4, "Merch sells after every gig, and what is left sells at Ruisrock for the base price.", 0.5, 0.5, 0.62, 1, F.SMALL);
        } else if (u.tab === 2) {
            Draw2D.drawText(12, y - 2, u.city.gig_available ? "Promotion raises hype and your next gig fee. One of each per town." : "No venue here - promotion would be wasted.", 0.7, 0.8, 0.9, 1, F.BODY);
            y += 18;
            for (var c = 0; c < PROMOS.length; c++) {
                var p = PROMOS[c], s3 = (u.sel === c), done = t.promoDone[u.city.id + ":" + p.id];
                if (s3) Draw2D.fillRect(8, y - 2, screenW - 16, 30, 0.22, 0.16, 0.36, 1);
                Draw2D.drawText(14, y, (s3 ? "> " : "  ") + p.name + (done ? "  (done)" : ""), s3 ? 1 : 0.8, s3 ? 0.95 : 0.8, s3 ? 0.4 : 0.85, 1, F.UI);
                Draw2D.drawText(14, y + 14, "   " + p.desc + " (+" + p.hype + " hype" + (p.fame ? ", +" + p.fame + " fame" : "") + ")", 0.6, 0.6, 0.72, 1, F.SMALL);
                Draw2D.drawTextAligned(screenW - 16, y + 2, p.cost + " FIM", "right", gs.resources.cash >= p.cost ? 0.4 : 0.9, gs.resources.cash >= p.cost ? 0.9 : 0.4, 0.4, 1, F.UI);
                y += 34;
            }
        } else {
            var inc = t.income, exp = t.expense, ti = inc.gigs + inc.merch, te = 0;
            for (var k in exp) te += exp[k];
            var oth = other(gs);
            Draw2D.drawText(12, y, "INCOME", 0.4, 0.9, 0.4, 1, F.LABEL);
            Draw2D.drawText(24, y + 14, "Gigs: " + inc.gigs + "    Merch: " + inc.merch + " (" + t.merchSold + " sold)", 0.8, 0.8, 0.85, 1, F.BODY);
            Draw2D.drawText(12, y + 34, "EXPENSES", 0.9, 0.45, 0.4, 1, F.LABEL);
            Draw2D.drawText(24, y + 48, "Garage: " + exp.garage + "    Stock: " + exp.stock + "    Promo: " + exp.promo, 0.8, 0.8, 0.85, 1, F.BODY);
            Draw2D.drawText(24, y + 62, "Crew per diem: " + exp.wages, 0.8, 0.8, 0.85, 1, F.BODY);
            Draw2D.drawText(12, y + 84, "Untracked (fuel, food, repairs, fines, finds): " + (oth >= 0 ? "+" : "") + oth + " FIM", 0.7, 0.7, 0.8, 1, F.BODY);
            Draw2D.fillRect(12, y + 102, screenW - 24, 1, 0.3, 0.3, 0.45, 1);
            Draw2D.drawText(12, y + 110, "Tracked profit: " + (ti - te) + " FIM    Stock value: " + stockValue(gs) + " FIM    Fame: " + Math.round(t.fame) + "/100", 1, 0.9, 0.5, 1, F.UI);
            Draw2D.drawText(12, y + 132, "Fame lifts every gig fee (up to +50%) and fills the Ruisrock crowd.", 0.55, 0.55, 0.68, 1, F.SMALL);
        }
        if (u.msg) Draw2D.drawTextAligned(screenW / 2, screenH - 38, u.msg, "center", 1, 0.9, 0.45, 1, F.BODY);
        Draw2D.drawText(12, screenH - 18, "[TAB / 1-4] Tabs   [UP/DOWN] Select   [ENTER] Buy   [ESC] Back to town", 0.4, 0.4, 0.55, 1, F.BODY);
    }
};

module.exports = Tycoon;
