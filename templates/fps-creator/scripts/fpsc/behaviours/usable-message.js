// Terminal: press E to show a message (and emit "used" for Rules).
export default {
  id: 'usable-message', title: 'Terminal / message', cat: 'Props', desc: 'Shows the entity\'s Message text when used. Add Rules on "used" to do more.',
  params: {},
  use(c) { const e = c.self; c.say(e.props.text || '', +e.props.seconds || 3); c.sound('beep'); if (e.props.once) { c.s.done = true; e.def = { ...e.def, usable: false }; } },
};
