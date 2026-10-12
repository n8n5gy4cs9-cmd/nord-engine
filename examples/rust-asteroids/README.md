# Rust asteroids
A/D rotate, W thrust, Space fire, R restart. No physics engine: scripts do the vector maths; bullets and rocks are prefabs spawned with
`ctx.spawn_prefab_with(path, pos, json!({...}))` (JSON overrides carry the initial velocity into the script's attributes).
Run: `nord build-rust . && nord serve .`. Export: `nord export . --target web-wasm-game`.
