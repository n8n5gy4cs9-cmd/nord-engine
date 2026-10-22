//! Small helpers around the edges of the editor: *New scene* dialog with templates, Game-view screenshots, and the
//! "first 10 minutes" checklist (Help ▸ First 10 minutes).
use crate::state::{Action, EditorState};
use nord_core::scene::{Entity, Scene};
use serde_json::json;

#[derive(Default)]
pub struct FunUi {
    pub new_scene_open: bool,
    pub new_name: String,
    pub new_template: usize,
    pub tutorial_open: bool,
    /// set once the game has been started from this editor session (tutorial step)
    pub played: bool,
    pub shots: u32,
    pub profiler: Profiler,
}

/// Window ▸ Profiler: polls the running game's debugger (`game.enableDebug()`), shows fps, frame time graph, objects, draw calls.
#[derive(Default)]
pub struct Profiler {
    pub open: bool,
    pub last_poll: Option<std::time::Instant>,
    pub data: Option<serde_json::Value>,
}

pub const PROFILER_JS: &str = "(()=>{const g=window.__nord;if(!g)return;const d=g.debug??g.enableDebug();const s=d.stats();fetch('/api/ipc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({t:'profiler',fps:s.fps,ms:s.frameMs,worst:s.worstMs,objects:s.objects,draws:s.drawCalls??null,heap:s.heapMB??null,slow:s.slowFrames,frames:d.frames.slice(-120),costs:s.costs.slice(0,8).map(c=>({l:c.label,ms:c.ms,n:c.calls}))})}).catch(()=>{});})()";

impl Profiler {
    /// JS to run now (every 0.5 s while open and the game runs).
    pub fn poll(&mut self, playing: bool) -> Option<&'static str> {
        if !self.open || !playing {
            return None;
        }
        if self
            .last_poll
            .is_some_and(|t| t.elapsed().as_secs_f32() < 0.5)
        {
            return None;
        }
        self.last_poll = Some(std::time::Instant::now());
        Some(PROFILER_JS)
    }
}

pub const TEMPLATES: [&str; 4] = [
    "Empty",
    "2D starter (camera + text)",
    "3D starter (camera, sun, ground, cube)",
    "UI screen host",
];

/// Entities of a new scene for template `i`.
pub fn template_scene(name: &str, i: usize) -> Scene {
    let mut s = Scene::new(name);
    let mut ent = |n: &str, comps: Vec<serde_json::Value>, pos: [f64; 3]| {
        let mut e = Entity::new(n);
        e.transform.pos = pos;
        for c in comps {
            if let Ok(c) = serde_json::from_value(c) {
                e.components.push(c);
            }
        }
        s.entities.push(e);
    };
    match i {
        1 => {
            ent("Camera", vec![json!({"type":"camera"})], [0.0, 0.0, 0.0]);
            ent(
                "Hello",
                vec![json!({"type":"text","text":"Hello Nord","size":32})],
                [320.0, 180.0, 0.0],
            );
        }
        2 => {
            ent("Camera", vec![json!({"type":"camera"})], [0.0, 3.0, 8.0]);
            ent(
                "Directional Light",
                vec![json!({"type":"light","kind":"directional","intensity":1.2})],
                [0.0, 5.0, 0.0],
            );
            ent(
                "Ground",
                vec![
                    json!({"type":"mesh","shape":"ground","size":[20,0.2,20]}),
                    json!({"type":"material"}),
                ],
                [0.0, 0.0, 0.0],
            );
            ent(
                "Cube",
                vec![
                    json!({"type":"mesh","shape":"box"}),
                    json!({"type":"material"}),
                ],
                [0.0, 0.5, 0.0],
            );
        }
        3 => {
            ent("Camera", vec![json!({"type":"camera"})], [0.0, 0.0, 0.0]);
            ent(
                "UI",
                vec![json!({"type":"uiPanel","w":240,"h":120})],
                [0.0, 0.0, 0.0],
            );
        }
        _ => {}
    }
    s
}

fn create_scene(st: &mut EditorState) {
    let Some(root) = st.root.clone() else {
        st.toast("Open a project first");
        return;
    };
    let stem: String = st
        .fun_ui
        .new_name
        .trim()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let stem = if stem.is_empty() {
        "new-scene".to_string()
    } else {
        stem
    };
    let rel = format!("scenes/{stem}.scene.json");
    if root.join(&rel).exists() {
        st.toast(format!("{rel} already exists"));
        return;
    }
    if st.dirty {
        st.save();
    }
    let scene = template_scene(&stem, st.fun_ui.new_template);
    let _ = nord_core::vfs::create_dir_all(root.join("scenes"));
    if nord_core::io::save_json(&root.join(&rel), &scene).is_err() {
        st.toast("Could not write the scene file");
        return;
    }
    match st.open_scene(&rel) {
        Ok(()) => st.toast(format!("Created {rel}")),
        Err(e) => st.toast(format!("Created but could not open: {e}")),
    }
    st.fun_ui.new_scene_open = false;
}

/// Decode standard base64 (the Game view posts screenshots as a data URL); ignores whitespace, stops at padding.
pub fn base64_decode(s: &str) -> Vec<u8> {
    let val = |c: u8| match c {
        b'A'..=b'Z' => Some(c - b'A'),
        b'a'..=b'z' => Some(c - b'a' + 26),
        b'0'..=b'9' => Some(c - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    };
    let (mut out, mut acc, mut bits) = (Vec::with_capacity(s.len() * 3 / 4), 0u32, 0);
    for v in s.bytes().filter_map(val) {
        acc = (acc << 6) | u32::from(v);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    out
}

impl EditorState {
    /// Game view message `{t:"shot", data:"data:image/png;base64,…"}` → `<project>/screenshots/shot-N.png`.
    pub fn save_screenshot(&mut self, data_url: &str) {
        let Some(root) = self.root.clone() else {
            return;
        };
        let b64 = data_url.split_once(',').map_or(data_url, |(_, b)| b);
        let bytes = base64_decode(b64);
        if bytes.is_empty() {
            self.toast("Screenshot failed (empty image)");
            return;
        }
        let dir = root.join("screenshots");
        let _ = nord_core::vfs::create_dir_all(&dir);
        let mut n = self.fun_ui.shots + 1;
        while dir.join(format!("shot-{n}.png")).exists() {
            n += 1;
        }
        self.fun_ui.shots = n;
        let file = dir.join(format!("shot-{n}.png"));
        match nord_core::vfs::write(&file, bytes) {
            Ok(()) => self.toast(format!("Saved screenshots/shot-{n}.png")),
            Err(e) => self.toast(format!("Could not save the screenshot: {e}")),
        }
    }
}

/// JS run inside the game page: posts the canvas as a PNG data URL to the editor.
pub const SHOT_JS: &str = "(()=>{const c=document.querySelector('canvas');if(!c)return;requestAnimationFrame(()=>{try{fetch('/api/ipc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({t:'shot',data:c.toDataURL('image/png')})});}catch(e){}});})()";

fn profiler_window(st: &mut EditorState, ctx: &egui::Context) {
    if !st.fun_ui.profiler.open {
        return;
    }
    let mut open = true;
    let playing = st.is_playing();
    egui::Window::new("Profiler")
        .open(&mut open)
        .default_width(420.0)
        .show(ctx, |ui| {
            let Some(d) = st.fun_ui.profiler.data.clone().filter(|_| playing) else {
                ui.weak(if playing {
                    "Waiting for the game…"
                } else {
                    "Press Play to profile the running game"
                });
                return;
            };
            let n = |k: &str| d[k].as_f64().unwrap_or(0.0);
            ui.label(format!(
                "{:.0} fps · {:.2} ms avg · worst {:.1} ms · {} objects{}{} · {} slow frames",
                n("fps"),
                n("ms"),
                n("worst"),
                n("objects") as u64,
                d["draws"]
                    .as_f64()
                    .map_or(String::new(), |v| format!(" · {v} draws")),
                d["heap"]
                    .as_f64()
                    .map_or(String::new(), |v| format!(" · {v:.1} MB")),
                n("slow") as u64
            ));
            let frames: Vec<f32> = d["frames"]
                .as_array()
                .map(|a| a.iter().map(|v| v.as_f64().unwrap_or(0.0) as f32).collect())
                .unwrap_or_default();
            let (rect, _) = ui
                .allocate_exact_size(egui::vec2(ui.available_width(), 70.0), egui::Sense::hover());
            let p = ui.painter_at(rect);
            p.rect_filled(rect, 2.0, ui.visuals().extreme_bg_color);
            let max = frames.iter().copied().fold(33.0_f32, f32::max);
            let w = rect.width() / frames.len().max(1) as f32;
            for (i, ms) in frames.iter().enumerate() {
                let h = rect.height() * (ms / max);
                let c = if *ms > 33.0 {
                    egui::Color32::from_rgb(255, 90, 90)
                } else {
                    ui.visuals().hyperlink_color
                };
                p.rect_filled(
                    egui::Rect::from_min_max(
                        egui::pos2(rect.left() + i as f32 * w, rect.bottom() - h),
                        egui::pos2(rect.left() + (i as f32 + 1.0) * w - 1.0, rect.bottom()),
                    ),
                    0.0,
                    c,
                );
            }
            ui.weak(format!(
                "frame time, last {} frames (scale 0–{:.0} ms)",
                frames.len(),
                max
            ));
            ui.separator();
            for c in d["costs"].as_array().into_iter().flatten() {
                ui.label(format!(
                    "{:.2} ms ×{} · {}",
                    c["ms"].as_f64().unwrap_or(0.0),
                    c["n"].as_u64().unwrap_or(0),
                    c["l"].as_str().unwrap_or("")
                ));
            }
        });
    if !open {
        st.fun_ui.profiler.open = false;
    }
    ctx.request_repaint_after(std::time::Duration::from_millis(500));
}

pub fn windows(st: &mut EditorState, ctx: &egui::Context) {
    profiler_window(st, ctx);
    if st.fun_ui.new_scene_open {
        let mut open = true;
        let mut go = false;
        egui::Window::new("New scene")
            .open(&mut open)
            .collapsible(false)
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label("Name");
                    let r = ui.text_edit_singleline(&mut st.fun_ui.new_name);
                    if r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                        go = true;
                    }
                });
                ui.label("Template");
                for (i, t) in TEMPLATES.iter().enumerate() {
                    ui.radio_value(&mut st.fun_ui.new_template, i, *t);
                }
                ui.horizontal(|ui| {
                    if ui.button("Create").clicked() {
                        go = true;
                    }
                    if ui.button("Cancel").clicked() {
                        st.fun_ui.new_scene_open = false;
                    }
                });
            });
        if go {
            create_scene(st);
        }
        if !open {
            st.fun_ui.new_scene_open = false;
        }
    }
    if st.fun_ui.tutorial_open {
        let mut open = true;
        let ents = st.scene.as_ref().map_or(0, |s| scene_count(&s.entities));
        let has_script = st.scene.as_ref().is_some_and(|s| has_script(&s.entities));
        let steps = [
            (st.project.is_some(), "Create or open a project (File ▸ New project…)"),
            (ents > 0, "Add an entity: GameObject menu ▸ any preset, or the + in the Hierarchy"),
            (ents > 1, "Add a second one and drag it onto the first in the Hierarchy to make a child"),
            (has_script, "Attach a script: Assets ▸ Create ▸ MonoBehaviour script, then drop it on an entity"),
            (st.fun_ui.played, "Press Play (F5) and watch the Game view"),
            (!st.dirty && st.scene_file.is_some() && ents > 0, "Save with Cmd+S"),
            (st.export_ui.is_running() || st.build_ui.run_after, "Build it: File ▸ Build Settings… ▸ Build And Run"),
        ];
        let done = steps.iter().filter(|s| s.0).count();
        egui::Window::new("First 10 minutes")
            .open(&mut open)
            .default_width(460.0)
            .show(ctx, |ui| {
                ui.add(
                    egui::ProgressBar::new(done as f32 / steps.len() as f32)
                        .text(format!("{done}/{}", steps.len())),
                );
                for (ok, text) in steps {
                    ui.horizontal(|ui| {
                        ui.colored_label(
                            if ok {
                                egui::Color32::from_rgb(94, 196, 122)
                            } else {
                                ui.visuals().weak_text_color()
                            },
                            if ok { "☑" } else { "☐" },
                        );
                        ui.label(text);
                    });
                }
                ui.separator();
                if ui.button("Open the manual").clicked() {
                    st.push(Action::ShowTab(crate::app::Tab::Docs));
                }
            });
        if !open {
            st.fun_ui.tutorial_open = false;
        }
    }
}

fn scene_count(l: &[Entity]) -> usize {
    l.iter().map(|e| 1 + scene_count(&e.children)).sum()
}

fn has_script(l: &[Entity]) -> bool {
    l.iter()
        .any(|e| !e.scripts.is_empty() || has_script(&e.children))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64_roundtrip_and_templates() {
        assert_eq!(base64_decode("aGVsbG8="), b"hello");
        assert_eq!(base64_decode("aGVs\nbG8gd29ybGQ="), b"hello world");
        assert!(template_scene("x", 0).entities.is_empty());
        assert_eq!(template_scene("x", 2).entities.len(), 4);
    }
}
