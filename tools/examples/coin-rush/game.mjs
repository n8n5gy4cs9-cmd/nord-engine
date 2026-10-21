import fs from 'node:fs';
import base from '../platformer/game.mjs';
export default () => {
  const s = base();
  s.name = s.project.name = 'Coin Rush — code workshop';
  s.project.id = 'com.crowelian.coinrush';
  delete s.template;
  s.files ??= {};
  s.files['LICENSE'] = fs.readFileSync(new URL('../../../LICENSE', import.meta.url), 'utf8');
  for (const file of ['enemy.js', 'boss.js', 'hero-fx.js'])
    s.files['scripts/' + file] = fs.readFileSync(new URL('../platformer/scripts/' + file, import.meta.url), 'utf8');
  const systems = s.scenes.main.entities.find(e => e.name === 'Systems');
  systems.scripts = systems.scripts.filter(x => !['scripts/score.js', 'scripts/ui-gameover.js'].includes(x.path));
  systems.scripts.push({ path: 'scripts/course.js', attributes: {} });
  s.readme = '# Coin Rush\nFull coding workshop T33. WASD/arrows + Space jump; Shift/K dash. Collect eight coins and defeat the boss before the timer runs out. Three lives, combo scoring, checkpoint flags, pause/restart buttons and a saved best score.\n';
  return s;
};
