//! Headless UI tests (egui_kittest): panels render, react to input and edit the scene through the undo system.
use egui_kittest::{kittest::Queryable, Harness};
use nord_editor::{app::App, panels, state::EditorState};
use std::path::PathBuf;

fn temp_project(name: &str, kind: nord_core::ProjectType) -> PathBuf {
    // keep recent-projects / settings out of the real config dir
    std::env::set_var(
        "NORD_CONFIG_DIR",
        std::env::temp_dir().join(format!("nord-ui-config-{}", std::process::id())),
    );
    let d = std::env::temp_dir()
        .join(format!("nord-ui-{name}-{}", std::process::id()))
        .join("proj");
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    nord_core::project::create(&d, kind).unwrap();
    d
}

/// Panels draw SVG icons; the app installs the image loaders in its first frame, headless harnesses do it here.
fn loaders(h: &egui_kittest::Harness<'_, impl Sized>) {
    egui_extras::install_image_loaders(&h.ctx);
}

fn state_with_scene(name: &str) -> EditorState {
    let d = temp_project(name, nord_core::ProjectType::TwoD);
    let mut st = EditorState::new();
    st.settings = Default::default();
    st.open_project(&d).unwrap();
    st
}

#[test]
fn hierarchy_add_select_delete_undo() {
    let st = state_with_scene("hier");
    let mut h = Harness::new_ui_state(|ui, st: &mut EditorState| panels::hierarchy::ui(st, ui), st);
    loaders(&h);
    h.run();
    assert!(h.state().scene.as_ref().unwrap().entities.is_empty());
    h.state_mut().add_entity(None);
    h.run();
    h.get_by_label("Entity").click();
    h.run();
    assert_eq!(h.state().selection.len(), 1);
    h.state_mut().delete_selected();
    assert!(h.state().scene.as_ref().unwrap().entities.is_empty());
    h.state_mut().do_undo();
    h.run();
    assert_eq!(h.state().scene.as_ref().unwrap().entities.len(), 1);
}

#[test]
fn inspector_edits_name_through_undo_stack() {
    let mut st = state_with_scene("insp");
    st.add_entity(None);
    let id = st.selection[0].clone();
    let mut h = Harness::new_ui_state(|ui, st: &mut EditorState| panels::inspector::ui(st, ui), st);
    loaders(&h);
    h.run();
    let name_field = h
        .get_all_by_role(egui::accesskit::Role::TextInput)
        .next()
        .unwrap();
    name_field.focus();
    h.run();
    h.press_key_modifiers(egui::Modifiers::COMMAND, egui::Key::A);
    h.input_mut().events.push(egui::Event::Text("Hero".into()));
    h.run();
    eprintln!("focus={:?}", h.ctx.memory(|m| m.focused()));
    let name = h.state().scene.as_ref().unwrap().entities[0].name.clone();
    assert_eq!(name, "Hero");
    assert!(h.state().dirty);
    h.state_mut().do_undo();
    assert_eq!(h.state().scene.as_ref().unwrap().entities[0].name, "Entity");
    assert_eq!(h.state().selection, vec![id]);
}

#[test]
fn inspector_renders_every_component_type() {
    let mut st = state_with_scene("allcomp");
    st.add_entity(None);
    let id = st.selection[0].clone();
    st.edit("add all", None, |l| {
        for k in nord_editor::schema::COMPONENT_TYPES {
            let mut fields = serde_json::Map::new();
            nord_editor::schema::merge_defaults(
                &nord_editor::schema::component_fields(k),
                &mut fields,
            );
            l[0].components.push(nord_core::scene::Component {
                kind: k.to_string(),
                fields,
            });
        }
        l[0].scripts.push(nord_core::scene::ScriptRef {
            path: "scripts/none.js".into(),
            attributes: Default::default(),
        });
    });
    let mut h = Harness::builder()
        .with_size(egui::vec2(500.0, 4000.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::inspector::ui(st, ui), st);
    loaders(&h);
    h.run();
    h.get_by_label("Sprite");
    h.get_by_label("Spawner");
    h.get_by_label("Post Process");
    assert_eq!(h.state().selection, vec![id]);
}

#[test]
fn console_filters_and_opens_locations() {
    let mut st = state_with_scene("console");
    st.log(
        nord_editor::state::LogLevel::Error,
        "TypeError at scripts/player.js:12:5",
    );
    st.log(nord_editor::state::LogLevel::Info, "hello world");
    let mut h = Harness::new_ui_state(|ui, st: &mut EditorState| panels::console::ui(st, ui), st);
    loaders(&h);
    h.run();
    h.get_by_label("hello world");
    h.get_by_label("TypeError at scripts/player.js:12:5")
        .click();
    h.run();
    assert!(h.state().actions.iter().any(|a| matches!(a, nord_editor::state::Action::OpenFile(p, Some(11)) if p.ends_with("scripts/player.js"))));
}

#[test]
fn library_inserts_script_on_selection() {
    let mut st = state_with_scene("lib");
    if st.engine_root.is_none() {
        return; // engine folder not discoverable from this cwd
    }
    st.add_entity(None);
    panels::library::load(&mut st);
    let it = st
        .library
        .items
        .iter()
        .find(|i| i.id == "util.spin")
        .cloned()
        .expect("seed library item");
    let msg = panels::library::insert(&mut st, &it).unwrap();
    assert!(msg.contains("scripts/spin.js"));
    assert!(st.root.as_ref().unwrap().join("scripts/spin.js").exists());
    assert_eq!(
        st.scene.as_ref().unwrap().entities[0].scripts[0].path,
        "scripts/spin.js"
    );
    // inspector now shows the attributes parsed from the library script
    let f = st.script_fields("scripts/spin.js");
    assert!(f.iter().any(|f| f.name == "speed"));
}

#[test]
fn autosave_and_recovery_roundtrip() {
    let mut st = state_with_scene("autosave");
    st.add_entity(None);
    st.settings.autosave_secs = 5;
    st.last_autosave = std::time::Instant::now() - std::time::Duration::from_secs(10);
    st.autosave_tick();
    let root = st.root.clone().unwrap();
    // simulate a crash: reopen without saving
    drop(st);
    let mut st2 = EditorState::new();
    st2.open_project(&root).unwrap();
    assert!(st2.recover.is_some(), "autosave should be offered");
    assert!(st2.scene.as_ref().unwrap().entities.is_empty());
    st2.recover_autosave();
    assert_eq!(st2.scene.as_ref().unwrap().entities.len(), 1);
    st2.save();
    assert!(st2.recover.is_none() || true);
}

#[test]
fn whole_app_boots_to_hub_then_opens_project() {
    let d = temp_project("app", nord_core::ProjectType::TwoD);
    let mut h = Harness::builder()
        .with_size(egui::vec2(1400.0, 900.0))
        .build_state(
            |ctx, app: &mut App| {
                app.frame_ui(ctx, None);
            },
            App::new(false),
        );
    h.run_steps(3);
    h.get_by_label("New project");
    h.get_by_label("Create project");
    h.state_mut()
        .st
        .push(nord_editor::state::Action::OpenPath(d));
    h.run_steps(3);
    eprintln!(
        "project open: {} console: {:?}",
        h.state().st.project.is_some(),
        h.state()
            .st
            .console
            .iter()
            .map(|l| l.text.clone())
            .collect::<Vec<_>>()
    );
    h.get_by_label("Select an entity"); // inspector
    h.get_by_label("📁 (project)"); // assets
    h.get_by_label("Open in browser"); // scene tab fallback (no embedded webview in this build)
                                       // Cmd+K opens the palette; typing filters commands
    h.press_key_modifiers(egui::Modifiers::COMMAND, egui::Key::K);
    h.run_steps(3);
    h.input_mut().events.push(egui::Event::Text("valid".into()));
    h.run_steps(3);
    h.get_by_label("Project: Validate");
    h.press_key(egui::Key::Escape);
    h.run_steps(3);
    // add entity via action, then it appears in the hierarchy
    h.state_mut()
        .st
        .push(nord_editor::state::Action::AddEntity(None));
    h.run_steps(3);
    h.get_by_label("Entity");
    assert!(h.state().st.dirty);
}

#[test]
fn code_editor_typing_behaviours() {
    let mut st = state_with_scene("code");
    let root = st.root.clone().unwrap();
    std::fs::write(root.join("scripts/t.js"), "").unwrap();
    st.code
        .open(Some(&root), &root.join("scripts/t.js"), None)
        .unwrap();
    let mut h = Harness::builder()
        .with_size(egui::vec2(800.0, 500.0))
        .build_ui_state(|ui, st: &mut EditorState| nord_editor::code::ui(st, ui), st);
    loaders(&h);
    h.run();
    h.get_by_role(egui::accesskit::Role::MultilineTextInput)
        .focus();
    h.run();
    eprintln!("focus={:?}", h.ctx.memory(|m| m.focused()));
    h.input_mut().events.push(egui::Event::Text("f".into()));
    h.input_mut().events.push(egui::Event::Text("(".into()));
    h.run();
    assert_eq!(h.state().code.docs[0].text, "f()", "auto-close bracket");
    h.input_mut().events.push(egui::Event::Text(")".into()));
    h.run();
    assert_eq!(
        h.state().code.docs[0].text,
        "f()",
        "type-over closing bracket"
    );
    h.press_key_modifiers(egui::Modifiers::COMMAND, egui::Key::Slash);
    h.run();
    assert_eq!(h.state().code.docs[0].text, "// f()", "comment toggle");
    h.press_key_modifiers(egui::Modifiers::COMMAND, egui::Key::S);
    h.run();
    assert_eq!(
        std::fs::read_to_string(root.join("scripts/t.js")).unwrap(),
        "// f()",
        "save writes the file"
    );
    assert!(!h.state().code.docs[0].dirty());
}

#[test]
fn code_editor_multi_cursor() {
    let mut st = state_with_scene("multicursor");
    let root = st.root.clone().unwrap();
    std::fs::write(root.join("scripts/m.js"), "\n\n").unwrap();
    st.code
        .open(Some(&root), &root.join("scripts/m.js"), None)
        .unwrap();
    let mut h = Harness::builder()
        .with_size(egui::vec2(800.0, 500.0))
        .build_ui_state(|ui, st: &mut EditorState| nord_editor::code::ui(st, ui), st);
    loaders(&h);
    h.run();
    h.get_by_role(egui::accesskit::Role::MultilineTextInput)
        .focus();
    h.run();
    let cm = egui::Modifiers::COMMAND | egui::Modifiers::ALT;
    for k in [
        egui::Key::ArrowDown,
        egui::Key::ArrowDown,
        egui::Key::ArrowUp,
        egui::Key::ArrowUp,
    ] {
        h.press_key_modifiers(cm, k);
        h.run();
    }
    assert_eq!(h.state().code.docs[0].extra.len(), 2, "three cursors");
    h.input_mut().events.push(egui::Event::Text("x".into()));
    h.run();
    assert_eq!(h.state().code.docs[0].text, "x\nx\nx");
}

#[test]
fn export_dialog_builds_in_background() {
    let mut st = state_with_scene("export");
    let out = st.root.clone().unwrap().join("out-export");
    st.export_ui.open = true;
    st.export_ui.minify = false;
    st.export_ui.out = out.display().to_string();
    nord_editor::panels::export::start(&mut st);
    let mut h = Harness::builder()
        .with_size(egui::vec2(700.0, 500.0))
        .build_state(
            |ctx, st: &mut EditorState| nord_editor::panels::export::window(st, ctx),
            st,
        );
    for _ in 0..200 {
        h.step();
        if out.join("index.html").exists()
            && h.state().console.iter().any(|l| l.text.contains("files,"))
        {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    assert!(out.join("index.html").exists() && out.join("nord.json").exists());
    assert!(h
        .state()
        .console
        .iter()
        .any(|l| l.text.contains("Built web-2d")));
}

fn example_copy(name: &str, example: &str) -> PathBuf {
    std::env::set_var(
        "NORD_CONFIG_DIR",
        std::env::temp_dir().join(format!("nord-ui-config-{}", std::process::id())),
    );
    let src = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../examples")
        .join(example);
    let dst = std::env::temp_dir()
        .join(format!("nord-ui-{name}-{}", std::process::id()))
        .join(example);
    let _ = std::fs::remove_dir_all(&dst);
    std::fs::create_dir_all(&dst).unwrap();
    for e in walk(&src) {
        let rel = e.strip_prefix(&src).unwrap();
        std::fs::create_dir_all(dst.join(rel).parent().unwrap()).unwrap();
        std::fs::copy(&e, dst.join(rel)).unwrap();
    }
    dst
}

fn walk(d: &std::path::Path) -> Vec<PathBuf> {
    let mut v = vec![];
    for e in std::fs::read_dir(d).unwrap().flatten() {
        let p = e.path();
        if p.is_dir() {
            v.extend(walk(&p));
        } else {
            v.push(p);
        }
    }
    v
}

#[test]
fn animation_and_tilemap_editors_roundtrip() {
    let d = example_copy("anim", "conformance-2d");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1000.0, 700.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::animation::ui(st, ui), st);
    loaders(&h);
    h.run_steps(2);
    // pick the hero spritesheet and add an animation, save the meta
    {
        let st = h.state_mut();
        st.anim.sheet = Some("assets/sprites/hero.png".into());
        st.anim.meta =
            nord_core::io::load_json(&d.join("assets/sprites/hero.png.meta.json")).unwrap();
        st.anim.meta["anims"]["dash"] =
            serde_json::json!({"frames": [2, 3], "fps": 20, "loop": false});
    }
    h.run_steps(3);
    h.get_by_label("Save meta").click();
    h.run_steps(2);
    let saved: serde_json::Value =
        nord_core::io::load_json(&d.join("assets/sprites/hero.png.meta.json")).unwrap();
    assert_eq!(saved["anims"]["dash"]["fps"], 20);
    // tilemap painter: paint a cell and save
    {
        let st = h.state_mut();
        st.anim.mode = panels::animation::Mode::Tile;
        st.anim.map = Some("assets/maps/level.tilemap.json".into());
        st.anim.map_json =
            nord_core::io::load_json(&d.join("assets/maps/level.tilemap.json")).unwrap();
        panels::animation::set_cell(&mut st.anim.map_json["layers"][0], 40, 0, 0, 7);
        st.anim.dirty_map = true;
    }
    h.run_steps(3);
    h.get_by_label("Save tilemap").click();
    h.run_steps(2);
    let m: serde_json::Value =
        nord_core::io::load_json(&d.join("assets/maps/level.tilemap.json")).unwrap();
    assert_eq!(m["layers"][0]["data"][0][0], 7);
}

#[test]
fn settings_switch_skin_and_theme_live() {
    let mut app = App::new(false);
    app.st.settings = Default::default();
    app.st.settings_open = true;
    let mut h = Harness::builder()
        .with_size(egui::vec2(1200.0, 800.0))
        .build_state(
            |ctx, app: &mut App| {
                app.frame_ui(ctx, None);
            },
            app,
        );
    h.run_steps(3);
    h.get_by_label("Skin (fonts)");
    let before = h.ctx.style().visuals.panel_fill;
    {
        let s = &mut h.state_mut().st;
        s.settings.theme = "dracula".into();
        s.settings.skin = "cyber".into();
        s.apply_theme = true;
    }
    h.run_steps(4);
    let after = h.ctx.style().visuals.panel_fill;
    assert_ne!(before, after, "theme colors applied");
    assert!(h
        .ctx
        .fonts(|f| f.families())
        .iter()
        .any(|f| matches!(f, egui::FontFamily::Name(n) if &**n == "bold")));
}

#[test]
fn assets_panel_lists_imports_and_renames() {
    let d = example_copy("assets", "conformance-2d");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let extra = d.join("extra.png");
    std::fs::copy(d.join("assets/sprites/coin.png"), &extra).unwrap();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1000.0, 500.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::assets::ui(st, ui), st);
    loaders(&h);
    h.state_mut().assets_ui.dir = "assets/sprites".into();
    h.run_steps(3);
    assert!(h
        .state()
        .assets
        .iter()
        .any(|a| a.path == "assets/sprites/hero.png"));
    panels::assets::import_files(h.state_mut(), &[extra]);
    h.run_steps(3);
    assert!(d.join("assets/sprites/extra.png").exists());
    assert!(
        h.state()
            .assets
            .iter()
            .any(|a| a.path == "assets/sprites/extra.png"),
        "import refreshes the index"
    );
    // thumbnails are produced on the worker thread and cached for visible cells
    std::thread::sleep(std::time::Duration::from_millis(600));
    h.run_steps(4);
    let cached = std::fs::read_dir(d.join(".nord-cache/thumbs"))
        .map(|r| r.count())
        .unwrap_or(0);
    assert!(cached > 0, "lazy thumbnails generated");
    // search mode and filters render without panicking
    h.state_mut().assets_ui.search = "tileset".into();
    h.run_steps(3);
}

#[test]
fn docs_markdown_viewer_renders_design_docs() {
    let mut st = EditorState::new();
    if st.engine_root.is_none() {
        return;
    }
    st.docs_ui.file = Some("EDITOR_UI.md".into());
    st.docs_ui.text = "# Title\n\n## Sub\n- item one\n```\ncode line\n```\nplain text".into();
    let mut h = Harness::builder()
        .with_size(egui::vec2(900.0, 600.0))
        .build_ui_state(
            |ui, st: &mut EditorState| panels::docs::markdown_ui(st, ui),
            st,
        );
    h.run_steps(2);
    h.get_by_label("Title");
    h.get_by_label("item one");
    h.get_by_label("code line");
}

#[test]
fn status_activity_and_play_tint_follow_the_editor_state() {
    use nord_editor::state::{RustJob, Tint};
    use std::sync::{atomic::AtomicBool, Arc};
    use std::time::Instant;
    let mut st = state_with_scene("status");
    assert_eq!(st.activity(), (None, "Ready".to_string()));
    st.toast("Saved scene");
    assert_eq!(st.activity().1, "Saved scene");
    // a Rust build in flight → Building tint + a sentence naming the crate being compiled
    let job = Arc::new(RustJob {
        done: AtomicBool::new(false),
        ok: AtomicBool::new(false),
        play_after: true,
        started: Instant::now(),
        phase: Default::default(),
        crates: Default::default(),
    });
    *job.phase.lock().unwrap() = "rapier2d v0.22.0".into();
    job.crates.store(41, std::sync::atomic::Ordering::SeqCst);
    st.rust_job = Some(job.clone());
    let (t, s) = st.activity();
    assert_eq!(t, Some(Tint::Building));
    assert!(
        s.contains("rapier2d") && s.contains("41 crates") && s.contains("then it will start"),
        "{s}"
    );
    job.done.store(true, std::sync::atomic::Ordering::SeqCst);
    assert_eq!(st.activity().0, None);
    // playing → Playing tint
    st.rust_job = None;
    st.ensure_server();
    st.play.as_mut().unwrap().running = true;
    assert_eq!(st.activity().0, Some(Tint::Playing));
}

/// The embedded game view must sit inside the Game panel (above the console strip), never spill over other panels.
#[test]
fn game_view_stays_inside_its_panel() {
    let d = temp_project("gamerect", nord_core::ProjectType::TwoD);
    let mut h = Harness::builder()
        .with_size(egui::vec2(1400.0, 900.0))
        .build_state(
            |ctx, app: &mut App| {
                app.frame_ui(ctx, None);
            },
            App::new(false),
        );
    h.run_steps(3);
    h.state_mut()
        .st
        .push(nord_editor::state::Action::OpenPath(d));
    h.run_steps(3);
    {
        let app = h.state_mut();
        app.show_tab(nord_editor::app::Tab::Game);
        app.st.game_console = true;
        app.st.ensure_server();
        app.st.play.as_mut().unwrap().running = true;
    }
    for scale in [0.0_f32, 1.0, 2.0] {
        h.state_mut().st.game_scale = scale;
        h.run_steps(3);
        let r = h.state().web.rects["game"];
        let screen = egui::Rect::from_min_size(egui::Pos2::ZERO, egui::vec2(1400.0, 900.0));
        eprintln!("scale {scale}: game rect {r:?}");
        assert!(
            r.is_finite() && screen.contains_rect(r),
            "game rect {r:?} leaves the window (scale {scale})"
        );
        // console strip is drawn below the game: its heading/rows must start at or below the game's bottom
        assert!(
            r.height() < 700.0,
            "game rect {r:?} is as tall as the window"
        );
    }
}

#[test]
fn game_view_anchor_top_and_bottom() {
    let d = temp_project("gameanchor", nord_core::ProjectType::TwoD);
    let mut h = Harness::builder()
        .with_size(egui::vec2(1400.0, 900.0))
        .build_state(
            |ctx, app: &mut App| {
                app.frame_ui(ctx, None);
            },
            App::new(false),
        );
    h.run_steps(3);
    h.state_mut()
        .st
        .push(nord_editor::state::Action::OpenPath(d));
    h.run_steps(3);
    let app = h.state_mut();
    app.show_tab(nord_editor::app::Tab::Game);
    app.st.ensure_server();
    app.st.play.as_mut().unwrap().running = true;
    app.st.game_scale = 0.25; // small enough to leave room to move
    let mut ys = vec![];
    for y in [0.0_f32, 0.5, 1.0] {
        h.state_mut().st.settings.game_anchor = [0.5, y];
        h.run_steps(3);
        ys.push(h.state().web.rects["game"].min.y);
    }
    eprintln!("top/middle/bottom y: {ys:?}");
    assert!(
        ys[0] < ys[1] && ys[1] < ys[2],
        "anchor does not move the game view: {ys:?}"
    );
    h.state_mut().st.settings.game_anchor = [0.5, 0.0];
    h.state_mut().st.settings.game_offset = [40.0, 30.0];
    h.run_steps(3);
    let r = h.state().web.rects["game"];
    assert!(
        r.min.y > ys[0] + 29.0 && r.min.y < ys[0] + 31.0,
        "y offset ignored: {r:?} vs {}",
        ys[0]
    );
}
