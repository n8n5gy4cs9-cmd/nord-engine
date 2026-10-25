---
title: Getting started
section: Start here
order: 0
summary: Open a working project, learn the five editor concepts, make a safe change and choose your next lesson.
---
Use this page for your first session in Nord. You will open a working game, change one object, and know where to go next. You do not need a terminal or previous programming experience.

::: dummies
Think of Nord as a small theatre. A **project** is the whole production, a **scene** is one stage arrangement, and an **entity** is one thing on that stage. **Components** give it capabilities. **Scripts** tell it what to do. Start with one actor, not the entire musical.
:::

## Before you start
Open **Nord Engine**. The project hub appears. Use a project folder you can find again, and keep your editable project when exporting a playable build. If you are running from source, follow the platform setup in [Editor tour](editor-tour.html); this page assumes the editor is already open.

## 1. Open a game that already works
1. In the hub, browse **Examples and Tutorials**. Choose a small 2D example or a starter project. The editor opens its scene and files.
2. Press @ui[Play] in the toolbar. The @ui[Game] view shows the running game. Click inside it before testing keyboard input.
3. Press @ui[Stop]. You return to editing. If nothing appears, open @ui[Console] and read the first error before making changes.

Use the toolbar buttons while learning. Shortcuts can be rebound in Settings; [Unity-style workflow](unity-workflow.html) explains the default F5/F6 workflow. A tutorial's older key binding may differ from your saved settings.

## 2. Learn where changes happen

| Select or open | Use it to | What you see |
|---|---|---|
| @ui[Hierarchy] | Select an entity | A named scene object becomes selected |
| @ui[Inspector] | Change that object's data | Transform, components and scripts |
| @ui[Scene] | Arrange the saved scene | Editing handles and scene contents |
| @ui[Game] | Test the running game | What the player sees |
| @ui[Assets] | Find project files | Images, scripts, models and other resources |
| @ui[Console] | Read errors and messages | Output with file/line links where available |

The [Editor tour](editor-tour.html) explains the remaining panels. You can learn them when your current task needs them.

## 3. Make one visible change
1. Stop Play and select a visible object in @ui[Hierarchy]. Its settings appear in @ui[Inspector].
2. Change one position field by a small amount. In a 2D project, try moving it 20 pixels right. The @ui[Scene] view shows the new position.
3. Save the scene, press @ui[Play], and compare. The game should start with the object in its new position. Stop before making the next saved edit.

**In the file** `scenes/main.scene.json` (or the scene you opened), the selected entity stores its transform. See [Projects and scenes](projects-scenes.html) before editing that JSON directly. Its id and unrelated components should stay intact.

> **Trap:** edits made while Play is running affect the running game. Stop Play before changing the saved starting scene. Saving a project and exporting a game are separate operations.

## 4. Choose what to learn next

| Your goal | Next page | Result |
|---|---|---|
| Put your own words on screen | [T01 Hello Nord](tut-t01-hello-nord.html) | A text entity you can see |
| Understand code from zero | [Programming basics](programming-basics.html) | A complete Unity-style script and the meaning of each part |
| Write familiar Unity-style gameplay | [Your first script](ex-first-script.html), then [Input and movement](ex-input-movement.html) | Attached MonoBehaviour behavior |
| Build without writing code | [Event-sheet platformer](tut-t24-event-sheet-platformer.html) | Conditions and actions driving a game |
| Paint a level | [2D Level Creator](level-creator-2d.html) or [FPS Creator](fps-creator.html) | An editable map you can test |
| Understand the engine's parts | [How Nord works](how-nord-works.html) | Know what the editor, runtime and export do |
| Share a game | [Export and hosting](export.html) | A playable build beside your editable project |

## Try a tiny challenge
Move one collectible somewhere cheeky but reachable. Predict what changes, save, and press Play. If the collectible stays put, find which script controls its position. You have just done a useful debugging exercise: make a prediction and compare it with evidence.

::: dummies
You do not have to memorize the menus or API. The Manual explains features, Tutorials guide a project, Examples show complete code, Cheatsheets remind you of common operations, and API pages give exact names. **Old** contains retained earlier workflows, not the recommended starting path.
:::

## If something goes wrong

| Symptom | First check |
|---|---|
| Keys do nothing | Click the Game view, then check the project's input setup |
| You cannot see an object | Check its position, enabled state, camera and renderer component |
| Your saved change disappeared | Stop Play, edit the scene, save, and confirm you reopened the same project |
| A script fails | Read the first Console error and compare import names and capitalization |
| The instructions use lower-case `start()` | That lesson uses the original NordScript lifecycle; keep its style consistent or choose the new Unity-style path |

## Check yourself
- You can start and stop the game using the toolbar.
- You can select an object, change it while stopped, save, and see the result in Play.
- You can name one next lesson that matches what you want to make.

Next: [Programming basics](programming-basics.html) or [Manual topics](manual-paths.html). Back to: [Documentation home](index.html).
