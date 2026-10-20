// Live 3D preview of the level being edited (same renderer and models as the game). Fly camera: hold right mouse to look, WASD/QE to move, wheel = speed.
import { World } from '/runtime/fpsc/world.js';
import { LevelRenderer, hex } from '/runtime/fpsc/render.js';
import { Model, modelSpec } from '/runtime/fpsc/models.js';
import { CELL, STORY, normalize } from '/runtime/fpsc/level.js';

const D2R = Math.PI / 180;
export class View3D {
  constructor(canvas, ed) {
    this.cv = canvas; this.ed = ed; this.B = globalThis.BABYLON; this.ents = []; this.speed = 14; this.keys = new Set(); this.yaw = 0.6; this.pitch = 0.75; this.dirty = true; this.visible = false; this.msg = document.getElementById('v3d-msg');
    const B = this.B;
    this.engine = new B.Engine(canvas, true, { stencil: true, adaptToDeviceRatio: true });
    this.scene = new B.Scene(this.engine); this.scene.clearColor = new B.Color4(0.08, 0.09, 0.11, 1);
    this.cam = new B.UniversalCamera('ed3d', new B.Vector3(20, 30, -10), this.scene); this.cam.inputs.clear(); this.cam.minZ = 0.1; this.cam.maxZ = 800; this.cam.fov = 1.1; this.scene.activeCamera = this.cam;
    this.#controls();
    this.engine.runRenderLoop(() => { if (!this.visible) return; this.#move(this.engine.getDeltaTime() / 1000); this.scene.render(); });
    new ResizeObserver(() => this.engine.resize()).observe(canvas.parentElement);
  }
  #controls() {
    const cv = this.cv; let look = false;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousedown', (e) => { cv.focus(); if (e.button === 2) { look = true; } this.down = [e.clientX, e.clientY, e.button]; });
    window.addEventListener('mouseup', (e) => { look = false; if (this.down && e.button === 0 && Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) < 4 && e.target === cv) this.#click(e); this.down = null; });
    window.addEventListener('mousemove', (e) => { if (look) { this.yaw += e.movementX * 0.004; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + e.movementY * 0.004)); } });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.speed = Math.max(2, Math.min(80, this.speed * (e.deltaY < 0 ? 1.2 : 0.83))); this.#hud(); }, { passive: false });
    cv.addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code === 'KeyF' && this.ed.selectedPos()) { const p = this.ed.selectedPos(); this.focus(p[0], p[1], p[2]); } });
    cv.addEventListener('keyup', (e) => this.keys.delete(e.code)); cv.addEventListener('blur', () => this.keys.clear());
  }
  #hud() { this.msg.textContent = `3D preview — right-drag look · WASD/QE fly · wheel speed (${this.speed.toFixed(0)}) · F focus selection · click selects`; }
  #move(dt) {
    const k = this.keys, s = this.speed * dt * (k.has('ShiftLeft') ? 3 : 1); if (!k.size) { this.#apply(); return; }
    const f = [Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)], r = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)], p = this.cam.position;
    const a = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), b = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), c = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    p.x += (f[0] * a + r[0] * b) * s; p.y += (f[1] * a + c) * s; p.z += (f[2] * a + r[2] * b) * s; this.#apply();
  }
  #apply() { this.cam.rotation.set(this.pitch, this.yaw, 0); }
  #click(e) {
    const r = this.cv.getBoundingClientRect(), pick = this.scene.pick(e.clientX - r.left, e.clientY - r.top, (m) => !!m.metadata?.entId);
    if (pick?.hit) this.ed.selectEntity(pick.pickedMesh.metadata.entId, e.shiftKey);
  }
  setVisible(v) { this.visible = v; if (v) { this.engine.resize(); this.#hud(); if (this.dirty) this.rebuild(); } }
  invalidate() { this.dirty = true; if (!this.visible) return; clearTimeout(this.t); this.msg.textContent = 'rebuilding…'; this.t = setTimeout(() => this.rebuild(), 280); }
  focus(x, z, layer = 0, dist = 10) { const p = this.cam.position; p.set(x - Math.sin(this.yaw) * dist, layer * STORY + dist * 0.8, z - Math.cos(this.yaw) * dist); this.pitch = 0.62; }
  centerOn(x, z) { const b = this.ed.contentBounds(); const size = b ? Math.max(b[2] - b[0] + 1, b[3] - b[1] + 1) * CELL : 24; this.focus(x, z, this.ed.layer, Math.max(14, size * 0.85)); }

  rebuild() {
    this.dirty = false; const B = this.B, ed = this.ed, t0 = performance.now();
    try {
      this.#clear();
      const lv = normalize(structuredClone(ed.level)); this.lv = lv;
      this.world = new World(lv, { piece: (i) => ed.bank.piece(i), cellPiece: (i) => ed.bank.cellPiece(i), stair: (i) => ed.bank.stair(i) });
      this.rend = new LevelRenderer(B, this.scene, this.world, lv, ed.bank, { ceilings: ed.show3dCeilings, maxLayer: ed.show3dAll ? Infinity : ed.layer, occlude: ed.level.entities.length < 400 });
      const lights = []; const spawn = [];
      for (const e of lv.entities) {
        const def = ed.bank.entity(e.type); if (!def) continue;
        const fl = this.world.floorAt(e.x, e.z, e.layer * STORY + STORY - 0.05), fy = (fl ? fl.y : e.layer * STORY) + (def.elev ?? 0) + (+e.y || 0);
        if (def.light && e.props?.on !== false) lights.push({ x: e.x, y: fy + (def.light.y ?? 0.5), z: e.z, color: hex(e.props?.color || def.light.color), intensity: +(e.props?.intensity ?? def.light.intensity), range: +(e.props?.range ?? def.light.range) });
        spawn.push([e, def, fy]);
      }
      this.rend.build(lights);
      for (const [e, def, fy] of spawn) this.#entity(e, def, fy);
      this.#hud(); this.msg.textContent += `  · ${this.rend.stats.tris | 0} tris, ${lights.length} lights, ${(performance.now() - t0) | 0} ms`;
    } catch (err) { console.error(err); this.msg.textContent = `3D preview error: ${err.message}`; }
    this.#highlight();
  }
  #clear() { for (const m of this.ents) m.dispose?.(); this.ents = []; this.rend?.dispose(); this.hl?.dispose(); this.hl = null; for (const m of this.scene.meshes.slice()) if (m !== this.hl) m.dispose(); }
  #entity(e, def, fy) {
    const B = this.B; let m;
    if (def.model) { const mod = new Model(B, this.scene, modelSpec(e.props?.model || def.model, this.ed.bank), { name: e.type, scale: +e.props?.scale || 1 }); m = mod.root; m.position.set(e.x, fy, e.z); m.rotation.y = (e.rot || 0) * D2R; mod.light(this.rend.lightAt(e.x, fy + 1, e.z)); mod.meshes.forEach((x) => { x.metadata = { entId: e.id }; x.isPickable = true; }); this.ents.push(mod); }
    if (def.zone) { const z = { w: +e.props?.w || 4, d: +e.props?.d || 4, h: +e.props?.h || 3 }; const box = B.MeshBuilder.CreateBox('zone', { width: z.w, depth: z.d, height: z.h }, this.scene); box.position.set(e.x, fy + z.h / 2, e.z); const mat = new B.StandardMaterial('zm', this.scene); mat.disableLighting = true; mat.emissiveColor = B.Color3.FromHexString(def.color); mat.alpha = 0.16; mat.backFaceCulling = false; box.material = mat; box.metadata = { entId: e.id }; this.ents.push(box); }
    if (!def.model && !def.zone) { const s = B.MeshBuilder.CreateSphere('mk', { diameter: 0.5 }, this.scene); s.position.set(e.x, fy + (def.light?.y ?? 0.5), e.z); const mat = new B.StandardMaterial('mk', this.scene); mat.disableLighting = true; mat.emissiveColor = B.Color3.FromHexString(def.color); s.material = mat; s.metadata = { entId: e.id }; this.ents.push(s);
      if (e.type === 'player_start') { const c = B.MeshBuilder.CreateCylinder('arrow', { diameterTop: 0, diameterBottom: 0.7, height: 1.4 }, this.scene); c.rotation.x = Math.PI / 2; const n = new B.TransformNode('ar', this.scene); c.parent = n; c.position.z = 0.8; n.position.set(e.x, fy + 1, e.z); n.rotation.y = (e.rot || 0) * D2R; c.material = s.material; c.metadata = { entId: e.id }; this.ents.push(n, c); } }
  }
  #highlight() {
    this.hl?.dispose(); this.hl = null; const p = this.ed.selectedEntity(); if (!p) return;
    const B = this.B, def = this.ed.bank.entity(p.type), fl = this.world?.floorAt(p.x, p.z, p.layer * STORY + STORY - 0.05), fy = (fl ? fl.y : 0) + (def?.elev ?? 0) + (+p.y || 0);
    const h = def?.height ?? 1.8, r = Math.max(def?.radius ?? 0.4, 0.4);
    const b = B.MeshBuilder.CreateBox('hl', { width: r * 2.4, height: h + 0.2, depth: r * 2.4 }, this.scene); b.position.set(p.x, fy + h / 2, p.z); const mat = new B.StandardMaterial('hl', this.scene); mat.wireframe = true; mat.disableLighting = true; mat.emissiveColor = new B.Color3(1, 0.82, 0.23); b.material = mat; b.isPickable = false; this.hl = b;
  }
  selectionChanged() { this.#highlight(); }
}
