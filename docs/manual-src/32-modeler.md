---
title: 3D Modeler
section: Manual
order: 32
summary: Full guide to the 3D Modeler: build a model from scratch, open and change the models of your scene with their textures, paint, fix UVs, and save as overwrite, new model, prefab or variant. Every tool explained with screenshots.
---

The **3D Modeler** tab (Window ▸ Editors ▸ 3D Modeler) is for *props and small fixes*: build a crate from a cube, nudge vertices, repaint a texture, fix a UV, change a model that is already in your scene. It is not a replacement for Blender. Everything is saved in the project's `models/` folder.

<figure class="shot"><img src="assets/screenshots/mod-1-overview.png" alt="The 3D Modeler: tool column on the left, 3D view in the middle, material, UV and export panels on the right" loading="lazy"><figcaption>The Modeler. Left: create, select, transform and edit tools. Middle: the 3D / UV editor / Texture views. Right: material colour, UV mapping, export. Bottom line: status messages.</figcaption></figure>

Two ways to start:

* **From scratch** - click a primitive (Cube, Plane...) and model. See [T49 Model and paint a crate](tut-t49-3d-modeler.html).
* **From the scene** - select an object with a **model** component, open the **⋮** menu of that component and choose **Open in 3D Modeler** (or select a model asset in the Assets tab and press **Open in 3D Modeler** in the Inspector). It opens **as is**: geometry, textures and colours. See [T54 Change a model in your scene](tut-t54-change-scene-model.html).

## Files

| File | What it is |
|---|---|
| `models/<name>.mesh.json` | The editable mesh: vertices, faces, UVs, seams, vertex colours and the texture. **Save** / **Open…** use this. |
| `models/<name>.glb` / `.gltf` | The model for a 3D scene (texture and vertex colours included). Saving a scene model writes this. |
| `models/<name>.obj` + `.mtl` + `.png` | Export for other tools. |
| `models/<name>.png` | The texture alone (**Save PNG to project**). |

## Opening a scene model, and what survives

Opening a `.glb` / `.gltf` merges all its meshes into one editable mesh (node transforms applied, duplicate points welded). You get the geometry, the UVs, the first texture and the material colours.

::: tip
What is **not** kept: skeleton and animations, more than one texture (the first is kept; plain material colours are baked into vertex colours), smooth normals (the Modeler is flat-shaded). The status line tells you when something will be lost. If the model is animated, save as a **new** model instead of overwriting.
:::

<figure class="shot"><img src="assets/screenshots/mod-7-open-scene-model.png" alt="A scene model opened in the Modeler with its faces and colours" loading="lazy"><figcaption>A model from the scene, opened as is. The name box shows the file; the status line reports vertices, faces and anything that will be lost.</figcaption></figure>

## Saving a scene model: overwrite, new, prefab, variant

When the Modeler was opened from the editor, **Save** asks what to do, so you never change other things by accident:

<figure class="shot"><img src="assets/screenshots/mod-8-save-dialog.png" alt="Save dialog with overwrite and new prefab variant" loading="lazy"><figcaption>Selected object is a prefab instance: overwrite everything, or a new prefab variant.</figcaption></figure>

| Choice | Offered when | What happens |
|---|---|---|
| **Overwrite the model** | the file is in `models/` | The `.glb` is replaced. **Every** entity and prefab that uses the file changes. |
| **Save as a new model for the selected object** | plain scene object | A new `.glb` is written; only the selected object's **model → Path** is switched to it. |
| **Save as a new prefab** | plain scene object | New `.glb` + a new prefab made from the selected object; the object becomes an instance of it. |
| **Save as a new prefab variant** | the object is a prefab instance | New `.glb` + a variant of the prefab with the new model; the selected instance switches to the variant. The original prefab and other instances stay. |
| **Save as a new model file** | opened from an asset (no scene object) | Writes a new file in `models/`; the scene is unchanged. |

<figure class="shot"><img src="assets/screenshots/mod-9-save-dialog-plain.png" alt="Save dialog for a plain scene object: overwrite, new model, new prefab" loading="lazy"><figcaption>A plain scene object: overwrite, new model for this object only, or a new prefab.</figcaption></figure>

New files get a free name (`name-edit`, `name-edit-2`...). A model that lives outside `models/` (for example inside an asset pack) cannot be overwritten, only saved as a new file. Afterwards the Modeler stays tied to the new file/prefab, so another **Save** continues from there. **Detach** (top of the tab) forgets the scene object for free modelling. Next to the `.glb`, a `.mesh.json` is saved so you can continue editing without re-importing.

## 3D view tools

<figure class="shot"><img src="assets/screenshots/mod-3-extrude.png" alt="A cube after inset and extrude with the move gizmo" loading="lazy"><figcaption>Cube with all faces selected after Inset and Extrude. The coloured arrows are the transform gizmo.</figcaption></figure>

**Navigation:** orbit = left mouse drag, pan = right drag, zoom = wheel, **Fit** frames the mesh. **Wireframe**, **Grid** and **Paint on model** are toggles in the bar above the view. Shortcuts: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Delete removes the selection, Ctrl/Cmd+S saves.

### Create
| Tool | Does |
|---|---|
| **Cube / Plane / Cylinder / Sphere** | Adds a primitive with UVs (it is selected, ready to move). |
| **Draw polygon on grid** + **Finish polygon** | Click ordered points on the ground grid, then Finish to make one face (3+ points). |
| **Add vertex at X/Y/Z** | Adds a single point at the numbers in the Transform fields. |
| **Add face / fill boundary** | Makes a face from selected vertices in order, or fills a hole bounded by selected edges. |
| **Import OBJ…** | Loads a Wavefront file (UVs kept or auto-unwrapped; no textures). |

### Selection
Mode box: **Face / Edge / Vertex**. Click selects, Shift-click extends. **Select all**, **Invert**, **Deselect**, **Edge loop** (extends an edge selection along a regular quad ring).

### Transform
Drag the gizmo, or type **X/Y/Z**, choose **Move / Rotate (degrees) / Scale** and press **Apply numeric transform**. **Grid snap** + **Grid step** snap moves.

### Edit mesh (uses the **Amount** field)
| Tool | Does |
|---|---|
| **Extrude** | Pushes selected faces out (negative Amount = in). |
| **Inset** | Shrinks selected faces into a smaller face with a border. |
| **Loop cut** | Adds a ring of edges across a face strip. |
| **Split edge** | Edge mode: puts a new vertex in the middle of each selected edge. |
| **Add edge / cut face** | Vertex mode: select two non-adjacent vertices of one polygon, then press: the polygon is cut in two along that line. |
| **Detach faces** | Separates selected faces from their neighbours. |
| **Merge vertices / Weld** | Merge = selected points into one; Weld = all points closer than Amount. |
| **Optimize** | Welds points that coincide (1e-5) and removes points no face uses. |
| **Delete** | Deletes selected faces/edges/vertices. |
| **Flip normal** | Turns a face inside out. |
| **Triangulate** | Splits n-gons into triangles. |
| **Face bevel** | Like Extrude, but the new faces are bevelled (chamfered) by Amount. |
| **Subdivide all** | Splits every face into quads. |
| **Mirror X/Y/Z** | Duplicates the mesh across that origin plane and welds the seam (move the half away from the plane first). |
| **Center on ground** | Moves the mesh so it is centred with its bottom on y = 0. |

### Material, UV mapping, export (right panel)
* **Solid colour** + **Apply solid colour** sets the base colour. **Paint selected vertices** stores the colour box's colour as the vertex colour of the selected points (it multiplies with the solid colour and texture; white = no tint). **Checker preview** shows a test pattern to judge UV stretching.
* **UV mapping:** **Mark seam / Clear seam** (edge mode) cut islands; **UV move U/V, rotate, scale** + **Transform selected UVs** change the UVs of selected faces numerically.
* **Export:** **Up axis** (Y up, or Z up baked), **Scale**, then **GLB**, **glTF** or **OBJ + MTL** into `models/`.

## Texture tab

<figure class="shot"><img src="assets/screenshots/mod-4-texture.png" alt="Texture tab with two painted red lines and the UV overlay" loading="lazy"><figcaption>Pixel painter. The yellow rectangles are the UV overlay: the faces of the mesh on the texture.</figcaption></figure>

A pixel painter for the model's texture. **Pencil**, **Eraser**, **Fill** (flood fill), **Picker** (take a colour from the image); colour box + swatches; **Size** (brush); **Mirror X**; **UV overlay** shows where faces are. **Texture** size 16-512 px. **New blank** (fills with the colour), **Fill with colour**, **Load image file** / **Load project PNG…** (replace), **Save PNG to project**, **Remove texture**. A texture of a scene model is shown at its own size (up to 1024 px).

### Paint on model
Tick **Paint on model** in the top bar and drag on the model in the 3D view: the pixels under the brush change. Same colour, size and tool as the Texture tab.

<figure class="shot"><img src="assets/screenshots/mod-6-paint-on-model.png" alt="3D view with Paint on model enabled" loading="lazy"><figcaption>Paint on model: the brush paints the texture where the model is clicked.</figcaption></figure>

## UV editor tab

<figure class="shot"><img src="assets/screenshots/mod-5-uv.png" alt="UV editor with faces laid out on the texture" loading="lazy"><figcaption>UV editor: every face on the texture square.</figcaption></figure>

Click a face to select it (Shift extends), drag to move it; switch **Drag** to *points* to move single corners; **snap to texel** snaps to texture pixels. Buttons: **Flip U / V**, **Rotate 90°**, **Fit to 0-1**, **Select island**, **Auto unwrap** (project each face), **Pack** (arrange all on the texture without overlap).

## Limits
One texture per mesh. Flat shading only. No skeleton/animation authoring or import. Undo keeps whole-mesh snapshots (80 steps / 32 MB). A draft is kept in the browser (`nord.mesh-draft`). Outside the editor (**Open in browser**) Save downloads files and the save dialog cannot change scene objects. The Scene view picks up an overwritten model after a reload.
