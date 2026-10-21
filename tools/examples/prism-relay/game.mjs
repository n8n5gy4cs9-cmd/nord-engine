import fs from 'node:fs';
import base from '../crystal-relay/game.mjs';
import { E } from '../lib.mjs';
export default () => {
  const s = base();
  s.name = s.project.name = 'Prism Relay — GLSL workshop';
  s.project.id = 'com.crowelian.prismrelay';
  s.project.input.actions.grid = ['KeyF'];
  s.project.input.actions.glow = ['KeyG'];
  s.files['scripts/relay.js'] = fs.readFileSync(new URL('../crystal-relay/scripts/relay.js', import.meta.url), 'utf8');
  s.scenes.main.entities.push(E('PrismFX', { s: ['scripts/prism.js'] }));
  s.readme = '# Prism Relay\nT35 advanced coding workshop: ordered-crystal time trial with reactive original GLSL platform materials. WASD/Space, Shift sprint, F grid frequency, G glow. Complete material/controller source and T34 rules included. No shader displacement: collider positions stay correct.\n';
  return s;
};
