use nord_runtime_wasm::macroquad::{self, prelude::*};
mod sim;
use sim::Run;

async fn game() {
    let mut run = Run::new();
    loop {
        if is_key_pressed(KeyCode::R) {
            run = Run::new();
        }
        if is_key_pressed(KeyCode::P) && !run.over {
            run.paused = !run.paused;
        }
        let axis = |positive, negative| {
            (if is_key_down(positive) { 1. } else { 0. })
                - (if is_key_down(negative) { 1. } else { 0. })
        };
        run.tick(
            get_frame_time(),
            (axis(KeyCode::D, KeyCode::A), axis(KeyCode::S, KeyCode::W)),
            is_key_pressed(KeyCode::Space),
        );
        // Fit a fixed logical arena into the window; resizing does not change the rules.
        let scale = (screen_width() / 800.).min(screen_height() / 600.);
        let (w, h) = ((800. * scale) as i32, (600. * scale) as i32);
        let camera = Camera2D {
            viewport: Some((
                ((screen_width() as i32 - w) / 2),
                ((screen_height() as i32 - h) / 2),
                w,
                h,
            )),
            target: vec2(400., 300.),
            zoom: vec2(2. / 800., 2. / 600.),
            ..Default::default()
        };
        set_camera(&camera);
        clear_background(Color::from_rgba(8, 13, 30, 255));
        for i in 0..70 {
            let x = (i * 137 % 800) as f32;
            let y = (i * 97 % 600) as f32;
            draw_circle(x, y, 1., DARKGRAY);
        }
        draw_rectangle_lines(15., 55., 770., 530., 2., DARKBLUE);
        let pulse = 1. + (get_time() as f32 * 5.).sin() * 0.15;
        draw_circle(run.core.0, run.core.1, 12. * pulse, GOLD);
        for r in &run.rocks {
            draw_poly(r.x, r.y, 6, 18., r.x, Color::from_rgba(160, 70, 130, 255));
        }
        let color = if run.shield > 0. { SKYBLUE } else { WHITE };
        draw_triangle(
            vec2(run.ship.x, run.ship.y - 15.),
            vec2(run.ship.x - 12., run.ship.y + 12.),
            vec2(run.ship.x + 12., run.ship.y + 12.),
            color,
        );
        draw_text(
            format!(
                "SALVAGE {}/10  HULL {}  TIME {:.0}  DASH {:.1}",
                run.score,
                run.lives,
                run.remaining.ceil(),
                run.dash
            ),
            20.,
            30.,
            25.,
            SKYBLUE,
        );
        draw_text(
            "WASD fly | Space dash | P pause | R restart",
            20.,
            595.,
            19.,
            GRAY,
        );
        if run.paused || run.over {
            draw_rectangle(100., 220., 600., 130., Color::from_rgba(10, 20, 40, 240));
            let title = if run.paused {
                "PAUSED - P resumes"
            } else if run.won {
                "CARGO SECURED! R plays again"
            } else {
                "SHIP LOST - R retries"
            };
            draw_text(title, 120., 285., 30., GOLD);
        }
        next_frame().await;
    }
}
fn main() {
    macroquad::Window::from_config(
        Conf {
            window_title: "Orbital Salvage".into(),
            window_width: 800,
            window_height: 600,
            ..Default::default()
        },
        game(),
    );
}
