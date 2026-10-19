// ============================================================================
// TÄHTIALUS — Star Fox 3D on-rails space shooter
// Phase 24a: Full 3D rewrite using Model3D.createPrimitive()
// Colored primitives only — retro N64/PS1 aesthetic — left/right movement only
// Camera perspective, entity lifecycle, Draw2D HUD overlay
// Usage: var Starfox = require("./mg_starfox.js");
// ============================================================================

var C = require("./game_constants.js");
var F = C.FONT;
var SFX = C.SFX;
var MUSIC = C.MUSIC;

// ── CONSTANTS ───────────────────────────────────────────────────────────────

var MAX_ENTITIES = 50;
var PLAYER_SPEED = 8.0;        // world units/s lateral
var PLAYER_X_LIMIT = 7.0;     // max left/right from center
var SHOOT_COOLDOWN = 0.15;
var MAX_LASERS = 6;
var LASER_SPEED = 40;          // world units/s forward (-Z)
var LASER_MAX_Z = -80;
var BOMB_MAX = 3;
var BARREL_ROLL_DUR = 0.4;
var BARREL_ROLL_CD = 0.8;

// Camera
var CAM_POS = [0, 5, 14];
var CAM_ROT = [18, 0, 0];
var CAM_FOV = 60;

// Ship
var SHIP_Y = 0.5;
var SHIP_Z = 0;

// Starfield
var NUM_STARS = 30;
var STAR_Z_MIN = -100;
var STAR_Z_MAX = -10;
var STAR_SPEED = 25;
var STAR_SPREAD_X = 25;
var STAR_SPREAD_Y = 15;

// Ground
var GROUND_SCROLL_SPEED = 3.0;

// Enemies
var CORRIDOR_DURATION = 45;
var GAME_OVER_DELAY = 3.0;
var SPAWN_INTERVAL_BASE = 0.7;
var SPAWN_INTERVAL_MIN = 0.3;
var ENEMY_SPEED_Z = 12;
var ENEMY_SPAWN_Z = -80;
var ENEMY_DESPAWN_Z = 15;
var ENEMY_FIRE_CHANCE = 0.004;
var ENEMY_BULLET_SPEED = 12;

// Boss
var BOSS_HP_CORE = 30;
var BOSS_HP_GUN = 12;
var BOSS_FIRE_RATE = 0.6;
var BOSS_Z = -25;

// Scoring
var SCORE_FIGHTER = 10;
var SCORE_MISSILE = 15;
var SCORE_TURRET = 20;
var SCORE_BOSS_GUN = 100;
var SCORE_BOSS_CORE = 500;

// ── PALETTE ─────────────────────────────────────────────────────────────────

var COL = {
    SHIP:      [0.3, 0.5, 0.9],
    SHIP_WING: [0.2, 0.35, 0.7],
    SHIP_ENG:  [0.1, 0.8, 1.0],
    LASER:     [0.2, 1.0, 0.3],
    ENEMY_F:   [0.9, 0.3, 0.2],
    ENEMY_M:   [1.0, 0.6, 0.1],
    ENEMY_T:   [0.8, 0.2, 0.8],
    EBULLET:   [1.0, 0.3, 0.3],
    BOSS_CORE: [0.6, 0.1, 0.1],
    BOSS_GUN:  [0.5, 0.5, 0.2],
    GROUND:    [0.06, 0.10, 0.06],
    HUD_HP:    [0.2, 0.8, 0.3],
    HUD_LOW:   [0.9, 0.2, 0.2],
    BOMB_COL:  [0.1, 0.5, 1.0]
};

// ── ORTHO SCREEN MAPPING ────────────────────────────────────────────────────
// All Model3D entities are mapped from game-space to ortho screen pixels.
// Game space: X lateral (±7), Z depth (-80 to +15), Y height (0-3).
// Screen:     X left-right (0-320), Y bottom-top (0-256), Z depth.
var SCR_CX = 160;     // screen center X
var SCR_BY = 45;      // ship base screen Y (near bottom, Y-up)
var XMUL = 18;        // game X → screen X multiplier
var ZMUL = 2.5;       // game Z → screen Y multiplier (inverted)
var SMUL = 20;        // entity scale multiplier

// ── MODULE ──────────────────────────────────────────────────────────────────

var StarfoxSystem = {
    phase: "ready",
    timer: 0,
    gs: null,
    score: 0,
    combo: 0,
    maxCombo: 0,
    shields: 100,
    bombs: BOMB_MAX,
    shootCD: 0,
    playerX: 0,

    // Barrel roll
    barrelRollTimer: 0,
    barrelRollCD: 0,
    barrelRollDir: 0,
    lastTapDir: 0,
    lastTapTime: 0,

    // 3D entity tracking
    allEntities: [],
    shipBody: -1,
    shipWingL: -1,
    shipWingR: -1,
    shipEngine: -1,
    groundId: -1,
    starData: [],
    laserPool: [],
    enemies: [],
    eBullets: [],
    explosions: [],

    // Boss
    bossActive: false,
    bossCore: null,
    bossGunL: null,
    bossGunR: null,
    bossCoreId: -1,
    bossGunLId: -1,
    bossGunRId: -1,
    bossFireCD: 0,
    bossX: 0,
    bossMoveTimer: 0,

    // Visual
    bombFlash: 0,
    corridorZ: 0,
    groundScrollV: 0,
    spawnTimer: 0,

    // Saved camera state
    savedCamType: "",
    savedCamPos: null,
    savedCamRot: null,
    savedCamFOV: 0,
    savedCamNear: 0,
    savedCamFar: 0,
    savedClearColor: null,

    // ── ENTITY MANAGEMENT ───────────────────────────────────────────

    makeEntity: function(shape, r, g, b, a) {
        if (this.allEntities.length >= MAX_ENTITIES) return -1;
        var id = Model3D.createPrimitive(shape);
        if (id > 0) {
            Model3D.setColor(id, r, g, b, a !== undefined ? a : 1);
            this.allEntities.push(id);
        }
        return id;
    },

    killEntity: function(id) {
        if (id <= 0) return;
        GameObject.destroy(id);
        var idx = this.allEntities.indexOf(id);
        if (idx >= 0) this.allEntities.splice(idx, 1);
    },


    // ── ORTHO COORDINATE HELPERS ────────────────────────────────────
    // Map game-space position to ortho screen position
    ep: function(id, gx, gy, gz) {
        if (id <= 0) return;
        Transform.setPosition(id, gx * XMUL + SCR_CX, -gz * ZMUL + SCR_BY, gy * 5);
    },
    // Map game-space scale to ortho screen scale (X stays X, Z→Y, Y→Z)
    es: function(id, sx, sy, sz) {
        if (id <= 0) return;
        Transform.setScale(id, sx * SMUL, sz * SMUL, sy * SMUL);
    },

    // ── CAMERA ──────────────────────────────────────────────────────

    setupCamera: function() {
        // Ortho camera — only change clear color to dark space background
        var cid = Camera.getPrimary();
        this.savedClearColor = Camera.getClearColor(cid);
        Camera.setClearColor(cid, 0.01, 0.01, 0.04, 1.0);
    },

    revertCamera: function() {
        // Revert only the clear color
        var cid = Camera.getPrimary();
        if (this.savedClearColor) {
            Camera.setClearColor(cid, this.savedClearColor.r, this.savedClearColor.g, this.savedClearColor.b, this.savedClearColor.a);
        }
    },

    // ── SHIP ────────────────────────────────────────────────────────

    createShip: function() {
        this.shipBody = this.makeEntity("cube", COL.SHIP[0], COL.SHIP[1], COL.SHIP[2], 1);
        if (this.shipBody > 0) {
            this.es(this.shipBody, 0.5, 0.3, 1.2);
            this.ep(this.shipBody, 0, SHIP_Y, SHIP_Z);
        }

        this.shipWingL = this.makeEntity("cube", COL.SHIP_WING[0], COL.SHIP_WING[1], COL.SHIP_WING[2], 1);
        if (this.shipWingL > 0) {
            this.es(this.shipWingL, 1.2, 0.08, 0.5);
            this.ep(this.shipWingL, -0.8, SHIP_Y - 0.05, SHIP_Z + 0.2);
        }

        this.shipWingR = this.makeEntity("cube", COL.SHIP_WING[0], COL.SHIP_WING[1], COL.SHIP_WING[2], 1);
        if (this.shipWingR > 0) {
            this.es(this.shipWingR, 1.2, 0.08, 0.5);
            this.ep(this.shipWingR, 0.8, SHIP_Y - 0.05, SHIP_Z + 0.2);
        }

        this.shipEngine = this.makeEntity("sphere", COL.SHIP_ENG[0], COL.SHIP_ENG[1], COL.SHIP_ENG[2], 0.8);
        if (this.shipEngine > 0) {
            this.es(this.shipEngine, 0.2, 0.2, 0.2);
            this.ep(this.shipEngine, 0, SHIP_Y, SHIP_Z + 0.7);
        }
    },

    updateShipPos: function() {
        var x = this.playerX;
        var tiltZ = 0;
        if (this.barrelRollTimer > 0) {
            tiltZ = (1.0 - this.barrelRollTimer / BARREL_ROLL_DUR) * 360 * this.barrelRollDir;
        } else {
            if (Input.getKey("Left") || Input.getKey("a")) tiltZ = 20;
            if (Input.getKey("Right") || Input.getKey("d")) tiltZ = -20;
        }

        if (this.shipBody > 0) {
            this.ep(this.shipBody, x, SHIP_Y, SHIP_Z);
            Transform.setRotation(this.shipBody, 0, 0, tiltZ);
        }
        if (this.shipWingL > 0) {
            this.ep(this.shipWingL, x - 0.8, SHIP_Y - 0.05, SHIP_Z + 0.2);
            Transform.setRotation(this.shipWingL, 0, 0, tiltZ);
        }
        if (this.shipWingR > 0) {
            this.ep(this.shipWingR, x + 0.8, SHIP_Y - 0.05, SHIP_Z + 0.2);
            Transform.setRotation(this.shipWingR, 0, 0, tiltZ);
        }
        // Engine glow pulse
        if (this.shipEngine > 0) {
            var pulse = 0.15 + Math.sin(this.corridorZ * 0.1) * 0.05;
            this.ep(this.shipEngine, x, SHIP_Y, SHIP_Z + 0.7);
            this.es(this.shipEngine, pulse, pulse, pulse);
        }
    },

    // ── STARFIELD ───────────────────────────────────────────────────

    createStarfield: function() {
        this.starData = [];
        for (var i = 0; i < NUM_STARS; i++) {
            var id = this.makeEntity("cube", 0.8, 0.8, 1.0, 0.5 + Math.random() * 0.5);
            if (id > 0) {
                var sx = (Math.random() - 0.5) * STAR_SPREAD_X * 2;
                var sy = Math.random() * STAR_SPREAD_Y + 1;
                var sz = STAR_Z_MIN + Math.random() * (STAR_Z_MAX - STAR_Z_MIN);
                var size = 0.08 + Math.random() * 0.10;
                this.es(id, size, size, size);
                this.ep(id, sx, sy, sz);
                this.starData.push({ id: id, x: sx, y: sy, z: sz, speed: 10 + Math.random() * STAR_SPEED });
            }
        }
    },

    updateStarfield: function(dt) {
        for (var i = 0; i < this.starData.length; i++) {
            var s = this.starData[i];
            s.z += s.speed * dt;
            if (s.z > CAM_POS[2] + 5) {
                s.z = STAR_Z_MIN + Math.random() * 20;
                s.x = (Math.random() - 0.5) * STAR_SPREAD_X * 2;
                s.y = Math.random() * STAR_SPREAD_Y + 1;
            }
            this.ep(s.id, s.x, s.y, s.z);
        }
    },

    // ── GROUND ──────────────────────────────────────────────────────

    createGround: function() {
        // No ground plane needed — ortho space view uses dark clear color
    },

    updateGround: function(dt) {
        // No ground in ortho space view
    },

    // ── LASERS ──────────────────────────────────────────────────────

    shootLaser: function() {
        if (this.laserPool.length >= MAX_LASERS) return;
        var id = this.makeEntity("cube", COL.LASER[0], COL.LASER[1], COL.LASER[2], 1);
        if (id > 0) {
            this.es(id, 0.08, 0.08, 0.6);
            this.ep(id, this.playerX, SHIP_Y, SHIP_Z - 0.8);
            this.laserPool.push({ id: id, x: this.playerX, z: SHIP_Z - 0.8 });
        }
    },

    updateLasers: function(dt) {
        for (var i = this.laserPool.length - 1; i >= 0; i--) {
            var l = this.laserPool[i];
            l.z -= LASER_SPEED * dt;
            this.ep(l.id, l.x, SHIP_Y, l.z);
            if (l.z < LASER_MAX_Z) {
                this.killEntity(l.id);
                this.laserPool.splice(i, 1);
                this.combo = 0;
            }
        }
    },

    // ── EXPLOSIONS (3D spheres) ─────────────────────────────────────

    spawnExplosion: function(wx, wy, wz, radius) {
        var id = this.makeEntity("sphere", 1, 0.9, 0.3, 1);
        if (id > 0) {
            this.ep(id, wx, wy, wz);
            this.es(id, 0.1, 0.1, 0.1);
            this.explosions.push({ id: id, maxR: radius, t: 0, dur: 0.4 });
        }
    },

    updateExplosions: function(dt) {
        for (var i = this.explosions.length - 1; i >= 0; i--) {
            var ex = this.explosions[i];
            ex.t += dt;
            var frac = ex.t / ex.dur;
            var r = ex.maxR * frac;
            if (ex.id > 0) {
                this.es(ex.id, r, r, r);
                Model3D.setColor(ex.id, 1, 0.9 - frac * 0.7, 0.2 * (1 - frac), 1 - frac * 0.8);
            }
            if (ex.t >= ex.dur) {
                this.killEntity(ex.id);
                this.explosions.splice(i, 1);
            }
        }
    },

    // ── ENEMIES ─────────────────────────────────────────────────────

    spawnWave: function() {
        var pattern = Math.floor(Math.random() * 4);
        var self = this;
        function spawn(type, x, z) {
            var col = type === "fighter" ? COL.ENEMY_F :
                      (type === "missile" ? COL.ENEMY_M : COL.ENEMY_T);
            var shape = type === "fighter" ? "cone" :
                        (type === "missile" ? "cylinder" : "sphere");
            var id = self.makeEntity(shape, col[0], col[1], col[2], 1);
            if (id <= 0) return;
            var hp = type === "turret" ? 3 : (type === "missile" ? 1 : 2);
            var speed = type === "missile" ? 18 : (type === "turret" ? 8 : 12);
            var scl = type === "turret" ? 0.8 : (type === "missile" ? 0.3 : 0.5);
            self.es(id, scl, scl, scl);
            self.ep(id, x, 1, z);
            if (type === "fighter") Transform.setRotation(id, 180, 0, 0);
            self.enemies.push({ id: id, type: type, x: x, y: 1, z: z, hp: hp, speed: speed, flash: 0 });
        }

        switch (pattern) {
            case 0: // V-formation
                for (var i = 0; i < 5; i++) {
                    spawn("fighter", (i - 2) * 2.5, ENEMY_SPAWN_Z - Math.abs(i - 2) * 3);
                }
                break;
            case 1: // Missiles
                for (var i = 0; i < 3; i++) {
                    spawn("missile", (i - 1) * 3, ENEMY_SPAWN_Z - i * 2);
                }
                break;
            case 2: // Turret + escorts
                spawn("turret", 0, ENEMY_SPAWN_Z - 5);
                spawn("fighter", -3, ENEMY_SPAWN_Z);
                spawn("fighter", 3, ENEMY_SPAWN_Z);
                break;
            case 3: // Scattered
                for (var i = 0; i < 4; i++) {
                    spawn("fighter", (Math.random() - 0.5) * 12, ENEMY_SPAWN_Z - Math.random() * 10);
                }
                break;
        }
    },

    updateEnemies: function(dt) {
        for (var i = this.enemies.length - 1; i >= 0; i--) {
            var e = this.enemies[i];
            e.z += e.speed * dt;
            if (e.flash > 0) e.flash -= dt * 5;
            this.ep(e.id, e.x, e.y, e.z);

            // Flash white on hit
            if (e.flash > 0) {
                Model3D.setColor(e.id, 1, 1, 1, 1);
            } else {
                var col = e.type === "fighter" ? COL.ENEMY_F :
                          (e.type === "missile" ? COL.ENEMY_M : COL.ENEMY_T);
                Model3D.setColor(e.id, col[0], col[1], col[2], 1);
            }

            // Fire at player
            if (e.z > ENEMY_SPAWN_Z * 0.5 && e.z < 5 && Math.random() < ENEMY_FIRE_CHANCE) {
                this.spawnEBullet(e.x, e.y, e.z);
            }

            // Off screen
            if (e.z > ENEMY_DESPAWN_Z) {
                this.killEntity(e.id);
                this.enemies.splice(i, 1);
                this.combo = 0;
            }
        }
    },

    spawnEBullet: function(ox, oy, oz) {
        var id = this.makeEntity("sphere", COL.EBULLET[0], COL.EBULLET[1], COL.EBULLET[2], 1);
        if (id <= 0) return;
        this.es(id, 0.15, 0.15, 0.15);
        this.ep(id, ox, oy, oz);
        var dx = this.playerX - ox;
        var dz = SHIP_Z - oz;
        var len = Math.sqrt(dx * dx + dz * dz) || 1;
        this.eBullets.push({ id: id, x: ox, y: oy, z: oz, vx: (dx / len) * ENEMY_BULLET_SPEED, vz: (dz / len) * ENEMY_BULLET_SPEED });
    },

    updateEBullets: function(dt) {
        for (var i = this.eBullets.length - 1; i >= 0; i--) {
            var b = this.eBullets[i];
            b.x += b.vx * dt;
            b.z += b.vz * dt;
            this.ep(b.id, b.x, b.y, b.z);
            if (b.z > ENEMY_DESPAWN_Z || b.z < ENEMY_SPAWN_Z || Math.abs(b.x) > 20) {
                this.killEntity(b.id);
                this.eBullets.splice(i, 1);
            }
        }
    },

    // ── COLLISIONS ──────────────────────────────────────────────────

    checkCollisions: function() {
        var isRolling = this.barrelRollTimer > 0;

        // Laser → Enemy
        for (var li = this.laserPool.length - 1; li >= 0; li--) {
            var l = this.laserPool[li];
            var hit = false;
            for (var ei = this.enemies.length - 1; ei >= 0; ei--) {
                var e = this.enemies[ei];
                if (Math.abs(l.x - e.x) < 1.5 && Math.abs(l.z - e.z) < 1.5) {
                    e.hp--;
                    e.flash = 1.0;
                    hit = true;
                    if (e.hp <= 0) {
                        var pts = e.type === "turret" ? SCORE_TURRET :
                                  (e.type === "missile" ? SCORE_MISSILE : SCORE_FIGHTER);
                        this.score += pts;
                        this.combo++;
                        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                        this.spawnExplosion(e.x, e.y, e.z, 1.5);
                        this.killEntity(e.id);
                        this.enemies.splice(ei, 1);
                    }
                    break;
                }
            }
            if (hit) {
                this.killEntity(l.id);
                this.laserPool.splice(li, 1);
            }
        }

        // Enemy bullet → Player
        if (!isRolling) {
            for (var i = this.eBullets.length - 1; i >= 0; i--) {
                var b = this.eBullets[i];
                if (Math.abs(b.x - this.playerX) < 1.0 && Math.abs(b.z - SHIP_Z) < 1.5) {
                    this.shields -= 8;
                    this.spawnExplosion(this.playerX, SHIP_Y, SHIP_Z, 0.5);
                    this.killEntity(b.id);
                    this.eBullets.splice(i, 1);
                }
            }
        }

        // Enemy body → Player
        if (!isRolling) {
            for (var i = this.enemies.length - 1; i >= 0; i--) {
                var e = this.enemies[i];
                if (Math.abs(e.x - this.playerX) < 1.5 && Math.abs(e.z - SHIP_Z) < 2.0) {
                    this.shields -= 15;
                    this.spawnExplosion(e.x, e.y, e.z, 1.2);
                    this.killEntity(e.id);
                    this.enemies.splice(i, 1);
                    this.combo = 0;
                }
            }
        }
    },

    // ── BOSS ────────────────────────────────────────────────────────

    initBoss: function() {
        this.bossActive = true;
        this.bossCore = { hp: BOSS_HP_CORE };
        this.bossGunL = { hp: BOSS_HP_GUN };
        this.bossGunR = { hp: BOSS_HP_GUN };
        this.bossFireCD = BOSS_FIRE_RATE;
        this.bossX = 0;
        this.bossMoveTimer = 0;

        // Clear corridor enemies
        for (var i = this.enemies.length - 1; i >= 0; i--) this.killEntity(this.enemies[i].id);
        this.enemies = [];
        for (var i = this.eBullets.length - 1; i >= 0; i--) this.killEntity(this.eBullets[i].id);
        this.eBullets = [];

        // Create boss entities
        this.bossCoreId = this.makeEntity("sphere", COL.BOSS_CORE[0], COL.BOSS_CORE[1], COL.BOSS_CORE[2], 1);
        if (this.bossCoreId > 0) {
            this.es(this.bossCoreId, 2.5, 2.5, 2.5);
            this.ep(this.bossCoreId, 0, 2, BOSS_Z);
        }

        this.bossGunLId = this.makeEntity("cylinder", COL.BOSS_GUN[0], COL.BOSS_GUN[1], COL.BOSS_GUN[2], 1);
        if (this.bossGunLId > 0) {
            this.es(this.bossGunLId, 0.6, 1.5, 0.6);
            this.ep(this.bossGunLId, -5, 1.5, BOSS_Z);
        }

        this.bossGunRId = this.makeEntity("cylinder", COL.BOSS_GUN[0], COL.BOSS_GUN[1], COL.BOSS_GUN[2], 1);
        if (this.bossGunRId > 0) {
            this.es(this.bossGunRId, 0.6, 1.5, 0.6);
            this.ep(this.bossGunRId, 5, 1.5, BOSS_Z);
        }
    },

    updateBoss: function(dt) {
        this.bossMoveTimer += dt;
        this.bossX = Math.sin(this.bossMoveTimer * 0.8) * 5;

        if (this.bossCoreId > 0 && this.bossCore && this.bossCore.hp > 0) {
            this.ep(this.bossCoreId, this.bossX, 2, BOSS_Z);
            if (this.bossCore.hp < BOSS_HP_CORE / 2 && Math.sin(this.bossMoveTimer * 8) > 0) {
                Model3D.setColor(this.bossCoreId, 1, 0.3, 0.1, 1);
            } else {
                Model3D.setColor(this.bossCoreId, COL.BOSS_CORE[0], COL.BOSS_CORE[1], COL.BOSS_CORE[2], 1);
            }
        }
        if (this.bossGunLId > 0 && this.bossGunL && this.bossGunL.hp > 0) {
            this.ep(this.bossGunLId, this.bossX - 5, 1.5, BOSS_Z);
        }
        if (this.bossGunRId > 0 && this.bossGunR && this.bossGunR.hp > 0) {
            this.ep(this.bossGunRId, this.bossX + 5, 1.5, BOSS_Z);
        }

        // Fire
        this.bossFireCD -= dt;
        if (this.bossFireCD <= 0) {
            this.bossFireCD = BOSS_FIRE_RATE;
            if (this.bossCore && this.bossCore.hp > 0) {
                this.spawnEBullet(this.bossX, 2, BOSS_Z);
            }
            if (this.bossGunL && this.bossGunL.hp > 0) {
                var gl = this.makeEntity("sphere", COL.EBULLET[0], COL.EBULLET[1], COL.EBULLET[2], 1);
                if (gl > 0) {
                    this.es(gl, 0.15, 0.15, 0.15);
                    this.ep(gl, this.bossX - 5, 1.5, BOSS_Z);
                    this.eBullets.push({ id: gl, x: this.bossX - 5, y: 1.5, z: BOSS_Z, vx: -2, vz: 10 });
                }
            }
            if (this.bossGunR && this.bossGunR.hp > 0) {
                var gr = this.makeEntity("sphere", COL.EBULLET[0], COL.EBULLET[1], COL.EBULLET[2], 1);
                if (gr > 0) {
                    this.es(gr, 0.15, 0.15, 0.15);
                    this.ep(gr, this.bossX + 5, 1.5, BOSS_Z);
                    this.eBullets.push({ id: gr, x: this.bossX + 5, y: 1.5, z: BOSS_Z, vx: 2, vz: 10 });
                }
            }
        }

        // Destroy gun pods
        if (this.bossGunL && this.bossGunL.hp <= 0) {
            this.score += SCORE_BOSS_GUN;
            this.spawnExplosion(this.bossX - 5, 1.5, BOSS_Z, 2);
            this.bossGunL = null;
            if (this.bossGunLId > 0) { this.killEntity(this.bossGunLId); this.bossGunLId = -1; }
        }
        if (this.bossGunR && this.bossGunR.hp <= 0) {
            this.score += SCORE_BOSS_GUN;
            this.spawnExplosion(this.bossX + 5, 1.5, BOSS_Z, 2);
            this.bossGunR = null;
            if (this.bossGunRId > 0) { this.killEntity(this.bossGunRId); this.bossGunRId = -1; }
        }
    },

    checkBossHits: function() {
        for (var i = this.laserPool.length - 1; i >= 0; i--) {
            var l = this.laserPool[i];
            var hit = false;

            if (this.bossGunL && this.bossGunL.hp > 0) {
                if (Math.abs(l.x - (this.bossX - 5)) < 1.5 && Math.abs(l.z - BOSS_Z) < 2) {
                    this.bossGunL.hp--;
                    hit = true;
                }
            }
            if (!hit && this.bossGunR && this.bossGunR.hp > 0) {
                if (Math.abs(l.x - (this.bossX + 5)) < 1.5 && Math.abs(l.z - BOSS_Z) < 2) {
                    this.bossGunR.hp--;
                    hit = true;
                }
            }
            if (!hit && this.bossCore && this.bossCore.hp > 0) {
                var gunsAlive = (this.bossGunL ? 1 : 0) + (this.bossGunR ? 1 : 0);
                if (gunsAlive < 2) {
                    if (Math.abs(l.x - this.bossX) < 2 && Math.abs(l.z - BOSS_Z) < 2.5) {
                        this.bossCore.hp--;
                        hit = true;
                    }
                }
            }
            if (hit) {
                this.killEntity(l.id);
                this.laserPool.splice(i, 1);
            }
        }
    },

    // ── START ───────────────────────────────────────────────────────

    start: function(gs) {
        this.gs = gs;
        this.phase = "ready";
        this.timer = 6.0;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.shields = 100;
        this.bombs = BOMB_MAX;
        this.shootCD = 0;
        this.playerX = 0;
        this.barrelRollTimer = 0;
        this.barrelRollCD = 0;
        this.barrelRollDir = 0;
        this.lastTapDir = 0;
        this.lastTapTime = 0;
        this.corridorZ = 0;
        this.groundScrollV = 0;
        this.spawnTimer = 0;
        this.bombFlash = 0;
        this.allEntities = [];
        this.laserPool = [];
        this.enemies = [];
        this.eBullets = [];
        this.explosions = [];
        this.bossActive = false;
        this.bossCore = null;
        this.bossGunL = null;
        this.bossGunR = null;
        this.bossCoreId = -1;
        this.bossGunLId = -1;
        this.bossGunRId = -1;

        this.setupCamera();
        this.createShip();
        this.createStarfield();
        this.createGround();

        var track = Math.random() < 0.5 ? MUSIC.STARFOX_1 : MUSIC.STARFOX_2;
        Audio.playMusic(track, true);
    },

    // ── CLEANUP ─────────────────────────────────────────────────────

    cleanup: function() {
        for (var i = this.allEntities.length - 1; i >= 0; i--) {
            GameObject.destroy(this.allEntities[i]);
        }
        this.allEntities = [];
        this.shipBody = -1;
        this.shipWingL = -1;
        this.shipWingR = -1;
        this.shipEngine = -1;
        this.groundId = -1;
        this.starData = [];
        this.laserPool = [];
        this.enemies = [];
        this.eBullets = [];
        this.explosions = [];
        this.bossCoreId = -1;
        this.bossGunLId = -1;
        this.bossGunRId = -1;
        this.revertCamera();
    },

    // ── UPDATE ──────────────────────────────────────────────────────

    update: function(dt) {
        this.timer -= dt;
        this.updateStarfield(dt);
        this.updateGround(dt);
        this.updateExplosions(dt);
        if (this.bombFlash > 0) this.bombFlash -= dt * 3;

        switch (this.phase) {
            case "ready":
                this.updateShipPos();
                if (this.timer <= 0) {
                    this.phase = "corridor";
                    this.timer = CORRIDOR_DURATION;
                    this.spawnTimer = 1.0;
                }
                return null;

            case "corridor":
                this.updatePlayer(dt);
                this.updateLasers(dt);
                this.updateEnemies(dt);
                this.updateEBullets(dt);
                this.checkCollisions();
                this.corridorZ += 15 * dt;

                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    this.spawnWave();
                    var elapsed = CORRIDOR_DURATION - this.timer;
                    var interval = Math.max(SPAWN_INTERVAL_MIN,
                        SPAWN_INTERVAL_BASE - elapsed * 0.008);
                    this.spawnTimer = interval;
                }

                if (this.timer <= 0) {
                    this.phase = "boss";
                    this.timer = 0;
                    this.initBoss();
                }
                if (this.shields <= 0) {
                    this.phase = "results";
                    this.timer = GAME_OVER_DELAY;
                }
                return null;

            case "boss":
                this.updatePlayer(dt);
                this.updateLasers(dt);
                this.updateBoss(dt);
                this.updateEBullets(dt);
                this.checkCollisions();
                this.checkBossHits();

                if (this.bossCore && this.bossCore.hp <= 0) {
                    this.score += SCORE_BOSS_CORE;
                    this.spawnExplosion(this.bossX, 2, BOSS_Z, 4);
                    this.spawnExplosion(this.bossX - 3, 2, BOSS_Z + 1, 3);
                    this.spawnExplosion(this.bossX + 3, 2, BOSS_Z - 1, 3);
                    this.bossCore = null;
                    if (this.bossCoreId > 0) { this.killEntity(this.bossCoreId); this.bossCoreId = -1; }
                    if (this.bossGunLId > 0) { this.killEntity(this.bossGunLId); this.bossGunLId = -1; }
                    if (this.bossGunRId > 0) { this.killEntity(this.bossGunRId); this.bossGunRId = -1; }
                    this.phase = "results";
                    this.timer = GAME_OVER_DELAY;
                }
                if (this.shields <= 0) {
                    this.phase = "results";
                    this.timer = GAME_OVER_DELAY;
                }
                return null;

            case "results":
                if (this.timer <= 0 && (Input.getKeyDown("Return") || Input.getKeyDown("Space"))) {
                    var cashWon = Math.floor(this.score * 0.5);
                    this.cleanup();
                    return { done: true, cashWon: cashWon, score: this.score };
                }
                return null;
        }
        return null;
    },

    // ── PLAYER INPUT ────────────────────────────────────────────────

    updatePlayer: function(dt) {
        // Left/right only
        var dx = 0;
        if (Input.getKey("Left") || Input.getKey("a")) dx = -1;
        if (Input.getKey("Right") || Input.getKey("d")) dx = 1;
        this.playerX += dx * PLAYER_SPEED * dt;
        this.playerX = Math.max(-PLAYER_X_LIMIT, Math.min(PLAYER_X_LIMIT, this.playerX));

        // Barrel roll — double-tap
        if (this.barrelRollCD > 0) this.barrelRollCD -= dt;
        if (this.barrelRollTimer > 0) this.barrelRollTimer -= dt;
        var now = Time.getTime();
        if (Input.getKeyDown("Left") || Input.getKeyDown("a")) {
            if (this.lastTapDir === -1 && (now - this.lastTapTime) < 0.3 && this.barrelRollCD <= 0) {
                this.barrelRollTimer = BARREL_ROLL_DUR;
                this.barrelRollCD = BARREL_ROLL_CD;
                this.barrelRollDir = -1;
            }
            this.lastTapDir = -1;
            this.lastTapTime = now;
        }
        if (Input.getKeyDown("Right") || Input.getKeyDown("d")) {
            if (this.lastTapDir === 1 && (now - this.lastTapTime) < 0.3 && this.barrelRollCD <= 0) {
                this.barrelRollTimer = BARREL_ROLL_DUR;
                this.barrelRollCD = BARREL_ROLL_CD;
                this.barrelRollDir = 1;
            }
            this.lastTapDir = 1;
            this.lastTapTime = now;
        }

        this.updateShipPos();

        // Shoot
        this.shootCD -= dt;
        if ((Input.getKey("Space") || Input.getKey("z")) && this.shootCD <= 0) {
            this.shootCD = SHOOT_COOLDOWN;
            this.shootLaser();
        }

        // Bomb
        if ((Input.getKeyDown("Return") || Input.getKeyDown("x")) && this.bombs > 0) {
            this.bombs--;
            this.bombFlash = 1.0;
            for (var i = this.enemies.length - 1; i >= 0; i--) {
                this.score += SCORE_FIGHTER;
                this.spawnExplosion(this.enemies[i].x, this.enemies[i].y, this.enemies[i].z, 1.5);
                this.killEntity(this.enemies[i].id);
            }
            this.enemies = [];
            for (var i = this.eBullets.length - 1; i >= 0; i--) this.killEntity(this.eBullets[i].id);
            this.eBullets = [];
            if (this.bossCore && this.bossCore.hp > 0) this.bossCore.hp -= 5;
            if (this.bossGunL && this.bossGunL.hp > 0) this.bossGunL.hp -= 5;
            if (this.bossGunR && this.bossGunR.hp > 0) this.bossGunR.hp -= 5;
        }
    },

    // ── DRAW (HUD overlay only — 3D entities render automatically) ──

    draw: function(screenW, screenH) {
        var sw = screenW;
        var sh = screenH;

        Model3D.render();
        if (this.bombFlash > 0) {
            Draw2D.fillRect(0, 0, sw, sh, 1, 1, 1, this.bombFlash * 0.6);
        }

        switch (this.phase) {
            case "ready":
                this.drawReadyUI(sw, sh);
                break;
            case "corridor":
            case "boss":
                this.drawHUD(sw, sh);
                this.drawCrosshair(sw, sh);
                if (this.phase === "corridor" && this.timer < 5) {
                    var warn = Math.sin(this.timer * 8) > 0 ? 1 : 0;
                    if (warn) {
                        Draw2D.drawTextAligned(sw / 2, sh * 0.4, "WARNING", "center",
                            1, 0.2, 0.2, 1, F.TITLE_BIG);
                        Draw2D.drawTextAligned(sw / 2, sh * 0.4 + 22, "BOSS APPROACHING", "center",
                            1, 0.4, 0.2, 0.8, F.BODY);
                    }
                }
                // Boss HP bar (Draw2D overlay)
                if (this.bossActive && this.bossCore && this.bossCore.hp > 0) {
                    var bHp = this.bossCore.hp / BOSS_HP_CORE;
                    var bW = sw * 0.3;
                    Draw2D.fillRect(sw / 2 - bW / 2, 40, bW, 6, 0.15, 0.15, 0.15, 0.7);
                    Draw2D.fillRect(sw / 2 - bW / 2, 40, bW * bHp, 6,
                        bHp > 0.3 ? 0.8 : 1, bHp > 0.3 ? 0.2 : 0.1, 0.1, 0.9);
                    Draw2D.drawTextAligned(sw / 2, 50, "BOSS", "center", 0.6, 0.3, 0.3, 0.7, F.TINY);
                }
                break;
            case "results":
                this.drawResultsUI(sw, sh);
                break;
        }
    },

    drawCrosshair: function(sw, sh) {
        var cx = this.playerX * XMUL + SCR_CX;
        var cy = sh - SCR_BY;
        Draw2D.drawLine(cx - 12, cy, cx + 12, cy, 0.8, 0.8, 0.8, 0.4, 1);
        Draw2D.drawLine(cx, cy - 12, cx, cy + 12, 0.8, 0.8, 0.8, 0.4, 1);
        Draw2D.drawCircle(cx, cy, 18, 0.8, 0.8, 0.8, 0.2, 16, 1);
    },

    drawHUD: function(sw, sh) {
        var barW = 80;
        var barH = 8;
        var hpFrac = Math.max(0, this.shields / 100);
        var hpCol = hpFrac > 0.3 ? COL.HUD_HP : COL.HUD_LOW;
        Draw2D.fillRect(10, 10, barW, barH, 0.15, 0.15, 0.15, 0.8);
        Draw2D.fillRect(10, 10, barW * hpFrac, barH, hpCol[0], hpCol[1], hpCol[2], 0.9);
        Draw2D.drawRect(10, 10, barW, barH, 0.5, 0.5, 0.5, 0.6, 1);
        Draw2D.drawText(10, 22, "SHIELDS", 0.5, 0.5, 0.5, 0.7, F.TINY);

        for (var i = 0; i < this.bombs; i++) {
            Draw2D.drawCircle(sw - 16 - i * 14, 14, 5, COL.BOMB_COL[0], COL.BOMB_COL[1], COL.BOMB_COL[2], 0.9);
        }
        Draw2D.drawText(sw - 16 - (BOMB_MAX - 1) * 14, 24, "BOMBS", 0.5, 0.5, 0.5, 0.7, F.TINY);

        Draw2D.drawTextAligned(sw / 2, 10, "SCORE " + this.score, "center", 1, 1, 1, 0.9, F.BODY);
        if (this.combo > 2) {
            Draw2D.drawTextAligned(sw / 2, 26, this.combo + " HIT COMBO!", "center",
                1, 0.8, 0.2, 0.8, F.TINY);
        }
    },

    drawReadyUI: function(sw, sh) {
        Draw2D.fillRect(0, 0, sw, sh * 0.15, 0, 0, 0, 0.5);
        Draw2D.drawTextAligned(sw / 2, sh * 0.03, "TAHTIALUS", "center",
            0.3, 0.6, 1.0, 1, F.TITLE_BIG);
        Draw2D.drawTextAligned(sw / 2, sh * 0.03 + 24, "Star Fox 3D", "center",
            0.5, 0.5, 0.5, 0.7, F.BODY);

        Draw2D.fillRect(sw * 0.2, sh * 0.4, sw * 0.6, sh * 0.3, 0, 0, 0, 0.6);
        Draw2D.drawTextAligned(sw / 2, sh * 0.43, "A/D or Arrows = Steer", "center",
            0.7, 0.7, 0.7, 0.8, F.SMALL);
        Draw2D.drawTextAligned(sw / 2, sh * 0.43 + 16, "Space / Z = Shoot", "center",
            0.7, 0.7, 0.7, 0.8, F.SMALL);
        Draw2D.drawTextAligned(sw / 2, sh * 0.43 + 32, "Enter / X = Bomb (" + BOMB_MAX + "x)", "center",
            0.7, 0.7, 0.7, 0.8, F.SMALL);
        Draw2D.drawTextAligned(sw / 2, sh * 0.43 + 48, "Double-tap L/R = Barrel Roll", "center",
            0.7, 0.7, 0.7, 0.8, F.SMALL);

        var cd = Math.ceil(this.timer);
        if (cd > 0) {
            Draw2D.drawTextAligned(sw / 2, sh * 0.8, "" + cd, "center",
                1, 1, 0.3, 1.0, F.TITLE_XL);
        }
    },

    drawResultsUI: function(sw, sh) {
        var won = this.shields > 0;
        var cashWon = Math.floor(this.score * 0.5);

        Draw2D.fillRect(sw * 0.1, sh * 0.15, sw * 0.8, sh * 0.65, 0.02, 0.02, 0.08, 0.92);
        Draw2D.drawRect(sw * 0.1, sh * 0.15, sw * 0.8, sh * 0.65, 0.3, 0.5, 0.9, 0.7, 2);

        if (won) {
            Draw2D.drawTextAligned(sw / 2, sh * 0.2, "MISSION COMPLETE", "center",
                0.3, 1, 0.3, 1, F.HEADING);
        } else {
            Draw2D.drawTextAligned(sw / 2, sh * 0.2, "MISSION FAILED", "center",
                1, 0.3, 0.3, 1, F.HEADING);
        }

        var ty = sh * 0.35;
        Draw2D.drawText(sw * 0.18, ty, "Score:", 0.7, 0.7, 0.7, 0.9, F.BODY);
        Draw2D.drawText(sw * 0.62, ty, "" + this.score, 1, 1, 0.5, 1, F.BODY);
        ty += 20;
        Draw2D.drawText(sw * 0.18, ty, "Max Combo:", 0.7, 0.7, 0.7, 0.9, F.BODY);
        Draw2D.drawText(sw * 0.62, ty, "" + this.maxCombo, 1, 0.8, 0.3, 1, F.BODY);
        ty += 20;
        Draw2D.drawText(sw * 0.18, ty, "Cash Won:", 0.7, 0.7, 0.7, 0.9, F.BODY);
        Draw2D.drawText(sw * 0.62, ty, cashWon + " FIM", 0.3, 1, 0.3, 1, F.BODY);
        ty += 20;
        Draw2D.drawText(sw * 0.18, ty, "Shields:", 0.7, 0.7, 0.7, 0.9, F.BODY);
        Draw2D.drawText(sw * 0.62, ty, (this.shields > 0 ? this.shields + "%" : "DESTROYED"),
            this.shields > 0 ? 0.3 : 1, this.shields > 0 ? 0.8 : 0.2, this.shields > 0 ? 0.3 : 0.2, 1, F.BODY);

        if (this.timer <= 0) {
            Draw2D.drawTextAligned(sw / 2, sh * 0.72, "[ENTER] Continue", "center",
                0.4, 0.6, 0.4, 0.7 + Math.sin(Time.getTime() * 4) * 0.3, F.BODY);
        }
    }
};

module.exports = StarfoxSystem;
