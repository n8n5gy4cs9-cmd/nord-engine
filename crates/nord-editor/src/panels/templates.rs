//! Project ▸ Export templates…: the prebuilt `nord-player` per OS/arch used by desktop export (see nord_export::templates).
use crate::state::{EditorState, LogLevel};
use nord_export::localbuild;
use nord_export::templates::{self, Platform, Status};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc::{channel, Receiver},
    Arc,
};

enum Msg {
    Log(String),
    Done(Result<String, String>),
}

#[derive(Default)]
pub struct TemplatesUi {
    pub open: bool,
    rx: Option<Receiver<Msg>>,
    cancel: Arc<AtomicBool>,
    status: String,
    /// (container tool, colima present), refreshed by "Check again"
    tools: Option<(Option<&'static str>, bool)>,
}

fn size(b: u64) -> String {
    format!("{:.1} MB", b as f64 / 1_048_576.0)
}

fn spawn<F: FnOnce(&dyn Fn(String)) -> Result<String, String> + Send + 'static>(
    st: &mut EditorState,
    what: &str,
    f: F,
) {
    let (tx, rx) = channel();
    st.templates_ui.cancel.store(false, Ordering::Relaxed);
    crate::platform::run_export(move || {
        let t2 = tx.clone();
        let r = f(&move |l| {
            let _ = t2.send(Msg::Log(l));
        });
        let _ = tx.send(Msg::Done(r));
    });
    st.templates_ui.rx = Some(rx);
    st.templates_ui.status = what.into();
}

pub fn window(st: &mut EditorState, ctx: &egui::Context) {
    let mut done = vec![];
    if let Some(rx) = &st.templates_ui.rx {
        while let Ok(m) = rx.try_recv() {
            match m {
                Msg::Log(l) => done.push((LogLevel::Build, l)),
                Msg::Done(r) => {
                    st.templates_ui.rx = None;
                    match r {
                        Ok(s) => {
                            st.templates_ui.status = s.clone();
                            done.push((LogLevel::Build, s));
                        }
                        Err(e) => {
                            st.templates_ui.status = format!("Failed: {e}");
                            done.push((LogLevel::Error, e));
                        }
                    }
                    break;
                }
            }
        }
        ctx.request_repaint_after(std::time::Duration::from_millis(200));
    }
    for (lv, l) in done {
        st.log(lv, l);
    }
    if !st.templates_ui.open {
        return;
    }
    let mut open = true;
    let busy = st.templates_ui.rx.is_some();
    let dev = st.settings.dev_build_templates;
    let engine = crate::platform::engine_root();
    let mut action: Option<(Platform, &str)> = None;
    let (mut install, mut build_all, mut cancel, mut check) = (false, false, false, false);
    egui::Window::new("Export templates")
        .open(&mut open)
        .default_width(520.0)
        .show(ctx, |ui| {
            ui.weak(format!("Nord {} · folder: {}", templates::version(), templates::dir(Platform::MacArm64).parent().map(|p| p.display().to_string()).unwrap_or_default()));
            egui::Grid::new("tpl").num_columns(5).spacing([12.0, 6.0]).show(ui, |ui| {
                for p in Platform::ALL {
                    ui.label(p.label());
                    match templates::status(p) {
                        Status::Missing => {
                            ui.weak("missing");
                            ui.label("");
                            ui.label("");
                        }
                        Status::Installed(v, sz) => {
                            ui.colored_label(egui::Color32::from_rgb(90, 190, 110), "installed");
                            ui.label(v);
                            ui.label(size(sz));
                        }
                        Status::Bad(e) => {
                            ui.colored_label(egui::Color32::from_rgb(230, 90, 90), "bad").on_hover_text(&e);
                            ui.label("");
                            ui.label("");
                        }
                    }
                    ui.horizontal(|ui| {
                        if ui.add_enabled(!busy, egui::Button::new("Download")).clicked() {
                            action = Some((p, "download"));
                        }
                        if ui.add_enabled(!busy, egui::Button::new("Remove")).clicked() {
                            action = Some((p, "remove"));
                        }
                    });
                    ui.end_row();
                }
            });
            ui.horizontal(|ui| {
                if ui.add_enabled(!busy, egui::Button::new("Install from file…")).on_hover_text("A .nordtemplates file").clicked() {
                    install = true;
                }
                if ui.button("Open folder").clicked() {
                    let d = templates::dir(Platform::MacArm64);
                    let d = d.parent().map(|p| p.to_path_buf()).unwrap_or(d);
                    let _ = std::fs::create_dir_all(&d);
                    #[cfg(target_os = "macos")]
                    let _ = std::process::Command::new("open").arg(&d).spawn();
                    #[cfg(not(target_os = "macos"))]
                    let _ = std::process::Command::new("xdg-open").arg(&d).spawn();
                }
                if busy {
                    ui.spinner();
                    if ui.button("Cancel").clicked() {
                        cancel = true;
                    }
                }
            });
            ui.weak("On your own OS the editor uses its bundled player when no template is installed.");
            if dev {
                ui.separator();
                ui.strong("Build templates locally (developer)");
                let t = *st.templates_ui.tools.get_or_insert_with(|| (localbuild::container_tool(), localbuild::has_colima()));
                match t.0 {
                    None => {
                        ui.colored_label(egui::Color32::from_rgb(230, 170, 70), format!("docker/podman not found. {}", localbuild::install_steps()));
                        if ui.button("Check again").clicked() {
                            check = true;
                        }
                    }
                    Some(tool) => {
                        ui.weak(format!("Using {tool}{}. Linux and Windows players only (Mac players need a Mac or CI).", if t.1 { " with Colima" } else { "" }));
                        ui.weak("First run pulls images (about 5-10 GB of disk) and can take 10-30 minutes. Missing templates are built one after another.");
                        if ui.add_enabled(!busy && engine.is_some(), egui::Button::new("Build templates")).clicked() {
                            build_all = true;
                        }
                    }
                }
            }
            ui.weak(&st.templates_ui.status);
        });
    if check {
        st.templates_ui.tools = None;
    }
    if cancel {
        st.templates_ui.cancel.store(true, Ordering::Relaxed);
    }
    if install {
        if let Some(f) = crate::platform::pick_file("Choose a .nordtemplates file", "nordtemplates")
        {
            spawn(st, "Installing…", move |_| {
                templates::install_zip(&f)
                    .map(|p| format!("Installed the {} template.", p.label()))
                    .map_err(|e| format!("{e:#}"))
            });
        }
    }
    if let Some((p, what)) = action {
        match what {
            "download" => spawn(st, "Downloading…", move |log| {
                log(format!("Downloading {}…", templates::download_url(p)));
                templates::download(p)
                    .map(|_| format!("Installed the {} template.", p.label()))
                    .map_err(|e| format!("{e:#}"))
            }),
            _ => match templates::remove(p) {
                Ok(()) => st.templates_ui.status = format!("Removed the {} template.", p.label()),
                Err(e) => st.templates_ui.status = format!("{e:#}"),
            },
        }
    }
    if build_all {
        if let Some(eng) = engine {
            let cancel = st.templates_ui.cancel.clone();
            spawn(st, "Building templates…", move |log| {
                let mut built = vec![];
                for p in Platform::ALL.into_iter().filter(|p| {
                    localbuild::buildable(*p) && templates::status(*p) == Status::Missing
                }) {
                    log(format!("== {} ==", p.label()));
                    localbuild::build(p, &eng, log, &cancel)
                        .map_err(|e| format!("{}: {e:#}", p.label()))?;
                    built.push(p.id());
                }
                Ok(if built.is_empty() {
                    "Nothing to build: all Linux / Windows templates are installed.".into()
                } else {
                    format!("Built {}.", built.join(", "))
                })
            });
        }
    }
    if !open {
        st.templates_ui.open = false;
    }
}
