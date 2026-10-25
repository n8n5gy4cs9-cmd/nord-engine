---
title: 25 · Talking to NPCs: interaction and dialogue
section: Examples
order: 25
summary: Press E near a character, branching dialogue from a JSON file with typewriter text and choices, and reacting to the answers.
---

**Goal:** walk up to an NPC, press E, read a conversation with choices, and open a door when you said the right thing.

## "Press E" interaction
### Unity
```cs
void OnTriggerEnter2D(Collider2D o) { if (o.CompareTag("Player")) prompt.SetActive(true); }
void Update() { if (inRange && Input.GetKeyDown(KeyCode.E)) Talk(); }
```
### Nord
Add an `interact` action to `nord.project.json` (`"interact": ["KeyE"]`). The NPC object has a `trigger` (a circle around it) and this script:
```js
import { MonoBehaviour } from 'nord';

export default class Npc extends MonoBehaviour {
  Awake() { this.near = false; }
  Start() { this.hint = this.ui.label('E: talk', { anchor: 'c', y: 120, size: 20, screen: 'hint' }); }
  OnTriggerEnter(o) { if (o.hasTag('player')) { this.near = true; this.ui.show('hint'); } }
  OnTriggerExit(o)  { if (o.hasTag('player')) { this.near = false; this.ui.hide('hint'); } }
  Update() {
    if (this.near && this.input.pressed('interact')) this.game.events.emit('dialogue:start', 'hello');   // node id to start from
  }
  OnDestroy() { this.hint?.remove(); this.ui.hide('hint'); }
}
```
In 3D, the library `interact-ray.js` does "look at it and press E" with a ray.

## The dialogue box (library)
Add the library script **Dialogue** (`dialogue.js`) to any object (a "Dialogue" manager object is fine). Its `file` attribute points at a JSON file:

`data/npc-guard.dialogue.json`
```json
{
  "start": "hello",
  "nodes": {
    "hello":  { "speaker": "Guard", "text": "Halt! Nobody passes without the password.", "choices": [
                  { "text": "Open sesame", "next": "wrong" },
                  { "text": "The moon is made of cheese", "next": "ok", "flag": "guardOk" },
                  { "text": "Leave", "next": "bye" } ] },
    "wrong":  { "speaker": "Guard", "text": "Nope.", "next": "hello" },
    "ok":     { "speaker": "Guard", "text": "Ha! Correct. Go on.", "next": "bye" },
    "bye":    { "speaker": "Guard", "text": "Safe travels." }
  }
}
```
* A node has `speaker`, `text` (typewriter) and either `next` (press E / the *interact* action to continue) or `choices` (buttons). A node without `next` or `choices` ends the conversation.
* Start it with `this.game.events.emit('dialogue:start', 'hello')` (a node id) or tick `autostart`.

## Reacting to the conversation
The dialogue emits global events you can listen to anywhere:

**File: your script, for example `scripts/Quest.js`** (inside `Start()`; keep the returned functions and call them in `OnDestroy()`)
```js
this.game.events.on('dialogue:choice', (choice) => { if (choice.flag) GameManager.instance.Set(choice.flag, true); });   // remember answers
this.game.events.on('dialogue:end', () => this.OpenGateIfAllowed());
// the gate:
OpenGateIfAllowed() { if (GameManager.instance.Get('guardOk', false)) this.scene.find('Gate').enabled = false; }
```
Freeze the player while talking:

**File: your script, for example `scripts/Player.js`** (inside `Start()`)
```js
this.game.events.on('dialogue:start', () => GameManager.instance.SetState('talking'));
this.game.events.on('dialogue:end',   () => GameManager.instance.SetState('playing'));
// the player's FixedUpdate: if (GameManager.instance.state !== 'playing') stop
```

## Your own simple version (no library)

**File: `scripts/Npc.js`** (add this method to the NPC script; `lines` is an array of strings)
```js
async Talk(lines) {
  const box = this.ui.label('', { screen: 'say', anchor: 'bl', x: 40, y: 30, size: 22 });
  this.ui.show('say');
  for (const line of lines) {
    for (let i = 1; i <= line.length; i++) { box.set(line.slice(0, i)); await new Promise((r) => setTimeout(r, 25)); }
    await new Promise((r) => { const off = this.game.events.on('say-next', () => { off(); r(); }); });
  }
  this.ui.clear('say'); this.ui.hide('say');
}
```
(Anything that waits for the player uses a Promise like this; for waiting a number of seconds prefer a coroutine.)

## Story state
Keep flags and progress in the GameManager data store (`Set / Get`) so they are saved with the rest: `this.save.set('story', GameManager.instance.data)` on a checkpoint and restore with `Object.assign(GameManager.instance.data, this.save.get('story', {}))`.

## Localisation
Dialogue text can use translation keys; see [Data and localisation](addons-data-localisation.html) (`textKey` on text components, `game.i18n.t('key')`).
