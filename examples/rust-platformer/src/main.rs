//! Rust platformer: the same assets/level as `examples/conformance-2d`, with player + enemy written as Rust `Script`s.
use nord_runtime_wasm::macroquad::prelude::*;
use nord_runtime_wasm::{launch, Attrs, Ctx, EntityId, Registry, Script};

struct Player {
    speed: f32,
    jump: f32,
    coins: u32,
    lives_invuln: f32,
}

impl Script for Player {
    fn fixed_update(&mut self, ctx: &mut Ctx, dt: f32) {
        let dir = ctx.input().axis("left", "right");
        ctx.set_velocity(Some(dir * self.speed), None);
        if ctx.input().pressed("jump") && ctx.grounded() {
            ctx.set_velocity(None, Some(-self.jump));
            ctx.play("assets/audio/sfx/jump.wav", 0.4);
        }
        self.lives_invuln = (self.lives_invuln - dt).max(0.0);
    }

    fn update(&mut self, ctx: &mut Ctx, _dt: f32) {
        let me = ctx.id;
        let dir = ctx.input().axis("left", "right");
        if dir != 0.0 {
            ctx.flip_x(me, dir < 0.0);
        }
        let anim = if !ctx.grounded() { "jump" } else if dir != 0.0 { "walk" } else { "idle" };
        ctx.play_anim(me, anim);
        if ctx.input().pressed("restart") || ctx.pos().y > 400.0 {
            ctx.restart();
        }
    }

    fn on_trigger_enter(&mut self, ctx: &mut Ctx, other: EntityId) {
        if ctx.has_tag(other, "coin") {
            self.coins += 1;
            ctx.destroy(other);
            ctx.play("assets/audio/sfx/coin.wav", 0.5);
            ctx.emit("score", self.coins as f32);
        }
    }

    fn on_collision_enter(&mut self, ctx: &mut Ctx, other: EntityId) {
        if ctx.has_tag(other, "enemy") && self.lives_invuln == 0.0 {
            let above = ctx.pos().y < ctx.pos_of(other).y - 8.0;
            if above && ctx.velocity().y >= 0.0 {
                ctx.set_velocity(None, Some(-260.0));
                ctx.destroy(other);
                ctx.play("assets/audio/sfx/hit.wav", 0.5);
                ctx.camera_shake(2.0, 0.15);
            } else {
                // knocked back to the start of the level
                self.lives_invuln = 1.0;
                ctx.play("assets/audio/sfx/hit.wav", 0.6);
                ctx.camera_shake(4.0, 0.3);
                ctx.set_pos(vec2(60.0, 100.0));
            }
        }
    }

    fn on_event(&mut self, ctx: &mut Ctx, name: &str, value: f32) {
        if name == "score" {
            if let Some(l) = ctx.find("Score") {
                ctx.set_text(l, &format!("Score: {}", value as u32));
            }
        }
    }
}

struct Enemy {
    speed: f32,
    range: f32,
    origin: Option<f32>,
    dir: f32,
}

impl Script for Enemy {
    fn start(&mut self, ctx: &mut Ctx) {
        self.origin = Some(ctx.pos().x);
        self.dir = 1.0;
    }
    fn fixed_update(&mut self, ctx: &mut Ctx, _dt: f32) {
        let o = self.origin.unwrap_or(0.0);
        let x = ctx.pos().x;
        if (x - o) * self.dir > self.range {
            self.dir = -self.dir;
        }
        ctx.set_velocity(Some(self.dir * self.speed), None);
    }
}

fn main() {
    launch(
        Registry::new()
            .register("player", |a: &Attrs| Box::new(Player { speed: a.f32("speed", 130.0), jump: a.f32("jump", 330.0), coins: 0, lives_invuln: 0.0 }))
            .register("enemy", |a: &Attrs| Box::new(Enemy { speed: a.f32("speed", 30.0), range: a.f32("range", 50.0), origin: None, dir: 1.0 })),
    );
}
