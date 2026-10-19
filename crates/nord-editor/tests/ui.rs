//! Headless UI tests (egui_kittest): panels render, react to input and edit the scene through the undo system.
use egui_kittest::{kittest::Queryable, Harness};
use nord_editor::{app::App, panels, state::EditorState};
use std::path::PathBuf;

#[test]
fn toolbar_export_opens_the_export_dialog() {
    let st = state_with_scene("toolbar-export");
    let mut h = Harness::builder()
        .with_size(egui::vec2(1400.0, 100.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::toolbar::ui(st, ui), st);
    loaders(&h);
    h.run_steps(3);
    h.get_by_label("Export…").click();
    h.run_steps(2);
    assert!(
        h.state()
            .actions
            .iter()
            .any(|a| matches!(a, nord_editor::state::Action::Export)),
        "toolbar Export must dispatch the implemented export dialog"
    );
}

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
    assert!(
        st2.recover.is_none(),
        "saving removes the recovery snapshot"
    );
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
fn settings_cached_content_defaults_off_and_toggles() {
    let mut app = App::new(false);
    app.st.settings = Default::default();
    app.st.settings_open = true;
    let mut h = Harness::builder()
        .with_size(egui::vec2(1200.0, 900.0))
        .build_state(|ctx, app: &mut App| app.frame_ui(ctx, None), app);
    h.run_steps(3);
    h.get_by_label("USE CACHED CONTENT");
    assert!(!h.state().st.settings.use_cached_content);
    h.get_by_label("ON").click();
    h.run_steps(3);
    assert!(h.state().st.settings.use_cached_content);
    h.get_by_label("ON").click();
    h.run_steps(3);
    assert!(!h.state().st.settings.use_cached_content);
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
    let coin = asset_label_rect(&h, "coin.png");
    let extra = asset_label_rect(&h, "extra.png");
    assert!(
        (coin.top() - extra.top()).abs() < 0.5,
        "loaded thumbnails must stay aligned: {coin:?}, {extra:?}"
    );
    // search mode and filters render without panicking
    h.state_mut().assets_ui.search = "tileset".into();
    h.run_steps(3);
}

fn asset_label_rect(h: &Harness<'_, EditorState>, name: &str) -> egui::Rect {
    fn find(shape: &egui::Shape, name: &str) -> Option<egui::Rect> {
        match shape {
            egui::Shape::Text(t) if t.galley.job.text == name => {
                Some(egui::Rect::from_min_size(t.pos, t.galley.size()))
            }
            egui::Shape::Vec(shapes) => shapes.iter().find_map(|s| find(s, name)),
            _ => None,
        }
    }
    h.output()
        .shapes
        .iter()
        .find_map(|s| find(&s.shape, name))
        .unwrap()
}

fn asset_layout_harness(name: &str, size: egui::Vec2) -> Harness<'static, EditorState> {
    let mut st = state_with_scene(name);
    for i in 0..12 {
        std::fs::write(
            st.root.as_ref().unwrap().join(format!("assets/f{i:02}.js")),
            "",
        )
        .unwrap();
    }
    st.assets_ui.dir = "assets".into();
    let mut h = Harness::builder()
        .with_size(size)
        .build_ui_state(|ui, st: &mut EditorState| panels::assets::ui(st, ui), st);
    loaders(&h);
    h.run_steps(4);
    h
}

#[test]
fn assets_grid_aligns_tiles_and_wraps_into_rows() {
    let mut h = asset_layout_harness("asset-grid-layout", egui::vec2(720.0, 1200.0));
    for size in [48.0, 84.0, 160.0] {
        h.state_mut().assets_ui.size = size;
        h.run_steps(3);
        let first = asset_label_rect(&h, "f00.js");
        let second = asset_label_rect(&h, "f01.js");
        assert!(
            (first.top() - second.top()).abs() < 0.5,
            "tiles in the same row must align at size {size}: {first:?}, {second:?}"
        );
        let rects: Vec<_> = (0..12)
            .map(|i| asset_label_rect(&h, &format!("f{i:02}.js")))
            .collect();
        let wrapped = rects.iter().find(|r| r.top() > first.top() + 1.0).unwrap();
        assert!(
            (wrapped.center().x - first.center().x).abs() < 0.5,
            "wrapped row must restart in the first column"
        );
    }
}

#[test]
fn assets_folder_divider_can_widen_and_keep_its_width() {
    let mut h = asset_layout_harness("asset-tree-resize", egui::vec2(1000.0, 500.0));
    let panel_id = egui::Id::new("asset-tree");
    let before = egui::containers::panel::PanelState::load(&h.ctx, panel_id)
        .unwrap()
        .rect;
    let start = egui::pos2(before.right(), before.center().y);
    h.input_mut().events.push(egui::Event::PointerMoved(start));
    h.run_steps(1);
    h.input_mut().events.push(egui::Event::PointerButton {
        pos: start,
        button: egui::PointerButton::Primary,
        pressed: true,
        modifiers: Default::default(),
    });
    h.run_steps(1);
    let end = start + egui::vec2(240.0, 0.0);
    h.input_mut().events.push(egui::Event::PointerMoved(end));
    h.run_steps(3);
    h.input_mut().events.push(egui::Event::PointerButton {
        pos: end,
        button: egui::PointerButton::Primary,
        pressed: false,
        modifiers: Default::default(),
    });
    h.run_steps(4);
    let after = egui::containers::panel::PanelState::load(&h.ctx, panel_id)
        .unwrap()
        .rect;
    assert!(
        after.width() > before.width() + 200.0,
        "folder tree must retain dragged width: {before:?} -> {after:?}"
    );
    assert!(
        asset_label_rect(&h, "f00.js").left() >= after.right(),
        "files must start to the right of the widened tree"
    );
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

/// Play → Stop → Play must start again (toggle key must only stop while *running*), and the play tint lingers briefly after Stop.
#[test]
fn play_stop_play_again() {
    use nord_editor::state::{Action, Tint};
    let d = temp_project("replay", nord_core::ProjectType::TwoD);
    let mut h = Harness::builder()
        .with_size(egui::vec2(1400.0, 900.0))
        .build_state(
            |ctx, app: &mut App| {
                app.frame_ui(ctx, None);
            },
            App::new(false),
        );
    h.run_steps(3);
    h.state_mut().st.push(Action::OpenPath(d));
    h.run_steps(3);
    for round in 0..2 {
        h.press_key_modifiers(egui::Modifiers::COMMAND, egui::Key::R);
        h.run_steps(3);
        assert!(
            h.state().st.is_playing(),
            "round {round}: Cmd+R did not start the game"
        );
        h.press_key_modifiers(egui::Modifiers::COMMAND, egui::Key::R);
        h.run_steps(3);
        assert!(
            !h.state().st.is_playing(),
            "round {round}: Cmd+R did not stop the game"
        );
        assert_eq!(
            h.state().st.activity().0,
            Some(Tint::Playing),
            "tint dropped immediately on stop"
        );
    }
}

/// Position must have a visible effect in Fit mode too (x offset moves the aspect-fitted view).
#[test]
fn game_view_offset_moves_in_fit_mode() {
    let d = temp_project("gamefit", nord_core::ProjectType::TwoD);
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
    app.st.game_scale = 0.0;
    h.run_steps(3);
    let a = h.state().web.rects["game"];
    h.state_mut().st.settings.game_anchor = [0.0, 0.0];
    h.run_steps(3);
    let left = h.state().web.rects["game"];
    eprintln!("fit: centred {a:?}, left {left:?}");
    assert!(
        left.min.x < a.min.x - 1.0,
        "x anchor does nothing in Fit mode: {a:?} vs {left:?}"
    );
}

/// The y offset moves the view down by exactly that many pixels, same size.
#[test]
fn game_view_y_offset_moves_not_crops() {
    let d = temp_project("gamey", nord_core::ProjectType::TwoD);
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
    app.st.game_scale = 0.0;
    h.run_steps(3);
    let a = h.state().web.rects["game"];
    h.state_mut().st.settings.game_offset = [0.0, 40.0];
    h.run_steps(3);
    let b = h.state().web.rects["game"];
    eprintln!("y offset: {a:?} -> {b:?}");
    assert!(
        b.min.y > a.min.y + 39.0,
        "y offset did not move the view: {a:?} {b:?}"
    );
    assert!(
        (b.height() - a.height()).abs() < 0.5 && (b.width() - a.width()).abs() < 0.5,
        "view was resized, not moved: {a:?} {b:?}"
    );
}

#[test]
fn reset_settings_and_layout_restore_defaults() {
    use nord_editor::state::Action;
    let mut h = Harness::builder()
        .with_size(egui::vec2(1400.0, 900.0))
        .build_state(
            |ctx, app: &mut App| {
                app.frame_ui(ctx, None);
            },
            App::new(false),
        );
    h.run_steps(3);
    h.state_mut().st.settings.theme = "github-light".into();
    h.state_mut().st.settings.run_key = "F5".into();
    h.state_mut().st.settings.use_cached_content = true;
    h.state_mut().dock = egui_dock::DockState::new(vec![nord_editor::app::Tab::Code]);
    h.state_mut().st.push(Action::ResetSettings);
    h.run_steps(3);
    let app = h.state();
    assert_eq!(app.st.settings.theme, "graphite");
    assert_eq!(app.st.settings.run_key, "R");
    assert!(!app.st.settings.use_cached_content);
    assert!(app.dock.iter_all_tabs().count() > 4, "layout not reset");
}

#[test]
fn changing_theme_during_play_restores_the_new_theme_on_stop() {
    use nord_editor::state::Action;
    let mut app = App::new(false);
    app.st = state_with_scene("theme-play");
    let mut h = Harness::builder()
        .with_size(egui::vec2(1200.0, 800.0))
        .build_state(|ctx, app: &mut App| app.frame_ui(ctx, None), app);
    h.run_steps(3);
    let grey = h.ctx.style().visuals.panel_fill;
    assert_eq!(grey.r(), grey.g());
    assert_eq!(grey.g(), grey.b());
    h.state_mut().st.push(Action::Play);
    h.run_steps(3);
    assert_ne!(h.ctx.style().visuals.panel_fill, grey);
    h.state_mut().st.settings.theme = "dracula".into();
    h.state_mut().st.apply_theme = true;
    h.run_steps(3);
    h.state_mut().st.push(Action::Stop);
    h.run_steps(2);
    h.state_mut().st.stopping = None;
    h.run_steps(2);
    let expected = nord_editor::theme::hex(&h.state().st.themes.theme("dracula").ui.panel);
    assert_eq!(h.ctx.style().visuals.panel_fill, expected);
}

#[test]
fn hub_search_opens_examples_and_docs_without_a_project() {
    let _ = temp_project("hub-search-config", nord_core::ProjectType::TwoD);
    let mut app = App::new(false);
    app.st.settings = Default::default();
    app.st.hub.search = "noom".into();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1000.0, 700.0))
        .build_state(|ctx, app: &mut App| app.frame_ui(ctx, None), app);
    h.run_steps(3);
    h.get_by_label("noom").simulate_click();
    h.run_steps(3);
    assert!(h.state().st.project.is_some());
    h.state_mut()
        .st
        .push(nord_editor::state::Action::CloseProject);
    h.run_steps(3);
    h.get_by_label("Docs").simulate_click();
    h.run_steps(3);
    h.get_by_label("Back to projects").simulate_click();
    h.run_steps(3);
    h.get_by_label("New project");
}

#[test]
fn hub_cards_do_not_clip_the_project_form() {
    fn visible_text(shape: &egui::Shape, clip: egui::Rect, needle: &str) -> bool {
        match shape {
            egui::Shape::Text(text) if text.galley.job.text == needle => {
                clip.contains_rect(egui::Rect::from_min_size(text.pos, text.galley.size()))
            }
            egui::Shape::Vec(shapes) => shapes.iter().any(|s| visible_text(s, clip, needle)),
            _ => false,
        }
    }
    for size in [egui::vec2(900.0, 800.0), egui::vec2(1440.0, 900.0)] {
        let mut app = App::new(false);
        app.st.settings = Default::default();
        let mut h = Harness::builder()
            .with_size(size)
            .build_state(|ctx, app: &mut App| app.frame_ui(ctx, None), app);
        h.run_steps(4);
        assert!(
            h.output()
                .shapes
                .iter()
                .any(|s| visible_text(&s.shape, s.clip_rect, "Create project")),
            "project form is clipped at {size:?}"
        );
    }
}

#[test]
fn inspecting_an_example_does_not_edit_or_dirty_its_scene() {
    let d = example_copy("inspect-read-only", "noom");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let original = st.scene.clone().unwrap();
    st.select(Some(original.entities[0].id.clone()));
    let mut h = Harness::builder()
        .with_size(egui::vec2(480.0, 900.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::inspector::ui(st, ui), st);
    loaders(&h);
    h.run_steps(4);
    assert_eq!(
        h.state().scene.as_ref().unwrap().entities,
        original.entities,
        "viewing script defaults must not write them into the scene"
    );
    assert!(!h.state().dirty);
    assert!(!h.state().undo.can_undo());
}

#[test]
fn event_sheet_editor_edits_picks_undoes_and_saves() {
    let d = example_copy("events", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let rel = "events/main.events.json";
    assert_eq!(st.project_files(".events.json"), vec![rel.to_string()], "sheets outside assets/ are listed");
    assert!(st.project_files(".scene.json").contains(&"scenes/main.scene.json".to_string()));
    st.events.load(&d, rel).unwrap();
    let n0 = st.events.doc["events"].as_array().unwrap().len();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1100.0, 800.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::events::ui(st, ui), st);
    loaders(&h);
    h.run_steps(3);
    // add an event, then open the action picker on it and choose an action by search
    h.get_by_label("+ Event").click();
    h.run_steps(3);
    assert_eq!(h.state().events.doc["events"].as_array().unwrap().len(), n0 + 1);
    h.get_all_by_label("+ Add action").last().unwrap().click();
    h.run_steps(3);
    h.get_by_label("Add action");
    {
        // type into the picker search through state (the TextEdit is focused automatically)
        let st = h.state_mut();
        let cat = panels::events::catalog();
        let (g, a) = panels::events::search(cat, false, "system set var").into_iter().next().unwrap();
        let node = panels::events::ace_node(g, a, "Hero");
        let last = st.events.doc["events"].as_array().unwrap().len() - 1;
        st.events.doc["events"][last]["actions"] = serde_json::json!([node]);
    }
    h.run_steps(3);
    // undo removes everything since the last coalesced step; redo restores
    std::thread::sleep(std::time::Duration::from_millis(700));
    h.get_by_label("Undo").click();
    h.run_steps(2);
    h.get_by_label("Redo").click();
    h.run_steps(2);
    assert!(h.state().events.dirty);
    h.get_by_label("Save").click();
    h.run_steps(2);
    let saved: serde_json::Value = nord_core::io::load_json(&d.join(rel)).unwrap();
    assert_eq!(saved["events"].as_array().unwrap().len(), n0 + 1);
    assert_eq!(saved["events"][n0]["actions"][0]["object"], "System");
    // attach to scene stores settings.eventSheet and survives a scene save roundtrip
    h.state_mut().events.path = Some(rel.into());
    h.run_steps(2);
    h.get_by_label("Attach to scene").click();
    h.run_steps(2);
    let sc = h.state().scene.clone().unwrap();
    assert_eq!(sc.settings.extra["eventSheet"], rel);
}

#[test]
fn history_panel_snapshots_diffs_and_restores() {
    let d = example_copy("hist", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1100.0, 600.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::history::ui(st, ui), st);
    loaders(&h);
    h.run_steps(2);
    h.get_by_label("Snapshot now").click();
    h.run_steps(3);
    assert_eq!(nord_core::history::list(&d).len(), 1);
    let sheet = d.join("events/main.events.json");
    let orig = std::fs::read_to_string(&sheet).unwrap();
    std::fs::write(&sheet, orig.replace("\"coins\"", "\"coinz\"")).unwrap();
    h.run_steps(3);
    h.get_by_label_contains("1 changed file(s)");
    h.get_by_label("Restore this snapshot").click();
    h.run_steps(2);
    h.get_by_label("Click again to restore").click();
    h.run_steps(3);
    assert_eq!(std::fs::read_to_string(&sheet).unwrap(), orig);
    assert_eq!(nord_core::history::list(&d).len(), 2, "restore took a safety snapshot");
}

#[test]
fn project_tab_edits_properties_and_renames_an_object_safely() {
    let d = example_copy("projtab", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1100.0, 900.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::project::ui(st, ui), st);
    loaders(&h);
    h.run_steps(2);
    {
        let st = h.state_mut();
        st.project.as_mut().unwrap().display.width = 800;
        st.project_ui.from = "Slime".into();
        st.project_ui.to = "Goo".into();
    }
    h.run_steps(2);
    h.get_by_label("Apply project properties").click();
    h.run_steps(2);
    let p: serde_json::Value = nord_core::io::load_json(&d.join("nord.project.json")).unwrap();
    assert_eq!(p["display"]["width"], 800);
    h.get_by_label("Preview object rename").click();
    h.run_steps(3);
    assert!(h.state().project_ui.preview.iter().any(|f| f.ends_with("main.scene.json")), "{:?}", h.state().project_ui.preview);
    h.get_by_label_contains("Apply (take a version-history").click();
    h.run_steps(3);
    let scene = std::fs::read_to_string(d.join("scenes/main.scene.json")).unwrap();
    assert!(scene.contains("\"Goo\"") && !scene.contains("\"Slime\""));
    assert!(!nord_core::history::list(&d).is_empty(), "a snapshot was taken before the edit");
}

#[test]
fn phone_preview_starts_shows_a_window_and_stops() {
    let d = example_copy("lan", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    panels::preview::toggle(&mut st);
    assert!(st.lan.is_some(), "server started");
    let port = st.lan.as_ref().unwrap().port;
    assert!(port > 0);
    let mut h = Harness::builder()
        .with_size(egui::vec2(800.0, 700.0))
        .build_state(|ctx, st: &mut EditorState| panels::preview::window(st, ctx), st);
    h.run_steps(3);
    h.get_by_label("Stop phone preview").click();
    h.run_steps(3);
    assert!(h.state().lan.is_none());
}

#[test]
fn layout_panel_layers_arrange_and_undo() {
    let d = example_copy("layout", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let mut h = Harness::builder()
        .with_size(egui::vec2(900.0, 1000.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::layout::ui(st, ui), st);
    loaders(&h);
    h.run_steps(3);
    let n0 = nord_editor::layout::layers(h.state().scene.as_ref().unwrap()).len();
    h.get_by_label("+ Layer").click();
    h.run_steps(3);
    assert_eq!(nord_editor::layout::layers(h.state().scene.as_ref().unwrap()).len(), n0 + 1);
    // undo restores the settings together with the entities
    h.state_mut().do_undo();
    h.run_steps(2);
    assert_eq!(nord_editor::layout::layers(h.state().scene.as_ref().unwrap()).len(), n0);
    // align two objects through the panel
    let ids: Vec<String> = h.state().scene.as_ref().unwrap().entities.iter().filter(|e| e.name.starts_with("Coin")).take(3).map(|e| e.id.clone()).collect();
    assert!(ids.len() >= 3);
    h.state_mut().selection = ids.clone();
    h.run_steps(2);
    // the section is collapsed by default: open it by expanding the header
    h.get_by_label("Arrange selection").click();
    h.run_steps(2);
    h.get_by_label_contains("Left").click();
    h.run_steps(2);
    let xs: Vec<f64> = ids.iter().map(|id| h.state().scene.as_ref().unwrap().entities.iter().find(|e| &e.id == id).unwrap().transform.pos[0]).collect();
    assert!(xs.windows(2).all(|w| (w[0] - w[1]).abs() < 1e-9), "aligned: {xs:?}");
}

#[test]
fn sprite_editor_paints_saves_and_stores_origin_points_and_collision() {
    use nord_editor::panels::sprite::{Phase, Tool};
    let d = example_copy("sprite", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    st.sprite.new_image(16, 16);
    st.sprite.color = [255, 0, 0, 255];
    // rectangle tool: drag from (2,2) to (9,5), filled
    st.sprite.tool = Tool::Rect;
    st.sprite.pointer(Phase::Down, 2, 2);
    st.sprite.pointer(Phase::Move, 6, 4);
    st.sprite.pointer(Phase::Move, 9, 5);
    st.sprite.pointer(Phase::Up, 9, 5);
    let px = |s: &nord_editor::panels::sprite::SpriteUi, x: u32, y: u32| s.img.as_ref().unwrap().get_pixel(x, y).0;
    assert_eq!(px(&st.sprite, 5, 3), [255, 0, 0, 255]);
    assert_eq!(px(&st.sprite, 10, 3)[3], 0, "outside the rectangle stays transparent");
    // eraser punches a hole, undo brings it back
    st.sprite.tool = Tool::Eraser;
    st.sprite.pointer(Phase::Down, 5, 3);
    st.sprite.pointer(Phase::Up, 5, 3);
    assert_eq!(px(&st.sprite, 5, 3)[3], 0);
    assert!(st.sprite.undo());
    assert_eq!(px(&st.sprite, 5, 3), [255, 0, 0, 255]);
    // metadata: origin, image point, auto-traced collision polygon
    st.sprite.set_origin(5.5, 3.5);
    st.sprite.set_point("muzzle", 9.0, 3.0);
    st.sprite.auto_trace();
    let poly = st.sprite.meta["collision"].as_array().unwrap().clone();
    assert!(poly.len() >= 3 && poly.len() <= 8);
    st.sprite.name = "assets/sprites/painted.png".into();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1100.0, 800.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::sprite::ui(st, ui), st);
    loaders(&h);
    h.run_steps(3);
    h.get_by_label_contains("Flip H").click();
    h.run_steps(2);
    assert_eq!(h.state().sprite.img.as_ref().unwrap().get_pixel(15 - 5, 3).0, [255, 0, 0, 255], "flip H mirrors the image");
    h.get_by_label("Save").click();
    h.run_steps(3);
    let img = image::open(d.join("assets/sprites/painted.png")).unwrap().to_rgba8();
    assert_eq!((img.width(), img.height()), (16, 16));
    assert_eq!(img.get_pixel(10, 3).0, [255, 0, 0, 255]);
    let meta: serde_json::Value = nord_core::io::load_json(&d.join("assets/sprites/painted.png.meta.json")).unwrap();
    assert_eq!(meta["points"]["muzzle"], serde_json::json!([9.0, 3.0]));
    assert_eq!(meta["origin"], serde_json::json!([5.5, 3.5]));
    assert!(meta["collision"].as_array().unwrap().len() >= 3);
}

#[test]
fn tilemap_v2_ui_renders_every_brush_and_layer_controls() {
    use nord_editor::panels::animation::{Brush, Mode};
    let d = example_copy("tilev2", "conformance-2d");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let mut m = nord_editor::tilemap::new_map("assets/sprites/hero.png", 16, 16, 8, 6);
    nord_editor::tilemap::add_layer(&mut m, "top");
    nord_editor::tilemap::set_terrains(&mut m, &[nord_editor::tilemap::Terrain { name: "wall".into(), tiles: std::array::from_fn(|i| i as i64) }]);
    st.anim.mode = Mode::Tile;
    st.anim.map = Some("assets/maps/v2.tilemap.json".into());
    st.anim.map_json = m;
    let mut h = Harness::builder()
        .with_size(egui::vec2(1200.0, 900.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::animation::ui(st, ui), st);
    loaders(&h);
    h.run_steps(3);
    for b in [Brush::Single, Brush::Rect, Brush::Fill, Brush::Random, Brush::Terrain, Brush::DefineTerrain] {
        h.state_mut().anim.brush_kind = b;
        h.run_steps(2);
    }
    // layer controls
    h.get_by_label("Add layer").click();
    h.run_steps(2);
    assert_eq!(h.state().anim.map_json["layers"].as_array().unwrap().len(), 3);
    assert!(h.state().anim.dirty_map);
    h.get_by_label("Delete layer").click();
    h.run_steps(2);
    assert_eq!(h.state().anim.map_json["layers"].as_array().unwrap().len(), 2);
}

#[test]
fn particles_panel_adds_component_applies_presets_and_edits_with_undo() {
    let d = example_copy("part", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    let id = st.scene.as_ref().unwrap().entities.iter().find(|e| e.name == "Message").unwrap().id.clone();
    st.select(Some(id.clone()));
    let mut h = Harness::builder()
        .with_size(egui::vec2(1100.0, 800.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::particles::ui(st, ui), st);
    loaders(&h);
    h.run_steps(2);
    h.get_by_label_contains("Add particles component").click();
    h.run_steps(3);
    let comp = |h: &Harness<'_, EditorState>| h.state().scene.as_ref().unwrap().entities.iter().find(|e| e.id == id).unwrap().components.iter().find(|c| c.kind == "particles").cloned();
    assert_eq!(comp(&h).unwrap().fields["lifespan"], 400.0);
    // apply the "fire" preset through the combo, then edit a value through the model and check undo
    h.get_all_by_role(egui::accesskit::Role::ComboBox).next().unwrap().click();
    h.run_steps(2);
    h.get_by_label("fire").click();
    h.run_steps(3);
    assert_eq!(comp(&h).unwrap().fields["lifespan"], 700.0);
    assert_eq!(comp(&h).unwrap().fields["tintEnd"], "#7a1010");
    h.state_mut().do_undo();
    h.run_steps(2);
    assert_eq!(comp(&h).unwrap().fields["lifespan"], 400.0, "preset change is one undo step");
}

#[test]
fn timeline_panel_creates_timelines_tracks_markers_and_undoes() {
    let d = example_copy("timeline", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    st.timeline_ui.new_name = "intro".into();
    let mut h = Harness::builder()
        .with_size(egui::vec2(1200.0, 700.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::timeline::ui(st, ui), st);
    loaders(&h);
    h.run_steps(2);
    h.get_by_label("Add timeline").click();
    h.run_steps(3);
    assert_eq!(nord_editor::timeline::names(h.state().scene.as_ref().unwrap()), vec!["intro".to_string()]);
    h.state_mut().timeline_ui.new_target = "Hero".into();
    h.run_steps(2);
    h.get_by_label("+ Track").click();
    h.run_steps(3);
    // keys added with the model (the strip click does the same through the panel), then rendered with a selected key
    {
        let st = h.state_mut();
        st.edit_scene("keys", None, |s| {
            let tr = &mut nord_editor::timeline::timeline_mut(s, "intro").unwrap()["tracks"][0];
            nord_editor::timeline::add_key(tr, 0.0);
            let k = nord_editor::timeline::add_key(tr, 1.5);
            let mut keys = nord_editor::timeline::keys(tr);
            keys[k].v = 120.0;
            keys[k].ease = serde_json::json!("backOut");
            nord_editor::timeline::write_keys(tr, &keys);
        });
        st.timeline_ui.key = Some((0, 1));
    }
    h.run_steps(3);
    h.get_by_label("+ Event marker").click();
    h.run_steps(3);
    let s = h.state().scene.as_ref().unwrap();
    let t = nord_editor::timeline::get(s, "intro").unwrap();
    assert_eq!(t["tracks"][0]["target"], "Hero");
    assert_eq!(t["tracks"][0]["keys"][1]["ease"], "backOut");
    assert_eq!(t["events"].as_array().unwrap().len(), 1);
    // undo removes the marker, then the keys
    h.state_mut().do_undo();
    h.run_steps(2);
    assert_eq!(nord_editor::timeline::get(h.state().scene.as_ref().unwrap(), "intro").unwrap()["events"].as_array().unwrap().len(), 0);
}

#[test]
fn layout_views_and_drag_placement_in_the_panel() {
    let d = example_copy("layoutviews", "event-sheets");
    let mut st = EditorState::new();
    st.open_project(&d).unwrap();
    st.viewport_cam = Some([320.0, 180.0, 1.5]);
    st.layout_ui.view_name = "arena".into();
    let mut h = Harness::builder()
        .with_size(egui::vec2(900.0, 1200.0))
        .build_ui_state(|ui, st: &mut EditorState| panels::layout::ui(st, ui), st);
    loaders(&h);
    h.run_steps(2);
    h.get_by_label("Views").click();
    h.run_steps(2);
    h.get_by_label("Save current view").click();
    h.run_steps(3);
    assert_eq!(nord_editor::layout::views(h.state().scene.as_ref().unwrap()), vec![("arena".to_string(), [320.0, 180.0, 1.5])]);
    // placing is covered by the model test; the section renders with objects listed
    h.get_by_label("Object types").click();
    h.run_steps(2);
    h.get_by_label_contains("Hero");
}
