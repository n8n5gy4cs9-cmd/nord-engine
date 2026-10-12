# Rust/WASM tier (M5)

Two project types besides JS: **`wasm-game`** (macroquad + rapier2d, same scene JSON as the JS tier) and **`wasm-app`** (eframe/egui). Both run
natively (`cargo run`) and in the browser. Decision record: ADR-019.

## Project layout
```
my-game/
├─ nord.project.json     type: "wasm-game" | "wasm-app"
├─ Cargo.toml            bin "game" (or "app"); depends on nord-runtime-wasm / nord-app-wasm by path; own [workspace]
├─ src/main.rs           scripts + `launch(Registry…)`
├─ scenes/ prefabs/ assets/   exactly like the JS tier (wasm-game)
└─ index.html            dev page for `nord serve` (loads target/web/…); export writes its own
```
The path dependency (`../../crates/nord-runtime-wasm`) is relative to the engine checkout; New Project / hub example copies rewrite it to the
absolute engine path.

## Building
| What | Command |
|---|---|
| dev build (writes `target/web/game.wasm` or `app.js`+`app_bg.wasm`) | `nord build-rust [dir] [--release]` / editor **Build Rust** |
| web export (static folder + optional zip) | `nord export dir --target web-wasm-game \| web-wasm-app [--optimize] [--zip]` |
| native run | `cargo run` in the project folder |
Needs `rustup target add wasm32-unknown-unknown`. `wasm-app` also needs the `wasm-bindgen` CLI **with the same version as the `wasm-bindgen` crate in
your Cargo.lock** (`cargo install wasm-bindgen-cli --version X`). `--optimize` uses `wasm-opt` (binaryen) when installed.

## Script API (`nord_runtime_wasm`)
```rust
struct Player { speed: f32 }
impl Script for Player {
    fn fixed_update(&mut self, ctx: &mut Ctx, dt: f32) { ctx.set_velocity(Some(ctx.input().axis("left","right") * self.speed), None); }
    fn on_trigger_enter(&mut self, ctx: &mut Ctx, other: EntityId) { if ctx.has_tag(other, "coin") { ctx.destroy(other); ctx.emit("score", 1.0); } }
}
fn main() { launch(Registry::new().register("player", |a: &Attrs| Box::new(Player { speed: a.f32("speed", 130.0) })).prefab("prefabs/bullet.prefab.json")); }
```
Hooks: `start, update, fixed_update(60 Hz), on_destroy, on_collision_enter/exit, on_trigger_enter/exit, on_event(name, value), ui(egui)`.
`Ctx`: `pos/set_pos, velocity/set_velocity(x?,y?), impulse, grounded, find/find_tag, has_tag, destroy, spawn_prefab(path,pos), emit(name,value), play(sound,vol),
set_text, set_tint, play_anim, flip_x, overlap_box, camera_shake/follow/zoom, input() (axis/vec/down/pressed/released/pointer), rand(), restart()`.
Everything the JSON mentions (textures, sounds, prefabs, tilemaps) is preloaded; code-only assets are listed with `Registry::prefab/sound/texture`.

## Supported components (2D subset)
`sprite, animatedSprite` (sheet meta + anims), `text`, `tilemap` (+ static collider runs for `collides`), `parallax`, `particles` (CPU emitter), `camera`
(follow/lerp/bounds/zoom), `rigidbody` (static/dynamic/kinematic), `collider` (box/circle/capsule, trigger), `trigger`, `uiLabel/uiBar/uiButton/uiPanel` (egui),
`audioSource` (autoplay). Not yet: lights, 3D, spawner/path components, joints, animation events.
Units: pixels, y down, degrees; physics runs in metres at 32 px/m. Collider offsets are relative to the entity centre (sprites are centre-origin).

## Limits / gotchas
* Audio is .wav/.ogg only (macroquad). Export does not convert mp3.
* macroquad's JS bundle logs a harmless `register_plugin is not defined` error (quad_net section).
* The runtime needs the page to serve `nord.project.json`, scenes and assets next to `index.html` (the export does).
