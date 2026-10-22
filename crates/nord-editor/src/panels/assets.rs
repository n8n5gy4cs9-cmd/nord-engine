//! Asset browser: folder tree + thumbnail grid (lazy, worker-thread thumbnails via nord-core), search/filter,
//! import (dialog or OS drag&drop), rename/move/delete, drag out as `AssetDrag`.
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
    pub rename: Option<(String, String)>,
    pub confirm_delete: Option<String>,
    /// last clicked entry (F2 rename, Delete, Ctrl/Cmd+D duplicate act on it)
    pub selected: Option<String>,
    listing: Vec<Entry>,
    listed_at: Option<Instant>,
    listed_dir: String,
    thumbs: HashMap<String, Option<PathBuf>>,
    pending: HashSet<String>,
    tx: Sender<ThumbJob>,
    rx: Receiver<(String, Option<PathBuf>)>,
    /// model asset paths the edit viewport should render (drained by the app when a 3D viewport is connected)
    pub model_requests: Vec<String>,
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
            rename: None,
            confirm_delete: None,
            selected: None,
            listing: vec![],
            listed_at: None,
            listed_dir: String::new(),
            thumbs: HashMap::new(),
            pending: HashSet::new(),
            tx,
            rx,
            model_requests: vec![],
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
        ui.separator();
    }
    if !e.rel.is_empty() {
        item(ui, "Rename   F2", OP_RENAME);
        item(ui, "Duplicate   ⌘/Ctrl+D", OP_DUP);
        item(ui, "Delete   Del", OP_DELETE);
        ui.separator();
    }
    item(ui, reveal_label(), OP_REVEAL);
    item(ui, "Copy path", OP_COPY_PATH);
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
        ui.horizontal(|ui| {
            ui.add_space(depth as f32 * 12.0);
            ui.add(icons::icon(
                if open { "folder-open" } else { "folder" },
                14.0,
                ui.visuals().text_color(),
            ));
            let r = ui.selectable_label(sel, &d.name);
            if r.clicked() {
                st.assets_ui.dir = d.rel.clone();
                st.assets_ui.selected = Some(d.rel.clone());
            }
            r.context_menu(|ui| entry_menu(ui, &d, ctx));
            // drop an asset on a folder = move
            if let Some(p) = r.dnd_release_payload::<AssetDrag>() {
                move_asset(st, &p.0, &d.rel);
            }
        });
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
        st.log(LogLevel::Info, format!("Moved {from} -> {dest}"));
        st.refresh_assets();
        st.assets_ui.listed_at = None;
    }
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
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
                    AssetType::Scene,
                    AssetType::Json,
                    AssetType::Font,
                ] {
                    ui.selectable_value(&mut st.assets_ui.kind_filter, Some(k), format!("{k:?}"));
                }
            });
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
                    let r = ui.selectable_label(sel, "📁 (project)");
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
    let entries: Vec<Entry> = entries
        .into_iter()
        .filter(|e| filter.is_none_or(|k| e.is_dir || e.kind == k))
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
                        let r = ui.add(egui::TextEdit::singleline(buf).desired_width(cell));
                        r.request_focus();
                        if r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                            commit = true;
                        }
                        if ui.input(|i| i.key_pressed(egui::Key::Escape)) {
                            st.assets_ui.rename = None;
                        }
                        if commit {
                            let (from, new) = st.assets_ui.rename.take().unwrap();
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
                    let resp = resp.on_hover_text(&e.rel);
                    if resp.clicked() || resp.secondary_clicked() {
                        st.assets_ui.selected = Some(e.rel.clone());
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
    match e.kind {
        AssetType::Scene => {
            if let Err(m) = st.open_scene(&e.rel) {
                st.log(LogLevel::Error, m);
            }
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

fn kind_icon(k: AssetType, dir: bool) -> &'static str {
    if dir {
        return "folder";
    }
    match k {
        AssetType::Image | AssetType::Spritesheet => "image",
        AssetType::Audio => "music",
        AssetType::Model => "box",
        AssetType::Scene => "map",
        AssetType::Prefab => "package",
        AssetType::Video => "film",
        AssetType::Font => "type",
        AssetType::Json => "file-code",
        AssetType::Other => "file-text",
    }
}

fn draw_thumb(st: &mut EditorState, ui: &mut Ui, root: &Path, e: &Entry, rect: egui::Rect) {
    let wants_thumb = matches!(
        e.kind,
        AssetType::Image | AssetType::Spritesheet | AssetType::Audio | AssetType::Model
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
                        let cached = root
                            .join(".nord-cache/thumbs")
                            .join(format!("{}.png", a.sha256));
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
    let c = ui.visuals().weak_text_color();
    let r = egui::Rect::from_center_size(rect.center(), Vec2::splat(rect.width() * 0.55));
    // The cell already owns its layout space. `ui.put` would advance the wrapped
    // row's cursor again, pushing each following tile down into a staircase.
    icons::icon(kind_icon(e.kind, e.is_dir), r.width(), c).paint_at(ui, r);
}
