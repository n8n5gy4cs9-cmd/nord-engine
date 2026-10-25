---
title: T01 Hello Nord
section: Tutorials
order: 1
summary: Create a project, add an entity with text, press Play.
---
**You will:** create a 2D project, put text on screen, run it. **Runnable project:** `nord new hello -t 2d`.

::: dummies
A *project* is a folder. A *scene* is one screen/level inside it. Anything you see in the scene is an *entity*. Today you make one entity that shows words.
:::

1. Create the project: hub → **New** → *2D game* (or `nord new hello -t 2d`). Optional: **Window ▸ Layout ▸ Unity 2 by 3** for the Hierarchy / Scene / Game / Inspector arrangement used in the screenshots of [Unity-style workflow](unity-workflow.html).
2. Open the project’s main scene (`scenes/main.scene.json`). Its entities appear in **Hierarchy**. Click the **Add entity** (+) button, name it `Title`, and set position to `[320, 180, 0]` (the middle of a 640×360 screen).
3. Select `Title`, then @ui[Inspector ▸ + Add component ▸ text] and set `text` = `Hello Nord`, `size` = `48`, `color` = `#88c0d0`.
4. Press **▶ Play** (Cmd+R). You see the words on the project's background colour.
5. Change the text while the game runs — the Game tab updates when you save the scene.

<figure class="shot"><img src="assets/screenshots/manual-hello-nord.png" alt="The real Nord 2D runtime showing Hello Nord centred on a dark 640 by 360 canvas"><figcaption>Expected result: one text entity, centred at [320, 180, 0]. Captured using Nord’s Phaser adapter and the entity settings below.</figcaption></figure>

**Shortcut:** **File ▸ New scene…** with the *2D starter* template creates a scene that already holds a camera and a text entity; the **Help ▸ First 10 minutes** checklist ticks itself as you go.

**Success check:** the Game view shows `Hello Nord` in large letters. If it does not, confirm the text component is on Title and that the display is 640×360; otherwise use the centre of your project’s display.

This is the **entity entry** inside the scene’s `entities` array. It is not an entire scene file:

**In the file** `scenes/main.scene.json` (the editor wrote it; check it in a text editor):
```json
{ "id": "k3j9x0a1", "name": "Title", "transform": { "pos": [320, 180, 0] },
  "components": [ { "type": "text", "text": "Hello Nord", "size": 48, "color": "#88c0d0" } ] }
```
**Next:** [T02 Sprite & movement](tut-t02-sprite-movement.html).
