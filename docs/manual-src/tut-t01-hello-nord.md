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

1. Create the project: hub → **New** → *2D game* (or `nord new hello -t 2d`).
2. Open `scenes/main.scene.json` in the **Hierarchy**. Click the **Add entity** (+) button, name it `Title`, and set position to `[320, 180, 0]` (the middle of a 640×360 screen).
3. In the Inspector press **+ Add component → text** and set `text` = `Hello Nord`, `size` = `48`, `color` = `#88c0d0`.
4. Press **▶ Play** (Cmd+R). You see the words on the project's background colour.
5. Change the text while the game runs — the Game tab updates when you save the scene.

The scene file you just edited looks like this (you can also paste it in by hand):
```json
{ "id": "k3j9x0a1", "name": "Title", "transform": { "pos": [320, 180, 0] },
  "components": [ { "type": "text", "text": "Hello Nord", "size": 48, "color": "#88c0d0" } ] }
```
**Next:** [T02 Sprite & movement](tut-t02-sprite-movement.html).
