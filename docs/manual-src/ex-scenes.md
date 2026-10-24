---
title: 11 · Scenes and persistent objects
section: Examples
order: 11
summary: Load scenes, restart, keep objects alive between scenes and pass data along.
---

**Goal:** a menu scene, a level scene, and a score that survives the change.

## Load and restart
### Unity
```cs
SceneManager.LoadScene("Level2");  SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
```
### Nord
```js
await this.game.loadScene('scenes/level2.scene.json');   // returns a Promise: await it if you do something afterwards
await this.game.restart();                              // reload the current scene from its saved data
// Unity names:
import { SceneManager } from 'nord';
SceneManager.LoadScene('scenes/level2.scene.json'); SceneManager.ReloadScene(); SceneManager.sceneName;
```
The first scene is `startScene` in `nord.project.json` (@ui[File ▸ Build Settings]). Scene paths are project-relative.

## What happens to the old scene
All its objects are destroyed (`onDestroy` runs on every script), its timers and tweens are cancelled, and a new scene is built and started. **The UI layer is not cleared**: remove your labels in `onDestroy`. The game services (`game.save`, `game.events`, `game.audio`, input) live on.

## DontDestroyOnLoad: persistent objects
Two ways:
1. A **Singleton** with `static persistent = true` (GameManager, AudioManager and your own). Put the object in the **first** scene only.
2. Any object: @ui[Inspector ▸ + Add behavior ▸ Persist]. When a scene loads, the surviving object replaces the copy of the same name that the new scene contains, so you can safely put the same *Music* object in every scene.

```js
import { Singleton } from 'nord';
export default class PlayerData extends Singleton {
  static persistent = true;
  Awake() { this.coins = 0; this.level = 1; }
}
// level 1:  PlayerData.instance.coins += 5;   then load level 2:  PlayerData.instance.coins is still 5
```
The object comes back in the next scene and every script gets its **field values** back (like Unity's `DontDestroyOnLoad`): score, coins, state, your own arrays and objects. What does *not* carry over: running coroutines, `Invoke` timers and tweens of that object (they are cancelled with the old scene: start them again in `Start()`), UI you created (remove and recreate it), and scripts added to the object from code with `addScript` (they have no file to rebuild from: put the script in the Inspector instead). `game.restart()` starts from scratch on purpose.

## Passing data to the next scene
* A persistent singleton (above): simplest.
* `this.game.save.set('next', {...})` and read it in the next scene's `start()`.
* A game-wide variable: `GameManager.instance.Set('spawnPoint', 'door2')`, read with `Get`.

## Restart rules
`game.restart()` rebuilds the *current* scene, resets time scale / pause / input, and **drops** persistent objects (fresh game). `restart({ preservePersistent: true })` keeps them.

## Events around loading
```js
this.game.events.on('sceneLoad', (name) => this.log('loaded', name));
this.game.events.on('sceneUnload', (name) => {});
```

## Fade between scenes
```js
async goTo(path) {
  this.game.camera.fade(400);                      // fade to black (ms)
  await new Promise((r) => setTimeout(r, 420));
  await this.game.loadScene(path);
  this.game.camera.fadeIn(400);
}
```

## Several scenes at once (UI overlays)
Nord has one active scene. For a HUD or pause screen that exists in every level, either use a persistent object or build it from code / a `.ui.json` screen (see [UI](ex-ui-hud.html)): UI screens are independent of scenes.
