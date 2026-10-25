---
title: Audio
section: Manual
order: 8
summary: Sound effects, music, buses, autoplay rules.
---

Add short sounds for actions and music for atmosphere. Keep the files in your project, choose a volume, and let the player enable audio with a click or tap.

::: dummies
If sound is silent on first load, click the game once. Browsers require a player gesture. Try one short sound before setting up looping music or crossfades.
:::

`this.audio` is a WebAudio manager with four **buses**: `master → music / sfx / ui`. Calls made before the player's first click/key are **queued and replayed** (browsers block audio until a gesture).
Missing or blocked audio never throws into game code.

::: dummies
Think of buses as volume knobs: one knob for music, one for effects, one for menus, and a big master knob over all of them.
:::

**File: your script, for example `scripts/Player.js`** (calls inside any method)
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

3D positional audio is not available yet: a sound plays at the same loudness wherever the camera is.

## Touch-to-start gate (`touchToStart`) {#touch-to-start}
Browsers refuse to play sound until the player has clicked, tapped or pressed a key. Nord queues early `audio.play`/`audio.music` calls and replays them after the first gesture, but a title screen with music still sits silent until then — and the player's very first click would also hit your menu by accident.

`touchToStart` fixes both. It is a ready-made, **opt-in** helper exported from `nord` (`runtime/core/start-gate.js`): a full-screen "TOUCH / CLICK TO ENABLE AUDIO" overlay that waits for the first gesture, **swallows that gesture and its release** (so no menu button is pressed through it), unlocks audio so the queued title music starts, then removes itself. The next click or key is normal game input. Your current screen, camera and project settings are not touched. X-KOM 2026 and Vallout 2 both use it.

::: dummies
It is the "Press any key" screen you know from old games. The game is already drawn behind it; the first touch only switches the sound on and then gets out of the way.
:::

### Add it to a game (3 steps)
1. **Import** it from `nord`.
2. **Build your title screen and queue the title music first**, then install the gate as the last step of setup.
3. **Destroy** it in `onDestroy()`, and keep a reference so your own input code can ignore input while `startGate.active` is true.

**File: `scripts/Boot.js`** (new file; this is the start-gate script, put it on an object of the first scene)
```js
import { NordScript, touchToStart } from 'nord';

export default class MyGame extends NordScript {
  start() {
    this.showTitle();                                  // draw the title + this.audio.music('assets/audio/music/title.mp3')
    this.startGate = touchToStart(this.game, {
      title: 'MY GAME',                                // big heading (default 'READY')
      label: 'TOUCH / CLICK TO ENABLE AUDIO',          // small caption (also the aria-label)
    });
  }
  update(dt) {
    if (this.startGate?.active) return;                // optional: pause game logic while the gate is up
    // ...
  }
  onKey(e) {
    if (this.startGate?.active) return;                // optional: ignore your own key handlers too
    // ...
  }
  onDestroy() { this.startGate?.destroy(); }           // removes the overlay and every listener
}
```

### Options and handle
| Option | Default | Meaning |
|---|---|---|
| `parent` | `document.body` | element the overlay is appended to |
| `title` | `'READY'` | heading text |
| `label` | `'TOUCH OR CLICK TO START AUDIO'` | caption + accessible label |

Returns `{ active, destroy() }`. `active` is `true` until the first gesture. Without a DOM (tests, Rust tier) it returns an inactive no-op handle.

### Good to know
* The first **pointer-down, touch-start or key-down** dismisses it; its release and synthetic click are swallowed for about half a second, so a tap cannot "fall through" to a button. Modifier combos (Ctrl/Cmd/Alt + key) and key auto-repeat are ignored.
* The gate does not choose music or change screens. Start the music yourself *before* installing it; it is replayed when audio unlocks.
* Skip it when you jump straight into gameplay (a `?start=` or `?nogate` URL switch is handy for automated tests, which cannot see the overlay's first click). Example: `if (!new URLSearchParams(location.search).has('nogate')) this.startGate = touchToStart(this.game, { title: 'MY GAME' });`
* In automated browser tests, click once on the page (`page.mouse.click`) when `[data-nord-start-gate]` exists.
* It is not installed by default; games that do not call it are unchanged.
