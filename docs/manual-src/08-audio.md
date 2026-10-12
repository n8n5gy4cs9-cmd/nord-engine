---
title: Audio
section: Manual
order: 8
summary: Sound effects, music, buses, autoplay rules.
---
`this.audio` is a WebAudio manager with four **buses**: `master → music / sfx / ui`. Calls made before the player's first click/key are **queued and replayed** (browsers block audio until a gesture).
Missing or blocked audio never throws into game code.

::: dummies
Think of buses as volume knobs: one knob for music, one for effects, one for menus, and a big master knob over all of them.
:::

```js
this.audio.play('assets/audio/sfx/jump.wav');                       // one-shot
const h = this.audio.play('assets/audio/sfx/engine.wav', { loop: true, volume: 0.4, rate: 1.2, pan: -0.5 });
h.stop();
this.audio.music('assets/audio/music/music_adventure.mp3', { fade: 1.5 });  // crossfade
this.audio.stopMusic({ fade: 0.5 });
this.audio.volume('music', 0.5);     // 0..1, persisted
this.audio.mute('sfx', true);
```

* `bus` option: `'sfx'` (default), `'music'`, `'ui'`.
* Volumes and mutes are saved per game in localStorage and restored on start.
* Preload with `this.audio.preload([...paths])` to avoid first-play latency.
* The [`audioSource`](component-audioSource.html) component attaches a clip to an entity (`autoplay`, `loop`, `bus`) and exposes `play()`/`stop()`.
* UI sounds `click` and `hover` (`assets/audio/sfx/click.wav`, `hover.wav`) play automatically for `game.ui` buttons.
* Library: `util-sfx.js` (event-name → sound map via `events.emit('sfx', 'hit')`), `ui-settings.js` (volume sliders).

::: tip
MP3 adds ~25 ms of encoder delay, so use **OGG or WAV** for gapless loops. The Rust tier supports WAV/OGG only.
:::

Audio is not spatialised yet (`audioListener` is a placeholder).
