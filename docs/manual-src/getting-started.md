---
title: Getting started
section: Start here
order: 1
summary: Your first project, your first change and your first playable result.
---
You do not need to understand the engine to get a first result. Start with something that already runs, make one small change, and play it again.

## 1. Open Nord
Open **NordEditor.app** if you have a built copy. Working from this repository on macOS? `./run.sh` launches the editor; `./build.sh` creates the app. The first screen is the **project hub**: it lets you create a project, open one, or explore examples.

::: dummies
A **project** is a folder containing your game. Keep the whole folder: the scene files, scripts and pictures belong together. The editor is the application you use to work on that folder.
:::

## 2. Pick a small starting point
In the hub, create a **2D game** from a starter template. For a first experiment, use **Platformer**. Choose a folder you can find again, such as `Projects/my-first-game`.

You can also open **Examples**, but make a separate project copy before experimenting. With **USE CACHED CONTENT** off, an example opens its current source files. [See how example copies work](editor-tour.html#current-example-content).

Prefer the terminal? These commands create and run a starter project:

```bash
nord new my-first-game -t platformer
nord serve my-first-game
```

Open the local address printed by `nord serve`. Leave that terminal running while you work. You only need a build when you want to export the project.

## 3. Press Play before changing anything
Press **▶ Play** or **Cmd+R**. Try the controls described by the template. This gives you a working starting point. Press **■ Stop** or **Cmd+.** to return to editing.

::: tip
If the game fails before you change anything, open **Console** and read the first error. Fixing the starting project first makes later mistakes much easier to understand.
:::

## 4. Make one visible change
Select an entity in **Hierarchy**. The **Inspector** shows its settings. Try changing its position, or change the text on a text entity. Save with **Cmd+S**, then press Play again.

The goal is simple: **you changed a setting, and you can see the result**. Keep this loop: change → save → play → observe.

| Where you click | What it means |
|---|---|
| Hierarchy | Choose the thing you want to change. |
| Inspector | Change that thing's settings. |
| Scene view | Arrange things before the game runs. |
| Game view | See what a player will actually see. |
| Console | Read messages and errors from the game. |

## 5. Build your first tiny scene
Follow [T01: Hello Nord](tut-t01-hello-nord.html). It puts words on screen, shows the exact values to enter and gives you a visible success check. Then [T02](tut-t02-sprite-movement.html) adds a picture and movement.

You can learn scripts later. First get comfortable choosing an entity, changing a component and pressing Play.

## 6. Keep a copy you can share
When your project runs, use **Export…** in the editor, or:

```bash
nord build my-first-game
```

Your web build goes into the project's `dist` folder. Share **the whole folder**, including its assets. Most builds should be served by a web server; double-clicking `index.html` is not the same as serving it. [Export and hosting](export.html) explains the available modes.

## If you get stuck

| What you see | Try this |
|---|---|
| A blank screen | Check Console. Confirm the project has a start scene and visible entities inside the camera view. |
| Your change disappeared | Save the scene or script. Check that you reopened your own project folder. |
| A picture will not load | Check its project-relative path and exact filename, including capitals. |
| No sound | Click or tap the game once. Browsers wait for a player gesture before allowing audio. |
| Code changed but a helper did not | Stop and Play again, or reload the browser. Imported helper modules need a full reload. |

Next: [How Nord works](how-nord-works.html), or go straight to [the first tutorial](tut-t01-hello-nord.html).
