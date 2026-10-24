// Unity-style lighting for Babylon, shared by the game runtime and the editor Scene view.
// Light component: kind (directional|point|spot|hemispheric), color, intensity, range (point/spot), angle (spot, degrees),
// castShadows (any kind but hemispheric), flicker. Scene settings: `ambient` (colour) and `ambientIntensity` (0 = off).
import { rgb } from './index.js';

const D2R = Math.PI / 180;
export const AMBIENT_NAME = '__ambient';

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
export function createShadows(B, l, size = 1024) {
  const sg = new B.ShadowGenerator(size, l);
  if (l instanceof B.PointLight) sg.usePoissonSampling = true;
  else { sg.useBlurExponentialShadowMap = true; sg.blurKernel = 16; }
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
