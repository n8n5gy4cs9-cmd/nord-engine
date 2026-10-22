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
    /**
     * Build a `.ui.json` tree as Babylon GUI controls — for UI that lives in the 3D world (use `entity` to float it on a mesh).
     * Menus and HUDs belong in the DOM overlay: `game.ui.load(...)`. Returns { root, get(name), dispose() }.
     */
    scene(def, { entity, offsetY = -40 } = {}) {
      const byName = new Map(), A = G.Control;
      const make = (d) => {
        let c;
        switch (d.type) {
          case 'label': c = new G.TextBlock(undefined, String(d.text ?? '').replace(/\[[^\]]*\]/g, '')); c.fontSize = d.size ?? 20; c.textHorizontalAlignment = d.align === 'center' ? A.HORIZONTAL_ALIGNMENT_CENTER : d.align === 'right' ? A.HORIZONTAL_ALIGNMENT_RIGHT : A.HORIZONTAL_ALIGNMENT_LEFT; if (!d.w) c.resizeToFit = true; break;
          case 'button': c = G.Button.CreateSimpleButton(undefined, d.text ?? ''); c.background = '#88c0d0'; c.color = '#2e3440'; c.cornerRadius = 6; c.onPointerClickObservable.add(() => game.audio.play('assets/audio/sfx/click.wav', { bus: 'ui' })); break;
          case 'bar': c = new G.Slider(); c.minimum = 0; c.maximum = 1; c.value = d.value ?? 1; c.displayThumb = false; c.isEnabled = false; c.color = d.color ?? '#a3be8c'; c.background = '#2e3440'; c.height = '14px'; break;
          case 'image': c = new G.Image(undefined, d.src); break;
          case 'vbox': case 'hbox': c = new G.StackPanel(); c.isVertical = d.type === 'vbox'; break;
          case 'spacer': c = new G.Rectangle(); c.thickness = 0; break;
          default: c = new G.Rectangle(); c.thickness = d.type === 'panel' ? 1 : 0; c.color = '#4c566a'; c.background = d.type === 'panel' ? '#3b4252cc' : 'transparent'; c.adaptHeightToChildren = !d.h; c.adaptWidthToChildren = !d.w;
        }
        if (d.w) c.width = `${d.w}px`; else if (['button', 'bar'].includes(d.type)) c.width = '160px';
        if (d.h) c.height = `${d.h}px`; else if (d.type === 'button') c.height = '44px';
        if (d.color && d.type === 'label') c.color = d.color; else if (d.type === 'label') c.color = '#eceff4';
        if (d.x) c.left = `${d.x}px`; if (d.y) c.top = `${d.y}px`;
        if (d.anchor && d.anchor !== 'fill') { const a = d.anchor; c.horizontalAlignment = a.includes('r') ? A.HORIZONTAL_ALIGNMENT_RIGHT : a.includes('l') ? A.HORIZONTAL_ALIGNMENT_LEFT : A.HORIZONTAL_ALIGNMENT_CENTER; c.verticalAlignment = a.startsWith('b') ? A.VERTICAL_ALIGNMENT_BOTTOM : a.startsWith('t') ? A.VERTICAL_ALIGNMENT_TOP : A.VERTICAL_ALIGNMENT_CENTER; }
        if (d.padding !== undefined && c.paddingTop !== undefined) c.paddingTop = c.paddingBottom = c.paddingLeft = c.paddingRight = `${Array.isArray(d.padding) ? d.padding[0] : d.padding}px`;
        if (d.gap && d.type !== 'grid') for (const k of d.children ?? []) k.__gap = d.gap;
        if (d.__gap) (d.type === 'hbox' ? (c.paddingRight = `${d.__gap}px`) : (c.paddingBottom = `${d.__gap}px`));
        if (d.visible === false) c.isVisible = false;
        if (d.on?.pressed && c.onPointerClickObservable) c.onPointerClickObservable.add(() => game.events?.emit?.(`ui:${d.on.pressed}`, d.payload));
        if (d.name) byName.set(d.name, c);
        for (const k of d.children ?? []) c.addControl(make(k));
        return c;
      };
      const root = make(def.root ?? def);
      if (entity) api.attach(root, entity, { offsetY }); else adt.addControl(root);
      return { root, get: (n) => byName.get(n) ?? null, dispose: () => api.remove(root) };
    },
    remove(c) { adt.removeControl(c); c.dispose(); },
    dispose() { adt.dispose(); },
  };
  return api;
}
