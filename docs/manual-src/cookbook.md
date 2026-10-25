---
title: Cheatsheets — find an answer
section: Guides
group: Find an answer
order: 0
summary: Quick lookup tables for scripting, editor tasks, debugging and publishing.
---
Keep these pages open while working. Choose the task first, then use the matching reference when you need details.

::: dummies
A tutorial teaches a project in order. A cheatsheet is a short reminder for a task you already started. Start with one row, try it, and compare the result before adding more code.
:::

## Choose a cheatsheet

| Your task | Cheatsheet | What it covers |
|---|---|---|
| Write new Unity-style JavaScript | [Unity scripting](cheat-sheet-unity.html) | A complete MonoBehaviour, lifecycle, imports and fields |
| Connect or create objects | [Objects, prefabs and events](cheat-sheet-objects.html) | Lookup, references, spawning, scenes, subscriptions and cleanup |
| Read input or move physically | [Input and physics](cheat-sheet-input-physics.html) | Held/pressed input, body ownership, units, queries and contacts |
| Calculate motion or wait | [Maths and timing](cheat-sheet-maths-time.html) | Vectors, interpolation, angles, random ranges, coroutines and pause limits |
| Display feedback and remember data | [UI, audio and saves](cheat-sheet-presentation.html) | Handles, screens, buses, PlayerPrefs, slots and a complete counter |
| Find the correct panel or file | [Editor workflow](cheat-sheet-editor.html) | Edit/test/save loop, ownership and main shortcuts |
| Import or author a resource | [Assets and visual tools](cheat-sheet-visual-tools.html) | Sprites, maps, UI, models, animation, graphs and runtime handoff |
| Build first-person rooms | [FPS Level](cheat-sheet-fps-level.html) | Building, patrols, variants, testing and map selection |
| Diagnose wrong or slow behavior | [Debugging and testing](cheat-sheet-debugging.html) | Symptom checks, profiling and restart regression checklist |
| Deliver a playable result | [Export and hosting](cheat-sheet-export.html) | Target choice, commands, release checks and troubleshooting |
| Automate a project job | [Command line](cheat-sheet-cli.html) | Program location, commands and output |
| Look up a precise tool contract | [Shortcuts](shortcuts.html), [Graph nodes](graph-reference.html), [UI scenes](ui-scenes.html), [Glossary](glossary.html) | Supporting reference tables |

## How to use these sheets
Start with the operation you need, confirm its prerequisites, then check the observable result at the bottom. Tables contain call patterns, not complete games. A fenced file explicitly labelled “the whole file” is complete; an inline call assumes the documented class, imports and resources.

New game code uses MonoBehaviour and Unity names in JavaScript. The **Old** group preserves native NordScript reminders. Nord's Unity layer is a supported subset: [Coverage](unity-coverage.html) and the exact [API reference](api-unity.html) take precedence over assumptions from C#.

## Debug a script quickly

| Symptom | First check | Reference |
|---|---|---|
| Nothing happens | Select the object; verify attachment and enabled state in Inspector | [Unity scripting](unity-scripting.html) |
| Update is never called | Use capitalized Update in MonoBehaviour; lower-case update in NordScript | [Unity scripting](unity-scripting.html) |
| Input does nothing | Verify the action or axis in the Project tab; focus the running Game view | [Input](input.html) |
| Spawned object is unavailable | Await Instantiate inside an async method | [Unity API](api-unity.html) |
| Collision never fires | Check body, collider, trigger flag and matching 2D/3D backend | [Physics](physics.html) |
| Changes disappear on Stop | Play edits affect the running game; edit the saved scene after stopping | [Unity workflow](unity-workflow.html) |
| Export is blank | Check Console, missing files and whether the output needs a web server | [Export](export.html) |

## Common gameplay recipes

Use [Examples](examples.html) for complete Unity-style files: input and movement, spawning, health, UI, saves and physics. The sidebar groups related pages so you can collapse the topics you do not need.


## Keep these distinctions nearby

| Often confused | Remember | Reference |
|---|---|---|
| Script file / script instance | One file can run independently on many objects | [Unity scripting](unity-scripting.html) |
| Frame time / speed | Multiply units per second by Time.deltaTime for this frame's displacement | [Unity cheatsheet](cheat-sheet-unity.html) |
| Transform / physics movement | Use a Rigidbody when physics should own motion | [Physics recipes](ex-physics-recipes.html) |
| 2D / 3D coordinates | 2D uses pixels with y down; 3D uses world units with y up | [Maths](ex-unity-api-math.html) |
| Scene / prefab | A scene arranges objects; a prefab is a reusable object recipe | [Projects and scenes](projects-scenes.html) |
| Editor / in-game Console | One reports editor/runtime output; the other is a command UI you deliberately add to a game | [Dev Console](dev-console.html) |
| Saved edit / live edit | Stop Play before changing the saved starting state | [Unity workflow](unity-workflow.html) |

## A one-minute troubleshooting routine
1. Reproduce the problem with the fewest objects possible. You should be able to name the first incorrect result.
2. Read the first Console error. Fix that before investigating later errors caused by it.
3. Compare imports, paths, capitalization and required components with one working example.
4. Change one thing, then test again. If the result improves, save a checkpoint before experimenting further.

::: dummies
Debugging is detective work with fewer trench coats. “The player does not move” is a clue. “Input axis is zero when Game is focused” is a more useful clue. Record what you observe instead of changing five settings at once.
:::

## Tiny challenge: the rescue card
Bookmark the cheatsheet you needed today. Add one line to your project notes: the symptom, its cause, and the check that proved the fix. Tomorrow-you gets a very small gift.

## Check yourself
Choose one task, perform its action and confirm the expected result. If a call is unfamiliar, open its API reference before copying it into a different lifecycle style.

Next: [Unity scripting cheatsheet](cheat-sheet-unity.html). Back to: [Manual reading paths](manual-paths.html).
