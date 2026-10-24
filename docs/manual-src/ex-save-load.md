---
title: 10 · Saving and loading
section: Examples
order: 10
summary: PlayerPrefs-style settings, high scores, save slots with JSON data.
---

**Goal:** remember the high score and the player's progress between sessions.

Saves go to the browser's `localStorage` (the packaged app uses the same API); data is stored per project id, as JSON, in numbered **slots**, with a version number.

## Simple values (PlayerPrefs)
### Unity
```cs
PlayerPrefs.SetInt("best", 120); int best = PlayerPrefs.GetInt("best", 0); PlayerPrefs.Save();
```
### Nord
```js
this.save.set('best', 120);                   // anything JSON-able: numbers, strings, arrays, objects
const best = this.save.get('best', 0);        // second argument = default
// Unity names also work:
import { PlayerPrefs } from 'nord';
PlayerPrefs.SetInt('best', 120); PlayerPrefs.GetInt('best', 0); PlayerPrefs.HasKey('best'); PlayerPrefs.DeleteAll();
```
There is no `Save()` call: writes happen immediately.

## High score the easy way
`GameManager.instance.SaveHighScore()` stores the score only if it beats the old one and returns the best:
```js
const best = GameManager.instance.SaveHighScore('highscore');
this.ui.label(`Best ${best}`, { anchor: 'c', y: 40 });
```

## Whole game state in a slot
```js
// save
saveGame() {
  const p = this.scene.find('Player');
  this.save.slot(1).set('game', {
    scene: this.scene.name, pos: p.pos, hp: p.getScript(Health).hp,
    inventory: Inventory.instance.items, score: GameManager.instance.score,
  });
}
// load
async loadGame() {
  const g = this.save.slot(1).get('game', null);
  if (!g) return;                                      // nothing saved yet
  await this.game.loadScene(`scenes/${g.scene}.scene.json`);   // then restore the objects (the new scene's scripts are new!)
  const p = this.game.scene.find('Player');
  p.pos = g.pos; p.getScript(Health).hp = g.hp;
}
```
* `save.slot(n)` selects the slot for the following calls (keep using `slot(1)` the same way everywhere).
* `save.has(n)` tells whether a slot exists; `save.delete(n)` removes it; `save.all()` returns the slot's data object.

::: tip
Remember: loading a scene creates **new** objects. Restore values *after* `await loadScene`, from the new scene's objects.
:::

## Settings (volume, language, controls)
```js
const vol = this.save.get('settings.volume', 0.8);
this.audio.volume('master', vol);
this.save.set('settings.volume', 0.5);
```
(Audio volumes are also remembered by the audio system itself.)

## Versioning
Slots store a version (`new Save(id, { version: 2, migrate: (data, fromVersion) => data })` when you create it yourself). A plain project keeps version 1; when you change your save format later, add a `migrate` function and bump the version so old saves still load.

## Clearing saves while developing
`this.save.delete()` in the Dev Console (`exec game.save.delete()`), or clear the site data of the browser pane. See [Debugging](ex-debug-tools.html).
