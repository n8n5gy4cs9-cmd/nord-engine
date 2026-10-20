// Breakable: crates and similar. Splinters when killed and may drop an item (entity prop "Drops").
export default {
  id: 'breakable', title: 'Breakable', cat: 'Props', desc: 'Destroyed when health reaches 0; drops the item type in the "Drops" prop.',
  params: {},
  die(c) {
    const e = c.self, g = c.game; e.setModelVisible(false); e.hit = false; const i = g.solids.indexOf(e); if (i >= 0) g.solids.splice(i, 1);
    g.fx.burst([e.x, e.y + 0.5, e.z], { n: 14, color: ['#9a7448', '#5e4528', '#c29a66'], speed: 3, life: 0.7, size: 0.09, gravity: 9 }); c.sound('impact');
    if (e.props.drop) g.spawn(e.props.drop, e.x, e.z, e.layer, {});
  },
};
