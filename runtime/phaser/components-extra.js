// Phaser components for Construct-style "plugin objects" (M10-35): tiledBackground, ninePatch, spriteFont, drawingCanvas, video.
//   { "type": "tiledBackground", "texture": "assets/sprites/bg.png", "size": [640, 360], "scroll": [30, 0], "tileScale": 1 }
//   { "type": "ninePatch", "texture": "assets/ui/panel.png", "size": [200, 80], "slice": [16, 16, 16, 16] }          // left, right, top, bottom
//   { "type": "spriteFont", "texture": "assets/ui/font.png", "frameSize": [8, 8], "chars": " !\"#…", "text": "SCORE 0", "spacing": 0 }
//   { "type": "drawingCanvas", "size": [256, 256], "color": "#00000000" }   → entity.getComponent('drawingCanvas').api.rect(x, y, w, h, '#f00')
//   { "type": "video", "src": "assets/intro.webm", "size": [320, 180], "loop": true, "autoplay": true, "muted": true }
// Event sheets: object actions Set text (spriteFont), Canvas draw rect/circle/line/clear, Video play/pause/stop/seek.
import { registerComponent } from '../core/index.js';

const hex = (c, d = 0xffffff) => (typeof c === 'string' && /^#[0-9a-f]{6}/i.test(c) ? parseInt(c.slice(1, 7), 16) : d);

export function registerExtraComponents(backend, track) {
  const ps = backend.scene;

  registerComponent('tiledBackground', {
    create(e, d, comp) {
      const [w, h] = d.size ?? [backend.width, backend.height];
      const t = ps.add.tileSprite(0, 0, w, h, backend.texKey(d.texture));
      t.setOrigin(...(d.origin ?? [0.5, 0.5]));
      t.tileScaleX = t.tileScaleY = d.tileScale ?? 1;
      if (d.tint) t.setTint(hex(d.tint));
      e.native.add(t); comp.obj = track(comp, t);
    },
    update(comp, dt) { const s = comp.data.scroll; if (s) { comp.obj.tilePositionX += s[0] * dt; comp.obj.tilePositionY += s[1] * dt; } },
    set(comp, k, v) {
      comp.data[k] = v;
      if (k === 'tileScale') comp.obj.tileScaleX = comp.obj.tileScaleY = v;
      else if (k === 'size') comp.obj.setSize(v[0], v[1]);
      else if (k === 'tint') comp.obj.setTint(hex(v));
    },
  });

  registerComponent('ninePatch', {
    create(e, d, comp) {
      const [w, h] = d.size ?? [128, 64], [l, r, t, b] = d.slice ?? [16, 16, 16, 16];
      const n = ps.add.nineslice(0, 0, backend.texKey(d.texture), d.frame ?? undefined, w, h, l, r, t, b);
      if (d.tint) n.setTint(hex(d.tint));
      e.native.add(n); comp.obj = track(comp, n);
    },
    set(comp, k, v) {
      comp.data[k] = v;
      if (k === 'size') comp.obj.setSize(v[0], v[1]);
      else if (k === 'tint') comp.obj.setTint(hex(v));
    },
  });

  registerComponent('spriteFont', {
    create(e, d, comp) {
      comp.key = backend.texKey(d.texture);
      comp.group = ps.add.container(0, 0);
      e.native.add(comp.group); track(comp, comp.group);
      comp.layout = () => {
        const [fw, fh] = comp.data.frameSize ?? [8, 8], tex = ps.textures.get(comp.key), chars = comp.data.chars ?? '';
        const cols = Math.max(1, Math.floor(tex.getSourceImage().width / fw)), sp = comp.data.spacing ?? 0;
        comp.group.removeAll(true);
        const text = String(comp.data.text ?? ''), sc = comp.data.scale ?? 1, total = text.length * (fw + sp) * sc;
        const x0 = ((comp.data.align ?? 'center') === 'left' ? 0 : (comp.data.align === 'right' ? -total : -total / 2)) + (fw * sc) / 2;
        [...text].forEach((ch, i) => {
          const idx = chars.indexOf(ch);
          if (idx < 0) return; // unknown characters are blank
          const name = `nord-sf-${idx}-${fw}x${fh}`;
          if (!tex.has(name)) tex.add(name, 0, (idx % cols) * fw, Math.floor(idx / cols) * fh, fw, fh);
          const im = ps.add.image(x0 + i * (fw + sp) * sc, 0, comp.key, name).setScale(sc);
          if (comp.data.tint) im.setTint(hex(comp.data.tint));
          comp.group.add(im);
        });
        comp.count = comp.group.length;
      };
      comp.layout();
    },
    set(comp, k, v) { comp.data[k] = v; comp.layout(); },
    destroy(comp) { comp.group?.destroy(true); },
  });

  registerComponent('drawingCanvas', {
    create(e, d, comp) {
      const [w, h] = d.size ?? [256, 256];
      comp.key = `nord-canvas-${e.id}`;
      if (ps.textures.exists(comp.key)) ps.textures.remove(comp.key);
      const dyn = ps.textures.addDynamicTexture(comp.key, w, h);
      comp.dyn = dyn;
      if (d.color && d.color !== 'transparent') dyn.fill(hex(d.color), 1);
      const img = ps.add.image(0, 0, comp.key).setOrigin(...(d.origin ?? [0.5, 0.5]));
      e.native.add(img); comp.obj = track(comp, img);
      const g = ps.make.graphics({}, false);
      const done = () => { dyn.render(); };
      comp.api = {
        width: w, height: h,
        clear: () => { dyn.clear(); done(); },
        fill: (c, a = 1) => { dyn.fill(hex(c), a); done(); },
        rect: (x, y, rw, rh, c = '#ffffff', a = 1) => { g.clear(); g.fillStyle(hex(c), a).fillRect(x, y, rw, rh); dyn.draw(g, 0, 0); done(); },
        circle: (x, y, r, c = '#ffffff', a = 1) => { g.clear(); g.fillStyle(hex(c), a).fillCircle(x, y, r); dyn.draw(g, 0, 0); done(); },
        line: (x1, y1, x2, y2, c = '#ffffff', width = 1) => { g.clear(); g.lineStyle(width, hex(c), 1).lineBetween(x1, y1, x2, y2); dyn.draw(g, 0, 0); done(); },
        stamp: (tex, x, y) => { dyn.stamp(backend.texKey(tex), undefined, x, y); done(); },
      };
      comp.g = g;
    },
    destroy(comp) { comp.g?.destroy(); if (comp.key && ps.textures.exists(comp.key)) ps.textures.remove(comp.key); },
  });

  registerComponent('video', {
    create(e, d, comp) {
      const [w, h] = d.size ?? [320, 180];
      const v = ps.add.video(0, 0);
      comp.obj = v;
      e.native.add(v); track(comp, v);
      v.loadURL(backend.game.loader.url(d.src), d.muted !== false); // muted videos may autoplay
      v.on('metadata', () => { v.setDisplaySize(w, h); });
      if (d.autoplay !== false) v.play(!!d.loop);
      else v.once('metadata', () => v.setPaused(true));
      comp.api = { play: (loop) => v.play(!!loop), pause: () => v.setPaused(true), resume: () => v.setPaused(false), stop: () => v.stop(), seek: (t) => { v.setCurrentTime(t); }, get time() { return v.getCurrentTime?.() ?? 0; }, get playing() { return v.isPlaying(); } };
    },
    destroy(comp) { comp.obj?.destroy(); },
  });
}
