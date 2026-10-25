//! Asset browser: folder tree + thumbnail grid (lazy, worker-thread thumbnails via nord-core), search/filter,
//! import (dialog or OS drag&drop), rename/move/delete, drag out as `AssetDrag`.
use crate::assetmeta::{COLORS, ICON_CHOICES};
use crate::{
    icons,
    panels::inspector::AssetDrag,
    state::{Action, EditorState, LogLevel},
};
use egui::{Sense, Ui, Vec2};
use nord_core::assets::{classify, Asset, AssetType};
use nord_core::vfs::PathExt;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::mpsc::{channel, Receiver, Sender},
    time::Duration,
};
use web_time::Instant;

pub struct AssetsUi {
    pub dir: String, // project-relative folder ("" = project root)
    pub search: String,
    pub size: f32,
    /// list view (rows) instead of the thumbnail grid
    pub list: bool,
    pub kind_filter: Option<AssetType>,
    /// show only ★ favourites
    pub only_favorites: bool,
    pub rename: Option<(String, String)>,
    pub confirm_delete: Option<String>,
    /// last clicked entry (F2 rename, Delete, Ctrl/Cmd+D duplicate act on it)
    pub selected: Option<String>,
    /// scroll the selected entry into view once (set by the Inspector's *Show in Assets* ping)
    pub scroll_to_selected: bool,
    listing: Vec<Entry>,
    listed_at: Option<Instant>,
    listed_dir: String,
    thumbs: HashMap<String, Option<PathBuf>>,
    pending: HashSet<String>,
    tx: Sender<ThumbJob>,
    rx: Receiver<(String, Option<PathBuf>)>,
    /// model asset paths the edit viewport should render (drained by the app when a 3D viewport is connected)
    pub model_requests: Vec<String>,
    /// open asset-metadata dialog (description, new tag, folder icon image)
    meta_dialog: Option<MetaDialog>,
    /// show only assets with this tag id
    pub tag_filter: Option<String>,
    dominant: HashMap<String, (Instant, &'static str)>,
}

#[derive(Clone)]
enum MetaDialog {
    Note(String, String),
    NewTag(String, String, usize),
    IconImage(String),
}

/// A change picked in an entry's context menu, applied after the panel was drawn.
#[derive(Clone)]
enum MetaOp {
    Color(Option<String>),
    Icon(Option<String>),
    ToggleTag(String),
    Dialog(MetaDialog),
}

#[derive(Clone)]
struct Entry {
    rel: String,
    name: String,
    is_dir: bool,
    kind: AssetType,
}

type ThumbJob = (PathBuf, Asset);

impl Default for AssetsUi {
    fn default() -> Self {
        let (tx, jobs) = channel::<ThumbJob>();
        let (done_tx, rx) = channel();
        crate::platform::spawn(move || {
            while let Ok((root, a)) = jobs.recv() {
                let r = nord_core::thumbs::thumb_for(&root, &a).ok().flatten();
                let _ = done_tx.send((a.path.clone(), r));
            }
        });
        Self {
            dir: "assets".into(),
            search: String::new(),
            size: 84.0,
            list: false,
            kind_filter: None,
            only_favorites: false,
            rename: None,
            confirm_delete: None,
            selected: None,
            scroll_to_selected: false,
            listing: vec![],
            listed_at: None,
            listed_dir: String::new(),
            thumbs: HashMap::new(),
            pending: HashSet::new(),
            tx,
            rx,
            model_requests: vec![],
            meta_dialog: None,
            tag_filter: None,
            dominant: HashMap::new(),
        }
    }
}

const SKIP: [&str; 6] = [
    ".nord-cache",
    "dist",
    ".git",
    "node_modules",
    "target",
    ".DS_Store",
];

fn list_dir(root: &Path, rel: &str) -> Vec<Entry> {
    let Ok(rd) = nord_core::vfs::read_dir(root.join(rel)) else {
        return vec![];
    };
    let mut v: Vec<Entry> = rd
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if SKIP.contains(&name.as_str()) || name.ends_with(".meta.json") {
                return None;
            }
            let is_dir = e.path().v_is_dir();
            let rel = if rel.is_empty() {
                name.clone()
            } else {
                format!("{rel}/{name}")
            };
            let kind = if is_dir {
                AssetType::Other
            } else {
                classify(&rel)
            };
            Some(Entry {
                rel,
                name,
                is_dir,
                kind,
            })
        })
        .collect();
    v.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    v
}

impl AssetsUi {
    /// A model thumbnail was written to the cache by the viewport: forget "pending/none" so the grid reloads it.
    pub fn thumbs_done(&mut self, rel: &str) {
        self.pending.remove(rel);
        self.thumbs.remove(rel);
    }
}

pub fn import_files(st: &mut EditorState, files: &[PathBuf]) {
    let Some(root) = st.root.clone() else { return };
    let dest = root.join(&st.assets_ui.dir);
    let _ = nord_core::vfs::create_dir_all(&dest);
    let mut n = 0;
    for f in files {
        if let Some(name) = f.file_name() {
            if nord_core::vfs::copy(f, dest.join(name)).is_ok() {
                n += 1;
            }
        }
    }
    st.log(
        LogLevel::Info,
        format!("Imported {n} file(s) into {}", st.assets_ui.dir),
    );
    st.refresh_assets();
    st.assets_ui.listed_at = None;
}

const BLANK_UI: &str = "{\n  \"version\": 1,\n  \"name\": \"screen\",\n  \"theme\": {},\n  \"root\": { \"type\": \"panel\", \"name\": \"root\", \"anchor\": \"fill\", \"style\": { \"background\": \"none\", \"border\": \"none\", \"boxShadow\": \"none\", \"padding\": 0 }, \"children\": [] }\n}\n";
const BLANK_ANIMATOR: &str = "{\n \"parameters\": [],\n \"states\": [{ \"name\": \"Idle\", \"anim\": \"idle\", \"speed\": 1, \"x\": 320, \"y\": 220 }],\n \"default\": \"Idle\",\n \"transitions\": [],\n \"editor\": { \"any\": { \"x\": 60, \"y\": 60 } }\n}\n";
const BLANK_GRAPH: &str = "{\n \"last_node_id\": 1,\n \"last_link_id\": 0,\n \"nodes\": [{ \"id\": 1, \"type\": \"event/start\", \"pos\": [60, 80], \"size\": [200, 60], \"flags\": {}, \"order\": 0, \"mode\": 0, \"inputs\": [], \"outputs\": [{ \"name\": \"then\", \"type\": \"exec\", \"links\": null, \"shape\": 5 }], \"properties\": {} }],\n \"links\": [],\n \"groups\": [],\n \"config\": {},\n \"extra\": {},\n \"version\": 0.4,\n \"nord\": { \"version\": 1, \"vars\": {} }\n}\n";
pub const NEW_MATERIAL: &str =
    "{\n  \"color\": \"#cccccc\",\n  \"metallic\": 0,\n  \"roughness\": 0.8,\n  \"alpha\": 1\n}\n";
const MONO_SCRIPT: &str = "import { MonoBehaviour, SerializeField, Vector3, Time, UnityInput as Input } from 'nord';\n\n// Unity-style script: Awake/Start/Update/FixedUpdate/LateUpdate/OnEnable/OnDisable/OnDestroy, OnCollisionEnter, OnTriggerEnter.\nexport default class extends MonoBehaviour {\n  static attributes = SerializeField({ speed: 5 });\n\n  Awake() {}\n  Start() {}\n  Update() {\n    const h = Input.GetAxis('Horizontal');\n    this.Translate(h * this.speed * Time.deltaTime);\n  }\n}\n";
const SINGLETON_SCRIPT: &str = "import { Singleton } from 'nord';\n\n// Use anywhere:  MyService.instance.doThing()   (add this script to ONE entity)\nexport default class MyService extends Singleton {\n  static persistent = false; // true = survives scene loads\n\n  Awake() {}\n  doThing() { this.log('hello'); }\n}\n";
const MANAGER_SCRIPT: &str = "import { GameManager } from 'nord';\n\n// Score, lives, state, pause and scene loading, persistent across scenes.\n//   GameManager.instance.AddScore(10);  GameManager.instance.LoseLife();  GameManager.instance.LoadScene('scenes/menu.scene.json')\n// Events on game.events: score, lives, state, gameover.\nexport default class extends GameManager {}\n";
const NEW_SCRIPT: &str = "import { NordScript } from 'nord';\n\nexport default class extends NordScript {\n  start() {}\n  update(dt) {}\n}\n";

/// Context-menu operations shared by the folder tree, the grid/list and the empty background.
const OP_OPEN: u8 = 0;
const OP_DEFAULT: u8 = 1;
const OP_RENAME: u8 = 2;
const OP_DUP: u8 = 3;
const OP_DELETE: u8 = 4;
const OP_REVEAL: u8 = 5;
const OP_COPY_PATH: u8 = 6;
const OP_NEW_FOLDER: u8 = 7;
const OP_NEW_UI: u8 = 8;
const OP_NEW_SCRIPT: u8 = 9;
const OP_IMPORT: u8 = 10;
const OP_REFRESH: u8 = 11;
const OP_NEW_GRAPH: u8 = 12;
const OP_NEW_ANIMATOR: u8 = 40;
const OP_NEW_MATERIAL: u8 = 16;
const OP_FAVORITE: u8 = 17;
const OP_OPEN_PREFAB: u8 = 19;
const OP_VARIANT: u8 = 20;
const OP_FIND_REFS: u8 = 18;
const OP_OPEN_MODELER: u8 = 41;
const OP_NEW_MONO: u8 = 13;
const OP_NEW_SINGLETON: u8 = 14;
const OP_NEW_MANAGER: u8 = 15;

fn reveal_label() -> &'static str {
    if cfg!(target_os = "macos") {
        "Reveal in Finder"
    } else if cfg!(target_os = "windows") {
        "Show in Explorer"
    } else {
        "Show in file manager"
    }
}

/// Right-click menu for one file or folder (Unity/Godot style).
fn entry_menu(ui: &mut Ui, e: &Entry, out: &mut Option<(Entry, u8)>) {
    let mut item = |ui: &mut Ui, label: &str, op: u8| {
        if ui.button(label).clicked() {
            *out = Some((e.clone(), op));
            ui.close_menu();
        }
    };
    item(ui, if e.is_dir { "Open folder" } else { "Open" }, OP_OPEN);
    if !e.is_dir {
        item(ui, "Open with default app", OP_DEFAULT);
    }
    ui.separator();
    if e.is_dir {
        item(ui, "New folder", OP_NEW_FOLDER);
        item(ui, "New UI scene (.ui.json)", OP_NEW_UI);
        item(ui, "New script (.js)", OP_NEW_SCRIPT);
        item(ui, "New material (.mat.json)", OP_NEW_MATERIAL);
        item(ui, "New MonoBehaviour script (Unity-style)", OP_NEW_MONO);
        item(ui, "New Singleton script", OP_NEW_SINGLETON);
        item(ui, "New GameManager script", OP_NEW_MANAGER);
        item(ui, "New graph (.graph.json)", OP_NEW_GRAPH);
        item(
            ui,
            "New animator controller (.animator.json)",
            OP_NEW_ANIMATOR,
        );
        ui.separator();
    }
    if !e.rel.is_empty() {
        item(ui, "Rename   F2", OP_RENAME);
        item(ui, "Duplicate   ⌘/Ctrl+D", OP_DUP);
        item(ui, "Delete   Del", OP_DELETE);
        ui.separator();
    }
    if e.kind == AssetType::Prefab && !e.is_dir {
        item(ui, "Open prefab (Prefab mode)", OP_OPEN_PREFAB);
        item(ui, "Create variant", OP_VARIANT);
    }
    if e.rel.ends_with(".mesh.json") || e.rel.ends_with(".glb") || e.rel.ends_with(".gltf") {
        item(ui, "Open in 3D Modeler", OP_OPEN_MODELER);
    }
    if !e.is_dir {
        item(ui, "★ Favourite on/off", OP_FAVORITE);
        item(ui, "Find references", OP_FIND_REFS);
    }
    item(ui, reveal_label(), OP_REVEAL);
    item(ui, "Copy path", OP_COPY_PATH);
    if !e.rel.is_empty() {
        ui.separator();
        meta_menu(ui, e);
    }
}

/// Colour / icon / tags / description entries of the context menu. The pick is left in egui's temp memory (`meta_op`).
fn meta_menu(ui: &mut Ui, e: &Entry) {
    let meta: crate::assetmeta::AssetMeta = ui
        .ctx()
        .data(|d| d.get_temp(egui::Id::new("asset_meta")))
        .unwrap_or_default();
    let set = |ui: &Ui, op: MetaOp| {
        ui.ctx()
            .data_mut(|d| d.insert_temp(egui::Id::new("meta_op"), Some((e.rel.clone(), op))))
    };
    let cur = meta.item(&e.rel).cloned().unwrap_or_default();
    if e.is_dir {
        ui.menu_button("Folder color", |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.set_max_width(170.0);
                for (name, hex) in COLORS {
                    let (r, resp) = ui.allocate_exact_size(Vec2::splat(20.0), Sense::click());
                    ui.painter().rect_filled(r, 4.0, crate::theme::hex(hex));
                    if cur.color.as_deref() == Some(*hex) {
                        ui.painter().rect_stroke(
                            r,
                            4.0,
                            egui::Stroke::new(2.0, ui.visuals().strong_text_color()),
                            egui::StrokeKind::Outside,
                        );
                    }
                    if resp.on_hover_text(*name).clicked() {
                        set(ui, MetaOp::Color(Some((*hex).into())));
                        ui.close_menu();
                    }
                }
            });
            if ui.button("Default color").clicked() {
                set(ui, MetaOp::Color(None));
                ui.close_menu();
            }
        });
        ui.menu_button("Folder icon", |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.set_max_width(210.0);
                for n in ICON_CHOICES {
                    if icons::button(ui, n, n, cur.icon.as_deref() == Some(*n)).clicked() {
                        set(ui, MetaOp::Icon(Some((*n).into())));
                        ui.close_menu();
                    }
                }
            });
            if ui.button("Your own image…").clicked() {
                set(ui, MetaOp::Dialog(MetaDialog::IconImage(e.rel.clone())));
                ui.close_menu();
            }
            if ui.button("Automatic (by content)").clicked() {
                set(ui, MetaOp::Icon(None));
                ui.close_menu();
            }
        });
    }
    ui.menu_button("Tags", |ui| {
        for t in &meta.tags {
            let on = cur.tags.contains(&t.id);
            let (r, _) = ui.allocate_exact_size(Vec2::ZERO, Sense::hover());
            let _ = r;
            if ui
                .checkbox(
                    &mut on.clone(),
                    egui::RichText::new(format!("● {}", t.name)).color(crate::theme::hex(&t.color)),
                )
                .clicked()
            {
                set(ui, MetaOp::ToggleTag(t.id.clone()));
            }
        }
        if !meta.tags.is_empty() {
            ui.separator();
        }
        if ui.button("New tag…").clicked() {
            set(
                ui,
                MetaOp::Dialog(MetaDialog::NewTag(e.rel.clone(), String::new(), 5)),
            );
            ui.close_menu();
        }
    });
    if ui.button("Description…").clicked() {
        set(
            ui,
            MetaOp::Dialog(MetaDialog::Note(e.rel.clone(), cur.note)),
        );
        ui.close_menu();
    }
}

/// Right-click menu on the empty area of the current folder ("Create" menu).
fn background_menu(ui: &mut Ui, dir: &str, out: &mut Option<(Entry, u8)>) {
    let here = Entry {
        rel: dir.to_string(),
        name: dir.rsplit('/').next().unwrap_or("").to_string(),
        is_dir: true,
        kind: AssetType::Other,
    };
    let mut item = |ui: &mut Ui, label: &str, op: u8| {
        if ui.button(label).clicked() {
            *out = Some((here.clone(), op));
            ui.close_menu();
        }
    };
    item(ui, "New folder", OP_NEW_FOLDER);
    item(ui, "New UI scene (.ui.json)", OP_NEW_UI);
    item(ui, "New script (.js)", OP_NEW_SCRIPT);
    item(ui, "New material (.mat.json)", OP_NEW_MATERIAL);
    item(ui, "New MonoBehaviour script (Unity-style)", OP_NEW_MONO);
    item(ui, "New Singleton script", OP_NEW_SINGLETON);
    item(ui, "New GameManager script", OP_NEW_MANAGER);
    item(ui, "New graph (.graph.json)", OP_NEW_GRAPH);
    item(
        ui,
        "New animator controller (.animator.json)",
        OP_NEW_ANIMATOR,
    );
    ui.separator();
    item(ui, "Import files…", OP_IMPORT);
    item(ui, "Refresh", OP_REFRESH);
    ui.separator();
    item(ui, reveal_label(), OP_REVEAL);
    item(ui, "Copy path", OP_COPY_PATH);
}

/// First free `base`, `base 2`, … (with extension) in `dir`.
fn unique_name(root: &Path, dir: &str, base: &str, ext: &str) -> String {
    let mut n = 1;
    loop {
        let name = match (n, ext.is_empty()) {
            (1, true) => base.to_string(),
            (1, false) => format!("{base}.{ext}"),
            (_, true) => format!("{base} {n}"),
            (_, false) => format!("{base} {n}.{ext}"),
        };
        let rel = if dir.is_empty() {
            name.clone()
        } else {
            format!("{dir}/{name}")
        };
        if !root.join(rel).v_exists() {
            return name;
        }
        n += 1;
    }
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    if from.v_is_dir() {
        nord_core::vfs::create_dir_all(to)?;
        for e in nord_core::vfs::read_dir(from)?.flatten() {
            copy_tree(&e.path(), &to.join(e.file_name()))?;
        }
        Ok(())
    } else {
        nord_core::vfs::copy(from, to).map(|_| ())
    }
}

fn duplicate(st: &mut EditorState, root: &Path, e: &Entry) {
    let dir = e.rel.rsplit_once('/').map_or("", |x| x.0).to_string();
    let (stem, ext) = match e.name.split_once('.') {
        Some((s, x)) if !e.is_dir => (s.to_string(), x.to_string()),
        _ => (e.name.clone(), String::new()),
    };
    let name = unique_name(root, &dir, &format!("{stem} copy"), &ext);
    let to = if dir.is_empty() {
        name.clone()
    } else {
        format!("{dir}/{name}")
    };
    if copy_tree(&root.join(&e.rel), &root.join(&to)).is_ok() {
        let meta = root.join(format!("{}.meta.json", e.rel));
        if meta.v_exists() {
            let _ = nord_core::vfs::copy(meta, root.join(format!("{to}.meta.json")));
        }
        st.assets_ui.selected = Some(to);
        st.refresh_assets();
        st.assets_ui.listed_at = None;
    }
}

/// Assets ▸ Create menu entry: a new folder/script/UI/graph in the folder shown in the Assets panel.
pub fn create_asset(st: &mut EditorState, kind: &str) {
    let Some(root) = st.root.clone() else {
        st.toast("Open a project first");
        return;
    };
    let dir = st.assets_ui.dir.clone();
    match kind {
        "folder" => create_in(st, &root, &dir, "folder", "", None),
        "script" => create_in(st, &root, &dir, "new-script", "js", Some(NEW_SCRIPT)),
        "material" => create_in(
            st,
            &root,
            &dir,
            "new-material",
            "mat.json",
            Some(NEW_MATERIAL),
        ),
        "mono" => create_in(st, &root, &dir, "new-behaviour", "js", Some(MONO_SCRIPT)),
        "singleton" => create_in(
            st,
            &root,
            &dir,
            "new-singleton",
            "js",
            Some(SINGLETON_SCRIPT),
        ),
        "manager" => create_in(st, &root, &dir, "game-manager", "js", Some(MANAGER_SCRIPT)),
        "ui" => create_in(st, &root, &dir, "new-screen", "ui.json", Some(BLANK_UI)),
        _ => create_in(
            st,
            &root,
            &dir,
            "new-graph",
            "graph.json",
            Some(BLANK_GRAPH),
        ),
    }
}

/// Create a file/folder inside `dir` and start renaming it.
fn create_in(
    st: &mut EditorState,
    root: &Path,
    dir: &str,
    base: &str,
    ext: &str,
    body: Option<&str>,
) {
    let name = unique_name(root, dir, base, ext);
    let rel = if dir.is_empty() {
        name.clone()
    } else {
        format!("{dir}/{name}")
    };
    let ok = match body {
        Some(b) => nord_core::vfs::write(root.join(&rel), b).is_ok(),
        None => nord_core::vfs::create_dir_all(root.join(&rel)).is_ok(),
    };
    if ok {
        st.assets_ui.dir = dir.to_string();
        st.assets_ui.selected = Some(rel.clone());
        st.assets_ui.rename = Some((rel, name));
        st.refresh_assets();
        st.assets_ui.listed_at = None;
    }
}

fn handle_op(st: &mut EditorState, ui: &Ui, root: &Path, e: Entry, op: u8) {
    match op {
        OP_OPEN => open_entry(st, &e),
        OP_DEFAULT => open_default(&root.join(&e.rel)),
        OP_RENAME => st.assets_ui.rename = Some((e.rel.clone(), e.name.clone())),
        OP_DUP => duplicate(st, root, &e),
        OP_DELETE => st.assets_ui.confirm_delete = Some(e.rel.clone()),
        OP_REVEAL => reveal(&root.join(&e.rel)),
        OP_COPY_PATH => ui.ctx().copy_text(e.rel.clone()),
        OP_NEW_FOLDER => create_in(st, root, &e.rel, "folder", "", None),
        OP_NEW_UI => create_in(st, root, &e.rel, "new-screen", "ui.json", Some(BLANK_UI)),
        OP_NEW_SCRIPT => create_in(st, root, &e.rel, "new-script", "js", Some(NEW_SCRIPT)),
        OP_OPEN_MODELER => st.open_in_modeler("", &e.rel),
        OP_OPEN_PREFAB => st.push(Action::OpenPrefab(e.rel.clone())),
        OP_VARIANT => st.push(Action::PrefabVariant(e.rel.clone())),
        OP_FAVORITE => {
            let f = &mut st.settings.asset_favorites;
            if let Some(i) = f.iter().position(|p| *p == e.rel) {
                f.remove(i);
            } else {
                f.push(e.rel.clone());
            }
            st.settings.save();
        }
        OP_FIND_REFS => {
            st.project_ui.find = e.rel.clone();
            st.push(Action::ShowTab(crate::app::Tab::Project));
        }
        OP_NEW_MATERIAL => create_in(
            st,
            root,
            &e.rel,
            "new-material",
            "mat.json",
            Some(NEW_MATERIAL),
        ),
        OP_NEW_MONO => create_in(st, root, &e.rel, "new-behaviour", "js", Some(MONO_SCRIPT)),
        OP_NEW_SINGLETON => create_in(
            st,
            root,
            &e.rel,
            "new-singleton",
            "js",
            Some(SINGLETON_SCRIPT),
        ),
        OP_NEW_MANAGER => create_in(st, root, &e.rel, "game-manager", "js", Some(MANAGER_SCRIPT)),
        OP_NEW_GRAPH => create_in(
            st,
            root,
            &e.rel,
            "new-graph",
            "graph.json",
            Some(BLANK_GRAPH),
        ),
        OP_NEW_ANIMATOR => {
            // controllers live in anim/ (the only folder the Animator page may write)
            let _ = nord_core::vfs::create_dir_all(root.join("anim"));
            create_in(
                st,
                root,
                "anim",
                "new-controller",
                "animator.json",
                Some(BLANK_ANIMATOR),
            );
        }
        OP_IMPORT => {
            if let Some(files) = crate::platform::pick_files() {
                import_files(st, &files);
            }
        }
        OP_REFRESH => {
            st.refresh_assets();
            st.assets_ui.listed_at = None;
            st.assets_ui.thumbs.clear();
        }
        _ => {}
    }
}

fn tree(st: &mut EditorState, ui: &mut Ui, rel: &str, depth: usize, ctx: &mut Option<(Entry, u8)>) {
    let Some(root) = st.root.clone() else { return };
    let dirs: Vec<Entry> = list_dir(&root, rel)
        .into_iter()
        .filter(|e| e.is_dir)
        .collect();
    for d in dirs {
        let sel = st.assets_ui.dir == d.rel;
        let has_sub = list_dir(&root, &d.rel).iter().any(|e| e.is_dir);
        let open =
            st.assets_ui.dir == d.rel || st.assets_ui.dir.starts_with(&format!("{}/", d.rel));
        // zebra stripe + indent guide lines are painted first, the row content goes on top
        let row = ui.ctx().data_mut(|m| {
            let n: &mut usize = m.get_temp_mut_or_default(egui::Id::new("tree_row"));
            *n += 1;
            *n
        });
        let h = ui.spacing().interact_size.y;
        let strip = egui::Rect::from_min_size(ui.cursor().min, Vec2::new(ui.available_width(), h));
        if st.asset_meta.zebra && row.is_multiple_of(2) {
            ui.painter()
                .rect_filled(strip, 0.0, ui.visuals().faint_bg_color.gamma_multiply(0.6));
        }
        if st.asset_meta.guides {
            for g in 0..depth {
                let x = strip.left() + g as f32 * 12.0 + 7.0;
                ui.painter().line_segment(
                    [
                        egui::pos2(x, strip.top()),
                        egui::pos2(x, strip.bottom() + 4.0),
                    ],
                    egui::Stroke::new(1.0, ui.visuals().widgets.noninteractive.bg_stroke.color),
                );
            }
        }
        let resp = ui
            .horizontal(|ui| {
                ui.add_space(depth as f32 * 12.0);
                let (ir, _) = ui.allocate_exact_size(Vec2::splat(16.0), Sense::hover());
                paint_folder(st, ui, &root, &d.rel, ir, open);
                let r = ui.selectable_label(sel, &d.name);
                if r.clicked() {
                    st.assets_ui.dir = d.rel.clone();
                    st.assets_ui.selected = Some(d.rel.clone());
                }
                let tip = st.asset_meta.tooltip(&d.rel);
                paint_tag_dots(st, ui, &d.rel, r.rect.right_center() + Vec2::new(6.0, 0.0));
                let r = if tip.is_empty() {
                    r
                } else {
                    r.on_hover_text(tip)
                };
                r.context_menu(|ui| entry_menu(ui, &d, ctx));
                // drop an asset on a folder = move
                if let Some(p) = r.dnd_release_payload::<AssetDrag>() {
                    move_asset(st, &p.0, &d.rel);
                }
            })
            .response;
        let _ = resp;
        if has_sub && open {
            tree(st, ui, &d.rel, depth + 1, ctx);
        }
    }
}

fn move_asset(st: &mut EditorState, from: &str, to_dir: &str) {
    let Some(root) = st.root.clone() else { return };
    let name = from.rsplit('/').next().unwrap_or(from);
    let dest = if to_dir.is_empty() {
        name.to_string()
    } else {
        format!("{to_dir}/{name}")
    };
    if dest == from || root.join(&dest).v_exists() {
        return;
    }
    if nord_core::vfs::rename(root.join(from), root.join(&dest)).is_ok() {
        let _ = nord_core::vfs::rename(
            root.join(format!("{from}.meta.json")),
            root.join(format!("{dest}.meta.json")),
        );
        st.asset_meta.rekey(from, &dest);
        st.asset_meta.save(&root);
        st.log(LogLevel::Info, format!("Moved {from} -> {dest}"));
        st.refresh_assets();
        st.assets_ui.listed_at = None;
    }
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    ui_inner(st, ui);
    // Hierarchy → Assets: dropping an entity here turns it into a prefab in the folder being shown
    let zone = ui.interact(
        ui.min_rect(),
        ui.id().with("prefab_drop"),
        egui::Sense::hover(),
    );
    if let Some(id) = zone.dnd_release_payload::<String>() {
        let dir = st.assets_ui.dir.clone();
        st.make_prefab(&id, &dir);
    }
}

fn ui_inner(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
    st.asset_meta.ensure(&root);
    let meta_copy = st.asset_meta.clone();
    ui.ctx().data_mut(|d| {
        d.insert_temp(egui::Id::new("asset_meta"), meta_copy);
        d.insert_temp(egui::Id::new("tree_row"), 0usize);
    });
    // OS drag&drop import
    let dropped: Vec<PathBuf> = ui.ctx().input(|i| {
        i.raw
            .dropped_files
            .iter()
            .filter_map(|f| f.path.clone())
            .collect()
    });
    if !dropped.is_empty() && ui.rect_contains_pointer(ui.max_rect()) {
        import_files(st, &dropped);
    }
    // collect finished thumbnails
    while let Ok((p, t)) = st.assets_ui.rx.try_recv() {
        st.assets_ui.pending.remove(&p);
        st.assets_ui.thumbs.insert(p, t);
    }
    // refresh listing
    let a = &mut st.assets_ui;
    if a.listed_at
        .is_none_or(|t| t.elapsed() > Duration::from_secs(2))
        || a.listed_dir != a.dir
    {
        a.listing = list_dir(&root, &a.dir);
        a.listed_at = Some(Instant::now());
        a.listed_dir = a.dir.clone();
    }

    ui.horizontal_wrapped(|ui| {
        if icons::button(ui, "upload", "Import files…", false).clicked() {
            if let Some(files) = crate::platform::pick_files() {
                import_files(st, &files);
            }
        }
        if icons::button(ui, "refresh-cw", "Refresh", false).clicked() {
            st.refresh_assets();
            st.assets_ui.listed_at = None;
            st.assets_ui.thumbs.clear();
        }
        if icons::button(ui, "plus", "New folder", false).clicked() {
            let dir = st.assets_ui.dir.clone();
            create_in(st, &root, &dir, "folder", "", None);
        }
        if icons::button(
            ui,
            "library",
            "Library (ready-made assets and scripts)",
            false,
        )
        .clicked()
        {
            st.push(crate::state::Action::ShowTab(crate::app::Tab::Library));
        }
        ui.add(
            egui::TextEdit::singleline(&mut st.assets_ui.search)
                .hint_text("Search…")
                .desired_width(160.0),
        );
        egui::ComboBox::from_id_salt("kindf")
            .selected_text(
                st.assets_ui
                    .kind_filter
                    .map_or("All".to_string(), |k| format!("{k:?}")),
            )
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut st.assets_ui.kind_filter, None, "All");
                for k in [
                    AssetType::Image,
                    AssetType::Audio,
                    AssetType::Model,
                    AssetType::Prefab,
                    AssetType::Material,
                    AssetType::Scene,
                    AssetType::Json,
                    AssetType::Font,
                ] {
                    ui.selectable_value(&mut st.assets_ui.kind_filter, Some(k), format!("{k:?}"));
                }
            });
        let tag_name = st
            .assets_ui
            .tag_filter
            .as_deref()
            .and_then(|t| st.asset_meta.tag(t))
            .map_or("Tags".to_string(), |t| t.name.clone());
        egui::ComboBox::from_id_salt("tagf")
            .selected_text(tag_name)
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut st.assets_ui.tag_filter, None, "All");
                for t in st.asset_meta.tags.clone() {
                    ui.selectable_value(
                        &mut st.assets_ui.tag_filter,
                        Some(t.id.clone()),
                        egui::RichText::new(format!("● {}", t.name))
                            .color(crate::theme::hex(&t.color)),
                    );
                }
            });
        ui.menu_button("View", |ui| {
            let mut ch = false;
            ch |= ui
                .checkbox(&mut st.asset_meta.zebra, "Zebra striping (tree)")
                .changed();
            ch |= ui
                .checkbox(&mut st.asset_meta.guides, "Indent guide lines (tree)")
                .changed();
            ch |= ui
                .checkbox(
                    &mut st.asset_meta.auto_icons,
                    "Automatic folder icons (by content)",
                )
                .changed();
            if ch {
                st.asset_meta.save(&root);
            }
        });
        let fav = st.assets_ui.only_favorites;
        if icons::mini_toggle(
            ui,
            "star",
            "Show only favourites (right-click an asset ▸ Favourite)",
            fav,
        )
        .clicked()
        {
            st.assets_ui.only_favorites = !fav;
        }
        let list = st.assets_ui.list;
        if icons::button(ui, "layout-grid", "Grid view", !list).clicked() {
            st.assets_ui.list = false;
        }
        if icons::button(ui, "list", "List view", list).clicked() {
            st.assets_ui.list = true;
        }
        if !list {
            ui.add(egui::Slider::new(&mut st.assets_ui.size, 48.0..=160.0).show_value(false));
        }
        ui.weak(&st.assets_ui.dir);
    });
    ui.separator();

    let mut ctx_op: Option<(Entry, u8)> = None;
    egui::SidePanel::left("asset-tree")
        .resizable(true)
        .default_width(140.0)
        .show_inside(ui, |ui| {
            egui::ScrollArea::both()
                .auto_shrink([false; 2])
                .show(ui, |ui| {
                    let sel = st.assets_ui.dir.is_empty();
                    let proj = Entry {
                        rel: String::new(),
                        name: "(project)".into(),
                        is_dir: true,
                        kind: AssetType::Other,
                    };
                    let r = ui.selectable_label(sel, "(project)");
                    if r.clicked() {
                        st.assets_ui.dir.clear();
                    }
                    r.context_menu(|ui| entry_menu(ui, &proj, &mut ctx_op));
                    tree(st, ui, "", 0, &mut ctx_op);
                });
        });

    let search = st.assets_ui.search.to_lowercase();
    let filter = st.assets_ui.kind_filter;
    let mut entries: Vec<Entry> = st.assets_ui.listing.clone();
    if !search.is_empty() {
        // search spans the whole asset index, not just the folder
        entries = st
            .assets
            .iter()
            .filter(|a| a.path.to_lowercase().contains(&search))
            .map(|a| Entry {
                rel: a.path.clone(),
                name: a.path.clone(),
                is_dir: false,
                kind: a.kind,
            })
            .collect();
    }
    let tag_f = st.assets_ui.tag_filter.clone();
    let only_fav = st.assets_ui.only_favorites;
    let favs = st.settings.asset_favorites.clone();
    let entries: Vec<Entry> = entries
        .into_iter()
        .filter(|e| filter.is_none_or(|k| e.is_dir || e.kind == k))
        .filter(|e| !only_fav || e.is_dir || favs.contains(&e.rel))
        .filter(|e| {
            tag_f.as_ref().is_none_or(|t| {
                e.is_dir
                    || st
                        .asset_meta
                        .item(&e.rel)
                        .is_some_and(|i| i.tags.contains(t))
            })
        })
        .collect();
    let cell = st.assets_ui.size;
    let as_list = st.assets_ui.list;
    let mut open: Option<Entry> = None;
    // empty-area right-click = Create menu; registered before the cells so cells stay on top
    let area = ui.available_rect_before_wrap();
    let bg = ui.interact(area, ui.id().with("asset-bg"), Sense::click());
    let cur = st.assets_ui.dir.clone();
    bg.context_menu(|ui| background_menu(ui, &cur, &mut ctx_op));
    egui::ScrollArea::vertical()
        .auto_shrink([false; 2])
        .show(ui, |ui| {
            let layout = if as_list {
                egui::Layout::top_down(egui::Align::Min)
            } else {
                egui::Layout::left_to_right(egui::Align::Min).with_main_wrap(true)
            };
            ui.with_layout(layout, |ui| {
                ui.spacing_mut().item_spacing = Vec2::splat(if as_list { 1.0 } else { 6.0 });
                for e in &entries {
                    if st
                        .assets_ui
                        .rename
                        .as_ref()
                        .is_some_and(|(r, _)| *r == e.rel)
                    {
                        let mut commit = false;
                        let buf = &mut st.assets_ui.rename.as_mut().unwrap().1;
                        match super::inline_rename(
                            ui,
                            buf,
                            egui::Id::new(("asset-rename", &e.rel)),
                            cell,
                        ) {
                            super::RenameOutcome::Commit => commit = true,
                            super::RenameOutcome::Cancel => st.assets_ui.rename = None,
                            super::RenameOutcome::Editing => {}
                        }
                        if commit {
                            let (from, new) = st.assets_ui.rename.take().unwrap();
                            let mut new = new.trim().to_string();
                            // typing just `player` for `new-script.js` keeps the extension
                            if let Some((_, ext)) =
                                from.rsplit('/').next().and_then(|n| n.rsplit_once('.'))
                            {
                                if !new.contains('.')
                                    && !new.is_empty()
                                    && !root.join(&from).is_dir()
                                {
                                    new = format!("{new}.{ext}");
                                }
                            }
                            if new.is_empty()
                                || new.contains('/')
                                || new == from.rsplit('/').next().unwrap_or("")
                            {
                                continue;
                            }
                            let dir = from.rsplit_once('/').map_or("", |x| x.0).to_string();
                            let to = if dir.is_empty() {
                                new
                            } else {
                                format!("{dir}/{new}")
                            };
                            if !root.join(&to).v_exists()
                                && nord_core::vfs::rename(root.join(&from), root.join(&to)).is_ok()
                            {
                                let _ = nord_core::vfs::rename(
                                    root.join(format!("{from}.meta.json")),
                                    root.join(format!("{to}.meta.json")),
                                );
                                st.asset_meta.rekey(&from, &to);
                                st.asset_meta.save(&root);
                                st.refresh_assets();
                                st.assets_ui.listed_at = None;
                            }
                        }
                        continue;
                    }
                    let size = if as_list {
                        Vec2::new(ui.available_width().max(200.0), 24.0)
                    } else {
                        Vec2::new(cell, cell + 18.0)
                    };
                    let (rect, resp) = ui.allocate_exact_size(size, Sense::click_and_drag());
                    if st.assets_ui.selected.as_deref() == Some(e.rel.as_str())
                        && std::mem::take(&mut st.assets_ui.scroll_to_selected)
                    {
                        ui.scroll_to_rect(rect, Some(egui::Align::Center));
                    }
                    if !ui.is_rect_visible(rect) {
                        continue; // lazy: no thumbnail work for off-screen cells
                    }
                    let p = ui.painter_at(rect);
                    if st.assets_ui.selected.as_deref() == Some(e.rel.as_str()) {
                        p.rect_filled(rect, 4.0, ui.visuals().selection.bg_fill);
                    } else if resp.hovered() {
                        p.rect_filled(rect, 4.0, ui.visuals().widgets.hovered.bg_fill);
                    }
                    if as_list {
                        let img_rect = egui::Rect::from_min_size(
                            rect.min + Vec2::new(4.0, 2.0),
                            Vec2::splat(20.0),
                        );
                        draw_thumb(st, ui, &root, e, img_rect);
                        let small = egui::TextStyle::Body.resolve(ui.style());
                        p.text(
                            egui::pos2(rect.left() + 32.0, rect.center().y),
                            egui::Align2::LEFT_CENTER,
                            &e.name,
                            small.clone(),
                            ui.visuals().text_color(),
                        );
                        let info = if e.is_dir {
                            "folder".to_string()
                        } else {
                            let sz =
                                nord_core::vfs::metadata(root.join(&e.rel)).map_or(0, |m| m.len());
                            format!("{:?} · {:.1} KB", e.kind, sz as f64 / 1024.0)
                        };
                        p.text(
                            egui::pos2(rect.right() - 8.0, rect.center().y),
                            egui::Align2::RIGHT_CENTER,
                            info,
                            small,
                            ui.visuals().weak_text_color(),
                        );
                    } else {
                        let img_rect = egui::Rect::from_min_size(
                            rect.min + Vec2::splat(4.0),
                            Vec2::splat(cell - 8.0),
                        );
                        draw_thumb(st, ui, &root, e, img_rect);
                        p.text(
                            egui::pos2(rect.center().x, rect.bottom() - 9.0),
                            egui::Align2::CENTER_CENTER,
                            truncate(&e.name, (cell / 6.5) as usize),
                            egui::TextStyle::Small.resolve(ui.style()),
                            ui.visuals().text_color(),
                        );
                    }
                    let tip = st.asset_meta.tooltip(&e.rel);
                    let resp = resp.on_hover_text(if tip.is_empty() {
                        e.rel.clone()
                    } else {
                        format!("{}\n{tip}", e.rel)
                    });
                    if resp.clicked() || resp.secondary_clicked() {
                        st.assets_ui.selected = Some(e.rel.clone());
                        if e.rel.ends_with(".mat.json")
                            || matches!(
                                e.kind,
                                AssetType::Image | AssetType::Spritesheet | AssetType::Model
                            )
                        {
                            st.selection.clear(); // the Inspector now shows the material asset
                        }
                    }
                    if resp.double_clicked() {
                        open = Some(e.clone());
                    } else if resp.clicked() && e.is_dir {
                        st.assets_ui.dir = e.rel.clone();
                    }
                    if !e.is_dir {
                        resp.dnd_set_drag_payload(AssetDrag(e.rel.clone()));
                    }
                    resp.context_menu(|ui| entry_menu(ui, e, &mut ctx_op));
                }
            });
        });
    if let Some(e) = open {
        open_entry(st, &e);
    }
    let pending: Option<(String, MetaOp)> = ui
        .ctx()
        .data_mut(|d| d.remove_temp::<Option<(String, MetaOp)>>(egui::Id::new("meta_op")))
        .flatten();
    if let Some((rel, op)) = pending {
        apply_meta_op(st, &root, rel, op);
    }
    meta_dialogs(st, ui, &root);
    // keyboard shortcuts on the selected entry (only when no text field has focus)
    if !ui.ctx().wants_keyboard_input() && ui.rect_contains_pointer(ui.max_rect()) {
        let sel = st.assets_ui.selected.clone();
        if let Some(e) = sel.and_then(|r| entries.iter().find(|e| e.rel == r).cloned()) {
            let (f2, del, dup) = ui.input(|i| {
                (
                    i.key_pressed(egui::Key::F2),
                    i.key_pressed(egui::Key::Delete) || i.key_pressed(egui::Key::Backspace),
                    i.modifiers.command && i.key_pressed(egui::Key::D),
                )
            });
            if f2 {
                ctx_op = Some((e.clone(), OP_RENAME));
            } else if del {
                ctx_op = Some((e.clone(), OP_DELETE));
            } else if dup {
                ctx_op = Some((e, OP_DUP));
            }
        }
    }
    if let Some((e, op)) = ctx_op {
        handle_op(st, ui, &root, e, op);
    }
    if let Some(p) = st.assets_ui.confirm_delete.clone() {
        egui::Window::new("Delete asset?")
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .show(ui.ctx(), |ui| {
                ui.label(format!("Delete {p}? This cannot be undone."));
                ui.horizontal(|ui| {
                    if ui.button("Delete").clicked() {
                        let f = root.join(&p);
                        let _ = if f.v_is_dir() {
                            nord_core::vfs::remove_dir_all(&f)
                        } else {
                            nord_core::vfs::remove_file(&f)
                        };
                        let _ = nord_core::vfs::remove_file(root.join(format!("{p}.meta.json")));
                        st.asset_meta.remove(&p);
                        st.asset_meta.save(&root);
                        st.refresh_assets();
                        st.assets_ui.listed_at = None;
                        st.assets_ui.confirm_delete = None;
                    }
                    if ui.button("Cancel").clicked() {
                        st.assets_ui.confirm_delete = None;
                    }
                });
            });
    }
}

fn truncate(s: &str, n: usize) -> String {
    let n = n.max(6);
    if s.chars().count() <= n {
        s.to_string()
    } else {
        let head: String = s.chars().take(n - 1).collect();
        format!("{head}…")
    }
}

fn reveal(p: &Path) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg("-R").arg(p).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("explorer")
        .arg(format!("/select,{}", p.display()))
        .spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let _ = std::process::Command::new("xdg-open")
        .arg(if p.is_dir() {
            p
        } else {
            p.parent().unwrap_or(p)
        })
        .spawn();
}

fn open_default(p: &Path) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(p).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", ""])
        .arg(p)
        .spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let _ = std::process::Command::new("xdg-open").arg(p).spawn();
}

fn open_entry(st: &mut EditorState, e: &Entry) {
    let Some(root) = st.root.clone() else { return };
    if e.is_dir {
        st.assets_ui.dir = e.rel.clone();
        return;
    }
    // UI scenes and graphs open in their visual editors
    if e.rel.ends_with(".ui.json") {
        st.designer_file = Some(e.rel.clone());
        st.push(Action::ShowTab(crate::app::Tab::UiDesigner));
        return;
    }
    if e.rel.ends_with(".graph.json") {
        st.graph_file = Some(e.rel.clone());
        st.push(Action::ShowTab(crate::app::Tab::Graph));
        return;
    }
    if e.rel.ends_with(".mesh.json") {
        st.open_in_modeler("", &e.rel); // the editable 3D model
        return;
    }
    if e.rel.ends_with(".animator.json") {
        st.animator_file = Some(e.rel.clone());
        st.push(Action::ShowTab(crate::app::Tab::Animator));
        return;
    }
    match e.kind {
        AssetType::Scene => {
            if let Err(m) = st.open_scene(&e.rel) {
                st.log(LogLevel::Error, m);
            }
        }
        AssetType::Image | AssetType::Spritesheet
            if e.rel.to_ascii_lowercase().ends_with(".png") =>
        {
            st.open_in_sprite_editor(None, &e.rel)
        }
        AssetType::Image
        | AssetType::Audio
        | AssetType::Model
        | AssetType::Video
        | AssetType::Font => reveal(&root.join(&e.rel)),
        _ => {
            st.push(Action::OpenFile(root.join(&e.rel), None));
        }
    }
}

/// Icon of what a folder mostly contains (recursive, cached for a few seconds).
fn dominant_icon(st: &mut EditorState, rel: &str) -> &'static str {
    if let Some((t, i)) = st.assets_ui.dominant.get(rel) {
        if t.elapsed() < Duration::from_secs(4) {
            return i;
        }
    }
    let prefix = format!("{rel}/");
    let mut counts: HashMap<&'static str, usize> = HashMap::new();
    for a in st.assets.iter().filter(|a| a.path.starts_with(&prefix)) {
        let n = if a.path.ends_with(".js") || a.path.ends_with(".ts") {
            "file-code"
        } else {
            match a.kind {
                AssetType::Other | AssetType::Json => continue,
                k => kind_icon(k, false),
            }
        };
        *counts.entry(n).or_default() += 1;
    }
    let best = counts
        .into_iter()
        .max_by_key(|(n, c)| (*c, *n))
        .map_or("folder", |(n, _)| n);
    st.assets_ui
        .dominant
        .insert(rel.to_string(), (Instant::now(), best));
    best
}

/// The filled folder drawn with the painter (anti-aliased vector shapes, no texture): perfectly sharp at every size and display scale.
fn draw_folder_shape(p: &egui::Painter, r: egui::Rect, c: egui::Color32, open: bool) {
    let at = |x: f32, y: f32| egui::pos2(r.left() + r.width() * x, r.top() + r.height() * y);
    let rr = |x0: f32, y0: f32, x1: f32, y1: f32| egui::Rect::from_min_max(at(x0, y0), at(x1, y1));
    let k = r.width();
    let dark = c.gamma_multiply(0.78);
    // back of the folder: tab + body
    p.rect_filled(
        rr(0.08, 0.17, 0.46, 0.40),
        egui::CornerRadius::same((k * 0.07) as u8 + 1),
        if open { dark } else { c },
    );
    p.rect_filled(
        rr(0.08, 0.27, 0.92, 0.82),
        egui::CornerRadius::same((k * 0.09) as u8 + 1),
        if open { dark } else { c },
    );
    if open {
        // front flap, slanted
        let pts = vec![
            at(0.20, 0.45),
            at(0.98, 0.45),
            at(0.86, 0.84),
            at(0.08, 0.84),
        ];
        p.add(egui::Shape::convex_polygon(
            pts,
            c,
            egui::Stroke::new(0.5, c),
        ));
    } else {
        // subtle light edge along the top of the body
        p.rect_filled(
            rr(0.08, 0.27, 0.92, 0.33),
            egui::CornerRadius {
                nw: (k * 0.09) as u8 + 1,
                ne: (k * 0.09) as u8 + 1,
                sw: 0,
                se: 0,
            },
            c.gamma_multiply(1.12),
        );
    }
}

/// Folder: the filled folder shape in the theme's accent colour; the user can colour it, put an icon badge on it, or replace it
/// with one of the project's images. Optional automatic badge by dominant content (View menu).
fn paint_folder(
    st: &mut EditorState,
    ui: &mut Ui,
    root: &Path,
    rel: &str,
    rect: egui::Rect,
    open: bool,
) {
    let it = st.asset_meta.item(rel).cloned().unwrap_or_default();
    let color = it
        .color
        .as_deref()
        .map_or(ui.visuals().hyperlink_color, crate::theme::hex);
    if let Some(img) = it.icon.as_deref().and_then(|i| i.strip_prefix("img:")) {
        egui::Image::new(format!("file://{}/{img}", root.display()))
            .fit_to_exact_size(rect.size())
            .paint_at(ui, rect);
        return;
    }
    let rect = icons::snap(ui.ctx(), rect);
    draw_folder_shape(ui.painter(), rect, color, open);
    let badge: Option<&'static str> = match it
        .icon
        .as_deref()
        .and_then(|n| ICON_CHOICES.iter().find(|c| **c == n))
    {
        Some(n) if *n != "folder" => Some(n),
        Some(_) => None,
        None if st.asset_meta.auto_icons && !rel.is_empty() => {
            Some(dominant_icon(st, rel)).filter(|n| *n != "folder")
        }
        None => None,
    };
    if let Some(n) = badge {
        // glyph centred on the folder body, dark or light so it reads on any folder colour
        let lum = 0.299 * color.r() as f32 + 0.587 * color.g() as f32 + 0.114 * color.b() as f32;
        let ink = if lum > 140.0 {
            egui::Color32::from_black_alpha(190)
        } else {
            egui::Color32::from_white_alpha(230)
        };
        let g = egui::Rect::from_center_size(
            rect.center() + Vec2::new(0.0, rect.height() * 0.06),
            Vec2::splat(rect.width() * 0.46),
        );
        icons::icon(n, g.width(), ink).paint_at(ui, icons::snap(ui.ctx(), g));
    }
}

/// Small coloured dots for the entry's tags.
fn paint_tag_dots(st: &EditorState, ui: &Ui, rel: &str, at: egui::Pos2) {
    let Some(it) = st.asset_meta.item(rel) else {
        return;
    };
    for (i, t) in it
        .tags
        .iter()
        .filter_map(|t| st.asset_meta.tag(t))
        .take(5)
        .enumerate()
    {
        ui.painter().circle_filled(
            at + Vec2::new(i as f32 * 8.0, 0.0),
            3.0,
            crate::theme::hex(&t.color),
        );
    }
}

fn apply_meta_op(st: &mut EditorState, root: &Path, rel: String, op: MetaOp) {
    match op {
        MetaOp::Color(c) => st.asset_meta.item_mut(&rel).color = c,
        MetaOp::Icon(i) => st.asset_meta.item_mut(&rel).icon = i,
        MetaOp::ToggleTag(t) => st.asset_meta.toggle_tag(&rel, &t),
        MetaOp::Dialog(d) => {
            st.assets_ui.meta_dialog = Some(d);
            return;
        }
    }
    st.asset_meta.save(root);
    st.assets_ui.dominant.clear();
}

/// Description / new tag / folder-image dialogs.
fn meta_dialogs(st: &mut EditorState, ui: &Ui, root: &Path) {
    let Some(mut d) = st.assets_ui.meta_dialog.clone() else {
        return;
    };
    let mut close = false;
    let mut save = false;
    egui::Window::new(match &d {
        MetaDialog::Note(..) => "Description",
        MetaDialog::NewTag(..) => "New tag",
        MetaDialog::IconImage(_) => "Folder icon image",
    })
    .collapsible(false)
    .resizable(false)
    .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
    .show(ui.ctx(), |ui| {
        match &mut d {
            MetaDialog::Note(rel, text) => {
                ui.label(format!("Shown as the tooltip of {rel}"));
                ui.add(
                    egui::TextEdit::multiline(text)
                        .desired_rows(4)
                        .desired_width(300.0),
                );
            }
            MetaDialog::NewTag(_, name, color) => {
                ui.add(
                    egui::TextEdit::singleline(name)
                        .hint_text("Tag name (e.g. Needs art, Final, WIP)"),
                );
                ui.horizontal(|ui| {
                    for (i, (n, hex)) in COLORS.iter().enumerate() {
                        let (r, resp) = ui.allocate_exact_size(Vec2::splat(18.0), Sense::click());
                        ui.painter().rect_filled(r, 4.0, crate::theme::hex(hex));
                        if *color == i {
                            ui.painter().rect_stroke(
                                r,
                                4.0,
                                egui::Stroke::new(2.0, ui.visuals().strong_text_color()),
                                egui::StrokeKind::Outside,
                            );
                        }
                        if resp.on_hover_text(*n).clicked() {
                            *color = i;
                        }
                    }
                });
            }
            MetaDialog::IconImage(rel) => {
                ui.label("Pick one of the project's images:");
                let imgs: Vec<String> = st
                    .assets
                    .iter()
                    .filter(|a| {
                        matches!(a.kind, AssetType::Image | AssetType::Spritesheet)
                            && !a.path.ends_with(".svg")
                    })
                    .map(|a| a.path.clone())
                    .collect();
                egui::ScrollArea::vertical()
                    .max_height(220.0)
                    .show(ui, |ui| {
                        for p in imgs {
                            if ui.selectable_label(false, &p).clicked() {
                                st.asset_meta.item_mut(rel).icon = Some(format!("img:{p}"));
                                st.asset_meta.save(root);
                                close = true;
                            }
                        }
                    });
            }
        }
        ui.horizontal(|ui| {
            if !matches!(d, MetaDialog::IconImage(_)) && ui.button("Save").clicked() {
                save = true;
            }
            if ui.button("Cancel").clicked() {
                close = true;
            }
        });
    });
    if save {
        match &d {
            MetaDialog::Note(rel, text) => {
                st.asset_meta.item_mut(rel).note = text.trim().to_string()
            }
            MetaDialog::NewTag(rel, name, color) if !name.trim().is_empty() => {
                let id = st.asset_meta.add_tag(name.trim(), COLORS[*color].1);
                st.asset_meta.toggle_tag(rel, &id);
            }
            _ => {}
        }
        st.asset_meta.save(root);
        close = true;
    }
    st.assets_ui.meta_dialog = if close { None } else { Some(d) };
}

fn kind_icon(k: AssetType, dir: bool) -> &'static str {
    if dir {
        return "folder-fill";
    }
    match k {
        AssetType::Image | AssetType::Spritesheet => "image",
        AssetType::Audio => "music",
        AssetType::Model => "box",
        AssetType::Scene => "map",
        AssetType::Material => "circle",
        AssetType::Prefab => "package",
        AssetType::Video => "film",
        AssetType::Font => "type",
        AssetType::Json => "file-code",
        AssetType::Other => "file-text",
    }
}

fn draw_thumb(st: &mut EditorState, ui: &mut Ui, root: &Path, e: &Entry, rect: egui::Rect) {
    if e.is_dir {
        let r = egui::Rect::from_center_size(rect.center(), Vec2::splat(rect.width() * 0.7));
        paint_folder(st, ui, root, &e.rel, r, false);
        paint_tag_dots(st, ui, &e.rel, rect.left_bottom() + Vec2::new(4.0, -3.0));
        return;
    }
    paint_tag_dots(st, ui, &e.rel, rect.left_bottom() + Vec2::new(4.0, -3.0));
    let rect = icons::snap(ui.ctx(), rect); // whole physical pixels: thumbnails and icons are not resampled between pixels
    let wants_thumb = matches!(
        e.kind,
        AssetType::Image
            | AssetType::Spritesheet
            | AssetType::Audio
            | AssetType::Model
            | AssetType::Material
    ) && !e.is_dir;
    if wants_thumb {
        match st.assets_ui.thumbs.get(&e.rel) {
            Some(Some(p)) => {
                let uri = format!("file://{}", p.display());
                egui::Image::new(uri)
                    .fit_to_exact_size(rect.size())
                    .paint_at(ui, rect);
                if e.kind == AssetType::Spritesheet {
                    ui.painter().text(
                        rect.right_top(),
                        egui::Align2::RIGHT_TOP,
                        "▦",
                        egui::FontId::proportional(12.0),
                        ui.visuals().text_color(),
                    );
                }
                return;
            }
            Some(None) => {
                // no thumbnail available (e.g. svg, model without viewport): fall through to the icon
            }
            None => {
                if let Some(a) = st.assets.iter().find(|a| a.path == e.rel).cloned() {
                    if e.kind == AssetType::Model {
                        // models are rendered by the edit viewport (Babylon offscreen); see viewport "thumb" command
                        let cached = root.join(".nord-cache/thumbs").join(format!(
                            "{}{}.png",
                            a.sha256,
                            nord_core::thumbs::CACHE_TAG
                        ));
                        if cached.v_exists() {
                            st.assets_ui.thumbs.insert(e.rel.clone(), Some(cached));
                        } else if !st.assets_ui.pending.contains(&e.rel) {
                            st.assets_ui.pending.insert(e.rel.clone());
                            st.assets_ui.model_requests.push(e.rel.clone());
                        }
                    } else if st.assets_ui.pending.insert(e.rel.clone()) {
                        let _ = st.assets_ui.tx.send((root.to_path_buf(), a));
                    }
                }
                ui.ctx().request_repaint_after(Duration::from_millis(150));
            }
        }
    }
    let name = kind_icon(e.kind, e.is_dir);
    let c = icons::kind_color(name, ui.visuals().weak_text_color());
    let r = icons::snap(
        ui.ctx(),
        egui::Rect::from_center_size(rect.center(), Vec2::splat(rect.width() * 0.62)),
    );
    // The cell already owns its layout space. `ui.put` would advance the wrapped
    // row's cursor again, pushing each following tile down into a staircase.
    icons::icon(name, r.width(), c).paint_at(ui, r);
}
