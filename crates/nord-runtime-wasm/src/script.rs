//! The Rust scripting tier: implement [`Script`], register it by name, reference it from scene JSON (`"path": "scripts/player.js"` or `"player"` — the file stem is the key).
use crate::world::{EntityId, World};
use macroquad::prelude::{Color, Vec2};
use serde_json::Value;
use std::collections::HashMap;

/// Attribute values from the scene (`"attributes": {...}`), with typed getters + defaults.
#[derive(Debug, Clone, Default)]
pub struct Attrs(pub HashMap<String, Value>);
impl Attrs {
    pub fn f32(&self, k: &str, d: f32) -> f32 {
        self.0.get(k).and_then(Value::as_f64).map_or(d, |x| x as f32)
    }
    pub fn i32(&self, k: &str, d: i32) -> i32 {
        self.0.get(k).and_then(Value::as_i64).map_or(d, |x| x as i32)
    }
    pub fn bool(&self, k: &str, d: bool) -> bool {
        self.0.get(k).and_then(Value::as_bool).unwrap_or(d)
    }
    pub fn str(&self, k: &str, d: &str) -> String {
        self.0.get(k).and_then(Value::as_str).unwrap_or(d).to_string()
    }
}

/// Lifecycle mirrors the JS tier (`docs/SCRIPTING_API.md`). All methods are optional.
pub trait Script {
    fn start(&mut self, _ctx: &mut Ctx) {}
    /// every frame (`dt` seconds)
    fn update(&mut self, _ctx: &mut Ctx, _dt: f32) {}
    /// fixed 60 Hz, right before each physics step
    fn fixed_update(&mut self, _ctx: &mut Ctx, _dt: f32) {}
    fn on_destroy(&mut self, _ctx: &mut Ctx) {}
    fn on_collision_enter(&mut self, _ctx: &mut Ctx, _other: EntityId) {}
    fn on_collision_exit(&mut self, _ctx: &mut Ctx, _other: EntityId) {}
    fn on_trigger_enter(&mut self, _ctx: &mut Ctx, _other: EntityId) {}
    fn on_trigger_exit(&mut self, _ctx: &mut Ctx, _other: EntityId) {}
    /// global events from `ctx.emit(name, value)` (delivered at the end of the frame)
    fn on_event(&mut self, _ctx: &mut Ctx, _name: &str, _value: f32) {}
    /// immediate-mode egui hook (feature `ui`)
    #[cfg(feature = "ui")]
    fn ui(&mut self, _ctx: &mut Ctx, _egui: &egui_macroquad::egui::Context) {}
}

type Factory = Box<dyn Fn(&Attrs) -> Box<dyn Script>>;

/// name → script factory. Build one in `main` and pass it to [`crate::run`].
#[derive(Default)]
pub struct Registry {
    pub(crate) factories: HashMap<String, Factory>,
    pub(crate) prefabs: Vec<String>,
    pub(crate) sounds: Vec<String>,
    pub(crate) textures: Vec<String>,
}
impl Registry {
    pub fn new() -> Self {
        Self::default()
    }
    /// `reg.register("player", |a| Box::new(Player::new(a)))`
    pub fn register(mut self, name: &str, f: impl Fn(&Attrs) -> Box<dyn Script> + 'static) -> Self {
        self.factories.insert(name.to_string(), Box::new(f));
        self
    }
    /// Register a `Default` script type without attributes.
    pub fn register_default<T: Script + Default + 'static>(self, name: &str) -> Self {
        self.register(name, |_| Box::new(T::default()))
    }
    /// Preload a prefab so scripts can `ctx.spawn_prefab(path, pos)` it at runtime (prefabs referenced by the scene are found automatically).
    pub fn prefab(mut self, path: &str) -> Self {
        self.prefabs.push(path.to_string());
        self
    }
    /// Preload a sound / texture that is only used from code.
    pub fn sound(mut self, path: &str) -> Self {
        self.sounds.push(path.to_string());
        self
    }
    pub fn texture(mut self, path: &str) -> Self {
        self.textures.push(path.to_string());
        self
    }
}

/// What a script sees: its own entity plus the world services.
pub struct Ctx<'a> {
    pub id: EntityId,
    pub world: &'a mut World,
}

impl Ctx<'_> {
    pub fn dt(&self) -> f32 {
        self.world.time.delta
    }
    pub fn time(&self) -> f32 {
        self.world.time.elapsed
    }
    pub fn input(&self) -> &crate::input::Input {
        &self.world.input
    }
    pub fn pos(&self) -> Vec2 {
        self.world.pos(self.id)
    }
    pub fn set_pos(&mut self, p: Vec2) {
        self.world.set_pos(self.id, p);
    }
    pub fn rotation(&self) -> f32 {
        self.world.ents[self.id.idx()].rot
    }
    pub fn set_rotation(&mut self, deg: f32) {
        self.world.ents[self.id.idx()].rot = deg;
    }
    pub fn scale_of(&self, id: EntityId) -> Vec2 {
        self.world.get(id).map_or(Vec2::ONE, |e| e.scale)
    }
    pub fn set_scale(&mut self, id: EntityId, s: Vec2) {
        if let Some(e) = self.world.get_mut(id) {
            e.scale = s;
        }
    }
    pub fn set_rotation_of(&mut self, id: EntityId, deg: f32) {
        if let Some(e) = self.world.get_mut(id) {
            e.rot = deg;
        }
    }
    pub fn velocity(&self) -> Vec2 {
        self.world.velocity(self.id)
    }
    /// px/s; `None` keeps that axis
    pub fn set_velocity(&mut self, x: Option<f32>, y: Option<f32>) {
        self.world.set_velocity(self.id, x, y);
    }
    pub fn impulse(&mut self, i: Vec2) {
        self.world.impulse(self.id, i);
    }
    pub fn grounded(&self) -> bool {
        self.world.grounded(self.id)
    }
    pub fn has_tag(&self, id: EntityId, tag: &str) -> bool {
        self.world.get(id).is_some_and(|e| e.tags.iter().any(|t| t == tag))
    }
    pub fn name(&self, id: EntityId) -> String {
        self.world.get(id).map(|e| e.name.clone()).unwrap_or_default()
    }
    pub fn find(&self, name: &str) -> Option<EntityId> {
        self.world.find(name)
    }
    pub fn find_tag(&self, tag: &str) -> Vec<EntityId> {
        self.world.find_tag(tag)
    }
    pub fn pos_of(&self, id: EntityId) -> Vec2 {
        self.world.pos(id)
    }
    pub fn set_pos_of(&mut self, id: EntityId, p: Vec2) {
        self.world.set_pos(id, p);
    }
    pub fn destroy(&mut self, id: EntityId) {
        self.world.destroy(id);
    }
    pub fn destroy_self(&mut self) {
        self.world.destroy(self.id);
    }
    pub fn set_enabled(&mut self, id: EntityId, on: bool) {
        self.world.set_enabled(id, on);
    }
    /// Spawn a preloaded prefab (see [`Registry::prefab`]); returns None if the prefab was not loaded.
    pub fn spawn_prefab(&mut self, path: &str, pos: Vec2) -> Option<EntityId> {
        self.world.spawn_prefab(path, pos)
    }
    /// Like [`spawn_prefab`](Self::spawn_prefab) with JSON overrides (transform, components, script attributes…) — see `World::spawn_prefab_with`.
    pub fn spawn_prefab_with(&mut self, path: &str, pos: Vec2, overrides: Value) -> Option<EntityId> {
        self.world.spawn_prefab_with(path, pos, overrides)
    }
    pub fn emit(&mut self, name: &str, value: f32) {
        self.world.events.push((name.to_string(), value));
    }
    pub fn play(&mut self, sound: &str, volume: f32) {
        self.world.play_sound(sound, volume, false);
    }
    pub fn set_text(&mut self, id: EntityId, text: &str) {
        self.world.set_text(id, text);
    }
    pub fn set_tint(&mut self, id: EntityId, c: Color) {
        self.world.set_tint(id, c);
    }
    pub fn play_anim(&mut self, id: EntityId, name: &str) {
        self.world.play_anim(id, name);
    }
    pub fn flip_x(&mut self, id: EntityId, flip: bool) {
        self.world.flip_x(id, flip);
    }
    pub fn overlap_box(&self, center: Vec2, size: Vec2) -> Vec<EntityId> {
        self.world.physics.overlap_box(center, size)
    }
    pub fn camera_shake(&mut self, amount: f32, secs: f32) {
        self.world.camera.shake = (amount, secs);
    }
    pub fn camera_follow(&mut self, id: Option<EntityId>) {
        self.world.camera.follow = id;
    }
    pub fn camera_zoom(&mut self, z: f32) {
        self.world.camera.zoom = z;
    }
    /// Load another scene file (reads the preloaded JSON; scenes must be listed via `Registry::prefab`-style preload: see `load_scene`).
    pub fn restart(&mut self) {
        self.world.restart_requested = true;
    }
    /// uniform random in 0..1
    pub fn rand(&self) -> f32 {
        macroquad::rand::gen_range(0.0, 1.0)
    }
    pub fn rand_range(&self, lo: f32, hi: f32) -> f32 {
        macroquad::rand::gen_range(lo, hi)
    }
}
