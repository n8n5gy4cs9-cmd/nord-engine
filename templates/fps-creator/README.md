# FPS Creator starter

A complete first-person game made with Nord's **FPS Creator** addon: levels are data (`levels/*.fpsl.json`), the runtime is `scripts/fpsc/`.

- **Edit**: open this project in the Nord editor → **FPS Level** tab (or `nord serve .` and open `/editor/fpsc/index.html`).
- **Play**: run the project — the *FPS Level* entity in `scenes/main.scene.json` loads `levels/level1.fpsl.json`. Click to start. WASD, mouse, E use, F flashlight, 1-6 weapons.
- **Add your own**: textures, sprites, 3D models, sounds and scripts go in `fpsc/` (see `fpsc/README.md` and docs/FPS_CREATOR.md).
- **Upgrade the runtime** after updating Nord: `nord fpsc init`.
