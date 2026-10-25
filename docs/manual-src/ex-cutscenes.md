---
title: 47 · Cutscenes and the Timeline (Unity Timeline / PlayableDirector)
section: Examples
order: 47
summary: Keyframe an intro, a camera move or a door opening in the Timeline tab, play it from a script and wait for it to finish.
---

**Goal:** a short intro where the title slides in, then the menu appears. Same idea as a Unity `PlayableDirector` playing a Timeline asset.

## Make it in the editor
1. Open the @ui[Timeline] tab and create a timeline named `intro`. Set **duration** to 3 seconds.
2. Add a **track**: object `Title`, property `y`. Click the strip at 0 s and at 1 s to add keyframes; set the values (-50, then 100) and give the second one the ease `backOut`.
3. Add an **event marker** at 2.5 s and name it `show-menu`.

Tracks can animate `x y z angle scaleX scaleY opacity`, an instance variable (`var:name`) or a numeric component field (`comp:sprite.tint`). A track's target can be an object name, a tag or a family, so one track can move all enemies tagged `wave1`. The result is stored in the scene under `settings.timelines`.

## Unity (C#)
```cs
public PlayableDirector director;
void Start() { director.Play(); director.stopped += _ => ShowMenu(); }
```

## Nord
```js
import { MonoBehaviour } from 'nord';

export default class Intro extends MonoBehaviour {
  Start() {
    this.game.events.on('Timeline.on-event', (e) => { if (e.name === 'show-menu') this.ShowMenu(); });
    this.game.events.on('Timeline.on-finished', (e) => { if (e.timeline === 'intro') this.StartGame(); });
    this.scene.timelines.play('intro');                       // speed and start time: play('intro', { speed: 2, from: 1 })
  }
  ShowMenu() { this.scene.find('Menu').enabled = true; }
  StartGame() { this.game.loadScene('scenes/level1.scene.json'); }
}
```
Control it while it runs: `scene.timelines.pause(name)`, `resume(name)`, `stop(name)`, `seek(name, seconds)`, `isPlaying(name)`, `time(name)`, `progress(name)` (0 to 1). A looping timeline never fires *finished*, only the markers.

Without code: an event sheet has the **Timeline** plugin with *Play, Pause, Resume, Stop, Set time*, the triggers *On finished* and *On event*, and the expressions `Timeline.Time(name)` and `Timeline.Progress(name)`.

## Skippable cutscene
```js
Update() {
  if (Input.GetKeyDown('Escape') && this.scene.timelines.isPlaying('intro')) {
    this.scene.timelines.seek('intro', 3);                    // jump to the end values; finished fires on the next frame
  }
}
```
(`Input` comes from `import { MonoBehaviour, UnityInput as Input } from 'nord';`.)

## Camera moves
Put the camera in the scene as an object with a `camera` component and add `x`/`y` (2D) or `x`/`y`/`z` tracks to it. For a letterbox bar and a fade, add `opacity` tracks on two UI objects. Pause player input while it runs: `GameManager.instance.SetState('cutscene')` and check the state in the player script.

## Traps
* `scene.timelines` exists only in scenes that define at least one timeline. Check `this.scene.timelines?.has('intro')` if a script runs in many scenes.
* The scrub slider in the Timeline tab previews values only. Press @ui[Play] to see the objects move.
* Track targets are looked up by name, tag or family every frame: renaming an object silently disconnects its track.
* Timelines run on game time. If you freeze the game with `Time.timeScale = 0` the cutscene freezes too.

Back to [Effects and timelines](effects-particles-timelines.html), [Examples](examples.html).
