// @nord {"id":"gameplay.xp-levels","title":"XP, levels & skills","category":"gameplay","tier":["2d","3d"],"tags":["xp","level","rpg","skills"],"description":"Experience and level-ups with a curve (base * level^exp), skill points and a stat table. Global event 'xp' adds experience. Emits 'levelup' {level,points}."}
import { NordScript } from 'nord';

export default class XpLevels extends NordScript {
  static attributes = { base: { type: 'number', default: 50, min: 1 }, exponent: { type: 'number', default: 1.5, min: 1 }, pointsPerLevel: { type: 'int', default: 1 }, maxLevel: { type: 'int', default: 50 }, saveKey: { type: 'string', default: 'xp' } };
  start() { Object.assign(this, { level: 1, xp: 0, points: 0, stats: {} }, this.save.get(this.attrs.saveKey, {})); this.off = this.events.on('xp', (n) => this.gain(n)); }
  onDestroy() { this.off?.(); }
  need(level = this.level) { return Math.round(this.attrs.base * level ** this.attrs.exponent); }
  gain(n) {
    this.xp += n;
    while (this.level < this.attrs.maxLevel && this.xp >= this.need()) { this.xp -= this.need(); this.level++; this.points += this.attrs.pointsPerLevel; this.events.emit('levelup', { level: this.level, points: this.points }); }
    this.save.set(this.attrs.saveKey, { level: this.level, xp: this.xp, points: this.points, stats: this.stats }); this.events.emit('xp:changed', { level: this.level, xp: this.xp, need: this.need() });
  }
  spend(stat) { if (this.points < 1) return false; this.points--; this.stats[stat] = (this.stats[stat] ?? 0) + 1; this.events.emit('stat', { stat, value: this.stats[stat] }); return true; }
}
