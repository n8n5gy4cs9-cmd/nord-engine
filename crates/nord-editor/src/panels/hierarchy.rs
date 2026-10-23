use crate::{icons, scene_ops, state::EditorState};
use egui::{Sense, Ui};
use nord_core::scene::Entity;

#[derive(Clone)]
enum Drop {
    Into(String),
    Before(String),
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    if st.scene.is_none() {
        ui.weak("No scene open");
        return;
    }
    ui.horizontal(|ui| {
        let three = st.is_3d();
        ui.menu_button("＋ Create", |ui| {
            create_menu(st, ui, three, st.selection.first().cloned())
        });
        if icons::button(ui, "plus", "Add entity", false).clicked() {
            let parent = st.selection.first().cloned();
            st.add_entity(parent);
        }
        if icons::button(ui, "copy", "Duplicate (Cmd+D)", false).clicked() {
            st.duplicate_selected();
        }
        if icons::button(ui, "trash-2", "Delete (Del)", false).clicked() {
            st.delete_selected();
        }
    });
    ui.add(
        egui::TextEdit::singleline(&mut st.hierarchy_filter)
            .hint_text("Search entities…")
            .desired_width(f32::INFINITY),
    );
    ui.separator();
    let filter = st.hierarchy_filter.to_lowercase();
    let entities = st
        .scene
        .as_ref()
        .map(|s| s.entities.clone())
        .unwrap_or_default();
    let mut pending: Option<(String, Drop)> = None;
    let mut clicked: Option<(String, bool)> = None;
    let mut ctx_action: Option<(String, u8)> = None;
    let mut asset_drop: Option<String> = None;
    egui::ScrollArea::vertical()
        .auto_shrink([false; 2])
        .show(ui, |ui| {
            if filter.is_empty() {
                for e in &entities {
                    node(st, ui, e, &mut pending, &mut clicked, &mut ctx_action);
                }
            } else {
                for (_, e) in scene_ops::flatten(&entities) {
                    if e.name.to_lowercase().contains(&filter)
                        || e.tags.iter().any(|t| t.to_lowercase().contains(&filter))
                    {
                        row(st, ui, e, &mut pending, &mut clicked, &mut ctx_action);
                    }
                }
            }
            if filter.is_empty() {
                virtual_rows(st, ui, &mut clicked);
            }
            // drop on empty space = move to root end
            let (_, resp) = ui.allocate_exact_size(
                egui::vec2(ui.available_width(), ui.available_height().max(24.0)),
                Sense::hover(),
            );
            if let Some(id) = resp.dnd_release_payload::<String>() {
                pending = Some(((*id).clone(), Drop::Before(String::new())));
            }
            // assets dragged from the Assets panel become entities
            if let Some(a) = resp.dnd_release_payload::<crate::panels::inspector::AssetDrag>() {
                asset_drop = Some(a.0.clone());
            }
        });
    if let Some(p) = asset_drop {
        st.add_asset_entity(&p);
    }
    if let Some((id, multi)) = clicked {
        if multi {
            if let Some(i) = st.selection.iter().position(|x| *x == id) {
                st.selection.remove(i);
            } else {
                st.selection.push(id);
            }
        } else {
            st.select(Some(id));
        }
        st.send_viewport(serde_json::json!({"t":"select","ids":st.selection}));
    }
    if let Some((id, d)) = pending {
        st.edit("Reparent", None, |l| match d {
            Drop::Into(p) => {
                scene_ops::reparent(l, &id, Some(&p), usize::MAX);
            }
            Drop::Before(sib) => {
                if sib.is_empty() {
                    scene_ops::reparent(l, &id, None, usize::MAX);
                } else {
                    let parent = scene_ops::parent_of(l, &sib);
                    let idx = match &parent {
                        None => l.iter().position(|e| e.id == sib),
                        Some(p) => scene_ops::find(l, p)
                            .and_then(|p| p.children.iter().position(|e| e.id == sib)),
                    }
                    .unwrap_or(0);
                    scene_ops::reparent(l, &id, parent.as_deref(), idx);
                }
            }
        });
    }
    if let Some((id, op)) = ctx_action {
        st.select(Some(id.clone()));
        match op {
            0 => st.add_entity(Some(id)),
            1 => st.duplicate_selected(),
            2 => st.delete_selected(),
            3 => st.copy_selected(),
            4 => st.paste(),
            _ => {}
        }
    }
}

/// Unity-style GameObject menu: presets for both 2D and 3D projects.
pub(crate) fn create_menu(st: &mut EditorState, ui: &mut Ui, three: bool, parent: Option<String>) {
    let mut pick = None;
    let mut item = |ui: &mut Ui, label: &str, kind: &'static str| {
        let icon = match kind {
            "empty" => "component",
            "cube" | "ground" => "box",
            "sphere" => "circle",
            "sun" | "light" => "lightbulb",
            "camera" => "video",
            "text" | "ui-label" => "type",
            "ui-button" | "ui-panel" => "layout-grid",
            "audio" => "music",
            "spawner" => "sparkles",
            "trigger" => "crosshair",
            "graph" => "git-branch",
            _ => "plus",
        };
        if icons::label_icon(ui, icon, label).clicked() {
            pick = Some(kind);
            ui.close_menu();
        }
    };
    item(ui, "Empty", "empty");
    if three {
        ui.separator();
        item(ui, "Cube", "cube");
        item(ui, "Sphere", "sphere");
        item(ui, "Ground", "ground");
        item(ui, "Directional light", "sun");
    }
    ui.separator();
    item(ui, "Camera", "camera");
    item(ui, "Light", "light");
    item(ui, "Text", "text");
    ui.separator();
    item(ui, "UI Label", "ui-label");
    item(ui, "UI Button", "ui-button");
    item(ui, "UI Panel", "ui-panel");
    ui.separator();
    item(ui, "Audio source", "audio");
    item(ui, "Spawner", "spawner");
    item(ui, "Trigger zone", "trigger");
    item(ui, "Graph (visual script)", "graph");
    ui.separator();
    if ui.button("Group selected").clicked() {
        st.group_selected();
        ui.close_menu();
    }
    if let Some(k) = pick {
        st.add_preset(k, parent);
    }
}

/// Read-only rows for what the game shows that is not an entity (Environment, Managers; see virt.rs).
fn virtual_rows(st: &mut EditorState, ui: &mut Ui, clicked: &mut Option<(String, bool)>) {
    let (Some(p), Some(s)) = (&st.project, &st.scene) else {
        return;
    };
    let rows = crate::virt::scene_nodes(p, s);
    ui.add_space(4.0);
    for n in &rows {
        vnode(st, ui, n, clicked);
    }
}

fn vnode(
    st: &mut EditorState,
    ui: &mut Ui,
    n: &crate::virt::VNode,
    clicked: &mut Option<(String, bool)>,
) {
    let open = n.children.is_empty() || !st.collapsed.contains(&n.id);
    ui.horizontal(|ui| {
        if !n.children.is_empty() {
            let chev = if open {
                "chevron-down"
            } else {
                "chevron-right"
            };
            if ui
                .add(icons::icon(chev, 12.0, ui.visuals().text_color()).sense(Sense::click()))
                .clicked()
            {
                if open {
                    st.collapsed.insert(n.id.clone());
                } else {
                    st.collapsed.remove(&n.id);
                }
            }
        }
        ui.add(icons::icon(n.icon, 14.0, ui.visuals().weak_text_color()));
        let selected = st.selection.contains(&n.id);
        let text = egui::RichText::new(&n.name)
            .italics()
            .color(ui.visuals().weak_text_color());
        let r = ui
            .selectable_label(selected, text)
            .on_hover_text("Read-only: part of the game, not a scene entity");
        if r.clicked() {
            *clicked = Some((n.id.clone(), false));
        }
    });
    if open && !n.children.is_empty() {
        ui.indent(("vhier", &n.id), |ui| {
            for c in &n.children {
                vnode(st, ui, c, clicked);
            }
        });
    }
}

fn node(
    st: &mut EditorState,
    ui: &mut Ui,
    e: &Entity,
    pending: &mut Option<(String, Drop)>,
    clicked: &mut Option<(String, bool)>,
    ctx_action: &mut Option<(String, u8)>,
) {
    let host = match &st.root {
        Some(r)
            if e.scripts
                .iter()
                .any(|s| s.path.ends_with("fpsc/level-script.js")) =>
        {
            let r = r.clone();
            crate::virt::host_cached(&mut st.virt_cache, &r, e)
        }
        _ => Default::default(),
    };
    // children of a prefab instance live in the prefab file: show them (selectable, overridable in the Inspector)
    let pf_kids: Vec<Entity> = match (&e.prefab, e.children.is_empty()) {
        (Some(p), true) => st
            .read_prefab_cached(&p.path)
            .map(|r| r.children)
            .unwrap_or_default(),
        _ => vec![],
    };
    if e.children.is_empty() && host.is_empty() && pf_kids.is_empty() {
        row(st, ui, e, pending, clicked, ctx_action);
    } else {
        let open = !st.collapsed.contains(&e.id);
        ui.horizontal(|ui| {
            let name = if open {
                "chevron-down"
            } else {
                "chevron-right"
            };
            if ui
                .add(icons::icon(name, 12.0, ui.visuals().text_color()).sense(Sense::click()))
                .clicked()
            {
                if open {
                    st.collapsed.insert(e.id.clone());
                } else {
                    st.collapsed.remove(&e.id);
                }
            }
            row(st, ui, e, pending, clicked, ctx_action);
        });
        if open {
            ui.indent(("hier", &e.id), |ui| {
                for c in &e.children {
                    node(st, ui, c, pending, clicked, ctx_action);
                }
                for v in host.iter() {
                    vnode(st, ui, v, clicked);
                }
                pf_rows(st, ui, &e.id, &pf_kids, &mut vec![], clicked);
            });
        }
    }
}

/// Rows for the entities inside a prefab instance (`path` = child indices from the prefab root).
fn pf_rows(
    st: &mut EditorState,
    ui: &mut Ui,
    inst: &str,
    kids: &[Entity],
    path: &mut Vec<usize>,
    clicked: &mut Option<(String, bool)>,
) {
    for (i, k) in kids.iter().enumerate() {
        path.push(i);
        let id = crate::prefab::child_id(inst, path);
        let open = k.children.is_empty() || !st.collapsed.contains(&id);
        ui.horizontal(|ui| {
            if !k.children.is_empty() {
                let chev = if open {
                    "chevron-down"
                } else {
                    "chevron-right"
                };
                if ui
                    .add(icons::icon(chev, 12.0, ui.visuals().text_color()).sense(Sense::click()))
                    .clicked()
                {
                    if open {
                        st.collapsed.insert(id.clone());
                    } else {
                        st.collapsed.remove(&id);
                    }
                }
            }
            ui.add(icons::icon(
                "component",
                14.0,
                egui::Color32::from_rgb(110, 170, 255),
            ));
            let text = egui::RichText::new(&k.name).color(egui::Color32::from_rgb(110, 170, 255));
            if ui
                .selectable_label(st.selection.contains(&id), text)
                .on_hover_text("Inside the prefab: edits are stored as overrides on the instance")
                .clicked()
            {
                *clicked = Some((id.clone(), false));
            }
        });
        if open && !k.children.is_empty() {
            ui.indent(("pfh", &id), |ui| {
                pf_rows(st, ui, inst, &k.children, path, clicked)
            });
        }
        path.pop();
    }
}

fn row(
    st: &mut EditorState,
    ui: &mut Ui,
    e: &Entity,
    pending: &mut Option<(String, Drop)>,
    clicked: &mut Option<(String, bool)>,
    ctx_action: &mut Option<(String, u8)>,
) {
    let selected = st.selection.contains(&e.id);
    let icon = if e.components.iter().any(|c| c.kind == "camera") {
        "video"
    } else if e.components.iter().any(|c| c.kind == "light") {
        "lightbulb"
    } else if e
        .components
        .iter()
        .any(|c| matches!(c.kind.as_str(), "sprite" | "animatedSprite"))
    {
        "image"
    } else if e
        .components
        .iter()
        .any(|c| matches!(c.kind.as_str(), "mesh" | "model"))
    {
        "box"
    } else if e.components.iter().any(|c| c.kind == "text") {
        "type"
    } else if !e.children.is_empty() {
        "folder"
    } else {
        "component"
    };
    let tint = if e.enabled {
        ui.visuals().text_color()
    } else {
        ui.visuals().weak_text_color()
    };
    let label = if e.prefab.is_some() {
        format!("{} ⬡", e.name)
    } else {
        e.name.clone()
    };
    let renaming = st
        .hierarchy_rename
        .as_ref()
        .is_some_and(|(id, _)| *id == e.id);
    if renaming {
        let mut commit = false;
        let mut cancel = false;
        ui.horizontal(|ui| {
            ui.add(icons::icon(icon, 14.0, tint));
            if let Some((_, buf)) = st.hierarchy_rename.as_mut() {
                let r = ui.add(egui::TextEdit::singleline(buf).desired_width(f32::INFINITY));
                r.request_focus();
                if r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                    commit = true;
                } else if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
                    cancel = true;
                } else if r.lost_focus() {
                    commit = true; // clicking elsewhere keeps the typed name, like Unity
                }
            }
        });
        if commit {
            if let Some((id, name)) = st.hierarchy_rename.take() {
                let name = name.trim().to_string();
                if !name.is_empty() {
                    st.edit("Rename", None, |l| {
                        if let Some(x) = scene_ops::find_mut(l, &id) {
                            x.name = name;
                        }
                    });
                }
            }
        } else if cancel {
            st.hierarchy_rename = None;
        }
        return;
    }
    let resp = ui
        .horizontal(|ui| {
            let mut on = e.enabled;
            if ui.checkbox(&mut on, "").on_hover_text("Active").changed() {
                let id = e.id.clone();
                st.edit("Toggle active", None, |l| {
                    if let Some(x) = scene_ops::find_mut(l, &id) {
                        x.enabled = on;
                    }
                });
            }
            let icon_tint = if e.enabled {
                icons::kind_color(icon, tint)
            } else {
                tint
            };
            ui.add(icons::icon(icon, 14.0, icon_tint));
            let text = if e.prefab.is_some() {
                egui::RichText::new(label).color(egui::Color32::from_rgb(110, 170, 255))
            } else {
                egui::RichText::new(label)
            };
            let r = ui
                .selectable_label(selected, text)
                .interact(Sense::click_and_drag());
            // Scene-view visibility (eye) and picking lock (padlock), like Unity; only the toggled state is always shown
            let (mut hid, mut lock) = (e.hidden, e.locked);
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if (lock || r.hovered())
                    && icons::mini_toggle(ui, "lock", "Lock: not pickable in the Scene view", lock)
                        .clicked()
                {
                    lock = !lock;
                }
                if (hid || r.hovered())
                    && icons::mini_toggle(ui, "eye-off", "Hide in the Scene view", hid).clicked()
                {
                    hid = !hid;
                }
            });
            if hid != e.hidden || lock != e.locked {
                let id = e.id.clone();
                st.edit("Lock/hide", None, |l| {
                    if let Some(x) = scene_ops::find_mut(l, &id) {
                        x.hidden = hid;
                        x.locked = lock;
                    }
                });
            }
            r
        })
        .inner;
    if resp.clicked() {
        *clicked = Some((
            e.id.clone(),
            ui.input(|i| i.modifiers.command || i.modifiers.shift),
        ));
    }
    resp.dnd_set_drag_payload(e.id.clone());
    // an asset dropped on a row sets that entity's sprite / model / audio / material or attaches the script
    if let Some(a) = resp.dnd_release_payload::<crate::panels::inspector::AssetDrag>() {
        if !st.drop_asset_on_entity(&e.id, &a.0) {
            st.add_asset_entity(&a.0);
        }
    }
    if let Some(p) = resp.dnd_hover_payload::<String>() {
        let r = resp.rect;
        let y = ui
            .input(|i| i.pointer.interact_pos())
            .map_or(r.center().y, |p| p.y);
        let before = y < r.top() + r.height() * 0.3;
        let c = ui.visuals().selection.stroke.color;
        if before {
            ui.painter()
                .hline(r.x_range(), r.top(), egui::Stroke::new(2.0_f32, c));
        } else {
            ui.painter().rect_stroke(
                r,
                2.0,
                egui::Stroke::new(1.5_f32, c),
                egui::StrokeKind::Inside,
            );
        }
        if resp.hovered() && ui.input(|i| i.pointer.any_released()) && *p != e.id {
            *pending = Some((
                (*p).clone(),
                if before {
                    Drop::Before(e.id.clone())
                } else {
                    Drop::Into(e.id.clone())
                },
            ));
        }
    }
    if resp.double_clicked() {
        st.push(crate::state::Action::Focus);
    }
    // F2 renames the selected entity (Unity/Godot); handled on the row that is selected and hovered panel
    if selected
        && st.hierarchy_rename.is_none()
        && !ui.ctx().wants_keyboard_input()
        && ui.input(|i| i.key_pressed(egui::Key::F2))
    {
        st.hierarchy_rename = Some((e.id.clone(), e.name.clone()));
    }
    resp.context_menu(|ui| {
        let three = st.is_3d();
        ui.menu_button("Create child", |ui| {
            create_menu(st, ui, three, Some(e.id.clone()))
        });
        if ui.button("Rename   F2").clicked() {
            st.hierarchy_rename = Some((e.id.clone(), e.name.clone()));
            ui.close_menu();
        }
        if e.prefab.is_some() {
            if ui.button("Unpack prefab").clicked() {
                st.unpack_prefab(&e.id, false);
                ui.close_menu();
            }
            if ui.button("Unpack prefab completely").clicked() {
                st.unpack_prefab(&e.id, true);
                ui.close_menu();
            }
        } else if ui.button("Create prefab").clicked() {
            st.make_prefab(&e.id, "prefabs");
            ui.close_menu();
        }
        if ui.button("Create empty parent").clicked() {
            st.select(Some(e.id.clone()));
            st.group_selected();
            ui.close_menu();
        }
        ui.separator();
        for (i, t) in ["Add child", "Duplicate", "Delete", "Copy", "Paste"]
            .iter()
            .enumerate()
        {
            if ui.button(*t).clicked() {
                *ctx_action = Some((e.id.clone(), i as u8));
                ui.close_menu();
            }
        }
        let mut en = e.enabled;
        if ui.checkbox(&mut en, "Enabled").clicked() {
            let id = e.id.clone();
            st.edit("Toggle enabled", None, |l| {
                if let Some(x) = scene_ops::find_mut(l, &id) {
                    x.enabled = en;
                }
            });
        }
    });
}
