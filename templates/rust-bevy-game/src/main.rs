//! A Bevy app that runs natively (`cargo run`) and in the browser (`nord export . --target web-wasm-app`).
//! Bevy is the "heavy" Rust option; for small games prefer the rust-2d-game template (macroquad + rapier).
use bevy::prelude::*;
use bevy::window::WindowPlugin;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "My Bevy game".into(),
                canvas: Some("#the_canvas_id".into()), // the <canvas> in index.html (ignored natively)
                fit_canvas_to_parent: true,
                prevent_default_event_handling: true,
                ..default()
            }),
            ..default()
        }))
        .insert_resource(ClearColor(Color::srgb_u8(0x2e, 0x34, 0x40)))
        .add_systems(Startup, setup)
        .add_systems(Update, spin)
        .run();
}

#[derive(Component)]
struct Spin;

fn setup(mut commands: Commands, mut meshes: ResMut<Assets<Mesh>>, mut mats: ResMut<Assets<StandardMaterial>>) {
    commands.spawn((Camera3d::default(), Transform::from_xyz(2.5, 2.0, 4.0).looking_at(Vec3::ZERO, Vec3::Y)));
    commands.spawn((DirectionalLight { shadows_enabled: false, ..default() }, Transform::from_xyz(3.0, 5.0, 2.0).looking_at(Vec3::ZERO, Vec3::Y)));
    commands.spawn((
        Mesh3d(meshes.add(Cuboid::new(1.0, 1.0, 1.0))),
        MeshMaterial3d(mats.add(Color::srgb_u8(0x4f, 0xa3, 0xff))),
        Spin,
    ));
}

fn spin(time: Res<Time>, mut q: Query<&mut Transform, With<Spin>>) {
    for mut t in &mut q {
        t.rotate_y(time.delta_secs());
    }
}
