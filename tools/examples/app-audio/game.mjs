import { appSpec } from '../lib.mjs';
const tracks = ['music_menu_chill', 'music_adventure', 'music_ambient_space', 'music_action'];
export default () => appSpec('app-audio', 'Audio Visualiser', 'audio-player', {
  files: tracks.map((t) => ({ from: `assets/audio/music/${t}.mp3`, to: `audio/${t}.mp3` })),
  bootJs: `, { tracks: ${JSON.stringify(tracks.map((t) => ({ title: t.replace('music_', '').replace(/_/g, ' '), src: `audio/${t}.mp3` })))} }`,
});
