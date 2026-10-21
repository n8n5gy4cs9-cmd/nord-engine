//! Particle editor model + a small CPU simulation for the live preview (M10-20). The preview approximates the runtime emitter
//! (`runtime/phaser/components.js`, component `particles`); it is for tuning, not pixel-exact. Property curves are lists of values spread evenly
//! over a particle's life (`scaleCurve`, `alphaCurve`).
use nord_core::scene::Component;
use serde_json::{json, Value};

#[derive(Clone, Debug, PartialEq)]
pub struct Params {
    pub texture: String,
    pub lifespan: f64,
    pub speed: [f64; 2],
    pub angle: [f64; 2],
    pub scale: [f64; 2],
    pub alpha: [f64; 2],
    pub scale_curve: Vec<f64>,
    pub alpha_curve: Vec<f64>,
    pub gravity: [f64; 2],
    pub tint: [u8; 3],
    pub tint_end: Option<[u8; 3]>,
    pub spin: f64,
    pub emit_radius: f64,
    pub frequency: f64,
    pub quantity: usize,
    pub burst: usize,
    pub additive: bool,
}

fn pair(v: &Value, d: [f64; 2]) -> [f64; 2] {
    [v[0].as_f64().unwrap_or(d[0]), v[1].as_f64().unwrap_or(d[1])]
}
fn nums(v: &Value) -> Vec<f64> {
    v.as_array()
        .map(|a| a.iter().filter_map(Value::as_f64).collect())
        .unwrap_or_default()
}
fn hex(s: &str) -> Option<[u8; 3]> {
    let h = s.trim().trim_start_matches('#');
    let v = u32::from_str_radix(h.get(..6)?, 16).ok()?;
    Some([(v >> 16) as u8, (v >> 8) as u8, v as u8])
}
fn to_hex(c: [u8; 3]) -> String {
    format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2])
}

impl Params {
    pub fn from_json(d: &Value) -> Self {
        Self {
            texture: d["texture"]
                .as_str()
                .unwrap_or("assets/sprites/particle.png")
                .into(),
            lifespan: d["lifespan"].as_f64().unwrap_or(800.0),
            speed: pair(&d["speed"], [40.0, 120.0]),
            angle: pair(&d["angle"], [0.0, 360.0]),
            scale: pair(&d["scale"], [1.0, 0.0]),
            alpha: pair(&d["alpha"], [1.0, 0.0]),
            scale_curve: nums(&d["scaleCurve"]),
            alpha_curve: nums(&d["alphaCurve"]),
            gravity: [
                d["gravityX"].as_f64().unwrap_or(0.0),
                d["gravityY"].as_f64().unwrap_or(0.0),
            ],
            tint: d["tint"].as_str().and_then(hex).unwrap_or([255, 255, 255]),
            tint_end: d["tintEnd"].as_str().and_then(hex),
            spin: d["spin"].as_f64().unwrap_or(0.0),
            emit_radius: d["emitRadius"].as_f64().unwrap_or(0.0),
            frequency: d["frequency"].as_f64().unwrap_or(60.0),
            quantity: d["quantity"].as_u64().unwrap_or(1) as usize,
            burst: d["burst"].as_u64().unwrap_or(0) as usize,
            additive: d["blend"].as_str() != Some("normal"),
        }
    }

    /// Write the parameters into a component JSON object (other keys such as `emitting` are kept; empty optionals are removed).
    pub fn write_to(&self, c: &mut Component) {
        let f = &mut c.fields;
        f.insert("texture".into(), json!(self.texture));
        f.insert("lifespan".into(), json!(self.lifespan));
        f.insert("speed".into(), json!(self.speed));
        f.insert("angle".into(), json!(self.angle));
        f.insert("scale".into(), json!(self.scale));
        f.insert("alpha".into(), json!(self.alpha));
        f.insert("gravityY".into(), json!(self.gravity[1]));
        f.insert("tint".into(), json!(to_hex(self.tint)));
        f.insert("frequency".into(), json!(self.frequency));
        f.insert(
            "blend".into(),
            json!(if self.additive { "add" } else { "normal" }),
        );
        let opt = |f: &mut serde_json::Map<String, Value>, k: &str, on: bool, v: Value| {
            if on {
                f.insert(k.into(), v);
            } else {
                f.remove(k);
            }
        };
        opt(
            f,
            "scaleCurve",
            self.scale_curve.len() >= 2,
            json!(self.scale_curve),
        );
        opt(
            f,
            "alphaCurve",
            self.alpha_curve.len() >= 2,
            json!(self.alpha_curve),
        );
        opt(
            f,
            "gravityX",
            self.gravity[0] != 0.0,
            json!(self.gravity[0]),
        );
        opt(
            f,
            "tintEnd",
            self.tint_end.is_some(),
            json!(self.tint_end.map(to_hex)),
        );
        opt(f, "spin", self.spin != 0.0, json!(self.spin));
        opt(
            f,
            "emitRadius",
            self.emit_radius > 0.0,
            json!(self.emit_radius),
        );
        opt(f, "quantity", self.quantity > 1, json!(self.quantity));
        opt(f, "burst", self.burst > 0, json!(self.burst));
    }
}

/// Value of an evenly spaced curve at `t` (0..1); with fewer than two points returns `fallback`.
pub fn curve_at(curve: &[f64], t: f64, fallback: f64) -> f64 {
    if curve.len() < 2 {
        return fallback;
    }
    let x = t.clamp(0.0, 1.0) * (curve.len() - 1) as f64;
    let i = (x.floor() as usize).min(curve.len() - 2);
    curve[i] + (curve[i + 1] - curve[i]) * (x - i as f64)
}

pub const PRESETS: &[(&str, &str)] = &[
    (
        "fire",
        r##"{"lifespan":700,"speed":[20,60],"angle":[250,290],"scale":[1,0],"alpha":[0.9,0],"gravityY":-40,"tint":"#ff8a3c","tintEnd":"#7a1010","frequency":30,"blend":"add"}"##,
    ),
    (
        "smoke",
        r##"{"lifespan":1600,"speed":[10,30],"angle":[255,285],"scale":[0.5,2],"alpha":[0.4,0],"gravityY":-10,"tint":"#8f98a8","frequency":90,"blend":"normal"}"##,
    ),
    (
        "sparks",
        r##"{"lifespan":400,"speed":[100,260],"angle":[0,360],"scale":[0.5,0],"alpha":[1,0],"gravityY":400,"tint":"#ffe08a","frequency":20,"blend":"add"}"##,
    ),
    (
        "explosion",
        r##"{"lifespan":600,"speed":[80,320],"angle":[0,360],"scale":[1.4,0],"alpha":[1,0],"tint":"#ff6a3c","tintEnd":"#401000","burst":40,"blend":"add"}"##,
    ),
    (
        "rain",
        r##"{"lifespan":900,"speed":[380,460],"angle":[80,85],"scale":[0.3,0.3],"alpha":[0.6,0.6],"tint":"#a8c8ff","frequency":12,"blend":"normal"}"##,
    ),
    (
        "snow",
        r##"{"lifespan":4000,"speed":[20,50],"angle":[70,110],"scale":[0.4,0.4],"alpha":[0.9,0.9],"tint":"#ffffff","frequency":60,"emitRadius":120,"blend":"normal"}"##,
    ),
    (
        "magic",
        r##"{"lifespan":900,"speed":[10,50],"angle":[0,360],"scale":[0.8,0],"alphaCurve":[0,1,0],"scaleCurve":[0.2,1,0],"gravityY":-30,"tint":"#b48ead","tintEnd":"#88c0d0","spin":120,"frequency":40,"blend":"add"}"##,
    ),
    (
        "hit",
        r##"{"lifespan":250,"speed":[60,180],"angle":[0,360],"scale":[0.8,0],"alpha":[1,0],"tint":"#ffffff","burst":10,"blend":"add"}"##,
    ),
    (
        "dust",
        r##"{"lifespan":500,"speed":[10,40],"angle":[200,340],"scale":[0.5,1.2],"alpha":[0.5,0],"tint":"#c9b79c","burst":6,"blend":"normal"}"##,
    ),
    (
        "coin",
        r##"{"lifespan":700,"speed":[80,200],"angle":[230,310],"scale":[0.7,0],"alpha":[1,0],"gravityY":500,"tint":"#ebcb8b","burst":12,"blend":"add"}"##,
    ),
    (
        "confetti",
        r##"{"lifespan":2000,"speed":[120,300],"angle":[200,340],"scale":[0.7,0.7],"alpha":[1,0],"gravityY":300,"tint":"#a3be8c","burst":60,"blend":"normal"}"##,
    ),
];

pub fn preset(name: &str) -> Option<Params> {
    let (_, j) = PRESETS.iter().find(|(n, _)| *n == name)?;
    Some(Params::from_json(&serde_json::from_str(j).ok()?))
}

#[derive(Clone, Copy)]
pub struct Particle {
    pub pos: [f64; 2],
    pub vel: [f64; 2],
    pub age: f64,
    pub life: f64,
    pub rot_speed: f64,
}

pub struct Sim {
    pub parts: Vec<Particle>,
    acc: f64,
    rng: u64,
}

impl Default for Sim {
    fn default() -> Self {
        Self {
            parts: vec![],
            acc: 0.0,
            rng: 0x2545_F491_4F6C_DD1D,
        }
    }
}

impl Sim {
    fn rand(&mut self) -> f64 {
        self.rng ^= self.rng << 13;
        self.rng ^= self.rng >> 7;
        self.rng ^= self.rng << 17;
        (self.rng >> 11) as f64 / (1u64 << 53) as f64
    }
    fn between(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * self.rand()
    }

    pub fn emit(&mut self, p: &Params, n: usize) {
        for _ in 0..n {
            let ang = self.between(p.angle[0], p.angle[1]).to_radians();
            let sp = self.between(p.speed[0], p.speed[1]);
            let r = p.emit_radius * self.rand().sqrt();
            let a = self.rand() * std::f64::consts::TAU;
            self.parts.push(Particle {
                pos: [r * a.cos(), r * a.sin()],
                vel: [ang.cos() * sp, ang.sin() * sp],
                age: 0.0,
                life: p.lifespan / 1000.0,
                rot_speed: p.spin,
            });
        }
    }

    /// Advance by `dt` seconds; `emitting` runs the continuous emitter (every `frequency` ms, `quantity` per tick).
    pub fn step(&mut self, p: &Params, dt: f64, emitting: bool) {
        if emitting && p.frequency > 0.0 {
            self.acc += dt * 1000.0;
            let mut guard = 0;
            while self.acc >= p.frequency && guard < 200 {
                self.acc -= p.frequency;
                self.emit(p, p.quantity.max(1));
                guard += 1;
            }
        }
        for q in &mut self.parts {
            q.vel[0] += p.gravity[0] * dt;
            q.vel[1] += p.gravity[1] * dt;
            q.pos[0] += q.vel[0] * dt;
            q.pos[1] += q.vel[1] * dt;
            q.age += dt;
        }
        self.parts.retain(|q| q.age < q.life);
        if self.parts.len() > 2000 {
            self.parts.drain(..self.parts.len() - 2000);
        }
    }

    /// (scale, alpha, tint) of a particle at its current age.
    pub fn look(p: &Params, q: &Particle) -> (f64, f64, [u8; 3]) {
        let t = (q.age / q.life).clamp(0.0, 1.0);
        let s = if p.scale_curve.len() >= 2 {
            curve_at(&p.scale_curve, t, 1.0)
        } else {
            p.scale[0] + (p.scale[1] - p.scale[0]) * t
        };
        let a = if p.alpha_curve.len() >= 2 {
            curve_at(&p.alpha_curve, t, 1.0)
        } else {
            p.alpha[0] + (p.alpha[1] - p.alpha[0]) * t
        };
        let c = match p.tint_end {
            Some(e) => {
                [0, 1, 2].map(|i| (p.tint[i] as f64 + (e[i] as f64 - p.tint[i] as f64) * t) as u8)
            }
            None => p.tint,
        };
        (s.max(0.0), a.clamp(0.0, 1.0), c)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_roundtrip_keeps_unknown_keys_and_drops_empty_options() {
        let mut c = Component {
            kind: "particles".into(),
            fields: Default::default(),
        };
        c.fields.insert("emitting".into(), json!(false));
        let mut p = preset("magic").unwrap();
        p.write_to(&mut c);
        assert_eq!(c.fields["emitting"], false, "foreign key kept");
        assert_eq!(c.fields["scaleCurve"], json!([0.2, 1.0, 0.0]));
        assert_eq!(c.fields["tintEnd"], "#88c0d0");
        let back = Params::from_json(&Value::Object(c.fields.clone()));
        assert_eq!(back, p);
        p.scale_curve.clear();
        p.tint_end = None;
        p.spin = 0.0;
        p.write_to(&mut c);
        assert!(
            c.fields.get("scaleCurve").is_none()
                && c.fields.get("tintEnd").is_none()
                && c.fields.get("spin").is_none()
        );
        assert!(
            PRESETS.iter().all(|(n, _)| preset(n).is_some()),
            "every preset parses"
        );
    }

    #[test]
    fn curves_and_simulation() {
        assert_eq!(curve_at(&[0.0, 1.0, 0.0], 0.25, 9.0), 0.5);
        assert_eq!(curve_at(&[0.0, 1.0, 0.0], 1.0, 9.0), 0.0);
        assert_eq!(curve_at(&[5.0], 0.5, 9.0), 9.0);
        let mut p = preset("sparks").unwrap();
        p.gravity = [0.0, 0.0];
        let mut s = Sim::default();
        for _ in 0..60 {
            s.step(&p, 1.0 / 60.0, true);
        }
        let n = s.parts.len();
        assert!(
            n > 10 && n < 40,
            "≈ 400 ms of emission at one per 20 ms ({n})"
        );
        // everything dies once emission stops
        for _ in 0..60 {
            s.step(&p, 1.0 / 60.0, false);
        }
        assert!(s.parts.is_empty());
        let mut b = Sim::default();
        b.emit(&preset("explosion").unwrap(), 40);
        assert_eq!(b.parts.len(), 40);
        let (sc, al, c) = Sim::look(
            &p,
            &Particle {
                pos: [0.0; 2],
                vel: [0.0; 2],
                age: 0.2,
                life: 0.4,
                rot_speed: 0.0,
            },
        );
        assert!((sc - 0.25).abs() < 1e-9 && (al - 0.5).abs() < 1e-9 && c == p.tint);
    }
}
