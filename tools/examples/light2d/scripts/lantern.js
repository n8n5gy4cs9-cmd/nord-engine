import { NordScript } from 'nord';

// The hero's light: a steady halo plus a flashlight beam (hold fire = Mouse0 / Space) that costs oil. Keys 1-5 swap the beam colour.
// Children named 'Halo' and 'Beam' carry the fx.light2d-source scripts; oil flasks emit the global event 'oil-flask'.
const COLORS = ['#fff1c9', '#8fb8ff', '#8dffa6', '#d896ff', '#ff6a5a'];
export default class Lantern extends NordScript {
  static attributes = {
    maxOil: { type: 'number', default: 100, min: 1 },
    beamDrain: { type: 'number', default: 6, min: 0, label: 'Oil per second while the beam is on' },
    haloDrain: { type: 'number', default: 0.35, min: 0 },
    flask: { type: 'number', default: 35, min: 0, label: 'Oil restored per flask' },
  };
  isLantern = true;
  start() {
    const light = (n) => this.entity.find(n)?.scripts.find((s) => s.isLight2D);
    this.halo = light('Halo'); this.beam = light('Beam');
    this.oil = this.attrs.maxOil; this.dead = false; this.color = 0; this.k = 0;
    this.baseHalo = this.halo.radius; this.baseBeam = this.beam.radius;
    this.offs = [this.events.on('oil-flask', () => { this.oil = Math.min(this.attrs.maxOil, this.oil + this.attrs.flask); this.events.emit('toast', { text: 'Oil +' + this.attrs.flask, color: '#ffc34d' }); }), this.events.on('died', () => { this.dead = true; })];
  }
  onDestroy() { this.offs?.forEach((o) => o()); }
  update(dt) {
    const a = this.attrs;
    for (let i = 0; i < 5; i++) if (this.input.pressed('c' + (i + 1))) { this.color = i; this.beam.setColor(COLORS[i]); this.events.emit('toast', { text: 'Beam colour ' + (i + 1), color: COLORS[i] }); }
    const firing = !this.dead && this.input.down('fire') && this.oil > 0.5;
    this.k += ((firing ? 1 : 0) - this.k) * Math.min(1, 12 * dt); // the beam eases on/off
    this.beam.on = this.k > 0.02; this.beam.intensity = 1.25 * this.k;
    this.oil = Math.max(0, this.oil - (this.dead ? 0 : a.haloDrain + (firing ? a.beamDrain : 0)) * dt);
    const low = Math.min(1, this.oil / 25); // the halo shrinks and gutters as the oil runs out
    this.halo.radius = this.baseHalo * (0.45 + 0.55 * low); this.halo.intensity = this.dead ? 0.15 : 0.45 + 0.35 * low;
    this.halo.attrs.flicker = this.oil < 25 ? 0.35 : 0.1;
    this.events.emit('oil', { oil: this.oil, max: a.maxOil, firing });
  }
}
