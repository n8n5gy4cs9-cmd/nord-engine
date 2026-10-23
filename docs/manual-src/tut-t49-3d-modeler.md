---
title: T49 Model and paint a crate (3D Modeler)
section: Tutorials
order: 49
summary: Build a crate from a cube in the 3D Modeler, paint its texture, fix its UVs, export a GLB and put it in a 3D scene.
---
**Result:** a wooden-looking crate (`models/crate.glb`) that sits in your 3D scene. Allow 20 minutes. **Start from:** any 3D project (`nord new lab -t 3d`).

::: dummies
A 3D model is a list of points (**vertices**) joined into flat faces. A **texture** is a picture wrapped around it, and the **UV map** tells each face which part of the picture it shows. The Modeler lets you do all three for small props without leaving Nord.
:::

## 1. Open the Modeler and make the box
1. **Window ▸ Editors ▸ 3D Modeler**. Click **Cube**. Type `crate` in the name box at the top.
2. Switch the selection mode to **Face**, click the top face, then press **Inset** (Amount `0.25`) and **Extrude** (Amount `-0.1`). You now have a sunken lid.
3. **Center on ground** puts the crate on the floor at the origin.

## 2. Paint the texture
1. Open the **Texture** tab. Choose size **32**, pick a brown with the colour box, press **New blank**.
2. Use **Pencil** (size 1) with a darker brown for planks, **Fill** to colour areas, **Mirror X** for symmetric details. Turn **UV overlay** on to see where the faces are.
3. Back in the **3D** tab tick **Paint on model** and paint a nail head straight onto the crate.

## 3. Fix the UVs
Open the **UV editor** tab. Click a face to select it and drag it onto a plank area of the texture. Use **Flip U / Flip V / Rotate 90°** if a pattern is the wrong way round, and tick **snap to texel** to land exactly on pixels.

## 4. Save and use it
1. **Save** writes `models/crate.mesh.json` (editable). Press **GLB** to export `models/crate.glb`.
2. In your scene add an entity with a **model** component, set **Path** to `models/crate.glb`. Press Play.

**Check yourself:** the crate is visible, the painted nail is where you drew it, and reopening **Open…** in the Modeler brings back the editable mesh. Need symmetry? **Mirror X** after moving half the mesh away from the middle.

Reference: [3D Modeler](modeler.html). **Next:** [T50 Animator](tut-t50-animator.html).
