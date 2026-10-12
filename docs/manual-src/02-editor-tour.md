---
title: Editor tour
section: Manual
order: 2
summary: Panels, viewport, inspector, code editor, console, shortcuts.
---
The editor is a native **egui** app. Its layout follows the PlayCanvas editor with Defold-style toolbars.

```
┌ Toolbar: Project ▾ | ▶ Play ■ Stop ⟳ | Move Rotate Scale | 2D/3D | Snap Grid | Export ▾ | Docs ┐
├ Hierarchy ──────┬ Viewport (Scene | Game | Code …) ─────────────────────┬ Inspector ───────────┤
│ tree, search, + │  edit view with grid and gizmos                        │ name, tags, transform │
│ drag to reparent│                                                        │ components, scripts   │
├ Assets ─────────┴────────────────────────────────────────────────────────┴───────────────────────
│ folders | thumbnails | search | Library | Console | Docs                                          │
```

## Panels
* **Hierarchy** — the entity tree (**Add entity** button; right-click: Add child, Duplicate, Delete, Copy, Paste). Drag a row onto another to reparent (top 30 % of a row inserts *before*), drop on empty space to move to the root. Dropping an asset on empty space creates an entity from it.
* **Viewport** — *Scene* tab is the edit view (2D Canvas / 3D Babylon): pan, orbit, zoom, pick, and move/rotate/scale gizmos with snapping. *Game* tab runs the real game.
* **Inspector** — generated from component schemas and script `static attributes`. Add components with **+ Add component** and scripts with **+ Add script**; change values live.
* **Assets** — folder tree plus thumbnail grid (images, spritesheets, audio waveforms, rendered models). Import by dropping files from the OS.
* **Library** — search ready-made scripts, prefabs and kits; **Insert** adds them to the project/selection.
* **Console** — `console.*` output of the running game and build output. Click `file.js:12` to open that line.
* **Code** — a native code editor with tabs, highlighting (10 languages), find/replace (regex), project search, autocomplete (nord.js API + library + file words), error squiggles, minimap, split view and multi-cursor.
* **Docs** — this manual.

## Play, stop, reload
**▶ Play** (Cmd+R) runs the game in the Game tab with live reload: saving a script **hot-reloads** it without restarting the scene
(see [Scripting](scripting.html#hot-reload)). **■ Stop** is Cmd+`.`. For Rust projects Play builds first and streams `cargo` output to the Console.

## Undo and project safety
Every scene change is an undoable command (Cmd+Z / Shift+Cmd+Z). The editor autosaves with crash recovery; Cmd+S saves explicitly.

::: dummies
Don't be afraid to click around: almost everything has undo. The two places you will spend 90 % of your time are the **Hierarchy**
(what exists) and the **Inspector** (how each thing is set up).
:::

## Shortcuts
See the [shortcut table](shortcuts.html) (also in Settings, Cmd+,). Highlights: Cmd+P quick open, Cmd+K command palette, W/E/R gizmos, F focus, Cmd+D duplicate.

## Themes and skins
Settings → *Skin* (fonts) and *Theme* (colours). The same skins/themes exist for in-game UI (`project.ui.skin`/`ui.theme`, see [UI](ui.html)).
