// Babylon `shadertoy` component: a Shadertoy shader (runtime/core/shadertoy.js) as the picture of a plane in the scene, or on the material of this entity's own mesh.
//   { "type": "shadertoy", "file": "assets/shaders/plasma.glsl", "size": [4, 4], "resolution": [512, 512] }                       // a plane 4×4 units
//   { "type": "shadertoy", "file": "assets/shaders/lava.glsl", "target": "material" }                                            // on the `mesh` + `material` of this entity
// data: code | file, buffers, channels, size [w, h] (world units of the plane), resolution [px, px] (default 512×512), resolutionScale, speed, paused, transparent, target ('plane' | 'material'),
//       billboard, uniforms
import { registerComponent } from '../core/index.js';
import { createShadertoy } from '../core/shadertoy.js';

export function registerShaderComponents3D(backend) {
  const B = backend.B, scene = backend.scene;
  backend.onAfterRender = (fn) => { const o = scene.onAfterRenderObservable.add(fn); return () => scene.onAfterRenderObservable.remove(o); };
  registerComponent('shadertoy', {
    create(e, d, comp) {
      const [rw, rh] = d.resolution ?? [512, 512], [w, h] = d.size ?? [4, 4];
      comp.speed = d.speed ?? 1; comp.paused = !!d.paused;
      comp.ready = createShadertoy(backend.game, d, { width: rw, height: rh, screen: () => backend.canvas }).then((st) => {
        if (e.destroyed) { st.destroy(); return; }
        comp.st = st;
        comp.tex = new B.DynamicTexture(`${e.name}.shadertoy`, { width: st.width, height: st.height }, scene, false);
        const apply = (mat) => { mat.emissiveTexture = comp.tex; mat.emissiveColor = B.Color3.Black(); mat.diffuseColor = B.Color3.Black(); mat.specularColor = B.Color3.Black(); mat.disableLighting = true; mat.backFaceCulling = false; if (d.transparent) { mat.opacityTexture = comp.tex; mat.useAlphaFromDiffuseTexture = false; } };
        if ((d.target ?? 'plane') === 'material') comp.apply = () => { for (const m of e.__meshes ?? []) if (m.material) apply(m.material); };
        else {
          comp.plane = B.MeshBuilder.CreatePlane(`${e.name}.shadertoyPlane`, { width: w, height: h, sideOrientation: B.Mesh.DOUBLESIDE }, scene);
          comp.plane.parent = e.native; comp.plane.isPickable = false; if (d.billboard) comp.plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
          const mat = new B.StandardMaterial(`${e.name}.shadertoyMat`, scene); apply(mat); comp.plane.material = mat;
        }
      }).catch((err) => backend.game.reportError(err, { constructor: { name: `shadertoy ${d.file ?? ''}` } }, 'compile'));
    },
    update(comp, dt) {
      const st = comp.st; if (!st || comp.paused || !comp.entity.enabled) return;
      if (comp.apply) { comp.apply(); comp.apply = null; }
      const p = backend.game.input.pointer; st.setMouse(p.x * (st.width / (backend.canvas.width || 1)), st.height - p.y * (st.height / (backend.canvas.height || 1)), p.down);
      st.render(dt * comp.speed);
      const ctx = comp.tex.getContext(); ctx.drawImage(st.canvas, 0, 0, st.width, st.height); comp.tex.update(false);
    },
    set(comp, k, v) { comp.data[k] = v; if (k === 'speed') comp.speed = v; else if (k === 'paused') comp.paused = !!v; else if (k === 'uniforms') for (const [n, x] of Object.entries(v)) comp.st?.setUniform(n, x); },
    destroy(comp) { comp.st?.destroy(); comp.plane?.material?.dispose(); comp.plane?.dispose(); comp.tex?.dispose(); },
  });
}
