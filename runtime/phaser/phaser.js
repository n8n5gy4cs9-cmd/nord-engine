// Phaser 2D backend for nord.js. Entity -> Phaser Container; components register themselves into the core registry.
// Units: pixels, y down. Entity z (pos[2]) is draw depth. Needs global `Phaser` (vendor/phaser/phaser.min.js).
import { Game, Loader, registerComponent, attachDom } from '../core/index.js';
import { Audio } from '../core/audio.js';
import { UI } from '../core/ui.js';

const IMG = /\.(png|jpe?g|webp|gif)$/i;
const key = (path) => path;
const deg = (v) => v * Math.PI / 180;

/** Collect every image path referenced by a scene/prefab JSON (any string field ending in an image extension). */
export function collectImages(node, out = new Set()) {
  if (typeof node === 'string') { if (IMG.test(node)) out.add(node); }
  else if (Array.isArray(node)) node.forEach((n) => collectImages(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => collectImages(n, out));
  return out;
}

class PhaserBackend {
  constructor(game, scene) { this.game = game; this.scene = scene; this.natives = new Map(); }
  get ph() { return this.scene; }
  createNative(e) {
    const c = this.scene.add.container(0, 0);
    c.setVisible(e.enabled);
    e.native = c; e.backend = this;
    this.natives.set(e, c);
    if (e.parent?.native) e.parent.native.add(c);
    this.syncTransform(e);
  }
  syncTransform(e) {
    const c = e.native; if (!c) return;
    c.setPosition(e.t.pos[0], e.t.pos[1]);
    c.setDepth(e.t.pos[2] + e.layer * 1000);
    c.setRotation(deg(e.t.rot[2]));
    c.setScale(e.t.scale[0], e.t.scale[1]);
  }
  setEnabled(e, on) { for (const d of e.all()) d.native?.setVisible(d.enabled); }
  destroyNative(e) { e.native?.destroy(); this.natives.delete(e); e.native = null; }
  step() {}
}

/** Add a display object to the entity's container, remembered on the component for cleanup. */
const attach = (comp, obj) => { comp.entity.native.add(obj); comp.obj = obj; return obj; };
const destroyObj = (comp) => { comp.obj?.destroy(); comp.obj = null; };
const tint = (o, c) => { if (c) o.setTint(Phaser.Display.Color.HexStringToColor(c).color); };

export function registerPhaserComponents(getScene) {
  registerComponent('sprite', {
    create(e, d, comp) {
      const s = attach(comp, getScene().add.image(0, 0, key(d.image)));
      if (d.frame !== undefined) s.setFrame(d.frame);
      s.setFlip(!!d.flipX, !!d.flipY); s.setAlpha(d.alpha ?? 1);
      if (d.origin) s.setOrigin(...d.origin);
      tint(s, d.tint);
    },
    destroy: destroyObj,
    set(comp, k, v) { if (k === 'image') comp.obj.setTexture(key(v)); else if (k === 'frame') comp.obj.setFrame(v); else if (k === 'alpha') comp.obj.setAlpha(v); else if (k === 'tint') tint(comp.obj, v); else if (k === 'flipX') comp.obj.setFlipX(v); },
  });

  registerComponent('animatedSprite', {
    create(e, d, comp) {
      const sc = getScene();
      const s = attach(comp, sc.add.sprite(0, 0, key(d.image)));
      s.setFlip(!!d.flipX, !!d.flipY);
      comp.play = (name, { loop } = {}) => {
        const def = comp.anims?.[name];
        if (!def) return;
        const k = `${d.image}#${name}`;
        if (!sc.anims.exists(k)) sc.anims.create({ key: k, frames: sc.anims.generateFrameNumbers(key(d.image), { frames: def.frames }), frameRate: def.fps ?? 10, repeat: (loop ?? def.loop) ? -1 : 0 });
        if (s.anims.currentAnim?.key !== k || !s.anims.isPlaying) s.play(k);
        comp.current = name;
      };
      comp.anims = e.scene.game.assetMeta?.[d.image]?.anims ?? {};
      if (d.anim) comp.play(d.anim);
    },
    destroy: destroyObj,
    set(comp, k, v) { if (k === 'anim') comp.play(v); else if (k === 'flipX') comp.obj.setFlipX(v); },
  });

  registerComponent('text', {
    create(e, d, comp) {
      const t = attach(comp, getScene().add.text(0, 0, d.text ?? '', { fontFamily: d.font ?? 'monospace', fontSize: `${d.size ?? 16}px`, color: d.color ?? '#ffffff', align: d.align ?? 'left' }));
      t.setOrigin(d.align === 'center' ? 0.5 : 0, 0);
    },
    destroy: destroyObj,
    set(comp, k, v) { if (k === 'text') comp.obj.setText(String(v)); else if (k === 'color') comp.obj.setColor(v); },
  });

  // Tilemap: Tiled-style JSON (layers[].data, tilewidth/height) + tileset spritesheet image.
  registerComponent('tilemap', {
    create(e, d, comp) {
      const sc = getScene();
      const map = sc.make.tilemap({ key: d.map });
      const ts = map.addTilesetImage(d.tilesetName ?? map.tilesets[0]?.name, key(d.tileset));
      comp.map = map; comp.layers = map.layers.map((l) => { const L = map.createLayer(l.name, ts, 0, 0); comp.entity.native.add(L); return L; });
    },
    destroy(comp) { comp.layers?.forEach((l) => l.destroy()); comp.map?.destroy(); },
  });

  registerComponent('particles', {
    create(e, d, comp) {
      const p = attach(comp, getScene().add.particles(0, 0, key(d.image), {
        lifespan: (d.lifespan ?? 1) * 1000, frequency: d.rate ? 1000 / d.rate : 100,
        speed: { min: d.speedMin ?? 20, max: d.speedMax ?? 60 }, scale: { start: d.scaleStart ?? 1, end: d.scaleEnd ?? 0 },
        alpha: { start: 1, end: 0 }, angle: { min: d.angleMin ?? 0, max: d.angleMax ?? 360 }, blendMode: d.additive ? 'ADD' : 'NORMAL',
        emitting: d.autoplay !== false,
      }));
      comp.burst = (n = 10) => p.explode(n);
    },
    destroy: destroyObj,
  });

  // Camera: follows an entity (by name) with optional lerp/zoom/bounds.
  registerComponent('camera', {
    create(e, d, comp) {
      const cam = getScene().cameras.main; comp.cam = cam;
      cam.setZoom(d.zoom ?? 1);
      if (d.bg) cam.setBackgroundColor(d.bg);
      if (d.bounds) cam.setBounds(...d.bounds);
      comp.follow = d.follow ?? null;
    },
    update(comp) {
      const t = comp.follow && comp.entity.scene.find(comp.follow);
      const { cam } = comp, lerp = comp.data.lerp ?? 0.15;
      const p = t ? t.worldPos : comp.entity.worldPos;
      cam.scrollX += (p[0] - cam.width / 2 / cam.zoom - cam.scrollX) * lerp;
      cam.scrollY += (p[1] - cam.height / 2 / cam.zoom - cam.scrollY) * lerp;
    },
    set(comp, k, v) { if (k === 'zoom') comp.cam.setZoom(v); else if (k === 'follow') comp.follow = v; },
  });
}

/**
 * Boot a Nord project on Phaser. Resolves to the nord Game once the first scene is running.
 * @param {object} project parsed nord.project.json
 * @param {object} opts { parent, fetchJSON, importScript, files }
 */
export async function boot(project, opts = {}) {
  const loader = new Loader({ files: opts.files });
  const fetchJSON = opts.fetchJSON ?? ((p) => loader.json(p));
  const game = new Game(project, { ...opts, fetchJSON });
  game.loader = loader;
  const startPath = project.startScene;
  const sceneData = await fetchJSON(startPath);
  const images = collectImages(sceneData);
  // sprite metadata sidecars (frame size, anims) are optional
  game.assetMeta = {};
  await Promise.all([...images].map(async (p) => { try { game.assetMeta[p] = await loader.json(`${p}.meta.json`); } catch { /* default image */ } }));
  const maps = new Set();
  JSON.stringify(sceneData, (k, v) => { if (k === 'map' && typeof v === 'string') maps.add(v); return v; });

  let phScene;
  const w = project.display?.width ?? 960, h = project.display?.height ?? 540;
  registerPhaserComponents(() => phScene);
  await new Promise((resolve, reject) => {
    const cfg = {
      type: Phaser.AUTO, parent: opts.parent, width: w, height: h, backgroundColor: project.display?.background ?? '#101820',
      pixelArt: project.display?.pixelArt ?? false, input: { gamepad: true },
      scale: { mode: Phaser.Scale[(project.display?.scale ?? 'fit').toUpperCase()] ?? Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: {
        preload() {
          for (const p of images) {
            const m = game.assetMeta[p];
            if (m?.type === 'spritesheet') this.load.spritesheet(key(p), loader.url(p), { frameWidth: m.frameWidth, frameHeight: m.frameHeight });
            else this.load.image(key(p), loader.url(p));
          }
          for (const m of maps) this.load.tilemapTiledJSON(m, loader.url(m));
        },
        create() {
          phScene = this;
          game.backend = new PhaserBackend(game, this);
          game.audio = new Audio(game); game.audio.attachUnlock();
          game.ui = new UI(game, { parent: opts.parent instanceof Element ? opts.parent : undefined });
          game.phaser = this;
          attachDom(game.input, this.game.canvas, window, (x, y) => [x + this.cameras.main.scrollX, y + this.cameras.main.scrollY]);
          game.loadScene(startPath).then(() => resolve(game), reject);
        },
        update(_t, ms) { game.tick(ms / 1000); },
      },
    };
    game.phaserGame = new Phaser.Game(cfg);
  });
  return game;
}
