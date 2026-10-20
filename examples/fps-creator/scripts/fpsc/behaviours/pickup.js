// Pickup: gives the player something when touched. give = health | armor | score | ammo_bullets|shells|rockets|cells | weapon_<id> | key_<colour>.
import { yawTo } from '../ai.js';

export default {
  id: 'pickup', title: 'Pickup', cat: 'Items', desc: 'Touch to collect. If the player is already full (health/armor/ammo) it stays. Set respawn > 0 to bring it back.',
  params: {
    give: { type: 'string', label: 'Gives', default: 'health', hint: 'health, armor, score, ammo_bullets, ammo_shells, ammo_rockets, ammo_cells, weapon_shotgun, key_red …' },
    amount: { type: 'number', label: 'Amount', default: 25 },
    message: { type: 'string', label: 'Message', default: '' },
    sound: { type: 'sound', label: 'Sound', default: 'pickup' },
    respawn: { type: 'number', label: 'Respawn after (s, 0 = never)', default: 0, min: 0, max: 600 },
    spin: { type: 'bool', label: 'Spin and bob', default: true },
  },
  start(c) { c.s.t = Math.random() * 6; },
  update(c, dt) {
    const e = c.self, s = c.s, p = c.p, pl = c.player;
    if (s.taken) { if (p.respawn > 0 && (s.back -= dt) <= 0) { s.taken = false; e.setModelVisible(true); e.enabled = true; } return; }
    if (p.spin && e.model) { s.t += dt; e.model.inner.rotation.y = s.t * 1.8; e.model.inner.position.y = 0.18 + Math.sin(s.t * 2.2) * 0.07; }
    if (!pl.alive) return;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    if (dx * dx + dz * dz > (e.radius + pl.radius + 0.35) ** 2 || pl.y > e.y + 1.6 || pl.y + pl.height < e.y - 0.2) return;
    if (!c.game.give(p.give, p.amount)) { if (c.game.time - (s.full ?? -9) > 3) { s.full = c.game.time; c.say(p.give.startsWith('health') ? 'Health is full' : p.give.startsWith('armor') ? 'Armor is full' : p.give.startsWith('key') ? 'Already have this key' : 'Already full', 1.2); } return; }
    if (p.message) c.say(p.message, 2); c.sound(p.sound);
    s.taken = true; s.back = p.respawn; e.setModelVisible(false); e.emit('touched');
    if (!(p.respawn > 0)) e.enabled = false;
  },
};
