//! Particle editor (M10-20): edits the selected entity's `particles` component with a live preview, presets and property curves.
//! Model + simulation: `crate::particles`. Every change goes through `EditorState::edit` (undo, autosave, viewport sync).
use crate::particles::{self, Params, Sim};
use crate::state::EditorState;
use egui::{Color32, Pos2, Rect, RichText, Sense, Stroke, Ui, Vec2};
use nord_core::assets::AssetType;
use nord_core::scene::Component;

#[derive(Default)]
pub struct ParticlesUi {
    pub sim: Sim,
    pub paused: bool,
    pub loop_burst: f64,
}

fn find_comp<'a>(ents: &'a mut [nord_core::scene::Entity], id: &str) -> Option<&'a mut Component> {
    for e in ents {
        if e.id == id {
            return e.components.iter_mut().find(|c| c.kind == "particles");
        }
        if let Some(c) = find_comp(&mut e.children, id) {
            return Some(c);
        }
    }
    None
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(sel) = st.selected().cloned() else {
        ui.weak("Select an entity (Hierarchy) to edit its particles");
        return;
    };
    let Some(comp) = sel.components.iter().find(|c| c.kind == "particles") else {
        ui.label(format!("{} has no particles component.", sel.name));
        if ui.button("Add particles component (sparks)").clicked() {
            let id = sel.id.clone();
            st.edit("Add particles", None, |ents| {
                if let Some(e) = find_entity(ents, &id) {
                    let mut c = Component {
                        kind: "particles".into(),
                        fields: Default::default(),
                    };
                    particles::preset("sparks").unwrap().write_to(&mut c);
                    e.components.push(c);
                }
            });
        }
        return;
    };
    let cur = Params::from_json(&serde_json::Value::Object(comp.fields.clone()));
    let mut p = cur.clone();
    let images: Vec<String> = st
        .assets
        .iter()
        .filter(|a| matches!(a.kind, AssetType::Image | AssetType::Spritesheet))
        .map(|a| a.path.clone())
        .collect();
    egui::SidePanel::left("particle-controls")
        .default_width(330.0)
        .show_inside(ui, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| controls(ui, &mut p, &images));
        });
    preview(st, ui, &p);
    if p != cur {
        let id = sel.id.clone();
        let q = p.clone();
        st.edit("Edit particles", Some("particles"), move |ents| {
            if let Some(c) = find_comp(ents, &id) {
                q.write_to(c);
            }
        });
    }
}

fn find_entity<'a>(
    list: &'a mut [nord_core::scene::Entity],
    id: &str,
) -> Option<&'a mut nord_core::scene::Entity> {
    for e in list {
        if e.id == id {
            return Some(e);
        }
        if let Some(f) = find_entity(&mut e.children, id) {
            return Some(f);
        }
    }
    None
}

fn range(ui: &mut Ui, label: &str, v: &mut [f64; 2], lo: f64, hi: f64, speed: f64) {
    ui.horizontal(|ui| {
        ui.label(label);
        ui.add(egui::DragValue::new(&mut v[0]).range(lo..=hi).speed(speed));
        ui.label("–");
        ui.add(egui::DragValue::new(&mut v[1]).range(lo..=hi).speed(speed));
    });
}

fn color(ui: &mut Ui, c: &mut [u8; 3]) {
    let mut col = Color32::from_rgb(c[0], c[1], c[2]);
    if ui.color_edit_button_srgba(&mut col).changed() {
        *c = [col.r(), col.g(), col.b()];
    }
}

fn controls(ui: &mut Ui, p: &mut Params, images: &[String]) {
    ui.horizontal(|ui| {
        ui.label("Preset");
        egui::ComboBox::from_id_salt("particle-preset")
            .selected_text("choose…")
            .show_ui(ui, |ui| {
                for (name, _) in particles::PRESETS {
                    if ui.selectable_label(false, *name).clicked() {
                        if let Some(mut q) = particles::preset(name) {
                            q.texture = p.texture.clone();
                            *p = q;
                        }
                    }
                }
            });
    });
    egui::ComboBox::from_id_salt("particle-tex")
        .selected_text(p.texture.clone())
        .show_ui(ui, |ui| {
            for i in images {
                ui.selectable_value(&mut p.texture, i.clone(), i);
            }
        });
    ui.separator();
    ui.label(RichText::new("Emission").strong());
    ui.horizontal(|ui| {
        ui.add(
            egui::DragValue::new(&mut p.frequency)
                .range(0.0..=2000.0)
                .prefix("every ")
                .suffix(" ms"),
        )
        .on_hover_text("0 = no continuous emission");
        ui.add(
            egui::DragValue::new(&mut p.quantity)
                .range(1..=50)
                .prefix("× "),
        );
    });
    ui.add(
        egui::DragValue::new(&mut p.burst)
            .range(0..=500)
            .prefix("burst on start: "),
    );
    ui.add(
        egui::DragValue::new(&mut p.emit_radius)
            .range(0.0..=1000.0)
            .prefix("spawn radius "),
    );
    ui.add(
        egui::DragValue::new(&mut p.lifespan)
            .range(50.0..=20000.0)
            .prefix("lifespan ")
            .suffix(" ms"),
    );
    ui.separator();
    ui.label(RichText::new("Motion").strong());
    range(ui, "speed", &mut p.speed, 0.0, 2000.0, 1.0);
    range(ui, "angle°", &mut p.angle, -720.0, 720.0, 1.0);
    ui.horizontal(|ui| {
        ui.add(
            egui::DragValue::new(&mut p.gravity[0])
                .speed(1.0)
                .prefix("gravity x "),
        );
        ui.add(
            egui::DragValue::new(&mut p.gravity[1])
                .speed(1.0)
                .prefix("y "),
        );
    });
    ui.add(
        egui::DragValue::new(&mut p.spin)
            .speed(1.0)
            .prefix("spin °/s "),
    );
    ui.separator();
    ui.label(RichText::new("Look").strong());
    curve_prop(
        ui,
        "Scale",
        &mut p.scale,
        &mut p.scale_curve,
        3.0,
        "scale-curve",
    );
    curve_prop(
        ui,
        "Opacity",
        &mut p.alpha,
        &mut p.alpha_curve,
        1.0,
        "alpha-curve",
    );
    ui.horizontal(|ui| {
        ui.label("Colour");
        color(ui, &mut p.tint);
        let mut grad = p.tint_end.is_some();
        if ui.checkbox(&mut grad, "end colour").changed() {
            p.tint_end = grad.then_some(p.tint);
        }
        if let Some(e) = &mut p.tint_end {
            color(ui, e);
        }
    });
    ui.checkbox(&mut p.additive, "additive blending (glow)");
}

/// start→end pair, or an editable curve over the particle's life.
fn curve_prop(
    ui: &mut Ui,
    label: &str,
    pair: &mut [f64; 2],
    curve: &mut Vec<f64>,
    max: f64,
    id: &str,
) {
    ui.horizontal(|ui| {
        ui.label(label);
        let mut on = curve.len() >= 2;
        if ui.checkbox(&mut on, "curve").changed() {
            *curve = if on {
                vec![pair[0], (pair[0] + pair[1]) / 2.0, pair[1]]
            } else {
                vec![]
            };
        }
        if curve.len() < 2 {
            ui.add(
                egui::DragValue::new(&mut pair[0])
                    .speed(0.01)
                    .range(0.0..=max)
                    .prefix("start "),
            );
            ui.add(
                egui::DragValue::new(&mut pair[1])
                    .speed(0.01)
                    .range(0.0..=max)
                    .prefix("end "),
            );
        } else {
            let mut n = curve.len();
            if ui
                .add(egui::DragValue::new(&mut n).range(2..=8).prefix("points "))
                .changed()
            {
                let old = curve.clone();
                *curve = (0..n)
                    .map(|i| particles::curve_at(&old, i as f64 / (n - 1) as f64, 0.0))
                    .collect();
            }
        }
    });
    if curve.len() >= 2 {
        let (r, resp) = ui.allocate_exact_size(Vec2::new(220.0, 64.0), Sense::click_and_drag());
        let painter = ui.painter_at(r);
        painter.rect_filled(r, 2.0, Color32::from_gray(26));
        painter.hline(
            r.x_range(),
            r.bottom() - r.height() / max as f32,
            Stroke::new(1.0_f32, Color32::from_white_alpha(20)),
        );
        let n = curve.len();
        let pos = |i: usize, v: f64| {
            Pos2::new(
                r.left() + 6.0 + (r.width() - 12.0) * i as f32 / (n - 1) as f32,
                r.bottom() - 4.0 - (r.height() - 8.0) * (v / max).clamp(0.0, 1.0) as f32,
            )
        };
        let pts: Vec<Pos2> = curve.iter().enumerate().map(|(i, v)| pos(i, *v)).collect();
        painter.add(egui::Shape::line(
            pts.clone(),
            Stroke::new(2.0_f32, Color32::from_rgb(120, 200, 255)),
        ));
        for p in &pts {
            painter.circle_filled(*p, 4.0, Color32::from_rgb(255, 209, 102));
        }
        if let (Some(m), true) = (
            resp.interact_pointer_pos(),
            resp.dragged() || resp.clicked(),
        ) {
            // drag the point nearest to the pointer's x
            let i = (((m.x - r.left() - 6.0) / (r.width() - 12.0)) * (n - 1) as f32)
                .round()
                .clamp(0.0, (n - 1) as f32) as usize;
            curve[i] = (((r.bottom() - 4.0 - m.y) / (r.height() - 8.0)).clamp(0.0, 1.0) as f64
                * max
                * 100.0)
                .round()
                / 100.0;
        }
        let _ = id;
    }
}

fn preview(st: &mut EditorState, ui: &mut Ui, p: &Params) {
    ui.horizontal(|ui| {
        if ui.button("Burst").clicked() {
            let n = if p.burst > 0 { p.burst } else { 20 };
            st.particles_ui.sim.emit(p, n);
        }
        let pu = &mut st.particles_ui;
        ui.checkbox(&mut pu.paused, "pause emission");
        ui.weak(format!("{} particles", pu.sim.parts.len()));
    });
    let size = Vec2::new(
        ui.available_width().max(200.0),
        ui.available_height().clamp(200.0, 520.0),
    );
    let (r, _) = ui.allocate_exact_size(size, Sense::hover());
    let painter = ui.painter_at(r);
    painter.rect_filled(r, 4.0, Color32::from_rgb(20, 24, 32));
    let dt = ui.input(|i| i.stable_dt).min(0.1) as f64;
    let emitting = !st.particles_ui.paused && p.frequency > 0.0;
    st.particles_ui.sim.step(p, dt, emitting);
    if st.particles_ui.sim.parts.is_empty()
        && p.frequency <= 0.0
        && p.burst > 0
        && !st.particles_ui.paused
    {
        // burst-only presets replay every 1.5 s so the effect stays visible
        st.particles_ui.loop_burst += dt;
        if st.particles_ui.loop_burst > 1.5 {
            st.particles_ui.loop_burst = 0.0;
            st.particles_ui.sim.emit(p, p.burst);
        }
    }
    let origin = r.center() + Vec2::new(0.0, size.y * 0.15);
    for q in &st.particles_ui.sim.parts {
        let (s, a, c) = Sim::look(p, q);
        let col = Color32::from_rgba_unmultiplied(
            c[0],
            c[1],
            c[2],
            (a * if p.additive { 200.0 } else { 255.0 }) as u8,
        );
        painter.circle_filled(
            origin + Vec2::new(q.pos[0] as f32, q.pos[1] as f32),
            (6.0 * s as f32).max(0.5),
            col,
        );
    }
    painter.circle_stroke(
        origin,
        3.0,
        Stroke::new(1.0_f32, Color32::from_white_alpha(60)),
    );
    painter.text(
        r.left_top() + Vec2::new(6.0, 4.0),
        egui::Align2::LEFT_TOP,
        "preview (approximate)",
        egui::FontId::proportional(10.0),
        Color32::from_white_alpha(70),
    );
    ui.ctx().request_repaint();
    let _ = Rect::ZERO;
}
