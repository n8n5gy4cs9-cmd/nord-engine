// ============================================================================
// GAME CONSTANTS — Shared asset paths and palette for all modules
// Imported via: var C = require("./game_constants.js");
// ============================================================================

var MUSIC = {
    TITLE:          "assets/music/title_screen.mp3",
    OVERWORLD_DAY:  "assets/music/overworld_day.mp3",
    OVERWORLD_NIGHT:"assets/music/overworld_night.mp3",
    CITY:           "assets/music/city_theme.mp3",
    DRIVING:        "assets/music/driving_minigame.mp3",
    SAUNA:          "assets/music/sauna.mp3",
    MOOSE_DODGE:    "assets/music/moose_dodge.mp3",
    SOUNDCHECK:     "assets/music/soundcheck.mp3",
    FESTIVAL_GOOD:  "assets/music/festival_good.mp3",
    FESTIVAL_BAD:   "assets/music/festival_bad.mp3",
    GAME_OVER:      "assets/music/game_over.mp3",
    // New minigame tracks
    KICKOFF:        "assets/music/kickoff.mp3",
    ARCADE:         "assets/music/arcade.mp3",
    TRAIL:          "assets/music/trail.mp3",
    RACE:           "assets/music/race.mp3",
    TENT:           "assets/music/tent.mp3",
    RUNNER:         "assets/music/runner.mp3",
    NIGHT_DRIVE:    "assets/music/minigame_night_driving.mp3",
    STARFOX_1:      "assets/music/starfoxmikko.mp3",
    STARFOX_2:      "assets/music/starfoxmikko2.mp3",
    GIG:            "assets/music/gig_performance.mp3",
    FUEL:           "assets/music/fuel_stop.mp3"
};

var SFX = {
    BUS_ENGINE:     "assets/sfx/bus_engine_loop.mp3",
    BUS_HORN:       "assets/sfx/bus_horn.mp3",
    BUS_BREAKDOWN:  "assets/sfx/bus_breakdown.mp3",
    TIRE_SCREECH:   "assets/sfx/tire_screech.mp3",
    GRAVEL:         "assets/sfx/gravel_road.mp3",
    POTHOLE:        "assets/sfx/pothole_hit.mp3",
    DOOR_CREAK:     "assets/sfx/door_creak.mp3",
    CROWD_CHEER:    "assets/sfx/crowd_cheer.mp3",
    CROWD_BOO:      "assets/sfx/crowd_boo.mp3",
    CASH_REGISTER:  "assets/sfx/cash_register.mp3",
    BEER_OPEN:      "assets/sfx/beer_open.mp3",
    SAUNA_STEAM:    "assets/sfx/sauna_steam.mp3",
    MOOSE_GRUNT:    "assets/sfx/moose_grunt.mp3",
    GUITAR_STRUM:   "assets/sfx/guitar_strum.mp3",
    DRUM_HIT:       "assets/sfx/drum_hit.mp3",
    FEEDBACK:       "assets/sfx/feedback_squeal.mp3",
    UI_CLICK:       "assets/sfx/ui_click.mp3",
    UI_CONFIRM:     "assets/sfx/ui_confirm.mp3",
    UI_CANCEL:      "assets/sfx/ui_cancel.mp3",
    ENCOUNTER:      "assets/sfx/encounter_sting.mp3",
    LEVEL_UP:       "assets/sfx/level_up.mp3",
    ITEM_PICKUP:    "assets/sfx/item_pickup.mp3",
    ENGINE_START:   "assets/sfx/engine_start.mp3",
    RAIN_LOOP:      "assets/sfx/rain_loop.mp3",
    // New minigame SFX
    KICK_BALL:      "assets/sfx/kick_ball.mp3",
    GOAL_SCORED:    "assets/sfx/goal_scored.mp3",
    WHISTLE:        "assets/sfx/whistle.mp3",
    LASER_SHOOT:    "assets/sfx/laser_shoot.mp3",
    ALIEN_HIT:      "assets/sfx/alien_hit.mp3",
    ALIEN_BOMB:     "assets/sfx/alien_bomb.mp3",
    TENT_SNAP:      "assets/sfx/tent_snap.mp3",
    TENT_DONE:      "assets/sfx/tent_done.mp3",
    FUEL_TICK:      "assets/sfx/fuel_tick.mp3",
    FUEL_STOP:      "assets/sfx/fuel_stop.mp3",
    JUMP:           "assets/sfx/jump.mp3",
    STUMBLE:        "assets/sfx/stumble.mp3",
    HEADLIGHT_ON:   "assets/sfx/ui_click.mp3",
    NIGHT_CRASH:    "assets/sfx/night_crash.mp3",
    ENGINE_REV:     "assets/sfx/engine_rev.mp3",
    LADA_HORN:      "assets/sfx/lada_horn.mp3"
};

var BAND_MUSIC = {
    BJM:            "assets/music/band_music/bjm_live.mp3",
    ALDOUS_HARDING: "assets/music/band_music/aldous_harding_live.mp3",
    BURIAL:         "assets/music/band_music/burial_dj_set.mp3",
    ISLAJA:         "assets/music/band_music/islaja_live.mp3",
    KARHUMAURI:     "assets/music/band_music/karhumauri_live.mp3",
    QUEEN:          "assets/music/band_music/queen_live.mp3"
};

var SPRITES = {
    // Bus
    BUS_SIDE:           "assets/sprites/bus_side.png",
    BUS_FRONT:          "assets/sprites/bus_front.png",
    BUS_BROKEN:         "assets/sprites/bus_broken.png",
    BUS_SAUNA:          "assets/sprites/bus_sauna.png",
    // Overworld map
    MAP_FINLAND:        "assets/sprites/map_finland.png",
    MAP_FOG:            "assets/sprites/map_fog.png",
    MAP_CITY_UNKNOWN:   "assets/sprites/map_city_unknown.png",
    MAP_CITY_SAFE:      "assets/sprites/map_city_safe.png",
    MAP_CITY_CURRENT:   "assets/sprites/map_city_current.png",
    MAP_ROAD_H:         "assets/sprites/map_road_h.png",
    MAP_ROAD_V:         "assets/sprites/map_road_v.png",
    MAP_ROAD_DIRT_H:    "assets/sprites/map_road_dirt_h.png",
    MAP_CURSOR:         "assets/sprites/map_cursor.png",
    // Band portraits
    BAND_MIKKO_PORT:    "assets/sprites/band_mikko_portrait.png",
    BAND_PEKKA_PORT:    "assets/sprites/band_pekka_portrait.png",
    BAND_RISTO_PORT:    "assets/sprites/band_risto_portrait.png",
    BAND_HANNELE_PORT:  "assets/sprites/band_hannele_portrait.png",
    // Band sprites
    BAND_MIKKO_SPR:     "assets/sprites/band_mikko_sprite.png",
    BAND_PEKKA_SPR:     "assets/sprites/band_pekka_sprite.png",
    BAND_RISTO_SPR:     "assets/sprites/band_risto_sprite.png",
    BAND_HANNELE_SPR:   "assets/sprites/band_hannele_sprite.png",
    // Encounter illustrations
    ENC_MOOSE:          "assets/sprites/enc_moose_road.png",
    ENC_SAUNA:          "assets/sprites/enc_sauna.png",
    ENC_SPEED_CAM:      "assets/sprites/enc_speed_camera.png",
    ENC_KARAOKE:        "assets/sprites/enc_karaoke_bar.png",
    ENC_WRONG_TURN:     "assets/sprites/enc_wrong_turn.png",
    ENC_RAINSTORM:      "assets/sprites/enc_rainstorm.png",
    ENC_HITCHHIKER:     "assets/sprites/enc_hitchhiker.png",
    ENC_ROADWORK:       "assets/sprites/enc_roadwork.png",
    ENC_LOCAL_BAND:     "assets/sprites/enc_local_band.png",
    ENC_BROKEN_BRIDGE:  "assets/sprites/enc_broken_bridge.png",
    ENC_FESTIVAL_RUMOUR:"assets/sprites/enc_festival_rumour.png",
    ENC_MIDSUMMER:      "assets/sprites/enc_midsummer.png",
    // Minigame — Moose Dodge
    MG_DODGE_BUS:       "assets/sprites/mg_dodge_bus.png",
    MG_DODGE_MOOSE:     "assets/sprites/mg_dodge_moose.png",
    MG_DODGE_POTHOLE:   "assets/sprites/mg_dodge_pothole.png",
    MG_DODGE_ROAD:      "assets/sprites/mg_dodge_road_tile.png",
    MG_DODGE_TREES:     "assets/sprites/mg_dodge_trees.png",
    // Minigame — Sound Check
    MG_SOUND_MIXER:     "assets/sprites/mg_sound_mixer.png",
    MG_SOUND_SLIDER:    "assets/sprites/mg_sound_slider.png",
    MG_SOUND_VU:        "assets/sprites/mg_sound_vu_bar.png",
    MG_SOUND_TARGET:    "assets/sprites/mg_sound_target.png",
    // Minigame — Gear Pack
    MG_GEAR_GRID:       "assets/sprites/mg_gear_grid.png",
    MG_GEAR_AMP:        "assets/sprites/mg_gear_guitar_amp.png",
    MG_GEAR_DRUMS:      "assets/sprites/mg_gear_drum_kit.png",
    MG_GEAR_PA:         "assets/sprites/mg_gear_pa_speakers.png",
    MG_GEAR_MERCH:      "assets/sprites/mg_gear_merch_box.png",
    MG_GEAR_TIRE:       "assets/sprites/mg_gear_spare_tire.png",
    MG_GEAR_BEER:       "assets/sprites/mg_gear_beer_crate.png",
    MG_GEAR_GUITAR:     "assets/sprites/mg_gear_guitar_case.png",
    // Minigame — Fuel
    MG_FUEL_GAUGE:      "assets/sprites/fuel_gauge.png",
    MG_FUEL_HOSE:       "assets/sprites/fuel_hose.png",
    MG_FUEL_PUMP:       "assets/sprites/fuel_pump.png",
    MG_FUEL_STATION:    "assets/sprites/fuel_station_bg.png",
    // UI
    UI_PANEL:           "assets/sprites/ui_panel_bg.png",
    UI_BTN_NORMAL:      "assets/sprites/ui_button_normal.png",
    UI_BTN_PRESSED:     "assets/sprites/ui_button_pressed.png",
    UI_BTN_HOVER:       "assets/sprites/ui_button_hover.png",
    UI_RESOURCE_BAR:    "assets/sprites/ui_resource_bar.png",
    UI_PORTRAIT_FRAME:  "assets/sprites/ui_portrait_frame.png",
    UI_CURSOR:          "assets/sprites/ui_cursor.png",
    UI_FONT:            "assets/sprites/ui_font_sheet.png",
    UI_COPPER:          "assets/sprites/ui_copper_gradient.png",
    // Festival endings
    END_LEGENDARY:      "assets/sprites/end_legendary.png",
    END_GREAT:          "assets/sprites/end_great.png",
    END_DECENT:         "assets/sprites/end_decent.png",
    END_POOR:           "assets/sprites/end_poor.png",
    END_DISASTER:       "assets/sprites/end_disaster.png",
    // Title / Menu
    TITLE_BG:           "assets/sprites/MikkoLevon_title.png",
    // Pseudo-3D racing sprites
    BUS_PLAYER:         "assets/sprites/bus_player.png",
    BUS_NIGHT:          "assets/sprites/bus_night.png",
    LADA_RED:           "assets/sprites/lada_red.png",
    TREE_PINE:          "assets/sprites/tree_pine.png",
    TREE_BIRCH:         "assets/sprites/tree_birch.png",
    ROAD_SIGN:          "assets/sprites/road_sign.png",
    EXHAUST_PUFF:       "assets/sprites/exhaust_puff.png",
    HEADLIGHT_CONE:     "assets/sprites/headlight_cone.png",
    MOOSE_SILHOUETTE:   "assets/sprites/moose_silhouette.png",
    ROCK_OBSTACLE:      "assets/sprites/rock_obstacle.png"
};

// ============================================================================
// PALETTE — 32-color Amiga
// ============================================================================
var PALETTE = {
    BLACK:         [0.00, 0.00, 0.00, 1],
    DARK_BLUE:     [0.05, 0.10, 0.30, 1],
    NAVY:          [0.10, 0.15, 0.40, 1],
    MIDNIGHT:      [0.10, 0.04, 0.18, 1],
    DEEP_PURPLE:   [0.18, 0.11, 0.41, 1],
    DARK_GREEN:    [0.05, 0.25, 0.10, 1],
    FOREST:        [0.10, 0.35, 0.15, 1],
    PINE:          [0.15, 0.45, 0.20, 1],
    GREY_ROAD:     [0.35, 0.35, 0.35, 1],
    DARK_GREY:     [0.20, 0.20, 0.22, 1],
    MID_GREY:      [0.50, 0.50, 0.50, 1],
    LIGHT_GREY:    [0.75, 0.75, 0.75, 1],
    WHITE:         [1.00, 1.00, 1.00, 1],
    STEEL_BLUE:    [0.30, 0.45, 0.60, 1],
    SKY_BLUE:      [0.40, 0.55, 0.75, 1],
    PALE_BLUE:     [0.60, 0.75, 0.90, 1],
    AMBER:         [0.80, 0.55, 0.15, 1],
    WARM_BROWN:    [0.45, 0.30, 0.15, 1],
    WOOD:          [0.55, 0.40, 0.25, 1],
    SMOKE_GREY:    [0.55, 0.50, 0.48, 1],
    RED:           [0.80, 0.15, 0.10, 1],
    DARK_RED:      [0.50, 0.08, 0.05, 1],
    ORANGE:        [0.90, 0.50, 0.10, 1],
    YELLOW:        [0.95, 0.85, 0.20, 1],
    YELLOW_GREEN:  [0.60, 0.80, 0.20, 1],
    TEAL:          [0.15, 0.55, 0.55, 1],
    COPPER_HI:     [0.85, 0.55, 0.30, 1],
    COPPER_LO:     [0.50, 0.25, 0.10, 1],
    SKIN_LIGHT:    [0.90, 0.75, 0.60, 1],
    SKIN_DARK:     [0.65, 0.45, 0.30, 1],
    BUS_BLUE:      [0.20, 0.35, 0.65, 1],
    BUS_RUST:      [0.55, 0.30, 0.15, 1]
};

// ============================================================================
// FONT SCALE CONSTANTS — semantic sizes, easy to tune globally
// drawText scale: 0.4≈8px, 0.5≈10px, 0.6≈12px, 0.8≈16px, 1.0≈20px
// ============================================================================
var FONT = {
    MICRO:     0.46,  // direction arrows, tiny annotations (was 0.3)
    TINY:      0.56,  // item labels, newspaper text, small tags (was 0.34-0.42)
    SMALL:     0.62,  // control hints, speed/timer displays (was 0.45)
    BODY:      0.68,  // main body text — most common (was 0.5)
    LABEL:     0.75,  // section headers, how-to-play (was 0.55)
    UI:        0.80,  // HUD values, stats, payout amounts (was 0.6)
    LARGE:     0.90,  // venue names, grades, important feedback (was 0.65-0.7)
    HEADING:   1.05,  // screen/panel titles (was 0.8)
    TITLE:     1.15,  // results titles (was 0.9)
    TITLE_BIG: 1.25,  // ready screen main titles (was 1.0)
    TITLE_XL:  1.50,  // splash, GAME OVER (was 1.2)
};

// ============================================================================
// VIEWPORT HELPER — Uniform-scale 320×256 game area to any screen size
// Usage: var vp = C.viewport(screenW, screenH);
//   vp.x(gameX)             → screen X
//   vp.y(gameY)             → screen Y
//   vp.s(gameSize)          → scaled size
//   vp.ox, vp.oy            → screen offset of game area top-left
//   vp.w, vp.h              → scaled game area dimensions
//   vp.scale                → uniform scale factor
//   vp.screenW, vp.screenH  → raw screen dimensions
// ============================================================================
var GAME_W = 320;
var GAME_H = 256;

function createViewport(screenW, screenH) {
    var scale = Math.min(screenW / GAME_W, screenH / GAME_H);
    var w = GAME_W * scale;
    var h = GAME_H * scale;
    var ox = (screenW - w) / 2;
    var oy = (screenH - h) / 2;
    return {
        scale: scale,
        ox: ox,
        oy: oy,
        w: w,
        h: h,
        screenW: screenW,
        screenH: screenH,
        x: function(gx) { return ox + gx * scale; },
        y: function(gy) { return oy + gy * scale; },
        s: function(v) { return v * scale; }
    };
}

// ============================================================================
// COPPER BAR PRESETS
// ============================================================================
var COPPER_TITLE = [
    { scanline: 0,   r: 0.10, g: 0.04, b: 0.18 },
    { scanline: 50,  r: 0.18, g: 0.11, b: 0.41 },
    { scanline: 100, r: 0.05, g: 0.23, b: 0.48 },
    { scanline: 160, r: 0.05, g: 0.15, b: 0.35 },
    { scanline: 200, r: 0.03, g: 0.08, b: 0.20 },
    { scanline: 256, r: 0.00, g: 0.00, b: 0.00 }
];

var COPPER_OVERWORLD = [
    { scanline: 0,   r: 0.40, g: 0.55, b: 0.75 },
    { scanline: 40,  r: 0.30, g: 0.45, b: 0.60 },
    { scanline: 80,  r: 0.15, g: 0.45, b: 0.20 },
    { scanline: 200, r: 0.10, g: 0.35, b: 0.15 },
    { scanline: 256, r: 0.05, g: 0.25, b: 0.10 }
];

module.exports = {
    MUSIC: MUSIC,
    SFX: SFX,
    SPRITES: SPRITES,
    PALETTE: PALETTE,
    BAND_MUSIC: BAND_MUSIC,
    FONT: FONT,
    COPPER_TITLE: COPPER_TITLE,
    COPPER_OVERWORLD: COPPER_OVERWORLD,
    GAME_W: GAME_W,
    GAME_H: GAME_H,
    viewport: createViewport
};
