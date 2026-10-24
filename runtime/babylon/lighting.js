// Unity-style lighting for Babylon, shared by the game runtime and the editor Scene view.
// Light component: kind (directional|point|spot|hemispheric), color, intensity, range (point/spot), angle (spot, degrees),
// castShadows (any kind but hemispheric), flicker. Scene settings: `ambient` (colour) and `ambientIntensity` (0 = off).
import { rgb } from './index.js';

const D2R = Math.PI / 180;
export const AMBIENT_NAME = '__ambient';

/** Quality presets (keep in sync with QUALITY in crates/nord-editor/src/panels/project.rs and docs/QUALITY.md). */
export const QUALITY = {
  low: { shadows: 'off', shadowResolution: 512, maxLights: 4, antialiasing: false, renderScale: 0.75, postProcessing: false },
  medium: { shadows: 'hard', shadowResolution: 1024, maxLights: 4, antialiasing: true, renderScale: 1, postProcessing: true },
  high: { shadows: 'soft', shadowResolution: 1024, maxLights: 8, antialiasing: true, renderScale: 1, postProcessing: true },
  ultra: { shadows: 'soft', shadowResolution: 2048, maxLights: 12, antialiasing: true, renderScale: 1, postProcessing: true },
};
/** Effective quality of a project: the `quality.level` preset plus any single overrides in `project.quality`. */
export function qualitySettings(project) {
  const q = project?.quality ?? {}, out = { ...(QUALITY[q.level] ?? QUALITY.high) };
  for (const k of Object.keys(out)) if (q[k] !== undefined && typeof q[k] === typeof out[k]) out[k] = q[k];
  return out;
}

/** Create a light for the light component data `d`. `parent` is the entity node: position and direction follow it. */
export function createLight(B, scene, name, d, parent) {
  const kind = d.kind ?? 'point', col = rgb(B, d.color);
  let l;
  if (kind === 'point') l = new B.PointLight(name, B.Vector3.Zero(), scene);
  else if (kind === 'spot') l = new B.SpotLight(name, B.Vector3.Zero(), new B.Vector3(0, 0, 1), (d.angle ?? 30) * D2R, d.exponent ?? 2, scene);
  else if (kind === 'hemispheric') { l = new B.HemisphericLight(name, new B.Vector3(0, 1, 0), scene); l.groundColor = rgb(B, d.groundColor ?? d.color, '#404050'); }
  else l = new B.DirectionalLight(name, d.direction ? new B.Vector3(...d.direction) : new B.Vector3(0, 0, 1), scene);
  l.diffuse = col; l.specular = col; l.intensity = d.intensity ?? 1;
  if (l.range !== undefined) l.range = d.range ?? 10; // linear fall-off to 0 at `range`, like Unity's Range
  if (parent) l.parent = parent; // direction/position follow the entity; a disabled parent entity disables the light
  return l;
}

/** Soft shadow map for a light; returns the generator (add casters with `sg.addShadowCaster`). */
export function createShadows(B, l, size = 1024, q = QUALITY.high, d = {}) {
  if (q.shadows === 'off') return null;
  const sg = new B.ShadowGenerator(size, l);
  if (q.shadows === 'soft') { if (l instanceof B.PointLight) sg.usePoissonSampling = true; else { sg.useBlurExponentialShadowMap = true; sg.blurKernel = 16; } }
  sg.bias = 0.002;
  sg.setDarkness(1 - Math.min(1, Math.max(0, d.shadowStrength ?? 1)));
  return sg;
}

/** Ambient light of a scene (`settings.ambient`, `settings.ambientIntensity`). `undefined` colour: no ambient light. */
export function applyAmbient(B, scene, settings) {
  scene.getLightByName(AMBIENT_NAME)?.dispose();
  const c = settings?.ambient, k = settings?.ambientIntensity ?? 1;
  if (typeof c !== 'string' || !(k > 0)) return null;
  const l = new B.HemisphericLight(AMBIENT_NAME, new B.Vector3(0, 1, 0), scene);
  l.diffuse = l.groundColor = rgb(B, c); l.specular = B.Color3.Black(); l.intensity = k;
  return l;
}

/** More than 4 lights per material (Babylon's default). */
export function allowManyLights(B, scene, max = 8) {
  const set = (m) => { if ('maxSimultaneousLights' in m) m.maxSimultaneousLights = max; };
  scene.materials.forEach(set);
  scene.onNewMaterialAddedObservable.add(set);
}

/**
 * Unity-style "only the lights that reach an object light it": a material can use a limited number of lights, so with many
 * point/spot lights in a scene some would be dropped by scene order. Every ~0.25 s each ranged light is limited to the meshes
 * inside its range, so a mesh only competes for the lights that actually touch it.
 */
export function createLightCuller(B, scene, every = 0.25) {
  let t = 0, none = null, prio = ''; const last = new WeakMap(); // an empty includedOnlyMeshes means "every mesh", so an unreachable light gets a dummy mesh
  const update = (dt) => {
    t += dt; if (t < every) return; t = 0;
    // when more lights reach one object than its material can use, the strongest win (directional/hemispheric always)
    let sig = '';
    for (const l of scene.lights) { l.renderPriority = l.range > 0 && l.range < 1e6 ? (l.intensity ?? 1) * l.range * l.range : 1e9; sig += l.renderPriority + ','; }
    if (sig !== prio) { prio = sig; scene.sortLightsByPriority?.(); scene.meshes.forEach((m) => m._resyncLightSources?.()); }
    const meshes = scene.meshes.filter((m) => m.isEnabled() && m.getTotalVertices?.() > 0 && !m.infiniteDistance);
    for (const l of scene.lights) {
      if (!(l instanceof B.PointLight || l instanceof B.SpotLight) || !(l.range > 0 && l.range < 1e6) || !l.isEnabled()) continue;
      const p = l.getAbsolutePosition(), hit = meshes.filter((m) => !m.isAnInstance && (m.instances?.length ?? 0) === 0).filter((m) => { const bs = m.getBoundingInfo().boundingSphere; return B.Vector3.Distance(bs.centerWorld, p) <= bs.radiusWorld + l.range; });
      const key = hit.map((m) => m.uniqueId).join(',');
      if (last.get(l) === key) continue;
      last.set(l, key); l.includedOnlyMeshes = hit.length ? hit : [(none ??= new B.Mesh('__nolight', scene))];
    }
  };
  return { update };
}

/** Apply a changed light field to a live Babylon light (`entity.set('light', 'intensity', 2)`, Inspector edits while playing). */
export function setLightField(B, l, key, value) {
  if (key === 'color') { const c = rgb(B, value); l.diffuse = c; l.specular = c; }
  else if (key === 'groundColor' && l.groundColor) l.groundColor = rgb(B, value, '#404050');
  else if (key === 'intensity') l.intensity = value ?? 1;
  else if (key === 'range' && l.range !== undefined) l.range = value ?? 10;
  else if (key === 'angle' && l.angle !== undefined) l.angle = (value ?? 30) * D2R;
  else if (key === 'exponent' && l.exponent !== undefined) l.exponent = value ?? 2;
}

// ---- lit sprites (Unity's Sprite-Lit-Default) ---------------------------------------------------------------------------
// A sprite is a flat picture, so its light does not depend on the angle to the light: every point/spot light adds
// colour x intensity x falloff(distance, range) per pixel; ambient/directional/hemispheric lights add colour x intensity;
// the sum multiplies the picture (colours blend additively, like Unity). A scene without any light shows the picture as it is.
const SPRITE_LIGHTS = 8;
const SPRITE_VS = `precision highp float; attribute vec3 position; attribute vec2 uv; uniform mat4 world; uniform mat4 viewProjection; varying vec3 vW; varying vec2 vUV;
void main(){ vec4 w = world * vec4(position, 1.0); vW = w.xyz; vUV = uv; gl_Position = viewProjection * w; }`;
const SPRITE_FS = `precision highp float; varying vec3 vW; varying vec2 vUV; uniform sampler2D tex; uniform vec4 tint; uniform float uLit; uniform float uN; uniform vec3 uAmb;
uniform vec3 uLP[${SPRITE_LIGHTS}]; uniform vec4 uLC[${SPRITE_LIGHTS}];
void main(){ vec4 c = texture2D(tex, vUV) * tint; vec3 L = vec3(1.0);
  if (uLit > 0.5) { L = uAmb; for (int i = 0; i < ${SPRITE_LIGHTS}; i++) { if (float(i) >= uN) break; float d = distance(vW, uLP[i]); L += uLC[i].rgb * clamp(1.0 - d / uLC[i].a, 0.0, 1.0); } }
  if (c.a < 0.01) discard; gl_FragColor = vec4(c.rgb * L, c.a); }`;

/** Material for a sprite plane. `m.setSprite({ texture, tint: Color3, alpha, lit })`; lights are read from the scene on every draw. */
export function createSpriteMaterial(B, scene, name) {
  B.Effect.ShadersStore.nordSpriteVertexShader ??= SPRITE_VS;
  B.Effect.ShadersStore.nordSpriteFragmentShader ??= SPRITE_FS;
  const m = new B.ShaderMaterial(name, scene, 'nordSprite', { attributes: ['position', 'uv'], uniforms: ['world', 'viewProjection', 'tint', 'uLit', 'uN', 'uAmb', 'uLP', 'uLC'], samplers: ['tex'], needAlphaBlending: true });
  m.backFaceCulling = false;
  const lp = new Float32Array(SPRITE_LIGHTS * 3), lc = new Float32Array(SPRITE_LIGHTS * 4);
  const st = { lit: true, tint: [1, 1, 1], alpha: 1 };
  m.setSprite = (o) => {
    Object.assign(st, o);
    if (o.texture) m.setTexture('tex', o.texture); else if (!st.white) { st.white = new B.RawTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, B.Engine.TEXTUREFORMAT_RGBA, scene); m.setTexture('tex', st.white); }
    m.setVector4('tint', new B.Vector4(st.tint.r ?? 1, st.tint.g ?? 1, st.tint.b ?? 1, st.alpha));
    m.setFloat('uLit', st.lit ? 1 : 0);
  };
  m.onBindObservable.add(() => {
    const e = m.getEffect(); if (!e || !st.lit) return;
    let n = 0, ar = 0, ag = 0, ab = 0; const near = [];
    for (const l of scene.lights) {
      if (!l.isEnabled()) continue;
      const k = l.intensity ?? 1, c = l.diffuse;
      if (l instanceof B.PointLight || l instanceof B.SpotLight) near.push(l);
      else { ar += c.r * k; ag += c.g * k; ab += c.b * k; } // hemispheric / directional / ambient: flat
    }
    for (const l of near) {
      if (n >= SPRITE_LIGHTS) break;
      l.computeTransformedInformation?.(); // world position of a light parented to an entity
      const p = l.transformedPosition ?? l.position, c = l.diffuse, k = l.intensity ?? 1;
      lp.set([p.x, p.y, p.z], n * 3); lc.set([c.r * k, c.g * k, c.b * k, l.range > 0 && l.range < 1e6 ? l.range : 1e6], n * 4); n++;
    }
    // no light in the scene at all: the picture as it is (Unity's unlit Sprites-Default); lights that are all off: dark
    const none = scene.lights.length === 0;
    e.setFloat('uN', n); e.setFloat('uLit', none ? 0 : 1);
    e.setFloat3('uAmb', ar, ag, ab); e.setArray3('uLP', lp); e.setArray4('uLC', lc);
  });
  return m;
}
