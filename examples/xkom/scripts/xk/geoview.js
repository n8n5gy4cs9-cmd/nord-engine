// Small offline orthographic globe, sampled from the existing world raster; HQ mode is a regional map crop.
const TAU = Math.PI * 2, HQ = { x: 8, y: 5 };
export class GeoView {
  constructor(host) { this.h = host; this.yaw = -1.5; this.pitch = 0.18; this.radius = 75; this.zoom = 2.4; this.region = false; }
  start(sites) {
    const h = this.h; this.sites = sites; this.canvas = document.createElement('canvas'); this.canvas.width = 232; this.canvas.height = 176;
    const src = document.createElement('canvas'); src.width = 320; src.height = 144; const ctx = src.getContext('2d');
    ctx.drawImage(h.ps.textures.get(h.PATH.world).getSourceImage(), 0, 0, 320, 144); this.source = src; this.pixels = ctx.getImageData(0, 0, 320, 144).data;
    h.ps.textures.remove('xk-geoscape'); this.texture = h.ps.textures.addCanvas('xk-geoscape', this.canvas); this.texture.setFilter(globalThis.Phaser.Textures.FilterMode.NEAREST);
    this.image = h.keep(h.ps.add.image(0, 0, 'xk-geoscape').setOrigin(0).setDepth(0)); h.hud.add(this.image);
    this.markers = [HQ, ...sites].map((s, i) => ({ site: s, sprite: h.keep(h.img('gicons', i === 0 ? 0 : s.icon === 1 ? 2 : 1, 0, 0, 4, [0.5, 0.5], true)).setScale(0.65), label: h.keep(h.text(0, 0, i ? String(i) : 'HQ', i ? '#ffd25c' : '#6ac8ff', { origin: [0.5, 0], hud: true, depth: 6 })) }));
    this.townMarks = h.C.towns.map(town => { const sprite = h.keep(h.ps.add.rectangle(0, 0, 3, 3, 0x496c5e).setDepth(2)); h.hud.add(sprite); return { town, sprite }; });
    this.draw();
  }
  project(site) {
    const sx = site.x * 8 + 4, sy = site.y * 8 + 4;
    if (this.region) { const x = 116 + (sx - 68) * this.zoom, y = 88 + (sy - 44) * this.zoom; return { x, y, visible: x > 7 && x < 225 && y > 16 && y < 160 }; }
    const lon = (sx / 320 - 0.5) * TAU - this.yaw, lat = (0.5 - sy / 144) * Math.PI;
    const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    return { x: 116 + x * this.radius, y: 90 - (y * cp - z * sp) * this.radius, visible: y * sp + z * cp > 0.08 };
  }
  draw() {
    const ctx = this.canvas.getContext('2d'), image = ctx.createImageData(232, 176), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    for (let y = 0; y < 176; y++) for (let x = 0; x < 232; x++) {
      const i = (y * 232 + x) * 4, nx = (x - 116) / this.radius, ny = (90 - y) / this.radius, r2 = nx * nx + ny * ny;
      const nebula = Math.max(0, Math.sin(x * 0.031 + Math.sin(y * 0.06) * 2) * Math.sin(y * 0.025));
      let color = [4 + nebula * 17, 4 + nebula * 6, 12 + nebula * 24];
      if (!this.region && r2 <= 1) {
        const nz = Math.sqrt(1 - r2), wy = ny * cp + nz * sp, wz = -ny * sp + nz * cp;
        const lon = this.yaw + Math.atan2(nx, wz), lat = Math.asin(Math.max(-1, Math.min(1, wy)));
        const sx = ((Math.floor((lon / TAU + 0.5) * 320) % 320) + 320) % 320, sy = Math.max(0, Math.min(143, Math.floor((0.5 - lat / Math.PI) * 144))), j = (sy * 320 + sx) * 4;
        const light = Math.max(0.2, Math.min(1, 0.42 + nz * 0.62 - nx * 0.25 + ny * 0.12));
        color = [0, 1, 2].map(k => Math.round(this.pixels[j + k] * light / 12) * 12);
        if (r2 > 0.96) color = [28, 76, 119];
      } else if ((x * 73 + y * 19 + x * y * 3) % 1543 === 0) color = [116, 112, 158];
      image.data.set([...color, 255], i);
    }
    ctx.putImageData(image, 0, 0);
    if (this.region) { ctx.fillStyle = '#071528'; ctx.fillRect(0, 0, 232, 176); ctx.imageSmoothingEnabled = false; const w = 232 / this.zoom, hh = 176 / this.zoom; ctx.drawImage(this.source, 68 - w / 2, 44 - hh / 2, w, hh, 0, 0, 232, 176); }
    this.texture.refresh();
    for (const m of this.townMarks) { const p = this.project(m.town); m.sprite.setPosition(Math.round(p.x), Math.round(p.y)).setFillStyle(m.town.occupied ? 0xd95747 : 0x496c5e).setVisible(p.visible); }
    for (const m of this.markers) { const p = this.project(m.site); m.sprite.setPosition(Math.round(p.x), Math.round(p.y)).setVisible(p.visible); m.label.setPosition(Math.round(p.x), Math.round(p.y + 6)).setVisible(p.visible); }
  }
  action(id) {
    if (id === 'hq') this.region = !this.region;
    else if (id === 'globe') this.region = false;
    else if (id === 'left') { this.region = false; this.yaw -= 0.3; }
    else if (id === 'right') { this.region = false; this.yaw += 0.3; }
    else if (id === 'up') { this.region = false; this.pitch = Math.min(1, this.pitch + 0.2); }
    else if (id === 'down') { this.region = false; this.pitch = Math.max(-1, this.pitch - 0.2); }
    else if (id === 'in') { this.radius = Math.min(84, this.radius + 8); this.zoom = Math.min(4, this.zoom + 0.4); }
    else if (id === 'out') { this.radius = Math.max(48, this.radius - 8); this.zoom = Math.max(1.2, this.zoom - 0.4); }
    this.draw(); this.h.geoLabel?.setText(this.region ? 'HQ REGIONAL MAP  Z = GLOBE' : 'GEOSCAPE  ARROWS ROTATE');
  }
  hit(x, y) { const i = this.markers.findIndex((m, i) => i > 0 && m.sprite.visible && Math.hypot(x - m.sprite.x, y - m.sprite.y) < 9); return i > 0 ? this.sites[i - 1] : null; }
}
