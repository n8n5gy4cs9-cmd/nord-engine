---
title: 9 · Audio
section: Examples
order: 9
summary: Sound effects, music with crossfade, volume buses and event-driven sounds.
---

**Goal:** a jump sound, looping music, and a volume slider.

Put sounds in `assets/audio/` (`.wav`, `.mp3`, `.ogg`). Browsers only start audio after the player clicks or presses a key; Nord queues your calls so nothing is lost (a *touch-to-start* screen is available, see [Audio](audio.html)).

## Sound effects
### Unity
```cs
[SerializeField] AudioClip jumpClip; AudioSource src;
void Jump() { src.PlayOneShot(jumpClip, 0.8f); }
```
### Nord

**File: your script, for example `scripts/Player.js`** (add this method to the class and call it from `Update()` when the jump key is pressed)
```js
jump() {
  this.audio.play('assets/audio/jump.wav', { volume: 0.8, rate: 1 + this.game.rng.range(-0.05, 0.05) }); // slight pitch variation
}
```
Options: `volume` (0..1), `loop`, `rate` (pitch/speed), `bus` (`sfx` default, `music`, `ui`), `pan` (-1 left … 1 right).
To let designers pick the sound in the Inspector:

**File: your script, for example `scripts/Player.js`** (the `static attributes` line goes inside the class, above `start()`; the `play` call inside `jump()`)
```js
static attributes = { jump: { type: 'asset', assetType: 'audio', default: 'assets/audio/jump.wav' } };
// …
this.audio.play(this.attrs.jump);
```

## Music with crossfade

**File: `scripts/Level.js`** (the `start()` method of the script on an empty `Level` object)
```js
start() { this.audio.music('assets/audio/music/level1.mp3', { fade: 1.5, volume: 0.7 }); }  // fades the old track out
onDestroy() { this.audio.stopMusic({ fade: 0.5 }); }
```
`music(path, { fade, volume, offset, restart })`: calling it with the same track does nothing; with another track it crossfades.

## Volume buses (settings menu)

**File: your script, for example `scripts/Options.js`** (inside the slider callbacks of your options screen)
```js
this.audio.volume('music', 0.5);      // set 0..1; reading: this.audio.volume('music')
this.audio.mute('sfx', true);         // mute / unmute a bus
```
Buses: `master`, `music`, `sfx`, `ui`. Values are remembered between sessions. A ready-made settings screen: library script `ui-settings.js` (sliders for master / music / sfx).

## Unity-style manager

**File: `scripts/Audio.js`** (new file: `import` at the top, then a class that extends `AudioManager`; put the script on one object in the first scene)
```js
import { AudioManager } from 'nord';       // extend it and put the script on one object (persistent)
AudioManager.instance.PlaySfx('assets/audio/coin.wav');
AudioManager.instance.PlayMusic('assets/audio/music/loop.mp3');
AudioManager.instance.SetVolume('music', 0.4);
```

## Sounds from events (no audio code in gameplay scripts)
Add the library script `util-sfx.js` to any object and fill its `map` attribute, e.g. `{"coin":"assets/audio/coin.wav","hit":"assets/audio/hit.wav"}`. Then any script can do:
```js
this.events.emit('sfx', 'coin');
```
Gameplay code stays free of file names, and you can swap sounds in one place.

## Music: one track at a time
`audio.music(path)` is the music player: one track, crossfades when you change it, and **the same track requested again keeps playing** (so a menu and a level can both ask for it without a restart). A *looping* `audio.play(path, { bus: 'music', loop: true })` is treated the same way, so you never get two copies of the music on top of each other. `audio.stopMusic()` stops it (do this in `onDestroy` of a scene's script if the next scene should be quiet). Sound effects and jingles (`play` without `loop`) can overlap freely.
