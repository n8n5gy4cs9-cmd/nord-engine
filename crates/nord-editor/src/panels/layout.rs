//! Layout tab (M10-12/13/14): layers, layout properties (size, scrolling, event sheet, guides), arrange selection, object types,
//! overview map and the list of layouts (scenes). All edits go through `EditorState::edit_scene`, so they undo together with the objects.
use crate::layout::{self, Align};
use crate::state::EditorState;
use egui::{Color32, Rect, RichText, Sense, Ui, Vec2};
use nord_core::assets::AssetType;
use serde_json::json;

#[derive(Default)]
pub struct LayoutUi {
    pub active_layer: i32,
    pub new_layout: String,
    pub guide_x: f64,
    pub guide_y: f64,
    pub view_name: String,
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    if st.scene.is_none() {
        ui.weak("No scene open");
        return;
    }
    egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
        layers_section(st, ui);
        ui.add_space(6.0);
        properties_section(st, ui);
        ui.add_space(6.0);
        arrange_section(st, ui);
        ui.add_space(6.0);
        objects_section(st, ui);
        ui.add_space(6.0);
        overview_section(st, ui);
        ui.add_space(6.0);
        views_section(st, ui);
        ui.add_space(6.0);
        layouts_section(st, ui);
    });
}

fn layers_section(st: &mut EditorState, ui: &mut Ui) {
    egui::CollapsingHeader::new(RichText::new("Layers").strong()).default_open(true).show(ui, |ui| {
        let list = layout::layers(st.scene.as_ref().unwrap());
        // top layer first, like Construct's layer list
        for l in list.iter().rev() {
            ui.horizontal(|ui| {
                let (mut vis, mut lock) = (l.visible, l.locked);
                if ui.checkbox(&mut vis, "").on_hover_text("Visible (also at runtime)").changed() {
                    st.edit_scene("Layer visibility", None, |s| layout::set_layer_prop(s, l.id, "visible", json!(vis)));
                }
                if ui.toggle_value(&mut lock, "🔒").on_hover_text("Locked: objects on it cannot be selected in the viewport").changed() {
                    st.edit_scene("Layer lock", None, |s| layout::set_layer_prop(s, l.id, "locked", json!(lock)));
                }
                let mut name = l.name.clone();
                let r = ui.add(egui::TextEdit::singleline(&mut name).desired_width(120.0));
                if r.changed() {
                    st.edit_scene("Rename layer", Some(&format!("layer-name-{}", l.id)), |s| layout::set_layer_prop(s, l.id, "name", json!(name)));
                }
                if ui.selectable_label(st.layout_ui.active_layer == l.id, format!("#{}  ·  {} object(s)", l.id, l.count)).clicked() {
                    st.layout_ui.active_layer = l.id;
                }
                if ui.small_button("▲").on_hover_text("Move layer up (drawn later)").clicked() {
                    st.edit_scene("Move layer up", None, |s| {
                        layout::move_layer(s, l.id, true);
                    });
                }
                if ui.small_button("▼").on_hover_text("Move layer down").clicked() {
                    st.edit_scene("Move layer down", None, |s| {
                        layout::move_layer(s, l.id, false);
                    });
                }
                if ui.small_button("✖").on_hover_text("Delete layer (objects drop to the layer below)").clicked() {
                    st.edit_scene("Delete layer", None, |s| {
                        layout::delete_layer(s, l.id);
                    });
                }
            });
        }
        ui.horizontal(|ui| {
            if ui.button("＋ Layer").clicked() {
                st.edit_scene("Add layer", None, |s| {
                    layout::add_layer(s);
                });
            }
            let sel = st.selection.clone();
            if ui.add_enabled(!sel.is_empty(), egui::Button::new("Move selection to active layer")).clicked() {
                let to = st.layout_ui.active_layer;
                st.edit("Move to layer", None, |ents| {
                    for id in &sel {
                        if let Some(e) = find_mut(ents, id) {
                            e.layer = to;
                        }
                    }
                });
            }
        });
        let active = st.layout_ui.active_layer;
        if let Some(l) = list.iter().find(|l| l.id == active) {
            ui.separator();
            ui.label(RichText::new(format!("Layer #{} — {}", l.id, l.name)).strong());
            egui::Grid::new("layer-props").num_columns(2).spacing([10.0, 4.0]).show(ui, |ui| {
                let mut op = l.opacity;
                ui.label("Opacity");
                if ui.add(egui::Slider::new(&mut op, 0.0..=1.0)).changed() {
                    st.edit_scene("Layer opacity", Some(&format!("layer-op-{}", l.id)), |s| layout::set_layer_prop(s, l.id, "opacity", json!(op)));
                }
                ui.end_row();
                let mut par = l.parallax;
                ui.label("Parallax");
                let changed = ui
                    .horizontal(|ui| {
                        let a = ui.add(egui::DragValue::new(&mut par[0]).speed(0.01).prefix("x ")).on_hover_text("0 = fixed to the screen, 1 = moves with the world").changed();
                        let b = ui.add(egui::DragValue::new(&mut par[1]).speed(0.01).prefix("y ")).changed();
                        a || b
                    })
                    .inner;
                if changed {
                    st.edit_scene("Layer parallax", Some(&format!("layer-par-{}", l.id)), |s| layout::set_layer_prop(s, l.id, "parallax", json!(par)));
                }
                ui.end_row();
                let mut blend = l.blend.clone();
                ui.label("Blend");
                egui::ComboBox::from_id_salt("layer-blend").selected_text(blend.clone()).show_ui(ui, |ui| {
                    for b in ["normal", "add", "multiply", "screen"] {
                        ui.selectable_value(&mut blend, b.to_string(), b);
                    }
                });
                if blend != l.blend {
                    st.edit_scene("Layer blend", None, |s| layout::set_layer_prop(s, l.id, "blend", json!(blend)));
                }
                ui.end_row();
                let mut transparent = l.transparent;
                ui.label("Background");
                ui.horizontal(|ui| {
                    if ui.checkbox(&mut transparent, "transparent").changed() {
                        st.edit_scene("Layer transparency", None, |s| layout::set_layer_prop(s, l.id, "transparent", json!(transparent)));
                    }
                    let mut bg = l.background.clone();
                    if ui.add_enabled(!transparent, egui::TextEdit::singleline(&mut bg).desired_width(80.0)).changed() {
                        st.edit_scene("Layer background", Some(&format!("layer-bg-{}", l.id)), |s| layout::set_layer_prop(s, l.id, "background", json!(bg)));
                    }
                });
                ui.end_row();
            });
        }
    });
}

fn find_mut<'a>(list: &'a mut [nord_core::scene::Entity], id: &str) -> Option<&'a mut nord_core::scene::Entity> {
    for e in list {
        if e.id == id {
            return Some(e);
        }
        if let Some(f) = find_mut(&mut e.children, id) {
            return Some(f);
        }
    }
    None
}

fn properties_section(st: &mut EditorState, ui: &mut Ui) {
    egui::CollapsingHeader::new(RichText::new("Layout properties").strong()).default_open(false).show(ui, |ui| {
        let sheets: Vec<String> = st.assets.iter().filter(|a| a.path.ends_with(".events.json")).map(|a| a.path.clone()).collect();
        let (size, sheet, unbounded, (gx, gy)) = {
            let s = st.scene.as_ref().unwrap();
            (
                layout::layout_size(s),
                s.settings.extra.get("eventSheet").and_then(|v| v.as_str()).map(String::from),
                s.settings.extra.get("unboundedScrolling").and_then(|v| v.as_bool()).unwrap_or(false),
                layout::guides(s),
            )
        };
        ui.horizontal(|ui| {
            let mut custom = size.is_some();
            let mut wh = size.unwrap_or([1280.0, 720.0]);
            let mut changed = ui.checkbox(&mut custom, "Layout size").on_hover_text("Bounds for BoundToLayout / DestroyOutsideLayout; defaults to the game size").changed();
            ui.add_enabled_ui(custom, |ui| {
                changed |= ui.add(egui::DragValue::new(&mut wh[0]).range(16.0..=100000.0)).changed();
                ui.label("×");
                changed |= ui.add(egui::DragValue::new(&mut wh[1]).range(16.0..=100000.0)).changed();
            });
            if changed {
                st.edit_scene("Layout size", Some("layout-size"), |s| layout::set_layout_size(s, custom.then_some(wh)));
            }
        });
        let mut ub = unbounded;
        if ui.checkbox(&mut ub, "Unbounded scrolling (camera may leave the layout)").changed() {
            st.edit_scene("Unbounded scrolling", None, |s| {
                if ub {
                    s.settings.extra.insert("unboundedScrolling".into(), json!(true));
                } else {
                    s.settings.extra.remove("unboundedScrolling");
                }
            });
        }
        ui.horizontal(|ui| {
            ui.label("Event sheet");
            let cur = sheet.clone().unwrap_or_else(|| "(none)".into());
            egui::ComboBox::from_id_salt("layout-sheet").selected_text(cur).show_ui(ui, |ui| {
                if ui.selectable_label(sheet.is_none(), "(none)").clicked() {
                    st.edit_scene("Event sheet link", None, |s| {
                        s.settings.extra.remove("eventSheet");
                    });
                }
                for p in &sheets {
                    if ui.selectable_label(sheet.as_deref() == Some(p), p).clicked() {
                        st.edit_scene("Event sheet link", None, |s| {
                            s.settings.extra.insert("eventSheet".into(), json!(p));
                        });
                    }
                }
            });
        });
        ui.separator();
        ui.label("Guides (snap lines, also drawn in the viewport)");
        let (mut vx, mut vy) = (gx.clone(), gy.clone());
        ui.horizontal(|ui| {
            ui.add(egui::DragValue::new(&mut st.layout_ui.guide_x).prefix("x "));
            if ui.small_button("＋ vertical").clicked() {
                vx.push(st.layout_ui.guide_x);
            }
            ui.add(egui::DragValue::new(&mut st.layout_ui.guide_y).prefix("y "));
            if ui.small_button("＋ horizontal").clicked() {
                vy.push(st.layout_ui.guide_y);
            }
        });
        let (mut rx, mut ry) = (None, None);
        ui.horizontal_wrapped(|ui| {
            for (i, g) in vx.iter().enumerate() {
                if ui.small_button(format!("x {g} ✖")).clicked() {
                    rx = Some(i);
                }
            }
            for (i, g) in vy.iter().enumerate() {
                if ui.small_button(format!("y {g} ✖")).clicked() {
                    ry = Some(i);
                }
            }
        });
        if let Some(i) = rx {
            vx.remove(i);
        }
        if let Some(i) = ry {
            vy.remove(i);
        }
        if (vx.clone(), vy.clone()) != (gx, gy) {
            st.edit_scene("Guides", None, |s| layout::set_guides(s, vx, vy));
        }
    });
}

fn arrange_section(st: &mut EditorState, ui: &mut Ui) {
    egui::CollapsingHeader::new(RichText::new("Arrange selection").strong()).default_open(false).show(ui, |ui| {
        let sel = st.selection.clone();
        ui.weak(format!("{} selected (select two or more in the Hierarchy)", sel.len()));
        ui.add_enabled_ui(sel.len() >= 2, |ui| {
            ui.horizontal_wrapped(|ui| {
                for (label, mode) in [("⇤ Left", Align::Left), ("↔ Centre", Align::CenterH), ("⇥ Right", Align::Right), ("⤒ Top", Align::Top), ("↕ Middle", Align::CenterV), ("⤓ Bottom", Align::Bottom)] {
                    if ui.button(label).clicked() {
                        st.edit("Align", None, |e| layout::align(e, &sel, mode));
                    }
                }
            });
            ui.horizontal(|ui| {
                ui.add_enabled_ui(sel.len() >= 3, |ui| {
                    if ui.button("Distribute horizontally").clicked() {
                        st.edit("Distribute", None, |e| layout::distribute(e, &sel, true));
                    }
                    if ui.button("Distribute vertically").clicked() {
                        st.edit("Distribute", None, |e| layout::distribute(e, &sel, false));
                    }
                });
            });
        });
    });
}

fn objects_section(st: &mut EditorState, ui: &mut Ui) {
    egui::CollapsingHeader::new(RichText::new("Object types").strong()).default_open(false).show(ui, |ui| {
        let types = layout::object_types(st.scene.as_ref().unwrap());
        ui.weak("An object type is every entity with the same name — what event sheets call an object.");
        for t in &types {
            ui.horizontal(|ui| {
                ui.dnd_drag_source(egui::Id::new(("obj-type", &t.name)), t.name.clone(), |ui| {
                    ui.label(RichText::new(format!("⠿ {}", t.name)).strong());
                })
                .response
                .on_hover_text("Drag onto the Overview map to place a new instance");
                ui.weak(format!("× {}", t.count));
                if ui.small_button("Select all").clicked() {
                    st.selection = t.ids.clone();
                }
                if ui.small_button("＋ Instance").on_hover_text("Duplicate the first instance 32 px to the right").clicked() {
                    let id = t.ids[0].clone();
                    st.edit("Add instance", None, |ents| {
                        if let Some(src) = find_mut(ents, &id).map(|e| e.clone()) {
                            let mut c = crate::scene_ops::clone_fresh(&src);
                            c.transform.pos[0] += 32.0;
                            ents.push(c);
                        }
                    });
                }
                if ui.add_enabled(t.count > 1, egui::Button::new("Sync instances").small()).on_hover_text("Copy the first instance's components, behaviors, scripts, tags and layer to all other instances").clicked() {
                    let id = t.ids[0].clone();
                    st.edit("Sync object type", None, |ents| {
                        layout::sync_type(ents, &id);
                    });
                }
            });
        }
    });
}

fn overview_section(st: &mut EditorState, ui: &mut Ui) {
    egui::CollapsingHeader::new(RichText::new("Overview").strong()).default_open(false).show(ui, |ui| {
        let s = st.scene.as_ref().unwrap();
        let Some(b) = layout::content_bounds(s) else {
            ui.weak("Empty layout");
            return;
        };
        let (w, h) = ((b[2] - b[0]).max(1.0), (b[3] - b[1]).max(1.0));
        let avail = ui.available_width().min(420.0);
        let scale = (avail as f64 / w).min(160.0 / h);
        let (r, resp) = ui.allocate_exact_size(Vec2::new((w * scale) as f32, (h * scale) as f32), Sense::click());
        ui.painter().rect_filled(r, 2.0, Color32::from_gray(28));
        let world_at = |p: egui::Pos2| (b[0] + ((p.x - r.left()) as f64) / scale, b[1] + ((p.y - r.top()) as f64) / scale);
        // drop an object type here to place a new instance; click to look at that spot in the viewport
        let mut place: Option<(String, f64, f64)> = None;
        if let Some(name) = resp.dnd_release_payload::<String>() {
            if let Some(p) = ui.input(|i| i.pointer.interact_pos()) {
                let (x, y) = world_at(p);
                place = Some(((*name).clone(), x.round(), y.round()));
            }
        } else if resp.dnd_hover_payload::<String>().is_some() {
            ui.painter().rect_stroke(r, 2.0, egui::Stroke::new(2.0_f32, Color32::from_rgb(120, 200, 255)), egui::StrokeKind::Outside);
        }
        let mut look: Option<(f64, f64)> = None;
        if resp.clicked() {
            look = resp.interact_pointer_pos().map(world_at);
        }
        for e in &s.entities {
            let sz = layout::size_of(e);
            let (x, y) = ((e.transform.pos[0] - sz[0] / 2.0 - b[0]) * scale, (e.transform.pos[1] - sz[1] / 2.0 - b[1]) * scale);
            let col = Color32::from_rgb(90 + (e.layer * 40 % 160) as u8, 140, 200 - (e.layer * 30 % 120) as u8);
            let rr = Rect::from_min_size(r.min + Vec2::new(x as f32, y as f32), Vec2::new(((sz[0] * scale) as f32).max(2.0), ((sz[1] * scale) as f32).max(2.0)));
            ui.painter().rect_filled(rr, 0.0, if st.selection.contains(&e.id) { Color32::YELLOW } else { col });
        }
        ui.weak(format!("{} object(s), {:.0} × {:.0} units — click to look there, drop an object type to place it", s.entities.len(), w, h));
        if let Some((x, y)) = look {
            let z = st.viewport_cam.map_or(1.0, |c| c[2]);
            st.send_viewport(json!({"t": "view", "x": x, "y": y, "zoom": z}));
        }
        if let Some((name, x, y)) = place {
            st.edit_scene("Place instance", None, |s| {
                layout::place_instance(s, &name, x, y);
            });
        }
    });
}

fn views_section(st: &mut EditorState, ui: &mut Ui) {
    egui::CollapsingHeader::new(RichText::new("Views").strong()).default_open(false).show(ui, |ui| {
        let views = layout::views(st.scene.as_ref().unwrap());
        let mut go: Option<[f64; 3]> = None;
        let mut del: Option<String> = None;
        for (name, c) in &views {
            ui.horizontal(|ui| {
                if ui.button(format!("Go to {name}")).clicked() {
                    go = Some(*c);
                }
                ui.weak(format!("{:.0}, {:.0} · {:.0}%", c[0], c[1], c[2] * 100.0));
                if ui.small_button("✖").clicked() {
                    del = Some(name.clone());
                }
            });
        }
        ui.horizontal(|ui| {
            ui.add(egui::TextEdit::singleline(&mut st.layout_ui.view_name).hint_text("view name").desired_width(120.0));
            let cam = st.viewport_cam;
            if ui.add_enabled(cam.is_some() && !st.layout_ui.view_name.trim().is_empty(), egui::Button::new("Save current view")).on_hover_text("remembers where the 2D viewport is looking").clicked() {
                let n = st.layout_ui.view_name.trim().to_string();
                st.edit_scene("Save view", None, |s| layout::save_view(s, &n, cam.unwrap()));
                st.layout_ui.view_name.clear();
            }
            if cam.is_none() {
                ui.weak("(open the Scene tab and move the view first)");
            }
        });
        if let Some(c) = go {
            st.send_viewport(json!({"t": "view", "x": c[0], "y": c[1], "zoom": c[2]}));
        }
        if let Some(n) = del {
            st.edit_scene("Delete view", None, |s| {
                let rest: Vec<_> = layout::views(s).into_iter().filter(|(x, _)| *x != n).collect();
                layout::set_views(s, &rest);
            });
        }
    });
}

fn layouts_section(st: &mut EditorState, ui: &mut Ui) {
    egui::CollapsingHeader::new(RichText::new("Layouts (scenes)").strong()).default_open(false).show(ui, |ui| {
        let scenes: Vec<String> = st.assets.iter().filter(|a| a.kind == AssetType::Scene).map(|a| a.path.clone()).collect();
        let cur = st.scene_file.clone();
        let start = st.project.as_ref().map(|p| p.start_scene.clone());
        let mut open: Option<String> = None;
        let mut make_start: Option<String> = None;
        for p in &scenes {
            ui.horizontal(|ui| {
                if ui.selectable_label(cur.as_deref() == Some(p), p).clicked() {
                    open = Some(p.clone());
                }
                if start.as_deref() == Some(p) {
                    ui.weak("start");
                } else if ui.small_button("set as start").clicked() {
                    make_start = Some(p.clone());
                }
            });
        }
        ui.horizontal(|ui| {
            ui.add(egui::TextEdit::singleline(&mut st.layout_ui.new_layout).hint_text("new layout name").desired_width(140.0));
            if ui.button("＋ New layout").clicked() && !st.layout_ui.new_layout.trim().is_empty() {
                let name = st.layout_ui.new_layout.trim().replace(' ', "-");
                let rel = format!("scenes/{name}.scene.json");
                if let Some(root) = st.root.clone() {
                    if root.join(&rel).exists() {
                        st.toast("A layout with that name exists");
                    } else if nord_core::io::save_json(&root.join(&rel), &nord_core::Scene::new(&name)).is_ok() {
                        st.layout_ui.new_layout.clear();
                        st.refresh_assets();
                        open = Some(rel);
                    }
                }
            }
            if ui.button("Duplicate current").clicked() {
                if let (Some(root), Some(f), Some(s)) = (st.root.clone(), cur.clone(), st.scene.clone()) {
                    let stem = f.trim_end_matches(".scene.json").to_string();
                    let rel = format!("{stem}-copy.scene.json");
                    let mut copy = s;
                    copy.name = format!("{}-copy", copy.name);
                    if nord_core::io::save_json(&root.join(&rel), &copy).is_ok() {
                        st.refresh_assets();
                        open = Some(rel);
                    }
                }
            }
        });
        if let Some(p) = make_start {
            if let (Some(root), Some(pr)) = (st.root.clone(), st.project.as_mut()) {
                pr.start_scene = p;
                let _ = nord_core::io::save_project(&root, pr);
                st.toast("Start layout changed");
            }
        }
        if let Some(p) = open {
            if st.dirty {
                st.save();
            }
            if let Err(e) = st.open_scene(&p) {
                st.toast(e);
            }
        }
    });
}
