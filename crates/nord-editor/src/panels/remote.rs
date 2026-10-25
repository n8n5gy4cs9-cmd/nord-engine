//! Remote scene tree: while the game runs, Hierarchy and Inspector show the *live* entities of the running game (like Unity's
//! play-mode hierarchy). The editor polls the game page with small JS snippets that POST JSON to `/api/ipc`; edits are
//! evaluated in the game page. Nothing here is saved: stopping the game discards it.
use crate::{
    panels::inspector::{field_ui, Ctx},
    schema,
    state::EditorState,
};
use egui::{DragValue, RichText, Ui};
use serde_json::{json, Value};
use std::time::Instant;

pub const POLL_SECS: f32 = 0.5;

#[derive(Clone, Debug, PartialEq)]
pub struct RNode {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub depth: usize,
}

pub struct Remote {
    pub nodes: Vec<RNode>,
    pub scene: String,
    pub sel: Option<String>,
    pub detail: Option<Value>,
    pub filter: String,
    /// JS snippets waiting to run in the game page (edits)
    pub cmds: Vec<String>,
    pub last_poll: Instant,
}

impl Default for Remote {
    fn default() -> Self {
        Self {
            nodes: vec![],
            scene: String::new(),
            sel: None,
            detail: None,
            filter: String::new(),
            cmds: vec![],
            last_poll: Instant::now(),
        }
    }
}

/// Snippet every poll runs in the game page: posts the entity list when it changed.
const TREE_JS: &str = r#"(()=>{const g=window.__nord;if(!g||!g.scene)return;const out=[];const w=(e,d)=>{out.push({id:e.id,name:e.name,en:e.enabled!==false,d});for(const c of e.children)w(c,d+1)};for(const r of g.scene.roots)w(r,0);const m={t:'remoteTree',scene:g.scene.name,nodes:out};const j=JSON.stringify(m);if(window.__nordTreeLast===j)return;window.__nordTreeLast=j;fetch('/api/ipc',{method:'POST',headers:{'content-type':'application/json'},body:j}).catch(()=>{});})()"#;

fn detail_js(id: &str) -> String {
    format!(
        r#"(()=>{{const g=window.__nord;const e=g&&g.scene&&g.scene.findById({id});if(!e)return;const safe=(v,d=0)=>{{if(v==null||typeof v==='number'||typeof v==='string'||typeof v==='boolean')return v;if(d>3||typeof v==='function')return undefined;if(Array.isArray(v))return v.slice(0,32).map(x=>safe(x,d+1)??null);if(typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){{const o={{}};for(const k of Object.keys(v).slice(0,40)){{const s=safe(v[k],d+1);if(s!==undefined)o[k]=s}}return o}}return undefined}};const m={{t:'remoteEntity',id:e.id,name:e.name,en:e.enabled!==false,tags:e.tags,pos:e.t.pos,rot:e.t.rot,scale:e.t.scale,comps:e.components.map(c=>({{type:c.type,data:safe(c.data)}})),scripts:e.scripts.map(s=>({{name:s.constructor.name,attrs:safe(s.attrs)}})),vars:safe(e.vars)}};const j=JSON.stringify(m);if(window.__nordDetailLast===j)return;window.__nordDetailLast=j;fetch('/api/ipc',{{method:'POST',headers:{{'content-type':'application/json'}},body:j}}).catch(()=>{{}});}})()"#,
        id = json!(id)
    )
}

/// JS for one entity lookup + body, e.g. `with_entity("abc", "e.name='x'")`.
fn with_entity(id: &str, body: &str) -> String {
    format!(
        "(()=>{{const e=window.__nord?.scene?.findById({});if(!e)return;{body};window.__nordDetailLast=null;window.__nordTreeLast=null;}})()",
        json!(id)
    )
}

/// JS that moves a live entity in the running game (Scene-view gizmo drags while playing). Nothing is saved: Stop discards it.
pub fn transform_js(
    id: &str,
    pos: Option<[f64; 3]>,
    rot: Option<[f64; 3]>,
    scale: Option<[f64; 3]>,
) -> String {
    let mut body = String::new();
    for (k, v) in [("pos", pos), ("rot", rot), ("scale", scale)] {
        if let Some(v) = v {
            body.push_str(&format!("e.{k}={};", json!(v)));
        }
    }
    with_entity(id, &body)
}

impl Remote {
    /// Snippets to run now (queued edits, then the periodic poll).
    pub fn take_js(&mut self, playing: bool) -> Vec<String> {
        if !playing {
            *self = Self::default();
            return vec![];
        }
        let mut out = std::mem::take(&mut self.cmds);
        if self.last_poll.elapsed().as_secs_f32() >= POLL_SECS {
            self.last_poll = Instant::now();
            out.push(TREE_JS.into());
            if let Some(id) = &self.sel {
                out.push(detail_js(id));
            }
        }
        out
    }

    /// Handle a `remoteTree` / `remoteEntity` message from the game; false when it is something else.
    pub fn handle(&mut self, m: &Value) -> bool {
        match m["t"].as_str() {
            Some("remoteTree") => {
                self.scene = m["scene"].as_str().unwrap_or("").into();
                self.nodes = m["nodes"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .map(|n| RNode {
                                id: n["id"].as_str().unwrap_or("").into(),
                                name: n["name"].as_str().unwrap_or("").into(),
                                enabled: n["en"].as_bool().unwrap_or(true),
                                depth: n["d"].as_u64().unwrap_or(0) as usize,
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                true
            }
            Some("remoteEntity") => {
                if self.sel.as_deref() == m["id"].as_str() {
                    self.detail = Some(m.clone());
                }
                true
            }
            _ => false,
        }
    }
}

pub fn tree_ui(st: &mut EditorState, ui: &mut Ui) {
    let r = &mut st.remote;
    ui.label(
        RichText::new(format!("▶ LIVE  {}", r.scene))
            .strong()
            .color(egui::Color32::from_rgb(110, 170, 255)),
    )
    .on_hover_text("Entities of the running game. Changes here are not saved.");
    ui.add(
        egui::TextEdit::singleline(&mut r.filter)
            .hint_text("Search entities…")
            .desired_width(f32::INFINITY),
    );
    ui.separator();
    let filter = r.filter.to_lowercase();
    let mut pick = None;
    let mut cmd = None;
    egui::ScrollArea::vertical()
        .id_salt("remote-tree")
        .auto_shrink([false; 2])
        .show(ui, |ui| {
            if r.nodes.is_empty() {
                ui.weak("Waiting for the game…");
            }
            for n in &r.nodes {
                if !filter.is_empty() && !n.name.to_lowercase().contains(&filter) {
                    continue;
                }
                let indent = if filter.is_empty() { n.depth } else { 0 };
                ui.horizontal(|ui| {
                    ui.add_space(indent as f32 * 14.0);
                    let mut t = RichText::new(&n.name);
                    if !n.enabled {
                        t = t.weak();
                    }
                    let resp = ui.selectable_label(r.sel.as_deref() == Some(&n.id), t);
                    if resp.clicked() {
                        pick = Some(n.id.clone());
                    }
                    resp.context_menu(|ui| {
                        if ui
                            .button(if n.enabled { "Deactivate" } else { "Activate" })
                            .clicked()
                        {
                            cmd = Some(with_entity(&n.id, &format!("e.enabled={}", !n.enabled)));
                            ui.close_menu();
                        }
                        if ui.button("Duplicate").clicked() {
                            cmd = Some(with_entity(&n.id, "e.clone()"));
                            ui.close_menu();
                        }
                        if ui.button("Destroy").clicked() {
                            cmd = Some(with_entity(&n.id, "e.destroy()"));
                            ui.close_menu();
                        }
                    });
                });
            }
        });
    if let Some(id) = pick {
        r.sel = Some(id);
        r.detail = None;
        r.last_poll = Instant::now() - std::time::Duration::from_secs(1); // refresh immediately
    }
    r.cmds.extend(cmd);
}

/// Copy a live entity's state (`remoteEntity` message) into the scene entity: transform, active flag, and the values of
/// component fields / script attributes the scene entity already has.
pub fn apply_detail(e: &mut nord_core::scene::Entity, d: &Value) {
    let arr3 = |k: &str| -> Option<[f64; 3]> {
        let a = d[k].as_array()?;
        Some([
            a.first()?.as_f64()?,
            a.get(1)?.as_f64().unwrap_or(0.0),
            a.get(2).and_then(Value::as_f64).unwrap_or(0.0),
        ])
    };
    if let Some(p) = arr3("pos") {
        e.transform.pos = p;
    }
    if let Some(r) = arr3("rot") {
        e.transform.rot = r;
    }
    if let Some(s) = arr3("scale") {
        e.transform.scale = s;
    }
    if let Some(en) = d["en"].as_bool() {
        e.enabled = en;
    }
    for (i, c) in d["comps"].as_array().into_iter().flatten().enumerate() {
        if let (Some(sc), Some(data)) = (e.components.get_mut(i), c["data"].as_object()) {
            if sc.kind == c["type"].as_str().unwrap_or("") {
                for (k, v) in data {
                    if sc.fields.contains_key(k) {
                        sc.fields.insert(k.clone(), v.clone());
                    }
                }
            }
        }
    }
    for (i, s) in d["scripts"].as_array().into_iter().flatten().enumerate() {
        if let (Some(ss), Some(attrs)) = (e.scripts.get_mut(i), s["attrs"].as_object()) {
            for (k, v) in attrs {
                if ss.attributes.contains_key(k) {
                    ss.attributes.insert(k.clone(), v.clone());
                }
            }
        }
    }
}

impl EditorState {
    /// Inspector (play mode) ▸ Apply to scene: keep the live values of entity `id` in the saved scene.
    pub fn apply_remote_to_scene(&mut self, id: &str, d: &Value) {
        let d = d.clone();
        let ok = self.edit("Apply live values to scene", None, |l| {
            if let Some(e) = crate::scene_ops::find_mut(l, id) {
                apply_detail(e, &d);
            }
        });
        self.toast(if ok {
            "Applied to the scene (save to keep it)"
        } else {
            "Nothing to apply (entity not in the open scene, or no changes)"
        });
    }
}

pub fn inspector_ui(st: &mut EditorState, ui: &mut Ui) {
    let r = &mut st.remote;
    let (Some(id), Some(d)) = (r.sel.clone(), r.detail.clone()) else {
        ui.weak("Select a live entity in the Hierarchy");
        return;
    };
    let cx = Ctx {
        assets: &[],
        entities: vec![],
    };
    let mut cmds = vec![];
    let mut docs = None;
    let mut apply = false;
    egui::ScrollArea::vertical()
        .id_salt("remote-insp")
        .auto_shrink([false; 2])
        .show(ui, |ui| {
            ui.label(
                RichText::new("▶ LIVE — not saved").color(egui::Color32::from_rgb(110, 170, 255)),
            );
            let mut name = d["name"].as_str().unwrap_or("").to_string();
            let mut en = d["en"].as_bool().unwrap_or(true);
            ui.horizontal(|ui| {
                if ui.checkbox(&mut en, "").changed() {
                    cmds.push(with_entity(&id, &format!("e.enabled={en}")));
                }
                if ui
                    .add(egui::TextEdit::singleline(&mut name).desired_width(f32::INFINITY))
                    .changed()
                {
                    cmds.push(with_entity(&id, &format!("e.name={}", json!(name))));
                }
            });
            ui.weak(format!("id {id}"));
            if ui
                .button("Apply to scene")
                .on_hover_text("Write these live values into the scene entity (transform, active, existing fields)")
                .clicked()
            {
                apply = true;
            }
            ui.separator();
            for (label, key) in [("Position", "pos"), ("Rotation", "rot"), ("Scale", "scale")] {
                let mut v: Vec<f64> = d[key]
                    .as_array()
                    .map(|a| a.iter().map(|x| x.as_f64().unwrap_or(0.0)).collect())
                    .unwrap_or_default();
                let mut ch = false;
                ui.horizontal(|ui| {
                    ui.label(label);
                    for (i, x) in v.iter_mut().enumerate() {
                        ui.weak(["x", "y", "z"].get(i).copied().unwrap_or("?"));
                        ch |= ui.add(DragValue::new(x).speed(0.5)).changed();
                    }
                });
                if ch {
                    cmds.push(with_entity(&id, &format!("e.{key}={}", json!(v))));
                }
            }
            for (ci, c) in d["comps"].as_array().into_iter().flatten().enumerate() {
                let kind = c["type"].as_str().unwrap_or("?");
                let hr = egui::CollapsingHeader::new(schema::label_of(kind))
                    .id_salt(format!("rc{ci}"))
                    .default_open(true)
                    .show(ui, |ui| {
                        edit_map(ui, &cx, &c["data"], &format!("rc{ci}"), |k, v| {
                            cmds.push(with_entity(
                                &id,
                                &format!("e.set({},{},{})", json!(kind), json!(k), v),
                            ));
                        });
                    });
                if crate::panels::inspector::f1_over(&hr.header_response, ui) {
                    docs = Some(crate::panels::inspector::component_doc(kind));
                }
            }
            for (si, s) in d["scripts"].as_array().into_iter().flatten().enumerate() {
                egui::CollapsingHeader::new(format!(
                    "{} (script)",
                    s["name"].as_str().unwrap_or("script")
                ))
                .id_salt(format!("rs{si}"))
                .default_open(true)
                .show(ui, |ui| {
                    edit_map(ui, &cx, &s["attrs"], &format!("rs{si}"), |k, v| {
                        cmds.push(with_entity(
                            &id,
                            &format!("e.scripts[{si}].attrs[{}]={}", json!(k), v),
                        ));
                    });
                });
            }
        });
    st.remote.cmds.extend(cmds);
    if apply {
        st.apply_remote_to_scene(&id, &d);
    }
    if let Some(p) = docs {
        st.push(crate::state::Action::OpenDocs(p));
    }
}

/// One grid of editable key/value rows; `set(key, json_literal)` is called for each change.
fn edit_map(ui: &mut Ui, cx: &Ctx, data: &Value, id: &str, mut set: impl FnMut(&str, String)) {
    let Some(m) = data.as_object() else {
        ui.weak("(no data)");
        return;
    };
    egui::Grid::new(format!("g-{id}"))
        .num_columns(2)
        .spacing([8.0, 4.0])
        .show(ui, |ui| {
            for (k, v) in m {
                ui.label(schema::label_of(k));
                let mut cur = v.clone();
                let ty = schema::guess(&cur);
                if field_ui(ui, cx, &ty, &mut cur, &format!("{id}.{k}")) {
                    set(k, cur.to_string());
                }
                ui.end_row();
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use nord_core::scene::{Component, Entity};
    use serde_json::json;

    #[test]
    fn scene_view_drags_during_play_become_live_edits() {
        let js = transform_js("abc", Some([1.0, 2.0, 0.0]), None, Some([2.0, 2.0, 1.0]));
        assert!(
            js.contains("findById(\"abc\")")
                && js.contains("e.pos=[1.0,2.0,0.0];")
                && js.contains("e.scale=[2.0,2.0,1.0];")
                && !js.contains("e.rot")
        );
    }

    #[test]
    fn live_values_apply_to_existing_fields_only() {
        let mut e = Entity::new("Coin");
        e.components.push(Component {
            kind: "sprite".into(),
            fields: json!({"tint": "#fff"}).as_object().unwrap().clone(),
        });
        let d = json!({"pos": [5, 6, 0], "en": false,
            "comps": [{"type": "sprite", "data": {"tint": "#f00", "runtimeOnly": 1}}]});
        apply_detail(&mut e, &d);
        assert_eq!(e.transform.pos, [5.0, 6.0, 0.0]);
        assert!(!e.enabled);
        assert_eq!(e.components[0].fields["tint"], json!("#f00"));
        assert!(!e.components[0].fields.contains_key("runtimeOnly"));
    }
}
