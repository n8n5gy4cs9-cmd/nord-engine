// PlayCanvas 3D components. Each entity's native is a pc.Entity; mesh visuals are child entities with a `render` component.
import { registerComponent } from '../core/index.js';
import { color } from './index.js';

export function registerPlayCanvasComponents(backend) {
  const { pc, app } = backend;
  const missing = (type) => ({ create() { backend.warnOnce(`'${type}' is not supported by the PlayCanvas tier (use web-3d / Babylon)`); } });

  // ---- materials -----------------------------------------------------------
  const buildMaterial = (d) => {
    const m = new pc.StandardMaterial();
    if (d.unlit) { m.useLighting = false; m.emissive = color(pc, d.color); }
    else {
      m.diffuse = color(pc, d.color, '#cccccc'); m.useMetalness = true; m.metalness = d.metallic ?? 0; m.gloss = 1 - (d.roughness ?? 0.8);
      if (d.emissive) m.emissive = color(pc, d.emissive);
    }
    if (d.texture) backend.texture(d.texture, (t) => { if (d.unlit) m.emissiveMap = t; else m.diffuseMap = t; m.update(); });
    if (d.normalMap) backend.texture(d.normalMap, (t) => { m.normalMap = t; m.update(); });
    if (d.uvScale) { m.diffuseMapTiling.set(d.uvScale[0], d.uvScale[1]); m.emissiveMapTiling.set(d.uvScale[0], d.uvScale[1]); }
    if ((d.alpha ?? 1) < 1) { m.opacity = d.alpha; m.blendType = pc.BLEND_NORMAL; }
    if (d.doubleSided) m.cull = pc.CULLFACE_NONE;
    m.update();
    return m;
  };
  const defaultMat = () => (backend._defMat ??= buildMaterial({ color: '#c8ccd4', roughness: 0.85 }));
  const applyMaterial = (e) => {
    const c = e.getComponent('material');
    if (c && !c.mat) c.mat = buildMaterial(c.data);
    for (const r of e.__renders ?? []) r.render.material = c?.mat ?? defaultMat();
  };

  registerComponent('material', {
    create(e, d, comp) { comp.mat = buildMaterial(d); applyMaterial(e); },
    set(comp, k, v) {
      comp.data[k] = v; const m = comp.mat;
      if (k === 'color') (comp.data.unlit ? m.emissive : m.diffuse).copy(color(pc, v));
      else if (k === 'metallic') m.metalness = v; else if (k === 'roughness') m.gloss = 1 - v;
      else if (k === 'alpha') { m.opacity = v; m.blendType = v < 1 ? pc.BLEND_NORMAL : pc.BLEND_NONE; }
      else if (k === 'emissive') m.emissive = color(pc, v);
      m.update();
    },
    destroy(comp) { comp.mat?.destroy(); },
  });

  // ---- mesh primitives -----------------------------------------------------
  // PlayCanvas primitives are unit-sized: box 1³, sphere Ø1, cylinder r.5 h1, capsule r.5 h2, cone r.5 h1, plane 1×1 on XZ, torus ring .3 tube .2.
  registerComponent('mesh', {
    create(e, d, comp) {
      const s = d.size ?? [1, 1, 1], shape = d.shape ?? 'box';
      const spec = {
        box: ['box', s], sphere: ['sphere', [s[0], s[0], s[0]]], cylinder: ['cylinder', [s[0], s[1], s[0]]],
        capsule: ['capsule', [s[0], s[1] / 2, s[0]]], torus: ['torus', [s[0] / 0.6, s[0] / 0.6, s[0] / 0.6]],
        plane: ['plane', [s[0], 1, s[1]], [90, 0, 0]], ground: ['plane', [s[0], 1, s[2] ?? s[1]]],
      }[shape];
      if (!spec) { backend.game.warn(`[nord] unknown mesh shape '${shape}'`); return; }
      const child = new pc.Entity(`${e.name}.mesh`, app);
      child.addComponent('render', { type: spec[0], castShadows: d.castShadow !== false, receiveShadows: d.receiveShadow !== false });
      child.setLocalScale(...spec[1]);
      if (spec[2]) child.setLocalEulerAngles(...spec[2]);
      child.enabled = d.visible !== false;
      e.native.addChild(child);
      comp.child = child;
      (e.__renders ??= []).push(child);
      applyMaterial(e);
    },
    set(comp, k, v) { comp.data[k] = v; if (k === 'visible') comp.child.enabled = v; },
    destroy(comp) { const e = comp.entity; e.__renders = (e.__renders ?? []).filter((m) => m !== comp.child); comp.child?.destroy(); },
  });

  registerComponent('model', {
    create(e, d, comp) {
      const asset = backend.models.get(d.path);
      if (!asset?.resource) { backend.game.warn(`[nord] model '${d.path}' not loaded`); return; }
      const root = asset.resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
      e.native.addChild(root);
      comp.root = root;
      const anims = asset.resource.animations ?? [];
      const names = anims.map((a) => a.resource.name);
      comp.animations = new Map(names.map((n, i) => [n, anims[i].resource]));
      if (anims.length) {
        root.addComponent('anim', { activate: true, speed: d.speed ?? 1 });
      }
      comp.current = null;
      comp.play = (name, { loop = true, speed = d.speed ?? 1 } = {}) => {
        const clip = comp.animations.get(name);
        if (!clip) { backend.game.warn(`[nord] model '${d.path}' has no animation '${name}' (have: ${names.join(', ') || 'none'})`); return null; }
        root.anim.assignAnimation('nord', clip, undefined, speed, loop);
        root.anim.baseLayer?.play?.('nord'); comp.current = name; return clip;
      };
      comp.stop = () => { root.anim?.baseLayer?.pause?.(); comp.current = null; };
      if (d.animation) comp.play(d.animation);
    },
    destroy(comp) { comp.root?.destroy(); },
  });

  // ---- lights, camera ----------------------------------------------------------
  registerComponent('light', {
    create(e, d, comp) {
      const kind = d.kind ?? 'directional', intensity = d.intensity ?? 1;
      if (kind === 'hemispheric') { // PlayCanvas has no hemispheric light: approximate with scene ambient
        const c = color(pc, d.color); app.scene.ambientLight = new pc.Color(c.r * intensity, c.g * intensity, c.b * intensity); comp.ambient = true; return;
      }
      e.native.addComponent('light', {
        type: kind === 'point' ? 'omni' : kind === 'spot' ? 'spot' : 'directional', color: color(pc, d.color), intensity,
        range: d.range ?? 10, outerConeAngle: d.angle ?? 45, innerConeAngle: (d.angle ?? 45) * 0.8,
        castShadows: !!d.castShadows, shadowResolution: d.shadowMapSize ?? 1024, shadowBias: 0.2, normalOffsetBias: 0.05,
      });
      if (d.direction && kind !== 'point') { const [x, y, z] = d.direction; e.native.lookAt(e.native.getPosition().x + x, e.native.getPosition().y + y, e.native.getPosition().z - z); }
    },
    update(comp) { if (comp.entity.native.light) comp.entity.native.light.enabled = comp.entity.enabled; },
    destroy(comp) { if (comp.ambient) app.scene.ambientLight = new pc.Color(0, 0, 0); else comp.entity.native?.removeComponent('light'); },
  });

  registerComponent('camera', {
    create(e, d, comp) {
      const n = e.native;
      n.addComponent('camera', { fov: d.fov ?? 60, nearClip: d.near ?? 0.1, farClip: d.far ?? 1000, clearColor: backend.clear, priority: 0 });
      comp.orbit = d.type === 'orbit';
      if (comp.orbit) {
        comp.pendingFollow = d.follow ?? null;
        comp.follow = (ref) => { comp.target = typeof ref === 'object' ? ref : (e.scene.findById(ref) ?? e.scene.find(ref)); };
      }
      comp.activate = () => { if (backend.camera) backend.camera.camera.enabled = false; backend.camera = n; n.camera.enabled = true; };
      if (d.active !== false) comp.activate(); else n.camera.enabled = false;
    },
    update(comp) {
      if (!comp.orbit) return;
      const d = comp.data, n = comp.entity.native;
      if (comp.pendingFollow) { comp.follow(comp.pendingFollow); comp.pendingFollow = null; }
      const t = comp.target?.native && !comp.target.destroyed ? comp.target.native.getPosition() : comp.target ? null : n.parent?.getPosition?.() ?? pc.Vec3.ZERO;
      if (!t) return;
      const a = (d.alpha ?? -90) * pc.math.DEG_TO_RAD, b = (d.beta ?? 60) * pc.math.DEG_TO_RAD, r = d.radius ?? 10;
      n.setPosition(t.x + r * Math.cos(a) * Math.sin(b), t.y + r * Math.cos(b), t.z - r * Math.sin(a) * Math.sin(b));
      n.lookAt(t);
    },
    destroy(comp) { if (backend.camera === comp.entity.native) backend.camera = null; comp.entity.native?.removeComponent('camera'); },
  });

  for (const t of ['skybox', 'particles', 'postProcess', 'rigidbody', 'collider', 'trigger']) registerComponent(t, missing(t));
}
