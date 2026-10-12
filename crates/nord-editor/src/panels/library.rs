//! Library browser: reads `<engine>/library/INDEX.json` (format: docs/PROJECT_FORMAT.md), search, preview, insert.
use crate::state::{Action, EditorState, LogLevel};
use egui::Ui;
use nord_core::scene::{Entity, PrefabRef, ScriptRef};
use serde::Deserialize;
use serde_json::Map;

#[derive(Deserialize, Clone, Debug)]
pub struct Item {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub kind: String,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub tier: Vec<String>,
    pub file: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub attributes: Vec<String>,
}

#[derive(Default)]
pub struct LibraryUi {
    pub items: Vec<Item>,
    pub loaded: bool,
    pub search: String,
    pub sel: Option<String>,
    pub preview: String,
}

pub fn load(st: &mut EditorState) {
    st.library.loaded = true;
    st.library.items = st
        .engine_root
        .as_ref()
        .and_then(|r| nord_core::io::load_json::<Vec<Item>>(&r.join("library/INDEX.json")).ok())
        .unwrap_or_default();
}

/// Insert the item into the project. Scripts are copied to `scripts/` and attached to the selection; prefabs are copied to
/// `prefabs/` and instantiated; snippets go to the clipboard (and the active code document when one is focused).
pub fn insert(st: &mut EditorState, it: &Item) -> Result<String, String> {
    let (Some(root), Some(engine)) = (st.root.clone(), st.engine_root.clone()) else {
        return Err("open a project first".into());
    };
    let src = engine.join(&it.file);
    let name = src
        .file_name()
        .ok_or("bad file")?
        .to_string_lossy()
        .into_owned();
    match it.kind.as_str() {
        "script" => {
            let rel = format!("scripts/{name}");
            std::fs::create_dir_all(root.join("scripts")).map_err(|e| e.to_string())?;
            if !root.join(&rel).exists() {
                std::fs::copy(&src, root.join(&rel)).map_err(|e| e.to_string())?;
            }
            st.script_cache.remove(&rel);
            if let Some(id) = st.selection.first().cloned() {
                st.edit("Add library script", None, |l| {
                    if let Some(e) = crate::scene_ops::find_mut(l, &id) {
                        e.scripts.push(ScriptRef {
                            path: rel.clone(),
                            attributes: Map::new(),
                        });
                    }
                });
                Ok(format!("Added {rel} to the selected entity"))
            } else {
                Ok(format!("Copied to {rel} (select an entity to attach it)"))
            }
        }
        "prefab" => {
            let rel = format!("prefabs/{name}");
            std::fs::create_dir_all(root.join("prefabs")).map_err(|e| e.to_string())?;
            if !root.join(&rel).exists() {
                std::fs::copy(&src, root.join(&rel)).map_err(|e| e.to_string())?;
            }
            let mut e = Entity::new(&it.title);
            e.prefab = Some(PrefabRef {
                path: rel.clone(),
                overrides: Map::new(),
            });
            let id = e.id.clone();
            let parent = st.selection.first().cloned();
            st.edit("Add prefab instance", None, |l| {
                crate::scene_ops::insert(l, parent.as_deref(), usize::MAX, e);
            });
            st.select(Some(id));
            st.refresh_assets();
            Ok(format!("Instantiated {rel}"))
        }
        _ => {
            let text = std::fs::read_to_string(&src).map_err(|e| e.to_string())?;
            Ok(format!("__clip__{text}"))
        }
    }
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    if !st.library.loaded {
        load(st);
    }
    ui.horizontal(|ui| {
        ui.add(
            egui::TextEdit::singleline(&mut st.library.search)
                .hint_text("Search library…")
                .desired_width(220.0),
        );
        if ui.small_button("Reload").clicked() {
            load(st);
        }
        ui.weak(format!("{} items", st.library.items.len()));
    });
    if st.library.items.is_empty() {
        ui.weak("No library found (expected library/INDEX.json in the engine folder).");
        return;
    }
    let q = st.library.search.to_lowercase();
    let is3d = st.is_3d();
    let items: Vec<Item> = st
        .library
        .items
        .iter()
        .filter(|i| {
            q.is_empty()
                || i.title.to_lowercase().contains(&q)
                || i.tags.iter().any(|t| t.contains(&q))
                || i.category.contains(&q)
                || i.description.to_lowercase().contains(&q)
        })
        .filter(|i| {
            st.project.is_none()
                || i.tier.is_empty()
                || i.tier
                    .iter()
                    .any(|t| t == if is3d { "3d" } else { "2d" } || t == "any")
        })
        .cloned()
        .collect();
    let mut insert_it: Option<Item> = None;
    let mut pick: Option<Item> = None;
    ui.columns(2, |cols| {
        egui::ScrollArea::vertical()
            .id_salt("libl")
            .show(&mut cols[0], |ui| {
                for it in &items {
                    let sel = st.library.sel.as_deref() == Some(&it.id);
                    if ui
                        .selectable_label(sel, format!("{}  ·  {}", it.title, it.category))
                        .clicked()
                    {
                        pick = Some(it.clone());
                    }
                }
            });
        let ui = &mut cols[1];
        if let Some(it) = st
            .library
            .sel
            .as_ref()
            .and_then(|id| st.library.items.iter().find(|i| i.id == *id))
            .cloned()
        {
            ui.heading(&it.title);
            ui.label(&it.description);
            ui.weak(format!(
                "{} · tags: {} · attributes: {}",
                it.kind,
                it.tags.join(", "),
                it.attributes.join(", ")
            ));
            if ui
                .button(if it.kind == "snippet" {
                    "Copy snippet"
                } else {
                    "Insert"
                })
                .clicked()
            {
                insert_it = Some(it.clone());
            }
            egui::ScrollArea::vertical().id_salt("libp").show(ui, |ui| {
                ui.add(
                    egui::TextEdit::multiline(&mut st.library.preview.as_str())
                        .code_editor()
                        .desired_width(f32::INFINITY),
                );
            });
        } else {
            ui.weak("Select an item to preview it");
        }
    });
    if let Some(it) = pick {
        st.library.preview = st
            .engine_root
            .as_ref()
            .and_then(|r| std::fs::read_to_string(r.join(&it.file)).ok())
            .unwrap_or_default();
        st.library.sel = Some(it.id);
    }
    if let Some(it) = insert_it {
        match insert(st, &it) {
            Ok(m) if m.starts_with("__clip__") => {
                ui.ctx().copy_text(m[8..].to_string());
                st.toast("Snippet copied to clipboard");
            }
            Ok(m) => {
                st.toast(m.clone());
                st.log(LogLevel::Info, m);
                st.push(Action::SaveAll);
            }
            Err(e) => st.log(LogLevel::Error, format!("Library insert failed: {e}")),
        }
    }
}
