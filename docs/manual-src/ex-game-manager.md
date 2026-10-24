---
title: 4 · GameManager and Singletons
section: Examples
order: 4
summary: Keep score, lives and game state in one place; other scripts call it and listen to it. Unity's singleton GameManager, step by step.
---

**Goal:** one manager that knows the score, the lives and whether the game is over. A coin tells it "+1", a HUD listens and redraws, an enemy asks "is the game still running?".

## Unity (C#)
```cs
public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }
    public int score; public event System.Action<int> OnScore;
    void Awake() { if (Instance != null) { Destroy(gameObject); return; } Instance = this; DontDestroyOnLoad(gameObject); }
    public void AddScore(int n) { score += n; OnScore?.Invoke(score); }
}
// elsewhere:  GameManager.Instance.AddScore(1);
```

## Nord: use the built-in GameManager
1. @ui[Assets ▸ right-click `scripts` ▸ New GameManager script]. It creates `export default class extends GameManager {}`.
2. Create an empty object called *GameManager* in the **first** scene and add that script. (It survives scene loads by itself.)
3. Use it anywhere:
```js
import { GameManager } from 'nord';

GameManager.instance.AddScore(1);          // score += 1, emits 'score' { score }
GameManager.instance.LoseLife();           // lives -= 1, emits 'lives' { lives }, at 0: GameOver()
GameManager.instance.SetState('paused');   // emits 'state' { state, previous }
if (GameManager.instance.state === 'playing') { /* … */ }
GameManager.instance.Set('keys', 2);       // free data store: Get('keys', 0)
GameManager.instance.Restart();            // score and lives reset, scene reloaded
```
Full member list: [Unity-style scripting](unity-scripting.html). Its Inspector field `startLives` sets the starting lives.

::: tip
`GameManager.instance` is `null` until the manager's object exists in the **current scene** and has run `Awake`. Use it from `Start()` or later, not in a script's `Awake()`.
:::

## Listening: a HUD that redraws itself
The manager does not know the HUD exists. It emits events on the global bus (`this.game.events`); the HUD subscribes.
```js
import { MonoBehaviour, GameManager } from 'nord';

export default class Hud extends MonoBehaviour {
  Start() {
    const gm = GameManager.instance;
    this.label = this.ui.label(`Score ${gm.score}`, { x: 16, y: 10, size: 26 });
    this.off = [                                   // keep the unsubscribe functions
      this.game.events.on('score', ({ score }) => this.label.set(`Score ${score}`)),
      this.game.events.on('gameover', () => this.label.set('Game over')),
    ];
  }
  OnDestroy() { this.off.forEach((f) => f()); this.label.remove(); }   // always clean up
}
```
Unity's `OnScore += handler; … OnScore -= handler;` is `const off = events.on(...)` and `off()`.

## Writing your own manager (any Singleton)
```js
import { Singleton } from 'nord';

export default class Inventory extends Singleton {
  static persistent = true;                 // keep it when another scene loads (DontDestroyOnLoad)
  Awake() { this.items = {}; }
  Add(id, n = 1) {
    this.items[id] = (this.items[id] ?? 0) + n;
    this.game.events.emit('inventory', { id, count: this.items[id] });
  }
  Count(id) { return this.items[id] ?? 0; }
}
```
* Put the script on **one** object in the scene; a second copy destroys itself with a warning.
* Call it: `Inventory.instance.Add('key')` and `Inventory.require()` (throws a clear error when missing).
* Import the class where you use it: `import Inventory from './inventory.js';` (or call it by class name when it is registered as a library script).

::: warn
**Subclasses:** `class CoinManager extends GameManager {}` is reachable as `CoinManager.instance` **and** as `GameManager.instance`. If you write your own base class between `Singleton` and your manager, the same applies up the chain.
:::

## A simple state machine on top
```js
// states: 'menu' | 'playing' | 'paused' | 'gameover'
GameManager.instance.SetState('playing');
this.game.events.on('state', ({ state, previous }) => {
  if (state === 'paused') this.ui.show('pause'); else this.ui.hide('pause');
});
```
Scripts that must stop when the game is over just check `GameManager.instance.state !== 'playing'` at the top of `Update`.

## Which way to talk? calls vs events
| Use a direct call | Use an event |
|---|---|
| "do this now and I need the result": `Inventory.instance.Count('key')` | "something happened, whoever cares can react": `emit('score')` |
| the receiver is a known single object | there can be zero, one or many listeners (HUD, sound, achievements) |
