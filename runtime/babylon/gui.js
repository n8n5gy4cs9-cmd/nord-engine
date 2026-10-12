// Babylon GUI bridge: fullscreen AdvancedDynamicTexture + helpers, including labels anchored to 3D entities.
// Optional — needs vendor/babylonjs-gui/babylon.gui.min.js. For plain HUDs prefer the DOM `game.ui`.
export function createGui(game, backend) {
  const G = globalThis.BABYLON?.GUI;
  if (!G) return null;
  const adt = G.AdvancedDynamicTexture.CreateFullscreenUI('nord-gui', true, backend.scene);
  const style = (c, { color = '#eceff4', size = 20, x, y, w, h, align = 'tl' } = {}) => {
    c.color = color; if (c.fontSize !== undefined) c.fontSize = size;
    c.horizontalAlignment = align.includes('r') ? G.Control.HORIZONTAL_ALIGNMENT_RIGHT : G.Control.HORIZONTAL_ALIGNMENT_LEFT;
    c.verticalAlignment = align.includes('b') ? G.Control.VERTICAL_ALIGNMENT_BOTTOM : G.Control.VERTICAL_ALIGNMENT_TOP;
    if (x !== undefined) c.left = `${x}px`; if (y !== undefined) c.top = `${y}px`;
    if (w) c.width = `${w}px`; if (h) c.height = `${h}px`;
    return c;
  };
  const api = {
    texture: adt,
    label(text, o = {}) { const c = new G.TextBlock(undefined, text); c.resizeToFit = true; adt.addControl(style(c, o)); return c; },
    button(text, onClick, o = {}) {
      const c = G.Button.CreateSimpleButton(undefined, text); c.width = `${o.w ?? 160}px`; c.height = `${o.h ?? 44}px`; c.background = '#88c0d0'; c.color = '#2e3440'; c.cornerRadius = 6;
      c.onPointerClickObservable.add(() => { game.audio.play('assets/audio/sfx/click.wav', { bus: 'ui' }); onClick?.(); });
      adt.addControl(style(c, { ...o, color: '#2e3440' })); return c;
    },
    /** Progress bar; bar.value 0..1 */
    bar(value = 1, o = {}) {
      const c = new G.Slider(); c.minimum = 0; c.maximum = 1; c.value = value; c.isThumbClamped = true; c.displayThumb = false; c.isEnabled = false; c.color = '#a3be8c'; c.background = '#2e3440';
      c.height = '14px'; c.width = `${o.w ?? 160}px`; adt.addControl(style(c, o)); return c;
    },
    /** Anchor any control to an entity's node (label floats above it in screen space). */
    attach(control, entity, { offsetY = -40 } = {}) { adt.addControl(control); control.linkWithMesh(entity.native); control.linkOffsetY = offsetY; return control; },
    worldLabel(entity, text, o = {}) { return api.attach(api.label(text, o), entity, o); },
    remove(c) { adt.removeControl(c); c.dispose(); },
    dispose() { adt.dispose(); },
  };
  return api;
}
