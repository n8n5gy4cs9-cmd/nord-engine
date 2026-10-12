//! NordPlayer — runs an exported Nord web build (`Contents/Resources/game/`) in a native window. No network, no devtools.
//! Cmd+Ctrl+F fullscreen, Cmd+Q / Cmd+W quit. Build with `--features shell` (macOS/Windows CI + build.sh do; Linux needs webkit2gtk-4.1).
//!
//! Desktop apps (M9, ADR-020): the page talks to `nord-desktop` through `window.ipc` (see runtime/desktop/nord-desktop.js). This file is the
//! shell half: it owns the windows, native menu, tray icon and global shortcuts, and applies the `HostCommand`s the bridge queues.
#[cfg(not(feature = "shell"))]
fn main() {
    eprintln!("nord-player was built without the window shell; rebuild with `--features shell`");
    std::process::exit(2);
}

#[cfg(feature = "shell")]
mod shell {
    use anyhow::Context;
    use nord_desktop::{
        bridge::Bridge,
        caps::Permissions,
        lifecycle,
        window::{HostCommand, MenuItem, WindowOpts},
        Desktop,
    };
    use serde_json::{json, Value};
    use std::{borrow::Cow, collections::HashMap, path::PathBuf, sync::Arc};
    use tao::{
        dpi::{LogicalPosition, LogicalSize},
        event::{ElementState, Event, WindowEvent},
        event_loop::{ControlFlow, EventLoopBuilder, EventLoopWindowTarget},
        keyboard::{KeyCode, ModifiersState},
        window::{Fullscreen, Window, WindowBuilder, WindowId},
    };
    use tray_icon::menu;

    enum Ev {
        Menu(String),
        Tray(String),
        Shortcut(u32),
        /// argv from a second launch (single instance)
        Launch(Vec<String>),
        /// IPC request from a page (window id, JSON body)
        Ipc(WindowId, String),
    }

    struct Win {
        window: Window,
        view: wry::WebView,
    }

    fn game_response(
        root: &std::path::Path,
        uri_path: &str,
    ) -> wry::http::Response<Cow<'static, [u8]>> {
        let r = wry::http::Response::builder();
        match nord_player::serve(root, uri_path) {
            Some((bytes, mime)) => r
                .header("Content-Type", mime)
                .header("Access-Control-Allow-Origin", "*")
                .body(Cow::Owned(bytes))
                .unwrap(),
            None => r
                .status(404)
                .body(Cow::Borrowed(&b"not found"[..]))
                .unwrap(),
        }
    }

    type Handler = Box<dyn Fn(String)>;

    fn make_view(
        window: &Window,
        root: PathBuf,
        url: &str,
        ipc: Handler,
        drop: Box<dyn Fn(Vec<PathBuf>)>,
    ) -> anyhow::Result<wry::WebView> {
        let b = wry::WebViewBuilder::new()
            .with_custom_protocol("nord".into(), move |_id, req| {
                game_response(&root, req.uri().path())
            })
            .with_url(url)
            // desktop apps may only show their own pages; external links go through shell.openUrl
            .with_navigation_handler(|u| {
                u.starts_with("nord://")
                    || u.starts_with("about:")
                    || u.starts_with("http://nord.localhost")
                    || u.starts_with("https://nord.localhost")
            })
            .with_new_window_req_handler(|_| false)
            .with_ipc_handler(move |req| ipc(req.into_body()))
            .with_drag_drop_handler(move |e| {
                if let wry::DragDropEvent::Drop { paths, .. } = e {
                    drop(paths);
                    return true;
                }
                false
            });
        #[cfg(target_os = "linux")]
        let v = {
            use tao::platform::unix::WindowExtUnix;
            use wry::WebViewBuilderExtUnix;
            b.build_gtk(window.default_vbox().context("no gtk vbox")?)?
        };
        #[cfg(not(target_os = "linux"))]
        let v = b.build(window)?;
        Ok(v)
    }

    fn accel(s: &str) -> Option<menu::accelerator::Accelerator> {
        s.replace("Cmd+", "CmdOrCtrl+").parse().ok()
    }

    fn build_menu(items: &[MenuItem], parent: &menu::Submenu, ids: &mut Vec<String>) {
        for i in items {
            if i.separator {
                let _ = parent.append(&menu::PredefinedMenuItem::separator());
            } else if let Some(role) = &i.role {
                use menu::PredefinedMenuItem as P;
                let p = match role.as_str() {
                    "copy" => Some(P::copy(None)),
                    "cut" => Some(P::cut(None)),
                    "paste" => Some(P::paste(None)),
                    "selectAll" => Some(P::select_all(None)),
                    "undo" => Some(P::undo(None)),
                    "redo" => Some(P::redo(None)),
                    "quit" => Some(P::quit(None)),
                    "minimize" => Some(P::minimize(None)),
                    "fullscreen" => Some(P::fullscreen(None)),
                    "about" => Some(P::about(None, None)),
                    _ => None,
                };
                if let Some(p) = p {
                    let _ = parent.append(&p);
                }
            } else if !i.items.is_empty() {
                let sub = menu::Submenu::new(&i.label, i.enabled.unwrap_or(true));
                build_menu(&i.items, &sub, ids);
                let _ = parent.append(&sub);
            } else if let Some(c) = i.checked {
                let m = menu::CheckMenuItem::with_id(
                    i.id.as_str(),
                    &i.label,
                    i.enabled.unwrap_or(true),
                    c,
                    i.accelerator.as_deref().and_then(accel),
                );
                ids.push(i.id.clone());
                let _ = parent.append(&m);
            } else {
                let m = menu::MenuItem::with_id(
                    i.id.as_str(),
                    &i.label,
                    i.enabled.unwrap_or(true),
                    i.accelerator.as_deref().and_then(accel),
                );
                ids.push(i.id.clone());
                let _ = parent.append(&m);
            }
        }
    }
    /// Top level: an array of `{label, items}` → menu bar; otherwise a flat list (tray / context menu).
    fn menu_bar(items: &[MenuItem]) -> menu::Menu {
        let m = menu::Menu::new();
        for i in items {
            let sub = menu::Submenu::new(&i.label, true);
            build_menu(&i.items, &sub, &mut vec![]);
            let _ = m.append(&sub);
        }
        m
    }
    fn flat_menu(items: &[MenuItem]) -> menu::Menu {
        let m = menu::Menu::new();
        let sub = menu::Submenu::new("", true);
        build_menu(items, &sub, &mut vec![]);
        for it in sub.items() {
            match it {
                menu::MenuItemKind::MenuItem(x) => {
                    let _ = m.append(&x);
                }
                menu::MenuItemKind::Submenu(x) => {
                    let _ = m.append(&x);
                }
                menu::MenuItemKind::Predefined(x) => {
                    let _ = m.append(&x);
                }
                menu::MenuItemKind::Check(x) => {
                    let _ = m.append(&x);
                }
                _ => {}
            }
        }
        m
    }

    fn load_icon(path: &str) -> Option<tray_icon::Icon> {
        let img = image::open(path).ok()?.into_rgba8();
        let (w, h) = img.dimensions();
        tray_icon::Icon::from_rgba(img.into_raw(), w, h).ok()
    }

    pub fn run() -> anyhow::Result<()> {
        let arg = std::env::args().nth(1);
        let game = nord_player::find_game_dir(arg.as_deref())
            .context("no game found (expected Contents/Resources/game/index.html)")?;
        let m = nord_player::read_manifest(&game);
        let is_app = m.desktop.is_object();

        // ---- desktop backend (only for apps that declare `desktop`) ----
        let perms = Permissions::from_json(m.desktop.get("permissions").unwrap_or(&Value::Null))
            .unwrap_or_default();
        let bridge: Option<Arc<Bridge>> = if is_app {
            Some(Arc::new(Bridge::new(
                Desktop::new(&m.id, perms, None)?,
                &m.name,
                &m.version,
            )))
        } else {
            None
        };
        let schemes: Vec<String> = m.desktop["schemes"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|s| s.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        let argv: Vec<String> = std::env::args().collect();
        if let Some(b) = &bridge {
            *b.launch.lock().unwrap() = lifecycle::parse_launch(&argv, &schemes);
        }

        let event_loop = EventLoopBuilder::<Ev>::with_user_event().build();
        let proxy = event_loop.create_proxy();

        // single instance: a second launch hands its argv to the first and exits
        let _instance = if m.desktop["singleInstance"].as_bool().unwrap_or(false) {
            let dir = bridge
                .as_ref()
                .map(|b| b.d.roots.app_data().to_path_buf())
                .unwrap_or_else(std::env::temp_dir);
            match lifecycle::single_instance(&dir, &argv)? {
                lifecycle::Instance::Forwarded => return Ok(()),
                inst => {
                    let p = proxy.clone();
                    if let lifecycle::Instance::Primary { listener, .. } = &inst {
                        let l = listener.try_clone()?;
                        std::thread::spawn(move || loop {
                            let tmp = lifecycle::Instance::Primary {
                                listener: l.try_clone().unwrap(),
                                lock: PathBuf::new(),
                            };
                            match tmp.next_argv() {
                                Some(a) => {
                                    let _ = p.send_event(Ev::Launch(a));
                                }
                                None => std::thread::sleep(std::time::Duration::from_millis(50)),
                            }
                        });
                    }
                    Some(inst)
                }
            }
        } else {
            None
        };

        menu::MenuEvent::set_event_handler(Some({
            let p = proxy.clone();
            move |e: menu::MenuEvent| {
                let _ = p.send_event(Ev::Menu(e.id.0));
            }
        }));
        tray_icon::TrayIconEvent::set_event_handler(Some({
            let p = proxy.clone();
            move |e: tray_icon::TrayIconEvent| {
                if let tray_icon::TrayIconEvent::Click { .. } = e {
                    let _ = p.send_event(Ev::Tray("click".into()));
                }
            }
        }));
        global_hotkey::GlobalHotKeyEvent::set_event_handler(Some({
            let p = proxy.clone();
            move |e: global_hotkey::GlobalHotKeyEvent| {
                if e.state == global_hotkey::HotKeyState::Pressed {
                    let _ = p.send_event(Ev::Shortcut(e.id));
                }
            }
        }));

        let mut wins: HashMap<WindowId, (String, Win)> = HashMap::new();
        let mut main_id: Option<WindowId> = None;
        let mut mods = ModifiersState::empty();
        let mut menu: Option<menu::Menu> = None;
        let mut tray: Option<tray_icon::TrayIcon> = None;
        let mut hotkeys: Option<global_hotkey::GlobalHotKeyManager> = None;
        let mut shortcut_ids: HashMap<u32, String> = HashMap::new();
        let mut quit_guard = false;
        let mut pending_open: Vec<WindowOpts> = vec![];
        let name = m.name.clone();
        let id = m.id.clone();
        let (w0, h0) = (m.width as f64, m.height as f64);

        // create a window + webview; IPC bodies become `Ev::Ipc` and are answered on the main thread (dialogs must run there on macOS)
        let open_window = {
            let game = game.clone();
            let bridge = bridge.clone();
            let proxy = proxy.clone();
            move |target: &EventLoopWindowTarget<Ev>,
                  o: &WindowOpts,
                  title: &str,
                  size: (f64, f64),
                  pos: Option<(f64, f64)>|
                  -> anyhow::Result<(WindowId, Win)> {
                let mut wb = WindowBuilder::new()
                    .with_title(title)
                    .with_inner_size(LogicalSize::new(size.0, size.1))
                    .with_decorations(!o.frameless)
                    .with_transparent(o.transparent)
                    .with_always_on_top(o.always_on_top)
                    .with_resizable(o.resizable.unwrap_or(true));
                if let Some((x, y)) = pos {
                    wb = wb.with_position(LogicalPosition::new(x, y));
                }
                if o.fullscreen {
                    wb = wb.with_fullscreen(Some(Fullscreen::Borderless(None)));
                }
                let window = wb.build(target)?;
                let url = if o.url.is_empty() {
                    "nord://game/index.html".to_string()
                } else {
                    format!(
                        "nord://game/{}",
                        o.url
                            .trim_start_matches("nord://game/")
                            .trim_start_matches('/')
                    )
                };
                let wid = window.id();
                let (p, has_bridge) = (proxy.clone(), bridge.is_some());
                let ipc: Handler = Box::new(move |body: String| {
                    if has_bridge {
                        let _ = p.send_event(Ev::Ipc(wid, body));
                    }
                });
                let b = bridge.clone();
                let dropf: Box<dyn Fn(Vec<PathBuf>)> = Box::new(move |paths| {
                    if let Some(b) = &b {
                        paths.iter().for_each(|p| b.d.roots.add_picked(p));
                        b.emit("drop", json!({"paths": paths}));
                    }
                });
                let view = make_view(&window, game.clone(), &url, ipc, dropf)?;
                Ok((wid, Win { window, view }))
            }
        };

        let mut started = false;
        let mut window_opts_default = WindowOpts {
            id: "main".into(),
            title: name.clone(),
            ..Default::default()
        };
        window_opts_default.fullscreen = false;

        event_loop.run(move |event, target, flow| {
            *flow = ControlFlow::Wait;
            if !started {
                started = true;
                // restore saved geometry
                let saved = bridge.as_ref().and_then(|b| b.d.store.get("__window.main"));
                let (size, pos) = match saved.as_ref().and_then(|v| {
                    Some((
                        v["w"].as_f64()?,
                        v["h"].as_f64()?,
                        v["x"].as_f64()?,
                        v["y"].as_f64()?,
                    ))
                }) {
                    Some((w, h, x, y)) => {
                        let (x, y, w, h) =
                            nord_desktop::window::clamp_geometry(x, y, w, h, (3840.0, 2160.0));
                        ((w, h), Some((x, y)))
                    }
                    None => ((w0, h0), None),
                };
                match open_window(target, &window_opts_default, &name, size, pos) {
                    Ok((wid, w)) => {
                        main_id = Some(wid);
                        wins.insert(wid, ("main".into(), w));
                    }
                    Err(e) => {
                        eprintln!("nord-player: {e:#}");
                        *flow = ControlFlow::Exit;
                        return;
                    }
                }
                let _ = &id;
            }
            match event {
                Event::UserEvent(Ev::Ipc(wid, body)) => {
                    if let (Some(b), Some((_, w)), Ok(req)) = (
                        &bridge,
                        wins.get(&wid),
                        serde_json::from_str::<Value>(&body),
                    ) {
                        let reply =
                            b.call_json(req["method"].as_str().unwrap_or(""), &req["params"]);
                        let _ = w.view.evaluate_script(&format!(
                            "window.__nordDesktop&&window.__nordDesktop.reply({},{})",
                            req["id"], reply
                        ));
                    }
                }
                Event::UserEvent(Ev::Menu(id)) => {
                    if let Some(b) = &bridge {
                        b.emit("menu", json!({"id": id}));
                    }
                }
                Event::UserEvent(Ev::Tray(id)) => {
                    if let Some(b) = &bridge {
                        b.emit("tray", json!({"id": id}));
                    }
                }
                Event::UserEvent(Ev::Shortcut(h)) => {
                    if let (Some(b), Some(id)) = (&bridge, shortcut_ids.get(&h)) {
                        b.emit(&format!("shortcut:{id}"), Value::Null);
                    }
                }
                Event::UserEvent(Ev::Launch(a)) => {
                    if let Some(b) = &bridge {
                        let l = lifecycle::parse_launch(&a, &schemes);
                        l.files
                            .iter()
                            .for_each(|f| b.d.roots.add_picked(std::path::Path::new(f)));
                        b.emit("open", serde_json::to_value(&l).unwrap_or_default());
                    }
                    if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                        w.1.window.set_focus();
                    }
                }
                #[cfg(target_os = "macos")]
                Event::Opened { urls } => {
                    if let Some(b) = &bridge {
                        let l = lifecycle::parse_launch(
                            &std::iter::once("app".to_string())
                                .chain(urls.iter().map(|u| {
                                    if u.scheme() == "file" {
                                        u.to_file_path()
                                            .map(|p| p.display().to_string())
                                            .unwrap_or_default()
                                    } else {
                                        u.to_string()
                                    }
                                }))
                                .collect::<Vec<_>>(),
                            &schemes,
                        );
                        l.files
                            .iter()
                            .for_each(|f| b.d.roots.add_picked(std::path::Path::new(f)));
                        b.emit("open", serde_json::to_value(&l).unwrap_or_default());
                    }
                }
                Event::WindowEvent {
                    window_id, event, ..
                } => match event {
                    WindowEvent::CloseRequested => {
                        if Some(window_id) == main_id {
                            if quit_guard {
                                if let Some(b) = &bridge {
                                    b.emit("quit-requested", Value::Null);
                                }
                            } else {
                                *flow = ControlFlow::Exit;
                            }
                        } else {
                            wins.remove(&window_id);
                        }
                    }
                    WindowEvent::Moved(_) | WindowEvent::Resized(_)
                        if Some(window_id) == main_id =>
                    {
                        if let (Some(b), Some((_, w))) = (&bridge, wins.get(&window_id)) {
                            let s = w.window.scale_factor();
                            if let (Ok(p), sz) = (w.window.outer_position(), w.window.inner_size())
                            {
                                let (p, sz) = (p.to_logical::<f64>(s), sz.to_logical::<f64>(s));
                                let _ = b.d.store.set_raw(
                                    "__window.main",
                                    json!({"x": p.x, "y": p.y, "w": sz.width, "h": sz.height}),
                                );
                            }
                        }
                    }
                    WindowEvent::ModifiersChanged(s) => mods = s,
                    WindowEvent::KeyboardInput { event, .. }
                        if event.state == ElementState::Pressed =>
                    {
                        match event.physical_key {
                            KeyCode::KeyF if mods.super_key() && mods.control_key() => {
                                if let Some((_, w)) = wins.get(&window_id) {
                                    let fs = w.window.fullscreen().is_some();
                                    w.window.set_fullscreen(
                                        (!fs).then_some(Fullscreen::Borderless(None)),
                                    );
                                }
                            }
                            KeyCode::KeyQ | KeyCode::KeyW if mods.super_key() && !quit_guard => {
                                *flow = ControlFlow::Exit
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                },
                _ => {}
            }
            // after any event: deliver bridge output (events + host commands) to the pages / OS
            let mut flush = |wins: &mut HashMap<WindowId, (String, Win)>,
                             flow: &mut ControlFlow| {
                let Some(b) = &bridge else { return };
                for e in b.take_events() {
                    for (_, (_, w)) in wins.iter() {
                        let _ = w.view.evaluate_script(&format!(
                            "window.__nordDesktop&&window.__nordDesktop.emit({},{})",
                            e["name"], e["payload"]
                        ));
                    }
                }
                for c in b.take_host_commands() {
                    match c {
                        HostCommand::Quit => *flow = ControlFlow::Exit,
                        HostCommand::QuitGuard { enable } => quit_guard = enable,
                        HostCommand::SetTitle { title } => {
                            if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                                w.1.window.set_title(&title)
                            }
                        }
                        HostCommand::SetFullscreen { on } => {
                            if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                                w.1.window
                                    .set_fullscreen(on.then_some(Fullscreen::Borderless(None)))
                            }
                        }
                        HostCommand::SetAlwaysOnTop { on } => {
                            if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                                w.1.window.set_always_on_top(on)
                            }
                        }
                        HostCommand::OpenWindow(o) => pending_open.push(o),
                        HostCommand::CloseWindow { id } => {
                            wins.retain(|_, (wid, _)| *wid != id || wid == "main");
                        }
                        HostCommand::SetMenu { items } => {
                            let mb = menu_bar(&items);
                            #[cfg(target_os = "macos")]
                            mb.init_for_nsapp();
                            #[cfg(target_os = "windows")]
                            if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                                use tao::platform::windows::WindowExtWindows;
                                let _ = unsafe { mb.init_for_hwnd(w.1.window.hwnd() as _) };
                            }
                            #[cfg(target_os = "linux")]
                            if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                                use tao::platform::unix::WindowExtUnix;
                                if let Some(v) = w.1.window.default_vbox() {
                                    let _ =
                                        mb.init_for_gtk_window(w.1.window.gtk_window(), Some(v));
                                }
                            }
                            menu = Some(mb);
                        }
                        HostCommand::ContextMenu { items, .. } => {
                            let cm = flat_menu(&items);
                            #[cfg(target_os = "macos")]
                            {
                                use menu::ContextMenu;
                                unsafe {
                                    cm.show_context_menu_for_nsview(w_nsview(&wins, main_id), None)
                                };
                            }
                            #[cfg(not(target_os = "macos"))]
                            let _ = cm; // popup menus on Windows/Linux need the HWND/gtk window: applied through the same init_for_* path (TODO verify)
                        }
                        HostCommand::SetTray {
                            icon,
                            tooltip,
                            items,
                        } => {
                            let mut tb = tray_icon::TrayIconBuilder::new()
                                .with_tooltip(&tooltip)
                                .with_menu(Box::new(flat_menu(&items)));
                            if let Some(ic) = icon.as_deref().and_then(load_icon) {
                                tb = tb.with_icon(ic);
                            }
                            tray = tb.build().ok();
                        }
                        HostCommand::RemoveTray => tray = None,
                        HostCommand::RegisterShortcut { id, accelerator } => {
                            if hotkeys.is_none() {
                                hotkeys = global_hotkey::GlobalHotKeyManager::new().ok();
                            }
                            if let (Some(mgr), Ok(hk)) = (
                                &hotkeys,
                                accelerator
                                    .replace("Cmd+", "CmdOrCtrl+")
                                    .parse::<global_hotkey::hotkey::HotKey>(),
                            ) {
                                if mgr.register(hk).is_ok() {
                                    shortcut_ids.insert(hk.id(), id);
                                }
                            }
                        }
                        HostCommand::UnregisterShortcut { id } => {
                            shortcut_ids.retain(|_, v| *v != id);
                        }
                        HostCommand::Autostart { enable } => {
                            if let Ok(exe) = std::env::current_exe() {
                                let _ = lifecycle::set_autostart(&id, &name, &exe, enable);
                            }
                        }
                        HostCommand::Badge { text } => {
                            #[cfg(target_os = "macos")]
                            if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                                use tao::platform::macos::WindowExtMacOS;
                                w.1.window.set_badge_label(text);
                            }
                            #[cfg(not(target_os = "macos"))]
                            let _ = text; // Windows overlay icons / Unity launcher counts: not wired (documented in KNOWN_ISSUES)
                        }
                        HostCommand::Progress { value } => {
                            if let Some(w) = main_id.and_then(|i| wins.get(&i)) {
                                use tao::window::{ProgressBarState, ProgressState};
                                w.1.window.set_progress_bar(ProgressBarState {
                                    state: Some(if value.is_some() {
                                        ProgressState::Normal
                                    } else {
                                        ProgressState::None
                                    }),
                                    progress: value.map(|v| (v * 100.0) as u64),
                                    desktop_filename: None,
                                });
                            }
                        }
                    }
                }
                for o in std::mem::take(&mut pending_open) {
                    let size = (
                        if o.width > 0.0 { o.width } else { 800.0 },
                        if o.height > 0.0 { o.height } else { 600.0 },
                    );
                    let title = if o.title.is_empty() {
                        name.clone()
                    } else {
                        o.title.clone()
                    };
                    if let Ok((wid, w)) = open_window(target, &o, &title, size, None) {
                        wins.insert(wid, (o.id.clone(), w));
                    }
                }
            };

            flush(&mut wins, flow);
            if wins.is_empty() && started {
                *flow = ControlFlow::Exit;
            }
            let _ = (&menu, &tray);
        });
    }

    #[cfg(target_os = "macos")]
    fn w_nsview(wins: &HashMap<WindowId, (String, Win)>, main: Option<WindowId>) -> isize {
        use tao::platform::macos::WindowExtMacOS;
        main.and_then(|i| wins.get(&i))
            .map(|w| w.1.window.ns_view() as isize)
            .unwrap_or(0)
    }
    #[allow(dead_code)]
    fn c_dummy() -> HostCommand {
        HostCommand::Quit
    }
}

#[cfg(feature = "shell")]
fn main() -> anyhow::Result<()> {
    shell::run()
}
