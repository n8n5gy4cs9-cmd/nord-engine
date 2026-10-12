// @nord {"id":"gameplay.health","title":"Health & damage","category":"gameplay","tier":["2d","3d"],"tags":["health","damage","invulnerable","game-ready"],"description":"Hit points with damage/heal, invulnerability frames with blink, death handling. Listens for the entity 'damage' event {amount}; emits 'health' {hp,max} on the entity and global 'died' when it hits 0."}
import { NordScript } from 'nord';

export default class Health extends NordScript {
  static attributes = {
    max: { type: 'number', default: 5, min: 1 },
    invulnTime: { type: 'number', default: 0.8, min: 0 },
    destroyOnDeath: { type: 'bool', default: false },
    barName: { type: 'string', default: '', label: 'Name of a uiBar entity to update' },
    deathEvent: { type: 'string', default: 'died' },
  };
  start() {
    this.hp = this.attrs.max; this.inv = 0;
    this.entity.on('damage', (d) => this.damage(d?.amount ?? 1, d?.from));
    this.entity.on('heal', (d) => this.heal(d?.amount ?? 1));
    this.bar = this.attrs.barName ? this.scene.find(this.attrs.barName) : null; this.#sync();
  }
  update(dt) {
    if (this.inv <= 0) return;
    this.inv -= dt; this.entity.set('sprite', 'alpha', this.inv > 0 && Math.floor(this.inv * 20) % 2 ? 0.3 : 1);
  }
  damage(n, from) {
    if (this.inv > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - n); this.inv = this.attrs.invulnTime; this.#sync();
    this.events.emit('hit', n);
    if (this.hp === 0) { this.entity.emit('death', from); this.events.emit(this.attrs.deathEvent, this.entity); if (this.attrs.destroyOnDeath) this.entity.destroy(); }
    return true;
  }
  heal(n) { this.hp = Math.min(this.attrs.max, this.hp + n); this.#sync(); }
  #sync() { this.entity.emit('health', { hp: this.hp, max: this.attrs.max }); this.bar?.set('uiBar', 'value', this.hp / this.attrs.max); }
}
