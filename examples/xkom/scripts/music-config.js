// Start offsets in seconds. Use 0 for the beginning; reload after editing.
// Invalid offsets or offsets beyond the song length fall back to 0.
// All tracks loop. Radar -> shooter and globe -> base keep playing uninterrupted.
export const MUSIC_CONFIG = {
  fadeInSeconds: 0.35,       // quick fade-in (also used for crossfading songs)
  titleStartSeconds: 0,      // music_title.mp3 — title screen
  baseStartSeconds: 0,       // music_base.mp3 — globe, HQ, research, endings
  interceptStartSeconds: 91, // music_game.mp3 — radar and shooter
  tacticalStartSeconds: 0,   // music_game.mp3 — restart at each tactical mission
  rtsStartSeconds: 0,        // music_game.mp3 — hive alert and each RTS mission
};
