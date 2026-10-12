//! Asset browser: folder tree + thumbnail grid (lazy, worker-thread thumbnails via nord-core), search/filter,
//! import (dialog or OS drag&drop), rename/move/delete, drag out as `AssetDrag`.
use crate::{
    icons,
    panels::inspector::AssetDrag,
    state::{Action, EditorState, LogLevel},
};
use egui::{Sense, Ui, Vec2};
use nord_core::assets::{classify, Asset, AssetType};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::mpsc::{channel, Receiver, Sender},
    time::{Duration, Instant},
};

pub struct AssetsUi {
    pub dir: String, // project-relative folder ("" = project root)
    pub search: String,
    pub size: f32,
    /// list view (rows) instead of the thumbnail grid
    pub list: bool,
    pub kind_filter: Option<AssetType>,
    pub rename: Option<(String, String)>,
    pub confirm_delete: Option<String>,
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
        std::thread::spawn(move || {
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
    let Ok(rd) = std::fs::read_dir(root.join(rel)) else {
        return vec![];
    };
    let mut v: Vec<Entry> = rd
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if SKIP.contains(&name.as_str()) || name.ends_with(".meta.json") {
                return None;
            }
            let is_dir = e.path().is_dir();
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
    let _ = std::fs::create_dir_all(&dest);
    let mut n = 0;
    for f in files {
        if let Some(name) = f.file_name() {
            if std::fs::copy(f, dest.join(name)).is_ok() {
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

fn tree(st: &mut EditorState, ui: &mut Ui, rel: &str, depth: usize) {
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
            }
            // drop an asset on a folder = move
            if let Some(p) = r.dnd_release_payload::<AssetDrag>() {
                move_asset(st, &p.0, &d.rel);
            }
        });
        if has_sub && open {
            tree(st, ui, &d.rel, depth + 1);
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
    if dest == from || root.join(&dest).exists() {
        return;
    }
    if std::fs::rename(root.join(from), root.join(&dest)).is_ok() {
        let _ = std::fs::rename(
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
            if let Some(files) = rfd::FileDialog::new().pick_files() {
                import_files(st, &files);
            }
        }
        if icons::button(ui, "refresh-cw", "Refresh", false).clicked() {
            st.refresh_assets();
            st.assets_ui.listed_at = None;
            st.assets_ui.thumbs.clear();
        }
        if icons::button(ui, "plus", "New folder", false).clicked() {
            let mut n = 1;
            loop {
                let p = root.join(&st.assets_ui.dir).join(format!("folder{n}"));
                if !p.exists() {
                    let _ = std::fs::create_dir_all(p);
                    break;
                }
                n += 1;
            }
            st.assets_ui.listed_at = None;
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

    egui::SidePanel::left("asset-tree")
        .resizable(true)
        .default_width(140.0)
        .show_inside(ui, |ui| {
            egui::ScrollArea::both()
                .auto_shrink([false; 2])
                .show(ui, |ui| {
                    let sel = st.assets_ui.dir.is_empty();
                    if ui.selectable_label(sel, "📁 (project)").clicked() {
                        st.assets_ui.dir.clear();
                    }
                    tree(st, ui, "", 0);
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
    let mut ctx_op: Option<(Entry, u8)> = None;
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
                            if !root.join(&to).exists()
                                && std::fs::rename(root.join(&from), root.join(&to)).is_ok()
                            {
                                let _ = std::fs::rename(
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
                    if resp.hovered() {
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
                            let sz = std::fs::metadata(root.join(&e.rel)).map_or(0, |m| m.len());
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
                    if resp.double_clicked() {
                        open = Some(e.clone());
                    } else if resp.clicked() && e.is_dir {
                        st.assets_ui.dir = e.rel.clone();
                    }
                    if !e.is_dir {
                        resp.dnd_set_drag_payload(AssetDrag(e.rel.clone()));
                    }
                    resp.context_menu(|ui| {
                        for (i, t) in ["Open", "Rename", "Delete", "Reveal in Finder", "Copy path"]
                            .iter()
                            .enumerate()
                        {
                            if ui.button(*t).clicked() {
                                ctx_op = Some((e.clone(), i as u8));
                                ui.close_menu();
                            }
                        }
                    });
                }
            });
        });
    if let Some(e) = open {
        open_entry(st, &e);
    }
    if let Some((e, op)) = ctx_op {
        match op {
            0 => open_entry(st, &e),
            1 => st.assets_ui.rename = Some((e.rel.clone(), e.name.clone())),
            2 => st.assets_ui.confirm_delete = Some(e.rel.clone()),
            3 => reveal(&root.join(&e.rel)),
            _ => ui.ctx().copy_text(e.rel.clone()),
        }
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
                        let _ = if f.is_dir() {
                            std::fs::remove_dir_all(&f)
                        } else {
                            std::fs::remove_file(&f)
                        };
                        let _ = std::fs::remove_file(root.join(format!("{p}.meta.json")));
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
    #[cfg(not(target_os = "macos"))]
    let _ = std::process::Command::new("xdg-open")
        .arg(p.parent().unwrap_or(p))
        .spawn();
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
                        if cached.exists() {
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
