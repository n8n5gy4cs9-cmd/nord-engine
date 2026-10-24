---
title: 44 · Tutorial: Coin Clicker in pure Unity style
section: Examples
order: 44
summary: Build a small game step by step using only MonoBehaviour, Singleton, Instantiate, Random, mouse events and coroutines.
---

**Goal:** coins appear at random places; click them to score; 30 seconds per round. About 60 lines, all Unity-style.

## Step 1: the manager
`scripts/Score.js` (one object `Score` in the scene)
```js
import { Singleton, Debug, Time } from 'nord';
export default class Score extends Singleton {
  Awake() { this.value = 0; this.left = 30; }
  Add(n) { this.value += n; }
  Update() {
    this.left -= Time.deltaTime;
    if (this.left <= 0 && !this.over) { this.over = true; Debug.Log(`Game over: ${this.value}`); }
  }
}
```

## Step 2: the coin
`scripts/Coin.js`, on a coin prefab (sprite + this script)
```js
import { MonoBehaviour, Destroy } from 'nord';
import Score from './Score.js';
export default class Coin extends MonoBehaviour {
  OnMouseDown() { Score.instance.Add(1); Destroy(this.entity); }
  Start() { Destroy(this.entity, 2); }   // disappears after 2 s
}
```

## Step 3: the spawner
`scripts/Spawner.js`, on an empty object
```js
import { MonoBehaviour, Instantiate, Random, WaitForSeconds } from 'nord';
import Score from './Score.js';
export default class Spawner extends MonoBehaviour {
  Start() { this.StartCoroutine(this.Loop()); }
  *Loop() {
    while (!Score.instance.over) {
      yield new WaitForSeconds(Random.Range(0.3, 0.8));
      const p = Random.insideUnitCircle.Mul(200);
      Instantiate('prefabs/coin.prefab.json', { pos: [p.x, p.y, 0] });
    }
  }
}
```

## Step 4: try and extend
1. Create the `coin` prefab (sprite + `Coin`), the objects `Score` and `Spawner`, press @ui[Play], click the coins.
2. Show the score: add a Text UI object and in `Score.Add` set its text (see [UI: HUD](ex-ui-hud.html)).
3. Add `Range`/`Enum` fields (`SerializeField({ roundTime: Range(10, 60, 30) })`) so you can tune it in the Inspector.
4. Save the best round with `PlayerPrefs.SetInt('best', value)`.
5. Smoke-check the same logic headless: `node --test runtime/core/core.test.mjs` has the Unity smoke tests to copy from.

Previous: [Unity helpers cookbook](ex-unity-helpers.html).
