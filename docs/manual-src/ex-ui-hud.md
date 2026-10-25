---
title: 8 · UI: HUD, buttons and menus
section: Examples
order: 8
summary: Labels, bars, buttons and screens from code, or declarative .ui.json from the UI Designer.
---

**Goal:** a score label, a health bar, a pause menu with buttons.

Nord's game UI is a layer of HTML elements on top of the game (not world objects), so it is always sharp and works on phones. Two ways: from code (quick) or a `.ui.json` file made in the UI Designer (best for menus).

## From code (like creating a Canvas in a script)

**File: `scripts/Hud.js`** (new file, the whole file; attach it to an empty `Hud` object)
```js
import { MonoBehaviour, GameManager } from 'nord';

export default class Hud extends MonoBehaviour {
  Start() {
    this.score = this.ui.label('Score 0', { x: 16, y: 12, size: 28 });                       // top-left
    this.hp    = this.ui.bar(1, { anchor: 'tr', x: 16, y: 16, w: 200, color: '#ff6b6b' });   // top-right
    this.help  = this.ui.label('WASD to move', { anchor: 'c', y: 200, size: 18 });             // centre, 200 px lower
    this.off = this.game.events.on('score', ({ score }) => this.score.set(`Score ${score}`));
  }
  SetHealth(v) { this.hp.set(v); }                         // 0..1
  OnDestroy() { this.off(); this.score.remove(); this.hp.remove(); this.help.remove(); }
}
```
* **Anchors:** `tl` (default), `tr`, `bl`, `br`, `c` (centre; x / y are offsets). `x`/`y` are pixels from that corner.
* **Handles:** every call returns `{ el, remove() }`; labels, buttons and bars also have `.set(...)`. `el` is the real HTML element if you want to style it (`h.el.style.color = 'red'`).
* **Screens:** group elements: `{ screen: 'pause' }` puts them on a named screen; `ui.show('pause')`, `ui.hide('pause')`, `ui.toggle('pause')`, `ui.clear('pause')`. The default screen is `hud` (always shown).
* The UI is **not** destroyed when the scene changes: remove what you made in `OnDestroy`.

## A pause menu

**File: `scripts/Pause.js`** (new file, the whole file; attach it to an empty `Pause` object)
```js
import { MonoBehaviour, GameManager } from 'nord';

export default class PauseMenu extends MonoBehaviour {
  Start() {
    this.ui.label('PAUSED', { screen: 'pause', anchor: 'c', y: -80, size: 48 });
    this.ui.button('Resume',  () => this.Toggle(), { screen: 'pause', anchor: 'c', y: 0 });
    this.ui.button('Restart', () => GameManager.instance.Restart(), { screen: 'pause', anchor: 'c', y: 60 });
  }
  Update() { if (this.game.input.pressed('pause')) this.Toggle(); }   // define a "pause" action: ["Escape"]
  Toggle() {
    const open = !this.ui.isShown('pause');
    open ? this.ui.show('pause') : this.ui.hide('pause');
    open ? this.game.pause() : this.game.resume();                     // freezes update(); UI buttons keep working
  }
  OnDestroy() { this.ui.clear('pause'); this.ui.hide('pause'); }
}
```
Unity: `Time.timeScale = 0` + a Canvas panel. (Setting `Time.timeScale = 0` also works; `game.pause()` freezes the whole scene tick.)

## Menus of buttons

**File: your script, for example `scripts/Menu.js`** (inside `Start()` of the script on the title scene)
```js
this.ui.menu('title', [
  { text: 'Play',    onClick: () => this.game.loadScene('scenes/level1.scene.json') },
  { text: 'Options', onClick: () => this.ui.show('options') },
], { x: 0, y: 0 });
this.ui.show('title');
```

## Declarative UI (UI Designer)
1. @ui[Window ▸ Editors ▸ UI Designer], build a menu with the node palette, save as `ui/menu.ui.json`. Name nodes (`score`, `start`) and give buttons an *Action*.
2. Load it from a script:
```js
async Start() {
  this.menu = await this.ui.load('ui/menu.ui.json');           // shows it as a screen
  this.menu.on('start', () => this.game.loadScene('scenes/level1.scene.json'));   // button action name
  this.menu.set('score', 0);                                    // fills {score} in label texts / bound values
  this.unsub = this.game.events.on('score', ({ score }) => this.menu.set('score', score));
}
```
* In a label write text like `Score {score}`; `menu.set('score', 12)` updates it, and only changed values touch the page.
* Look and feel (fonts, colours, 9-slice pictures) is set in the designer. See [UI Designer](ui-designer.html).

## Health bar above an enemy (world UI)
Easiest: make a child entity with a `sprite` (a small coloured rectangle) and scale its x by `hp / max`:

**File: your script, for example `scripts/Enemy.js`** (inside `Update()` or the damage method; the enemy has a child named `HpBar`)
```js
const bar = this.entity.find('HpBar');
bar.scale = [Math.max(0, hp / max), 1, 1];
```
