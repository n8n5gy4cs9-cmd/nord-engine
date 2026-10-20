// Objective: when every enemy (not marked optional) is dead, emits "cleared" and sets an objective text.
export default {
  id: 'objective-kill-all', title: 'Objective: kill them all', cat: 'Logic', desc: 'Emits "<name>.cleared" when all counted enemies are dead. Use it to unlock the exit.',
  params: { text: { type: 'string', label: 'Objective text', default: 'Eliminate all enemies' }, done: { type: 'string', label: 'Message when done', default: 'Area clear!' } },
  start(c) { c.s.on = true; c.game.objective(c.p.text); },
  update(c, dt) {
    const s = c.s; if (!s.on) return; s.t = (s.t ?? 0) - dt; if (s.t > 0) return; s.t = 0.5;
    if (c.game.ents.some((e) => e.enemy && e.alive && !e.props.optional && !e.destroyed)) return;
    s.on = false; c.say(c.p.done, 3); c.game.objective(''); c.self.emit('cleared');
  },
};
