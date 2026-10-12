//! Your game's scripts live here. The scene (scenes/main.scene.json) references them by name: `{ "path": "player", "attributes": {...} }`.
use nord_runtime_wasm::{launch, Attrs, Ctx, Registry, Script};

struct Player {
    speed: f32,
    jump: f32,
}

impl Script for Player {
    fn fixed_update(&mut self, ctx: &mut Ctx, _dt: f32) {
        let dir = ctx.input().axis("left", "right");
        ctx.set_velocity(Some(dir * self.speed), None);
        if ctx.input().pressed("jump") && ctx.grounded() {
            ctx.set_velocity(None, Some(-self.jump));
        }
    }
}

fn main() {
    launch(Registry::new().register("player", |a: &Attrs| Box::new(Player { speed: a.f32("speed", 160.0), jump: a.f32("jump", 420.0) })));
}
