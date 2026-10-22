---
title: Rust / WASM
section: Manual
order: 13
summary: Rust game runtime (macroquad + rapier) and Rust apps (egui), building and limits.
---

Choose a Rust tier when you want to write the game or app in Rust. Nord builds that Rust program into WebAssembly so a browser can run it.

::: dummies
JavaScript NordScript examples do not paste into a Rust project. Start from a Rust template and follow its Rust entry point. Compiling is the step that turns Rust source into a runnable program.
:::

Two Rust project types sit beside the JS tiers. Both run natively (`cargo run`) **and** in the browser as WebAssembly. The reasoning is recorded in [Design decisions](decisions.html).

* **`wasm-game`** — macroquad + rapier2d; uses the *same scene JSON, prefabs and assets* as the JS 2D tier.
* **`wasm-app`** — eframe/egui for tools and dashboards.

::: dummies
JavaScript is read and run by the browser on the fly. Rust is translated ahead of time into a compact binary (WebAssembly) that the browser runs much faster. You pay with a build step; you gain speed and Rust's safety.
:::

## Layout
```
my-game/
├─ nord.project.json     # type: "wasm-game" | "wasm-app"
├─ Cargo.toml            # depends on nord-runtime-wasm / nord-app-wasm by path
├─ src/main.rs           # scripts + launch(Registry…)
├─ scenes/ prefabs/ assets/
└─ index.html            # dev page for `nord serve`
```
Needs `rustup target add wasm32-unknown-unknown`. `wasm-app` also needs the `wasm-bindgen` CLI at **the same version** as the crate in `Cargo.lock`.

## Scripts
```rust
struct Player { speed: f32 }
impl Script for Player {
    fn fixed_update(&mut self, ctx: &mut Ctx, dt: f32) {
        ctx.set_velocity(Some(ctx.input().axis("left", "right") * self.speed), None);
    }
    fn on_trigger_enter(&mut self, ctx: &mut Ctx, other: EntityId) {
        if ctx.has_tag(other, "coin") { ctx.destroy(other); ctx.emit("score", 1.0); }
    }
}
fn main() {
    launch(Registry::new()
        .register("player", |a: &Attrs| Box::new(Player { speed: a.f32("speed", 130.0) }))
        .prefab("prefabs/bullet.prefab.json"));
}
```
Scenes refer to scripts by registered name. Hooks: `start, update, fixed_update (60 Hz), on_destroy, on_collision_enter/exit, on_trigger_enter/exit, on_event(name, value), ui(egui)`.
`Ctx` offers position/velocity/impulse, grounded, find/find_tag, spawn_prefab, emit, play (sound), set_text/set_tint/play_anim/flip_x, overlap_box, camera helpers, `input()`, `rand()`, `restart()`.
The full list is in `docs/RUST_TIER.md` in the repository.

## Building and exporting
| What | Command |
|---|---|
| dev build | `nord build-rust [dir] [--release]` or the editor's **Build Rust** button |
| web export | `nord export dir --target web-wasm-game` (or `web-wasm-app`) `[--optimize] [--zip]` |
| native | `cargo run` in the project |
In the editor, **Play** builds first and streams cargo output to the Console with clickable `file:line` links.

## Supported components (2D)
sprite, animatedSprite, text, tilemap (+ collider runs), parallax, particles (CPU), camera, rigidbody, collider, trigger, ui label/bar/button/panel (egui), audioSource (autoplay).
**Not yet:** lights, 3D, spawner/path components, joints, animation events. Units: pixels, y down, degrees; physics runs in metres at 32 px/m.

## Gotchas
* Audio is WAV/OGG only.
* macroquad's JS bundle logs a harmless `register_plugin is not defined` error.
* The page must serve `nord.project.json`, scenes and assets next to `index.html` (the export does).

::: tip
Desktop apps in Rust: `nord_app_wasm::desktop::Desktop` gives files, dialogs, notifications, clipboard, storage with the same permission manifest as JS apps (web builds fall back gracefully). See [Desktop apps](desktop-apps.html).
:::
