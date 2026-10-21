---
title: T28 Machine Workshop — build a gravity puzzle in 2D Level
section: Tutorials
order: 28
summary: Learn the new 2D editor by placing ramps and a ball, editing Matter bodies, testing a machine and exporting it.
---

**Project:** welcome screen → **Physics** → **Machine Workshop**. Create your own project from the template. **Result:** a side-view machine in which a ball rolls down two ramps into a basket. The game is original; it uses the general idea of *The Incredible Machine*, with no original TIM code or media.

::: dummies
Gravity pulls the ball down. A ramp changes downward movement into sideways movement. The physics engine handles that contact. Your job as a designer is to place the parts, choose which parts can move, and decide what counts as success.
:::

## 1. Play the working machine first

Use the main **Play** button. The apparatus starts paused in setup mode. Move the two **Ramp angle** sliders, then click **Release**. The default 15° ramps lead the ball into the basket. **Reset** restores the setup. Try making the second ramp slope upwards: the same parts now produce a different path.

<figure class="shot"><img src="assets/screenshots/ed-level2d-machine.png" alt="Solved Machine Workshop with two ramps and a basket" loading="lazy"><figcaption>The starting apparatus has a working solution. Keep one solved copy while you experiment.</figcaption></figure>

**Checkpoint:** you can release, watch, reset and change an angle. The ball is simulated; it is not following a scripted path.

## 2. Open the authoring map

Stop main Play. Open **2D Level**; the workshop authoring file opens automatically. You can also choose **Open → workshop.level2d.json**. Wheel zooms; middle/right drag pans; **Home** fits the map.

There are two kinds of content: **tiles**, painted on the grid, and **objects**, which can be selected independently. This machine uses objects for its ball, ramps and basket. Press **V**, click a ramp, and read its Inspector. Use **Objects** if selecting a thin ramp is difficult; clicking its name centres the map.

## 3. Understand the level settings

Open **Level**. The mode is **Side-scroller**, Physics is **Matter**, and gravity is **900 pixels/s²**. Matter handles the rotating/rolling contacts needed here. Leave the tile size at 32 while learning.

The **Level controller** is `scripts/machine.js`. That is the small ready-made script that creates the Release/Reset controls. Its path stays in the authoring file when you Save. F5 therefore tests the machine with its setup controls as well.

The controller attributes box is JSON. This sample needs no custom attributes; `{}` is correct. Later tutorials use this box to configure game-wide rules.

## 4. Inspect a fixed ramp

Select **Ramp A** in Objects. The important settings are:

| Inspector setting | Starting idea |
|---|---|
| Body | `static`: the ramp does not fall. |
| Shape | `box`: the thin rectangular contact surface. |
| Width / Height | Its displayed size and collision footprint. |
| Rotation | 15° slopes down to the right. |
| Friction | A small value allows the ball to roll. |
| Bounce | A small value absorbs most impact. |

Change Rotation to 10. Press **F5**, then Release. Stop the test with **Shift+Esc**. Use **Ctrl/Cmd+Z** to undo the angle change. The same undo history covers placement, dragging and Inspector edits.

**Checkpoint:** the ball's path changes when you change a ramp value; undo restores the apparatus.

## 5. Inspect the ball

Select **Player**. Here the name is used for the generated camera convention; the object is a ball, not a walking character. Its `player` tag lets the goal detect it.

The ball's Body is **dynamic**, Shape is **circle**, Fixed rotation is off, Mass is 1, and Bounce is low. Try Bounce 0.7 and test again. Then restore it. A round picture alone does not make a round body: the **Shape** field is what selects circle contact.

Keep Width and Height equal for a circular ball. Increasing mass changes collision/impulse response; it does not make gravity accelerate the ball faster. Gravity scale 0 makes it weightless; restore 1 to let it fall.

## 6. Add a third ramp with a reusable item

1. Select Ramp A, then **Save as variant**. Name it **Short wooden ramp**.
2. Open **Assets** and click that variant. Place it with **E Object** in a clear area below the first ramp.
3. Press V and select the new ramp. Set Width to 160, Height to 18 and Rotation to -10.
4. Move it into the falling ball's route. Toggle **Snap** off for fine placement; turn it back on when done.
5. F5 → Release. Watch the new contact, stop, and adjust.

Variants capture appearance, body and attached scripts. The new ramp has an independent position and ID. The variant is saved inside this level file; remember to Save the map.

## 7. Make a tumbler

Duplicate a ramp or crate with **Ctrl/Cmd+D**. Set Body to **dynamic**, Fixed rotation off and Mass to 2. Raise it above another ramp. Test to see it fall and rotate. Restore Body to static if it is meant to be part of the fixed apparatus.

**Kinematic** is for a body moved by a script. This tutorial does not add motors, ropes or joints; the editor currently authors free bodies and static/script-driven obstacles.

## 8. Move the goal and understand winning

Select **Goal basket**. It is a static **trigger**: the ball can overlap it. Its attached `level-actions.js` script uses:

```json
{"action":"win","message":"Machine solved! The ball reached the basket.","requireScore":0}
```

The Inspector exposes those fields. Change the message to your own text, move the goal above the basket base, and test. Keep its trigger inside the basket; placing it above the ramp would award victory before the intended catch.

The tall basket wall is a separate solid object. It catches the fast-moving ball; the goal trigger reports success. Moving the wall and moving the trigger change different parts of the game.

## 9. Add scenery on a separate layer

In Level, add a layer and name it **Scenery**. Pick a background/prop from Build and paint with **Solid tiles** off. Set the layer's parallax to 0.5 if you want it to scroll more slowly. Keep the collision apparatus on a layer with parallax 1. Lock the scenery layer when finished to avoid selecting it accidentally.

Use **B** to brush, **R** for a rectangle, **F** to fill, **X** to erase and **I** to pick a sprite from the map. Object deletion uses V selection and Delete.

## 10. Save the right files and export

Use **Save as → machine-my-version**. This writes `levels/machine-my-version.level2d.json` and `scenes/machine-my-version.scene.json`. Referenced bundled art and its licences are copied into the project. Your custom `scripts/machine.js` stays in the project.

Choose **Use as game start** so the main Play button and export use this scene and its Matter settings. Then use Nord's ordinary Export command. F5 tests unsaved data; main Play/export use saved files. Keep the authoring JSON: changing the compiled scene directly is not round-tripped into 2D Level.

## Troubleshooting and next challenges

| Symptom | Check |
|---|---|
| Ball hangs in the air | Click Release; Body dynamic; gravity scale 1; Side-scroller mode. |
| Ramp falls | Set its body to static. |
| Ball rolls through a picture | Give the picture a body; disable Trigger for a blocking surface. |
| Goal never fires | Ball has `player` tag; goal is a trigger with action `win`; overlap their bodies. |
| Old game runs from main Play | Save and choose Use as game start. |
| Rotation has axis-aligned contact | Choose Matter for rotated-ramp puzzles. |

Try a high-bounce pinball route, a falling-crate chain, or a second basket that requires moving the catch wall. Keep one solved map as a baseline. The next tutorial uses the same editor for [a two-floor dungeon](tut-t29-dungeon-two-floors.html).
