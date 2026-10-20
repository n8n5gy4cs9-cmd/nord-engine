// Particles, tracers, bullet holes and short-lived dynamic lights. Everything is pooled so shooting never allocates meshes.
const rand = (a, b) => a + Math.random() * (b - a);
const hexRgb = (c) => { let h = String(c).replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h.slice(0, 6), 16) || 0; return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export class Fx {
  constructor(B, scene) {
    this.B = B; this.scene = scene; this.parts = []; this.free = []; this.mats = new Map(); this.lights = []; this.tracers = []; this.tracerFree = []; this.decals = []; this.decalI = 0;
    this.shake = 0;
  }
  mat(color, alpha = 1) {
    const k = `${color}|${alpha}`; let m = this.mats.get(k);
    if (!m) { const B = this.B; m = new B.StandardMaterial(`fx-${k}`, this.scene); m.disableLighting = true; m.diffuseColor = B.Color3.Black(); m.specularColor = B.Color3.Black(); m.emissiveColor = new B.Color3(...hexRgb(color)); m.backFaceCulling = false; if (alpha < 1) m.alpha = alpha; this.mats.set(k, m); }
    return m;
  }
  #particle() {
    let p = this.free.pop();
    if (!p) {
      if (this.parts.length > 260) return null;
      const B = this.B, mesh = B.MeshBuilder.CreatePlane('fx', { size: 1 }, this.scene); mesh.billboardMode = B.Mesh.BILLBOARDMODE_ALL; mesh.isPickable = false;
      p = { mesh, v: [0, 0, 0], life: 0, max: 1, size: 0.1, g: 0, alive: false };
    }
    this.parts.push(p); return p;
  }
  /** n particles flying from pos. o: { color, speed, life, size, gravity, up, spread } */
  burst(pos, o = {}) {
    const n = o.n ?? 8;
    for (let i = 0; i < n; i++) {
      const p = this.#particle(); if (!p) return;
      const sp = rand((o.speed ?? 3) * 0.4, o.speed ?? 3), a = rand(0, Math.PI * 2), e = rand(-0.2, 1) * (o.spread ?? 1);
      p.v = [Math.cos(a) * sp * (1 - Math.abs(e) * 0.3) + (o.dir?.[0] ?? 0) * sp, e * sp + (o.up ?? 0) + (o.dir?.[1] ?? 0) * sp, Math.sin(a) * sp * (1 - Math.abs(e) * 0.3) + (o.dir?.[2] ?? 0) * sp];
      p.life = p.max = rand((o.life ?? 0.5) * 0.6, o.life ?? 0.5); p.size = rand((o.size ?? 0.1) * 0.6, o.size ?? 0.1); p.g = o.gravity ?? 9;
      p.mesh.material = this.mat(Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : o.color ?? '#ffcc66');
      p.mesh.position.set(pos[0], pos[1], pos[2]); p.mesh.scaling.setAll(p.size); p.mesh.setEnabled(true);
    }
  }
  spark(pos, n, nr = [0, 1, 0]) { this.burst(pos, { n: n ?? 6, color: ['#ffd27a', '#fff2c0', '#ff9a3a'], speed: 3.5, life: 0.35, size: 0.05, gravity: 10, dir: [nr[0] * 0.5, nr[1] * 0.5, nr[2] * 0.5] }); }
  blood(pos, color = '#b01818') { this.burst(pos, { n: 9, color: [color, '#7a0e0e'], speed: 2.6, life: 0.55, size: 0.07, gravity: 9 }); }
  smoke(pos, n = 5) { this.burst(pos, { n, color: ['#5a5a5a', '#7a7a7a'], speed: 0.9, life: 1.1, size: 0.35, gravity: -0.6, up: 0.4 }); }
  explosion(pos, radius = 4) {
    this.burst(pos, { n: 26, color: ['#ffb02e', '#ff6a1a', '#fff0a0'], speed: radius * 1.6, life: 0.7, size: 0.42, gravity: 2, spread: 1.2 });
    this.smoke(pos, 12); this.flash(pos, '#ffa040', radius * 3.2, 0.45, 2.4); this.shake = Math.max(this.shake, Math.min(1, radius / 5));
  }
  /** Dynamic light for `sec` seconds (renderer feeds up to 8 of these to the shader). */
  flash(pos, color, range, sec, intensity = 1.5) { this.lights.push({ x: pos[0], y: pos[1], z: pos[2], color: Array.isArray(color) ? color : hexRgb(color), range, intensity, t: sec, max: sec }); }
  tracer(a, b, color = '#ffe6a0') {
    let t = this.tracerFree.pop();
    if (!t) { const B = this.B; t = { mesh: B.MeshBuilder.CreateBox('tr', { size: 1 }, this.scene) }; t.mesh.isPickable = false; }
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 0.01;
    t.mesh.material = this.mat(color); t.mesh.scaling.set(0.018, 0.018, len); t.mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    t.mesh.lookAt(new this.B.Vector3(b[0], b[1], b[2])); t.mesh.setEnabled(true); t.life = 0.05; this.tracers.push(t);
  }
  decal(pos, n) {
    if (this.decals.length < 36) { const B = this.B, m = B.MeshBuilder.CreatePlane('hole', { size: 0.14 }, this.scene); m.material = this.mat('#101010', 0.85); m.isPickable = false; this.decals.push(m); }
    const m = this.decals[this.decalI++ % this.decals.length];
    m.position.set(pos[0] + n[0] * 0.012, pos[1] + n[1] * 0.012, pos[2] + n[2] * 0.012); m.lookAt(new this.B.Vector3(pos[0] + n[0], pos[1] + n[1], pos[2] + n[2])); m.setEnabled(true);
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { p.mesh.setEnabled(false); this.free.push(p); this.parts.splice(i, 1); continue; }
      p.v[1] -= p.g * dt; const m = p.mesh.position; m.x += p.v[0] * dt; m.y += p.v[1] * dt; m.z += p.v[2] * dt;
      if (m.y < 0.02 && p.g > 0) { m.y = 0.02; p.v[1] *= -0.3; p.v[0] *= 0.6; p.v[2] *= 0.6; }
      p.mesh.scaling.setAll(p.size * Math.max(0.05, p.life / p.max));
    }
    for (let i = this.lights.length - 1; i >= 0; i--) { const l = this.lights[i]; l.t -= dt; if (l.t <= 0) this.lights.splice(i, 1); }
    for (let i = this.tracers.length - 1; i >= 0; i--) { const t = this.tracers[i]; t.life -= dt; if (t.life <= 0) { t.mesh.setEnabled(false); this.tracerFree.push(t); this.tracers.splice(i, 1); } }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
  /** Dynamic lights in shader format (fading out). */
  dynamicLights() { return this.lights.map((l) => ({ x: l.x, y: l.y, z: l.z, color: l.color, range: l.range, intensity: l.intensity * Math.min(1, l.t / (l.max * 0.6)) })); }
  clear() { for (const p of this.parts) { p.mesh.setEnabled(false); this.free.push(p); } this.parts.length = 0; this.lights.length = 0; for (const d of this.decals) d.setEnabled(false); }
}
