//! Event sheet editor (M10-04/05): edits `*.events.json` (spec: docs/EVENT_SHEETS.md). The condition/action picker is fed by
//! `assets/aces.json`, exported from the live runtime registries by `tools/export-aces.mjs`, so it cannot drift from the engine.
//! Tree edits are pure functions on the JSON (tested below); the egui part only collects `Op`s and applies them after drawing.
//! Undo/redo snapshots the whole sheet (sheets are small JSON), coalescing edits that follow each other within 600 ms.
use crate::state::{EditorState, LogLevel};
use egui::{Color32, RichText, Ui};
use nord_core::assets::AssetType;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

pub type Path = Vec<usize>;

// ---------------------------------------------------------------- catalog

pub struct Ace {
    pub id: String,
    pub params: Vec<String>,
    pub raw: Vec<String>,
    pub trigger: bool,
}

pub struct Group {
    pub name: String,
    /// "plugin" (System, Keyboard…), "object" (generic per-object ACEs) or "behavior"
    pub kind: String,
    pub conditions: Vec<Ace>,
    pub actions: Vec<Ace>,
    pub expressions: Vec<String>,
}

fn strings(v: &Value) -> Vec<String> {
    v.as_array()
        .map(|a| a.iter().filter_map(|s| s.as_str().map(String::from)).collect())
        .unwrap_or_default()
}

fn aces(v: &Value) -> Vec<Ace> {
    v.as_array()
        .map(|a| {
            a.iter()
                .map(|x| Ace {
                    id: x["id"].as_str().unwrap_or("").into(),
                    params: strings(&x["params"]),
                    raw: strings(&x["raw"]),
                    trigger: x["trigger"].as_bool().unwrap_or(false),
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn catalog() -> &'static [Group] {
    static C: OnceLock<Vec<Group>> = OnceLock::new();
    C.get_or_init(|| {
        let v: Value = serde_json::from_str(include_str!("../../assets/aces.json")).unwrap_or(Value::Null);
        v["groups"]
            .as_array()
            .map(|g| {
                g.iter()
                    .map(|g| Group {
                        name: g["name"].as_str().unwrap_or("").into(),
                        kind: g["kind"].as_str().unwrap_or("").into(),
                        conditions: aces(&g["conditions"]),
                        actions: aces(&g["actions"]),
                        expressions: strings(&g["expressions"]),
                    })
                    .collect()
            })
            .unwrap_or_default()
    })
}

/// "set-animation" → "Set animation"
pub fn pretty(id: &str) -> String {
    let s = id.replace('-', " ");
    let mut c = s.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

/// Catalog entries matching every word of `query` (group name + ace name), conditions or actions.
pub fn search<'a>(cat: &'a [Group], cond: bool, query: &str) -> Vec<(&'a Group, &'a Ace)> {
    let words: Vec<String> = query.to_lowercase().split_whitespace().map(String::from).collect();
    let mut out = vec![];
    for g in cat {
        for a in if cond { &g.conditions } else { &g.actions } {
            let hay = format!("{} {}", g.name, a.id.replace('-', " ")).to_lowercase();
            if words.iter().all(|w| hay.contains(w)) {
                out.push((g, a));
            }
        }
    }
    out
}

/// The JSON node for a picked ACE. Plugins (System, Keyboard…) are their own object; others get `object`.
pub fn ace_node(g: &Group, a: &Ace, object: &str) -> Value {
    let mut n = json!({ "object": if g.kind == "plugin" { g.name.as_str() } else { object }, "id": a.id });
    if g.kind == "behavior" {
        n["behavior"] = json!(g.name);
    }
    if !a.params.is_empty() {
        let mut p = serde_json::Map::new();
        for k in &a.params {
            p.insert(k.clone(), json!(if a.raw.contains(k) { "" } else { "0" }));
        }
        n["params"] = Value::Object(p);
    }
    n
}

/// Catalog definition of a sheet node (`{object,id,behavior?}`), looked up the way the runtime resolves it.
pub fn find_ace<'a>(cat: &'a [Group], node: &Value, cond: bool) -> Option<&'a Ace> {
    let id = node["id"].as_str()?;
    let want = |g: &&Group| -> bool {
        if let Some(b) = node["behavior"].as_str() {
            g.kind == "behavior" && g.name == b
        } else if g.kind == "plugin" && Some(g.name.as_str()) == node["object"].as_str() {
            true
        } else {
            g.kind == "object"
        }
    };
    cat.iter()
        .filter(want)
        .flat_map(|g| if cond { &g.conditions } else { &g.actions })
        .find(|a| a.id == id)
}

// ---------------------------------------------------------------- tree ops (pure)

pub fn get_list<'a>(events: &'a mut Vec<Value>, parent: &[usize]) -> Option<&'a mut Vec<Value>> {
    let mut list = events;
    for &i in parent {
        list = list.get_mut(i)?.get_mut("children")?.as_array_mut()?;
    }
    Some(list)
}

pub fn node_mut<'a>(events: &'a mut Vec<Value>, path: &[usize]) -> Option<&'a mut Value> {
    let (last, parent) = path.split_last()?;
    get_list(events, parent)?.get_mut(*last)
}

pub fn insert_at(events: &mut Vec<Value>, parent: &[usize], idx: usize, node: Value) -> bool {
    if let Some(p) = node_mut(events, parent) {
        if !p["children"].is_array() {
            p["children"] = json!([]);
        }
    }
    match get_list(events, parent) {
        Some(l) => {
            l.insert(idx.min(l.len()), node);
            true
        }
        None => false,
    }
}

pub fn remove_at(events: &mut Vec<Value>, path: &[usize]) -> Option<Value> {
    let (last, parent) = path.split_last()?;
    let l = get_list(events, parent)?;
    (*last < l.len()).then(|| l.remove(*last))
}

/// Move the node at `from` so it ends up at index `to_idx` of the list under `to_parent` (indices as before the move).
/// Refuses to move a node into itself.
pub fn move_node(events: &mut Vec<Value>, from: &[usize], to_parent: &[usize], to_idx: usize) -> bool {
    if from.is_empty() || to_parent.starts_with(from) {
        return false;
    }
    let (f_last, f_parent) = from.split_last().unwrap();
    let mut to_parent = to_parent.to_vec();
    let mut to_idx = to_idx;
    // removing `from` shifts later siblings of `from` down by one
    if to_parent.as_slice() == f_parent {
        if to_idx > *f_last {
            to_idx -= 1;
        }
    } else if to_parent.len() > f_parent.len() && to_parent.starts_with(f_parent) && to_parent[f_parent.len()] > *f_last {
        to_parent[f_parent.len()] -= 1;
    }
    let Some(n) = remove_at(events, from) else { return false };
    insert_at(events, &to_parent, to_idx, n)
}

pub fn new_event() -> Value {
    json!({ "type": "event", "conditions": [], "actions": [] })
}

pub fn new_sheet(name: &str) -> Value {
    json!({ "format": 1, "name": name, "events": [] })
}

/// Names of global/local variables declared anywhere in the sheet.
pub fn variables(events: &[Value], out: &mut Vec<String>) {
    for e in events {
        if e["type"] == "variable" {
            if let Some(n) = e["name"].as_str() {
                out.push(n.into());
            }
        }
        if let Some(c) = e["children"].as_array() {
            variables(c, out);
        }
    }
}

const BUILTINS: &[&str] = &[
    "abs", "angle", "atan2", "ceil", "choose", "clamp", "cos", "distance", "dt", "find", "floor", "int", "left", "len", "lerp",
    "loopindex", "lowercase", "max", "mid", "min", "pi", "random", "replace", "right", "round", "sin", "sqrt", "tan", "tickcount",
    "time", "tonumber", "uppercase", "zeropad",
];

/// Expression autocomplete: candidates for the identifier at the end of `text`.
pub fn completions(text: &str, vars: &[String], objects: &[String], cat: &[Group]) -> Vec<String> {
    let start = text
        .rfind(|c: char| !(c.is_alphanumeric() || c == '_' || c == '.'))
        .map_or(0, |i| i + 1);
    let word = &text[start..];
    if word.is_empty() {
        return vec![];
    }
    let lw = word.to_lowercase();
    let mut out: Vec<String> = vec![];
    let mut push = |s: String| {
        if s.to_lowercase().starts_with(&lw) && s != word && !out.contains(&s) {
            out.push(s);
        }
    };
    vars.iter().for_each(|v| push(v.clone()));
    objects.iter().for_each(|o| push(o.clone()));
    BUILTINS.iter().for_each(|b| push(format!("{b}{}", if b.len() > 2 && !["dt", "pi", "time", "tickcount", "loopindex"].contains(b) { "(" } else { "" })));
    for g in cat.iter().filter(|g| g.kind == "plugin") {
        g.expressions.iter().for_each(|e| push(format!("{}.{e}", g.name)));
    }
    // `Hero.` → generic object expressions (X, Y, Angle, Count…)
    if let Some((obj, _)) = word.split_once('.') {
        if objects.iter().any(|o| o == obj) {
            for g in cat.iter().filter(|g| g.kind == "object") {
                g.expressions.iter().for_each(|e| push(format!("{obj}.{e}")));
            }
        }
    }
    out.truncate(8);
    out
}

/// Replace the identifier at the end of `text` with `choice`.
pub fn apply_completion(text: &str, choice: &str) -> String {
    let start = text
        .rfind(|c: char| !(c.is_alphanumeric() || c == '_' || c == '.'))
        .map_or(0, |i| i + 1);
    format!("{}{choice}", &text[..start])
}

// ---------------------------------------------------------------- UI state

struct Picker {
    target: Path,
    cond: bool,
    query: String,
}

#[derive(Default)]
pub struct EventsUi {
    pub path: Option<String>,
    pub doc: Value,
    pub dirty: bool,
    undo: Vec<Value>,
    redo: Vec<Value>,
    last_edit: Option<Instant>,
    picker: Option<Picker>,
    new_name: String,
    /// set by load/undo/redo so the diff at the end of the frame is not recorded as a user edit
    skip_record: bool,
}

enum Op {
    Delete(Path),
    Move(Path, i32),
    DropOn { from: Path, onto: Path },
    AddSub(Path),
    AddBelow(Path),
    Duplicate(Path),
    Pick { target: Path, cond: bool },
}

struct Ctx {
    objects: Vec<String>,
    vars: Vec<String>,
}

impl EventsUi {
    pub fn load(&mut self, root: &std::path::Path, rel: &str) -> anyhow::Result<()> {
        self.doc = nord_core::io::load_json(&root.join(rel))?;
        if !self.doc["events"].is_array() {
            self.doc["events"] = json!([]);
        }
        self.path = Some(rel.into());
        self.undo.clear();
        self.redo.clear();
        self.dirty = false;
        self.picker = None;
        self.skip_record = true;
        Ok(())
    }

    fn events(&mut self) -> &mut Vec<Value> {
        if !self.doc["events"].is_array() {
            self.doc["events"] = json!([]);
        }
        self.doc["events"].as_array_mut().unwrap()
    }

    pub fn undo(&mut self) -> bool {
        match self.undo.pop() {
            Some(d) => {
                self.redo.push(std::mem::replace(&mut self.doc, d));
                self.dirty = true;
                self.skip_record = true;
                self.last_edit = None;
                true
            }
            None => false,
        }
    }

    pub fn redo(&mut self) -> bool {
        match self.redo.pop() {
            Some(d) => {
                self.undo.push(std::mem::replace(&mut self.doc, d));
                self.dirty = true;
                self.skip_record = true;
                self.last_edit = None;
                true
            }
            None => false,
        }
    }

    fn record(&mut self, before: Value) {
        let now = Instant::now();
        let coalesce = self.last_edit.is_some_and(|t| now.duration_since(t) < Duration::from_millis(600)) && !self.undo.is_empty();
        if !coalesce {
            self.undo.push(before);
            if self.undo.len() > 200 {
                self.undo.remove(0);
            }
        }
        self.redo.clear();
        self.last_edit = Some(now);
        self.dirty = true;
    }

    fn apply(&mut self, op: Op) {
        let ev = self.events();
        match op {
            Op::Delete(p) => {
                remove_at(ev, &p);
            }
            Op::Move(p, d) => {
                if let Some((last, parent)) = p.split_last() {
                    let to = *last as i32 + d;
                    if let Some(l) = get_list(ev, parent) {
                        if to >= 0 && (to as usize) < l.len() {
                            l.swap(*last, to as usize);
                        }
                    }
                }
            }
            Op::DropOn { from, onto } => {
                if let Some((i, parent)) = onto.split_last() {
                    move_node(ev, &from, parent, *i);
                }
            }
            Op::AddSub(p) => {
                if let Some(n) = node_mut(ev, &p) {
                    if !n["children"].is_array() {
                        n["children"] = json!([]);
                    }
                    n["children"].as_array_mut().unwrap().push(new_event());
                }
            }
            Op::AddBelow(p) => {
                if let Some((i, parent)) = p.split_last() {
                    insert_at(ev, parent, i + 1, new_event());
                }
            }
            Op::Duplicate(p) => {
                if let Some((i, parent)) = p.split_last() {
                    if let Some(n) = node_mut(ev, &p).cloned() {
                        insert_at(ev, parent, i + 1, n);
                    }
                }
            }
            Op::Pick { target, cond } => self.picker = Some(Picker { target, cond, query: String::new() }),
        }
    }
}

// ---------------------------------------------------------------- UI

fn entity_names(st: &EditorState) -> Vec<String> {
    let mut out: Vec<String> = vec![];
    if let Some(s) = &st.scene {
        for e in &s.entities {
            e.walk(&mut |e| {
                out.push(e.name.clone());
                out.extend(e.tags.iter().cloned());
            });
        }
        if let Some(f) = s.settings.extra.get("families").and_then(Value::as_object) {
            out.extend(f.keys().cloned());
        }
    }
    out.sort();
    out.dedup();
    out
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
    let sheets: Vec<String> = st
        .assets
        .iter()
        .filter(|a| a.path.ends_with(".events.json") && matches!(a.kind, AssetType::Json | AssetType::Other))
        .map(|a| a.path.clone())
        .collect();
    let before = st.events.doc.clone();
    let mut load: Option<String> = None;
    let mut save = false;
    let mut create = false;
    let mut attach = false;
    ui.horizontal_wrapped(|ui| {
        egui::ComboBox::from_id_salt("sheet")
            .selected_text(st.events.path.clone().unwrap_or_else(|| "(choose event sheet)".into()))
            .show_ui(ui, |ui| {
                for s in &sheets {
                    if ui.selectable_label(st.events.path.as_deref() == Some(s), s).clicked() {
                        load = Some(s.clone());
                    }
                }
            });
        ui.add(egui::TextEdit::singleline(&mut st.events.new_name).hint_text("new sheet name").desired_width(110.0));
        if ui.button("New").clicked() && !st.events.new_name.trim().is_empty() {
            create = true;
        }
        let open = st.events.path.is_some();
        if ui.add_enabled(open, egui::Button::new("Save")).clicked() {
            save = true;
        }
        if ui.add_enabled(open && st.scene.is_some(), egui::Button::new("Attach to scene")).on_hover_text("sets this scene's settings.eventSheet").clicked() {
            attach = true;
        }
        if ui.add_enabled(!st.events.undo.is_empty(), egui::Button::new("Undo")).clicked() {
            st.events.undo();
        }
        if ui.add_enabled(!st.events.redo.is_empty(), egui::Button::new("Redo")).clicked() {
            st.events.redo();
        }
        if st.events.dirty {
            ui.weak("unsaved •");
        }
    });
    if create {
        let name = st.events.new_name.trim().replace(' ', "-");
        let rel = format!("events/{name}.events.json");
        match nord_core::io::save_json(&root.join(&rel), &new_sheet(&name)) {
            Ok(()) => {
                st.events.new_name.clear();
                st.refresh_assets();
                load = Some(rel);
            }
            Err(e) => st.log(LogLevel::Error, e.to_string()),
        }
    }
    if let Some(rel) = load {
        if let Err(e) = st.events.load(&root, &rel) {
            st.log(LogLevel::Error, format!("{rel}: {e}"));
        }
    }
    if save {
        if let Some(rel) = st.events.path.clone() {
            match nord_core::io::save_json(&root.join(&rel), &st.events.doc) {
                Ok(()) => {
                    st.events.dirty = false;
                    st.toast("Saved event sheet");
                    st.refresh_assets();
                }
                Err(e) => st.log(LogLevel::Error, e.to_string()),
            }
        }
    }
    if attach {
        if let (Some(rel), Some(sc)) = (st.events.path.clone(), st.scene.as_mut()) {
            sc.settings.extra.insert("eventSheet".into(), json!(rel));
            st.dirty = true;
            st.toast("Event sheet attached to this scene (save the scene)");
        }
    }
    if st.events.path.is_none() {
        ui.weak("Pick or create an event sheet. Format: docs/EVENT_SHEETS.md");
        return;
    }
    ui.horizontal(|ui| {
        let ev = st.events.events();
        if ui.button("+ Event").clicked() {
            ev.push(new_event());
        }
        if ui.button("+ Group").clicked() {
            ev.push(json!({"type":"group","title":"Group","active":true,"children":[]}));
        }
        if ui.button("+ Variable").clicked() {
            ev.insert(0, json!({"type":"variable","name":"var1","valueType":"number","value":0}));
        }
        if ui.button("+ Comment").clicked() {
            ev.push(json!({"type":"comment","text":"Comment"}));
        }
    });
    ui.separator();

    let mut vars = vec![];
    variables(&st.events.doc["events"].as_array().cloned().unwrap_or_default(), &mut vars);
    let cx = Ctx { objects: entity_names(st), vars };
    let mut ops: Vec<Op> = vec![];
    egui::ScrollArea::vertical().auto_shrink([false, false]).show(ui, |ui| {
        let ev = st.events.events();
        if ev.is_empty() {
            ui.weak("No events yet — add one above.");
        }
        nodes(ui, ev, &mut vec![], &cx, &mut ops);
    });
    for op in ops {
        st.events.apply(op);
    }
    picker_window(st, ui.ctx(), &cx);
    if std::mem::take(&mut st.events.skip_record) {
    } else if st.events.doc != before {
        st.events.record(before);
    }
}

fn picker_window(st: &mut EditorState, ctx: &egui::Context, cx: &Ctx) {
    let Some(p) = st.events.picker.as_mut() else { return };
    let mut open = true;
    let mut chosen: Option<(usize, usize)> = None;
    let cat = catalog();
    let title = if p.cond { "Add condition" } else { "Add action" };
    egui::Window::new(title).open(&mut open).collapsible(false).default_width(360.0).show(ctx, |ui| {
        let r = ui.add(egui::TextEdit::singleline(&mut p.query).hint_text("search… e.g. 'platform jump' or 'set x'").desired_width(f32::INFINITY));
        if !r.has_focus() && p.query.is_empty() {
            r.request_focus();
        }
        let hits = search(cat, p.cond, &p.query);
        let enter = r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));
        egui::ScrollArea::vertical().max_height(320.0).show(ui, |ui| {
            for (n, (g, a)) in hits.iter().enumerate().take(200) {
                let tag = match g.kind.as_str() {
                    "behavior" => Color32::from_rgb(200, 150, 90),
                    "plugin" => Color32::from_rgb(120, 170, 230),
                    _ => Color32::from_rgb(150, 200, 140),
                };
                let text = RichText::new(format!("{}  ▸  {}{}", g.name, pretty(&a.id), if a.trigger { "  (trigger)" } else { "" })).color(tag);
                if ui.selectable_label(false, text).clicked() || (enter && n == 0) {
                    let gi = cat.iter().position(|x| std::ptr::eq(x, *g)).unwrap();
                    let ai = (if p.cond { &g.conditions } else { &g.actions }).iter().position(|x| std::ptr::eq(x, *a)).unwrap();
                    chosen = Some((gi, ai));
                }
            }
            if hits.is_empty() {
                ui.weak("nothing matches");
            }
        });
    });
    if let Some((gi, ai)) = chosen {
        let (target, cond) = (p.target.clone(), p.cond);
        let g = &cat[gi];
        let a = if cond { &g.conditions[ai] } else { &g.actions[ai] };
        let ev = st.events.events();
        let object = node_mut(ev, &target)
            .and_then(|n| {
                n["conditions"].as_array().into_iter().chain(n["actions"].as_array()).flatten().find_map(|c| {
                    let o = c["object"].as_str()?;
                    (!catalog().iter().any(|g| g.kind == "plugin" && g.name == o)).then(|| o.to_string())
                })
            })
            .or_else(|| cx.objects.first().cloned())
            .unwrap_or_else(|| "Player".into());
        if let Some(n) = node_mut(ev, &target) {
            let key = if cond { "conditions" } else { "actions" };
            if !n[key].is_array() {
                n[key] = json!([]);
            }
            n[key].as_array_mut().unwrap().push(ace_node(g, a, &object));
        }
        st.events.picker = None;
    } else if !open {
        st.events.picker = None;
    }
}

fn nodes(ui: &mut Ui, list: &mut [Value], parent: &mut Path, cx: &Ctx, ops: &mut Vec<Op>) {
    for i in 0..list.len() {
        let mut path = parent.clone();
        path.push(i);
        let ty = list[i]["type"].as_str().unwrap_or("event").to_string();
        match ty.as_str() {
            "group" => group(ui, &mut list[i], &path, cx, ops),
            "comment" => {
                ui.horizontal(|ui| {
                    handle(ui, &path, ops);
                    let mut t = list[i]["text"].as_str().unwrap_or("").to_string();
                    if ui.add(egui::TextEdit::multiline(&mut t).desired_rows(1).desired_width(f32::INFINITY).text_color(Color32::from_rgb(220, 200, 120))).changed() {
                        list[i]["text"] = json!(t);
                    }
                    row_buttons(ui, &path, ops, false);
                });
            }
            "variable" => variable(ui, &mut list[i], &path, ops),
            "include" => {
                ui.horizontal(|ui| {
                    handle(ui, &path, ops);
                    ui.label("Include");
                    let mut t = list[i]["path"].as_str().unwrap_or("").to_string();
                    if ui.text_edit_singleline(&mut t).changed() {
                        list[i]["path"] = json!(t);
                    }
                    row_buttons(ui, &path, ops, false);
                });
            }
            _ => event(ui, &mut list[i], &path, cx, ops, ty == "function-block"),
        }
    }
}

/// Drag handle; dropping it on another row moves this row before that one.
fn handle(ui: &mut Ui, path: &Path, ops: &mut Vec<Op>) {
    let id = egui::Id::new(("ev-drag", path));
    ui.dnd_drag_source(id, path.clone(), |ui| {
        ui.label(RichText::new("⠿").weak());
    });
    let _ = ops;
}

fn drop_target(ui: &Ui, resp: &egui::Response, path: &Path, ops: &mut Vec<Op>) {
    if let Some(from) = resp.dnd_release_payload::<Path>() {
        if *from != *path {
            ops.push(Op::DropOn { from: (*from).clone(), onto: path.clone() });
        }
    } else if resp.dnd_hover_payload::<Path>().is_some() {
        ui.painter().rect_stroke(resp.rect, 2.0, egui::Stroke::new(2.0_f32, Color32::from_rgb(120, 170, 230)), egui::StrokeKind::Outside);
    }
}

fn row_buttons(ui: &mut Ui, path: &Path, ops: &mut Vec<Op>, event: bool) {
    if ui.small_button("✖").on_hover_text("Delete").clicked() {
        ops.push(Op::Delete(path.clone()));
    }
    if ui.small_button("⧉").on_hover_text("Duplicate").clicked() {
        ops.push(Op::Duplicate(path.clone()));
    }
    if ui.small_button("▼").on_hover_text("Move down").clicked() {
        ops.push(Op::Move(path.clone(), 1));
    }
    if ui.small_button("▲").on_hover_text("Move up").clicked() {
        ops.push(Op::Move(path.clone(), -1));
    }
    if event {
        if ui.small_button("＋ below").clicked() {
            ops.push(Op::AddBelow(path.clone()));
        }
        if ui.small_button("＋ sub-event").clicked() {
            ops.push(Op::AddSub(path.clone()));
        }
    }
}

fn variable(ui: &mut Ui, v: &mut Value, path: &Path, ops: &mut Vec<Op>) {
    let r = ui
        .horizontal(|ui| {
            handle(ui, path, ops);
            ui.label(RichText::new("var").color(Color32::from_rgb(180, 140, 220)));
            let mut name = v["name"].as_str().unwrap_or("").to_string();
            if ui.add(egui::TextEdit::singleline(&mut name).desired_width(110.0)).changed() {
                v["name"] = json!(name);
            }
            let mut ty = v["valueType"].as_str().unwrap_or("number").to_string();
            egui::ComboBox::from_id_salt(("vt", path)).selected_text(ty.clone()).width(80.0).show_ui(ui, |ui| {
                for t in ["number", "string", "boolean"] {
                    ui.selectable_value(&mut ty, t.to_string(), t);
                }
            });
            if ty != v["valueType"].as_str().unwrap_or("number") {
                v["valueType"] = json!(ty);
                v["value"] = match ty.as_str() {
                    "string" => json!(""),
                    "boolean" => json!(false),
                    _ => json!(0),
                };
            }
            match ty.as_str() {
                "boolean" => {
                    let mut b = v["value"].as_bool().unwrap_or(false);
                    if ui.checkbox(&mut b, "").changed() {
                        v["value"] = json!(b);
                    }
                }
                "string" => {
                    let mut s = v["value"].as_str().unwrap_or("").to_string();
                    if ui.add(egui::TextEdit::singleline(&mut s).desired_width(140.0)).changed() {
                        v["value"] = json!(s);
                    }
                }
                _ => {
                    let mut n = v["value"].as_f64().unwrap_or(0.0);
                    if ui.add(egui::DragValue::new(&mut n)).changed() {
                        v["value"] = if n.fract() == 0.0 { json!(n as i64) } else { json!(n) };
                    }
                }
            }
            row_buttons(ui, path, ops, false);
        })
        .response;
    drop_target(ui, &r, path, ops);
}

fn group(ui: &mut Ui, g: &mut Value, path: &Path, cx: &Ctx, ops: &mut Vec<Op>) {
    let id = ui.make_persistent_id(("ev-group", path));
    let state = egui::collapsing_header::CollapsingState::load_with_default_open(ui.ctx(), id, true);
    let mut hdr_resp = None;
    state
        .show_header(ui, |ui| {
            let r = ui
                .horizontal(|ui| {
                    handle(ui, path, ops);
                    let mut active = g["active"].as_bool().unwrap_or(true);
                    if ui.checkbox(&mut active, "").on_hover_text("Group active").changed() {
                        g["active"] = json!(active);
                    }
                    let mut t = g["title"].as_str().unwrap_or("").to_string();
                    if ui.add(egui::TextEdit::singleline(&mut t).font(egui::TextStyle::Heading).desired_width(220.0)).changed() {
                        g["title"] = json!(t);
                    }
                    if ui.small_button("＋ event").clicked() {
                        ops.push(Op::AddSub(path.clone()));
                    }
                    row_buttons(ui, path, ops, false);
                })
                .response;
            hdr_resp = Some(r);
        })
        .body(|ui| {
            if !g["children"].is_array() {
                g["children"] = json!([]);
            }
            let mut p = path.clone();
            nodes(ui, g["children"].as_array_mut().unwrap(), &mut p, cx, ops);
        });
    if let Some(r) = hdr_resp {
        drop_target(ui, &r, path, ops);
    }
}

fn event(ui: &mut Ui, ev: &mut Value, path: &Path, cx: &Ctx, ops: &mut Vec<Op>, function: bool) {
    let disabled = ev["disabled"].as_bool().unwrap_or(false);
    let frame = egui::Frame::group(ui.style()).fill(if disabled { Color32::from_black_alpha(40) } else { ui.visuals().faint_bg_color });
    let r = frame.show(ui, |ui| {
        ui.horizontal(|ui| {
            handle(ui, path, ops);
            ui.label(RichText::new(if function { "ƒ".to_string() } else { format!("{}", path.last().unwrap() + 1) }).weak());
            if function {
                let mut n = ev["name"].as_str().unwrap_or("").to_string();
                if ui.add(egui::TextEdit::singleline(&mut n).hint_text("function name").desired_width(120.0)).changed() {
                    ev["name"] = json!(n);
                }
            } else {
                let mut or = ev["block"].as_str() == Some("or");
                if ui.checkbox(&mut or, "Or-block").changed() {
                    ev["block"] = json!(if or { "or" } else { "and" });
                }
            }
            let mut dis = disabled;
            if ui.checkbox(&mut dis, "disabled").changed() {
                ev["disabled"] = json!(dis);
            }
            row_buttons(ui, path, ops, true);
        });
        ui.columns(if function { 1 } else { 2 }, |cols| {
            let mut c = 0;
            if !function {
                ace_list(&mut cols[0], ev, "conditions", path, cx, ops);
                c = 1;
            }
            ace_list(&mut cols[c], ev, "actions", path, cx, ops);
        });
    });
    drop_target(ui, &r.response, path, ops);
    if let Some(ch) = ev.get_mut("children").and_then(Value::as_array_mut) {
        if !ch.is_empty() {
            ui.indent(("ev-children", path), |ui| {
                let mut p = path.clone();
                nodes(ui, ch, &mut p, cx, ops);
            });
        }
    }
}

fn ace_list(ui: &mut Ui, ev: &mut Value, key: &str, path: &Path, cx: &Ctx, ops: &mut Vec<Op>) {
    let cond = key == "conditions";
    let cat = catalog();
    let (color, title) = if cond { (Color32::from_rgb(120, 170, 230), "Conditions") } else { (Color32::from_rgb(130, 200, 130), "Actions") };
    ui.label(RichText::new(title).color(color).small());
    let mut remove: Option<usize> = None;
    let mut swap: Option<(usize, usize)> = None;
    if let Some(list) = ev.get_mut(key).and_then(Value::as_array_mut) {
        let n = list.len();
        for (i, node) in list.iter_mut().enumerate() {
            let def = find_ace(cat, node, cond);
            ui.horizontal_wrapped(|ui| {
                if cond {
                    let mut inv = node["inverted"].as_bool().unwrap_or(false);
                    if ui.toggle_value(&mut inv, "!").on_hover_text("Invert").changed() {
                        node["inverted"] = json!(inv);
                    }
                }
                let obj = node["object"].as_str().unwrap_or("").to_string();
                if cat.iter().any(|g| g.kind == "plugin" && g.name == obj) && node.get("behavior").is_none() {
                    ui.label(RichText::new(&obj).strong());
                } else {
                    ui.menu_button(RichText::new(if obj.is_empty() { "(object)" } else { &obj }).strong(), |ui| {
                        let mut v = obj.clone();
                        if ui.add(egui::TextEdit::singleline(&mut v).hint_text("object / tag / family")).changed() {
                            node["object"] = json!(v);
                        }
                        for o in &cx.objects {
                            if ui.button(o).clicked() {
                                node["object"] = json!(o);
                                ui.close_menu();
                            }
                        }
                    });
                }
                let label = node["id"].as_str().map(pretty).unwrap_or_default();
                let bh = node["behavior"].as_str().map(|b| format!("{b}: ")).unwrap_or_default();
                ui.label(RichText::new(format!("{bh}{label}")).color(color));
                let names: Vec<String> = match def {
                    Some(d) => d.params.clone(),
                    None => node["params"].as_object().map(|o| o.keys().cloned().collect()).unwrap_or_default(),
                };
                for name in names {
                    let raw = def.is_some_and(|d| d.raw.contains(&name));
                    let cur = match &node["params"][&name] {
                        Value::String(s) => s.clone(),
                        Value::Null => String::new(),
                        v => v.to_string(),
                    };
                    if let Some(new) = param_edit(ui, (path, key, i, &name), &name, &cur, raw, cx) {
                        if !node["params"].is_object() {
                            node["params"] = json!({});
                        }
                        node["params"][&name] = json!(new);
                    }
                }
                if ui.small_button("✖").on_hover_text("Remove").clicked() {
                    remove = Some(i);
                }
                if i > 0 && ui.small_button("▲").clicked() {
                    swap = Some((i, i - 1));
                }
                if i + 1 < n && ui.small_button("▼").clicked() {
                    swap = Some((i, i + 1));
                }
            });
        }
        if let Some(i) = remove {
            list.remove(i);
        }
        if let Some((a, b)) = swap {
            list.swap(a, b);
        }
    }
    if ui.small_button(if cond { "＋ Add condition" } else { "＋ Add action" }).clicked() {
        ops.push(Op::Pick { target: path.clone(), cond });
    }
}

/// One parameter: a text box (expression or raw text). Expressions get autocomplete suggestions while focused.
fn param_edit(ui: &mut Ui, salt: (&Path, &str, usize, &str), name: &str, cur: &str, raw: bool, cx: &Ctx) -> Option<String> {
    let mut s = cur.to_string();
    let w = (s.chars().count() as f32 * 7.5 + 24.0).clamp(46.0, 240.0);
    let r = ui.add(
        egui::TextEdit::singleline(&mut s)
            .id(egui::Id::new(("ev-param", salt)))
            .hint_text(name)
            .desired_width(w)
            .text_color(if raw { Color32::from_rgb(200, 170, 120) } else { ui.visuals().text_color() }),
    );
    let mut out = None;
    if s != cur {
        out = Some(s.clone());
    }
    if !raw && (r.has_focus() || r.lost_focus()) {
        let sugg = completions(&s, &cx.vars, &cx.objects, catalog());
        if !sugg.is_empty() {
            let mut picked = None;
            egui::Area::new(egui::Id::new(("ev-ac", salt))).order(egui::Order::Foreground).fixed_pos(r.rect.left_bottom()).show(ui.ctx(), |ui| {
                egui::Frame::popup(ui.style()).show(ui, |ui| {
                    for c in &sugg {
                        let b = ui.selectable_label(false, c);
                        // the text box loses focus on mouse-down, so accept on press rather than on click
                        if b.hovered() && ui.input(|i| i.pointer.primary_pressed()) {
                            picked = Some(apply_completion(&s, c));
                        }
                    }
                });
            });
            if picked.is_some() {
                out = picked;
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tree() -> Vec<Value> {
        vec![
            json!({"type":"variable","name":"score","valueType":"number","value":0}),
            json!({"type":"group","title":"G","children":[
                json!({"type":"event","name":"a"}), json!({"type":"event","name":"b","children":[{"type":"event","name":"b0"}]})]}),
            json!({"type":"event","name":"c"}),
        ]
    }

    fn name(ev: &mut Vec<Value>, p: &[usize]) -> String {
        node_mut(ev, p).map(|n| n["name"].as_str().unwrap_or("?").to_string()).unwrap_or("none".into())
    }

    #[test]
    fn catalog_has_engine_aces() {
        let c = catalog();
        assert!(c.iter().any(|g| g.name == "System" && g.conditions.iter().any(|a| a.id == "every-tick")));
        assert!(c.iter().any(|g| g.kind == "behavior" && g.name == "Platform"));
        assert!(c.iter().any(|g| g.kind == "object"));
    }

    #[test]
    fn search_and_nodes() {
        let c = catalog();
        let hits = search(c, false, "platform jump");
        assert!(hits.iter().any(|(g, a)| g.name == "Platform" && a.id.contains("jump")));
        assert!(search(c, true, "zzzzqq").is_empty());
        let (g, a) = search(c, true, "system compare two").into_iter().next().unwrap();
        let n = ace_node(g, a, "Hero");
        assert_eq!(n["object"], "System");
        assert_eq!(n["params"]["comparison"], "");
        assert_eq!(n["params"]["first"], "0");
        let (g, a) = search(c, false, "platform simulate").into_iter().next().or_else(|| search(c, false, "platform jump").into_iter().next()).unwrap();
        let n = ace_node(g, a, "Hero");
        assert_eq!((n["object"].as_str(), n["behavior"].as_str()), (Some("Hero"), Some("Platform")));
        assert_eq!(find_ace(c, &n, false).map(|a| a.id.as_str()), Some(a.id.as_str()));
    }

    #[test]
    fn tree_move_and_remove() {
        let mut t = tree();
        // a (1,0) after b (1,1): moving to index 2 of the same list
        assert!(move_node(&mut t, &[1, 0], &[1], 2));
        assert_eq!(name(&mut t, &[1, 0]), "b");
        assert_eq!(name(&mut t, &[1, 1]), "a");
        // top-level c into group G at 0
        assert!(move_node(&mut t, &[2], &[1], 0));
        assert_eq!(name(&mut t, &[1, 0]), "c");
        assert_eq!(get_list(&mut t, &[]).unwrap().len(), 2);
        // group into its own descendant is refused
        assert!(!move_node(&mut t, &[1], &[1, 1], 0));
        // moving an earlier sibling into a later sibling's children fixes the shifted path
        let mut t = tree();
        assert!(move_node(&mut t, &[0], &[2], 0));
        assert_eq!(t[1]["type"], "event");
        assert_eq!(t.len(), 2);
        assert_eq!(t[1]["name"], "c");
        assert_eq!(t[1]["children"][0]["name"], "score");
    }

    #[test]
    fn autocomplete() {
        let vars = vec!["score".to_string(), "speed".to_string()];
        let objs = vec!["Hero".to_string()];
        let c = completions("1 + sc", &vars, &objs, catalog());
        assert_eq!(c, vec!["score".to_string()]);
        assert_eq!(apply_completion("1 + sc", "score"), "1 + score");
        assert!(completions("flo", &vars, &objs, catalog()).contains(&"floor(".to_string()));
        assert!(completions("Mouse.", &vars, &objs, catalog()).iter().any(|s| s.starts_with("Mouse.")));
        assert!(completions("Hero.", &vars, &objs, catalog()).iter().any(|s| s.starts_with("Hero.")));
        assert!(completions("", &vars, &objs, catalog()).is_empty());
    }
}
