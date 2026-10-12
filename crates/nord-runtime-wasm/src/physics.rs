//! rapier2d wrapper. World units: entity positions are pixels (y down); rapier runs in metres (`PPM` px per metre), same y-down axes.
use crate::world::EntityId;
use macroquad::prelude::Vec2;
use rapier2d::prelude::*;
use std::collections::HashMap;
use std::sync::Mutex;

pub const PPM: f32 = 32.0;
pub const FIXED_DT: f32 = 1.0 / 60.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BodyMode {
    Static,
    Dynamic,
    Kinematic,
}

/// What `world.rs` asks for when an entity has `rigidbody` / `collider` components.
#[derive(Debug, Clone)]
pub struct BodyDesc {
    pub mode: BodyMode,
    pub mass: f32,
    pub gravity_scale: f32,
    pub fixed_rotation: bool,
    pub drag: f32,
    pub bounce: f32,
    pub friction: f32,
    pub shape: ShapeDesc,
    pub offset: Vec2,
    pub trigger: bool,
}

#[derive(Debug, Clone, Copy)]
pub enum ShapeDesc {
    Box(Vec2),
    Circle(f32),
    Capsule(Vec2),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContactKind {
    CollisionEnter,
    CollisionExit,
    TriggerEnter,
    TriggerExit,
}

struct Collector(Mutex<Vec<CollisionEvent>>);
impl EventHandler for Collector {
    fn handle_collision_event(&self, _: &RigidBodySet, _: &ColliderSet, e: CollisionEvent, _: Option<&ContactPair>) {
        self.0.lock().unwrap().push(e);
    }
    fn handle_contact_force_event(&self, _: Real, _: &RigidBodySet, _: &ColliderSet, _: &ContactPair, _: Real) {}
}

pub struct Physics {
    gravity: Vector<Real>,
    params: IntegrationParameters,
    pipeline: PhysicsPipeline,
    islands: IslandManager,
    broad: DefaultBroadPhase,
    narrow: NarrowPhase,
    pub bodies: RigidBodySet,
    pub colliders: ColliderSet,
    joints: ImpulseJointSet,
    mjoints: MultibodyJointSet,
    ccd: CCDSolver,
    events: Collector,
    owner: HashMap<ColliderHandle, EntityId>,
}

fn v(p: Vec2) -> Vector<Real> {
    vector![p.x / PPM, p.y / PPM]
}
fn px(p: &Vector<Real>) -> Vec2 {
    Vec2::new(p.x * PPM, p.y * PPM)
}

impl Physics {
    pub fn new(gravity_px: Vec2) -> Self {
        let mut params = IntegrationParameters::default();
        params.dt = FIXED_DT;
        Self {
            gravity: v(gravity_px),
            params,
            pipeline: PhysicsPipeline::new(),
            islands: IslandManager::new(),
            broad: DefaultBroadPhase::new(),
            narrow: NarrowPhase::new(),
            bodies: RigidBodySet::new(),
            colliders: ColliderSet::new(),
            joints: ImpulseJointSet::new(),
            mjoints: MultibodyJointSet::new(),
            ccd: CCDSolver::new(),
            events: Collector(Mutex::new(vec![])),
            owner: HashMap::new(),
        }
    }

    pub fn set_gravity(&mut self, g: Vec2) {
        self.gravity = v(g);
    }

    /// Create body + collider for an entity at `pos` (px) / `rot` (degrees).
    pub fn add(&mut self, id: EntityId, pos: Vec2, rot: f32, d: &BodyDesc) -> (RigidBodyHandle, ColliderHandle) {
        let builder = match d.mode {
            BodyMode::Static => RigidBodyBuilder::fixed(),
            BodyMode::Dynamic => RigidBodyBuilder::dynamic().gravity_scale(d.gravity_scale).linear_damping(d.drag),
            BodyMode::Kinematic => RigidBodyBuilder::kinematic_position_based(),
        };
        let mut b = builder.translation(v(pos)).rotation(rot.to_radians());
        if d.fixed_rotation {
            b = b.lock_rotations();
        }
        let body = self.bodies.insert(b.build());
        let shape = match d.shape {
            ShapeDesc::Box(s) => ColliderBuilder::cuboid(s.x / PPM / 2.0, s.y / PPM / 2.0),
            ShapeDesc::Circle(r) => ColliderBuilder::ball(r / PPM),
            ShapeDesc::Capsule(s) => {
                let r = s.x.min(s.y) / 2.0;
                let h = ((s.y - s.x).max(0.0) / 2.0) / PPM;
                ColliderBuilder::capsule_y(h, r / PPM)
            }
        };
        let mass = if d.mode == BodyMode::Dynamic { d.mass.max(0.01) } else { 1.0 };
        let c = shape
            .translation(v(d.offset))
            .sensor(d.trigger)
            .restitution(d.bounce)
            .friction(d.friction)
            .density(if d.mode == BodyMode::Dynamic { mass } else { 1.0 })
            .active_events(ActiveEvents::COLLISION_EVENTS)
            .active_collision_types(ActiveCollisionTypes::all())
            .build();
        let col = self.colliders.insert_with_parent(c, body, &mut self.bodies);
        self.owner.insert(col, id);
        (body, col)
    }

    /// Static box collider without a body (tile runs).
    pub fn add_static_box(&mut self, id: EntityId, center: Vec2, size: Vec2) -> ColliderHandle {
        let c = ColliderBuilder::cuboid(size.x / PPM / 2.0, size.y / PPM / 2.0).translation(v(center)).friction(0.0).build();
        let h = self.colliders.insert(c);
        self.owner.insert(h, id);
        h
    }

    pub fn remove(&mut self, body: Option<RigidBodyHandle>, col: Option<ColliderHandle>) {
        if let Some(c) = col {
            self.owner.remove(&c);
        }
        if let Some(b) = body {
            self.bodies.remove(b, &mut self.islands, &mut self.colliders, &mut self.joints, &mut self.mjoints, true);
        }
    }

    /// Remove a body-less collider (tile runs).
    pub fn remove_collider(&mut self, c: ColliderHandle) {
        self.owner.remove(&c);
        self.colliders.remove(c, &mut self.islands, &mut self.bodies, false);
    }

    pub fn pos(&self, b: RigidBodyHandle) -> Option<(Vec2, f32)> {
        self.bodies.get(b).map(|r| (px(r.translation()), r.rotation().angle().to_degrees()))
    }
    pub fn teleport(&mut self, b: RigidBodyHandle, p: Vec2) {
        if let Some(r) = self.bodies.get_mut(b) {
            if r.is_kinematic() {
                r.set_next_kinematic_translation(v(p));
            } else {
                r.set_translation(v(p), true);
                r.set_linvel(vector![0.0, 0.0], true);
            }
        }
    }
    pub fn set_kinematic_target(&mut self, b: RigidBodyHandle, p: Vec2) {
        if let Some(r) = self.bodies.get_mut(b) {
            r.set_next_kinematic_translation(v(p));
        }
    }
    pub fn vel(&self, b: RigidBodyHandle) -> Vec2 {
        self.bodies.get(b).map_or(Vec2::ZERO, |r| px(r.linvel()))
    }
    /// Set velocity components in px/s (`None` keeps the current one).
    pub fn set_vel(&mut self, b: RigidBodyHandle, x: Option<f32>, y: Option<f32>) {
        if let Some(r) = self.bodies.get_mut(b) {
            let c = r.linvel();
            r.set_linvel(vector![x.map_or(c.x, |x| x / PPM), y.map_or(c.y, |y| y / PPM)], true);
        }
    }
    pub fn impulse(&mut self, b: RigidBodyHandle, i: Vec2) {
        if let Some(r) = self.bodies.get_mut(b) {
            r.apply_impulse(v(i), true);
        }
    }
    pub fn set_enabled(&mut self, b: RigidBodyHandle, on: bool) {
        if let Some(r) = self.bodies.get_mut(b) {
            r.set_enabled(on);
        }
    }

    /// True when something solid touches the collider from below (y grows downward) with a mostly vertical contact normal.
    pub fn grounded(&self, col: ColliderHandle) -> bool {
        let Some(me) = self.colliders.get(col) else { return false };
        let my_y = me.translation().y;
        for pair in self.narrow.contact_pairs_with(col) {
            if !pair.has_any_active_contact {
                continue;
            }
            let other = if pair.collider1 == col { pair.collider2 } else { pair.collider1 };
            let Some(o) = self.colliders.get(other) else { continue };
            if o.is_sensor() {
                continue;
            }
            for m in &pair.manifolds {
                if m.data.normal.y.abs() > 0.7 && o.translation().y > my_y && m.points.iter().any(|p| p.dist < 0.05) {
                    return true;
                }
            }
        }
        false
    }

    /// Entities whose colliders overlap the box centred at `c` (px).
    pub fn overlap_box(&self, c: Vec2, size: Vec2) -> Vec<EntityId> {
        let shape = SharedShape::cuboid(size.x / PPM / 2.0, size.y / PPM / 2.0);
        let pos = Isometry::translation(c.x / PPM, c.y / PPM);
        let mut out = vec![];
        for (h, col) in self.colliders.iter() {
            if let Ok(true) = rapier2d::parry::query::intersection_test(&pos, shape.as_ref(), col.position(), col.shape()) {
                if let Some(id) = self.owner.get(&h) {
                    if !out.contains(id) {
                        out.push(*id);
                    }
                }
            }
        }
        out
    }

    /// Step once (FIXED_DT) and return contact events as `(kind, a, b)` entity pairs.
    pub fn step(&mut self) -> Vec<(ContactKind, EntityId, EntityId)> {
        self.pipeline.step(
            &self.gravity,
            &self.params,
            &mut self.islands,
            &mut self.broad,
            &mut self.narrow,
            &mut self.bodies,
            &mut self.colliders,
            &mut self.joints,
            &mut self.mjoints,
            &mut self.ccd,
            None,
            &(),
            &self.events,
        );
        let raw: Vec<CollisionEvent> = std::mem::take(&mut *self.events.0.lock().unwrap());
        raw.into_iter()
            .filter_map(|e| {
                let (a, b) = (self.owner.get(&e.collider1()).copied()?, self.owner.get(&e.collider2()).copied()?);
                let sensor = e.sensor();
                Some((
                    match (e.started(), sensor) {
                        (true, false) => ContactKind::CollisionEnter,
                        (false, false) => ContactKind::CollisionExit,
                        (true, true) => ContactKind::TriggerEnter,
                        (false, true) => ContactKind::TriggerExit,
                    },
                    a,
                    b,
                ))
            })
            .collect()
    }
}
