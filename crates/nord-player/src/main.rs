//! NordPlayer — runs an exported Nord web build (`Contents/Resources/game/`) in a native window. No network, no devtools.
//! Cmd+Ctrl+F fullscreen, Cmd+Q / Cmd+W quit. Build with `--features shell` (macOS CI / build.sh do).
#[cfg(not(feature = "shell"))]
fn main() {
    eprintln!("nord-player was built without the window shell; rebuild with `--features shell`");
    std::process::exit(2);
}

#[cfg(feature = "shell")]
fn main() -> anyhow::Result<()> {
    use anyhow::Context;
    use std::borrow::Cow;
    use tao::{
        dpi::LogicalSize,
        event::{ElementState, Event, WindowEvent},
        event_loop::{ControlFlow, EventLoop},
        keyboard::{KeyCode, ModifiersState},
        window::{Fullscreen, WindowBuilder},
    };

    let arg = std::env::args().nth(1);
    let game = nord_player::find_game_dir(arg.as_deref())
        .context("no game found (expected Contents/Resources/game/index.html)")?;
    let m = nord_player::read_manifest(&game);
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title(&m.name)
        .with_inner_size(LogicalSize::new(m.width as f64, m.height as f64))
        .build(&event_loop)?;
    let root = game.clone();
    let webview = wry::WebViewBuilder::new()
        .with_custom_protocol("nord".into(), move |_id, req| {
            let r = wry::http::Response::builder();
            match nord_player::serve(&root, req.uri().path()) {
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
        })
        .with_url("nord://game/index.html")
        .build(&window)?;
    let mut mods = ModifiersState::empty();
    event_loop.run(move |event, _, flow| {
        *flow = ControlFlow::Wait;
        let _keep = &webview;
        if let Event::WindowEvent { event, .. } = event {
            match event {
                WindowEvent::CloseRequested => *flow = ControlFlow::Exit,
                WindowEvent::ModifiersChanged(s) => mods = s,
                WindowEvent::KeyboardInput { event, .. }
                    if event.state == ElementState::Pressed =>
                {
                    match event.physical_key {
                        KeyCode::KeyF if mods.super_key() && mods.control_key() => {
                            let fs = window.fullscreen().is_some();
                            window.set_fullscreen((!fs).then_some(Fullscreen::Borderless(None)));
                        }
                        KeyCode::KeyQ | KeyCode::KeyW if mods.super_key() => {
                            *flow = ControlFlow::Exit
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        }
    });
}
