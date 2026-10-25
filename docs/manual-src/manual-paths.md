---
title: Manual — choose a task
section: Manual
group: Getting oriented
order: 0
summary: A structured reading path through the editor, gameplay systems and publishing tools.
---
The Manual explains how Nord's features work. Each chapter is a task reference. Tutorials teach a whole project in order; Examples provide reusable code; Cheatsheets help you recall an exact operation.

::: dummies
You do not need to read this site from beginning to end. First make one object appear, then make it move, then give it a rule. Add another system only when your game needs it.
:::

## Before you start
Open a project from the project hub. Save your changes before pressing Play. Start with [Getting started](getting-started.html) if the editor is new to you.

## Learn the editor

| Your task | Read | What you should be able to do |
|---|---|---|
| Understand the panels | [Editor tour](editor-tour.html) | Select an object and find its properties |
| Understand project files | [Projects and scenes](projects-scenes.html) | Distinguish a project, scene, entity and prefab |
| Adjust readability | [Appearance](appearance.html) | Set editor colors and text size |
| Keep files manageable | [Organise your project](organise-project.html) | Find assets and leave useful notes |

## Write gameplay in the Unity style

Read [Unity-style scripting](unity-scripting.html), then keep the [Unity API](api-unity.html) beside your code. Nord uses JavaScript with Unity names. It implements a documented subset of Unity behavior; check [coverage](unity-coverage.html) before porting an unfamiliar feature.

Use the Examples sidebar's **Unity API · map and recipes** group for maths, input, physics, renderers and lifecycle. Existing tutorials can use the native lower-case `NordScript` lifecycle. Follow their code consistently within each script.

## Build a world

| Kind of project | Start with | Add when needed |
|---|---|---|
| 2D | [2D games](2d.html) | [Sprites, animation and tilemaps](sprites-animation-tilemaps.html), [Physics](physics.html) |
| 3D | [3D games](3d.html) | [Modeler](modeler.html), [Animator](animator.html) |
| First-person level | [FPS Creator](fps-creator.html) | [Physics](physics.html) |
| Tile-based level | [2D Level Creator](level-creator-2d.html) | [Input](input.html) |
| Interface or app | [UI](ui.html) | [UI Designer](ui-designer.html), [Desktop apps](desktop-apps.html) |

## Test and publish
Read [Debugger](debugger.html) when behavior differs from your expectation, [Performance](performance.html) when it is slow, and [Export](export.html) when you are ready to share. An exported static game and a saved editable project serve different purposes: keep the project as your source.

## Check yourself
- You can name the object and component you are changing.
- You know whether you need a concept explanation, a guided tutorial, a code example or an exact API signature.
- You can reproduce the result after saving and pressing Play.

Next: [Editor tour](editor-tour.html). Back to: [Getting started](getting-started.html).
