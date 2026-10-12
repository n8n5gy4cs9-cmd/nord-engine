// @nord {"id":"util.pool","title":"Object pool (bullets, particles)","category":"utilities","tier":["2d","3d"],"tags":["pool","performance","spawn"],"description":"Prefab pool: pool.get(pos) reuses a disabled instance instead of spawning, pool.release(entity) disables it. Avoids garbage/spawn cost for bullets. Other scripts: this.scene.find('Pool').getScript(Pool)."}
import { NordScript } from 'nord';

export default class PoolScript extends NordScript {
  static attributes = { prefab: { type: 'asset', assetType: 'prefab', default: '' }, prewarm: { type: 'int', default: 10, min: 0 } };
  async start() { this.free = []; this.all = new Set(); for (let i = 0; i < this.attrs.prewarm; i++) this.free.push(await this.#make()); }
  async #make() { const e = await this.scene.spawn(this.attrs.prefab, { pos: [0, -9999, 0] }); e.enabled = false; this.all.add(e); return e; }
  /** Returns a Promise<Entity> placed at `pos`. */
  async get(pos = [0, 0, 0]) { const e = this.free.pop() ?? (await this.#make()); e.pos = pos; e.enabled = true; return e; }
  release(e) { if (!this.all.has(e) || this.free.includes(e)) return; e.enabled = false; this.free.push(e); }
  get available() { return this.free.length; }
}
