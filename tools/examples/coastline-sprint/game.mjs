import { project } from '../lib.mjs';
const files = ['app.js', 'track.js', 'render.js', 'audio-config.js'].map((name) => ({
  from: 'tools/examples/coastline-sprint/src/' + name,
  to: name,
}));
files.push(
  { from: 'tools/examples/retro-common/audio.js', to: 'audio.js' },
  { from: 'LICENSE', to: 'LICENSE' },
);
for (const name of ['racing-cars', 'roadside'])
  for (const ext of ['.png', '.png.meta.json'])
    files.push({
      from: 'assets/packs/nord-amiga/' + name + ext,
      to: 'assets/sprites/' + name + ext,
    });
for (const name of [
  'coast-drive',
  'coast-night',
  'engine',
  'crash',
  'skid',
  'checkpoint',
  'win',
])
  files.push({
    from: 'assets/audio/retro-tutorials/' + name + '.mp3',
    to: 'assets/audio/' + name + '.mp3',
  });
export default () => ({
  name: 'Coastline Sprint — Amiga road racer',
  project: { ...project('coastline-sprint', 'Coastline Sprint', 'html'), startScene: '' },
  html: { module: 'app.js', files },
  readme:
    '# Coastline Sprint\nT38 full coding workshop. One playable curved/hilly coast course, traffic, off-road slowdown, collisions, nitro and two time checkpoints. Solo keyboard or top/bottom split: P1 keyboard, P2 standard gamepad. WASD/arrows drive, Shift nitro, P pauses. Gamepad left stick, RT/A throttle, LT/B brake, X nitro. Original Nord Amiga red/white car art; two original MP3 music tracks and local SFX, configurable in audio-config.js. Full source/assets/audio ship with the tutorial.\n',
});
