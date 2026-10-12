// Phaser 2D components. Each registers via registerComponent(type, { create, update?, destroy? }).
// Visual components add their game object to the entity's container (entity.native).
import { registerComponent } from '../core/index.js';

const hex = (c, d = 0xffffff) => (typeof c === 'string' && /^#[0-9a-f]{6}/i.test(c) ? parseInt(c.slice(1, 7), 16) : d);
const BLEND = { normal: 0, add: 1, multiply: 2, screen: 3 };

/** Resolve an entity reference by name or id. */
const findEntity = (scene, ref) => (ref ? scene.findById(ref) ?? scene.find(ref) : null);

export function registerPhaserComponents(backend) {
  const { scene: ps } = backend; // Phaser.Scene
  const track = (comp, obj) => { (comp.visuals ??= []).push(obj); backend.visuals.add(obj); if (backend.lightsOn) obj.setLighting?.(true); return obj; };

  registerComponent('sprite', {
    create(e, d, comp) {
      const s = ps.add.image(0, 0, backend.texKey(d.texture), d.frame ?? undefined);
      s.setOrigin(...(d.origin ?? [0.5, 0.5])).setTint(hex(d.tint)).setFlip(!!d.flipX, !!d.flipY).setAlpha(d.alpha ?? 1);
      if (d.blend) s.setBlendMode(BLEND[d.blend] ?? 0);
      if (d.size) s.setDisplaySize(d.size[0], d.size[1]);
      e.native.add(s); comp.obj = track(comp, s);
    },
    set(comp, k, v) {
      const s = comp.obj;
      if (k === 'texture') s.setTexture(comp.entity.scene.game.backend.texKey(v));
      else if (k === 'frame') s.setFrame(v);
      else if (k === 'tint') s.setTint(hex(v));
      else if (k === 'flipX' || k === 'flipY') s.setFlip(k === 'flipX' ? v : s.flipX, k === 'flipY' ? v : s.flipY);
      else if (k === 'alpha') s.setAlpha(v);
      comp.data[k] = v;
    },
  });

  registerComponent('animatedSprite', {
    create(e, d, comp) {
      const key = backend.texKey(d.texture);
      const s = ps.add.sprite(0, 0, key, d.frame ?? 0);
      s.setOrigin(...(d.origin ?? [0.5, 0.5])).setTint(hex(d.tint)).setFlip(!!d.flipX, !!d.flipY).setAlpha(d.alpha ?? 1);
      s.anims.timeScale = d.speed ?? 1;
      e.native.add(s); comp.obj = track(comp, s);
      comp.play = (name, { restart = false } = {}) => {
        const k = `${d.texture}:${name}`;
        if (!ps.anims.exists(k)) { backend.game.warn(`[nord] animatedSprite: no animation '${name}' on ${d.texture}`); return; }
        s.anims.play({ key: k, repeat: undefined }, !restart);
        comp.current = name;
      };
      comp.stop = () => s.anims.stop();
      comp.setFlip = (x, y = false) => s.setFlip(x, y);
      if (d.anim && d.autoplay !== false) comp.play(d.anim);
    },
    set(comp, k, v) { if (k === 'anim') comp.play(v); else if (k === 'speed') comp.obj.anims.timeScale = v; else if (k === 'tint') comp.obj.setTint(hex(v)); comp.data[k] = v; },
  });

  registerComponent('text', {
    create(e, d, comp) {
      const t = ps.add.text(0, 0, d.text ?? '', {
        fontFamily: d.font ?? 'Inter, system-ui, sans-serif', fontSize: `${d.size ?? 24}px`, color: d.color ?? '#ffffff', align: d.align ?? 'left',
        stroke: d.stroke ?? undefined, strokeThickness: d.strokeThickness ?? 0, wordWrap: d.wrapWidth ? { width: d.wrapWidth } : undefined, fontStyle: d.bold ? 'bold' : '',
      });
      t.setOrigin(...(d.origin ?? [0.5, 0.5]));
      e.native.add(t); comp.obj = track(comp, t);
    },
    set(comp, k, v) { if (k === 'text') comp.obj.setText(String(v)); else if (k === 'color') comp.obj.setColor(v); comp.data[k] = v; },
  });

  registerComponent('tilemap', {
    create(e, d, comp) {
      const m = backend.maps.get(d.map);
      if (!m) { backend.game.warn(`[nord] tilemap '${d.map}' not loaded`); return; }
      const tw = m.tileWidth, th = m.tileHeight;
      const map = ps.make.tilemap(m.tiled ? { key: backend.mapKey(d.map) } : { data: m.layers[0].data, tileWidth: tw, tileHeight: th });
      const ts = map.addTilesetImage(m.tiled ? (d.tilesetName ?? map.tilesets[0]?.name) : null, backend.texKey(d.tileset), tw, th, d.margin ?? 0, d.spacing ?? 0);
      comp.layers = [];
      const layerData = m.tiled ? map.layers.map((l) => l.name) : m.layers;
      layerData.forEach((l, i) => {
        let layer;
        if (m.tiled) layer = map.createLayer(l, ts, 0, 0);
        else {
          const lm = i === 0 ? map : ps.make.tilemap({ data: l.data, tileWidth: tw, tileHeight: th });
          layer = (i === 0 ? map : lm).createLayer(0, i === 0 ? ts : lm.addTilesetImage(null, backend.texKey(d.tileset), tw, th), 0, 0);
        }
        if (!layer) return;
        // layers live in world space (not inside the entity container) so tile collision uses true coordinates; tilemaps are static
        const w = backend.world(e);
        layer.setPosition(w.x, w.y).setScale(w.sx, w.sy).setDepth(e.native.depth + i * 0.01);
        comp.layers.push(layer); track(comp, layer);
        const collide = d.collides ?? m.collides;
        if (collide?.length && (!d.collideLayer || d.collideLayer === (l.name ?? l))) {
          layer.setCollision(collide);
          if (backend.physics?.kind === 'arcade') backend.physics.tilemap(layer);
          else if (backend.physics?.kind === 'matter') ps.matter.world.convertTilemapLayer(layer);
        }
      });
      comp.map = map;
      comp.tileAt = (wx, wy, li = 0) => comp.layers[li]?.getTileAtWorldXY(wx, wy)?.index ?? -1;
      comp.setTile = (tx, ty, idx, li = 0) => comp.layers[li]?.putTileAt(idx, tx, ty);
    },
    destroy(comp) { for (const l of comp.layers ?? []) l.destroy(); comp.map?.destroy(); },
  });

  registerComponent('particles', {
    create(e, d, comp) {
      const em = ps.add.particles(0, 0, backend.texKey(d.texture), {
        lifespan: d.lifespan ?? 800,
        speed: { min: d.speed?.[0] ?? 40, max: d.speed?.[1] ?? 120 },
        angle: { min: d.angle?.[0] ?? 0, max: d.angle?.[1] ?? 360 },
        scale: { start: d.scale?.[0] ?? 1, end: d.scale?.[1] ?? 0 },
        alpha: { start: d.alpha?.[0] ?? 1, end: d.alpha?.[1] ?? 0 },
        gravityY: d.gravityY ?? 0,
        tint: d.tint ? hex(d.tint) : undefined,
        blendMode: d.blend === 'normal' ? 0 : 1,
        frequency: d.frequency ?? 60, quantity: d.quantity ?? 1,
        emitting: d.emitting !== false && !d.burst,
        follow: e.native,
      });
      em.setDepth(e.native.depth + 0.5);
      if (d.burst) em.explode(d.burst);
      comp.emitter = em;
      comp.burst = (n = d.burst ?? 10) => em.explode(n);
      comp.start = () => em.start(); comp.stop = () => em.stop();
      if (backend.lightsOn) em.setLighting?.(true);
    },
    destroy(comp) { comp.emitter?.destroy(); },
    update(comp) { comp.emitter?.setVisible(comp.entity.enabled); },
  });

  registerComponent('camera', {
    create(e, d, comp) {
      comp.cam = ps.cameras.main;
      const cam = comp.cam;
      cam.setZoom(d.zoom ?? 1);
      if (d.bounds) cam.setBounds(...d.bounds);
      if (d.deadzone) cam.setDeadzone(d.deadzone[0], d.deadzone[1]);
      if (d.background) cam.setBackgroundColor(d.background);
      backend.cameraComp = comp;
      comp.follow = (ref, lerp = d.lerp ?? 1) => {
        const t = typeof ref === 'object' && ref ? ref : findEntity(e.scene, ref);
        comp.target = t;
        if (t?.native) cam.startFollow(t.native, !!d.roundPixels, lerp, lerp); else cam.stopFollow();
      };
      comp.snapTo = (x, y) => { cam.stopFollow(); cam.centerOn(x, y); };
      // follow target resolved lazily at first update (entity may not exist yet when the camera is built)
      comp.pendingFollow = d.follow ?? null;
    },
    update(comp) {
      if (comp.pendingFollow) {
        const t = findEntity(comp.entity.scene, comp.pendingFollow);
        if (t) { comp.follow(t); comp.pendingFollow = null; }
      }
      if (!comp.target) { const w = comp.entity.worldPos; comp.cam.centerOn(w[0], w[1]); }
    },
    destroy(comp) { comp.cam.stopFollow(); if (backend.cameraComp === comp) backend.cameraComp = null; },
  });

  registerComponent('parallax', {
    create(e, d, comp) {
      const cam = ps.cameras.main, W = backend.width, H = backend.height;
      const key = backend.texKey(d.texture);
      const src = ps.textures.get(key).getSourceImage();
      const t = ps.add.tileSprite(W / 2, H / 2, W, H, key);
      t.setScrollFactor(0).setOrigin(0.5);
      if (d.fit !== false && src.height) t.tileScaleY = t.tileScaleX = H / src.height * (d.scale ?? 1);
      else t.tileScaleX = t.tileScaleY = d.scale ?? 1;
      t.setDepth(e.native.depth);
      comp.obj = t; comp.cam = cam; comp.factor = d.factor ?? [0.5, 0];
      if (backend.lightsOn) t.setLighting?.(true);
    },
    update(comp) {
      const c = comp.cam, f = comp.factor, d = comp.data;
      const sx = c.scrollX, sy = c.scrollY, tsx = comp.obj.tileScaleX || 1, tsy = comp.obj.tileScaleY || 1;
      comp.obj.tilePositionX = (sx * f[0]) / tsx + (d.offset?.[0] ?? 0);
      comp.obj.tilePositionY = (sy * f[1]) / tsy + (d.offset?.[1] ?? 0);
      comp.obj.setVisible(comp.entity.enabled);
    },
    destroy(comp) { comp.obj?.destroy(); },
  });

  registerComponent('light', {
    create(e, d, comp) {
      backend.enableLights();
      const w = e.worldPos;
      comp.light = ps.lights.addLight(w[0], w[1], d.radius ?? 160, hex(d.color), d.intensity ?? 1);
      comp.base = d.intensity ?? 1;
    },
    update(comp) {
      const w = comp.entity.worldPos, l = comp.light, d = comp.data;
      l.x = w[0] + (d.offset?.[0] ?? 0); l.y = w[1] + (d.offset?.[1] ?? 0);
      l.intensity = comp.entity.enabled ? comp.base * (d.flicker ? 1 - Math.random() * d.flicker : 1) : 0;
    },
    destroy(comp) { backend.scene.lights.removeLight(comp.light); },
  });

  // physics components create/refresh the body on the entity container
  const phys = (e) => { if (backend.physics) backend.physics.build(e); };
  registerComponent('rigidbody', { create: phys, destroy: (c) => backend.physics?.forget(c.entity) });
  registerComponent('collider', { create: phys, destroy: (c) => backend.physics?.forget(c.entity) });
  // trigger = static collider zone that only overlaps
  registerComponent('trigger', {
    create(e, d) {
      e.addComponent('collider', { shape: d.shape ?? 'box', size: d.size ?? [32, 32], radius: d.radius, offset: d.offset, trigger: true });
    },
  });
}
