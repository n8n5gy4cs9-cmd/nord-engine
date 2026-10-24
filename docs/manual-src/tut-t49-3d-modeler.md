---
title: T49 Model and paint a crate (3D Modeler)
section: Tutorials
order: 49
summary: Build a crate from scratch in the 3D Modeler: shape it, paint its texture (also straight on the model), fix its UVs, export a GLB and put it in a 3D scene.
---
**Result:** a wooden-looking crate (`models/crate.glb`) that sits in your 3D scene. Allow 25 minutes. **Start from:** any 3D project (`nord new lab -t 3d`). Every tool is explained in the [3D Modeler chapter](modeler.html).

::: dummies
A 3D model is a list of points (**vertices**) joined into flat faces. A **texture** is a picture wrapped around it, and the **UV map** tells each face which part of the picture it shows. The Modeler lets you do all three for small props without leaving Nord.
:::

## 1. Open the Modeler and make the box
1. **Window ▸ Editors ▸ 3D Modeler**. The tab opens empty.

<figure class="shot"><img src="assets/screenshots/mod-1-overview.png" alt="Empty 3D Modeler" loading="lazy"><figcaption>Left: tools. Middle: view. Right: material, UV, export.</figcaption></figure>

2. Type `crate` in the name box at the top. Click **Cube** in the left column: a cube appears.

<figure class="shot"><img src="assets/screenshots/mod-2-cube.png" alt="A cube selected in the Modeler" loading="lazy"><figcaption>A cube with all faces selected (the blue/green tint) and the move gizmo.</figcaption></figure>

3. Selection mode **Face**, click the top face, set **Amount** to `0.25` and press **Inset**, then set Amount `-0.1` and press **Extrude**. You now have a sunken lid. (In the picture the whole cube was inset and extruded to show the tools.)

<figure class="shot"><img src="assets/screenshots/mod-3-extrude.png" alt="Cube after inset and extrude" loading="lazy"><figcaption>Inset makes a smaller face with a border, Extrude pushes it in or out.</figcaption></figure>

4. Press **Center on ground**: the crate stands on the floor at the origin.

## 2. Paint the texture
1. Open the **Texture** tab. Choose size **32**, pick a brown with the colour box, press **New blank**.
2. Use **Pencil** (size 1) with a darker brown for planks, **Fill** for areas, **Mirror X** for symmetric details. Turn **UV overlay** on: the yellow rectangles are the faces, so paint inside them.

<figure class="shot"><img src="assets/screenshots/mod-4-texture.png" alt="Painting planks on the texture" loading="lazy"><figcaption>Two plank lines painted across the faces.</figcaption></figure>

3. Back in the **3D** tab tick **Paint on model** and paint a nail head straight onto the crate.

<figure class="shot"><img src="assets/screenshots/mod-6-paint-on-model.png" alt="Paint on model switched on" loading="lazy"><figcaption>With Paint on model the brush works on the 3D view.</figcaption></figure>

**Use a picture instead of painting:** @ui[+ Add pictures…] puts a PNG on the texture; move, resize, rotate and stack it with the @ui[Pictures] tool. All pictures end up in the one texture.

## 3. Fix the UVs
Open the **UV editor** tab. Click a face to select it and drag it onto a plank area of the texture. **Flip U / V** and **Rotate 90°** fix patterns that are the wrong way round; **snap to texel** lands exactly on pixels; **Auto unwrap** + **Pack** start over.

<figure class="shot"><img src="assets/screenshots/mod-5-uv.png" alt="UV editor" loading="lazy"><figcaption>Each square is one face of the crate on the texture.</figcaption></figure>

## 4. Save and use it
1. **Save** writes `models/crate.mesh.json` (editable). Press **GLB** to export `models/crate.glb`.
2. In your scene add an entity with a **model** component, set **Path** to `models/crate.glb`. Press Play.

**Check yourself:** the crate is visible, the painted nail is where you drew it, and **Open…** in the Modeler brings back the editable mesh. Need symmetry? **Mirror X** after moving half the mesh away from the middle.

Reference: [3D Modeler](modeler.html). **Next:** [T54 Change a model in your scene](tut-t54-change-scene-model.html), then [T50 Animator](tut-t50-animator.html).
