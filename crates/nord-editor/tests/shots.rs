//! Renders editor screenshots for the docs (offscreen wgpu through egui_kittest). Ignored by default:
//!   DUMP_SHOTS=$PWD/../../docs/screenshots cargo test -p nord-editor --test shots -- --ignored --nocapture
//! The Scene/Game viewports are native webviews and are not part of these images (the panels around them are).
use egui_kittest::Harness;
use nord_editor::{app::App, state::Action};
use std::path::{Path, PathBuf};

fn copy_dir(from: &Path, to: &Path) {
    std::fs::create_dir_all(to).unwrap();
    for e in std::fs::read_dir(from).unwrap().flatten() {
        let (p, t) = (e.path(), to.join(e.file_name()));
        if p.is_dir() {
            copy_dir(&p, &t);
        } else {
            std::fs::copy(&p, &t).unwrap();
        }
    }
}

#[test]
#[ignore = "writes PNGs; run explicitly (needs a GPU adapter)"]
fn render_docs_screenshots() {
    let out = PathBuf::from(std::env::var("DUMP_SHOTS").expect("set DUMP_SHOTS=<dir>"));
    std::fs::create_dir_all(&out).unwrap();
    std::env::set_var(
        "NORD_CONFIG_DIR",
        std::env::temp_dir().join(format!("nord-shots-config-{}", std::process::id())),
    );
    let proj = std::env::temp_dir()
        .join(format!("nord-shots-{}", std::process::id()))
        .join("proj");
    let _ = std::fs::remove_dir_all(&proj);
    copy_dir(
        &Path::new(env!("CARGO_MANIFEST_DIR")).join("../../examples/platformer3d"),
        &proj,
    );
    // a material asset and a few coloured assets for the Assets panel
    std::fs::create_dir_all(proj.join("assets/materials")).unwrap();
    std::fs::write(proj.join("assets/materials/lava.mat.json"), "{\n  \"color\": \"#ff6a2a\",\n  \"metallic\": 0.2,\n  \"roughness\": 0.35,\n  \"alpha\": 1\n}\n").unwrap();

    let mut app = App::new(false);
    app.dock = nord_editor::app::layout_dock("unity");
    app.st.settings.theme = "playcanvas".into();
    app.st.push(Action::OpenPath(proj.clone()));
    let mut h = Harness::builder()
        .with_size(egui::vec2(1600.0, 1000.0))
        .build_state(|ctx, app: &mut App| app.frame_ui(ctx, None), app);
    egui_extras::install_image_loaders(&h.ctx);
    h.run_steps(6);
    let first = h
        .state()
        .st
        .scene
        .as_ref()
        .and_then(|s| s.entities.first())
        .map(|e| e.id.clone());
    if let Some(id) = first {
        h.state_mut().st.select(Some(id));
    }
    h.run_steps(4);
    let shot = |h: &mut Harness<'_, App>, name: &str| {
        h.run_steps(3);
        let img = h.render().expect("render");
        img.save(out.join(name)).unwrap();
        eprintln!("wrote {name}");
    };
    shot(&mut h, "ed-unity-layout.png");

    h.state_mut().st.assets_ui.selected = Some("assets/materials/lava.mat.json".into());
    h.state_mut().st.selection.clear();
    shot(&mut h, "ed-material-asset.png");

    h.state_mut().st.push(Action::BuildSettings);
    shot(&mut h, "ed-build-settings.png");
    h.state_mut().st.build_ui.open = false;

    h.state_mut().st.push(Action::NewScene);
    shot(&mut h, "ed-new-scene.png");
    h.state_mut().st.fun_ui.new_scene_open = false;

    h.state_mut().st.push(Action::Tutorial);
    shot(&mut h, "ed-first-10-minutes.png");
    h.state_mut().st.fun_ui.tutorial_open = false;

    h.state_mut().st.settings_open = true;
    shot(&mut h, "ed-settings-shortcuts.png");
    h.state_mut().st.settings_open = false;

    h.state_mut().st.push(Action::Layout("wide".into()));
    shot(&mut h, "ed-layout-wide.png");
}
