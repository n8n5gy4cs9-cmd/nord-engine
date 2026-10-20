// Trigger: checkpoint. Touch to save the player's state; "Retry from checkpoint" restarts here.
export default {
  id: 'trigger-checkpoint', title: 'Checkpoint', cat: 'Triggers', desc: 'Saves health/ammo/keys/position when touched (once per visit). The flag turns on.',
  params: {},
  update(c, dt) {
    const e = c.self, s = c.s, pl = c.player, r = +e.props.radius || 2.2;
    if (e.model?.parts.flag) e.model.parts.flag.rotation.y = Math.sin(c.game.time * 2) * 0.25;
    if (!pl.alive || s.hit) return;
    if (Math.hypot(pl.x - e.x, pl.z - e.z) < r && Math.abs(pl.y - e.y) < 2) { s.hit = true; c.game.saveCheckpoint(e); e.emit('touched'); if (e.model) e.model.mats.forEach((m) => { if (m.glow) m.base = [0.3, 1, 0.5]; }); }
  },
};
