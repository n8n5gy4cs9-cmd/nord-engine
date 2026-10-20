// Wall switch / lever. Press E: toggles on/off, emits "on" / "off" / "used" and drives its Target (door → open/close, light → on/off).
import { applyTo } from './_util.js';

export default {
  id: 'switch', title: 'Switch', cat: 'Props', desc: 'Usable lever. Set Target to a door/light/entity name, or add Rules on its "on"/"off"/"used" events.',
  params: {},
  start(c) { c.s.on = false; },
  use(c, by) {
    const e = c.self, s = c.s, p = e.props;
    if (s.used && p.once) return;
    s.on = p.toggle === false ? true : !s.on; s.used = true; c.sound('switch');
    if (e.model?.parts.lever) e.model.parts.lever.rotation.x = s.on ? 0.9 : -0.9;
    applyTo(c, s.on); e.emit(s.on ? 'on' : 'off');
    if (p.once) { e.def = { ...e.def, usable: false }; e.props.usable = false; }
  },
};
