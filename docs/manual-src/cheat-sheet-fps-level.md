---
title: FPS Level — quick reference
section: Guides
order: 29
summary: Build, select, patrol, test, stop, customise shortcuts, save and export first-person levels.
---

Start with the **FPS Creator** template and open **FPS Level**. The [full illustrated guide](fps-creator.html) explains the panels, ready-made content, scripts, rules, files and export. [T27](tut-t27-fps-level.html) walks through a playable level.

| Task | Control |
|---|---|
| Build a room | R, drag a rectangle |
| Replace a wall with a door/window | Build: choose the piece; W, click the wall edge |
| Paint floor / ceiling | F / C; Ctrl-drag rectangle, Shift erase |
| Add enemy / light / pickup | Items: pick it, click map; Q/E rotates |
| Find an existing object | Objects: search name, tag, type, ID or script |
| Select and locate a search result | Click; Shift-click toggles; double-click focuses 3D |
| Edit patrol | Select enemy; P draws points; Patrol path edits X/Z and wait, inserts, reorders, removes or reverses |
| Adjust object precision | Toolbar Snap spacing: 0.25 / 0.5 / 1 / 2 / 4 m |
| Change storey | PageUp / PageDown, or Layer selector |
| Change view | Tab: 2D / split / 3D |
| Fit map / pan / zoom | Home / middle or right drag / wheel |
| Save level | Cmd/Ctrl+S |
| Undo / redo | Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z |
| Check missing starts, names and targets | ✓ |
| Help | F1 |

## Test and stop

| Default | Action |
|---|---|
| F5 | Test unsaved current level from Player Start |
| Shift+F5 | Test unsaved current level from selected object, otherwise cursor cell |
| Shift+Esc | Close the FPS test and return to editing |
| Esc | Release mouse capture and pause; choose Resume or Quit |
| Close test, top-right | Close the FPS test at any time |

**Main-editor Play is separate:** it starts the project’s configured scene and reads a saved level. Save your FPS work first; check the scene’s **Level file**. Use the main **■ Stop** to end main Play.

## Change or reset keys

Open whole-editor **Settings** (Cmd/Ctrl+,). Edit the three **FPS Level** key fields and choose Shift, Cmd/Ctrl or Alt with checkboxes. Close Settings to save. Embedded tests update without losing level edits. Open in browser receives the bindings when the page opens; reopen it after changes. Direct `nord serve` pages use the defaults.

**Reset shortcuts to defaults** restores main Run/Stop plus the FPS Test/From here/Stop keys, keeping your theme and layout. Invalid keys fall back to defaults. Use different combinations; Stop takes priority. FPS start bindings override FPS tools, so avoid common building keys unless intended.

## Before exporting

Save the level → set the scene’s **Level file** → save the scene → verify project start scene → main Play → normal web-folder export. Include custom content in `fpsc/`. Use the normal folder export for dynamically imported custom scripts.

## Shape rooms and reuse edited items

**See shapes immediately:** FPS Level → New creates a diagonal-corner room and a rounded-corner room. The template/example Outpost Zero has diagonal bunker corners and rounded hall corners. Existing saved maps remain as saved.

* **Diagonal/round:** Build → Cell objects → Mode → Diagonal / rounded corner. Choose shape and cut-off direction; click a corner cell. Floor/ceiling cut automatically. Shift-click restores Square and its original walls. Use separate cells for stairs/pillars.
* **Circular room:** draw a 2×2 room, apply rounded SW/SE/NW/NE cuts to its corresponding outer corners. Each is a quarter circle. Open the included `levels/corners.fpsl.json` for a working example.
* **Reusable variant:** select an item → change properties/scripts/rules → Reusable item → Save as variant → name/id → Save. Place the new entry from Items. Select/edit it later → Update variant defaults. Built-ins stay intact; instance overrides and copied rules are retained. Save the level separately.
* **Existing projects:** Upgrade runtime before main Play/export. Shapes and variants are documented in the [full guide](fps-creator.html).
