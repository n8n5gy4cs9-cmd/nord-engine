//! Action-based input (same action names as `nord.project.json` → `input.actions`). Pointer is reported in world pixels.
use crate::util::keycode;
use macroquad::prelude::*;
use std::collections::HashMap;

#[derive(Default)]
pub struct Input {
    actions: HashMap<String, Vec<String>>,
    down: HashMap<String, bool>,
    prev: HashMap<String, bool>,
    /// pointer position in world pixels
    pub pointer: Vec2,
    pub pointer_down: bool,
    pointer_was: bool,
}

fn code_down(c: &str) -> bool {
    match c {
        "Mouse0" => is_mouse_button_down(MouseButton::Left),
        "Mouse1" => is_mouse_button_down(MouseButton::Middle),
        "Mouse2" => is_mouse_button_down(MouseButton::Right),
        _ => keycode(c).is_some_and(is_key_down),
    }
}

impl Input {
    pub fn new(actions: HashMap<String, Vec<String>>) -> Self {
        Self { actions, ..Default::default() }
    }
    /// Call once per frame before scripts run. `pointer_world` is the mouse position converted to world pixels.
    pub fn begin_frame(&mut self, pointer_world: Vec2) {
        self.prev = std::mem::take(&mut self.down);
        for (a, codes) in &self.actions {
            self.down.insert(a.clone(), codes.iter().any(|c| code_down(c)));
        }
        self.pointer_was = self.pointer_down;
        self.pointer_down = is_mouse_button_down(MouseButton::Left);
        self.pointer = pointer_world;
    }
    pub fn down(&self, a: &str) -> bool {
        self.down.get(a).copied().unwrap_or(false)
    }
    pub fn pressed(&self, a: &str) -> bool {
        self.down(a) && !self.prev.get(a).copied().unwrap_or(false)
    }
    pub fn released(&self, a: &str) -> bool {
        !self.down(a) && self.prev.get(a).copied().unwrap_or(false)
    }
    pub fn pointer_pressed(&self) -> bool {
        self.pointer_down && !self.pointer_was
    }
    pub fn axis(&self, neg: &str, pos: &str) -> f32 {
        (self.down(pos) as i32 - self.down(neg) as i32) as f32
    }
    /// Normalised 2D direction from four actions.
    pub fn vec(&self, l: &str, r: &str, u: &str, d: &str) -> Vec2 {
        let v = Vec2::new(self.axis(l, r), self.axis(u, d));
        if v.length() > 1.0 { v.normalize() } else { v }
    }
}
