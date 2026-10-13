// nord.js — public API of the engine-agnostic core. Scripts do `import { NordScript } from 'nord'`.
export { NordScript, resolveAttributes } from './script.js';
export { Entity, registerComponent, components } from './entity.js';
export { Scene, applyOverrides, FIXED_DT } from './scene.js';
export { Game } from './game.js';
export { Events } from './events.js';
export { Input, attachDom, virtualJoystick } from './input.js';
export { Save, MemoryStorage } from './save.js';
export { Rng, Scheduler, Pool, ease, clamp, lerp, remap, deg2rad, rad2deg, angleDiff, vec } from './util.js';
export { Loader, safePath } from './loader.js';
export { Audio, BUSES } from './audio.js';
export { touchToStart } from './start-gate.js';
export { UI, THEME_CSS } from './ui.js';
export { createGame, makeStage, errorOverlay } from './boot.js';
export { registerCoreComponents } from './components.js';
export { SKINS, THEMES, FONTS, skin, theme, fontFaceCSS, themeVars, applyTheme, CODE_CSS } from './themes.js';
