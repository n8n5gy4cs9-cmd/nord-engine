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

fn node(
    st: &mut EditorState,
    ui: &mut Ui,
    e: &Entity,
    pending: &mut Option<(String, Drop)>,
    clicked: &mut Option<(String, bool)>,
    ctx_action: &mut Option<(String, u8)>,
) {
    if e.children.is_empty() {
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
            });
        }
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
    let resp = ui
        .horizontal(|ui| {
            ui.add(icons::icon(icon, 14.0, tint));
            ui.selectable_label(selected, label)
                .interact(Sense::click_and_drag())
        })
        .inner;
    if resp.clicked() {
        *clicked = Some((
            e.id.clone(),
            ui.input(|i| i.modifiers.command || i.modifiers.shift),
        ));
    }
    resp.dnd_set_drag_payload(e.id.clone());
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
    resp.context_menu(|ui| {
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
