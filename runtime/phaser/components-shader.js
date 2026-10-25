// Phaser `shadertoy` component: a Shadertoy shader (runtime/core/shadertoy.js) drawn as an image in the scene, or as a full-screen background / overlay.
//   { "type": "shadertoy", "file": "assets/shaders/plasma.glsl", "size": [320, 180], "channels": [{ "type": "texture", "src": "assets/noise.png" }] }
//   { "type": "shadertoy", "file": "assets/shaders/sky.glsl", "fullscreen": true, "layer": -100 }                    // behind everything, fixed to the camera
// data: code | file, buffers, channels, size [w, h] (world units; default 256×256, full screen when fullscreen), resolutionScale, speed, paused, transparent, fullscreen, blend, origin, uniforms, depth
import { registerComponent } from '../core/index.js';
import { createShadertoy } from '../core/shadertoy.js';

export function registerShaderComponents(backend, track) {
  const ps = backend.scene, BLEND = { normal: 0, add: 1, multiply: 2, screen: 3 };
  registerComponent('shadertoy', {
    create(e, d, comp) {
      const full = !!d.fullscreen, [w, h] = full ? [backend.width, backend.height] : d.size ?? [256, 256];
      const usesScreen = (d.channels ?? []).some((c) => c?.type === 'screen');
      comp.key = `nord-shadertoy-${e.id}`; comp.speed = d.speed ?? 1; comp.paused = !!d.paused;
      comp.ready = createShadertoy(backend.game, d, { width: w, height: h, screen: () => backend.phaser.canvas }).then((st) => {
        if (e.destroyed) { st.destroy(); return; }
        comp.st = st;
        if (ps.textures.exists(comp.key)) ps.textures.remove(comp.key);
        comp.copy = document.createElement('canvas'); comp.copy.width = st.width; comp.copy.height = st.height; comp.cx = comp.copy.getContext('2d'); // Phaser wants a 2D canvas: the WebGL one is copied into it
        comp.tex = ps.textures.addCanvas(comp.key, comp.copy);
        const img = ps.add.image(0, 0, comp.key).setDisplaySize(w, h).setOrigin(...(d.origin ?? [0.5, 0.5]));
        if (d.blend) img.setBlendMode(BLEND[d.blend] ?? 0);
        if (full) { img.setScrollFactor(0).setPosition(backend.width / 2, backend.height / 2); img.setDepth(d.depth ?? e.layer * 1000 + (e.t.pos[2] ?? 0)); }
        else e.native.add(img);
        comp.obj = track(comp, img); img.setLighting?.(false);
        comp.size = [w, h];
        comp.show = () => { comp.cx.drawImage(st.canvas, 0, 0); comp.tex.refresh(); };
        if (usesScreen) comp.off = backend.onAfterRender(() => { if (!comp.paused && comp.st) { comp.st.render(backend.game.time.delta * comp.speed); comp.show(); } });
      }).catch((err) => { backend.game.reportError(err, { constructor: { name: `shadertoy ${d.file ?? ''}` } }, 'compile'); });
    },
    update(comp, dt) {
      const st = comp.st; if (!st || comp.paused || !comp.entity.enabled || (comp.data.channels ?? []).some((c) => c?.type === 'screen')) return;
      const inp = backend.game.input, d = comp.data, [w, h] = comp.size;
      // mouse in shader pixels, origin bottom-left; world → picture when the picture is an object in the scene
      let px = inp.pointer.x, py = inp.pointer.y, sx = st.width / (d.fullscreen ? backend.width : w), sy = st.height / (d.fullscreen ? backend.height : h);
      if (!d.fullscreen) { const wp = backend.world(comp.entity); px = inp.pointer.worldX - (wp.x - w / 2); py = inp.pointer.worldY - (wp.y - h / 2); }
      st.setMouse(px * sx, st.height - py * sy, inp.pointer.down);
      st.render(dt * comp.speed); comp.show();
    },
    set(comp, k, v) {
      comp.data[k] = v;
      if (k === 'speed') comp.speed = v; else if (k === 'paused') comp.paused = !!v; else if (k === 'uniforms') for (const [n, x] of Object.entries(v)) comp.st?.setUniform(n, x);
    },
    destroy(comp) { comp.off?.(); comp.st?.destroy(); comp.obj?.destroy(); if (comp.key && ps.textures.exists(comp.key)) ps.textures.remove(comp.key); },
  });
}
