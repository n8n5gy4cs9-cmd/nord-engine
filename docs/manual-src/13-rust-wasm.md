---
title: Rust / WASM
section: Manual
order: 13
summary: Rust game runtime (macroquad + rapier) and Rust apps (egui), building and limits.
---

Choose a Rust tier when you want to write the game or app in Rust. Nord does not contain its own Rust compiler: it runs **`cargo`** (Rust's standard build tool) on your project, then packages the result as WebAssembly so a browser can run it. That means **you must install Rust first**; the steps are in [Before you start](#before-you-start).

::: dummies
JavaScript NordScript examples do not paste into a Rust project. Start from a Rust template and follow its Rust entry point. Compiling is the step that turns Rust source into a runnable program.
:::

## Before you start

You need the items below on your computer. JavaScript projects need none of them.

| Need | macOS | Windows |
|---|---|---|
| **A C toolchain** (some Rust libraries compile helper programs while building) | `xcode-select --install` (Xcode Command Line Tools) | Visual Studio Build Tools (search for it on Microsoft's site) with the **Desktop development with C++** workload |
| **Rust** (includes `cargo`) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` | Download and run `rustup-init.exe` from the Rust website (search for "rustup") |
| **The WebAssembly target** | `rustup target add wasm32-unknown-unknown` | same |
| **`wasm-bindgen` CLI** (Rust *apps* only) | `cargo install wasm-bindgen-cli --version X` | same |

`X` must equal the `wasm-bindgen` version in your project's `Cargo.lock`. Open a new terminal after installing Rust so it is on your PATH.

Optional: `wasm-opt` (from binaryen) makes release builds smaller when you use `--optimize`.

Check your setup with the command-line tool:

**Terminal** (in the folder that contains your project folder):
```bash
nord doctor
```

It prints whether `cargo` and the `wasm32` target are present (the editor finds `cargo` in `~/.cargo/bin` on macOS or `%USERPROFILE%\.cargo\bin` on Windows even when it was started by double-clicking, not from a terminal). If `wasm32` says *missing*, run the `rustup target add` line above.

::: tip
The **first build is slow** (it compiles macroquad, rapier or egui from scratch, often several minutes). Later builds only recompile your own code and take seconds. The Bevy starter template is the slowest.
:::

## What happens when you build

1. Nord runs `cargo build` for the `wasm32-unknown-unknown` target. Compiler errors are shown in the **Console** with clickable `file:line` links.
2. **Rust game (`wasm-game`):** the compiled `game.wasm` is placed in `target/web/`. **Rust app (`wasm-app`):** `wasm-bindgen` turns the output into `app.js` + `app_bg.wasm`.
3. For a **web export**, Nord also copies your scenes and assets next to it, adds the loader page, runs the [offline check](export.html) and can zip the result. Nothing is downloaded from the internet.
4. In the editor, pressing **Play** on a Rust project does steps 1 and 2 first, then shows the result.

Nord passes the extra linker flag that newer Rust versions (1.93 and later) need for WebAssembly, so you do not have to configure it.

## What has been tested

Honest status, so you know what to trust:

* **Verified on macOS (Apple silicon):** creating a Rust game from the template and building it with `nord build-rust` and `nord export --target web-wasm-game` while the editor tool runs with the minimal PATH a double-clicked app gets. The export produced a 3.4 MB `game.wasm`, the macroquad loader, scenes and assets. This is the same code path the editor's Play button uses.
* **Verified on Linux:** the bundled Rust examples (a platformer and a physics toy box) run in a real browser engine with physics, tilemaps, sprite animation, camera follow, input and egui labels. The Rust arcade game from [T37](tut-t37-advanced-rust-wasm.html) exports to real WebAssembly.
* **Windows:** the build code uses only `cargo`, `rustup`, `wasm-bindgen` and `wasm-opt` found on PATH (including `%USERPROFILE%\.cargo\bin`), so it is expected to work, but a full Windows build has not been run yet.
* **Not yet verified:** Rust *app* (`wasm-app`) builds on macOS and Windows, the editor's Play-then-build button in a real editor window, audio output from Rust projects, and particle emitters in a visual scene. If something misbehaves there, build with `nord build-rust` and run `nord serve` instead, and please report it ([Known issues](known-issues.html)).

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

## Gotchas and common errors
* **`error: can't find crate for std` or `wasm32-unknown-unknown target may not be installed`** — run `rustup target add wasm32-unknown-unknown`.
* **`wasm-bindgen` version mismatch** (apps) — install the CLI at exactly the version in `Cargo.lock`: `cargo install wasm-bindgen-cli --version <that version>`.
* **Build seems stuck** — the first build is slow; watch the Console for progress lines.
* Audio is WAV/OGG only.
* macroquad's JS bundle logs a harmless `register_plugin is not defined` error.
* The page must serve `nord.project.json`, scenes and assets next to `index.html` (the export does).

::: tip
Desktop apps in Rust: `nord_app_wasm::desktop::Desktop` gives files, dialogs, notifications, clipboard, storage with the same permission manifest as JS apps (web builds fall back gracefully). See [Desktop apps](desktop-apps.html).
:::
