---
title: 3D Modeler
section: Manual
order: 32
summary: Full guide to the 3D Modeler: build a model from scratch, open and change the models of your scene with their textures, paint, fix UVs, and save as overwrite, new model, prefab or variant. Every tool explained with screenshots.
---

The **3D Modeler** tab (Window ▸ Editors ▸ 3D Modeler) is for *props and small fixes*: build a crate from a cube, nudge vertices, repaint a texture, fix a UV, change a model that is already in your scene. It is not a replacement for Blender. Everything is saved in the project's `models/` folder.

<figure class="shot"><img src="assets/screenshots/mod-1-overview.png" alt="The 3D Modeler: tool column on the left, 3D view in the middle, material, UV and export panels on the right" loading="lazy"><figcaption>The Modeler. Left: create, select, transform and edit tools. Middle: the 3D / UV editor / Texture views. Right: material colour, UV mapping, export. Bottom line: status messages.</figcaption></figure>

## Open a model from your scene

Three ways, all do the same:

1. **Inspector button.** Select the object in the Hierarchy (or click it in the Scene view). In the Inspector scroll to the **MODEL** component and press **✎ Open in 3D Modeler** under its fields.
2. **Hierarchy.** Right-click the object ▸ **Open model in 3D Modeler** (only shown when the object has a model).
3. **Assets tab.** Select a `.glb` / `.gltf` file, then press **Open in 3D Modeler** in the Inspector. No scene object is attached, so Save can only write a new file.

(The MODEL header's **⋮** menu has the same command.) The Modeler tab comes to the front, showing the model as it is. The top bar says **Editing models/x.glb**; **Detach** there cuts the link to the scene object.

::: tip
If the button is greyed out the MODEL component has no **Path** yet. If you cannot see a MODEL component the object has no model: add one with **+ Add component ▸ Model**, or drag a `.glb` from the Assets tab onto the object. After updating Nord Engine, restart the editor so the new buttons appear.
:::

## Edit a built-in shape (mesh) as a model
Objects like Neon Harbor's towers use a **MESH** component (box, sphere, cylinder, capsule, plane/ground, torus + size) instead of a model file, so there is no file to open. Turn one into a model:

1. Select the object. In the Inspector, **MESH** component, press **Edit as model in 3D Modeler**.
2. The Modeler opens with that shape as editable geometry, in the right size. Shape it, paint a texture.
3. Press **Save** and choose **Save as a new model for the selected object** (or **Save as a new prefab**). The object's **MESH** component is replaced by a **MODEL** component that points at the new `.glb`.
4. **Nothing is changed until you save.** Close the tab or never press Save and the object keeps its mesh exactly as it was.

Notes: a capsule opens as a cylinder; the number of sides follows the Modeler's primitives, not the component's *segments*; the mesh's material component stays on the object (the model brings its own colours and texture), remove it if you do not want it.

## Quick tasks (step by step)

**Make a model from nothing.** Press **New**, type a name in the box at the top, click **Cube**. Move/shape it (below), open the **Texture** tab and paint, then **Save** and press **GLB**. Full lesson: [T49](tut-t49-3d-modeler.html).

**Select something.** Choose **Face**, **Edge** or **Vertex** in the Selection box, then click in the 3D view. **Shift-click** adds more. **Select all** / **Deselect** / **Invert** are in the same panel.

**Move, rotate or scale a selection.** Select it, then drag the coloured arrows of the gizmo in the view, or type numbers in **X / Y / Z**, pick **Move / Rotate / Scale** and press **Apply numeric transform**. Turn on **Grid snap** to move in steps of **Grid step**.

**Make a part bigger or add a bump.** Select a face, set **Amount** (for example `0.3`) and press **Extrude**. A negative Amount pushes in.

**Make a window or a panel.** Select a face, **Inset** (Amount `0.2`), then **Extrude** with `-0.1`.

**Add detail across a wall.** Edge mode, select one edge of the wall, press **Loop cut**: a new ring of edges appears. Move it with the gizmo.

**Make it symmetric.** Move half of the model away from the centre plane, press **Mirror X** (or Y / Z). The copy is welded on.

**Put it on the floor.** **Center on ground**.

**Change the colour of the whole model.** Pick a colour in **Solid colour** (right panel), press **Apply solid colour**. A part only: select its vertices, pick a colour, **Paint selected vertices**.

**Paint the texture.** Open the **Texture** tab. If the model has no texture yet press **New blank** (size 32 or 64 is plenty). Choose **Pencil**, pick a colour, drag on the picture. **Fill** floods an area, **Picker** copies a colour, **Eraser** removes. Tick **UV overlay** to see where each face sits.

**Paint straight on the model.** In the **3D** tab tick **Paint on model**, pick the tool/colour in the Texture tab, then drag on the model. Untick it to select faces again.

**Fix a face that shows the wrong part of the texture.** Open **UV editor**, click the face, drag it to the right spot. **Flip U / V** or **Rotate 90°** if mirrored/turned. If everything is a mess: **Auto unwrap**, then **Pack**.

**Change a model in the scene and keep the others.** Open it from the scene (above), edit, press **Save**, choose **Save as a new model for the selected object**, type a name, confirm. Only the selected object now uses it. Lesson: [T54](tut-t54-change-scene-model.html).

**Change a model everywhere.** Same, but choose **Overwrite the model**. Every object and prefab that uses the file changes.

**Make a new prefab / prefab variant.** Save ▸ **Save as a new prefab** (plain object) or **Save as a new prefab variant** (prefab instance).

**Undo a mistake.** Ctrl/Cmd+Z, or **Undo**. Shift+Ctrl/Cmd+Z redoes.

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

### Picture layers: add PNGs and arrange them
The model always has **one** texture. @ui[Picture layers] let you put pictures (PNG, JPG, WebP) on it and move them around like stickers; when you are done they are **merged into that one texture**, so ten pictures never mean ten files or a 100 MB model.

<figure class="shot"><img src="assets/screenshots/mod-10-layers.png" alt="Texture tab with a blue picture layer selected and its handles" loading="lazy"><figcaption>A picture layer on the texture: corner squares resize, the round handle rotates. The layer list and properties are under the texture.</figcaption></figure>

1. Open the @ui[Texture] tab. Press @ui[+ Add pictures…] (select several files at once), or **drop files** on the texture, or **paste** an image with @key[Ctrl/Cmd+V], or @ui[+ From project…] for PNGs in `models/`.
2. Pick the @ui[Layer] tool (next to Picker). Click a picture to select it (yellow dashed box). **Drag** to move; drag a **corner square** to resize (@key[Shift] = stretch freely); drag the **round handle** to rotate (@key[Shift] = 15° steps). Arrow keys nudge 1 px (@key[Shift] 8 px), @key[Delete] removes, @key[Ctrl/Cmd+D] duplicates.
3. Under the texture: the layer list (thumbnail, name, @ui[Hide]/@ui[Show]) and the properties of the selected layer:
   * @ui[X / Y / Width / Height / Rotate / Opacity %], @ui[keep proportions], @ui[Flip horizontal / vertical], @ui[Smooth] (off = crisp pixels, on = soft edges).
   * **Cut:** @ui[Cut Left / Top / Right / Bottom] crop the picture (in picture pixels). @ui[Trim transparent] removes empty edges.
   * Buttons: @ui[Duplicate], @ui[Delete], @ui[Forward], @ui[Backward], @ui[To front], @ui[To back], @ui[Center], @ui[Fill texture], @ui[Original size].
   * @ui[Fit to selected faces]: select faces in the 3D or UV tab first, then the picture is placed exactly over their UV area. This is the fastest way to texture a wall with a picture.
   * @ui[Remove painted colour]: makes the colour of the colour box transparent in this picture (with a tolerance), handy for white backgrounds.
4. Pictures are **merged into the texture** when you press @ui[Merge … layers into texture], when you paint with any other tool, and automatically when you save or export. After merging they are normal pixels (use Undo to get the layers back, one step).

**Keeping it small:**
* Big pictures are shrunk to 512 px on import; @ui[Shrink data] resamples a picture to its size on the texture.
* The size menu next to the buttons resizes the whole texture (16 to 1024) and scales everything with it. The line next to it shows the PNG size, in red when it is over 2 MB.
* @ui[Compress: light / medium / strong] reduces colours (6 / 5 / 4 bits per channel) when you save, which makes the PNG much smaller; it suits flat, game-like art.
* Limits: 64 layers at a time; texture up to 1024×1024.

### Paint on model
Tick **Paint on model** in the top bar and drag on the model in the 3D view: the pixels under the brush change. Same colour, size and tool as the Texture tab.

<figure class="shot"><img src="assets/screenshots/mod-6-paint-on-model.png" alt="3D view with Paint on model enabled" loading="lazy"><figcaption>Paint on model: the brush paints the texture where the model is clicked.</figcaption></figure>

## UV editor tab

<figure class="shot"><img src="assets/screenshots/mod-5-uv.png" alt="UV editor with faces laid out on the texture" loading="lazy"><figcaption>UV editor: every face on the texture square.</figcaption></figure>

Click a face to select it (Shift extends), drag to move it; switch **Drag** to *points* to move single corners; **snap to texel** snaps to texture pixels. Buttons: **Flip U / V**, **Rotate 90°**, **Fit to 0-1**, **Select island**, **Auto unwrap** (project each face), **Pack** (arrange all on the texture without overlap).

## Limits
One texture per mesh. Flat shading only. No skeleton/animation authoring or import. Undo keeps whole-mesh snapshots (80 steps / 32 MB). A draft is kept in the browser (`nord.mesh-draft`). Outside the editor (**Open in browser**) Save downloads files and the save dialog cannot change scene objects. The Scene view picks up an overwritten model after a reload.
