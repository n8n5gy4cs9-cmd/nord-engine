---
title: Cheatsheets — find an answer
section: Guides
order: 1
summary: Quick lookup tables for scripting, editor tasks, debugging and publishing.
---
Keep these pages open while working. Choose the task first, then use the matching reference when you need details.

::: dummies
A tutorial teaches a project in order. A cheatsheet is a short reminder for a task you already started. Start with one row, try it, and compare the result before adding more code.
:::

## Choose a cheatsheet

| Task | Cheatsheet | Expected result |
|---|---|---|
| Write new Unity-style JavaScript | [Unity scripting](cheat-sheet-unity.html) | A complete attached script with a working Update |
| Run a command | [Command line](cheat-sheet-cli.html) | Know the project folder, command and output |
| Share a game | [Export](cheat-sheet-export.html) | Produce the right build and check it |
| Edit an FPS level | [FPS Level](cheat-sheet-fps-level.html) | Recall tools, test controls and saving |
| Find a keyboard action | [Shortcuts](shortcuts.html) | Find the action and verify its configured binding |
| Recall a graph node | [Graph reference](graph-reference.html) | Choose the node with the correct inputs |

## Debug a script quickly

| Symptom | First check | Reference |
|---|---|---|
| Nothing happens | Select the object; verify attachment and enabled state in Inspector | [Unity scripting](unity-scripting.html) |
| Update is never called | Use capitalized Update in MonoBehaviour; lower-case update in NordScript | [Scripting](scripting.html) |
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
