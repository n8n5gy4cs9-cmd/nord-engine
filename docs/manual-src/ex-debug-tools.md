---
title: 16 · Debugging and the Dev Console
section: Examples
order: 16
summary: Logging with tags, the Console, errors, hot reload, the profiler and the in-game console for cheats.
---

## Logging
### Unity
```cs
Debug.Log("hit"); Debug.LogWarning("low"); Debug.LogError("boom");
```
### Nord
```js
this.log('hit', damage);                  // [ScriptName] hit 5      (also this.warn, this.error)
console.log('[Combat] hit', damage);      // any console.* works; "[Tag]" at the start becomes a filterable tag
import { Debug } from 'nord'; Debug.Log('x'); Debug.LogWarning('y'); Debug.LogError('z'); Debug.Assert(hp >= 0, 'negative hp');
```
Lines appear in the editor @ui[Console] tab (**Play** mode and the game running in a browser pane): grey info, yellow warnings, red errors. Use the **tag drop-down** to see only `[Combat]`, the search box to find text (highlighted), double-click a line with `file.js:12` to open it. See [Organising your project](organise-project.html).

## Errors
A script that throws does **not** stop the game: the error is caught, shown in a red overlay and in the Console with the script and method (`Hud.update: TypeError…` plus the stack), and the other scripts keep running. `this.game.errors` lists them. Click the overlay to dismiss. In the Console, enable *Pause on error* to freeze the game at the first error.

## Hot reload
Save a script while the game is running and the new code replaces the old one in the live objects (their fields are kept). If you need to migrate state, add `onHotReload(oldState) {}`. If a change cannot be swapped (scene JSON, new imports) the page reloads instead.

## Look at an object while playing
@ui[Play] ▸ select the object in the Hierarchy: the Inspector shows its live values. Changes made while playing are lost when you stop (like Unity).

## The in-game Dev Console (cheats and QA)
Add the library prefab `Dev Console` and press the key left of 1:
```
> help
> entities
> get-object-info Player
> set-pos Player 200 120 0
> timescale 0.2
> instantiate prefabs/enemy.prefab.json 300 100 2
> exec game.scene.find('Player').getScript(Health).hp = 999
```
Your own commands, one line each: [In-game Dev Console](dev-console.html).

## Profiler
`game.enableDebug()` (or the editor's profiler panel) records per-phase time (scripts, physics, components…) and per-script-method cost. See the profiler page in the manual.

## Quick checks in the browser console
`window.__nord` is the running game: `__nord.scene.find('Player').pos`, `__nord.time.elapsed`, `__nord.errors`. Useful with the browser's developer tools (@ui[Open in browser] on the Game panel).

## Common problems
| Symptom | Likely cause |
|---|---|
| nothing happens | script not attached, object disabled, or you wrote `update` in a MonoBehaviour (use `Update`) |
| `X.instance` is null | the Singleton's object is not in this scene yet, or you used it in `Awake` |
| `Cannot read properties of null` | `scene.find()` returned null (wrong name) or the object was destroyed: check `destroyed` |
| pick-up never fires | the picker has no rigidbody, or the trigger object has no `trigger` component |
| movement jitters | moved with `pos` in `update` while physics also moves it: use `setVelocity` in `fixedUpdate` |
