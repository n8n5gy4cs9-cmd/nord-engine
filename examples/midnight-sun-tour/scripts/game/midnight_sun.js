// ============================================================================
// MIKKO LEVON'S: MIDNIGHT SUN TOUR  — v2 Orchestrator
// All minigames extracted to separate modules via require()
// ============================================================================
//
// Controls:
//   Title:     ENTER to start, S to load save
//   Overworld: UP/DOWN to select city, ENTER to travel, ESC for menu
//   City:      1-6 to select actions, ESC to leave
//
// ============================================================================

// ============================================================================
// §0 — MODULE IMPORTS
// ============================================================================
var BandMood         = require("./band_mood.js");
var C                = require("./game_constants.js");
var F                = C.FONT;
var EncounterSystem  = require("./mg_encounters.js");
var GigSystem        = require("./mg_gig.js");
var SoundCheckSystem = require("./mg_soundcheck.js");
var MooseDodgeSystem = require("./mg_moosedodge.js");
var GearPackSystem   = require("./mg_gearpack.js");
var KickoffSystem    = require("./mg_kickoff.js");
var SpaceSystem      = require("./mg_space.js");
var TrailSystem      = require("./mg_trail.js");
var RaceSystem       = require("./mg_race.js");
var TentSystem       = require("./mg_tent.js");
var FuelSystem       = require("./mg_fuel.js");
var RunnerSystem     = require("./mg_runner.js");
var NightSystem      = require("./mg_night.js");
var StarfoxSystem    = require("./mg_starfox.js");
var FestivalSystem   = require("./mg_festival.js");
var Jobs             = require("./mg_jobs.js");
var Art              = require("./tour_art.js");
var Tycoon           = require("./mg_tycoon.js");

// Shortcuts for asset paths from shared constants
var MUSIC   = C.MUSIC;
var SFX     = C.SFX;
var SPRITES = C.SPRITES;
var PALETTE = C.PALETTE;
var COPPER_TITLE    = C.COPPER_TITLE;
var COPPER_OVERWORLD = C.COPPER_OVERWORLD;

// ============================================================================
// §2 — GAME DATA (cities, routes, band, gear)
// ============================================================================

var CITIES = [
    {
        id: "kuusamo", name: "Kuusamo",
        x: 250, y: 220, type: "start",
        services: ["gas", "food", "mechanic"],
        gig_available: false, gig_fee_min: 0, gig_fee_max: 0,
        flavor: "Cold. Everyone owns a snowmobile.",
        bad_reputation: false
    },
    {
        id: "kajaani", name: "Kajaani",
        x: 210, y: 190, type: "city",
        services: ["gas", "food"],
        gig_available: true, gig_fee_min: 200, gig_fee_max: 500,
        flavor: "Tar town. Someone spray-painted BURIAL on the water tower.",
        bad_reputation: false
    },
    {
        id: "iisalmi", name: "Iisalmi",
        x: 195, y: 165, type: "city",
        services: ["gas", "food", "mechanic", "arcade"],
        gig_available: true, gig_fee_min: 150, gig_fee_max: 400,
        flavor: "Home of Olvi beer. Risto is happy. Islaja poster in the kiosk window.",
        bad_reputation: false
    },
    {
        id: "kuopio", name: "Kuopio",
        x: 205, y: 140, type: "city",
        services: ["gas", "food", "mechanic"],
        gig_available: true, gig_fee_min: 300, gig_fee_max: 700,
        flavor: "Fish market. Sauna capital. A busker plays Aldous Harding covers.",
        bad_reputation: false
    },
    {
        id: "jyvaskyla", name: "Jyväskylä",
        x: 170, y: 110, type: "city",
        services: ["gas", "food", "mechanic", "arcade"],
        gig_available: true, gig_fee_min: 400, gig_fee_max: 900,
        flavor: "University town. BJM gig last week — sold out, of course.",
        bad_reputation: false
    },
    {
        id: "tampere", name: "Tampere",
        x: 140, y: 85, type: "city",
        services: ["gas", "food", "mechanic", "arcade"],
        gig_available: true, gig_fee_min: 500, gig_fee_max: 1200,
        flavor: "Industrial heart. Karhumauri played here last week. Mustamakkara.",
        bad_reputation: false
    },
    {
        id: "hameenlinna", name: "Hämeenlinna",
        x: 150, y: 65, type: "city",
        services: ["gas", "food"],
        gig_available: true, gig_fee_min: 300, gig_fee_max: 600,
        flavor: "Castle town. A Burial mixtape echoes from a parked car.",
        bad_reputation: false
    },
    {
        id: "turku", name: "Turku",
        x: 100, y: 40, type: "end",
        services: ["gas", "food", "mechanic"],
        gig_available: false, gig_fee_min: 0, gig_fee_max: 0,
        flavor: "Ruisrock awaits. BJM and Aldous Harding on the poster. This is it.",
        bad_reputation: false
    }
];

var ROUTES = [
    { from: "kuusamo",     to: "kajaani",      distance_km: 180, road_type: "highway",  encounter_rate: 0.65, hazard_rate: 0.35 },
    { from: "kajaani",     to: "iisalmi",      distance_km: 85,  road_type: "regional", encounter_rate: 0.55, hazard_rate: 0.95 },
    { from: "iisalmi",     to: "kuopio",       distance_km: 80,  road_type: "highway",  encounter_rate: 0.85, hazard_rate: 0.25 },
    { from: "kuopio",      to: "jyvaskyla",    distance_km: 160, road_type: "highway",  encounter_rate: 0.75, hazard_rate: 0.40 },
    { from: "jyvaskyla",   to: "tampere",      distance_km: 155, road_type: "highway",  encounter_rate: 0.95, hazard_rate: 0.35 },
    { from: "tampere",     to: "hameenlinna",  distance_km: 80,  road_type: "regional", encounter_rate: 0.55, hazard_rate: 0.85 },
    { from: "hameenlinna", to: "turku",        distance_km: 110, road_type: "highway",  encounter_rate: 0.60, hazard_rate: 0.30 }
];

var BAND_DATA = [
    { id: "mikko",   name: "Mikko",   role: "vocalist",  skill: 8, mood: 70, present: true },
    { id: "pekka",   name: "Pekka",   role: "guitarist", skill: 7, mood: 65, present: true },
    { id: "risto",   name: "Risto",   role: "bassist",   skill: 6, mood: 80, present: true },
    { id: "hannele", name: "Hannele", role: "drummer",    skill: 9, mood: 55, present: true }
];

var GEAR_DATA = [
    { id: "guitar_amp",   name: "Guitar Amp",    size: [3, 2], condition: 90, mandatory: true },
    { id: "drum_kit",     name: "Drum Kit",       size: [4, 3], condition: 75, mandatory: true },
    { id: "pa_speakers",  name: "PA Speakers",    size: [2, 3], condition: 85, mandatory: true },
    { id: "merch_box",    name: "Merch Box",      size: [2, 1], condition: 100, mandatory: false },
    { id: "spare_tire",   name: "Spare Tire",     size: [1, 1], condition: 100, mandatory: false },
    { id: "beer_crate",   name: "Beer Crate",     size: [2, 1], condition: 100, mandatory: false },
    { id: "guitar_case",  name: "Guitar Case",    size: [3, 1], condition: 95, mandatory: true }
];

// ============================================================================
// §2b — ENCOUNTER DATA
// ============================================================================

var ENCOUNTERS = [
    {
        id: "moose_road", name: "Moose on the Road",
        description: "A massive bull moose stands in the middle of the highway, staring at the bus with zero intention of moving.",
        sprite: "assets/sprites/enc_moose_road.png",
        choices: [
            { text: "Honk and wait patiently", success: { morale: -3, description: "The moose eventually wanders off. 10 minutes lost." }, fail_chance: 0 },
            { text: "Swerve around it (risky)", success: { description: "Pekka grabs the wheel and threads the gap perfectly." }, fail: { bus_condition: -15, morale: -5, description: "The bus clips a ditch. Suspension groans ominously." }, fail_chance: 0.4 },
            { text: "Risto offers it a beer", success: { morale: +10, food: -1, description: "The moose sniffs the can and trots away. Everyone laughs." }, fail: { morale: -5, food: -1, description: "The moose ignores the beer and headbutts the bumper." }, fail_chance: 0.3 }
        ]
    },
    {
        id: "speed_camera", name: "Speed Camera",
        description: "A flash of light from the roadside — you just drove past a speed camera doing 20 over.",
        sprite: "assets/sprites/enc_speed_camera.png",
        choices: [
            { text: "Accept the fine", success: { cash: -120, description: "A 120 FIM fine arrives. At least you're honest." }, fail_chance: 0 },
            { text: "Floor it and pretend nothing happened", success: { description: "Maybe the camera was broken? No fine arrives." }, fail: { cash: -250, description: "Double fine for attempting to flee. 250 FIM." }, fail_chance: 0.5 }
        ]
    },
    {
        id: "karaoke_bar", name: "Roadside Karaoke Bar",
        description: "A flickering neon sign reads 'KARAOKE TONIGHT - FREE BEER FOR PERFORMERS'. Risto is already unbuckling.",
        sprite: "assets/sprites/enc_karaoke_bar.png",
        choices: [
            { text: "Stop and perform", success: { morale: +12, hype: +5, cash: +50, description: "Mikko belts out Levan Polkka. The crowd goes wild. Tips flow." }, fail: { morale: +5, hype: -3, description: "Hannele gets into an argument about tempo. Awkward." }, fail_chance: 0.25 },
            { text: "Drive past — no time for karaoke", success: { morale: -5, description: "Risto sulks for the next 40 kilometers." }, fail_chance: 0 }
        ]
    },
    {
        id: "wrong_turn", name: "Wrong Turn",
        description: "The GPS died 50km ago. This gravel road doesn't look right. A hand-painted sign says 'PRIVATE ROAD'.",
        sprite: "assets/sprites/enc_wrong_turn.png",
        choices: [
            { text: "Turn back (costs gas)", success: { gas: -8, description: "30 minutes lost, but you find the highway again." }, fail_chance: 0 },
            { text: "Keep going — it has to lead somewhere", success: { description: "A shortcut! You save 20 minutes." }, fail: { gas: -12, bus_condition: -10, description: "Dead end. The gravel road wrecks the suspension on the way back." }, fail_chance: 0.5 }
        ]
    },
    {
        id: "rainstorm", name: "Summer Rainstorm",
        description: "The sky turns dark at 2pm. Rain hammers the windshield. Visibility drops to nearly zero.",
        sprite: "assets/sprites/enc_rainstorm.png",
        choices: [
            { text: "Pull over and wait it out", success: { morale: -3, description: "The band naps for an hour. Rain passes." }, fail_chance: 0 },
            { text: "Push through — Mikko can see fine", success: { description: "Rain thins out after 10 minutes. Lucky." }, fail: { bus_condition: -8, morale: -5, description: "Hydroplane into a ditch. Nobody hurt, bus dented." }, fail_chance: 0.35 }
        ]
    },
    {
        id: "hitchhiker", name: "Hitchhiker",
        description: "A drenched teenager with a guitar case stands by the road. Thumb out, hopeful expression.",
        sprite: "assets/sprites/enc_hitchhiker.png",
        choices: [
            { text: "Pick them up", success: { morale: +8, hype: +3, description: "Turns out they run a local music blog. Free publicity!" }, fail: { food: -2, morale: -3, description: "They eat all the snacks and snore the whole way." }, fail_chance: 0.3 },
            { text: "Wave and drive on", success: { description: "The band feels mildly guilty but moves on." }, fail_chance: 0 }
        ]
    },
    {
        id: "roadwork", name: "Roadwork Detour",
        description: "Orange cones block the highway. A bored worker waves you onto a 40km detour through logging roads.",
        sprite: "assets/sprites/enc_roadwork.png",
        choices: [
            { text: "Take the detour", success: { gas: -6, description: "Long but safe. Pretty scenery at least." }, fail_chance: 0 },
            { text: "Sneak past the cones", success: { description: "Nobody notices. You save 30 minutes." }, fail: { cash: -150, description: "A foreman catches you. 150 FIM fine and a stern lecture." }, fail_chance: 0.45 }
        ]
    },
    {
        id: "local_band", name: "Local Band Challenge",
        description: "A rival band called 'Karhumauri' pulls up beside you at a gas station. They challenge you to a parking lot jam battle.",
        sprite: "assets/sprites/enc_local_band.png",
        choices: [
            { text: "Accept the challenge!", success: { hype: +10, morale: +8, description: "You blow them away with a killer set. Word spreads." }, fail: { hype: -5, morale: -8, description: "Their drummer is terrifyingly good. Hannele fumes silently." }, fail_chance: 0.35 },
            { text: "Politely decline", success: { morale: -3, description: "No drama. Risto mutters about missed opportunities." }, fail_chance: 0 },
            { text: "Invite them for beers instead", success: { morale: +6, food: -1, cash: -30, hype: +4, description: "You bond over tales of bad gigs. Karhumauri promise to come to Ruisrock." }, fail_chance: 0 }
        ]
    },
    {
        id: "broken_bridge", name: "Bridge Out",
        description: "The wooden bridge over the river looks... structural. One plank is actively falling as you watch.",
        sprite: "assets/sprites/enc_broken_bridge.png",
        choices: [
            { text: "Cross slowly", success: { description: "The bus creaks over. Boards groan but hold." }, fail: { bus_condition: -20, morale: -10, description: "A plank snaps! The bus drops a wheel into the gap. Damage." }, fail_chance: 0.4 },
            { text: "Find another way around", success: { gas: -10, description: "A farmer shows you a ford downstream. Extra gas burned but safe." }, fail_chance: 0 }
        ]
    },
    {
        id: "festival_rumour", name: "Festival Gossip",
        description: "You stop at a kiosk. The cashier says 'Heard Ruisrock has Queen AND Brian Jonestown Massacre this year. They still need an opening act though...'",
        sprite: "assets/sprites/enc_festival_rumour.png",
        choices: [
            { text: "\"We're gonna be the HEADLINER.\"", success: { hype: +8, morale: +10, description: "The cashier takes a photo. It ends up in the local paper." }, fail: { hype: -3, description: "The cashier laughs. Mikko's ego takes a hit." }, fail_chance: 0.2 },
            { text: "Play it cool — just nod", success: { hype: +3, description: "Mysterious. Intriguing. Hype maintained." }, fail_chance: 0 }
        ]
    },
    {
        id: "midsummer", name: "Midsummer Bonfire",
        description: "You pass a lakeside village celebrating Juhannus. Massive bonfire, accordion music, sausages on sticks.",
        sprite: "assets/sprites/enc_midsummer.png",
        choices: [
            { text: "Join the celebration", success: { morale: +15, food: +2, hype: +5, description: "Best makkara ever. Hannele even smiles. Someone mentions your band name to friends." }, fail: { morale: +8, band_mood: -5, description: "Great time, but Pekka falls asleep by the fire. Slight sunburn." }, fail_chance: 0.2 },
            { text: "Wave from the bus and keep driving", success: { morale: -5, description: "The smell of grilled sausage haunts the bus for miles." }, fail_chance: 0 }
        ]
    },
    {
        id: "sauna_stop", name: "Roadside Sauna",
        description: "A sign: 'SAUNA OPEN — 20 FIM'. Steam curls from a tiny wooden building by a lake. The bus is overheating anyway.",
        sprite: "assets/sprites/enc_sauna.png",
        choices: [
            { text: "Everyone into the sauna!", success: { cash: -20, morale: +12, bus_condition: +5, description: "Refreshing! Even the bus cools down. Everyone's spirits lift." }, fail_chance: 0 },
            { text: "No time — keep driving", success: { morale: -4, description: "Risto: 'You never let us do anything fun.'" }, fail_chance: 0 },
            { text: "Mikko goes alone (quick dip)", success: { cash: -20, morale: +5, description: "5 minutes. In and out. Mikko feels like a new man." }, fail: { cash: -20, morale: +3, description: "Mikko stays 45 minutes. The band waits impatiently." }, fail_chance: 0.3 }
        ]
    },
    // ── NEW: route-triggered encounters for new minigames ──
    {
        id: "poster_wall", name: "Ruisrock Poster Wall",
        description: "A wall of festival posters: 'RUISROCK 91 — QUEEN / Brian Jonestown Massacre / Burial / Aldous Harding / Islaja'. Your name is nowhere.",
        sprite: "assets/sprites/enc_festival_rumour.png",
        choices: [
            { text: "Write your band name on the poster", success: { hype: +8, morale: +6, description: "Mikko grabs a marker and adds the band. Guerrilla marketing!" }, fail: { hype: -2, morale: -4, description: "A local catches you vandalizing. Awkward." }, fail_chance: 0.3 },
            { text: "Just stare at it and dream", success: { morale: +3, hype: +2, description: "'One day our name will be up there.' Hannele: 'It IS this year, idiot.'" }, fail_chance: 0 }
        ]
    },
    {
        id: "football_challenge", name: "Football Challenge",
        description: "Local youth at a rest stop challenge the band. 'Five penalties each — winner takes the kitty!'",
        sprite: "assets/sprites/enc_moose_road.png",
        choices: [
            { text: "Accept the football challenge!", success: { description: "The band stretches and takes the field." }, fail_chance: 0, trigger: "kickoff" },
            { text: "Decline — no time for games", success: { morale: -3, description: "Risto sighs. 'We never have fun.'" }, fail_chance: 0 }
        ]
    },
    {
        id: "forest_shortcut", name: "Forest Shortcut",
        description: "A logging road offers a shortcut through the wilderness. It looks... ambitious.",
        sprite: "assets/sprites/enc_wrong_turn.png",
        choices: [
            { text: "Take the forest shortcut!", success: { description: "Into the woods! Hope you brought snacks..." }, fail_chance: 0, trigger: "trail" },
            { text: "Stay on the highway", success: { description: "Safe choice. Boring but safe." }, fail_chance: 0 }
        ]
    },
    // ── travel-adventure + tycoon encounters ──
    {
        id: "reindeer_herd", name: "Reindeer Herd",
        description: "Two hundred reindeer flow across the road like a slow brown river. A herder on a snowmobile-in-summer (a quad bike) shrugs at you.",
        sprite: "assets/sprites/enc_moose_road.png",
        choices: [
            { text: "Wait for the herd to pass", success: { morale: +4, description: "Mikko films it on a borrowed camcorder. Beautiful, if slow." }, fail_chance: 0 },
            { text: "Ask the herder for a tourist photo deal", success: { cash: +80, hype: +2, description: "The herder sells you a reindeer-leather patch and you sell him a T-shirt." }, fail: { description: "He just stares. Awkward silence." }, fail_chance: 0.4 }
        ]
    },
    {
        id: "northern_lights", name: "Midnight Sun Glow",
        description: "The sun never fully sets. The whole sky turns peach and violet over a still lake. Even Hannele puts her phone down. (It is 1991. She has no phone.)",
        sprite: "assets/sprites/enc_midsummer.png",
        choices: [
            { text: "Stop the bus and watch", success: { morale: +14, band_mood: +4, description: "Nobody speaks for ten minutes. Best part of the tour so far." }, fail_chance: 0 },
            { text: "Keep driving — we are late", success: { morale: -2, description: "Pekka looks back over his shoulder the whole way." }, fail_chance: 0 }
        ]
    },
    {
        id: "radio_interview", name: "Local Radio Call-in",
        description: "The bus radio crackles: a local station is on air and the DJ spotted your bus outside. 'Is that the Midnight Sun Tour? Come on the show!'",
        sprite: "assets/sprites/enc_festival_rumour.png",
        choices: [
            { text: "Go on air and play live", success: { hype: +10, fame: +3, morale: +4, description: "Hannele's drum fill goes out to six municipalities." }, fail: { hype: -2, fame: -1, morale: -3, description: "Mikko forgets the second verse on live radio." }, fail_chance: 0.3 },
            { text: "Send Risto to say hello", success: { hype: +3, fame: +1, description: "Risto mostly talks about makkara. People like it." }, fail_chance: 0 }
        ]
    },
    {
        id: "flea_market", name: "Village Flea Market",
        description: "A kirpputori in a school gym. A crate of blank T-shirts and cassettes goes for almost nothing. The seller is retiring.",
        sprite: "assets/sprites/enc_roadwork.png",
        choices: [
            { text: "Buy the whole crate (60 FIM)", success: { cash: -60, stock: 12, description: "You print the band logo with a potato stamp. Merch tycoon energy." }, fail: { cash: -60, stock: 4, description: "Half the shirts are children's size. Still, merch." }, fail_chance: 0.3 },
            { text: "Sell some of your own stock to the crowd", success: { sell: 6, description: "The gym empties of tourists and fills with your T-shirts." }, fail_chance: 0 },
            { text: "Browse and leave", success: { description: "Risto buys a very large hat. Nothing else changes." }, fail_chance: 0 }
        ]
    },
    {
        id: "sponsor_offer", name: "Sauna Sausage Sponsor",
        description: "A regional meat company offers a sponsorship: their logo on the bus, 'MAKKARA POWER' on the amp.",
        sprite: "assets/sprites/enc_speed_camera.png",
        choices: [
            { text: "Take the money", success: { cash: +250, morale: -4, hype: -2, description: "250 FIM now. Hannele refuses to be photographed with the bus." }, fail_chance: 0 },
            { text: "Negotiate for a better deal", success: { cash: +400, morale: -2, fame: +1, description: "Pekka turns out to be a shrewd negotiator. 400 FIM and free sausages." }, fail: { description: "The sponsor walks away. No deal." }, fail_chance: 0.5 },
            { text: "Stay independent", success: { morale: +6, fame: +1, description: "Punk spirit intact. Wallet unchanged." }, fail_chance: 0 }
        ]
    },
    {
        id: "mosquito_swarm", name: "Mosquito Cloud",
        description: "You stop for a pee. A cloud of mosquitoes the size of a small cumulonimbus descends on the bus.",
        sprite: "assets/sprites/enc_rainstorm.png",
        choices: [
            { text: "Roll up the windows and sweat it out", success: { morale: -6, description: "Forty degrees inside. Risto sleeps through it." }, fail_chance: 0 },
            { text: "Burn the emergency tar candle", success: { morale: +3, food: -1, description: "Smells like a shipyard but the bugs are gone." }, fail: { bus_condition: -6, morale: -4, description: "The candle singes the seat. Mosquitoes win anyway." }, fail_chance: 0.35 }
        ]
    },
    {
        id: "police_stop", name: "Police Checkpoint",
        description: "A police car waves you over. The officer circles the converted sauna-bus slowly. 'Is the stove inside street legal?'",
        sprite: "assets/sprites/enc_speed_camera.png",
        choices: [
            { text: "Hand over the papers politely", success: { cash: -40, description: "A small fee for 'unusual modifications'. Fair enough." }, fail_chance: 0 },
            { text: "Offer a free gig ticket", success: { hype: +5, fame: +2, description: "The officer is a Karhumauri fan. Warning only." }, fail: { cash: -150, description: "That counts as bribery. Fine: 150 FIM." }, fail_chance: 0.45 }
        ]
    },
    {
        id: "fish_barter", name: "Lakeside Fisherman",
        description: "A fisherman gutting perch on a jetty waves a bucket. 'Trade you fish for a song.'",
        sprite: "assets/sprites/enc_sauna.png",
        choices: [
            { text: "Play one song on the jetty", success: { food: +3, morale: +6, fame: +1, description: "Fried perch, birch smoke and an audience of two. Perfect." }, fail: { food: +1, morale: +1, description: "The fisherman prefers accordion." }, fail_chance: 0.2 },
            { text: "Pay 30 FIM for the fish", success: { cash: -30, food: +3, description: "Fair trade. The bus smells like a harbour." }, fail_chance: 0 }
        ]
    },
    {
        id: "lada_challenge", name: "Lada Challenge",
        description: "A rusty Lada pulls alongside the bus. The driver revs the engine and grins. 'Race you to the next town!'",
        sprite: "assets/sprites/enc_speed_camera.png",
        choices: [
            { text: "Floor it! Race the Lada!", success: { description: "Mikko grips the wheel. Let's go!" }, fail_chance: 0, trigger: "race" },
            { text: "Ignore the challenge", success: { morale: -2, description: "The Lada speeds off. Hannele: 'Wise choice.'" }, fail_chance: 0 }
        ]
    }
];

// ============================================================================
// §3 — PALETTE + COPPER (from shared constants)
// ============================================================================
// (PALETTE and COPPER presets are imported from game_constants.js above)

// ============================================================================
// §5 — GAME STATE
// ============================================================================

var gGameState = null;

function createNewGameState() {
    var gs = {
        bus: {
            condition: 100,
            gas: 80,
            max_gas: 80,
            speed_mode: "normal"
        },
        resources: {
            cash: 1200,
            food: 5,
            morale: 75,
            hype: 10
        },
        band: JSON.parse(JSON.stringify(BAND_DATA)),
        inventory: JSON.parse(JSON.stringify(GEAR_DATA)),
        journey: {
            current_city: "kuusamo",
            day: 1,
            time_of_day: "morning",
            km_traveled: 0,
            encounters_survived: 0,
            gigs_played: 0,
            days_until_festival: 7
        },
        visited_cities: ["kuusamo"],
        city_flags: {}
    };
    Tycoon.ensure(gs);
    return gs;
}

// Encounter tracking state
var gUsedEncounterIds = [];
var gDryRouteCount = 0;

function resetEncounterTracking() {
    gUsedEncounterIds = [];
    gDryRouteCount = 0;
    gFestivalStarted = false;
    BandMood.reset();
}

// ============================================================================
// §6 — EVENT SYSTEM
// ============================================================================

var gEventListeners = {};

var EventSystem = class {
    static on(event, fn) {
        if (!gEventListeners[event]) gEventListeners[event] = [];
        gEventListeners[event].push(fn);
    }
    static emit(event, data) {
        var listeners = gEventListeners[event];
        if (!listeners) return;
        for (var i = 0; i < listeners.length; i++) listeners[i](data);
    }
    static off(event, fn) {
        var listeners = gEventListeners[event];
        if (!listeners) return;
        gEventListeners[event] = listeners.filter(function(l) { return l !== fn; });
    }
    static clear() { gEventListeners = {}; }
};

// ============================================================================
// §7 — SAVE MANAGER
// ============================================================================

var SaveManager = class {
    static save() {
        if (!gGameState) return false;
        SaveLoad.save("midnight_sun", gGameState);
        console.log("[SaveManager] Game saved.");
        return true;
    }
    static load() {
        var data = SaveLoad.load("midnight_sun");
        if (!data) { console.log("[SaveManager] No save found."); return false; }
        gGameState = data;
        Tycoon.ensure(gGameState);
        Tycoon.applyTank(gGameState);
        console.log("[SaveManager] Game loaded. Day " + gGameState.journey.day +
                     " at " + gGameState.journey.current_city);
        return true;
    }
    static hasSave() { return SaveLoad.exists("midnight_sun"); }
    static deleteSave() { SaveLoad.delete("midnight_sun"); console.log("[SaveManager] Save deleted."); }
};

// ============================================================================
// §8 — COPPER EFFECT RENDERER
// ============================================================================

var CopperRenderer = class {
    static draw(copperConfig, screenW, screenH) {
        if (!copperConfig || copperConfig.length < 2) return;
        var rectH = screenH / 256;
        for (var y = 0; y < 256; y++) {
            var lower = copperConfig[0];
            var upper = copperConfig[copperConfig.length - 1];
            for (var i = 0; i < copperConfig.length - 1; i++) {
                if (y >= copperConfig[i].scanline && y < copperConfig[i + 1].scanline) {
                    lower = copperConfig[i];
                    upper = copperConfig[i + 1];
                    break;
                }
            }
            var range = upper.scanline - lower.scanline;
            var t = range > 0 ? (y - lower.scanline) / range : 0;
            var r = lower.r + (upper.r - lower.r) * t;
            var g = lower.g + (upper.g - lower.g) * t;
            var b = lower.b + (upper.b - lower.b) * t;
            var drawY = y * rectH;
            Draw2D.fillRect(0, drawY, screenW, rectH + 1, r, g, b, 1, -10);
        }
    }
};

// ============================================================================
// §9 — HUD RENDERER
// ============================================================================

var HUD = class {
    static draw(screenW, screenH) {
        if (!gGameState) return;

        var barY = screenH - 45;
        var barH = 8;
        var barMaxW = 80;
        var labelX = 5;
        var barX = 75;
        var spacing = 14;

        Draw2D.fillRect(0, barY - 8, screenW, 55, 0.10, 0.10, 0.18, 1);
        Draw2D.fillRect(0, barY - 8, screenW, 1, 0.29, 0.29, 0.42, 1);

        // Gas
        var gasRatio = gGameState.bus.gas / gGameState.bus.max_gas;
        HUD.drawBar(labelX, barX, barY, barMaxW, barH, gasRatio, 0.91, 0.63, 0.13, "GAS");

        // Food
        var foodRatio = Math.min(gGameState.resources.food / 10, 1);
        HUD.drawBar(labelX, barX, barY + spacing, barMaxW, barH, foodRatio, 0.25, 0.63, 0.25, "FOOD");

        // Morale
        var moraleRatio = gGameState.resources.morale / 100;
        var mr = moraleRatio > 0.5 ? 0.25 : (moraleRatio > 0.25 ? 0.88 : 0.88);
        var mg = moraleRatio > 0.5 ? 0.63 : (moraleRatio > 0.25 ? 0.63 : 0.25);
        var mb = moraleRatio > 0.5 ? 0.88 : (moraleRatio > 0.25 ? 0.13 : 0.25);
        HUD.drawBar(labelX, barX, barY + spacing * 2, barMaxW, barH, moraleRatio, mr, mg, mb, "MORALE");

        // Right side
        var rightX = screenW / 2 + 10;
        Draw2D.drawText(rightX, barY + 2, "CASH: " + gGameState.resources.cash + " FIM", 0.91, 0.91, 0.91, 1, F.UI);
        Draw2D.drawText(rightX, barY + spacing + 2, "HYPE: " + gGameState.resources.hype + "/100", 0.94, 0.75, 0.25, 1, F.UI);
        var busOk = gGameState.bus.condition > 50;
        Draw2D.drawText(rightX, barY + spacing * 2 + 2, "BUS: " + gGameState.bus.condition + "%",
            busOk ? 0.50 : 0.88, busOk ? 0.88 : 0.25, busOk ? 0.50 : 0.25, 1, 0.6);

        // Far right
        var farRight = screenW - 160;
        Draw2D.drawText(farRight, barY + 2, "DAY " + gGameState.journey.day + "/7", 1, 1, 1, 1, F.UI);
        Draw2D.drawText(farRight, barY + spacing + 2, gGameState.journey.time_of_day.toUpperCase(), 0.69, 0.69, 0.75, 1, F.UI);
        Draw2D.drawText(farRight, barY + spacing * 2 + 2, gGameState.journey.km_traveled + " km  FAME " + Tycoon.fame(gGameState), 0.63, 0.63, 0.63, 1, F.UI);
    }

    static drawBar(labelX, barX, y, maxW, h, ratio, fillR, fillG, fillB, label) {
        Draw2D.drawText(labelX, y, label, 0.75, 0.75, 0.82, 1, F.UI);
        Draw2D.fillRect(barX, y, maxW, h, 0.16, 0.16, 0.16, 1);
        var fillW = Math.max(0, Math.min(maxW, maxW * ratio));
        if (fillW > 0) Draw2D.fillRect(barX, y, fillW, h, fillR, fillG, fillB, 1);
        Draw2D.drawRect(barX, y, maxW, h, 0.35, 0.35, 0.48, 1, 1);
    }
};

// ============================================================================
// §10 — OVERWORLD MAP
// ============================================================================

var gSelectedCityIdx = 0;
var gBusAnimating = false;
var gBusAnimT = 0;
var gBusAnimFrom = null;
var gBusAnimTo = null;
var gBusAnimRoute = null;

var OverworldMap = class {
    static getCurrentCityIdx() {
        for (var i = 0; i < CITIES.length; i++) {
            if (CITIES[i].id === gGameState.journey.current_city) return i;
        }
        return 0;
    }

    static getAdjacentCities() {
        var current = gGameState.journey.current_city;
        var result = [];
        for (var i = 0; i < ROUTES.length; i++) {
            if (ROUTES[i].from === current) result.push({ cityId: ROUTES[i].to, route: ROUTES[i], direction: "forward" });
            if (ROUTES[i].to === current) result.push({ cityId: ROUTES[i].from, route: ROUTES[i], direction: "backward" });
        }
        return result;
    }

    static getCityById(id) {
        for (var i = 0; i < CITIES.length; i++) {
            if (CITIES[i].id === id) return CITIES[i];
        }
        return null;
    }

    static getCityIdxById(id) {
        for (var i = 0; i < CITIES.length; i++) {
            if (CITIES[i].id === id) return i;
        }
        return -1;
    }

    static canTravel(route) {
        var gasCost = OverworldMap.getGasCost(route);
        return gGameState.bus.gas >= gasCost && gGameState.bus.condition > 0;
    }

    static getGasCost(route) {
        var base = route.distance_km * 0.15;
        if (route.road_type === "dirt") base *= 2;
        if (gGameState.bus.speed_mode === "fast") base *= 1.3;
        if (gGameState.bus.speed_mode === "careful") base *= 0.8;
        return Math.ceil(base * Tycoon.gasMul(gGameState));
    }

    static getConditionCost(route) {
        var base = route.distance_km * 0.05;
        if (route.road_type === "dirt") base = route.distance_km * 0.15;
        if (gGameState.bus.speed_mode === "fast") base *= 1.5;
        return Math.ceil(base * Tycoon.wearMul(gGameState));
    }

    static applyTravelCosts(route) {
        var gasCost = OverworldMap.getGasCost(route);
        var condCost = OverworldMap.getConditionCost(route);
        gGameState.bus.gas = Math.max(0, gGameState.bus.gas - gasCost);
        gGameState.bus.condition = Math.max(0, gGameState.bus.condition - condCost);
        gGameState.resources.food = Math.max(0, gGameState.resources.food - 1);
        gGameState.resources.morale = Math.max(0, gGameState.resources.morale - 3);
        gGameState.journey.km_traveled += route.distance_km;
        Tycoon.onLeg(gGameState);

        var times = ["morning", "afternoon", "evening", "night"];
        var idx = times.indexOf(gGameState.journey.time_of_day);
        idx = (idx + 1) % 4;
        gGameState.journey.time_of_day = times[idx];
        if (idx === 0) {
            gGameState.journey.day++;
            gGameState.journey.days_until_festival = Math.max(0, 7 - gGameState.journey.day + 1);
        }
    }

    static startTravel(targetCityId) {
        var current = OverworldMap.getCityById(gGameState.journey.current_city);
        var target = OverworldMap.getCityById(targetCityId);
        if (!current || !target) return;

        var route = null;
        for (var i = 0; i < ROUTES.length; i++) {
            if ((ROUTES[i].from === current.id && ROUTES[i].to === target.id) ||
                (ROUTES[i].to === current.id && ROUTES[i].from === target.id)) {
                route = ROUTES[i];
                break;
            }
        }
        if (!route) return;
        if (!OverworldMap.canTravel(route)) {
            console.log("[Map] Cannot travel — not enough gas or bus broken.");
            return;
        }

        gBusAnimating = true;
        gBusAnimT = 0;
        gBusAnimFrom = { x: current.x, y: current.y };
        gBusAnimTo = { x: target.x, y: target.y };
        gBusAnimRoute = route;
        OverworldMap.applyTravelCosts(route);
    }

    static updateAnimation(dt) {
        if (!gBusAnimating) return false;
        gBusAnimT += dt * 0.8;
        if (gBusAnimT >= 1.0) {
            gBusAnimT = 1.0;
            gBusAnimating = false;
            var targetId = null;
            for (var i = 0; i < CITIES.length; i++) {
                if (Math.abs(CITIES[i].x - gBusAnimTo.x) < 1 &&
                    Math.abs(CITIES[i].y - gBusAnimTo.y) < 1) {
                    targetId = CITIES[i].id;
                    break;
                }
            }
            if (targetId) {
                gGameState.journey.current_city = targetId;
                if (gGameState.visited_cities.indexOf(targetId) === -1) {
                    gGameState.visited_cities.push(targetId);
                }
                EventSystem.emit("arrived_at_city", { cityId: targetId });
            }
            return true;
        }
        return false;
    }

    static getBusPosition() {
        if (gBusAnimating && gBusAnimFrom && gBusAnimTo) {
            var t = gBusAnimT * gBusAnimT * (3 - 2 * gBusAnimT);
            return {
                x: gBusAnimFrom.x + (gBusAnimTo.x - gBusAnimFrom.x) * t,
                y: gBusAnimFrom.y + (gBusAnimTo.y - gBusAnimFrom.y) * t
            };
        }
        var city = OverworldMap.getCityById(gGameState.journey.current_city);
        return city ? { x: city.x, y: city.y } : { x: 160, y: 128 };
    }

    static draw(screenW, screenH, hideInfo) {
        var scaleX = screenW / 320;
        var scaleY = screenH / 256;

        // Painted map of Finland (320x200 art stretched onto the 320x256 map space)
        Draw2D.drawImage(0, 0, screenW, screenH, SPRITES.MAP_FINLAND, 1, 1, 1, 1);

        // Roads
        for (var i = 0; i < ROUTES.length; i++) {
            var fromCity = OverworldMap.getCityById(ROUTES[i].from);
            var toCity = OverworldMap.getCityById(ROUTES[i].to);
            if (!fromCity || !toCity) continue;
            var isDirt = ROUTES[i].road_type === "dirt";
            var rr = isDirt ? 0.35 : 0.53;
            var rg = isDirt ? 0.29 : 0.53;
            var rb = isDirt ? 0.23 : 0.53;
            var thickness = ROUTES[i].road_type === "highway" ? 2 : 1;
            Draw2D.drawLine(
                fromCity.x * scaleX, (256 - fromCity.y) * scaleY,
                toCity.x * scaleX, (256 - toCity.y) * scaleY,
                rr, rg, rb, 1, thickness
            );
        }

        // Cities
        var currentCityId = gGameState.journey.current_city;
        var adjacent = OverworldMap.getAdjacentCities();
        var adjacentIds = adjacent.map(function(a) { return a.cityId; });

        for (var i = 0; i < CITIES.length; i++) {
            var city = CITIES[i];
            var cx = city.x * scaleX;
            var cy = (256 - city.y) * scaleY;
            var visited = gGameState.visited_cities.indexOf(city.id) !== -1;
            var dotR = 5;

            if (city.id === currentCityId) {
                var pulse = Math.sin(Time.getTime() * 4) * 0.3 + 0.7;
                Draw2D.drawCircle(cx, cy, dotR + 2, 0.2 * pulse + 0.8, 0.8 * pulse, 0.2, 1);
                Draw2D.drawCircle(cx, cy, dotR + 3, 1, 1, 1, 1, 32, 1);
            } else if (adjacentIds.indexOf(city.id) !== -1) {
                var isSelected = (gSelectedCityIdx === i);
                if (isSelected) {
                    Draw2D.drawCircle(cx, cy, dotR, 1, 1, 0.25, 1);
                    Draw2D.drawCircle(cx, cy, dotR + 3, 1, 1, 0.25, 1, 32, 1);
                } else if (visited) {
                    Draw2D.drawCircle(cx, cy, dotR, 0.38, 0.63, 0.38, 1);
                } else {
                    Draw2D.drawCircle(cx, cy, dotR, 0.50, 0.50, 0.50, 1);
                }
            } else if (visited) {
                Draw2D.drawCircle(cx, cy, dotR - 1, 0.25, 0.50, 0.25, 1);
            } else {
                Draw2D.drawCircle(cx, cy, 3, 0.25, 0.25, 0.25, 1);
            }

            if (visited || city.id === currentCityId) {
                Draw2D.drawText(cx - 19, cy - 15, city.name, 0, 0, 0, 0.8, F.BODY);
                Draw2D.drawText(cx - 20, cy - 16, city.name, 0.92, 0.92, 0.82, 1, F.BODY);
            }
        }

        // Bus
        var busPos = OverworldMap.getBusPosition();
        var bx = busPos.x * scaleX;
        var by = (256 - busPos.y) * scaleY;
        Draw2D.fillRect(bx - 10, by + 5, 20, 3, 0, 0, 0, 0.35);
        Draw2D.drawImage(bx - 14, by - 12, 28, 21, SPRITES.BUS_PLAYER, 1, 1, 1, 1);

        // Selection info
        if (!gBusAnimating && !hideInfo) {
            var adjList = OverworldMap.getAdjacentCities();

            // Check if player can travel anywhere
            var canTravelAny = false;
            for (var ai = 0; ai < adjList.length; ai++) {
                if (OverworldMap.canTravel(adjList[ai].route)) {
                    canTravelAny = true;
                    break;
                }
            }

            if (!canTravelAny) {
                // Stuck — show "enter city" fallback
                Draw2D.fillRect(0, 0, screenW, 30, 0.20, 0.08, 0.08, 1);
                Draw2D.fillRect(0, 30, screenW, 1, 0.50, 0.20, 0.20, 1);
                var curCity = OverworldMap.getCityById(gGameState.journey.current_city);
                var cityName = curCity ? curCity.name : "city";
                Draw2D.drawText(10, 5, "Not enough fuel to travel!", 1, 0.35, 0.25, 1, F.UI);
                var blink = Math.sin(Time.getTime() * 3) > 0;
                if (blink) {
                    Draw2D.drawText(10, 18, "[ENTER] Return to " + cityName,
                        1, 0.9, 0.3, 1, F.LABEL);
                }
            } else if (adjList.length > 0) {
                Draw2D.fillRect(0, 0, screenW, 30, 0.10, 0.10, 0.18, 1);
                Draw2D.fillRect(0, 30, screenW, 1, 0.29, 0.29, 0.42, 1);

                var selIdx = -1;
                for (var i = 0; i < adjList.length; i++) {
                    if (OverworldMap.getCityIdxById(adjList[i].cityId) === gSelectedCityIdx) {
                        selIdx = i;
                        break;
                    }
                }

                if (selIdx >= 0) {
                    var dest = OverworldMap.getCityById(adjList[selIdx].cityId);
                    var route = adjList[selIdx].route;
                    var gasCost = OverworldMap.getGasCost(route);
                    var canGo = OverworldMap.canTravel(route);
                    Draw2D.drawText(10, 5, "NEXT: " + dest.name + " (" + route.distance_km + "km, "
                        + route.road_type + ")", 1, 1, 1, 1, 0.6);
                    Draw2D.drawText(10, 18, "Cost: " + gasCost + "L gas | 1 food | "
                        + OverworldMap.getConditionCost(route) + "% wear",
                        canGo ? 0.50 : 1, canGo ? 1 : 0.25, canGo ? 0.50 : 0.25, 1, 0.5);
                    Draw2D.drawTextAligned(screenW - 10, 5, "[UP/DOWN] Select  [ENTER] Go", "right",
                        0.63, 0.63, 0.75, 1, F.BODY);
                    Draw2D.drawTextAligned(screenW - 10, 18, dest.gig_available ? "Venue: " + dest.gig_fee_min + "-" + dest.gig_fee_max + " FIM" : (dest.type === "end" ? "RUISROCK!" : "No venue"), "right",
                        0.95, 0.80, 0.35, 1, F.BODY);
                } else {
                    Draw2D.drawText(10, 5, "[UP/DOWN] Select destination",
                        0.63, 0.63, 0.75, 1, F.UI);
                }
            }
        }
    }

    static handleInput() {
        if (gBusAnimating) return null;
        var adjacent = OverworldMap.getAdjacentCities();

        // Check if player can travel to ANY adjacent city
        var canTravelAnywhere = false;
        for (var i = 0; i < adjacent.length; i++) {
            if (OverworldMap.canTravel(adjacent[i].route)) {
                canTravelAnywhere = true;
                break;
            }
        }

        // Fallback: if stuck (no gas/no valid travel), allow re-entering current city
        if (!canTravelAnywhere) {
            if (Input.getKeyDown("Return") || Input.getKeyDown("Space") || Input.getKeyDown("e")) {
                return { enterCity: true };
            }
            return null;
        }

        if (adjacent.length === 0) return null;

        var adjIndices = adjacent.map(function(a) { return OverworldMap.getCityIdxById(a.cityId); });
        var curSelPos = adjIndices.indexOf(gSelectedCityIdx);

        if (Input.getKeyDown("Up") || Input.getKeyDown("w")) {
            curSelPos = (curSelPos - 1 + adjIndices.length) % adjIndices.length;
            gSelectedCityIdx = adjIndices[curSelPos];
        }
        if (Input.getKeyDown("Down") || Input.getKeyDown("s")) {
            curSelPos = (curSelPos + 1) % adjIndices.length;
            gSelectedCityIdx = adjIndices[curSelPos];
        }
        if (adjIndices.indexOf(gSelectedCityIdx) === -1 && adjIndices.length > 0) {
            gSelectedCityIdx = adjIndices[0];
        }
        if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
            for (var i = 0; i < adjacent.length; i++) {
                if (OverworldMap.getCityIdxById(adjacent[i].cityId) === gSelectedCityIdx) {
                    return adjacent[i];
                }
            }
        }
        return null;
    }
};

// ============================================================================
// §11 — CITY MENU
// ============================================================================

var gCityMenuOpen = false;
var gCityMenuSelection = 0;

var CityMenu = class {
    static open(cityId) {
        gCityMenuOpen = true;
        gCityMenuSelection = 0;
        console.log("[CityMenu] Opened for " + cityId);
    }

    static close() { gCityMenuOpen = false; }

    static draw(screenW, screenH) {
        if (!gCityMenuOpen) return;
        var city = OverworldMap.getCityById(gGameState.journey.current_city);
        if (!city) return;

        var panelX = screenW * 0.05;
        var panelY = screenH * 0.06;
        var panelW = screenW * 0.90;
        var panelH = screenH * 0.74;
        Draw2D.fillRect(panelX, panelY, panelW, panelH, 0.10, 0.10, 0.18, 1);
        Draw2D.drawRect(panelX, panelY, panelW, panelH, 0.42, 0.42, 0.60, 1, 1);

        Draw2D.drawText(panelX + 15, panelY + 10, city.name, 1, 1, 1, 1, F.HEADING);
        Draw2D.drawText(panelX + 15, panelY + 30, city.flavor, 0.63, 0.63, 0.75, 1, F.BODY);
        Draw2D.fillRect(panelX + 10, panelY + 45, panelW - 20, 1, 0.29, 0.29, 0.42, 1);

        var options = CityMenu.getOptions(city);
        var optY = panelY + 55;
        var firstOption=Math.max(0,Math.min(gCityMenuSelection-5,options.length-7));
        for (var i = firstOption; i < Math.min(options.length,firstOption+7); i++) {
            var isSelected = (gCityMenuSelection === i);
            var cr = isSelected ? 1 : (options[i].enabled ? 0.75 : 0.31);
            var cg = isSelected ? 1 : (options[i].enabled ? 0.75 : 0.31);
            var cb = isSelected ? 0.25 : (options[i].enabled ? 0.82 : 0.38);
            if(isSelected) Draw2D.fillRect(panelX+10,optY-2,panelW*0.56-12,19,0.30,0.12,0.28,1);
            var prefix = isSelected ? "> " : "  ";
            Draw2D.drawText(panelX + 16, optY, prefix + (i + 1) + ". " + options[i].label,
                cr, cg, cb, 1, 0.6);
            if (options[i].cost) {
                Draw2D.drawTextAligned(panelX + panelW * 0.56, optY + 1, options[i].cost, "right",
                    options[i].enabled ? 0.63 : 0.25, options[i].enabled ? 0.63 : 0.19, options[i].enabled ? 0.63 : 0.19, 1, 0.5);
            }
            optY += 20;
        }

        // Band mood bars
        var moodX = panelX + panelW * 0.60;
        var moodY = panelY + 55;
        var moodW = panelW * 0.35;
        var endY = BandMood.drawMoodBars(gGameState, moodX, moodY, moodW);
        BandMood.drawWarnings(moodX, endY + 4);

        Draw2D.drawText(panelX + 15, panelY + panelH - 20, "[UP/DOWN] Select  [ENTER] Confirm  [ESC] Leave",
            0.38, 0.38, 0.50, 1, F.BODY);
    }

    static getOptions(city) {
        var gs = gGameState;
        var options = [];
        // Rest → triggers tent minigame
        options.push({
            id: "rest", label: "Rest (set up tent)",
            cost: "50 FIM", enabled: gs.resources.cash >= 50
        });
        // Refuel → triggers fuel gauge minigame
        options.push({
            id: "refuel", label: "Refuel",
            cost: "100 FIM", enabled: gs.resources.cash >= 100 && city.services.indexOf("gas") !== -1 && gs.bus.gas < gs.bus.max_gas
        });
        options.push({
            id: "food", label: "Buy Food",
            cost: "30 FIM", enabled: gs.resources.cash >= 30 && city.services.indexOf("food") !== -1
        });
        if (city.services.indexOf("mechanic") !== -1) {
            options.push({
                id: "mechanic", label: "Mechanic (repair bus)",
                cost: "200 FIM", enabled: gs.resources.cash >= 200
            });
        }
        if (city.gig_available) {
            options.push({
                id: "gig", label: "Book Micro-Gig",
                cost: "Earn " + city.gig_fee_min + "-" + city.gig_fee_max + " FIM",
                enabled: true
            });
        }
        // Arcade (Amp Invaders) — only in cities with arcade service
        if (city.services.indexOf("arcade") !== -1) {
            options.push({
                id: "arcade", label: "Visit Arcade",
                cost: "10 FIM", enabled: gs.resources.cash >= 10
            });
        }
        options.push({id: "jobs", label: "Tour jobs (delivery / rescue)", cost: "Earn up to 180 FIM", enabled: true});
        options.push({
            id: "office", label: "Tour Office (garage, merch, promo)",
            cost: "Fame " + Tycoon.fame(gs), enabled: true
        });
        options.push({
            id: "leave", label: "Leave " + city.name,
            cost: "", enabled: true
        });
        return options;
    }

    static handleInput() {
        if (!gCityMenuOpen) return null;
        var city = OverworldMap.getCityById(gGameState.journey.current_city);
        var options = CityMenu.getOptions(city);

        if (Input.getKeyDown("Up") || Input.getKeyDown("w")) {
            gCityMenuSelection = (gCityMenuSelection - 1 + options.length) % options.length;
        }
        if (Input.getKeyDown("Down") || Input.getKeyDown("s")) {
            gCityMenuSelection = (gCityMenuSelection + 1) % options.length;
        }
        if (Input.getKeyDown("Escape")) return { id: "leave" };
        if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
            var selected = options[gCityMenuSelection];
            if (selected.enabled) return selected;
        }
        for (var i = 0; i < Math.min(options.length, 9); i++) {
            if (Input.getKeyDown("" + (i + 1))) {
                if (options[i].enabled) return options[i];
            }
        }
        return null;
    }

    static applyAction(action) {
        var gs = gGameState;
        var city = OverworldMap.getCityById(gs.journey.current_city);

        switch (action.id) {
            case "rest":
                gs.resources.cash -= 50;
                // Trigger tent minigame instead of instant rest
                CityMenu.close();
                return "tent";

            case "refuel":
                gs.resources.cash -= 100;
                // Trigger fuel gauge minigame instead of instant refuel
                CityMenu.close();
                return "fuel";

            case "food":
                gs.resources.cash -= 30;
                gs.resources.food = Math.min(10, gs.resources.food + 3);
                console.log("[City] Bought food. Now " + gs.resources.food + " days");
                break;

            case "mechanic":
                gs.resources.cash -= 200;
                gs.bus.condition = Math.min(100, gs.bus.condition + 40);
                console.log("[City] Bus repaired to " + gs.bus.condition + "%");
                break;

            case "gig":
                CityMenu.close();
                return "soundcheck";

            case "arcade":
                gs.resources.cash -= 10;
                CityMenu.close();
                return Math.random() < 0.5 ? "space" : "starfox";

            case "jobs":
                CityMenu.close();
                return "jobs";

            case "office":
                CityMenu.close();
                return "office";

            case "leave":
                CityMenu.close();
                return "leave";
        }
        return "stay";
    }
};

// ============================================================================
// §12 — GAME MANAGER — main state machine
// Scenes: title, gearpack, overworld, city, encounter, soundcheck, gig,
//         moosedodge, kickoff, space, trail, race, tent, fuel, runner, night,
//         festival
// ============================================================================

var gInitialized = false;
var gCameraId = -1;
var gScene = "title";
var gTitleBlinkTimer = 0;
var gTitleShowText = true;
var gFirstOverworldFrame = false;

// Cross-module state
var gSCBonus = 1.0;              // sound check bonus for gig payout
var gSCCity = null;              // city where soundcheck/gig happens
var gPendingMinigameTrigger = null; // encounter choice trigger → minigame
var gFestivalStarted = false;    // Phase 17: festival module initialized
var gGameOverReason = "";        // "bus" or "days" — set when game over triggered
var gGameOverMusicPlayed = false;// prevent re-triggering music each frame

// Cheat menu state
var gCheatMenuIdx = 0;
var gCheatPrevScene = "";        // scene to return to when closing cheat menu
var gCheatJustOpened = false;    // guard: skip close check on same frame as open
var CHEAT_MINIGAMES = [
    {label:"Backstage Express", scene:"jobs", starter:function(gs){Jobs.start(gs,0);}},
    {label:"Harbor Rescue", scene:"jobs", starter:function(gs){Jobs.start(gs,1);}},
    { label: "Moose Dodge",      scene: "moosedodge", starter: function(gs) { MooseDodgeSystem.start(gs, { road_type: "highway", distance_km: 120, hazard_rate: 0.3 }); } },
    { label: "Kickoff (Football)", scene: "kickoff",  starter: function(gs) { KickoffSystem.start(gs); } },
    { label: "Amp Invaders",   scene: "space",      starter: function(gs) { SpaceSystem.start(gs); } },
    { label: "Woodland Shortcut",   scene: "trail",      starter: function(gs) { TrailSystem.start(gs); } },
    { label: "Race (Bus vs Lada)", scene: "race",     starter: function(gs) { RaceSystem.start(gs); } },
    { label: "Four Stakes", scene: "tent",      starter: function(gs) { TentSystem.start(gs); } },
    { label: "Petrol Stop",       scene: "fuel",       starter: function(gs) { FuelSystem.start(gs); } },
    { label: "Runner (Auto-run)", scene: "runner",    starter: function(gs) { RunnerSystem.start(gs); } },
    { label: "Night Driving",    scene: "night",      starter: function(gs) { NightSystem.start(gs); } },
    { label: "Sound Check",      scene: "soundcheck", starter: function(gs) { var city = OverworldMap.getCityById(gs.journey.current_city); SoundCheckSystem.start(gs, city); } },
    { label: "Gig",              scene: "gig",        starter: function(gs) { var city = OverworldMap.getCityById(gs.journey.current_city); GigSystem.start(gs, city, 1.0, 1.0); } },
    { label: "Gear Pack",        scene: "gearpack",   starter: function(gs) { GearPackSystem.start(gs, GEAR_DATA); } },
    { label: "Tahtialus / Night Flight", scene: "starfox",  starter: function(gs) { StarfoxSystem.start(gs); } },
    { label: "Festival (Ruisrock)", scene: "festival", starter: function(gs) { gFestivalStarted = false; } }
];

class MidnightSunTour {
    constructor() {
        this.screenW = 0;
        this.screenH = 0;
    }

    onStart() {
        gInitialized = true;
        console.log("=== MIKKO LEVON'S: MIDNIGHT SUN TOUR ===");
        console.log("v2 Orchestrator — modular minigames");

        gCameraId = GameObject.findByTag("MainCamera");
        this.screenW = Screen.getWidth();
        this.screenH = Screen.getHeight();

        var sceneName = Scene.getSceneName();
        if (sceneName === "Overworld Map") {
            gScene = "overworld";
            gFirstOverworldFrame = true;
            if (!gGameState) {
                gGameState = createNewGameState();
                resetEncounterTracking();
            }
            var adj = OverworldMap.getAdjacentCities();
            if (adj.length > 0) {
                gSelectedCityIdx = OverworldMap.getCityIdxById(adj[0].cityId);
            }
        } else {
            gScene = "title";
        }

        Style.addEffect("filmgrain");
        Style.addEffect("vignette");
        Style.configure({
            filmGrainAmount: 0.04,
            vignetteRadius: 0.75,
            vignetteSoftness: 0.35
        });

        if (gScene === "title") {
            Audio.playMusic(MUSIC.TITLE, true);
        } else {
            this.playOverworldMusic();
        }

        console.log("[GameManager] Scene: " + gScene);
    }

    command(text) {
        var parts=String(text).trim().toLowerCase().split(/\s+/),cmd=parts.shift(),arg=parts[0];
        var self=this;
        var number=function(v,min,max){var n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid value.');return n;};
        var toggle=function(v,old){if(v==null)return !old;if(v==='on')return true;if(v==='off')return false;throw Error('Invalid value.');};
        var ensure=function(){if(!gGameState){gGameState=createNewGameState();resetEncounterTracking();}return gGameState;};
        var leave=function(){if(StarfoxSystem.allEntities&&StarfoxSystem.allEntities.length)StarfoxSystem.cleanup();gBusAnimating=false;gPendingMinigameTrigger=null;gCityMenuOpen=false;self.paused=false;};
        if(cmd==='state')return JSON.stringify({scene:gScene,city:gGameState&&gGameState.journey.current_city,god:!!this.god,freeze:!!this.freeze,resources:gGameState&&gGameState.resources,bus:gGameState&&gGameState.bus,journey:gGameState&&gGameState.journey});
        if(cmd==='god'){this.god=toggle(arg,this.god);RunnerSystem.invuln=0;SpaceSystem.invuln=0;Jobs.flash=0;ensure();this.protect();return 'God mode '+(this.god?'on.':'off.');}
        if(cmd==='freeze'){this.freeze=toggle(arg,this.freeze);this.fixedDays=ensure().journey.days_until_festival;return 'Clock lock '+(this.freeze?'on.':'off.');}
        if(cmd==='refill'||cmd==='rich'){
            var gs=ensure();gs.bus.condition=100;gs.bus.gas=gs.bus.max_gas;gs.resources.food=10;gs.resources.morale=100;
            gs.band.forEach(function(b){b.present=true;b.mood=100;});
            if(cmd==='rich'){gs.resources.cash=1000000;gs.resources.hype=100;Tycoon.ensure(gs).fame=100;if(gScene==='festival'&&FestivalSystem.state)FestivalSystem.state.budget=1000000;}
            return 'Resources updated.';
        }
        if(cmd==='set'){
            var gs=ensure(),key=arg,value=parts[1];
            if(['cash','food','morale','hype'].indexOf(key)>=0)gs.resources[key]=number(value,0,key==='cash'?10000000:key==='food'?10:100);
            else if(key==='gas')gs.bus.gas=number(value,0,gs.bus.max_gas);
            else if(key==='condition')gs.bus.condition=number(value,0,100);
            else if(key==='days'){gs.journey.days_until_festival=number(value,1,365);this.fixedDays=gs.journey.days_until_festival;}
            else if(key==='fame')Tycoon.ensure(gs).fame=number(value,0,100);
            else if(key==='budget'){if(!FestivalSystem.state)throw Error('Festival is not active.');FestivalSystem.state.budget=number(value,0,10000000);}
            else throw Error('Invalid field.');
            return 'Value updated.';
        }
        if(cmd==='gear'){ensure().inventory=JSON.parse(JSON.stringify(GEAR_DATA));return 'All gear packed.';}
        if(cmd==='save'){ensure();SaveManager.save();return 'Journey checkpoint saved.';}
        if(cmd==='load'){if(!SaveManager.load())throw Error('No valid checkpoint.');leave();gFestivalStarted=false;gScene='overworld';this.playOverworldMusic();return 'Journey checkpoint loaded.';}
        if(cmd==='new'){leave();gGameState=createNewGameState();resetEncounterTracking();GearPackSystem.start(gGameState,GEAR_DATA);gScene='gearpack';return 'New tour.';}
        if(cmd==='win'){
            ensure();
            if(gScene==='festival'){FestivalSystem.cheat('results',3,true);return 'Festival complete.';}
            if(gScene==='gig'){if(GigSystem.phase!=='results'){GigSystem.score=GigSystem.maxScore;GigSystem.perfects=24;GigSystem.calculateResults();}GigSystem.phase='results';}
            else if(gScene==='gearpack'){gGameState.inventory=JSON.parse(JSON.stringify(GEAR_DATA));leave();gScene='overworld';this.playOverworldMusic();}
            else if(gScene==='runner'){RunnerSystem.distance=500;RunnerSystem.dead=false;RunnerSystem.phase='results';}
            else if(gScene==='jobs'){Jobs.score=9;Jobs.phase='results';}
            else if(gScene==='kickoff'){KickoffSystem.scoreA=5;KickoffSystem.shots=5;KickoffSystem.phase='results';}
            else if(gScene==='space'){SpaceSystem.score=1000;SpaceSystem.lives=3;SpaceSystem.phase='results';}
            else if(gScene==='race'){RaceSystem.playerAhead=true;RaceSystem.phase='results';}
            else if(gScene==='tent'){TentSystem.tentProgress=1;TentSystem.phase='results';}
            else if(gScene==='fuel'){FuelSystem.totalFuel=75;FuelSystem.perfectCount=5;FuelSystem.marks=[true,true,true,true,true];FuelSystem.phase='results';}
            else if(gScene==='soundcheck'){SoundCheckSystem.sliders=SoundCheckSystem.targets.slice();SoundCheckSystem.calculateResults();SoundCheckSystem.phase='results';}
            else if(gScene==='starfox'){StarfoxSystem.score=1500;StarfoxSystem.bossHP=0;StarfoxSystem.shields=100;StarfoxSystem.timer=0;StarfoxSystem.phase='results';}
            else if(gScene==='moosedodge'){MooseDodgeSystem.phase='results';}
            else if(gScene==='night'){NightSystem.survived=true;NightSystem.phase='results';}
            else if(gScene==='trail'){TrailSystem.phase='results';}
            else {leave();gGameState.journey.current_city='turku';gScene='festival';gFestivalStarted=true;FestivalSystem.start(gGameState);FestivalSystem.cheat('results',3,true);}
            return 'Complete.';
        }
        if(cmd==='festival'){
            var phase=arg||'intro',day=parts[1]==null?1:number(parts[1],1,3);
            if(['intro','book','grounds','staff','simulate','report','results'].indexOf(phase)<0)throw Error('Invalid phase.');
            ensure();leave();gGameState.journey.current_city='turku';gScene='festival';
            if(!gFestivalStarted){FestivalSystem.start(gGameState);gFestivalStarted=true;}
            FestivalSystem.cheat(phase,day,false);return 'Festival state loaded.';
        }
        if(cmd==='goto'||cmd==='minigame'){cmd='jump';arg=parts.shift();}
        else if(['title','overworld','map','city','office','gameover','encounter'].indexOf(cmd)>=0){parts.unshift(arg);arg=cmd;cmd='jump';}
        if(cmd==='jump'){
            var aliases={packing:'gearpack',football:'kickoff',shootout:'kickoff',delivery:'jobs',harbor:'jobs',mixer:'soundcheck',driving:'moosedodge',nightdrive:'night',map:'overworld',ruisrock:'festival'};
            var target=aliases[arg]||arg;
            var mg=CHEAT_MINIGAMES.find(function(m){return m.scene===target;});
            if(!mg&&['title','overworld','city','office','gameover','encounter'].indexOf(target)<0)throw Error('Invalid destination.');
            var gs=ensure(),city=parts[0];
            if(target==='city'&&city&&!OverworldMap.getCityById(city))throw Error('Invalid city.');
            if(target==='encounter'&&!ENCOUNTERS.some(function(e){return e.id===city;}))throw Error('Invalid encounter.');
            leave();
            if(target==='title'){gScene='title';Audio.playMusic(MUSIC.TITLE,true);}
            else if(target==='overworld'){gScene='overworld';var adj=OverworldMap.getAdjacentCities();if(adj.length)gSelectedCityIdx=OverworldMap.getCityIdxById(adj[0].cityId);this.playOverworldMusic();}
            else if(target==='city'){
                if(city)gs.journey.current_city=city;
                if(gs.visited_cities.indexOf(gs.journey.current_city)<0)gs.visited_cities.push(gs.journey.current_city);
                CityMenu.open(gs.journey.current_city);gScene='city';Audio.playMusic(MUSIC.CITY,true);
            } else if(target==='office'){Tycoon.open(gs,OverworldMap.getCityById(gs.journey.current_city));gScene='office';}
            else if(target==='gameover'){gGameOverReason=city==='days'?'days':'bus';gGameOverMusicPlayed=false;gScene='gameover';}
            else if(target==='encounter'){EncounterSystem.start(ENCOUNTERS.find(function(e){return e.id===city;}),ROUTES[0],gs);gScene='encounter';}
            else {mg.starter(gs);gScene=target;if(arg==='harbor')Jobs.start(gs,1);}
            return 'State loaded.';
        }
        throw Error('Unknown command.');
    }

    protect() {
        if(!gGameState)return;
        if(this.freeze)gGameState.journey.days_until_festival=this.fixedDays;
        Jobs.god=!!this.god;
        if(!this.god)return;
        var gs=gGameState;gs.bus.condition=100;gs.bus.gas=gs.bus.max_gas;
        gs.resources.food=10;gs.resources.morale=100;gs.resources.cash=Math.max(gs.resources.cash,10000);
        gs.journey.days_until_festival=Math.max(7,gs.journey.days_until_festival);
        gs.band.forEach(function(b){b.present=true;b.mood=100;});
        RunnerSystem.hearts=3;RunnerSystem.invuln=999;SpaceSystem.lives=3;SpaceSystem.invuln=999;
        Jobs.lives=3;Jobs.god=true;StarfoxSystem.shields=100;
        if(gScene==='festival'&&FestivalSystem.state)FestivalSystem.state.budget=Math.max(10000,FestivalSystem.state.budget);
    }

    get state() { return {scene:gScene, game:gGameState, paused:!!this.paused, festival:gScene==='festival'?FestivalSystem.state:null}; }

    onUpdate(dt) {
        this.screenW = Screen.getWidth();
        this.screenH = Screen.getHeight();

        if(gScene!=="title"&&gScene!=="gameover"&&Input.getKeyDown("p"))this.paused=!this.paused;
        if(this.paused){
            Art.background(0,this.screenW,this.screenH,0.5);
            Art.results('TOUR PAUSED',['P · resume the current game','Your minigame timer is stopped.'],this.screenW,this.screenH,'P · resume');
            return;
        }

        this.protect();

        // ── GAME OVER CHECK — before any scene renders ─────────────
        if (gScene !== "title" && gScene !== "gameover" && gScene !== "gearpack") {
            if (gGameState.bus.condition <= 0) {
                gGameOverReason = "bus";
                gGameOverMusicPlayed = false;
                gScene = "gameover";
            } else if (gGameState.journey.days_until_festival <= 0 &&
                       gGameState.journey.current_city !== "turku" &&
                       gScene !== "festival") {
                gGameOverReason = "days";
                gGameOverMusicPlayed = false;
                gScene = "gameover";
            }
        }

        // ── CHEAT MENU TOGGLE — O key (not during title/gameover) ──
        if (gScene !== "title" && gScene !== "gameover" && gScene !== "cheat") {
            if (Input.getKeyDown("o")) {
                gCheatPrevScene = gScene;
                gCheatMenuIdx = 0;
                gCheatJustOpened = true;
                gScene = "cheat";
            }
        }

        switch (gScene) {
            case "title":       this.updateTitle(dt); break;
            case "gearpack":    this.updateGearPack(dt); break;
            case "overworld":   this.updateOverworld(dt); break;
            case "city":        this.updateCity(dt); break;
            case "office":      this.updateOffice(dt); break;
            case "jobs":        this.updateJobs(dt); break;
            case "encounter":   this.updateEncounter(dt); break;
            case "soundcheck":  this.updateSoundCheck(dt); break;
            case "gig":         this.updateGig(dt); break;
            case "moosedodge":  this.updateMooseDodge(dt); break;
            case "kickoff":     this.updateKickoff(dt); break;
            case "space":       this.updateSpace(dt); break;
            case "trail":       this.updateTrail(dt); break;
            case "race":        this.updateRace(dt); break;
            case "tent":        this.updateTent(dt); break;
            case "fuel":        this.updateFuel(dt); break;
            case "runner":      this.updateRunner(dt); break;
            case "night":       this.updateNight(dt); break;
            case "starfox":     this.updateStarfox(dt); break;
            case "festival":    this.updateFestival(dt); break;
            case "gameover":    this.updateGameOver(dt); break;
            case "cheat":       this.updateCheatMenu(dt); break;
        }
        if (gGameState && gScene !== "title") Tycoon.drawToast(this.screenW, dt);
    }

    // ── HELPER: pick correct overworld music for time of day ───────
    playOverworldMusic() {
        if (gGameState && gGameState.journey.time_of_day === "night") {
            Audio.playMusic(MUSIC.OVERWORLD_NIGHT, true);
        } else {
            Audio.playMusic(MUSIC.OVERWORLD_DAY, true);
        }
    }

    // ── HELPER: return to city after any minigame ──────────────────

    returnToCity() {
        var arrivedCity = gGameState.journey.current_city;
        if (arrivedCity === "turku") {
            gScene = "festival";
        } else {
            BandMood.onRouteComplete(gGameState);
            gScene = "city";
            CityMenu.open(arrivedCity);
            Audio.playMusic(MUSIC.CITY, true);
            SaveManager.save();
        }
    }

    returnToCityFromAction() {
        gScene = "city";
        CityMenu.open(gGameState.journey.current_city);
        Audio.playMusic(MUSIC.CITY, true);
        SaveManager.save();
    }

    // ── HELPER: roll for encounter after route travel ────────────

    rollPostTravelEvent() {
        // 1) Night driving — automatic when time_of_day === "night"
        if (gGameState.journey.time_of_day === "night" && Math.random() < 0.5) {
            NightSystem.start(gGameState);
            gScene = "night";
            return;
        }

        // 2) Bus breakdown → runner minigame (bus condition < 15)
        if (gGameState.bus.condition > 0 && gGameState.bus.condition < 15 && Math.random() < 0.6) {
            RunnerSystem.start(gGameState);
            gScene = "runner";
            return;
        }

        // 3) Roll for encounter
        var enc = this.rollEncounter(gBusAnimRoute);
        if (enc) {
            gDryRouteCount = 0;
            EncounterSystem.start(enc, gBusAnimRoute, gGameState);
            gScene = "encounter";
            return;
        }

        // 4) Roll for moose dodge hazard
        var hazardGuaranteed = gDryRouteCount >= 2;
        if (gBusAnimRoute && (hazardGuaranteed || Math.random() < gBusAnimRoute.hazard_rate)) {
            gDryRouteCount = 0;
            MooseDodgeSystem.start(gGameState, gBusAnimRoute);
            gScene = "moosedodge";
            return;
        }

        // No event — increment dry counter, go to city
        gDryRouteCount++;
        this.returnToCity();
    }

    // Roll for encounter (same logic as old EncounterSystem.rollEncounter)
    rollEncounter(route) {
        var guaranteed = gDryRouteCount >= 2;
        if (!guaranteed && Math.random() > route.encounter_rate) return null;
        var available = ENCOUNTERS.filter(function(enc) {
            return gUsedEncounterIds.indexOf(enc.id) === -1;
        });
        if (available.length === 0) return null;
        var idx = Math.floor(Math.random() * available.length);
        gUsedEncounterIds.push(available[idx].id);
        gGameState.journey.encounters_survived++;
        return available[idx];
    }

    // ── TITLE SCREEN ────────────────────────────────────────────────

    updateTitle(dt) {
        
        Draw2D.drawImage(0, 0, this.screenW, this.screenH, SPRITES.TITLE_BG, 1, 1, 1, 1, -10);

        var centerX = this.screenW / 2;
        // Draw2D.drawText(centerX - 170, this.screenH * 0.25, "MIKKO LEVON'S",
        //     0.88, 0.63, 0.13, 1, F.TITLE_BIG);
        // Draw2D.drawText(centerX - 190, this.screenH * 0.25 + 30, "MIDNIGHT SUN TOUR",
        //     1, 1, 1, 1, F.TITLE_XL);
        Draw2D.drawText(centerX - 130, this.screenH * 0.25 + 65, "Kuusamo to Ruisrock, 1991",
            0.50, 0.50, 0.63, 1, F.UI);

        gTitleBlinkTimer += dt;
        if (gTitleBlinkTimer > 0.5) {
            gTitleBlinkTimer = 0;
            gTitleShowText = !gTitleShowText;
        }
        if (gTitleShowText) {
            Draw2D.drawText(centerX - 80, this.screenH * 0.65, "PRESS ENTER TO START",
                0.75, 0.75, 0.88, 1, F.LARGE);
        }
        if (SaveManager.hasSave()) {
            Draw2D.drawText(centerX - 70, this.screenH * 0.75, "Press S to load save",
                0.38, 0.38, 0.50, 1, F.BODY);
        }
        Draw2D.drawText(centerX - 110, this.screenH - 30, "A Nordscrap Engine Sample Game by crowelian 2026.",
            0.25, 0.25, 0.38, 1, F.BODY);

        if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
            gGameState = createNewGameState();
            resetEncounterTracking();
            GearPackSystem.start(gGameState, GEAR_DATA);
            gScene = "gearpack";
        }
        if (Input.getKeyDown("s") && SaveManager.hasSave()) {
            if (SaveManager.load()) {
                this.goToOverworld();
            }
        }
    }

    goToOverworld() {
        console.log("[GameManager] Transitioning to overworld...");
        console.log("platform:");
        console.log(Screen.getPlatform());
        const currentPlatform = Screen.getPlatform();
        if (currentPlatform && currentPlatform === "web") {
            Scene.load("scenes/overworld.scene"); // fix this later in engine
        } else {
            Scene.load("assets/scenes/overworld.scene");
        }
        
    }

    // ── OVERWORLD ───────────────────────────────────────────────────

    updateOverworld(dt) {
        CopperRenderer.draw(COPPER_OVERWORLD, this.screenW, this.screenH);
        OverworldMap.draw(this.screenW, this.screenH);

        if (gBusAnimating) {
            var arrived = OverworldMap.updateAnimation(dt);
            if (arrived) {
                if (gGameState.journey.current_city === "turku") {
                    gScene = "festival";
                    return;
                }
                this.rollPostTravelEvent();
            }
        } else {
            var choice = OverworldMap.handleInput();
            if (choice) {
                if (choice.enterCity) {
                    // Re-enter current city (fallback when stuck)
                    console.log("[Overworld] Re-entering current city");
                    CityMenu.open(gGameState.journey.current_city);
                    gScene = "city";
                    Audio.playMusic(MUSIC.CITY, true);
                } else {
                    console.log("[Overworld] Traveling to " + choice.cityId + " (" +
                        choice.route.distance_km + "km, " + choice.route.road_type + ")");
                    OverworldMap.startTravel(choice.cityId);
                }
            }
        }

        // Bus condition warning
        if (gGameState.bus.condition <= 25 && gGameState.bus.condition > 0) {
            var warn = Math.sin(Time.getTime() * 3) > 0;
            if (warn) {
                Draw2D.drawText(this.screenW / 2 - 80, this.screenH / 2, "!! BUS IN BAD SHAPE !!",
                    1, 0.25, 0.25, 1, F.LARGE);
            }
        }

        HUD.draw(this.screenW, this.screenH);
    }

    // ── CITY MENU ───────────────────────────────────────────────────

    updateCity(dt) {
        CopperRenderer.draw(COPPER_OVERWORLD, this.screenW, this.screenH);
        OverworldMap.draw(this.screenW, this.screenH, true);
        CityMenu.draw(this.screenW, this.screenH);
        BandMood.drawEventText(this.screenW, this.screenH, dt);

        var action = CityMenu.handleInput();
        if (action) {
            var result = CityMenu.applyAction(action);
            if (result === "leave") {
                gScene = "overworld";
                this.playOverworldMusic();
                var adj = OverworldMap.getAdjacentCities();
                if (adj.length > 0) {
                    gSelectedCityIdx = OverworldMap.getCityIdxById(adj[0].cityId);
                }
            } else if (result === "soundcheck") {
                gSCCity = OverworldMap.getCityById(gGameState.journey.current_city);
                SoundCheckSystem.start(gGameState, gSCCity);
                gScene = "soundcheck";
            } else if (result === "jobs") {
                Jobs.start(gGameState,0);gScene="jobs";
            } else if (result === "office") {
                Tycoon.open(gGameState, OverworldMap.getCityById(gGameState.journey.current_city));
                gScene = "office";
            } else if (result === "tent") {
                TentSystem.start(gGameState);
                gScene = "tent";
            } else if (result === "fuel") {
                FuelSystem.start(gGameState);
                gScene = "fuel";
            } else if (result === "space") {
                SpaceSystem.start(gGameState);
                gScene = "space";
            } else if (result === "starfox") {
                StarfoxSystem.start(gGameState);
                gScene = "starfox";
            }
        }
        HUD.draw(this.screenW, this.screenH);
    }

    // ── TOUR OFFICE (tycoon) ────────────────────────────────────────

    updateJobs(dt) {
        var result=Jobs.update(dt); Jobs.draw(this.screenW,this.screenH);
        if(result && result.done) {
            var gs=gGameState, key=gs.journey.current_city+':'+result.job;
            gs.tourJobs=gs.tourJobs||{};
            if(result.job != null && !gs.tourJobs[key]) {
                gs.resources.cash+=result.cashWon; gs.tourJobs[key]=true;
                gs.resources.morale=Math.min(100,gs.resources.morale+3);
            }
            this.returnToCityFromAction();
        }
    }

    updateOffice(dt) {
        Tycoon.draw(this.screenW, this.screenH);
        if (Tycoon.handleInput() === "close") {
            gScene = "city";
            CityMenu.open(gGameState.journey.current_city);
        }
    }

    // ── ENCOUNTER ───────────────────────────────────────────────────

    updateEncounter(dt) {
        EncounterSystem.draw(this.screenW, this.screenH);
        var result = EncounterSystem.handleInput(gGameState);

        if (result && result.done) {
            // Check if encounter choice triggered a minigame
            if (result.trigger) {
                gPendingMinigameTrigger = null;
                switch (result.trigger) {
                    case "kickoff":
                        KickoffSystem.start(gGameState);
                        gScene = "kickoff";
                        return;
                    case "trail":
                        TrailSystem.start(gGameState);
                        gScene = "trail";
                        return;
                    case "race":
                        RaceSystem.start(gGameState);
                        gScene = "race";
                        return;
                }
            }
            this.returnToCity();
        }
        HUD.draw(this.screenW, this.screenH);
    }

    // ── GEAR PACK ───────────────────────────────────────────────────

    updateGearPack(dt) {
        var result = GearPackSystem.update(dt);
        GearPackSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            // Apply packed items to inventory
            if (result.packedItems) {
                gGameState.inventory = result.packedItems;
            }
            this.goToOverworld();
        }
    }

    // ── SOUND CHECK ─────────────────────────────────────────────────

    updateSoundCheck(dt) {
        var result = SoundCheckSystem.update(dt);
        SoundCheckSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            gSCBonus = result.bonus || 1.0;
            // Start gig after sound check
            gSCCity=result.city||gSCCity||OverworldMap.getCityById(gGameState.journey.current_city);
            GigSystem.start(gGameState, gSCCity, gSCBonus, BandMood.getGigModifier(gGameState));
            gScene = "gig";
        }
        HUD.draw(this.screenW, this.screenH);
    }

    // ── MICRO-GIG ───────────────────────────────────────────────────

    updateGig(dt) {
        var result = GigSystem.handleInput(dt);
        GigSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            this.returnToCityFromAction();
        }
        HUD.draw(this.screenW, this.screenH);
    }

    // ── MOOSE DODGE ─────────────────────────────────────────────────

    updateMooseDodge(dt) {
        var result = MooseDodgeSystem.update(dt);
        MooseDodgeSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            this.returnToCity();
        }
    }

    // ── KICKOFF (Football) ──────────────────────────────────────────

    updateKickoff(dt) {
        var result = KickoffSystem.update(dt);
        KickoffSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            if (result.cashWon) gGameState.resources.cash += result.cashWon;
            if (result.moraleGain) gGameState.resources.morale = Math.min(100, gGameState.resources.morale + result.moraleGain);
            this.returnToCity();
        }
    }

    // ── SPACE INVADERS ──────────────────────────────────────────────

    updateSpace(dt) {
        var result = SpaceSystem.update(dt);
        SpaceSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            if (result.cashWon) gGameState.resources.cash += result.cashWon;
            gGameState.resources.morale = Math.min(100, gGameState.resources.morale + 5);
            this.returnToCityFromAction();
        }
    }

    // ── TRAIL (Oregon Trail) ────────────────────────────────────────

    updateTrail(dt) {
        var result = TrailSystem.update(dt);
        TrailSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            this.returnToCity();
        }
    }

    // ── RACE (Pseudo-3D) ────────────────────────────────────────────

    updateRace(dt) {
        var result = RaceSystem.update(dt);
        RaceSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            if (result.cashWon) gGameState.resources.cash += result.cashWon;
            this.returnToCity();
        }
    }

    // ── TENT (Simon Says) ───────────────────────────────────────────

    updateTent(dt) {
        var result = TentSystem.update(dt);
        TentSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            // Apply rest bonus based on tent progress
            var restBonus = result.restBonus || 0;
            gGameState.resources.morale = Math.min(100, gGameState.resources.morale + 15 + Math.floor(restBonus / 5) + Tycoon.restMorale(gGameState));
            gGameState.bus.condition = Math.min(100, gGameState.bus.condition + 5);
            gGameState.journey.time_of_day = "night";
            console.log("[City] Rested via tent. Morale +" + (15 + Math.floor(restBonus / 5)));
            this.returnToCityFromAction();
        }
    }

    // ── FUEL (Stop-the-needle) ──────────────────────────────────────

    updateFuel(dt) {
        var result = FuelSystem.update(dt);
        FuelSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            // Apply fuel based on accuracy
            var fuelGained = result.totalFuel || 0;
            gGameState.bus.gas = Math.min(gGameState.bus.max_gas, gGameState.bus.gas + fuelGained);
            console.log("[City] Refueled +" + fuelGained + "L via fuel gauge.");
            this.returnToCityFromAction();
        }
    }

    // ── RUNNER (Auto-runner) ────────────────────────────────────────

    updateRunner(dt) {
        var result = RunnerSystem.update(dt);
        RunnerSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            // Runner result: made the distance or fell
            if (result.reachedTarget) {
                gGameState.resources.morale = Math.min(100, gGameState.resources.morale + 10);
                gGameState.bus.condition = Math.min(100, gGameState.bus.condition + 15);
            }
            this.returnToCity();
        }
    }

    // ── NIGHT DRIVING ───────────────────────────────────────────────

    updateNight(dt) {
        var result = NightSystem.update(dt);
        NightSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            this.returnToCity();
        }
    }

    // ── STARFOX (Tähtialus) ──────────────────────────────────────────

    updateStarfox(dt) {
        var result = StarfoxSystem.update(dt);
        StarfoxSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            if (result.cashWon) gGameState.resources.cash += result.cashWon;
            gGameState.resources.morale = Math.min(100, gGameState.resources.morale + 5);
            this.returnToCityFromAction();
        }
    }

    // ── FESTIVAL ────────────────────────────────────────────────────

    updateFestival(dt) {
        if (!gFestivalStarted) {
            FestivalSystem.start(gGameState);
            gFestivalStarted = true;
        }
        var result = FestivalSystem.update(dt);
        FestivalSystem.draw(this.screenW, this.screenH);
        if (result && result.done) {
            if (result.restart) {
                gGameState = createNewGameState();
                resetEncounterTracking();
                gFestivalStarted = false;
                gBusAnimating = false;
                gPendingMinigameTrigger = null;
                gInitialized = false;
                Scene.load("assets/scenes/main.scene");
            }
        }
    }

    // ── GAME OVER (dedicated scene) ─────────────────────────────────

    updateGameOver(dt) {
        if (!gGameOverMusicPlayed) {
            Audio.playMusic(MUSIC.GAME_OVER, false);
            gGameOverMusicPlayed = true;
        }

        // Full black screen
        Draw2D.fillRect(0, 0, this.screenW, this.screenH, 0, 0, 0, 1, -5);

        var cx = this.screenW / 2;
        var cy = this.screenH * 0.25;

        if (gGameOverReason === "bus") {
            Draw2D.drawText(cx - 60, cy, "BUS BROKE DOWN", 1, 0.25, 0.25, 1, F.TITLE);
            cy += 30;
            Draw2D.drawText(cx - 90, cy, "The old bus finally gave up the ghost.",
                0.60, 0.60, 0.70, 1, F.BODY);
        } else {
            Draw2D.drawText(cx - 110, cy, "RUISROCK STARTED WITHOUT YOU", 1, 0.25, 0.25, 1, F.HEADING);
            cy += 30;
            Draw2D.drawText(cx - 100, cy, "The festival went on. You weren't there.",
                0.60, 0.60, 0.70, 1, F.BODY);
        }
        cy += 35;

        Draw2D.drawText(cx - 50, cy, "GAME OVER", 1, 1, 1, 1, F.TITLE_XL);
        cy += 45;

        // Stats
        Draw2D.drawText(30, cy, "Days survived: " + (8 - gGameState.journey.days_until_festival),
            0.75, 0.75, 0.88, 1, F.BODY);
        cy += 18;
        Draw2D.drawText(30, cy, "Cities visited: " + gGameState.visited_cities.length,
            0.75, 0.75, 0.88, 1, F.BODY);
        cy += 18;
        Draw2D.drawText(30, cy, "Cash: " + gGameState.resources.cash + " EUR",
            0.75, 0.75, 0.88, 1, F.BODY);
        cy += 30;

        // Blink restart prompt
        var blink = Math.sin(Time.getTime() * 3) > 0;
        if (blink) {
            Draw2D.drawText(cx - 80, this.screenH - 40, "Press R to restart",
                0.50, 0.50, 0.50, 1, F.LARGE);
        }

        // ONLY R restarts — no Enter, no other keys
        if (Input.getKeyDown("r")) {
            gGameState = createNewGameState();
            resetEncounterTracking();
            gFestivalStarted = false;
            gGameOverReason = "";
            gBusAnimating = false;
            gPendingMinigameTrigger = null;
            gInitialized = false;
            Scene.load("assets/scenes/main.scene");
        }
    }

    // ── CHEAT MENU ──────────────────────────────────────────────────

    updateCheatMenu(dt) {
        Draw2D.fillRect(0, 0, this.screenW, this.screenH, 0.05, 0.02, 0.10, 0.95, -5);

        Draw2D.drawText(this.screenW / 2 - 50, 10, "TOUR ARCADE", 0.95, 0.40, 0.95, 1, F.HEADING);
        Draw2D.drawText(this.screenW / 2 - 80, 30, "[UP/DOWN] Select  [ENTER] Launch  [O] Close",
            0.50, 0.50, 0.60, 1, F.TINY);

        var startY = 55;
        var lineH = 16;
        for (var i = 0; i < CHEAT_MINIGAMES.length; i++) {
            var mg = CHEAT_MINIGAMES[i];
            var yy = startY + (i % 9) * 27;
            var xx = i < 9 ? 0 : this.screenW/2;
            var selected = (i === gCheatMenuIdx);

            if (selected) {
                Draw2D.fillRect(xx+10, yy - 1, this.screenW/2 - 20, 25, 0.30, 0.15, 0.40, 1);
                Draw2D.drawText(xx+15, yy + 2, "> " + mg.label, 1, 0.85, 0.30, 1, F.LABEL);
            } else {
                Draw2D.drawText(xx+25, yy + 2, mg.label, 0.70, 0.70, 0.80, 1, F.BODY);
            }
        }

        // Navigation
        if (Input.getKeyDown("Up") || Input.getKeyDown("w")) {
            gCheatMenuIdx--;
            if (gCheatMenuIdx < 0) gCheatMenuIdx = CHEAT_MINIGAMES.length - 1;
        }
        if (Input.getKeyDown("Down") || Input.getKeyDown("s")) {
            gCheatMenuIdx++;
            if (gCheatMenuIdx >= CHEAT_MINIGAMES.length) gCheatMenuIdx = 0;
        }

        // Launch selected minigame
        if (Input.getKeyDown("Return") || Input.getKeyDown("Space")) {
            var sel = CHEAT_MINIGAMES[gCheatMenuIdx];
            if(StarfoxSystem.allEntities&&StarfoxSystem.allEntities.length)StarfoxSystem.cleanup();
            sel.starter(gGameState);
            gScene = sel.scene;
            console.log("[Cheat] Launched: " + sel.label);
        }

        // Close cheat menu — return to previous scene
        // gCheatJustOpened guards against O key triggering close on same frame as open
        if (gCheatJustOpened) {
            gCheatJustOpened = false;
        } else if (Input.getKeyDown("o") || Input.getKeyDown("Escape")) {
            gScene = gCheatPrevScene;
        }
    }
}