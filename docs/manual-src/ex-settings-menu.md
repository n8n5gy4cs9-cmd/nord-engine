---
title: 33 · Options menu: volume, language, fullscreen, key rebinding
section: Examples
order: 33
summary: A settings screen that remembers its values, switches language, sets volumes, toggles fullscreen and lets the player rebind keys.
---

**Goal:** an options screen like a real game, saved between sessions.

## Ready-made
Library **Settings screen** `ui-settings.js` (sliders for master / music / sfx, remembered) and `ui-pause.js`, `ui-main-menu.js`. Add them and you have the basics. The pieces below show how each part works so you can build your own.

## Volumes

**File: `scripts/Options.js`** (inside `Start()` of the script on the options screen, after `this.ui.load(...)`)
```js
// sliders from the UI Designer: nodes named "music" and "sfx" of type slider with on.changed actions "music" / "sfx"
const menu = await this.ui.load('ui/options.ui.json');
menu.on('music', (v) => this.audio.volume('music', v));      // v = the slider value (0..1), sent when the player lets go
menu.on('sfx',   (v) => this.audio.volume('sfx', v));
menu.set('music', this.audio.volume('music'));               // show the current value
```
Audio volumes are saved by the audio system itself. Mute: `this.audio.mute('music', true)`.

## Language

**File: `nord.project.json`** (the `strings` block, one table per language) and **a script** that switches the language:
```js
// nord.project.json: "strings": { "en": { "play": "Play" }, "fi": { "play": "Pelaa" } }   (text objects use textKey: "play")
this.game.i18n.setLanguage('fi');                 // every textKey text updates
this.game.i18n.t('play');                         // "Pelaa" for code-made text
this.game.i18n.languages;                         // ['en', 'fi']
// the chosen language is remembered automatically and restored at the next start
```
Event `language` is emitted on the global bus when it changes: redraw your own labels there.

## Fullscreen

**File: `scripts/Options.js`** (inside the button callback; browsers allow fullscreen only inside a click)
```js
this.ui.button('Fullscreen', () => {                     // must happen inside a click (browser rule)
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
}, { screen: 'options', anchor: 'c', y: 40 });
```
(The desktop app has its own window controls: [Desktop apps](desktop-apps.html).)

## Accessibility

**File: `scripts/Options.js`** (inside `Start()` or an options-menu callback)
```js
this.game.a11y.setColorBlind('deuteranopia');     // 'none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'
this.game.a11y.setUiScale(1.25);                  // bigger UI
```

## Rebinding keys
The actions are just a map: `this.input.actions` is `{ jump: ['Space'], left: ['KeyA', 'ArrowLeft'], … }` and it can be changed while the game runs.

**File: `scripts/Rebind.js`** (new file, the whole file)
```js
import { MonoBehaviour } from 'nord';

export default class Rebind extends MonoBehaviour {
  Start() {
    const saved = this.save.get('keys', null);
    if (saved) Object.assign(this.input.actions, saved);              // apply the player's keys at startup
  }

  // call from a button: this.Capture('jump')
  Capture(action) {
    this.label?.set(`Press a key for "${action}"…`);
    const once = (e) => {
      e.preventDefault(); e.stopPropagation();
      window.removeEventListener('keydown', once, true);
      this.input.actions[action] = [e.code];                           // 'KeyZ', 'Space', 'ArrowUp'…
      this.save.set('keys', this.input.actions);                       // remember
      this.label?.set(`${action} = ${e.code}`);
    };
    window.addEventListener('keydown', once, true);                    // capture phase: the game does not see this key press
  }
}
```
Gamepad buttons are codes like `Gamepad0`; mouse buttons `Mouse0`. To list the current bindings: `Object.entries(this.input.actions)`.

## A pause screen that opens the options

**File: `scripts/Pause.js`** (inside `Start()`, after both screens are created)
```js
this.ui.button('Options', () => { this.ui.hide('pause'); this.ui.show('options'); }, { screen: 'pause', anchor: 'c', y: 60 });
this.ui.button('Back',    () => { this.ui.hide('options'); this.ui.show('pause'); }, { screen: 'options', anchor: 'c', y: 120 });
```
See [UI](ex-ui-hud.html) for pausing the game while it is open.

## Settings in one place

**File: `scripts/Settings.js`** (new file; put it at the top of the file that reads and writes settings)
```js
const DEFAULTS = { language: 'en', shake: true, difficulty: 'normal' };
export const settings = () => ({ ...DEFAULTS, ...this.save.get('settings', {}) });
```
Keep all options in one saved object so adding one more option is one line.
