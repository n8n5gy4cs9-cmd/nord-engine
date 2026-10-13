//! Angry Touch — slingshot-and-physics game in the Nord Rust runtime (macroquad + rapier2d), playable by mouse, touch or keys.
//! Original code and art; the genre (Angry Birds / Apple Flinger style) is the only thing borrowed. Aiming works three ways, all
//! feeding the same `off` vector: drag the bird (mouse / finger), or arrows + Space (what `nord-touch.js` sends from its on-screen pad).
use nord_runtime_wasm::macroquad::prelude::*;
use nord_runtime_wasm::serde_json::json;
use nord_runtime_wasm::{launch, Attrs, Ctx, EntityId, Registry, Script};
use std::sync::atomic::{AtomicU32, AtomicUsize, Ordering};

const ANCHOR: Vec2 = Vec2::new(270.0, 372.0); // where the bird sits in the sling
const MAX_PULL: f32 = 95.0;
const LAUNCH_K: f32 = 9.5; // px/s of launch speed per px of pull
const GROUND_TOP: f32 = 480.0;
const GRAVITY: f32 = 980.0;
const BIRD: &str = "prefabs/bird.prefab.json";

// survives `ctx.restart()` (which rebuilds every script)
static LEVEL: AtomicUsize = AtomicUsize::new(0);
static SCORE: AtomicU32 = AtomicU32::new(0);

/// (kind, x, y-of-centre-above-ground-top-is-computed, w, h): w=wood, s=stone, i=ice, p=pig. `y` is the *bottom* edge height above the ground.
struct Piece(char, f32, f32, f32, f32);
struct Level {
    shots: i32,
    pieces: Vec<Piece>,
}
fn levels() -> Vec<Level> {
    use Piece as P;
    vec![
        Level { shots: 4, pieces: vec![P('w', 640.0, 0.0, 20.0, 80.0), P('w', 720.0, 0.0, 20.0, 80.0), P('w', 680.0, 80.0, 130.0, 16.0), P('p', 680.0, 0.0, 34.0, 34.0), P('p', 680.0, 96.0, 34.0, 34.0)] },
        Level {
            shots: 4,
            pieces: vec![
                P('s', 600.0, 0.0, 22.0, 90.0), P('s', 700.0, 0.0, 22.0, 90.0), P('w', 650.0, 90.0, 140.0, 16.0),
                P('w', 760.0, 0.0, 20.0, 70.0), P('w', 840.0, 0.0, 20.0, 70.0), P('i', 800.0, 70.0, 110.0, 16.0),
                P('p', 650.0, 0.0, 34.0, 34.0), P('p', 800.0, 0.0, 34.0, 34.0), P('p', 650.0, 106.0, 34.0, 34.0),
            ],
        },
        Level {
            shots: 5,
            pieces: vec![
                P('i', 600.0, 0.0, 18.0, 70.0), P('i', 660.0, 0.0, 18.0, 70.0), P('i', 720.0, 0.0, 18.0, 70.0), P('s', 660.0, 70.0, 160.0, 16.0),
                P('w', 620.0, 86.0, 18.0, 60.0), P('w', 700.0, 86.0, 18.0, 60.0), P('w', 660.0, 146.0, 110.0, 16.0),
                P('p', 630.0, 0.0, 34.0, 34.0), P('p', 690.0, 0.0, 34.0, 34.0), P('p', 660.0, 162.0, 34.0, 34.0),
                P('s', 820.0, 0.0, 40.0, 110.0), P('p', 880.0, 0.0, 34.0, 34.0),
            ],
        },
    ]
}

#[derive(PartialEq, Clone, Copy)]
enum Phase {
    Aim,
    Flying,
    Settle(f32),
    Won,
    Lost,
}

struct Game {
    phase: Phase,
    shots: i32,
    off: Vec2, // bird offset from ANCHOR while aiming (pointing *back*, away from the target)
    dragging: bool,
    ammo: Option<EntityId>,
    dots: Vec<EntityId>,
    bands: Vec<EntityId>,
    t_sim: f32,
}

impl Game {
    fn pull_to_off(angle_deg: f32, power: f32) -> Vec2 {
        let a = angle_deg.to_radians();
        -vec2(a.cos(), -a.sin()) * power * MAX_PULL
    }
    fn hud(&self, ctx: &mut Ctx, msg: &str) {
        let set = |ctx: &mut Ctx, name: &str, t: &str| {
            if let Some(id) = ctx.find(name) {
                ctx.set_text(id, t);
            }
        };
        let total = levels().len();
        set(ctx, "Score", &format!("Score {}", SCORE.load(Ordering::Relaxed)));
        set(ctx, "Shots", &format!("Birds left {}", self.shots));
        set(ctx, "Level", &format!("Level {}/{}", LEVEL.load(Ordering::Relaxed) + 1, total));
        set(ctx, "Msg", msg);
    }
    fn build_level(&self, ctx: &mut Ctx) {
        let lv = &levels()[LEVEL.load(Ordering::Relaxed).min(levels().len() - 1)];
        for p in &lv.pieces {
            let Piece(kind, x, base, w, h) = *p;
            let cy = GROUND_TOP - base - h / 2.0 - 1.0;
            let (tex, hp, tough) = match kind {
                'w' => ("wood", 380.0, 110.0),
                's' => ("stone", 1500.0, 220.0),
                'i' => ("ice", 140.0, 60.0),
                _ => ("pig", 130.0, 70.0),
            };
            let path = if kind == 'p' { "prefabs/pig.prefab.json" } else { "prefabs/block.prefab.json" };
            let (cw, ch) = (w, h);
            let mut ov = json!({ "scripts": { "0": { "attributes": { "hp": hp, "tough": tough, "pig": kind == 'p', "value": if kind == 'p' { 500.0 } else { 50.0 } } } } });
            if kind == 'p' {
                ov["components"] = json!({ "0": { "size": [w + 4.0, h + 4.0] }, "2": { "radius": w / 2.0 } });
            } else {
                ov["components"] = json!({ "0": { "texture": format!("assets/sprites/{tex}.png"), "size": [cw, ch] }, "2": { "size": [cw, ch] } });
            }
            ctx.spawn_prefab_with(path, vec2(x, cy), ov);
        }
    }
    fn load_bird(&mut self, ctx: &mut Ctx) {
        if self.ammo.is_none() {
            self.ammo = ctx.spawn_prefab("prefabs/ammo.prefab.json", ANCHOR);
        }
        self.off = Self::pull_to_off(40.0, 0.6);
        self.phase = Phase::Aim;
    }
    fn show_aim(&mut self, ctx: &mut Ctx, on: bool) {
        for &d in self.dots.iter().chain(self.bands.iter()) {
            ctx.set_enabled(d, on);
        }
        if let Some(a) = self.ammo {
            ctx.set_enabled(a, on);
        }
    }
    fn draw_aim(&mut self, ctx: &mut Ctx) {
        let bird = ANCHOR + self.off;
        if let Some(a) = self.ammo {
            ctx.set_pos_of(a, bird);
        }
        // rubber bands from the two fork tips to the bird
        for (i, &b) in self.bands.iter().enumerate() {
            let from = ANCHOR + vec2(if i == 0 { -9.0 } else { 9.0 }, -8.0);
            let d = bird - from;
            ctx.set_pos_of(b, from + d / 2.0);
            ctx.set_rotation_of(b, d.y.atan2(d.x).to_degrees());
            ctx.set_scale(b, vec2(d.length(), 1.0));
        }
        // predicted path (same gravity as the physics world)
        let v = -self.off * LAUNCH_K;
        for (i, &dot) in self.dots.iter().enumerate() {
            let t = (i as f32 + 1.0) * 0.07;
            ctx.set_pos_of(dot, bird + v * t + vec2(0.0, 0.5 * GRAVITY * t * t));
        }
    }
    fn launch(&mut self, ctx: &mut Ctx) {
        let v = -self.off * LAUNCH_K;
        let p = ANCHOR + self.off;
        ctx.spawn_prefab_with(BIRD, p, json!({ "scripts": { "0": { "attributes": { "vx": v.x, "vy": v.y } } } }));
        ctx.play("assets/audio/sfx/laser.wav", 0.4);
        self.shots -= 1;
        self.show_aim(ctx, false);
        self.dragging = false;
        self.t_sim = 0.0;
        self.phase = Phase::Flying;
    }
}

impl Script for Game {
    fn start(&mut self, ctx: &mut Ctx) {
        let lv = &levels()[LEVEL.load(Ordering::Relaxed).min(levels().len() - 1)];
        self.shots = lv.shots;
        self.build_level(ctx);
        for _ in 0..14 {
            if let Some(d) = ctx.spawn_prefab("prefabs/dot.prefab.json", Vec2::ZERO) {
                self.dots.push(d);
            }
        }
        for _ in 0..2 {
            if let Some(b) = ctx.spawn_prefab("prefabs/band.prefab.json", Vec2::ZERO) {
                self.bands.push(b);
            }
        }
        self.load_bird(ctx);
        self.hud(ctx, "");
    }

    fn update(&mut self, ctx: &mut Ctx, dt: f32) {
        if ctx.input().pressed("restart") {
            if self.phase == Phase::Won {
                // replay the same level from scratch
            }
            ctx.restart();
            return;
        }
        let pigs = ctx.find_tag("pig").len();
        match self.phase {
            Phase::Aim => {
                let (ptr, down) = (ctx.input().pointer, ctx.input().pointer_down);
                // no press-edge test: on touch screens the pointer position can arrive a frame after the press
                if down && !self.dragging && (ptr - (ANCHOR + self.off)).length() < 70.0 {
                    self.dragging = true;
                }
                if self.dragging {
                    if down {
                        let d = ptr - ANCHOR;
                        self.off = if d.length() > MAX_PULL { d.normalize() * MAX_PULL } else { d };
                    } else {
                        self.dragging = false;
                        if self.off.length() > 18.0 {
                            self.launch(ctx);
                            return;
                        }
                        self.off = Self::pull_to_off(40.0, 0.6);
                    }
                } else {
                    // keyboard / on-screen pad: left-right = angle, up-down = power, Space = fire
                    let inp = ctx.input();
                    let (turn, push) = (inp.axis("left", "right"), inp.axis("down", "up"));
                    let cur = -self.off;
                    let mut ang = cur.y.atan2(-cur.x).to_degrees(); // atan2(up, right)
                    let mut pow = cur.length() / MAX_PULL;
                    ang = (ang + turn * 55.0 * dt).clamp(5.0, 80.0);
                    pow = (pow + push * 0.8 * dt).clamp(0.2, 1.0);
                    if turn != 0.0 || push != 0.0 {
                        self.off = Self::pull_to_off(ang, pow);
                    }
                    if ctx.input().pressed("fire") {
                        self.launch(ctx);
                        return;
                    }
                }
                self.show_aim(ctx, true);
                self.draw_aim(ctx);
                self.hud(ctx, "");
            }
            Phase::Flying => {
                self.t_sim += dt;
                if pigs == 0 {
                    self.phase = Phase::Settle(1.2);
                } else if ctx.find_tag("bird").is_empty() && self.t_sim > 0.3 {
                    self.phase = Phase::Settle(1.0);
                }
                self.hud(ctx, "");
            }
            Phase::Settle(t) => {
                let t = t - dt;
                if t > 0.0 {
                    self.phase = Phase::Settle(t);
                } else if pigs == 0 {
                    let bonus = self.shots.max(0) as u32 * 1000;
                    SCORE.fetch_add(bonus, Ordering::Relaxed);
                    self.phase = Phase::Won;
                    let last = LEVEL.load(Ordering::Relaxed) + 1 >= levels().len();
                    self.hud(ctx, if last { "All levels clear!  R = start over" } else { "Level clear!  Enter = next level" });
                    ctx.play("assets/audio/sfx/explosion.wav", 0.5);
                } else if self.shots <= 0 {
                    self.phase = Phase::Lost;
                    self.hud(ctx, "Out of birds — R to retry");
                } else {
                    self.load_bird(ctx);
                }
            }
            Phase::Won => {
                if ctx.input().pressed("next") || ctx.input().pointer_pressed() {
                    let n = LEVEL.load(Ordering::Relaxed) + 1;
                    if n >= levels().len() {
                        LEVEL.store(0, Ordering::Relaxed);
                        SCORE.store(0, Ordering::Relaxed);
                    } else {
                        LEVEL.store(n, Ordering::Relaxed);
                    }
                    ctx.restart();
                }
            }
            Phase::Lost => {
                if ctx.input().pointer_pressed() {
                    ctx.restart();
                }
            }
        }
    }

    fn on_event(&mut self, ctx: &mut Ctx, name: &str, value: f32) {
        if name == "score" {
            SCORE.fetch_add(value as u32, Ordering::Relaxed);
        }
        let _ = ctx;
    }
}

/// Blocks and pigs: take "damage" from sudden velocity changes (= impacts), pop when the hit points run out.
struct Hurtable {
    hp: f32,
    tough: f32,
    pig: bool,
    value: f32,
    prev: Vec2,
    age: f32,
}
impl Script for Hurtable {
    fn fixed_update(&mut self, ctx: &mut Ctx, dt: f32) {
        self.age += dt;
        let v = ctx.velocity();
        if self.age > 1.2 {
            let dv = (v - self.prev).length();
            if dv > self.tough {
                self.hp -= dv - self.tough;
                if self.hp > 0.0 {
                    ctx.play("assets/audio/sfx/hit.wav", (dv / 900.0).clamp(0.05, 0.35));
                }
            }
        }
        self.prev = v;
        if self.hp <= 0.0 || ctx.pos().y > 700.0 {
            if self.hp <= 0.0 {
                ctx.emit("score", self.value);
                ctx.camera_shake(if self.pig { 3.0 } else { 1.5 }, 0.15);
                ctx.play("assets/audio/sfx/explosion.wav", if self.pig { 0.35 } else { 0.15 });
            }
            ctx.destroy_self();
        }
    }
}

/// The flying bird: velocity comes from its `vx`/`vy` attributes; disappears once it has come to rest (or flown away).
struct Bird {
    vel: Vec2,
    age: f32,
    rest: f32,
}
impl Script for Bird {
    fn start(&mut self, ctx: &mut Ctx) {
        ctx.set_velocity(Some(self.vel.x), Some(self.vel.y));
    }
    fn fixed_update(&mut self, ctx: &mut Ctx, dt: f32) {
        self.age += dt;
        self.rest = if ctx.velocity().length() < 40.0 { self.rest + dt } else { 0.0 };
        let p = ctx.pos();
        if self.rest > 1.0 || self.age > 12.0 || p.x > 1200.0 || p.y > 700.0 {
            ctx.destroy_self();
        }
    }
}

fn main() {
    launch(
        Registry::new()
            .register("game", |_: &Attrs| Box::new(Game { phase: Phase::Aim, shots: 0, off: Vec2::ZERO, dragging: false, ammo: None, dots: vec![], bands: vec![], t_sim: 0.0 }))
            .register("bird", |a: &Attrs| Box::new(Bird { vel: vec2(a.f32("vx", 0.0), a.f32("vy", 0.0)), age: 0.0, rest: 0.0 }))
            .register("block", |a: &Attrs| {
                Box::new(Hurtable { hp: a.f32("hp", 300.0), tough: a.f32("tough", 100.0), pig: a.bool("pig", false), value: a.f32("value", 50.0), prev: Vec2::ZERO, age: 0.0 })
            })
            .prefab(BIRD)
            .prefab("prefabs/block.prefab.json")
            .prefab("prefabs/pig.prefab.json")
            .prefab("prefabs/ammo.prefab.json")
            .prefab("prefabs/dot.prefab.json")
            .prefab("prefabs/band.prefab.json"),
    );
}
