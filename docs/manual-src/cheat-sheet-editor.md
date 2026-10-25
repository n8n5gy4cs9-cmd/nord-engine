---
title: Editor and project workflow cheatsheet
section: Guides
group: Editor and visual tools
order: 20
summary: The edit-test-save loop, scene versus prefab, project files, shortcuts, and safe iteration.
---
Use this sheet when you know what you want to change but are unsure which panel or file owns it. Open a saved project and stop Play before changing its starting state.

::: dummies
The Scene view is your workbench. The Game view is the running result. A live change is an experiment; a saved scene change is the starting point for the next run. Keep those two jobs separate.
:::

## Choose the panel

| Task | Panel or action | Result | Details |
|---|---|---|---|
| Select an object | @ui[Hierarchy] | Inspector shows that entity | [Editor tour](editor-tour.html) |
| Move, rotate or scale it | @ui[Scene], then W / E / R | Handles change the selected transform | [Unity workflow](unity-workflow.html) |
| Focus the selection | F in Scene | The selected object is framed | [Scene navigation](unity-workflow.html) |
| Add a capability | @ui[Inspector ▸ + Add component] | Component fields appear | [Component index](components.html) |
| Attach behavior | @ui[Inspector ▸ + Add script] | Script fields appear | [Unity scripting](unity-scripting.html) |
| Find a file | @ui[Assets] | Open, inspect or drag the resource | [Assets](assets.html) |
| Find a command | Cmd/Ctrl+K | Command palette opens | [Editor tour](editor-tour.html) |
| Explain a failure | @ui[Console] | First error points to the next check | [Debugging cheatsheet](cheat-sheet-debugging.html) |

## The daily loop
1. Stop Play. Select the correct object and change one field or script. The Inspector or file shows the new value.
2. Save. Press Play and check one predicted result. Click the Game view before checking keyboard input.
3. Stop. Confirm the saved starting value is still what you intended. Keep a checkpoint before the next experiment.

**In the file** `scenes/main.scene.json` (or the scene you opened), entities store their components and attached scripts. The project manifest `nord.project.json` selects the starting scene. Opening another scene for editing does not automatically make it the project's starting scene.

## Which file do I save?

| Change | Saved source | Also check |
|---|---|---|
| Scene object, transform or component | Current `.scene.json` | Correct scene open and Play stopped |
| Behavior implementation | `scripts/*.js` | File saved, script attached, imports valid |
| Reusable object recipe | `.prefab.json` | Instance overrides versus prefab defaults |
| UI layout | `.ui.json` | Game loads the same file you edited |
| Level Creator map | `.level2d.json` or `.fpsl.json` | Scene points to that level file |
| 3D Modeler work | Saved authoring model and chosen export | Scene uses the intended exported model |
| Shipping settings | Project settings / `nord.project.json` | Export target and start scene |

## Default shortcuts to remember

| Action | Default | Scope |
|---|---|---|
| Play / Stop project | F5 | Main editor |
| Run open scene | F6 | Main editor |
| Save | Cmd/Ctrl+S | Active document |
| Undo / redo | Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z | Editing |
| Duplicate | Cmd/Ctrl+D | Selection |
| Move / rotate / scale | W / E / R | Scene tools |

Bindings can be changed. Check Settings when a shortcut differs. FPS Level has its own test bindings; see its cheatsheet rather than applying the main-editor rules to every panel.

## Common mix-ups

| Symptom | First correction |
|---|---|
| Wrong scene runs | Compare F5 project start with F6 open-scene test |
| Change disappears after Stop | Repeat the edit while stopped, then save |
| Every instance changes unexpectedly | Check whether you edited prefab defaults |
| New asset is missing from export | Keep it in the project, check the stored path, and test the export |
| Modeler changes seem missing | Save the authoring model and update the model the scene actually uses |

## Check yourself
Stop, save, reopen the affected file, then Play. You can name the exact file that owns the change and reproduce its result.

Next: [Objects and prefabs](cheat-sheet-objects.html). Back to: [Cheatsheets](cookbook.html).
