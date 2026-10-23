---
title: 3D Modeler
section: Manual
order: 32
summary: A small polygon editor for quick model fixes: mesh editing, a pixel texture painter and a UV editor, saved into the project's models/ folder.
---

The **3D Modeler** tab (Window ▸ Editors ▸ 3D Modeler) is for *small changes*: build a crate from a cube, nudge a few vertices, repaint a texture, fix a UV. It is not a replacement for Blender. Everything is saved in the project's `models/` folder.

## Files

| File | What it is |
|---|---|
| `models/<name>.mesh.json` | The editable mesh: vertices, faces, UVs, seams, vertex colours and the texture. **Save** / **Open…** use this. |
| `models/<name>.glb` / `.gltf` | Export for a 3D scene (texture and vertex colours included). Use it like any other model asset. |
| `models/<name>.obj` + `.mtl` + `.png` | Export for other tools. |
| `models/<name>.png` | The texture alone (**Save PNG to project**). |

## 3D view

Left panel: create primitives (cube, plane, cylinder, sphere) or draw a polygon on the grid; select faces, edges or vertices (click, Shift-click to extend); move/rotate/scale with the gizmo or by numbers; extrude, inset, loop cut, split edge, bevel, merge, weld, delete, flip, triangulate. **Undo/Redo** (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z), **Delete** removes the selection, **Ctrl/Cmd+S** saves. **Subdivide all** splits every face into quads, **Mirror X/Y/Z** duplicates the mesh across the origin plane and welds the seam (move the half away from the plane first, otherwise the copy lies exactly on top of it), **Center on ground** puts the mesh at the origin with its bottom on y=0, and **Import OBJ…** loads a Wavefront file (faces keep their UVs, or are auto-unwrapped; textures are not imported). Orbit with the left mouse button, pan with the right, zoom with the wheel.

## Texture tab

A pixel painter: **Pencil**, **Eraser**, **Fill**, **Picker**, brush size, **Mirror X**, 16-512 px textures, a UV overlay so you see where the faces are. **New blank** fills a fresh texture with the chosen colour. **Load image file** / **Load project PNG…** replace the texture. Tick **Paint on model** in the top bar to paint straight onto the 3D model.

## UV editor tab

Shows the UV layout over the texture. Click a face to select it (Shift extends), drag to move the selection; switch **Drag** to *points* to move single UV corners; **snap to texel** snaps to the texture pixels. Buttons: Flip U / Flip V, Rotate 90°, Fit to 0-1, Select island, Auto unwrap, Pack. Mark seams in the 3D view (edge mode) to split islands.

::: tip
The page also opens in a browser (**Open in browser**). Outside the editor it cannot write into the project, so Save downloads the file instead.
:::
