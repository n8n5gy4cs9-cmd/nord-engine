//! Project → Desktop app permissions (M9-12): review/edit `desktop` in nord.project.json (least privilege by default).
//! The summary is computed by `nord-desktop` itself, so what you see is exactly what the runtime enforces.
use crate::state::{EditorState, LogLevel};
use serde_json::{json, Map, Value};

#[derive(Default)]
pub struct DesktopUi {
    pub open: bool,
}

const ROOTS: [&str; 4] = ["documents", "downloads", "temp", "picked"];

fn flag(
    perms: &mut Map<String, Value>,
    ui: &mut egui::Ui,
    key: &str,
    label: &str,
    default: bool,
    tip: &str,
) -> bool {
    let mut v = perms.get(key).and_then(Value::as_bool).unwrap_or(default);
    let r = ui.checkbox(&mut v, label).on_hover_text(tip).changed();
    if r {
        perms.insert(key.into(), json!(v));
    }
    r
}

fn list_field(
    perms: &mut Map<String, Value>,
    ui: &mut egui::Ui,
    key: &str,
    hint: &str,
    sub: Option<&str>,
) -> bool {
    let cur = match sub {
        Some(s) => perms.get(key).and_then(|v| v.get(s)),
        None => perms.get(key),
    };
    let mut text = cur
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();
    if ui
        .add(
            egui::TextEdit::singleline(&mut text)
                .hint_text(hint)
                .desired_width(260.0),
        )
        .changed()
    {
        let arr: Vec<Value> = text
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| json!(s))
            .collect();
        match sub {
            Some(s) => {
                let o = perms.entry(key).or_insert_with(|| json!({}));
                o[s] = Value::Array(arr);
            }
            None => {
                perms.insert(key.into(), Value::Array(arr));
            }
        }
        return true;
    }
    false
}

pub fn window(st: &mut EditorState, ctx: &egui::Context) {
    if !st.desktop_ui.open {
        return;
    }
    let mut open = true;
    let mut save = false;
    egui::Window::new("Desktop app").open(&mut open).default_width(480.0).show(ctx, |ui| {
        let Some(p) = st.project.as_mut() else {
            ui.weak("No project open");
            return;
        };
        let mut enabled = !p.desktop.is_empty();
        if ui.checkbox(&mut enabled, "This project is a desktop app (uses window.nord.desktop / the Rust Desktop API)").changed() {
            if enabled {
                p.desktop.insert("permissions".into(), json!({}));
            } else {
                p.desktop.clear();
            }
        }
        if p.desktop.is_empty() {
            ui.weak("Off: games get no file, notification or clipboard access.");
            return;
        }
        let perms_v = p.desktop.entry("permissions").or_insert_with(|| json!({}));
        if !perms_v.is_object() {
            *perms_v = json!({});
        }
        let perms = perms_v.as_object_mut().unwrap();
        ui.separator();
        ui.strong("Permissions");
        flag(perms, ui, "dialogs", "File dialogs & message boxes", true, "open/save/folder pickers and alerts");
        flag(perms, ui, "storage", "Own storage (settings, key-value, secrets)", true, "only touches the app's data folder");
        flag(perms, ui, "notifications", "Notifications, dock/taskbar badge", false, "");
        flag(perms, ui, "tray", "Tray / menu-bar icon", false, "");
        flag(perms, ui, "globalShortcuts", "Global keyboard shortcuts (asks first)", false, "");
        flag(perms, ui, "windows", "Open extra windows", false, "");
        flag(perms, ui, "server", "Run local web servers (asks first)", false, "static file server on 127.0.0.1");
        ui.horizontal(|ui| {
            ui.label("Clipboard");
            let cur = perms.get("clipboard").and_then(Value::as_str).unwrap_or("none").to_string();
            egui::ComboBox::from_id_salt("clip").selected_text(&cur).show_ui(ui, |ui| {
                for v in ["none", "write", "read"] {
                    if ui.selectable_label(cur == v, v).clicked() {
                        perms.insert("clipboard".into(), json!(v));
                    }
                }
            });
        });
        ui.label("Files (beyond the app's own data folder)");
        ui.horizontal(|ui| {
            let fs = perms.entry("fs").or_insert_with(|| json!({}));
            let mut roots: Vec<String> = fs["roots"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default();
            let mut changed = false;
            for r in ROOTS {
                let mut on = roots.iter().any(|x| x == r);
                if ui.checkbox(&mut on, r).on_hover_text(if r == "picked" { "paths the user chose in a dialog" } else { "" }).changed() {
                    roots.retain(|x| x != r);
                    if on {
                        roots.push(r.into());
                    }
                    changed = true;
                }
            }
            let mut w = fs["write"].as_bool().unwrap_or(false);
            if ui.checkbox(&mut w, "write").changed() {
                fs["write"] = json!(w);
            }
            if changed {
                fs["roots"] = json!(roots);
            }
        });
        ui.horizontal(|ui| {
            ui.label("Network hosts");
            list_field(perms, ui, "net", "api.example.com, *.cdn.org", Some("hosts"));
        });
        ui.horizontal(|ui| {
            ui.label("Programs it may run");
            list_field(perms, ui, "process", "git, ffmpeg", None);
        });
        flag(perms, ui, "prompt", "Ask before first use of sensitive capabilities", true, "network, programs, shortcuts, clipboard read, servers, autostart");
        let single = p.desktop.get("singleInstance").and_then(Value::as_bool).unwrap_or(false);
        let mut s = single;
        if ui.checkbox(&mut s, "Single instance (second launch forwards its files to the first)").changed() {
            p.desktop.insert("singleInstance".into(), json!(s));
        }
        ui.separator();
        ui.strong("What the app can do (as enforced)");
        match nord_desktop::caps::Permissions::from_json(p.desktop.get("permissions").unwrap_or(&Value::Null)) {
            Ok(perm) => {
                for l in perm.summary() {
                    ui.label(format!("• {l}"));
                }
            }
            Err(e) => {
                ui.colored_label(ui.visuals().error_fg_color, e.to_string());
            }
        }
        ui.separator();
        ui.horizontal(|ui| {
            if ui.button("Save to nord.project.json").clicked() {
                save = true;
            }
            ui.weak("Audit log: <app data>/audit.log (every call, allowed or denied)");
        });
    });
    if save {
        if let (Some(root), Some(p)) = (st.root.clone(), st.project.clone()) {
            match nord_core::io::save_project(&root, &p) {
                Ok(()) => st.log(LogLevel::Info, "Saved desktop permissions"),
                Err(e) => st.log(LogLevel::Error, format!("Could not save project: {e}")),
            }
        }
    }
    if !open {
        st.desktop_ui.open = false;
    }
}
