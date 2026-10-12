//! Rust physics toys: click / Space drops boxes into a rapier2d world. Shows the Script trait, prefab spawning, events and attributes.
use nord_runtime_wasm::macroquad::prelude::*;
use nord_runtime_wasm::{launch, Attrs, Ctx, Registry, Script};

struct Toys {
    max: usize,
}

impl Script for Toys {
    fn update(&mut self, ctx: &mut Ctx, _dt: f32) {
        let toys = ctx.find_tag("toy");
        if let Some(c) = ctx.find("Counter") {
            ctx.set_text(c, &format!("Toys: {}", toys.len()));
        }
        if ctx.input().pressed("reset") {
            ctx.restart();
            return;
        }
        let drop = ctx.input().pointer_pressed() || ctx.input().pressed("fire");
        if drop {
            if toys.len() >= self.max {
                ctx.destroy(toys[0]); // recycle the oldest
            }
            let p = if ctx.input().pointer_pressed() { ctx.input().pointer } else { vec2(320.0 + (ctx.rand() - 0.5) * 200.0, 20.0) };
            if let Some(id) = ctx.spawn_prefab("prefabs/box.prefab.json", p) {
                ctx.set_tint(id, Color::new(0.4 + ctx.rand() * 0.6, 0.4 + ctx.rand() * 0.6, 0.4 + ctx.rand() * 0.6, 1.0));
            }
        }
    }
}

fn main() {
    launch(
        Registry::new()
            .register("toys", |a: &Attrs| Box::new(Toys { max: a.i32("maxToys", 60) as usize }))
            .prefab("prefabs/box.prefab.json"),
    );
}
