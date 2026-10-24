// Babylon 3D components. Each entity's native is a TransformNode; visuals are parented to it.
import { registerComponent } from '../core/index.js';
import { rgb } from './index.js';
import { createLight, createShadows, setLightField, createSpriteMaterial } from './lighting.js';

const D2R = Math.PI / 180;
const v3 = (B, a, d = [0, 0, 0]) => new B.Vector3(...(a ?? d));

export function registerBabylonComponents(backend) {
  const { B, scene } = backend;

  // ---- materials -----------------------------------------------------------
  const buildMaterial = (d, name) => {
    let m;
    if (d.unlit) {
      m = new B.StandardMaterial(name, scene); m.disableLighting = true; m.emissiveColor = rgb(B, d.color);
      if (d.texture) { m.emissiveTexture = backend.texture(d.texture); m.emissiveColor = B.Color3.White(); }
    } else {
      m = new B.PBRMaterial(name, scene);
      m.albedoColor = rgb(B, d.color, '#cccccc'); m.metallic = d.metallic ?? 0; m.roughness = d.roughness ?? 0.8;
      if (d.texture) m.albedoTexture = backend.texture(d.texture);
      if (d.normalMap) m.bumpTexture = backend.texture(d.normalMap, { srgb: false });
      if (d.emissive) m.emissiveColor = rgb(B, d.emissive);
      // `emissiveMap`: a picture that glows (lit windows, neon signs); the emissive colour tints it (white when not set)
      if (d.emissiveMap) { m.emissiveTexture = backend.texture(d.emissiveMap); m.emissiveColor = d.emissive ? rgb(B, d.emissive) : B.Color3.White(); }
    }
    for (const t of [m.albedoTexture, m.bumpTexture, m.emissiveTexture]) {
      if (!t) continue;
      if (d.uvScale) { t.uScale = d.uvScale[0]; t.vScale = d.uvScale[1]; }
      if (d.uvOffset) { t.uOffset = d.uvOffset[0]; t.vOffset = d.uvOffset[1]; }
    }
    if ((d.alpha ?? 1) < 1) { m.alpha = d.alpha; m.transparencyMode = B.Material.MATERIAL_ALPHABLEND; }
    if (d.doubleSided) m.backFaceCulling = false;
    return m;
  };
  const defaultMat = () => (backend._defMat ??= (() => { const m = new B.PBRMaterial('default', scene); m.albedoColor = B.Color3.FromHexString('#c8ccd4'); m.metallic = 0; m.roughness = 0.85; return m; })());
  /** (Re)apply the entity's `material` component to every mesh it owns. */
  const applyMaterial = (e) => {
    const c = e.getComponent('material');
    if (c && !c.mat) c.mat = buildMaterial(c.data, `${e.name}.mat`);
    for (const mesh of e.__meshes ?? []) { if (mesh.isAnInstance) continue; /* instances share their source mesh's material (use the model's `unique` flag for a per-entity one) */ mesh.material = c?.mat ?? mesh.__ownMat ?? defaultMat(); }
  };
  const addMesh = (e, mesh, ownMat = null) => {
    (e.__meshes ??= []).push(mesh);
    mesh.parent = e.native; mesh.metadata = { entity: e }; mesh.__ownMat = ownMat;
    applyMaterial(e);
    for (const sg of backend.shadows) sg.addShadowCaster(mesh);
    mesh.receiveShadows = e.getComponent('mesh')?.data.receiveShadow !== false;
  };

  registerComponent('material', {
    create(e, d, comp) {
      comp.mat = buildMaterial(d, `${e.name}.mat`); applyMaterial(e);
      // shared material asset (*.mat.json): its values replace the component's own once loaded
      if (d.asset) {
        backend.game.loadJSON(d.asset).then((m) => {
          if (e.destroyed) return;
          comp.data = { ...m, asset: d.asset }; comp.mat?.dispose(); comp.mat = buildMaterial(comp.data, `${e.name}.mat`); applyMaterial(e);
        }).catch((err) => backend.game.warn(`[nord] material ${d.asset}: ${err?.message ?? err}`));
      }
    },
    set(comp, k, v) {
      comp.data[k] = v; const m = comp.mat;
      if (k === 'color') (m.albedoColor ?? m.emissiveColor).copyFrom(rgb(B, v));
      else if (k === 'metallic') m.metallic = v; else if (k === 'roughness') m.roughness = v;
      else if (k === 'alpha') { m.alpha = v; m.transparencyMode = v < 1 ? B.Material.MATERIAL_ALPHABLEND : B.Material.MATERIAL_OPAQUE; }
      else if (k === 'emissive') m.emissiveColor = rgb(B, v);
    },
    destroy(comp) { comp.mat?.dispose(); },
  });

  // ---- mesh primitives -----------------------------------------------------
  registerComponent('mesh', {
    create(e, d, comp) {
      const s = d.size ?? [1, 1, 1], seg = d.segments ?? 24, MB = B.MeshBuilder, n = `${e.name}.mesh`;
      const make = {
        box: () => MB.CreateBox(n, { width: s[0], height: s[1], depth: s[2] }, scene),
        sphere: () => MB.CreateSphere(n, { diameter: s[0], segments: seg }, scene),
        cylinder: () => MB.CreateCylinder(n, { height: s[1], diameter: s[0], tessellation: seg }, scene),
        capsule: () => MB.CreateCapsule(n, { height: s[1], radius: s[0] / 2 }, scene),
        torus: () => MB.CreateTorus(n, { diameter: s[0], thickness: s[1], tessellation: seg }, scene),
        plane: () => MB.CreatePlane(n, { width: s[0], height: s[1] }, scene),
        ground: () => MB.CreateGround(n, { width: s[0], height: s[2] ?? s[1], subdivisions: d.subdivisions ?? 1 }, scene),
      }[d.shape ?? 'box'];
      if (!make) { backend.game.warn(`[nord] unknown mesh shape '${d.shape}'`); return; }
      comp.mesh = make();
      comp.mesh.__castShadow = d.castShadow !== false;
      addMesh(e, comp.mesh);
      if (d.castShadow === false) for (const sg of backend.shadows) sg.removeShadowCaster(comp.mesh);
    },
    set(comp, k, v) { comp.data[k] = v; if (k === 'visible') comp.mesh.isVisible = v; },
    destroy(comp) { const e = comp.entity; e.__meshes = (e.__meshes ?? []).filter((m) => m !== comp.mesh); comp.mesh?.dispose(); },
  });

  // ---- sprites in 3D: a flat textured plane (Unity's SpriteRenderer) -------
  // World size = image size ÷ pixels-per-unit (import setting `ppu`; 3D default 64 so the 64 px default sprite is 1 unit).
  const SPRITE_PPU = 64;
  const buildSprite = (comp) => {
    const d = comp.data, e = comp.entity;
    comp.mesh?.dispose(); comp.mat?.dispose();
    const m = B.MeshBuilder.CreatePlane(`${e.name}.sprite`, { size: 1 }, scene);
    const mat = createSpriteMaterial(B, scene, `${e.name}.spritemat`);
    mat.setSprite({ tint: rgb(B, d.tint, '#ffffff'), alpha: d.alpha ?? 1, lit: d.lit !== false });
    const meta = backend.metaOf?.(d.texture) ?? {};
    if (d.texture) {
      const nearest = meta.filter === 'nearest' || backend.game.project?.display?.pixelArt;
      const t = backend.texture(d.texture); mat.setSprite({ texture: t });
      if (nearest) t.updateSamplingMode?.(B.Texture.NEAREST_SAMPLINGMODE);
      t.wrapU = t.wrapV = meta.wrap === 'repeat' ? B.Texture.WRAP_ADDRESSMODE : B.Texture.CLAMP_ADDRESSMODE;
      const fit = () => {
        const sz = t.getSize(), k = 1 / (meta.ppu && meta.ppu !== 1 ? meta.ppu : SPRITE_PPU);
        const fw = meta.frameWidth || sz.width, fh = meta.frameHeight || sz.height;
        m.scaling.x = fw * k * (d.flipX ? -1 : 1); m.scaling.y = fh * k * (d.flipY ? -1 : 1);
      };
      if (t.isReady()) fit(); else t.onLoadObservable.addOnce(fit);
    }
    m.material = mat; comp.mesh = m; comp.mat = mat;
    (e.__meshes ??= []).push(m); m.parent = e.native; m.metadata = { entity: e }; m.__ownMat = mat; m.receiveShadows = true;
  };
  registerComponent('sprite', {
    create(e, d, comp) { buildSprite(comp); },
    set(comp, k, v) { comp.data[k] = v; if (k === 'visible') comp.mesh.isVisible = v; else buildSprite(comp); },
    destroy(comp) { const e = comp.entity; e.__meshes = (e.__meshes ?? []).filter((x) => x !== comp.mesh); comp.mesh?.dispose(); comp.mat?.dispose(); },
  });

  registerComponent('model', {
    create(e, d, comp) {
      const container = backend.models.get(d.path);
      if (!container) { backend.game.warn(`[nord] model '${d.path}' not loaded`); return; }
      const inst = container.instantiateModelsToScene((n) => `${e.name}.${n}`, false, { doNotInstantiate: true } /* real meshes, not GPU instances: Babylon does not keep an instance's light list up to date, so lights toggled or culled would be wrong for it */);
      comp.inst = inst;
      // import settings from <model>.meta.json: uniform `scale`
      backend.game.loader.meta?.(d.path).then((m) => {
        if (m?.scale && m.scale !== 1) for (const r of inst.rootNodes) r.scaling.scaleInPlace(m.scale);
        // `materials`: { <material name inside the model>: <*.mat.json> } — remap imported materials to project material assets
        for (const [slot, asset] of Object.entries(m?.materials ?? {})) {
          const meshes = (e.__meshes ?? []).filter((x) => x.__ownMat?.name === slot);
          if (!meshes.length || !asset) continue;
          backend.game.loadJSON(asset).then((mj) => {
            if (e.destroyed) return;
            const mat = buildMaterial({ ...mj, asset }, `${e.name}.${slot}`);
            for (const x of meshes) { x.__ownMat = mat; if (!e.getComponent('material')) (x.isAnInstance ? x.sourceMesh : x).material = mat; }
          }).catch((err) => backend.game.warn(`[nord] model material ${asset}: ${err?.message ?? err}`));
        }
      }).catch(() => {});
      for (const r of inst.rootNodes) { r.parent = e.native; for (const m of [r, ...r.getChildMeshes()]) if (m.getTotalVertices) { (e.__meshes ??= []).push(m); m.__ownMat = m.material; m.metadata = { entity: e }; if (d.shadow !== false) for (const sg of backend.shadows) sg.addShadowCaster(m); (m.isAnInstance ? m.sourceMesh : m).receiveShadows = true; /* instances read it from their source mesh */ } }
      const groups = new Map(inst.animationGroups.map((g) => [g.name.startsWith(`${e.name}.`) ? g.name.slice(e.name.length + 1) : g.name, g]));
      comp.animations = groups;
      for (const g of groups.values()) g.stop();
      comp.current = null;
      comp.play = (name, { loop = true, speed = d.speed ?? 1 } = {}) => {
        const g = groups.get(name);
        if (!g) { backend.game.warn(`[nord] model '${d.path}' has no animation '${name}' (have: ${[...groups.keys()].join(', ') || 'none'})`); return null; }
        if (comp.current && comp.current !== g) comp.current.stop();
        if (g.isPlaying) { g.speedRatio = speed; g.loopAnimation = loop; } else g.start(loop, speed); // start() on a running group would ignore the new speed
        comp.current = g; return g;
      };
      comp.stop = () => { comp.current?.stop(); comp.current = null; };
      if (d.animation) comp.play(d.animation);
      applyMaterial(e);
    },
    destroy(comp) { comp.inst?.dispose?.(); for (const g of comp.inst?.animationGroups ?? []) g.dispose(); },
  });

  // ---- lights, camera, sky ---------------------------------------------------
  registerComponent('light', {
    create(e, d, comp) {
      const l = createLight(B, scene, `${e.name}.light`, d, e.native);
      comp.light = l; comp.base = d.intensity ?? 1;
      if (d.castShadows && d.kind !== 'hemispheric') {
        const sg = createShadows(B, l, d.shadowMapSize ?? backend.quality.shadowResolution, backend.quality, d);
        if (sg) { backend.shadows.add(sg); comp.sg = sg; for (const x of scene.meshes) if (x.metadata?.entity && x.__castShadow !== false) sg.addShadowCaster(x); }
      }
    },
    update(comp) {
      const l = comp.light, d = comp.data;
      l.setEnabled(comp.entity.enabled);
      if (d.flicker) l.intensity = comp.base * (1 - Math.random() * d.flicker); // 0..1 random brightness loss, like 2D lights
    },
    set(comp, k, v) { comp.data[k] = v; if (k === 'intensity') comp.base = v ?? 1; if (k !== 'intensity' || !comp.data.flicker) setLightField(B, comp.light, k, v); },
    destroy(comp) { backend.shadows.delete(comp.sg); comp.sg?.dispose(); comp.light.dispose(); },
  });

  registerComponent('camera', {
    create(e, d, comp) {
      const n = `${e.name}.cam`, fov = (d.fov ?? 60) * D2R;
      let cam;
      if (d.type === 'orbit') {
        cam = new B.ArcRotateCamera(n, (d.alpha ?? -90) * D2R, (d.beta ?? 60) * D2R, d.radius ?? 10, B.Vector3.Zero(), scene);
        cam.lowerRadiusLimit = d.minRadius ?? 1; cam.upperRadiusLimit = d.maxRadius ?? 100;
        if (d.userControl) cam.attachControl(backend.canvas, true);
        comp.orbit = true; comp.pendingFollow = d.follow ?? null;
        comp.follow = (ref) => { comp.target = typeof ref === 'object' ? ref : (e.scene.findById(ref) ?? e.scene.find(ref)); };
      } else {
        cam = new B.FreeCamera(n, B.Vector3.Zero(), scene);
        cam.parent = e.native; cam.rotationQuaternion = null; cam.minZ = d.near ?? 0.1;
        if (d.userControl) { cam.attachControl(backend.canvas, true); cam.keysUp = [87]; cam.keysDown = [83]; cam.keysLeft = [65]; cam.keysRight = [68]; }
      }
      cam.fov = fov; cam.minZ = d.near ?? 0.1; cam.maxZ = d.far ?? 1000;
      comp.camera = cam;
      if (d.active !== false) scene.activeCamera = cam;
      comp.activate = () => { scene.activeCamera = cam; };
    },
    update(comp) {
      if (!comp.orbit) return;
      if (comp.pendingFollow) { comp.follow(comp.pendingFollow); comp.pendingFollow = null; }
      if (comp.target?.native && !comp.target.destroyed) comp.camera.setTarget(comp.target.native.getAbsolutePosition().clone()); else if (!comp.target) comp.camera.setTarget(comp.entity.native.getAbsolutePosition().clone());
    },
    destroy(comp) { comp.camera.dispose(); },
  });

  const makeSky = (dir, comp) => {
    const f = (n) => backend.game.loader.url(`${dir}/${n}.png`);
    const tex = new B.CubeTexture('', scene, null, false, [f('px'), f('py'), f('pz'), f('nx'), f('ny'), f('nz')]);
    tex.coordinatesMode = B.Texture.SKYBOX_MODE;
    const box = B.MeshBuilder.CreateBox('sky', { size: 900 }, scene);
    const m = new B.StandardMaterial('sky', scene);
    m.backFaceCulling = false; m.reflectionTexture = tex; m.disableLighting = true; m.diffuseColor = m.specularColor = B.Color3.Black();
    box.material = m; box.infiniteDistance = true; box.isPickable = false;
    comp.sky = box; comp.tex = tex;
  };
  registerComponent('skybox', {
    create(e, d, comp) { makeSky(d.path ?? 'assets/skybox/day', comp); },
    destroy(comp) { comp.sky?.dispose(); comp.tex?.dispose(); },
  });

  // ---- particles ---------------------------------------------------------------
  registerComponent('particles', {
    create(e, d, comp) {
      const ps = new B.ParticleSystem(`${e.name}.fx`, d.capacity ?? 500, scene);
      ps.particleTexture = backend.texture(d.texture ?? 'assets/particles/soft.png');
      ps.emitter = e.native;
      ps.minEmitBox = v3(B, d.emitMin, [-0.1, 0, -0.1]); ps.maxEmitBox = v3(B, d.emitMax, [0.1, 0, 0.1]);
      ps.direction1 = v3(B, d.direction1, [-0.5, 1, -0.5]); ps.direction2 = v3(B, d.direction2, [0.5, 1, 0.5]);
      ps.minLifeTime = d.lifetime?.[0] ?? 0.5; ps.maxLifeTime = d.lifetime?.[1] ?? 1.5;
      ps.minSize = d.size?.[0] ?? 0.1; ps.maxSize = d.size?.[1] ?? 0.3;
      ps.minEmitPower = d.speed?.[0] ?? 1; ps.maxEmitPower = d.speed?.[1] ?? 3;
      ps.emitRate = d.rate ?? 50;
      ps.gravity = v3(B, d.gravity, [0, 0, 0]);
      const c1 = rgb(B, d.color1, '#ffffff'), c2 = rgb(B, d.color2, d.color1 ?? '#ffffff');
      ps.color1 = new B.Color4(c1.r, c1.g, c1.b, 1); ps.color2 = new B.Color4(c2.r, c2.g, c2.b, 1); ps.colorDead = new B.Color4(c2.r, c2.g, c2.b, 0);
      ps.blendMode = d.blend === 'normal' ? B.ParticleSystem.BLENDMODE_STANDARD : B.ParticleSystem.BLENDMODE_ONEONE;
      if (d.burst) { ps.manualEmitCount = d.burst; } else if (d.emitting !== false) ps.start(); else ps.stop();
      if (d.burst) ps.start();
      comp.ps = ps;
      comp.burst = (n = d.burst ?? 20) => { ps.manualEmitCount = n; ps.start(); };
      comp.start = () => ps.start(); comp.stop = () => ps.stop();
    },
    destroy(comp) { comp.ps?.dispose(); },
  });

  // ---- post-processing (DefaultRenderingPipeline on the active camera; created on first update so the camera exists) -------
  const applyPost = (p, d) => {
    p.bloomEnabled = !!d.bloom; if (d.bloom) { p.bloomThreshold = d.bloomThreshold ?? 0.8; p.bloomWeight = d.bloomWeight ?? 0.4; p.bloomKernel = 48; }
    p.fxaaEnabled = !!d.fxaa; p.samples = d.msaa ?? 1;
    p.sharpenEnabled = !!d.sharpen; if (d.sharpen) p.sharpen.edgeAmount = d.sharpen;
    p.grainEnabled = !!d.grain; if (d.grain) p.grain.intensity = d.grain;
    p.chromaticAberrationEnabled = !!d.chromaticAberration; if (d.chromaticAberration) p.chromaticAberration.aberrationAmount = d.chromaticAberration;
    p.imageProcessingEnabled = true;
    const ip = p.imageProcessing; ip.contrast = d.contrast ?? 1; ip.exposure = d.exposure ?? 1;
    ip.vignetteEnabled = !!d.vignette; if (d.vignette) { ip.vignetteWeight = d.vignette * 10; ip.vignetteColor = new B.Color4(0, 0, 0, 0); }
    ip.toneMappingEnabled = !!d.tonemap; if (d.tonemap) ip.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  };
  registerComponent('postProcess', {
    create(e, d, comp) { comp.pending = backend.quality.postProcessing; },
    update(comp) {
      if (comp.pending && scene.activeCamera) {
        comp.pending = false;
        comp.pipeline = new B.DefaultRenderingPipeline(`${comp.entity.name}.post`, comp.data.hdr !== false, scene, [scene.activeCamera]);
        applyPost(comp.pipeline, comp.data);
      }
    },
    set(comp, k, v) { comp.data[k] = v; if (comp.pipeline) applyPost(comp.pipeline, comp.data); },
    destroy(comp) { comp.pipeline?.dispose(); },
  });

  // ---- physics components ---------------------------------------------------------
  const phys = (e) => backend.physics?.build(e);
  registerComponent('rigidbody', { create: phys, destroy: (c) => backend.physics?.forget(c.entity) });
  registerComponent('collider', { create: phys, destroy: (c) => backend.physics?.forget(c.entity) });
  registerComponent('trigger', {
    create(e, d) { e.addComponent('collider', { shape: d.shape ?? 'box', size: d.size ?? [2, 2, 2], radius: d.radius, offset: d.offset, trigger: true }); },
  });
  registerComponent('audioListener', {});
}
