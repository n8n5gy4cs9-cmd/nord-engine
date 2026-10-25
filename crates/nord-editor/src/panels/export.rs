//! Export dialog: runs `nord_export::build` on a worker thread, logs the report to the console, can open the output folder.
use crate::state::{EditorState, LogLevel};
use nord_export::templates::{self, DesktopOpts, Platform, Status};
use nord_export::{Host, Opts, Target};
use std::{
    path::PathBuf,
    sync::mpsc::{channel, Receiver},
};

/// App path + notes for the Console, or a one-line error.
type DesktopResult = Result<(PathBuf, Vec<String>), String>;

pub struct ExportUi {
    pub open: bool,
    pub target: Target,
    pub minify: bool,
    pub single_file: bool,
    pub optimize: bool,
    pub zip: bool,
    pub pwa: bool,
    /// hosting preset (deploy files for itch.io, GitHub Pages, Netlify, Vercel, Docker)
    pub host: Host,
    pub compile_events: bool,
    /// empty = `<project>/dist`
    pub out: String,
    /// next `start` builds the Android/iOS (Capacitor) project instead of the web folder
    pub mobile: bool,
    /// Desktop app section: platform, archive (.dmg on Mac / .zip / .tar.gz), app name, icon, output folder (empty = `<project>/dist-desktop`)
    pub d_platform: Platform,
    pub d_archive: bool,
    pub d_name: String,
    pub d_icon: String,
    pub d_out: String,
    desk: Option<Receiver<DesktopResult>>,
    running: Option<Receiver<Result<(String, PathBuf), String>>>,
    last_out: Option<PathBuf>,
    status: String,
}

impl Default for ExportUi {
    fn default() -> Self {
        Self {
            open: false,
            target: Target::Auto,
            minify: true,
            single_file: false,
            optimize: false,
            zip: false,
            pwa: false,
            host: Host::None,
            compile_events: true,
            out: String::new(),
            mobile: false,
            d_platform: Platform::host().unwrap_or(Platform::WindowsX64),
            d_archive: false,
            d_name: String::new(),
            d_icon: String::new(),
            d_out: String::new(),
            desk: None,
            running: None,
            last_out: None,
            status: String::new(),
        }
    }
}

fn open_folder(p: &std::path::Path) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(p).spawn();
    #[cfg(not(target_os = "macos"))]
    let _ = std::process::Command::new("xdg-open").arg(p).spawn();
}

/// Start a build with the dialog's options (also used by tests).
pub fn start(st: &mut EditorState) {
    if !crate::platform::can(crate::platform::JobKind::Export) {
        st.toast("Export is not available in the browser editor yet");
        return;
    }
    // server mode: the server runs the full pipeline (minify, single file, optimise, event-sheet compile), then we download the zip
    #[cfg(target_arch = "wasm32")]
    if crate::web::server_mode() {
        if let Some(root) = st.root.clone() {
            let e = &st.export_ui;
            let opts = serde_json::json!({
                "target": (e.target != Target::Auto).then(|| e.target.as_str()),
                "minify": e.minify, "single_file": e.single_file, "optimize": e.optimize, "pwa": e.pwa, "host": (e.host != Host::None).then(|| e.host.as_str()), "no_compile_events": !e.compile_events,
            });
            crate::web::server_export(&root, opts.to_string());
            st.export_ui.status = "Exporting on the server… (progress in the Console)".into();
        }
        return;
    }
    #[cfg(target_arch = "wasm32")]
    if !crate::web::engine_ready() {
        crate::web::load_engine();
        st.export_ui.status = "Loading engine files… press Export again in a moment".into();
        return;
    }
    let (Some(root), Some(engine)) = (
        st.root.clone(),
        crate::platform::engine_root().or_else(crate::platform::web_engine_root),
    ) else {
        st.export_ui.status = "No project open or engine folder not found (set NORD_ROOT)".into();
        return;
    };
    let e = &st.export_ui;
    // browser: no node/ffmpeg, so no minify / single-file / event-sheet compile / optimise; the result is always a zip
    let web = cfg!(target_arch = "wasm32");
    let opts = Opts {
        target: e.target,
        out: (!e.out.trim().is_empty() && !e.mobile).then(|| PathBuf::from(e.out.trim())),
        minify: e.minify && !web,
        single_file: e.single_file && !web,
        optimize: e.optimize && !web,
        zip: e.zip || web,
        pwa: e.pwa,
        host: if web { Host::None } else { e.host },
        compile_events: e.compile_events && !web,
    };
    let (tx, rx) = channel();
    let mobile = std::mem::take(&mut st.export_ui.mobile);
    crate::platform::run_export(move || {
        let built = if mobile {
            nord_export::build_mobile(&root, &engine, &opts)
        } else {
            nord_export::build(&root, &engine, &opts)
        };
        let r = built
            .map(|r| (r.summary(), r.out))
            .map_err(|e| format!("{e:#}"));
        let _ = tx.send(r);
    });
    st.export_ui.running = Some(rx);
    st.export_ui.status = "Building…".into();
}

/// Mac is only offered when a Mac template exists (or this is that Mac and has its own player).
fn platform_ready(p: Platform, engine: Option<&std::path::Path>) -> bool {
    matches!(templates::status(p), Status::Installed(..))
        || (Platform::host() == Some(p)
            && engine.is_some_and(|e| nord_export::mac::find_player(e).is_some()))
}

/// Desktop export: web build into a temp folder, then wrap it with the template of the chosen platform (background thread).
pub fn start_desktop(st: &mut EditorState) {
    let (Some(root), Some(engine)) = (st.root.clone(), crate::platform::engine_root()) else {
        st.export_ui.status = "No project open or engine folder not found (set NORD_ROOT)".into();
        return;
    };
    let e = &st.export_ui;
    let o = DesktopOpts {
        platform: e.d_platform,
        name: Some(e.d_name.trim().to_string()).filter(|n| !n.is_empty()),
        out_dir: if e.d_out.trim().is_empty() {
            root.join("dist-desktop")
        } else {
            PathBuf::from(e.d_out.trim())
        },
        icon: Some(PathBuf::from(e.d_icon.trim()))
            .filter(|p| !e.d_icon.trim().is_empty() && p.exists()),
        archive: e.d_archive,
    };
    let (tx, rx) = channel();
    crate::platform::run_export(move || {
        let tmp = std::env::temp_dir().join(format!("nord-desktop-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        let r = nord_export::build(
            &root,
            &engine,
            &Opts {
                out: Some(tmp.clone()),
                ..Default::default()
            },
        )
        .and_then(|_| templates::export_desktop(&tmp, &engine, &o))
        .map_err(|e| friendly(&format!("{e:#}")));
        let _ = std::fs::remove_dir_all(&tmp);
        let _ = tx.send(r);
    });
    st.export_ui.desk = Some(rx);
    st.log(
        LogLevel::Build,
        format!(
            "Desktop export for {}: building the web game first…",
            st.export_ui.d_platform.label()
        ),
    );
    st.export_ui.status = "Building desktop app…".into();
}

/// One-line messages for the common failures.
fn friendly(e: &str) -> String {
    let first = e.lines().next().unwrap_or(e);
    if e.contains("Permission denied") || e.contains("os error 13") {
        "No write permission for the output folder: pick another one.".into()
    } else if e.contains("codesign failed") {
        "codesign is not available or failed: the app is unsigned. Right-click ▸ Open the first time.".into()
    } else {
        first.to_string()
    }
}

impl ExportUi {
    pub fn is_running(&self) -> bool {
        self.running.is_some() || self.desk.is_some()
    }
}

pub fn window(st: &mut EditorState, ctx: &egui::Context) {
    if let Some(rx) = &st.export_ui.running {
        if let Ok(r) = rx.try_recv() {
            st.export_ui.running = None;
            match r {
                Ok((summary, out)) => {
                    for l in summary.lines() {
                        st.log(LogLevel::Build, l.to_string());
                    }
                    st.export_ui.status = format!("Done → {}", out.display());
                    #[cfg(target_arch = "wasm32")]
                    if let Err(e) = crate::web::download_file(&out.with_extension("zip")) {
                        st.log(LogLevel::Error, format!("Download failed: {e}"));
                    }
                    if std::mem::take(&mut st.build_ui.run_after) {
                        let page = out.join("index.html");
                        crate::viewport::webview::open_in_browser(&format!(
                            "file://{}",
                            page.display()
                        ));
                    }
                    st.export_ui.last_out = Some(out);
                }
                Err(e) => {
                    st.log(LogLevel::Error, format!("Export failed: {e}"));
                    st.export_ui.status = format!("Failed: {}", e.lines().next().unwrap_or(""));
                }
            }
        } else {
            ctx.request_repaint_after(std::time::Duration::from_millis(200));
        }
    }
    if let Some(rx) = &st.export_ui.desk {
        if let Ok(r) = rx.try_recv() {
            st.export_ui.desk = None;
            match r {
                Ok((app, notes)) => {
                    for n in notes {
                        st.log(LogLevel::Build, n);
                    }
                    st.log(LogLevel::Build, format!("Desktop app → {}", app.display()));
                    st.export_ui.status = format!("Done → {}", app.display());
                    st.export_ui.last_out = app.parent().map(|p| p.to_path_buf());
                }
                Err(e) => {
                    st.log(LogLevel::Error, format!("Desktop export failed: {e}"));
                    st.export_ui.status = format!("Failed: {e}");
                }
            }
        } else {
            ctx.request_repaint_after(std::time::Duration::from_millis(200));
        }
    }
    if !st.export_ui.open {
        return;
    }
    let mut open = true;
    let mut go_desktop = false;
    let mut open_templates = false;
    let busy = st.export_ui.running.is_some();
    let mut go = false;
    egui::Window::new("Export")
        .open(&mut open)
        .default_width(420.0)
        .show(ctx, |ui| {
            let e = &mut st.export_ui;
            egui::Grid::new("export").num_columns(2).spacing([12.0, 6.0]).show(ui, |ui| {
                ui.label("Target");
                egui::ComboBox::from_id_salt("export-target")
                    .selected_text(match e.target {
                        Target::Auto => "Auto (from project type)",
                        t => t.as_str(),
                    })
                    .show_ui(ui, |ui| {
                        for t in [Target::Auto, Target::Html, Target::Web2d, Target::Web3d, Target::Web3dPc] {
                            ui.selectable_value(&mut e.target, t, t.as_str());
                        }
                    });
                ui.end_row();
                ui.label("Output folder");
                ui.add(egui::TextEdit::singleline(&mut e.out).hint_text("<project>/dist"));
                ui.end_row();
            });
            ui.checkbox(&mut e.minify, "Minify JS + JSON");
            ui.checkbox(&mut e.single_file, "Single file (one index.html, works from file://)");
            ui.checkbox(&mut e.optimize, "Optimise assets (lossless PNG, WAV→MP3 if ffmpeg is installed)");
            ui.checkbox(&mut e.zip, "Also write a .zip (itch.io style upload)");
            ui.add_enabled(!e.single_file, egui::Checkbox::new(&mut e.compile_events, "Compile event sheets to JavaScript (needs Node; faster start, no expression parsing)"));
            ui.add_enabled(!e.single_file, egui::Checkbox::new(&mut e.pwa, "Installable offline web app (PWA: manifest + service worker)"));
            egui::ComboBox::from_label("Hosting preset")
                .selected_text(e.host.label())
                .show_ui(ui, |ui| {
                    for h in Host::ALL {
                        ui.selectable_value(&mut e.host, h, h.label());
                    }
                });
            ui.separator();
            ui.collapsing("Desktop app (Mac / Windows / Linux)", |ui| {
                let engine = crate::platform::engine_root();
                egui::ComboBox::from_label("Platform")
                    .selected_text(e.d_platform.label())
                    .show_ui(ui, |ui| {
                        for p in Platform::ALL {
                            let ok = !p.is_mac() || platform_ready(p, engine.as_deref());
                            ui.add_enabled_ui(ok, |ui| {
                                ui.selectable_value(&mut e.d_platform, p, p.label())
                            })
                            .response
                            .on_disabled_hover_text("No Mac template installed: Project ▸ Export templates…");
                        }
                    });
                let kind = if e.d_platform.is_mac() {
                    "Make .dmg (Mac only) and .zip"
                } else if e.d_platform.is_windows() {
                    "Make .zip"
                } else {
                    "Make .tar.gz"
                };
                ui.checkbox(&mut e.d_archive, kind);
                egui::Grid::new("export-desktop").num_columns(2).show(ui, |ui| {
                    ui.label("App name");
                    ui.add(egui::TextEdit::singleline(&mut e.d_name).hint_text("project name"));
                    ui.end_row();
                    ui.label("Icon (PNG)");
                    ui.add(egui::TextEdit::singleline(&mut e.d_icon).hint_text("icon.png in the project, else the Nord logo"));
                    ui.end_row();
                    ui.label("Output folder");
                    ui.add(egui::TextEdit::singleline(&mut e.d_out).hint_text("<project>/dist-desktop"));
                    ui.end_row();
                });
                ui.horizontal(|ui| {
                    if ui.add_enabled(!busy, egui::Button::new("Export desktop app")).clicked() {
                        go_desktop = true;
                    }
                    if ui.button("Export templates…").clicked() {
                        open_templates = true;
                    }
                });
            });
            ui.separator();
            ui.horizontal(|ui| {
                if ui.add_enabled(!busy, egui::Button::new("Export")).clicked() {
                    go = true;
                }
                if let Some(p) = e.last_out.clone() {
                    if ui.button("Open folder").clicked() {
                        open_folder(&p);
                    }
                }
                if busy {
                    ui.spinner();
                }
            });
            ui.weak(&e.status);
            ui.weak("Static output: works on any web server, itch.io, GitHub Pages (see docs/HOSTING.md).");
        });
    if go {
        start(st);
    }
    if go_desktop {
        start_desktop(st);
    }
    if open_templates {
        st.templates_ui.open = true;
    }
    if !open {
        st.export_ui.open = false;
    }
}
