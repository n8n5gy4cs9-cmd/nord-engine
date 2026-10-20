// Explosive: blows up when killed (shot, hit by a blast). Chain-reacts with other explosives.
export default {
  id: 'explosive', title: 'Explodes when destroyed', cat: 'Props', desc: 'On death: splash damage in "Blast radius" (entity props) and the model disappears.',
  params: {},
  die(c, src) {
    const e = c.self, g = c.game, p = e.props;
    e.setModelVisible(false); e.hit = false; const i = g.solids.indexOf(e); if (i >= 0) g.solids.splice(i, 1);
    g.after(0.08, () => g.explode([e.x, e.y + 0.5, e.z], +p.radius || 4.5, +p.damage || 90, src, { skip: e }));
  },
};
