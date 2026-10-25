---
title: Assets and visual tools cheatsheet
section: Guides
group: Editor and visual tools
order: 21
summary: Choose the right authoring tool, follow the saved file into the scene, and verify levels, UI, models and animation.
---
Use this sheet to follow a resource from the editing panel to its saved file, then into the running game. Start with one asset in one scene before importing a whole pack.

::: dummies
An authoring file is the editable recipe. The runtime resource is what your scene actually loads. Saving a new recipe does not help if the scene still points at yesterday's export. Follow the file path like a trail of breadcrumbs.
:::

## Choose a tool and verify the handoff

| Task | Tool / starting point | Saved result | First check |
|---|---|---|---|
| Paint or slice sprite art | Sprite editor; [Sprites and tilemaps](sprites-animation-tilemaps.html) | Image/sprite metadata used by the object | Correct frame, origin and filtering |
| Paint a 2D map | @ui[2D Level]; [Level Creator](level-creator-2d.html) | `.level2d.json` | Game scene references this saved map |
| Build first-person rooms | @ui[FPS Level]; [FPS cheatsheet](cheat-sheet-fps-level.html) | `.fpsl.json` and project content | Save map and confirm scene's Level file |
| Design a menu | @ui[UI Designer]; [Designer guide](ui-designer.html) | `.ui.json` | Loading script uses that path and matching actions |
| Model and paint | @ui[3D Modeler]; [Modeler guide](modeler.html) | Authoring model plus chosen runtime export | Scene uses the model you saved/exported |
| Control animation states | @ui[Animator]; [Animator guide](animator.html) | Controller data | Animator component points at it; parameters match |
| Build visual logic | @ui[Graph]; [Node graph guide](graph.html) | `.graph.json` | Graph component or scene setting loads it |
| Build conditions/actions | Event sheets; [Event-sheet guide](event-sheets.html) | Event-sheet source | Correct sheet is included in the running layout |

Open the guide linked in the table for that tool's exact controls. These tools do not share a universal Save/Test contract.

## Import and attach a resource
1. In @ui[Assets], find or import the file into your project. The asset list should show it at the expected relative path.
2. Select the destination object in @ui[Hierarchy]. Assign the appropriate component or resource field in @ui[Inspector], following that component's reference.
3. Save the resource and scene, press Play, and confirm one visible or audible result.

**In the file** your `.scene.json`, the component stores the resource reference. A Level Creator map, designed UI and Animator controller remain separate files; changing their contents does not rename the scene's reference for you.

## Asset decisions

| Resource | Decide before using it | Common failure |
|---|---|---|
| Sprite sheet | Frame size/order, origin and pixel filtering | Wrong crop, wobbling animation or blurry pixels |
| Tile set | Tile size and collision rules | Visible floor does not collide |
| Texture | Color use, repeat/filter settings and material slot | Correct file, wrong appearance |
| 3D model | Runtime export, material/texture references and scale | Authoring model saved but runtime model unchanged |
| Audio | File path, decode support, bus and user activation | Silent first run or wrong volume bus |
| Font | Project-local resource and chosen UI/world-text system | Fallback typeface or different layout |
| Prefab | Defaults versus instance overrides | One edit appears to affect the wrong objects |

Keep resources inside the project and use the documented relative path. Avoid machine-specific absolute paths. Filenames must retain correct case for deployment to hosts with case-sensitive filesystems.

## Save-test-export chain

| If this works… | Also verify… |
|---|---|
| Tool preview | Scene actually loads the tool's saved file |
| Unsaved FPS test | Main Play loads the saved map named by the scene |
| Modeler viewport | Runtime export preserves the features you need |
| UI preview | Button action reaches the intended script callback |
| Animator preview | Running object's parameters make the same state changes |
| Main Play | Export includes every referenced resource |

## Tiny challenge
Rename nothing. Change one obvious color, save it, and prove which file made the running result change. It is less glamorous than importing 400 textures, but much easier to debug.

## Check yourself
Reopen the resource, reopen its scene, then test an export. You can identify both the editable source and the runtime reference that consumes it.

Next: [Export cheatsheet](cheat-sheet-export.html). Back to: [Cheatsheets](cookbook.html).
