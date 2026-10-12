import { E, rect, camera2d, project, SQUARE } from '../lib.mjs';

export default () => ({
  name: 'Visual Novel',
  project: project('visual-novel', 'Visual Novel', '2d', { bg: '#1d2230', input: { interact: ['Space', 'Enter', 'Mouse0'] } }),
  scenes: { main: { entities: [
    camera2d(320, 180),
    rect('Backdrop', 320, 180, 640, 360, '#2b3550', { z: -5 }),
    rect('Speaker', 320, 150, 120, 200, '#88c0d0', { z: 0 }),
    E('Story', { s: [['scripts/dialogue.js', { file: 'assets/story.json', autostart: true }]] }),
  ] } },
  lib: ['dialogue'], assets: [...[{ from: 'assets/particles/square.png', to: 'assets/sprites/square.png' }]],
  files: { 'assets/story.json': { start: 'a', nodes: {
    a: { speaker: 'Mira', text: 'You finally made it. The lighthouse has been dark for three nights.', next: 'b' },
    b: { speaker: 'Mira', text: 'Do you want to go up and light it, or check the cellar first?', choices: [{ text: 'Light the lamp', next: 'lamp' }, { text: 'Check the cellar', next: 'cellar' }] },
    lamp: { speaker: 'You', text: 'The lamp flares to life. Far out at sea, a ship answers with a horn.', next: 'end' },
    cellar: { speaker: 'You', text: 'Down below, the old generator hums. Someone has been here recently...', next: 'end' },
    end: { speaker: 'Narrator', text: 'To be continued. Edit assets/story.json to write your own story.' },
  } } },
  template: { id: 'visual-novel', title: 'Visual novel', description: 'Branching dialogue from a JSON file (library dialogue script): speakers, typewriter text, choices.' },
  readme: '# Visual novel\nStory lives in `assets/story.json` (nodes with `speaker`, `text`, `next` or `choices`). Space/click advances. Uses the library `gameplay.dialogue` script.\n',
});
