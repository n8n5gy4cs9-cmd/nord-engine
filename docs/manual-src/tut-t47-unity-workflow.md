---
title: T47 The Unity-style workflow
section: Tutorials
order: 47
summary: New scene, Scene-view tools, a shared material, a prefab and a variant, a GameManager singleton, then Build And Run.
---
**Result:** a small 3D scene with a lava-coloured cube that is a prefab, a variant of it, a score kept by a `GameManager`, and a web build you open with one click. Allow 25 minutes. **Start from:** any 3D project (`nord new lab -t 3d`).

<figure class="shot"><img src="assets/screenshots/ed-unity-layout.png" alt="The Unity 2 by 3 layout" loading="lazy"><figcaption>Step 1 gives you this arrangement.</figcaption></figure>

::: dummies
This tutorial shows the editor habits people know from Unity: layouts, the Q-W-E-R-T tools, prefabs, material files, a singleton for the score, Build Settings. Everything is still Nord underneath.
:::

## 1. Layout and a fresh scene
1. **Window ▸ Layout ▸ Unity 2 by 3**. Hierarchy is on the left, Scene and Game side by side, Inspector on the right.
2. **File ▸ New scene…**, name it `lab`, template **3D starter**. You get a camera, a sun, a ground and a cube.

## 2. Move around the Scene view
* **Alt + left-drag** orbits, **Alt + Cmd + left-drag** or **middle-drag** pans, the wheel zooms, **F** frames the selection, **Shift+F** frames everything.
* Click the cube. Press **W** (move), **E** (rotate), **R** (scale). Hold **Ctrl/Cmd** while dragging to flip snapping for that drag.
* Shift-click a second object: the Inspector now says *2 ENTITIES SELECTED* and edits both at once.

## 3. A shared material
1. **Assets ▸ Create ▸ Material**, name it `lava`. Select it: set **Color** `#ff6a2a`, **Roughness** `0.35`.
2. Select the cube. In its `material` component set **Asset** to `assets/lava.mat.json`. Every cube that uses this file now changes when you edit it.

<figure class="shot"><img src="assets/screenshots/ed-material-asset.png" alt="A material asset in the Inspector" loading="lazy"><figcaption>The material asset with its preview sphere.</figcaption></figure>

## 4. A prefab and a variant
1. Right-click the cube in the Hierarchy ▸ **Create prefab** (or drag it onto the Assets panel). It becomes a blue instance.
2. Duplicate the instance (**Cmd+D**) a few times and move them apart.
3. In Assets, right-click `Cube.prefab.json` ▸ **Create variant**. Open the variant instance's Inspector, change a value, then **Apply all**: the variant stores only its own change and keeps following the original.
4. Select an instance and press **Open prefab**: the bar above the Scene shows **◀ Scene › Prefab: Cube**. Change the scale, press **◀ Scene**. It saves automatically and every instance updates.

## 5. A GameManager for the score
1. **Assets ▸ Create ▸ GameManager script**, name it `game-manager.js`, and attach it to an empty entity named `Manager` (GameObject ▸ Empty, then drop the script on it).
2. **Assets ▸ Create ▸ MonoBehaviour script**, name it `coin.js`, and replace its content with:
```js
import { MonoBehaviour, GameManager } from 'nord';
export default class Coin extends MonoBehaviour {
  OnTriggerEnter(other) {
    if (!other.CompareTag('player')) return;
    GameManager.instance.AddScore(10);
    this.Destroy();
  }
}
```
3. Attach `coin.js` to a cube that has a trigger [`collider`](component-collider.html), and give the player the tag `player`. Press **Play (F5)**. Open **Window ▸ Profiler** to see the frame time.
4. Tick **Error Pause** in the Game toolbar: the game pauses on the first error, which is a good habit while you experiment. The **📷** button saves a screenshot into `screenshots/`.

## 6. Build it
**File ▸ Build Settings…** (Shift+Cmd+B). Untick scenes you do not want to ship, pick `lab` as the start scene, press **Build And Run**. The page opens in your browser.

<figure class="shot"><img src="assets/screenshots/ed-build-settings.png" alt="Build Settings" loading="lazy"><figcaption>Build Settings: scenes in the build, start scene, platforms.</figcaption></figure>

**Check yourself:** the lava cubes share one material file; editing the prefab changed every instance; `GameManager.instance.score` goes up when a coin is touched. If a step does not match, the *Help ▸ First 10 minutes* checklist shows what the editor still sees as missing.

Reference: [Unity-style workflow](unity-workflow.html), [Scripting ▸ Unity-style scripting](scripting.html). **Next:** [T10 3D scene & camera](tut-t10-3d-scene.html).
