// AI: peaceful walker. Follows the entity's path points back and forth (or loops) — for civilians, scenery guards or moving props.
import { patrol, turnTo } from '../ai.js';
import { animate } from './_enemy.js';

export default {
  id: 'ai-patrol', title: 'Patrol only', cat: 'AI', desc: 'Walks the path you drew (Path tool) and does nothing else. Add it to civilians or props for movement.',
  params: { speed: { type: 'number', label: 'Speed', default: 1.6, min: 0.2, max: 8, step: 0.1 }, loop: { type: 'bool', label: 'Loop (else ping-pong)', default: true } },
  update(c, dt) { const e = c.self; if (!e.alive) return; const moved = patrol(c.game, e, e.data.path, c.p.speed, dt, c.p.loop); void moved; animate(c, dt, e.data.path?.length ? c.p.speed : 0); },
};
