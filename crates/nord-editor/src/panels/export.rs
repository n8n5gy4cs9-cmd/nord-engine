//! Export dialog: runs `nord_export::build` on a worker thread, logs the report to the console, can open the output folder.
use crate::state::{EditorState, LogLevel};
use nord_export::{Opts, Target};
use std::{
    path::PathBuf,
    sync::mpsc::{channel, Receiver},
};

pub struct ExportUi {
    pub open: bool,
    pub target: Target,
    pub minify: bool,
    pub single_file: bool,
    pub optimize: bool,
    pub zip: bool,
    pub pwa: bool,
    pub compile_events: bool,
    /// empty = `<project>/dist`
    pub out: String,
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
            compile_events: true,
            out: String::new(),
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
                "minify": e.minify, "single_file": e.single_file, "optimize": e.optimize, "pwa": e.pwa, "no_compile_events": !e.compile_events,
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
        out: (!e.out.trim().is_empty()).then(|| PathBuf::from(e.out.trim())),
        minify: e.minify && !web,
        single_file: e.single_file && !web,
        optimize: e.optimize && !web,
        zip: e.zip || web,
        pwa: e.pwa,
        compile_events: e.compile_events && !web,
    };
    let (tx, rx) = channel();
    crate::platform::run_export(move || {
        let r = nord_export::build(&root, &engine, &opts)
            .map(|r| (r.summary(), r.out))
            .map_err(|e| format!("{e:#}"));
        let _ = tx.send(r);
    });
    st.export_ui.running = Some(rx);
    st.export_ui.status = "Building…".into();
}

impl ExportUi {
    pub fn is_running(&self) -> bool {
        self.running.is_some()
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
    if !st.export_ui.open {
        return;
    }
    let mut open = true;
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
    if !open {
        st.export_ui.open = false;
    }
}
