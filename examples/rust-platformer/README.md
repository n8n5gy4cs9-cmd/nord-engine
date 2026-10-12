# Rust platformer
Same level/art as `conformance-2d`, with `Player` and `Enemy` written as Rust scripts: tilemap collision, sprite-sheet animation, camera follow,
trigger coins, stomp-or-hurt enemies, egui score label. A/D move, Space jump, R restart.
Run: `nord build-rust . && nord serve .`. Export: `nord export . --target web-wasm-game`.
