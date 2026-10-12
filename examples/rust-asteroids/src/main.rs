//! Asteroids in the Nord Rust runtime: no physics engine, plain vector maths in `Script`s, prefabs for bullets and rocks.
use nord_runtime_wasm::macroquad::prelude::*;
use nord_runtime_wasm::serde_json::json;
use nord_runtime_wasm::{launch, Attrs, Ctx, Registry, Script};

const W: f32 = 640.0;
const H: f32 = 360.0;
const BASE_RADIUS: f32 = 24.0; // ring.png drawn at 48 px for scale 1.0

fn wrap(p: Vec2, margin: f32) -> Vec2 {
    vec2((p.x + margin).rem_euclid(W + 2.0 * margin) - margin, (p.y + margin).rem_euclid(H + 2.0 * margin) - margin)
}

/// Spawns the first wave, counts score and restarts after game over.
struct Game {
    rocks: i32,
    score: u32,
}
impl Script for Game {
    fn start(&mut self, ctx: &mut Ctx) {
        for i in 0..self.rocks {
            let a = i as f32 / self.rocks as f32 * std::f32::consts::TAU;
            ctx.spawn_prefab("prefabs/rock.prefab.json", vec2(W / 2.0, H / 2.0) + vec2(a.cos(), a.sin()) * 150.0);
        }
    }
    fn update(&mut self, ctx: &mut Ctx, _dt: f32) {
        if ctx.input().pressed("restart") {
            ctx.restart();
        }
        if ctx.find_tag("rock").is_empty() {
            self.rocks += 1;
            self.start(ctx); // next, bigger wave
        }
    }
    fn on_event(&mut self, ctx: &mut Ctx, name: &str, value: f32) {
        match name {
            "score" => {
                self.score += value as u32;
                if let Some(l) = ctx.find("Score") {
                    ctx.set_text(l, &format!("Score {}", self.score));
                }
            }
            "dead" => {
                if let Some(l) = ctx.find("Score") {
                    ctx.set_text(l, &format!("Game over — score {} — press R", self.score));
                }
            }
            _ => {}
        }
    }
}

struct Ship {
    turn: f32,
    thrust: f32,
    vel: Vec2,
    cooldown: f32,
    dead: bool,
}
impl Script for Ship {
    fn update(&mut self, ctx: &mut Ctx, dt: f32) {
        if self.dead {
            return;
        }
        let me = ctx.id;
        let rot = ctx.rotation() + ctx.input().axis("left", "right") * self.turn * dt;
        ctx.set_rotation(rot);
        let dir = vec2(rot.to_radians().sin(), -rot.to_radians().cos()); // 0° = up
        if ctx.input().down("thrust") {
            self.vel += dir * self.thrust * dt;
        }
        self.vel *= 1.0 - 0.4 * dt;
        let p = wrap(ctx.pos() + self.vel * dt, 10.0);
        ctx.set_pos(p);
        self.cooldown -= dt;
        if ctx.input().down("fire") && self.cooldown <= 0.0 {
            self.cooldown = 0.2;
            let v = dir * 420.0 + self.vel;
            ctx.spawn_prefab_with(
                "prefabs/bullet.prefab.json",
                p + dir * 16.0,
                json!({ "transform": { "rot": [0, 0, dir.y.atan2(dir.x).to_degrees()] }, "scripts": { "0": { "attributes": { "vx": v.x, "vy": v.y } } } }),
            );
            ctx.play("assets/audio/sfx/laser.wav", 0.3);
        }
        for r in ctx.find_tag("rock") {
            let rad = BASE_RADIUS * ctx.scale_of(r).x + 8.0;
            if (ctx.pos_of(r) - p).length() < rad {
                self.dead = true;
                ctx.play("assets/audio/sfx/explosion.wav", 0.6);
                ctx.camera_shake(6.0, 0.5);
                ctx.set_enabled(me, false);
                ctx.emit("dead", 0.0);
            }
        }
    }
}

/// Bullet: flies straight (velocity comes from its `vx`/`vy` attributes), wraps, dies after 1 s or on hitting a rock (which splits).
struct Bullet {
    vel: Vec2,
    ttl: f32,
}
impl Script for Bullet {
    fn update(&mut self, ctx: &mut Ctx, dt: f32) {
        self.ttl -= dt;
        let p = wrap(ctx.pos() + self.vel * dt, 4.0);
        ctx.set_pos(p);
        if self.ttl <= 0.0 {
            ctx.destroy_self();
            return;
        }
        for r in ctx.find_tag("rock") {
            let s = ctx.scale_of(r).x;
            if (ctx.pos_of(r) - p).length() < BASE_RADIUS * s {
                let rp = ctx.pos_of(r);
                ctx.destroy(r);
                ctx.destroy_self();
                ctx.emit("score", (60.0 / s).round());
                ctx.play("assets/audio/sfx/hit.wav", 0.4);
                if s > 0.4 {
                    for k in 0..2 {
                        let a = ctx.rand() * std::f32::consts::TAU + k as f32 * 3.1;
                        let v = vec2(a.cos(), a.sin()) * (50.0 / s.max(0.3)).min(160.0);
                        let ns = s * 0.55;
                        ctx.spawn_prefab_with("prefabs/rock.prefab.json", rp, json!({ "transform": { "scale": [ns, ns, 1] }, "scripts": { "0": { "attributes": { "vx": v.x, "vy": v.y } } } }));
                    }
                }
                return;
            }
        }
    }
}

struct Rock {
    vel: Vec2,
    spin: f32,
}
impl Script for Rock {
    fn start(&mut self, ctx: &mut Ctx) {
        if self.vel == Vec2::ZERO {
            let a = ctx.rand() * std::f32::consts::TAU;
            self.vel = vec2(a.cos(), a.sin()) * ctx.rand_range(20.0, 60.0);
        }
        self.spin = ctx.rand_range(-60.0, 60.0);
    }
    fn update(&mut self, ctx: &mut Ctx, dt: f32) {
        let p = wrap(ctx.pos() + self.vel * dt, 30.0);
        ctx.set_pos(p);
        let r = ctx.rotation() + self.spin * dt;
        ctx.set_rotation(r);
    }
}

fn main() {
    launch(
        Registry::new()
            .register("game", |a: &Attrs| Box::new(Game { rocks: a.i32("rocks", 5), score: 0 }))
            .register("ship", |a: &Attrs| Box::new(Ship { turn: a.f32("turn", 220.0), thrust: a.f32("thrust", 260.0), vel: Vec2::ZERO, cooldown: 0.0, dead: false }))
            .register("bullet", |a: &Attrs| Box::new(Bullet { vel: vec2(a.f32("vx", 0.0), a.f32("vy", -400.0)), ttl: 1.0 }))
            .register("rock", |a: &Attrs| Box::new(Rock { vel: vec2(a.f32("vx", 0.0), a.f32("vy", 0.0)), spin: 0.0 }))
            .prefab("prefabs/bullet.prefab.json")
            .prefab("prefabs/rock.prefab.json"),
    );
}
