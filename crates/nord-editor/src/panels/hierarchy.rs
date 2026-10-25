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
        ui.menu_button("+ Create", |ui| {
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
    // rows in the order they are drawn: the base of Shift range select and of multi-drag ordering
    let order: Vec<String> = if filter.is_empty() {
        visible_ids(&entities, &st.collapsed)
    } else {
        scene_ops::flatten(&entities)
            .into_iter()
            .filter(|(_, e)| {
                e.name.to_lowercase().contains(&filter)
                    || e.tags.iter().any(|t| t.to_lowercase().contains(&filter))
            })
            .map(|(_, e)| e.id.clone())
            .collect()
    };
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
                Sense::click(),
            );
            resp.context_menu(|ui| create_menu(st, ui, st.is_3d(), None));
            // click on empty space = deselect, so "Create" adds to the root
            if resp.clicked() && !st.selection.is_empty() {
                st.select(None);
                st.send_viewport(serde_json::json!({"t":"select","ids":st.selection}));
            }
            let dragging_entity = egui::DragAndDrop::has_payload_of_type::<String>(ui.ctx());
            if let Some(id) = dragging_entity
                .then(|| resp.dnd_release_payload::<String>())
                .flatten()
            {
                pending = Some(((*id).clone(), Drop::Before(String::new())));
            }
            // assets dragged from the Assets panel become entities
            let dragging_asset = egui::DragAndDrop::has_payload_of_type::<
                crate::panels::inspector::AssetDrag,
            >(ui.ctx());
            if let Some(a) = dragging_asset
                .then(|| resp.dnd_release_payload::<crate::panels::inspector::AssetDrag>())
                .flatten()
            {
                asset_drop = Some(a.0.clone());
            }
        });
    if let Some(p) = asset_drop {
        st.add_asset_entity(&p);
    }
    if let Some((id, _)) = clicked {
        let mods = ui.input(|i| i.modifiers);
        if mods.shift {
            // Shift: everything between the anchor and this row (Unity, Godot, Unreal)
            let anchor = st
                .hier_anchor
                .clone()
                .or_else(|| st.selection.first().cloned())
                .unwrap_or_else(|| id.clone());
            let (a, b) = (
                order.iter().position(|x| *x == anchor),
                order.iter().position(|x| *x == id),
            );
            match (a, b) {
                (Some(a), Some(b)) => {
                    st.selection = order[a.min(b)..=a.max(b)].to_vec();
                }
                _ => st.select(Some(id.clone())),
            }
        } else if mods.command {
            // Ctrl/Cmd: toggle this row
            if let Some(i) = st.selection.iter().position(|x| *x == id) {
                st.selection.remove(i);
            } else {
                st.selection.push(id.clone());
            }
            st.hier_anchor = Some(id.clone());
        } else {
            st.select(Some(id.clone()));
            st.hier_anchor = Some(id.clone());
        }
        st.send_viewport(serde_json::json!({"t":"select","ids":st.selection}));
    }
    if let Some((id, d)) = pending {
        let selection = st.selection.clone();
        st.edit("Reparent", None, |l| {
            // dragging a selected row moves the whole selection (top-most rows only, in hierarchy order)
            let ids = moving_ids(l, &selection, &id, &order);
            match d {
                Drop::Into(p) => {
                    for id in ids.iter().filter(|x| **x != p) {
                        scene_ops::reparent(l, id, Some(&p), usize::MAX);
                    }
                }
                Drop::Before(sib) if sib.is_empty() => {
                    for id in &ids {
                        scene_ops::reparent(l, id, None, usize::MAX);
                    }
                }
                Drop::Before(sib) => {
                    for id in ids.iter().filter(|x| **x != sib) {
                        // recomputed every time: each moved row lands just before `sib`, after the one moved before it
                        let parent = scene_ops::parent_of(l, &sib);
                        let idx = match &parent {
                            None => l.iter().position(|e| e.id == sib),
                            Some(p) => scene_ops::find(l, p)
                                .and_then(|p| p.children.iter().position(|e| e.id == sib)),
                        }
                        .unwrap_or(0);
                        scene_ops::reparent(l, id, parent.as_deref(), idx);
                    }
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
            "cube" | "ground" | "plane" | "quad" => "box",
            "sphere" | "capsule" | "cylinder" => "circle",
            "sun" | "light" => "lightbulb",
            "camera" => "video",
            "text" | "ui-label" => "type",
            "ui-button" | "ui-panel" => "layout-grid",
            "sprite" => "image",
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
    item(ui, "Sprite", "sprite");
    if three {
        ui.separator();
        item(ui, "Cube", "cube");
        item(ui, "Sphere", "sphere");
        item(ui, "Capsule", "capsule");
        item(ui, "Cylinder", "cylinder");
        item(ui, "Plane", "plane");
        item(ui, "Quad", "quad");
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
        if double_clicked(ui, &r) {
            frame_in_scene(st, &n.id);
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
            let r = ui
                .selectable_label(st.selection.contains(&id), text)
                .on_hover_text("Inside the prefab: edits are stored as overrides on the instance");
            if r.clicked() {
                *clicked = Some((id.clone(), false));
            }
            if double_clicked(ui, &r) {
                frame_in_scene(st, &id);
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

/// Double-click on a row (also when the row senses drags, which can swallow egui's own `double_clicked`).
fn double_clicked(ui: &Ui, r: &egui::Response) -> bool {
    r.double_clicked()
        || (r.hovered()
            && ui.input(|i| {
                i.pointer
                    .button_double_clicked(egui::PointerButton::Primary)
            }))
}

/// Select `id`, show the Scene tab and frame it there (Unity: double-click in the Hierarchy).
fn frame_in_scene(st: &mut EditorState, id: &str) {
    st.select(Some(id.to_string()));
    st.send_viewport(serde_json::json!({"t":"select","ids":st.selection}));
    st.push(crate::state::Action::ShowTab(crate::app::Tab::Scene));
    st.push(crate::state::Action::Focus);
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
        format!("{} ◆", e.name)
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
                match super::inline_rename(
                    ui,
                    buf,
                    egui::Id::new(("hier-rename", &e.id)),
                    f32::INFINITY,
                ) {
                    super::RenameOutcome::Commit => commit = true,
                    super::RenameOutcome::Cancel => cancel = true,
                    super::RenameOutcome::Editing => {}
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
    let bg_slot = ui.painter().add(egui::Shape::Noop);
    let row_out = ui.horizontal(|ui| {
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
        let style = e.hier.as_ref();
        let mut text = if e.prefab.is_some() {
            egui::RichText::new(label).color(egui::Color32::from_rgb(110, 170, 255))
        } else {
            egui::RichText::new(label)
        };
        if let Some(c) = style.and_then(|h| parse_hex(&h.text)) {
            text = text.color(c);
        }
        if style.is_some_and(|h| h.bold) {
            text = text.strong();
        }
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
    });
    let resp = row_out.inner;
    if let Some(c) = e.hier.as_ref().and_then(|h| parse_hex(&h.bg)) {
        let r =
            egui::Rect::from_x_y_ranges(ui.max_rect().x_range(), row_out.response.rect.y_range());
        ui.painter().set(
            bg_slot,
            egui::Shape::rect_filled(r, 3.0, c.gamma_multiply(0.45)),
        );
    }
    if resp.clicked() {
        *clicked = Some((
            e.id.clone(),
            ui.input(|i| i.modifiers.command || i.modifiers.shift),
        ));
    }
    if resp.drag_started() && !selected {
        *clicked = Some((e.id.clone(), false));
    }
    resp.dnd_set_drag_payload(e.id.clone());
    // an asset dropped on a row sets that entity's sprite / model / audio / material or attaches the script
    // NOTE: egui's `dnd_release_payload::<T>` removes the payload even when it is not a `T`, so only ask for the
    // type that is really being dragged (otherwise an asset check swallows an entity drag and vice versa)
    let dragging_asset =
        egui::DragAndDrop::has_payload_of_type::<crate::panels::inspector::AssetDrag>(ui.ctx());
    if let Some(a) = dragging_asset
        .then(|| resp.dnd_release_payload::<crate::panels::inspector::AssetDrag>())
        .flatten()
    {
        if !st.drop_asset_on_entity(&e.id, &a.0) {
            st.add_asset_entity(&a.0);
        }
    }
    let full =
        egui::Rect::from_x_y_ranges(ui.max_rect().x_range(), row_out.response.rect.y_range());
    let over = ui.rect_contains_pointer(full);
    let hover_id = over
        .then(|| egui::DragAndDrop::payload::<String>(ui.ctx()))
        .flatten();
    if let Some(p) = hover_id {
        let r = full;
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
        if ui.input(|i| i.pointer.any_released()) && *p != e.id {
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
    if double_clicked(ui, &resp) {
        frame_in_scene(st, &e.id);
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
        if let Some(path) = st.model_path_of(e) {
            if ui.button("Open model in 3D Modeler").clicked() {
                st.open_in_modeler(&e.id, &path);
                ui.close_menu();
            }
        }
        ui.menu_button("Hierarchy style", |ui| style_menu(st, ui, e));
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

/// `#rrggbb` -> colour (empty or malformed = None, i.e. the default look).
fn parse_hex(s: &str) -> Option<egui::Color32> {
    let h = s.strip_prefix('#')?;
    let v = u32::from_str_radix(h, 16).ok().filter(|_| h.len() == 6)?;
    Some(egui::Color32::from_rgb(
        (v >> 16) as u8,
        (v >> 8) as u8,
        v as u8,
    ))
}

const STYLE_PRESETS: [&str; 8] = [
    "#e25850", "#e8a23a", "#e6d34a", "#70c048", "#3fb8af", "#5694f0", "#a070e0", "#aaaab2",
];

/// Optional per-entity Hierarchy look (row colour, text colour, bold), stored in the scene as `hier`. Off by default.
fn style_menu(st: &mut EditorState, ui: &mut Ui, e: &Entity) {
    let mut h = e.hier.clone().unwrap_or_default();
    let before = h.clone();
    let hex = |c: [u8; 3]| format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2]);
    let rgb = |s: &str| parse_hex(s).map_or([128, 128, 128], |c| [c.r(), c.g(), c.b()]);
    ui.label("Row colour");
    ui.horizontal(|ui| {
        for p in STYLE_PRESETS {
            if let Some(c) = parse_hex(p) {
                let (r, resp) = ui.allocate_exact_size(egui::vec2(16.0, 16.0), Sense::click());
                ui.painter().rect_filled(r, 3.0, c);
                if resp.clicked() {
                    h.bg = p.into();
                }
            }
        }
        let mut c = rgb(&h.bg);
        if ui.color_edit_button_srgb(&mut c).changed() {
            h.bg = hex(c);
        }
        if ui.small_button("None").clicked() {
            h.bg.clear();
        }
    });
    ui.horizontal(|ui| {
        ui.label("Text colour");
        let mut c = rgb(&h.text);
        if ui.color_edit_button_srgb(&mut c).changed() {
            h.text = hex(c);
        }
        if ui.small_button("Default").clicked() {
            h.text.clear();
        }
    });
    ui.checkbox(&mut h.bold, "Bold");
    if ui.button("Clear style").clicked() {
        h = Default::default();
    }
    if h != before {
        let id = e.id.clone();
        let none = h == Default::default();
        st.edit("Hierarchy style", None, |l| {
            if let Some(x) = scene_ops::find_mut(l, &id) {
                x.hier = if none { None } else { Some(h) };
            }
        });
    }
}

/// Ids of the rows that are drawn, top to bottom (children of collapsed rows are not).
fn visible_ids(list: &[Entity], collapsed: &std::collections::HashSet<String>) -> Vec<String> {
    let mut out = vec![];
    for e in list {
        out.push(e.id.clone());
        if !collapsed.contains(&e.id) {
            out.extend(visible_ids(&e.children, collapsed));
        }
    }
    out
}

/// What a drag of `dragged` moves: the whole selection when `dragged` is part of it, else just `dragged`.
/// Rows whose ancestor is also moving are left out (they travel with it), the rest keep the drawn order.
fn moving_ids(
    list: &[Entity],
    selection: &[String],
    dragged: &str,
    order: &[String],
) -> Vec<String> {
    let mut ids: Vec<String> = if selection.iter().any(|s| s == dragged) {
        selection.to_vec()
    } else {
        vec![dragged.to_string()]
    };
    ids.sort_by_key(|i| order.iter().position(|x| x == i).unwrap_or(usize::MAX));
    let all = ids.clone();
    ids.retain(|id| {
        !all.iter().any(|other| {
            other != id
                && scene_ops::find(list, other).is_some_and(|o| scene_ops::is_descendant(o, id))
        })
    });
    ids
}
