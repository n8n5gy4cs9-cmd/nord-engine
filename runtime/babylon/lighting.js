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
  if (kind !== 'hemispheric' && parent) l.parent = parent;
  return l;
}

/** Soft shadow map for a light; returns the generator (add casters with `sg.addShadowCaster`). */
export function createShadows(B, l, size = 1024, q = QUALITY.high) {
  if (q.shadows === 'off') return null;
  const sg = new B.ShadowGenerator(size, l);
  if (q.shadows === 'soft') { if (l instanceof B.PointLight) sg.usePoissonSampling = true; else { sg.useBlurExponentialShadowMap = true; sg.blurKernel = 16; } }
  sg.bias = 0.002;
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
  let t = 0, none = null, prio = ''; const last = new Map(); // an empty includedOnlyMeshes means "every mesh", so an unreachable light gets a dummy mesh
  const update = (dt) => {
    t += dt; if (t < every) return; t = 0;
    // when more lights reach one object than its material can use, the strongest win (directional/hemispheric always)
    let sig = '';
    for (const l of scene.lights) { l.renderPriority = l.range > 0 && l.range < 1e6 ? (l.intensity ?? 1) * l.range * l.range : 1e9; sig += l.renderPriority + ','; }
    if (sig !== prio) { prio = sig; scene.sortLightsByPriority?.(); scene.meshes.forEach((m) => m._resyncLightSources?.()); }
    const meshes = scene.meshes.filter((m) => m.isEnabled() && m.getTotalVertices?.() > 0 && !m.infiniteDistance);
    for (const l of scene.lights) {
      if (!(l instanceof B.PointLight || l instanceof B.SpotLight) || !(l.range > 0 && l.range < 1e6) || !l.isEnabled()) continue;
      const p = l.getAbsolutePosition(), hit = meshes.filter((m) => { const bs = m.getBoundingInfo().boundingSphere; return B.Vector3.Distance(bs.centerWorld, p) <= bs.radiusWorld + l.range; });
      const key = hit.map((m) => m.uniqueId).join(',');
      if (last.get(l) === key) continue;
      last.set(l, key); l.includedOnlyMeshes = hit.length ? hit : [(none ??= new B.Mesh('__nolight', scene))];
    }
  };
  return { update };
}
