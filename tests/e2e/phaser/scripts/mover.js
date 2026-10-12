import { NordScript } from '/runtime/core/index.js';
export default class Mover extends NordScript { update(dt) { this.entity.pos[0] += 30 * dt; this.entity.touch(); } }
