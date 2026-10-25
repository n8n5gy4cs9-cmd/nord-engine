---
title: 12 · Events and messages
section: Examples
order: 12
summary: Global events, per-object events, Inspector signals, UnityEvent and EventBus: who should call whom.
---

**Goal:** a door that opens when a button is pressed, a HUD that reacts to the player's health, achievements that listen to everything: without the scripts knowing each other.

## Three kinds of events
| Kind | Code | Use for |
|---|---|---|
| **Global** (the whole game) | `this.game.events.emit('score', {score})` / `.on('score', fn)` | score, game over, level cleared, language changed |
| **Per object** | `entity.emit('hp', data)` / `entity.on('hp', fn)` | "this enemy died", "this button was pressed", "my health changed" |
| **Inspector signals** | Inspector ▸ Signals: *event → target → method* | designers wire things up without code |

All three return an **unsubscribe function**; `once` exists on the global bus.

## Global events
### Unity
```cs
public static event Action<int> OnScore;   // GameManager
OnScore?.Invoke(5);   OnScore += Handler;   OnScore -= Handler;
```
### Nord

**File: your script, for example `scripts/Coin.js`** (inside a method, the sender)
```js
this.game.events.emit('score', { score: 5 });
const off = this.game.events.on('score', ({ score }) => this.refresh(score));
this.game.events.once('gameover', () => this.showEnd());
off();                                       // unsubscribe (do it in onDestroy)
this.game.events.on('*', ({ name, data }) => console.log(name, data));   // wildcard: every event (great for debugging)
```
Built-in events: `score`, `lives`, `state`, `gameover` (GameManager), `sceneLoad`, `sceneUnload`, `pause`, `resume`, `error`, `language`.

## Events on an object

**File: `scripts/health.js`** (add `entity.emit` in the method that changes hp; the listener goes in another script's `start()`)
```js
// health.js
this.entity.emit('hp', { hp: this.hp, max: this.max });
// healthbar.js (on the same object or any script that has a reference)
const off = this.target.on('hp', ({ hp, max }) => this.bar.set(hp / max));
```
The enemy does not know a health bar exists; the bar needs a reference to the enemy it shows. Unsubscribe in `onDestroy`.

## A door and a button: signals without code
1. Button object: script emits when pressed:

**File: `scripts/button.js`** (new file; attach it to the button object, which has a trigger collider)
```js
onTriggerEnter(o) { if (o.hasTag('player')) this.entity.emit('pressed'); }
```
2. Door object: script has `open()`:

**File: `scripts/door.js`** (new file; attach it to the door object)
```js
open() { this.entity.enabled = false; }
```
3. Select the **button** ▸ @ui[Inspector ▸ Signals ▸ +]: event `pressed`, target `Door`, method `open`. Done: when the button emits `pressed`, `Door`'s scripts get `open(data)` called. (Target empty = the button itself.)

## UnityEvent and EventBus (Unity names)

**File: `scripts/Alarm.js`** (new file, the whole file)
```js
import { MonoBehaviour, UnityEvent, EventBus } from 'nord';

export default class Switch extends MonoBehaviour {
  Awake() { this.onToggled = new UnityEvent(); }          // public UnityEvent onToggled
  Toggle() { this.on = !this.on; this.onToggled.Invoke(this.on); }
}
// elsewhere
const off = lever.onToggled.AddListener((on) => this.light.enabled = on);
off(); // or lever.onToggled.RemoveListener(fn)

EventBus.Subscribe('boss-dead', () => this.ui.show('win'));   // = game.events.on
EventBus.Publish('boss-dead', { name: 'Hydra' });             // = game.events.emit
```

## Event sheets
If a designer wants "when `score` happens, do X" without code, the event-sheet system listens to the same global events ([Event sheets](event-sheets.html)).

## Naming rules that keep you sane
* Past tense for facts: `died`, `coin-collected`, `door-opened`. Imperative for requests: `play-sfx`.
* Put data in one object: `{ score }`, `{ target, damage }`, not separate arguments (an event carries one payload).
* Unsubscribe in `onDestroy`. A global listener left behind keeps running after the scene is gone.

## When to use which
| You need… | Use |
|---|---|
| the answer now | a direct call / getScript |
| to announce, many may listen | `game.events` |
| to announce about *this* object | `entity.emit` |
| designer wiring | Inspector signals |
