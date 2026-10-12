//! Nord Engine Rust/WASM game runtime: loads a Nord project (`nord.project.json` + scene JSON), renders it with macroquad, simulates it
//! with rapier2d and runs your [`Script`]s. A game is just:
//! ```ignore
//! fn main() { nord_runtime_wasm::launch(Registry::new().register_default::<Player>("player")) }
//! ```
pub mod assets;
pub mod data;
pub mod input;
pub mod physics;
pub mod script;
pub mod util;
pub mod world;

pub use macroquad;
pub use serde_json;
#[cfg(feature = "ui")]
pub use egui_macroquad::egui;
pub use script::{Attrs, Ctx, Registry, Script};
pub use world::{EntityId, World};

use macroquad::prelude::*;
use std::rc::Rc;

/// Default window configuration (title/size are ignored on the web, where the page's canvas is used).
pub fn window_conf() -> Conf {
    Conf { window_title: "Nord Game".into(), window_width: 1280, window_height: 720, high_dpi: true, sample_count: 4, ..Default::default() }
}

async fn read_json<T: serde::de::DeserializeOwned>(path: &str) -> Result<(T, serde_json::Value), String> {
    let txt = load_string(path).await.map_err(|e| format!("{path}: {e:?}"))?;
    let v: serde_json::Value = serde_json::from_str(&txt).map_err(|e| format!("{path}: {e}"))?;
    Ok((serde_json::from_value(v.clone()).map_err(|e| format!("{path}: {e}"))?, v))
}

/// The whole `main`: opens the window/canvas and runs the project (blocks natively, returns immediately on wasm while the loop runs).
pub fn launch(registry: Registry) {
    macroquad::Window::from_config(window_conf(), run(registry));
}

/// Load `nord.project.json` from the page root, preload assets, build the start scene and run the main loop (never returns).
pub async fn run(registry: Registry) {
    let registry = Rc::new(registry);
    loop {
        match play(registry.clone()).await {
            Ok(()) => {}
            Err(msg) => {
                error!("[nord] {msg}");
                loop {
                    clear_background(Color::from_rgba(40, 20, 24, 255));
                    draw_text("Nord runtime error", 20.0, 40.0, 32.0, WHITE);
                    for (i, line) in msg.lines().take(12).enumerate() {
                        draw_text(line, 20.0, 80.0 + i as f32 * 22.0, 20.0, LIGHTGRAY);
                    }
                    next_frame().await;
                }
            }
        }
    }
}

/// One play session: returns `Ok` when the scene asked to restart.
async fn play(registry: Rc<Registry>) -> Result<(), String> {
    let (project, _): (data::Project, _) = read_json("nord.project.json").await?;
    if project.start_scene.is_empty() {
        return Err("project has no startScene".into());
    }
    let (scene, scene_json): (data::SceneData, _) = read_json(&project.start_scene).await?;
    let mut assets = assets::Assets::default();
    assets.preload(&[scene_json], &registry.prefabs, &registry.sounds, &registry.textures, project.display.pixel_art).await;
    let mut world = World::new(project, assets, registry);
    world.load_scene(&scene);
    loop {
        world.update(get_frame_time());
        world.draw();
        #[cfg(feature = "ui")]
        {
            egui_macroquad::ui(|ctx| world.ui_frame(ctx));
            egui_macroquad::draw();
        }
        if world.restart_requested {
            return Ok(());
        }
        next_frame().await;
    }
}
