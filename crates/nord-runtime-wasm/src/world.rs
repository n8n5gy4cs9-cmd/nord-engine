//! Entities, components, the fixed-step loop, script dispatch and rendering for the Rust runtime.
use crate::assets::Assets;
use crate::data::*;
use crate::input::Input;
use crate::physics::*;
use crate::script::{Attrs, Ctx, Registry, Script};
use crate::util::*;
use macroquad::audio::{play_sound, PlaySoundParams};
use macroquad::prelude::*;
use rapier2d::prelude::{ColliderHandle, RigidBodyHandle};
use serde_json::Value;
use std::rc::Rc;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct EntityId {
    idx: u32,
    gen: u32,
}
impl EntityId {
    pub fn idx(self) -> usize {
        self.idx as usize
    }
}

struct AnimState {
    name: String,
    t: f32,
}

struct SpriteV {
    tex: String,
    size: Option<Vec2>,
    tint: Color,
    flip: (bool, bool),
    origin: Vec2,
    frame: Option<u32>,
    anim: Option<AnimState>,
}

struct TextV {
    text: String,
    size: f32,
    color: Color,
}

struct TileV {
    map: String,
    tileset: String,
}

struct ParallaxV {
    tex: String,
    factor: Vec2,
}

enum Visual {
    Sprite(SpriteV),
    Text(TextV),
    Tilemap(TileV),
    Parallax(ParallaxV),
}

struct Particle {
    pos: Vec2,
    vel: Vec2,
    age: f32,
    life: f32,
}

struct Emitter {
    tex: Option<String>,
    lifespan: f32,
    speed: (f32, f32),
    angle: (f32, f32),
    scale: (f32, f32),
    alpha: (f32, f32),
    gravity_y: f32,
    tint: Color,
    period: f32,
    quantity: u32,
    on: bool,
    acc: f32,
    parts: Vec<Particle>,
}

pub enum UiWidget {
    Label { text: String, size: f32, color: Color },
    Bar { value: f32, size: Vec2, color: Color },
    Button { text: String, event: String },
    Panel { size: Vec2 },
}

struct UiV {
    widget: UiWidget,
    pos: Vec2,
    anchor: String,
}

struct ScriptSlot {
    script: Option<Box<dyn Script>>,
    started: bool,
}

pub struct Entity {
    gen: u32,
    pub alive: bool,
    pub name: String,
    pub tags: Vec<String>,
    pub enabled: bool,
    pub pos: Vec2,
    pub rot: f32,
    pub scale: Vec2,
    pub z: f32,
    parent: Option<EntityId>,
    children: Vec<EntityId>,
    visuals: Vec<Visual>,
    body: Option<RigidBodyHandle>,
    collider: Option<ColliderHandle>,
    tile_colliders: Vec<ColliderHandle>,
    kind: Option<BodyMode>,
    emitter: Option<Emitter>,
    ui: Option<UiV>,
    scripts: Vec<ScriptSlot>,
}

#[derive(Default)]
pub struct Time {
    pub delta: f32,
    pub elapsed: f32,
}

pub struct CameraState {
    pub pos: Vec2,
    pub zoom: f32,
    pub follow: Option<EntityId>,
    pub lerp: f32,
    pub bounds: Option<Rect>,
    /// (amount px, seconds left)
    pub shake: (f32, f32),
}

pub struct World {
    pub project: Project,
    pub ents: Vec<Entity>,
    free: Vec<u32>,
    pub physics: Physics,
    pub input: Input,
    pub time: Time,
    pub events: Vec<(String, f32)>,
    pub camera: CameraState,
    pub assets: Assets,
    pub registry: Rc<Registry>,
    pub restart_requested: bool,
    acc: f32,
    dead: Vec<EntityId>,
    camera_entity_follow: Option<String>,
}

fn deep_merge(t: &mut Value, ov: &Value) {
    match (t, ov) {
        (Value::Object(a), Value::Object(b)) => {
            for (k, v) in b {
                deep_merge(a.entry(k.clone()).or_insert(Value::Null), v);
            }
        }
        (Value::Array(a), Value::Object(b)) if b.keys().all(|k| k.parse::<usize>().is_ok()) => {
            for (k, v) in b {
                if let Some(slot) = a.get_mut(k.parse::<usize>().unwrap()) {
                    deep_merge(slot, v);
                }
            }
        }
        (t, ov) => *t = ov.clone(),
    }
}

impl World {
    pub fn new(project: Project, assets: Assets, registry: Rc<Registry>) -> Self {
        let g = project.physics.gravity;
        let (dw, dh) = (project.display.width, project.display.height);
        Self {
            input: Input::new(project.input.actions.clone()),
            physics: Physics::new(vec2(g[0], g[1])),
            camera: CameraState { pos: vec2(dw / 2.0, dh / 2.0), zoom: 1.0, follow: None, lerp: 1.0, bounds: None, shake: (0.0, 0.0) },
            project,
            ents: vec![],
            free: vec![],
            time: Time::default(),
            events: vec![],
            assets,
            registry,
            restart_requested: false,
            acc: 0.0,
            dead: vec![],
            camera_entity_follow: None,
        }
    }

    // ---- lookup -------------------------------------------------------------------------------
    pub fn get(&self, id: EntityId) -> Option<&Entity> {
        self.ents.get(id.idx()).filter(|e| e.alive && e.gen == id.gen)
    }
    fn get_mut(&mut self, id: EntityId) -> Option<&mut Entity> {
        self.ents.get_mut(id.idx()).filter(|e| e.alive && e.gen == id.gen)
    }
    fn ids(&self) -> Vec<EntityId> {
        self.ents.iter().enumerate().filter(|(_, e)| e.alive).map(|(i, e)| EntityId { idx: i as u32, gen: e.gen }).collect()
    }
    pub fn find(&self, name: &str) -> Option<EntityId> {
        self.ents.iter().enumerate().find(|(_, e)| e.alive && e.name == name).map(|(i, e)| EntityId { idx: i as u32, gen: e.gen })
    }
    pub fn find_tag(&self, tag: &str) -> Vec<EntityId> {
        self.ents.iter().enumerate().filter(|(_, e)| e.alive && e.tags.iter().any(|t| t == tag)).map(|(i, e)| EntityId { idx: i as u32, gen: e.gen }).collect()
    }
    /// World position (parent chain: translation + scale).
    pub fn pos(&self, id: EntityId) -> Vec2 {
        let Some(e) = self.get(id) else { return Vec2::ZERO };
        match e.parent {
            Some(p) => {
                let ps = self.get(p).map_or(Vec2::ONE, |x| x.scale);
                self.pos(p) + e.pos * ps
            }
            None => e.pos,
        }
    }
    pub fn set_pos(&mut self, id: EntityId, p: Vec2) {
        let (body, kin) = match self.get_mut(id) {
            Some(e) => {
                e.pos = p;
                (e.body, e.kind == Some(BodyMode::Kinematic))
            }
            None => return,
        };
        if let Some(b) = body {
            if kin {
                self.physics.set_kinematic_target(b, p);
            } else {
                self.physics.teleport(b, p);
            }
        }
    }
    pub fn velocity(&self, id: EntityId) -> Vec2 {
        self.get(id).and_then(|e| e.body).map_or(Vec2::ZERO, |b| self.physics.vel(b))
    }
    pub fn set_velocity(&mut self, id: EntityId, x: Option<f32>, y: Option<f32>) {
        if let Some(b) = self.get(id).and_then(|e| e.body) {
            self.physics.set_vel(b, x, y);
        }
    }
    pub fn impulse(&mut self, id: EntityId, i: Vec2) {
        if let Some(b) = self.get(id).and_then(|e| e.body) {
            self.physics.impulse(b, i);
        }
    }
    pub fn grounded(&self, id: EntityId) -> bool {
        self.get(id).and_then(|e| e.collider).is_some_and(|c| self.physics.grounded(c))
    }
    pub fn set_enabled(&mut self, id: EntityId, on: bool) {
        let body = self.get_mut(id).map(|e| {
            e.enabled = on;
            e.body
        });
        if let Some(Some(b)) = body {
            self.physics.set_enabled(b, on);
        }
    }
    pub fn destroy(&mut self, id: EntityId) {
        if self.get(id).is_some() && !self.dead.contains(&id) {
            self.dead.push(id);
        }
    }
    pub fn set_text(&mut self, id: EntityId, text: &str) {
        if let Some(e) = self.get_mut(id) {
            for v in &mut e.visuals {
                if let Visual::Text(t) = v {
                    t.text = text.to_string();
                }
            }
            if let Some(UiV { widget: UiWidget::Label { text: t, .. } | UiWidget::Button { text: t, .. }, .. }) = &mut e.ui {
                *t = text.to_string();
            }
        }
    }
    pub fn set_bar(&mut self, id: EntityId, value: f32) {
        if let Some(UiV { widget: UiWidget::Bar { value: v, .. }, .. }) = self.get_mut(id).and_then(|e| e.ui.as_mut()) {
            *v = value.clamp(0.0, 1.0);
        }
    }
    pub fn set_tint(&mut self, id: EntityId, c: Color) {
        if let Some(e) = self.get_mut(id) {
            for v in &mut e.visuals {
                if let Visual::Sprite(s) = v {
                    s.tint = c;
                }
            }
        }
    }
    pub fn play_anim(&mut self, id: EntityId, name: &str) {
        if let Some(e) = self.get_mut(id) {
            for v in &mut e.visuals {
                if let Visual::Sprite(s) = v {
                    if s.anim.as_ref().is_none_or(|a| a.name != name) {
                        s.anim = Some(AnimState { name: name.to_string(), t: 0.0 });
                    }
                }
            }
        }
    }
    pub fn flip_x(&mut self, id: EntityId, flip: bool) {
        if let Some(e) = self.get_mut(id) {
            for v in &mut e.visuals {
                if let Visual::Sprite(s) = v {
                    s.flip.0 = flip;
                }
            }
        }
    }
    pub fn play_sound(&self, path: &str, volume: f32, looped: bool) {
        if let Some(s) = self.assets.sounds.get(path) {
            play_sound(s, PlaySoundParams { looped, volume });
        }
    }

    // ---- building -----------------------------------------------------------------------------
    pub fn load_scene(&mut self, scene: &SceneData) {
        for e in &scene.entities {
            self.spawn_entity(e.clone(), None);
        }
    }

    pub fn spawn_prefab(&mut self, path: &str, pos: Vec2) -> Option<EntityId> {
        let mut data = self.assets.prefab_data(path)?.root;
        data.transform.pos = [pos.x, pos.y, data.transform.pos[2]];
        Some(self.spawn_entity(data, None))
    }

    fn expand_prefab(&self, d: EntityData) -> EntityData {
        let Some(pr) = d.prefab.clone() else { return d };
        let Some(mut root) = self.assets.prefabs.get(&pr.path).and_then(|v| v.get("root").cloned()) else {
            warn!("[nord] prefab '{}' not loaded", pr.path);
            return EntityData { prefab: None, ..d };
        };
        if !pr.overrides.is_null() {
            deep_merge(&mut root, &pr.overrides);
        }
        let mut out: EntityData = serde_json::from_value(root).unwrap_or_default();
        out.transform = d.transform;
        if !d.name.is_empty() && d.name != "Entity" {
            out.name = d.name;
        }
        if !d.tags.is_empty() {
            out.tags = d.tags;
        }
        out.enabled = d.enabled;
        out.prefab = None;
        out
    }

    pub fn spawn_entity(&mut self, data: EntityData, parent: Option<EntityId>) -> EntityId {
        let data = self.expand_prefab(data);
        let t = &data.transform;
        let ent = Entity {
            gen: 0,
            alive: true,
            name: data.name.clone(),
            tags: data.tags.clone(),
            enabled: data.enabled,
            pos: vec2(t.pos[0], t.pos[1]),
            rot: t.rot[2],
            scale: vec2(t.scale[0], t.scale[1]),
            z: t.pos[2],
            parent,
            children: vec![],
            visuals: vec![],
            body: None,
            collider: None,
            tile_colliders: vec![],
            kind: None,
            emitter: None,
            ui: None,
            scripts: vec![],
        };
        let id = match self.free.pop() {
            Some(i) => {
                let gen = self.ents[i as usize].gen + 1;
                self.ents[i as usize] = Entity { gen, ..ent };
                EntityId { idx: i, gen }
            }
            None => {
                self.ents.push(ent);
                EntityId { idx: (self.ents.len() - 1) as u32, gen: 0 }
            }
        };
        if let Some(p) = parent {
            if let Some(pe) = self.get_mut(p) {
                pe.children.push(id);
            }
        }
        self.build_components(id, &data);
        for s in &data.scripts {
            let stem = std::path::Path::new(&s.path).file_stem().map(|x| x.to_string_lossy().into_owned()).unwrap_or_default();
            let attrs = Attrs(s.attributes.clone());
            let reg = self.registry.clone();
            match reg.factories.get(&stem) {
                Some(f) => {
                    let script = f(&attrs);
                    self.ents[id.idx()].scripts.push(ScriptSlot { script: Some(script), started: false });
                }
                None => warn!("[nord] no Rust script registered for '{}' (entity {})", s.path, data.name),
            }
        }
        for c in &data.children {
            self.spawn_entity(c.clone(), Some(id));
        }
        id
    }

    fn tex_size(&self, tex: &str, frame_of_sheet: bool) -> Vec2 {
        let Some(t) = self.assets.textures.get(tex) else { return vec2(16.0, 16.0) };
        match (frame_of_sheet, self.assets.metas.get(tex)) {
            (true, Some(m)) if m.frame_width > 0.0 => vec2(m.frame_width, m.frame_height),
            _ => vec2(t.width(), t.height()),
        }
    }

    fn build_components(&mut self, id: EntityId, data: &EntityData) {
        let (mut rb, mut col): (Option<&Value>, Option<&Value>) = (None, None);
        let mut trigger_box: Option<Value> = None;
        let mut visual_size: Option<Vec2> = None;
        for c in &data.components {
            let ty = s(c, "type").unwrap_or("");
            match ty {
                "sprite" | "animatedSprite" => {
                    let tex = s(c, "texture").unwrap_or("").to_string();
                    let sheet = ty == "animatedSprite";
                    let size = v2(c, "size").or_else(|| Some(self.tex_size(&tex, sheet)));
                    visual_size = size;
                    let origin = v2(c, "origin").unwrap_or(vec2(0.5, 0.5));
                    let mut tint = s(c, "tint").map_or(WHITE, parse_color);
                    tint.a *= f(c, "alpha", 1.0);
                    let anim = s(c, "anim").map(|n| AnimState { name: n.to_string(), t: 0.0 });
                    let frame = c.get("frame").and_then(Value::as_u64).map(|x| x as u32);
                    self.ents[id.idx()].visuals.push(Visual::Sprite(SpriteV { tex, size, tint, flip: (b(c, "flipX", false), b(c, "flipY", false)), origin, frame: frame.or(if sheet { Some(0) } else { None }), anim }));
                }
                "text" => self.ents[id.idx()].visuals.push(Visual::Text(TextV { text: s(c, "text").unwrap_or("").into(), size: f(c, "size", 24.0), color: s(c, "color").map_or(WHITE, parse_color) })),
                "tilemap" => {
                    let (map, tileset) = (s(c, "map").unwrap_or("").to_string(), s(c, "tileset").unwrap_or("").to_string());
                    self.add_tile_colliders(id, &map);
                    self.ents[id.idx()].visuals.push(Visual::Tilemap(TileV { map, tileset }));
                }
                "parallax" => self.ents[id.idx()].visuals.push(Visual::Parallax(ParallaxV { tex: s(c, "texture").unwrap_or("").into(), factor: v2(c, "factor").unwrap_or(Vec2::ZERO) })),
                "particles" => self.ents[id.idx()].emitter = Some(emitter_from(c)),
                "rigidbody" => rb = Some(c),
                "collider" => col = Some(c),
                "trigger" => trigger_box = Some(serde_json::json!({ "shape": s(c, "shape").unwrap_or("box"), "size": c.get("size").cloned().unwrap_or(Value::Null), "offset": c.get("offset").cloned().unwrap_or(Value::Null), "trigger": true })),
                "camera" => {
                    self.camera.zoom = f(c, "zoom", 1.0);
                    self.camera.lerp = f(c, "lerp", 1.0).clamp(0.01, 1.0);
                    if let Some(a) = c.get("bounds").and_then(Value::as_array).filter(|a| a.len() == 4) {
                        let n: Vec<f32> = a.iter().map(|x| x.as_f64().unwrap_or(0.0) as f32).collect();
                        self.camera.bounds = Some(Rect::new(n[0], n[1], n[2] - n[0], n[3] - n[1]));
                    }
                    self.camera_entity_follow = s(c, "follow").map(String::from);
                    self.camera.pos = vec2(data.transform.pos[0], data.transform.pos[1]);
                }
                "uiLabel" => self.set_ui(id, c, UiWidget::Label { text: s(c, "text").unwrap_or("").into(), size: f(c, "size", 18.0), color: s(c, "color").map_or(WHITE, parse_color) }),
                "uiBar" => self.set_ui(id, c, UiWidget::Bar { value: f(c, "value", 1.0), size: vec2(f(c, "w", 160.0), f(c, "h", 16.0)), color: s(c, "color").map_or(GREEN, parse_color) }),
                "uiButton" => self.set_ui(id, c, UiWidget::Button { text: s(c, "text").unwrap_or("Button").into(), event: s(c, "event").unwrap_or("").into() }),
                "uiPanel" => self.set_ui(id, c, UiWidget::Panel { size: vec2(f(c, "w", 160.0), f(c, "h", 100.0)) }),
                "audioSource" => {
                    if b(c, "autoplay", false) {
                        if let Some(p) = s(c, "clip") {
                            self.play_sound(p, f(c, "volume", 1.0), b(c, "loop", false));
                        }
                    }
                }
                _ => {}
            }
        }
        let col = col.cloned().or(trigger_box);
        if rb.is_some() || col.is_some() {
            let mode = match rb.and_then(|r| s(r, "mode")) {
                Some("dynamic") => BodyMode::Dynamic,
                Some("kinematic") => BodyMode::Kinematic,
                _ => BodyMode::Static,
            };
            let size = col.as_ref().and_then(|c| v2(c, "size")).or(visual_size).unwrap_or(vec2(16.0, 16.0));
            let shape = match col.as_ref().and_then(|c| s(c, "shape")) {
                Some("circle") | Some("sphere") => ShapeDesc::Circle(col.as_ref().map_or(size.x / 2.0, |c| f(c, "radius", size.x / 2.0))),
                Some("capsule") => ShapeDesc::Capsule(size),
                _ => ShapeDesc::Box(size),
            };
            let r = rb.cloned().unwrap_or(Value::Null);
            let desc = BodyDesc {
                mode,
                mass: f(&r, "mass", 1.0),
                gravity_scale: f(&r, "gravityScale", 1.0),
                fixed_rotation: b(&r, "fixedRotation", true),
                drag: f(&r, "drag", 0.0),
                bounce: f(&r, "bounce", 0.0),
                friction: f(&r, "friction", 0.1),
                shape,
                // the JS tier measures colliders from the sprite's top-left corner; here sprites are centred so offsets are centre-relative
                offset: col.as_ref().and_then(|c| v2(c, "offset")).unwrap_or(Vec2::ZERO),
                trigger: col.as_ref().is_some_and(|c| b(c, "trigger", false)),
            };
            let e = &self.ents[id.idx()];
            let (pos, rot) = (e.pos, e.rot);
            let (h, ch) = self.physics.add(id, pos, rot, &desc);
            let e = &mut self.ents[id.idx()];
            e.body = Some(h);
            e.collider = Some(ch);
            e.kind = Some(mode);
        }
    }

    fn set_ui(&mut self, id: EntityId, c: &Value, widget: UiWidget) {
        self.ents[id.idx()].ui = Some(UiV { widget, pos: vec2(f(c, "x", 0.0), f(c, "y", 0.0)), anchor: s(c, "anchor").unwrap_or("tl").to_string() });
    }

    /// Static colliders for `collides` tiles, merged into horizontal runs per row.
    fn add_tile_colliders(&mut self, id: EntityId, map: &str) {
        let Some(m) = self.assets.maps.get(map).cloned() else { return };
        let origin = self.pos(id);
        let (tw, th) = (m.tile_width.max(1.0), m.tile_height.max(1.0));
        let mut handles = vec![];
        for layer in &m.layers {
            for (y, row) in layer.data.iter().enumerate() {
                let mut x = 0;
                while x < row.len() {
                    if !m.collides.contains(&row[x]) {
                        x += 1;
                        continue;
                    }
                    let start = x;
                    while x < row.len() && m.collides.contains(&row[x]) {
                        x += 1;
                    }
                    let w = (x - start) as f32 * tw;
                    handles.push(self.physics.add_static_box(id, origin + vec2(start as f32 * tw + w / 2.0, y as f32 * th + th / 2.0), vec2(w, th)));
                }
            }
        }
        self.ents[id.idx()].tile_colliders = handles;
    }

    // ---- frame --------------------------------------------------------------------------------
    fn view_scale(&self) -> f32 {
        let d = &self.project.display;
        (screen_width() / d.width).min(screen_height() / d.height) * self.camera.zoom
    }
    pub fn to_screen(&self, p: Vec2) -> Vec2 {
        let s = self.view_scale();
        let shake = if self.camera.shake.1 > 0.0 { vec2(rand::gen_range(-1.0, 1.0), rand::gen_range(-1.0, 1.0)) * self.camera.shake.0 } else { Vec2::ZERO };
        (p - self.camera.pos - shake) * s + vec2(screen_width(), screen_height()) / 2.0
    }
    pub fn to_world(&self, p: Vec2) -> Vec2 {
        (p - vec2(screen_width(), screen_height()) / 2.0) / self.view_scale() + self.camera.pos
    }

    fn call<F: FnOnce(&mut dyn Script, &mut Ctx)>(&mut self, id: EntityId, slot: usize, f: F) {
        let Some(mut s) = self.get_mut(id).and_then(|e| e.scripts.get_mut(slot)).and_then(|sl| sl.script.take()) else { return };
        f(s.as_mut(), &mut Ctx { id, world: self });
        if let Some(sl) = self.get_mut(id).and_then(|e| e.scripts.get_mut(slot)) {
            sl.script = Some(s);
        }
    }
    fn each_script<F: FnMut(&mut dyn Script, &mut Ctx)>(&mut self, mut f: F) {
        for id in self.ids() {
            if self.get(id).is_none_or(|e| !e.enabled) {
                continue;
            }
            let n = self.get(id).map_or(0, |e| e.scripts.len());
            for slot in 0..n {
                self.call(id, slot, |s, c| f(s, c));
            }
        }
    }
    fn dispatch_to(&mut self, id: EntityId, f: &dyn Fn(&mut dyn Script, &mut Ctx)) {
        let n = self.get(id).map_or(0, |e| e.scripts.len());
        for slot in 0..n {
            self.call(id, slot, |s, c| f(s, c));
        }
    }

    pub fn update(&mut self, dt: f32) {
        let dt = dt.min(0.25);
        self.time.delta = dt;
        self.time.elapsed += dt;
        let pw = self.to_world(vec2(mouse_position().0, mouse_position().1));
        self.input.begin_frame(pw);
        // start()
        for id in self.ids() {
            let n = self.get(id).map_or(0, |e| e.scripts.len());
            for slot in 0..n {
                if self.get(id).is_some_and(|e| e.enabled && !e.scripts[slot].started) {
                    self.ents[id.idx()].scripts[slot].started = true;
                    self.call(id, slot, |s, c| s.start(c));
                }
            }
        }
        // fixed steps
        self.acc += dt;
        let mut steps = 0;
        while self.acc >= FIXED_DT && steps < 5 {
            self.acc -= FIXED_DT;
            steps += 1;
            self.each_script(|s, c| s.fixed_update(c, FIXED_DT));
            self.step_physics();
        }
        if self.acc > FIXED_DT * 5.0 {
            self.acc = 0.0;
        }
        self.each_script(|s, c| s.update(c, dt));
        self.update_visuals(dt);
        self.update_camera(dt);
        // global events
        for _ in 0..4 {
            let evs = std::mem::take(&mut self.events);
            if evs.is_empty() {
                break;
            }
            for (name, val) in evs {
                self.each_script(|s, c| s.on_event(c, &name, val));
            }
        }
        self.flush_dead();
    }

    fn step_physics(&mut self) {
        // scripts may have moved kinematic bodies via set_pos (already queued); step then read back
        let contacts = self.physics.step();
        for id in self.ids() {
            let e = &self.ents[id.idx()];
            if let (Some(b), Some(BodyMode::Dynamic)) = (e.body, e.kind) {
                if let Some((p, r)) = self.physics.pos(b) {
                    let local = match e.parent {
                        Some(par) => (p - self.pos(par)) / self.get(par).map_or(Vec2::ONE, |x| x.scale),
                        None => p,
                    };
                    let en = &mut self.ents[id.idx()];
                    en.pos = local;
                    en.rot = r;
                }
            }
        }
        let find = |w: &World, id: EntityId| w.get(id).is_some();
        for (kind, a, b) in contacts {
            if !find(self, a) || !find(self, b) {
                continue;
            }
            let (ka, kb): (&dyn Fn(&mut dyn Script, &mut Ctx, EntityId), &dyn Fn(&mut dyn Script, &mut Ctx, EntityId)) = match kind {
                ContactKind::CollisionEnter => (&|s, c, o| s.on_collision_enter(c, o), &|s, c, o| s.on_collision_enter(c, o)),
                ContactKind::CollisionExit => (&|s, c, o| s.on_collision_exit(c, o), &|s, c, o| s.on_collision_exit(c, o)),
                ContactKind::TriggerEnter => (&|s, c, o| s.on_trigger_enter(c, o), &|s, c, o| s.on_trigger_enter(c, o)),
                ContactKind::TriggerExit => (&|s, c, o| s.on_trigger_exit(c, o), &|s, c, o| s.on_trigger_exit(c, o)),
            };
            self.dispatch_to(a, &|s, c| ka(s, c, b));
            self.dispatch_to(b, &|s, c| kb(s, c, a));
        }
    }

    fn update_visuals(&mut self, dt: f32) {
        for id in self.ids() {
            let wp = self.pos(id);
            let metas = &self.assets.metas;
            let e = &mut self.ents[id.idx()];
            for v in &mut e.visuals {
                if let Visual::Sprite(sp) = v {
                    if let (Some(a), Some(m)) = (&mut sp.anim, metas.get(&sp.tex)) {
                        if let Some(def) = m.anims.get(&a.name) {
                            a.t += dt;
                            let n = def.frames.len().max(1);
                            let i = (a.t * def.fps) as usize;
                            let i = if def.looping { i % n } else { i.min(n - 1) };
                            sp.frame = def.frames.get(i).copied();
                        }
                    }
                }
            }
            if let Some(em) = &mut e.emitter {
                em.update(dt, wp);
            }
        }
        if self.camera.shake.1 > 0.0 {
            self.camera.shake.1 -= dt;
        }
    }

    fn update_camera(&mut self, dt: f32) {
        if self.camera.follow.is_none() {
            if let Some(n) = self.camera_entity_follow.take() {
                self.camera.follow = self.find(&n);
            }
        }
        if let Some(t) = self.camera.follow.filter(|t| self.get(*t).is_some()) {
            let k = 1.0 - (1.0 - self.camera.lerp).powf(dt * 60.0);
            self.camera.pos += (self.pos(t) - self.camera.pos) * k;
        }
        if let Some(b) = self.camera.bounds {
            let d = &self.project.display;
            let half = vec2(d.width, d.height) / (2.0 * self.camera.zoom);
            self.camera.pos.x = self.camera.pos.x.clamp(b.x + half.x, (b.x + b.w - half.x).max(b.x + half.x));
            self.camera.pos.y = self.camera.pos.y.clamp(b.y + half.y, (b.y + b.h - half.y).max(b.y + half.y));
        }
    }

    fn flush_dead(&mut self) {
        let dead = std::mem::take(&mut self.dead);
        for id in dead {
            if self.get(id).is_none() {
                continue;
            }
            let n = self.get(id).map_or(0, |e| e.scripts.len());
            for slot in 0..n {
                self.call(id, slot, |s, c| s.on_destroy(c));
            }
            let kids = self.get(id).map(|e| e.children.clone()).unwrap_or_default();
            for k in kids {
                self.destroy(k);
            }
            let (body, col, tiles, parent) = {
                let e = &self.ents[id.idx()];
                (e.body, e.collider, e.tile_colliders.clone(), e.parent)
            };
            self.physics.remove(body, col);
            for t in tiles {
                self.physics.remove_collider(t);
            }
            if let Some(p) = parent.and_then(|p| self.get_mut(p)) {
                p.children.retain(|c| *c != id);
            }
            let e = &mut self.ents[id.idx()];
            e.alive = false;
            e.visuals.clear();
            e.scripts.clear();
            e.body = None;
            e.collider = None;
            self.free.push(id.idx);
        }
        // children flagged during this flush
        if !self.dead.is_empty() {
            self.flush_dead();
        }
    }

    // ---- drawing ------------------------------------------------------------------------------
    pub fn draw(&self) {
        clear_background(parse_color(&self.project.display.background));
        let s = self.view_scale();
        let mut order: Vec<(f32, EntityId)> = self.ids().into_iter().filter(|i| self.get(*i).is_some_and(|e| e.enabled)).map(|i| (self.get(i).unwrap().z, i)).collect();
        order.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        for (_, id) in order {
            let e = &self.ents[id.idx()];
            let wp = self.pos(id);
            let sc = e.scale * e.parent.and_then(|p| self.get(p)).map_or(Vec2::ONE, |p| p.scale);
            for v in &e.visuals {
                match v {
                    Visual::Sprite(sp) => self.draw_sprite(sp, wp, sc, e.rot, s),
                    Visual::Text(t) => {
                        let p = self.to_screen(wp);
                        let size = (t.size * s * sc.y.abs()).max(4.0);
                        let m = measure_text(&t.text, None, size as u16, 1.0);
                        draw_text(&t.text, p.x - m.width / 2.0, p.y + m.height / 2.0, size, t.color);
                    }
                    Visual::Tilemap(tv) => self.draw_tilemap(tv, wp, s),
                    Visual::Parallax(pv) => self.draw_parallax(pv, wp, s),
                }
            }
            if let Some(em) = &e.emitter {
                for p in &em.parts {
                    let k = (p.age / p.life).clamp(0.0, 1.0);
                    let size = (em.scale.0 + (em.scale.1 - em.scale.0) * k) * 6.0 * s;
                    let mut c = em.tint;
                    c.a *= em.alpha.0 + (em.alpha.1 - em.alpha.0) * k;
                    let sp = self.to_screen(p.pos);
                    match em.tex.as_ref().and_then(|t| self.assets.textures.get(t)) {
                        Some(t) => draw_texture_ex(t, sp.x - size / 2.0, sp.y - size / 2.0, c, DrawTextureParams { dest_size: Some(vec2(size, size)), ..Default::default() }),
                        None => draw_circle(sp.x, sp.y, size / 2.0, c),
                    }
                }
            }
        }
    }

    fn draw_sprite(&self, sp: &SpriteV, wp: Vec2, sc: Vec2, rot: f32, s: f32) {
        let Some(t) = self.assets.textures.get(&sp.tex) else {
            let p = self.to_screen(wp);
            draw_rectangle(p.x - 8.0 * s, p.y - 8.0 * s, 16.0 * s, 16.0 * s, MAGENTA);
            return;
        };
        let meta = self.assets.metas.get(&sp.tex);
        let (src, natural) = match (sp.frame, meta) {
            (Some(f), Some(m)) if m.frame_width > 0.0 => {
                let cols = (t.width() / m.frame_width).max(1.0) as u32;
                (Some(Rect::new((f % cols) as f32 * m.frame_width, (f / cols) as f32 * m.frame_height, m.frame_width, m.frame_height)), vec2(m.frame_width, m.frame_height))
            }
            _ => (None, vec2(t.width(), t.height())),
        };
        let size = sp.size.unwrap_or(natural) * sc.abs() * s;
        let p = self.to_screen(wp);
        let top_left = p - size * sp.origin;
        draw_texture_ex(t, top_left.x, top_left.y, sp.tint, DrawTextureParams { dest_size: Some(size), source: src, rotation: rot.to_radians(), flip_x: sp.flip.0 != (sc.x < 0.0), flip_y: sp.flip.1 != (sc.y < 0.0), pivot: Some(p) });
    }

    fn draw_tilemap(&self, tv: &TileV, wp: Vec2, s: f32) {
        let (Some(m), Some(t)) = (self.assets.maps.get(&tv.map), self.assets.textures.get(&tv.tileset)) else { return };
        let (tw, th) = (m.tile_width.max(1.0), m.tile_height.max(1.0));
        let cols = (t.width() / tw).max(1.0) as i32;
        let (sw, sh) = (screen_width(), screen_height());
        for layer in &m.layers {
            for (y, row) in layer.data.iter().enumerate() {
                let top = self.to_screen(wp + vec2(0.0, y as f32 * th)).y;
                if top > sh || top + th * s < 0.0 {
                    continue;
                }
                for (x, &idx) in row.iter().enumerate() {
                    if idx < 0 {
                        continue;
                    }
                    let p = self.to_screen(wp + vec2(x as f32 * tw, y as f32 * th));
                    if p.x > sw || p.x + tw * s < 0.0 {
                        continue;
                    }
                    let src = Rect::new((idx % cols) as f32 * tw, (idx / cols) as f32 * th, tw, th);
                    // +0.5px overdraw hides seams between tiles at fractional scales
                    draw_texture_ex(t, p.x, p.y, WHITE, DrawTextureParams { dest_size: Some(vec2(tw * s + 0.5, th * s + 0.5)), source: Some(src), ..Default::default() });
                }
            }
        }
    }

    fn draw_parallax(&self, pv: &ParallaxV, _wp: Vec2, s: f32) {
        let Some(t) = self.assets.textures.get(&pv.tex) else { return };
        let (sw, sh) = (screen_width(), screen_height());
        let d = &self.project.display;
        let scale = (d.height / t.height()) * s; // fit height of the design area, tile horizontally
        let w = t.width() * scale;
        let off = -(self.camera.pos.x * pv.factor.x * s).rem_euclid(w);
        let mut x = off;
        while x < sw {
            draw_texture_ex(t, x, 0.0, WHITE, DrawTextureParams { dest_size: Some(vec2(w + 0.5, sh.max(t.height() * scale))), ..Default::default() });
            x += w;
        }
    }

    // ---- UI (egui) ----------------------------------------------------------------------------
    #[cfg(feature = "ui")]
    pub fn ui_frame(&mut self, egui_ctx: &egui_macroquad::egui::Context) {
        use egui_macroquad::egui::{self, Align2, Area, Color32, Id, RichText};
        let mut clicked: Vec<String> = vec![];
        for id in self.ids() {
            let Some(e) = self.get(id) else { continue };
            if !e.enabled {
                continue;
            }
            let Some(u) = &e.ui else { continue };
            let (al, off) = match u.anchor.as_str() {
                "tr" => (Align2::RIGHT_TOP, [-u.pos.x, u.pos.y]),
                "bl" => (Align2::LEFT_BOTTOM, [u.pos.x, -u.pos.y]),
                "br" => (Align2::RIGHT_BOTTOM, [-u.pos.x, -u.pos.y]),
                _ => (Align2::LEFT_TOP, [u.pos.x, u.pos.y]),
            };
            let c32 = |c: Color| Color32::from_rgba_unmultiplied((c.r * 255.0) as u8, (c.g * 255.0) as u8, (c.b * 255.0) as u8, (c.a * 255.0) as u8);
            Area::new(Id::new(("nord-ui", id.idx, id.gen))).anchor(al, off).show(egui_ctx, |ui| match &u.widget {
                UiWidget::Label { text, size, color } => {
                    ui.label(RichText::new(text).size(*size).color(c32(*color)));
                }
                UiWidget::Bar { value, size, .. } => {
                    ui.add_sized([size.x, size.y], egui::ProgressBar::new(*value));
                }
                UiWidget::Button { text, event } => {
                    if ui.button(text).clicked() && !event.is_empty() {
                        clicked.push(event.clone());
                    }
                }
                UiWidget::Panel { size } => {
                    ui.allocate_space(egui::vec2(size.x, size.y));
                }
            });
        }
        for ev in clicked {
            self.events.push((ev, 1.0));
        }
        for id in self.ids() {
            let n = self.get(id).map_or(0, |e| e.scripts.len());
            for slot in 0..n {
                self.call(id, slot, |s, c| s.ui(c, egui_ctx));
            }
        }
    }
}

impl Emitter {
    fn update(&mut self, dt: f32, origin: Vec2) {
        if self.on && self.period > 0.0 {
            self.acc += dt;
            while self.acc >= self.period {
                self.acc -= self.period;
                for _ in 0..self.quantity {
                    self.spawn(origin);
                }
            }
        }
        for p in &mut self.parts {
            p.age += dt;
            p.vel.y += self.gravity_y * dt;
            p.pos += p.vel * dt;
        }
        self.parts.retain(|p| p.age < p.life);
    }
    fn spawn(&mut self, origin: Vec2) {
        let a = rand::gen_range(self.angle.0, self.angle.1).to_radians();
        let sp = rand::gen_range(self.speed.0, self.speed.1);
        self.parts.push(Particle { pos: origin, vel: vec2(a.cos(), a.sin()) * sp, age: 0.0, life: self.lifespan });
    }
}

fn emitter_from(c: &Value) -> Emitter {
    let pair = |k: &str, d: (f32, f32)| c.get(k).and_then(Value::as_array).filter(|a| a.len() == 2).map_or(d, |a| (a[0].as_f64().unwrap_or(d.0 as f64) as f32, a[1].as_f64().unwrap_or(d.1 as f64) as f32));
    let mut em = Emitter {
        tex: s(c, "texture").map(String::from),
        lifespan: f(c, "lifespan", 800.0) / 1000.0,
        speed: pair("speed", (40.0, 120.0)),
        angle: pair("angle", (0.0, 360.0)),
        scale: pair("scale", (1.0, 0.0)),
        alpha: pair("alpha", (1.0, 0.0)),
        gravity_y: f(c, "gravityY", 0.0),
        tint: s(c, "tint").map_or(WHITE, parse_color),
        period: f(c, "frequency", 60.0) / 1000.0,
        quantity: f(c, "quantity", 1.0) as u32,
        on: b(c, "emitting", true) && c.get("burst").is_none(),
        acc: 0.0,
        parts: vec![],
    };
    if let Some(n) = c.get("burst").and_then(Value::as_u64) {
        for _ in 0..n {
            em.spawn(Vec2::ZERO);
        }
    }
    em
}
