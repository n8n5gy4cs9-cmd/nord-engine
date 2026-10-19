//! Timeline / keyframe editor (M10-21): tracks per property, keyframes on a time strip, easing (named or a drawn cubic-bezier), event
//! markers, scrub. Model: `crate::timeline`; data lives in `scene.settings.timelines` and plays through `runtime/core/timeline.js`
//! (event sheet *Timeline* actions or `scene.timelines.play(name)`).
use crate::state::EditorState;
use crate::timeline as tl;
use egui::{Color32, Pos2, Rect, RichText, Sense, Stroke, Ui, Vec2};
use serde_json::{json, Value};

#[derive(Default)]
pub struct TimelineUi {
    pub current: Option<String>,
    pub new_name: String,
    /// selected key: (track, key index)
    pub key: Option<(usize, usize)>,
    pub event: Option<usize>,
    pub scrub: f64,
    pub new_target: String,
    pub new_prop: usize,
}

const ROW: f32 = 34.0;
const LEFT: f32 = 150.0;

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    if st.scene.is_none() {
        ui.weak("No scene open");
        return;
    }
    let names = tl::names(st.scene.as_ref().unwrap());
    if st.timeline_ui.current.as_ref().is_none_or(|c| !names.contains(c)) {
        st.timeline_ui.current = names.first().cloned();
    }
    ui.horizontal_wrapped(|ui| {
        for n in &names {
            if ui.selectable_label(st.timeline_ui.current.as_deref() == Some(n), n).clicked() {
                st.timeline_ui.current = Some(n.clone());
                st.timeline_ui.key = None;
                st.timeline_ui.event = None;
            }
        }
        ui.add(egui::TextEdit::singleline(&mut st.timeline_ui.new_name).hint_text("new timeline").desired_width(110.0));
        if crate::icons::mini(ui, "plus", "Add timeline").clicked() && !st.timeline_ui.new_name.trim().is_empty() {
            let n = st.timeline_ui.new_name.trim().to_string();
            if st.edit_scene("Add timeline", None, |s| {
                tl::add_timeline(s, &n);
            }) {
                st.timeline_ui.current = Some(n);
                st.timeline_ui.new_name.clear();
            }
        }
        if let Some(c) = st.timeline_ui.current.clone() {
            if ui.button("Delete").clicked() {
                st.edit_scene("Delete timeline", None, |s| tl::delete_timeline(s, &c));
                st.timeline_ui.current = None;
            }
        }
    });
    let Some(name) = st.timeline_ui.current.clone() else {
        ui.weak("Create a timeline, then add tracks (object + property) and click the strip to add keyframes.");
        return;
    };
    ui.separator();
    let tlv = tl::get(st.scene.as_ref().unwrap(), &name).cloned().unwrap_or(Value::Null);
    let mut duration = tlv["duration"].as_f64().unwrap_or(2.0);
    let mut looped = tlv["loop"].as_bool().unwrap_or(false);
    let objects: Vec<String> = crate::layout::object_types(st.scene.as_ref().unwrap()).into_iter().map(|t| t.name).collect();
    ui.horizontal_wrapped(|ui| {
        let mut d = duration;
        if ui.add(egui::DragValue::new(&mut d).speed(0.05).range(0.1..=600.0).prefix("duration ").suffix(" s")).changed() {
            duration = d;
        }
        ui.checkbox(&mut looped, "loop");
        ui.separator();
        egui::ComboBox::from_id_salt("tl-target").selected_text(if st.timeline_ui.new_target.is_empty() { "object…".into() } else { st.timeline_ui.new_target.clone() }).show_ui(ui, |ui| {
            for o in &objects {
                ui.selectable_value(&mut st.timeline_ui.new_target, o.clone(), o);
            }
        });
        egui::ComboBox::from_id_salt("tl-prop").selected_text(tl::PROPERTIES[st.timeline_ui.new_prop.min(tl::PROPERTIES.len() - 1)]).show_ui(ui, |ui| {
            for (i, p) in tl::PROPERTIES.iter().enumerate() {
                ui.selectable_value(&mut st.timeline_ui.new_prop, i, *p);
            }
        });
        if ui.button("+ Track").clicked() && !st.timeline_ui.new_target.is_empty() {
            let (t, p) = (st.timeline_ui.new_target.clone(), tl::PROPERTIES[st.timeline_ui.new_prop.min(tl::PROPERTIES.len() - 1)]);
            let nm = name.clone();
            st.edit_scene("Add track", None, |s| {
                if let Some(x) = tl::timeline_mut(s, &nm) {
                    tl::add_track(x, &t, p);
                }
            });
        }
        if ui.button("+ Event marker").clicked() {
            let nm = name.clone();
            let at = st.timeline_ui.scrub;
            st.edit_scene("Add event marker", None, |s| {
                if let Some(x) = tl::timeline_mut(s, &nm) {
                    if !x["events"].is_array() {
                        x["events"] = json!([]);
                    }
                    x["events"].as_array_mut().unwrap().push(json!({ "t": (at * 100.0).round() / 100.0, "name": "event" }));
                }
            });
        }
    });
    if duration != tlv["duration"].as_f64().unwrap_or(2.0) || looped != tlv["loop"].as_bool().unwrap_or(false) {
        let nm = name.clone();
        st.edit_scene("Timeline settings", Some("tl-settings"), |s| {
            if let Some(x) = tl::timeline_mut(s, &nm) {
                x["duration"] = json!(duration);
                x["loop"] = json!(looped);
            }
        });
    }
    st.timeline_ui.scrub = st.timeline_ui.scrub.clamp(0.0, duration);
    ui.add(egui::Slider::new(&mut st.timeline_ui.scrub, 0.0..=duration).text("scrub (s)"));

    // tracks
    let tracks = tlv["tracks"].as_array().cloned().unwrap_or_default();
    let mut ops: Vec<Op> = vec![];
    let width = (ui.available_width() - LEFT - 16.0).max(200.0);
    egui::ScrollArea::vertical().max_height(ROW * (tracks.len() as f32 + 2.0) + 40.0).show(ui, |ui| {
        ruler(ui, width, duration);
        for (ti, track) in tracks.iter().enumerate() {
            track_row(ui, st, ti, track, width, duration, &mut ops);
        }
        if let Some(evs) = tlv["events"].as_array() {
            event_row(ui, st, evs, width, duration, &mut ops);
        }
    });
    apply_ops(st, &name, duration, ops);
    selected_panel(st, ui, &name, &tlv);
}

enum Op {
    AddKey(usize, f64),
    MoveKey(usize, usize, f64),
    RemoveKey(usize, usize),
    RemoveTrack(usize),
    MoveEvent(usize, f64),
}

fn ruler(ui: &mut Ui, width: f32, duration: f64) {
    let (r, _) = ui.allocate_exact_size(Vec2::new(LEFT + width, 16.0), Sense::hover());
    let p = ui.painter_at(r);
    let step = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0].iter().copied().find(|s| (*s / duration) as f32 * width >= 48.0).unwrap_or(60.0);
    let mut t = 0.0;
    while t <= duration + 1e-9 {
        let x = r.left() + LEFT + (t / duration) as f32 * width;
        p.vline(x, r.y_range(), Stroke::new(1.0_f32, Color32::from_white_alpha(40)));
        p.text(Pos2::new(x + 2.0, r.top()), egui::Align2::LEFT_TOP, format!("{t}"), egui::FontId::proportional(9.0), Color32::from_gray(150));
        t += step;
    }
}

fn track_row(ui: &mut Ui, st: &mut EditorState, ti: usize, track: &Value, width: f32, duration: f64, ops: &mut Vec<Op>) {
    let keys = tl::keys(track);
    let (r, resp) = ui.allocate_exact_size(Vec2::new(LEFT + width, ROW), Sense::click_and_drag());
    let p = ui.painter_at(r);
    p.rect_filled(r, 2.0, Color32::from_gray(if ti % 2 == 0 { 30 } else { 34 }));
    let strip = Rect::from_min_max(Pos2::new(r.left() + LEFT, r.top() + 2.0), Pos2::new(r.right(), r.bottom() - 2.0));
    p.text(r.left_top() + Vec2::new(6.0, 4.0), egui::Align2::LEFT_TOP, format!("{}.{}", track["target"].as_str().unwrap_or("?"), track["property"].as_str().unwrap_or("?")), egui::FontId::proportional(12.0), Color32::from_gray(220));
    let scrub = st.timeline_ui.scrub;
    if let Some(v) = tl::sample(&keys, scrub) {
        p.text(r.left_top() + Vec2::new(6.0, 20.0), egui::Align2::LEFT_TOP, format!("@{scrub:.2}s = {v:.2}"), egui::FontId::monospace(10.0), Color32::from_rgb(150, 200, 255));
    }
    let x_of = |t: f64| strip.left() + (t / duration) as f32 * strip.width();
    let (lo, hi) = tl::value_range(&keys);
    let y_of = |v: f64| strip.bottom() - 4.0 - ((v - lo) / (hi - lo)) as f32 * (strip.height() - 8.0);
    // curve between keys
    if keys.len() >= 2 {
        let mut pts = vec![];
        for i in 0..=80 {
            let t = duration * i as f64 / 80.0;
            if let Some(v) = tl::sample(&keys, t) {
                pts.push(Pos2::new(x_of(t), y_of(v)));
            }
        }
        p.add(egui::Shape::line(pts, Stroke::new(1.5_f32, Color32::from_rgb(120, 200, 255))));
    }
    p.vline(x_of(scrub), strip.y_range(), Stroke::new(1.0_f32, Color32::from_rgb(255, 120, 120)));
    let mut hit = None;
    for (ki, k) in keys.iter().enumerate() {
        let c = Pos2::new(x_of(k.t), y_of(k.v));
        let selected = st.timeline_ui.key == Some((ti, ki));
        p.add(egui::Shape::convex_polygon(vec![c + Vec2::new(0.0, -6.0), c + Vec2::new(6.0, 0.0), c + Vec2::new(0.0, 6.0), c + Vec2::new(-6.0, 0.0)], if selected { Color32::YELLOW } else { Color32::from_rgb(255, 209, 102) }, Stroke::new(1.0_f32, Color32::BLACK)));
        if let Some(m) = resp.interact_pointer_pos().or(resp.hover_pos()) {
            if (m - c).length() < 9.0 {
                hit = Some(ki);
            }
        }
    }
    let time_at = |x: f32| ((x - strip.left()) / strip.width()) as f64 * duration;
    if resp.drag_started() {
        st.timeline_ui.key = hit.map(|k| (ti, k));
        st.timeline_ui.event = None;
    }
    if resp.dragged() {
        if let (Some((t, k)), Some(m)) = (st.timeline_ui.key, resp.interact_pointer_pos()) {
            if t == ti {
                ops.push(Op::MoveKey(ti, k, (time_at(m.x) * 100.0).round() / 100.0));
            }
        }
    }
    if resp.clicked() {
        if let Some(m) = resp.interact_pointer_pos() {
            match hit {
                Some(k) => st.timeline_ui.key = Some((ti, k)),
                None if m.x >= strip.left() => {
                    ops.push(Op::AddKey(ti, (time_at(m.x) * 100.0).round() / 100.0));
                }
                None => {}
            }
        }
    }
    if resp.secondary_clicked() {
        if let Some(k) = hit {
            ops.push(Op::RemoveKey(ti, k));
        }
    }
    // remove-track button
    let b = Rect::from_min_size(r.left_top() + Vec2::new(LEFT - 22.0, 4.0), Vec2::splat(16.0));
    if ui.put(b, |ui: &mut Ui| crate::icons::mini(ui, "x", "Delete track")).clicked() {
        ops.push(Op::RemoveTrack(ti));
    }
}

fn event_row(ui: &mut Ui, st: &mut EditorState, evs: &[Value], width: f32, duration: f64, ops: &mut Vec<Op>) {
    let (r, resp) = ui.allocate_exact_size(Vec2::new(LEFT + width, 22.0), Sense::click_and_drag());
    let p = ui.painter_at(r);
    p.rect_filled(r, 2.0, Color32::from_gray(26));
    p.text(r.left_top() + Vec2::new(6.0, 4.0), egui::Align2::LEFT_TOP, "events", egui::FontId::proportional(12.0), Color32::from_gray(180));
    let x_of = |t: f64| r.left() + LEFT + (t / duration) as f32 * width;
    let mut hit = None;
    for (i, e) in evs.iter().enumerate() {
        let x = x_of(e["t"].as_f64().unwrap_or(0.0));
        let sel = st.timeline_ui.event == Some(i);
        p.add(egui::Shape::convex_polygon(vec![Pos2::new(x - 5.0, r.top() + 3.0), Pos2::new(x + 5.0, r.top() + 3.0), Pos2::new(x, r.bottom() - 3.0)], if sel { Color32::YELLOW } else { Color32::from_rgb(200, 140, 255) }, Stroke::NONE));
        p.text(Pos2::new(x + 7.0, r.top() + 4.0), egui::Align2::LEFT_TOP, e["name"].as_str().unwrap_or(""), egui::FontId::proportional(10.0), Color32::from_gray(200));
        if let Some(m) = resp.interact_pointer_pos().or(resp.hover_pos()) {
            if (m.x - x).abs() < 8.0 {
                hit = Some(i);
            }
        }
    }
    if resp.drag_started() || resp.clicked() {
        st.timeline_ui.event = hit;
        st.timeline_ui.key = None;
    }
    if resp.dragged() {
        if let (Some(i), Some(m)) = (st.timeline_ui.event, resp.interact_pointer_pos()) {
            ops.push(Op::MoveEvent(i, ((((m.x - r.left() - LEFT) / width) as f64 * duration).clamp(0.0, duration) * 100.0).round() / 100.0));
        }
    }
}

fn apply_ops(st: &mut EditorState, name: &str, duration: f64, ops: Vec<Op>) {
    if ops.is_empty() {
        return;
    }
    let nm = name.to_string();
    let mut new_sel = None;
    let coalesce = ops.iter().all(|o| matches!(o, Op::MoveKey(..) | Op::MoveEvent(..)));
    st.edit_scene("Edit timeline", coalesce.then_some("tl-drag"), |s| {
        let Some(x) = tl::timeline_mut(s, &nm) else { return };
        for op in ops {
            match op {
                Op::AddKey(t, at) => {
                    if let Some(tr) = x["tracks"].get_mut(t) {
                        new_sel = Some((t, tl::add_key(tr, at)));
                    }
                }
                Op::MoveKey(t, k, at) => {
                    if let Some(tr) = x["tracks"].get_mut(t) {
                        new_sel = Some((t, tl::move_key(tr, k, at, duration)));
                    }
                }
                Op::RemoveKey(t, k) => {
                    if let Some(tr) = x["tracks"].get_mut(t) {
                        tl::remove_key(tr, k);
                    }
                }
                Op::RemoveTrack(t) => {
                    if let Some(a) = x["tracks"].as_array_mut() {
                        if t < a.len() {
                            a.remove(t);
                        }
                    }
                }
                Op::MoveEvent(i, at) => {
                    if let Some(e) = x["events"].get_mut(i) {
                        e["t"] = json!(at);
                    }
                }
            }
        }
    });
    if let Some(s) = new_sel {
        st.timeline_ui.key = Some(s);
    } else {
        st.timeline_ui.key = None;
    }
}

fn selected_panel(st: &mut EditorState, ui: &mut Ui, name: &str, tlv: &Value) {
    ui.separator();
    if let Some(i) = st.timeline_ui.event {
        let Some(e) = tlv["events"].get(i) else { return };
        let mut n = e["name"].as_str().unwrap_or("").to_string();
        let mut t = e["t"].as_f64().unwrap_or(0.0);
        let mut del = false;
        ui.horizontal(|ui| {
            ui.label(RichText::new("Event marker").strong());
            ui.add(egui::TextEdit::singleline(&mut n).desired_width(140.0));
            ui.add(egui::DragValue::new(&mut t).speed(0.01).range(0.0..=600.0).suffix(" s"));
            del = ui.button("Delete").clicked();
        });
        if n != e["name"].as_str().unwrap_or("") || t != e["t"].as_f64().unwrap_or(0.0) || del {
            let nm = name.to_string();
            st.edit_scene("Edit event marker", Some("tl-event"), |s| {
                if let Some(a) = tl::timeline_mut(s, &nm).and_then(|x| x["events"].as_array_mut()) {
                    if del {
                        a.remove(i);
                    } else if let Some(e) = a.get_mut(i) {
                        e["name"] = json!(n);
                        e["t"] = json!(t);
                    }
                }
            });
            if del {
                st.timeline_ui.event = None;
            }
        }
        ui.weak("Fires the event sheet trigger Timeline > On event (timeline, name) and the global event \"Timeline.on-event\".");
        return;
    }
    let Some((ti, ki)) = st.timeline_ui.key else {
        ui.weak("Click a track strip to add a keyframe, drag keyframes to move them, right-click deletes. Select one for value and easing.");
        return;
    };
    let Some(track) = tlv["tracks"].get(ti) else { return };
    let keys = tl::keys(track);
    let Some(k) = keys.get(ki).cloned() else { return };
    let (mut t, mut v, mut ease) = (k.t, k.v, k.ease.clone());
    ui.horizontal_wrapped(|ui| {
        ui.label(RichText::new(format!("Key {ki} of {}.{}", track["target"].as_str().unwrap_or("?"), track["property"].as_str().unwrap_or("?"))).strong());
        ui.add(egui::DragValue::new(&mut t).speed(0.01).range(0.0..=600.0).prefix("t ").suffix(" s"));
        ui.add(egui::DragValue::new(&mut v).speed(0.5).prefix("value "));
        ui.label("ease into this key:");
        let cur = ease.as_str().map(String::from).unwrap_or_else(|| if ease.is_array() { "bezier".into() } else { "linear".into() });
        egui::ComboBox::from_id_salt("tl-ease").selected_text(cur).show_ui(ui, |ui| {
            for e in tl::EASES {
                if ui.selectable_label(ease.as_str() == Some(*e) || (ease.is_null() && *e == "linear"), *e).clicked() {
                    ease = json!(e);
                }
            }
            if ui.selectable_label(ease.is_array(), "bezier (custom)").clicked() && !ease.is_array() {
                ease = json!([0.25, 0.1, 0.25, 1.0]);
            }
        });
    });
    if let Some(a) = ease.as_array_mut().filter(|a| a.len() == 4) {
        let mut b: Vec<f64> = a.iter().map(|x| x.as_f64().unwrap_or(0.0)).collect();
        ui.horizontal(|ui| {
            for (i, lab) in ["x1", "y1", "x2", "y2"].iter().enumerate() {
                ui.add(egui::DragValue::new(&mut b[i]).speed(0.01).range(if i % 2 == 0 { 0.0..=1.0 } else { -1.0..=2.0 }).prefix(*lab));
            }
        });
        *a = b.iter().map(|x| json!(x)).collect();
    }
    // curve preview of the easing
    let (r, _) = ui.allocate_exact_size(Vec2::new(160.0, 80.0), Sense::hover());
    let p = ui.painter_at(r);
    p.rect_filled(r, 2.0, Color32::from_gray(24));
    let pts: Vec<Pos2> = (0..=60).map(|i| {
        let x = i as f64 / 60.0;
        Pos2::new(r.left() + 6.0 + x as f32 * (r.width() - 12.0), r.bottom() - 14.0 - (tl::apply_ease(&ease, x) as f32) * (r.height() - 28.0))
    }).collect();
    p.add(egui::Shape::line(pts, Stroke::new(2.0_f32, Color32::from_rgb(255, 209, 102))));
    if (t, v, &ease) != (k.t, k.v, &k.ease) {
        let nm = name.to_string();
        let (e2, dur) = (ease.clone(), tlv["duration"].as_f64().unwrap_or(2.0));
        st.edit_scene("Edit keyframe", Some("tl-key"), |s| {
            if let Some(tr) = tl::timeline_mut(s, &nm).and_then(|x| x["tracks"].get_mut(ti)) {
                let mut keys = tl::keys(tr);
                if let Some(kk) = keys.get_mut(ki) {
                    kk.t = t.clamp(0.0, dur);
                    kk.v = v;
                    kk.ease = e2;
                }
                keys.sort_by(|a, b| a.t.total_cmp(&b.t));
                tl::write_keys(tr, &keys);
            }
        });
    }
}
