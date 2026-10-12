---
title: T09 Audio
section: Tutorials
order: 9
summary: Sound effects through events, music crossfades, volume sliders.
---
**Project:** any game (`examples/platformer` uses `util-sfx.js`).

1. Add the library `util-sfx.js` to any entity. Now **any script** can play a sound with `this.events.emit('sfx', 'jump')`.
2. Its `map` attribute connects events to sounds: `{"pickup":"coin","hit":"hit"}`.
3. Music: `this.audio.music('assets/audio/music/music_adventure.mp3', { fade: 1.5 })` in a scene script; swap to `music_boss.mp3` when the boss appears — it crossfades.
4. Volume UI: `ui-settings.js` offers master/music/sfx sliders; values persist.
5. Remember browsers wait for a click before playing — your calls are queued, not lost.

Reference: [Audio](audio.html). **Next:** [T10 3D scene & camera](tut-t10-3d-scene.html).
