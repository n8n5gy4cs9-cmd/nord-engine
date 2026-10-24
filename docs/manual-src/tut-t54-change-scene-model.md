---
title: T54 Change a model in your scene (and its texture)
section: Tutorials
order: 54
summary: Open a model that is already in your scene in the 3D Modeler as it is, change the shape and paint on its texture, then choose whether to overwrite it, keep a new model, make a prefab or a prefab variant.
---
**Result:** one bench in your scene looks different (new shape, repainted texture) while the other benches stay as they were; or, if you want, all of them change. Allow 15 minutes. **Start from:** a 3D scene with an entity that has a **model** component (drag a `.glb` from the Assets tab into the Hierarchy). Related: [T49 Model a crate from scratch](tut-t49-3d-modeler.html).

::: dummies
Many entities can share **one** model file, and a **prefab** is a saved entity you can place many times. So changing "the model" can mean different things: change the file (everything using it changes), give just this object a new copy, or make a new prefab. The Modeler asks you which, when you save.
:::

## 1. Open the scene model in the Modeler
1. Select the object in the Hierarchy or the Scene view.
2. In the Inspector, scroll to the **MODEL** component and press **✎ Open in 3D Modeler** below its fields. (Or right-click the object in the Hierarchy ▸ **Open model in 3D Modeler**; or select a `.glb` in the Assets tab and press **Open in 3D Modeler** in the Inspector, which has no scene object.)
3. The Modeler tab opens with the model as it is, with its colours and texture. The status line shows what was read.

<figure class="shot"><img src="assets/screenshots/mod-7-open-scene-model.png" alt="Scene model opened in the Modeler" loading="lazy"><figcaption>The model from the scene, opened as is. The top of the tab says which file and object you are editing.</figcaption></figure>

If the status says animations or extra textures will be lost, remember it for step 4: choose a **new** model, not Overwrite.

::: tip
**No MODEL component, only MESH?** Built-in shapes (box, cylinder…) are not model files. In the **MESH** component press **Edit as model in 3D Modeler**; saving replaces the mesh with your new model, cancelling changes nothing. See the [3D Modeler chapter](modeler.html).
:::

## 2. Change the shape
Use **Face** mode, click faces, then **Extrude** / **Inset** / move with the gizmo. **Mirror X** for symmetric changes, **Center on ground** keeps it on the floor. Details of every tool: [3D Modeler chapter](modeler.html).

## 3. Paint on the current texture
1. Open the **Texture** tab: the model's own texture is there, not a blank one. Pick a colour and paint with **Pencil**, **Fill**, **Picker** (to copy an existing colour).
2. Or tick **Paint on model** in the 3D tab and paint directly on the surface.

<figure class="shot"><img src="assets/screenshots/mod-6-paint-on-model.png" alt="Painting directly on the model" loading="lazy"><figcaption>Paint on model uses the same brush as the Texture tab.</figcaption></figure>

If a face shows the wrong part of the texture, fix it in the **UV editor** tab.

## 4. Save: choose what happens
Press **Save**. The Modeler asks:

<figure class="shot"><img src="assets/screenshots/mod-9-save-dialog-plain.png" alt="Save dialog for a plain scene object" loading="lazy"><figcaption>Plain object: overwrite, new model for this object, or new prefab.</figcaption></figure>

* **Overwrite the model**: `models/<name>.glb` is replaced. Every entity that uses it changes.
* **Save as a new model for the selected object**: a new file, only this object uses it. Type the name first.
* **Save as a new prefab**: a new file, plus a prefab made from this object.

If the selected object is a prefab instance you get **Save as a new prefab variant** instead: a new model plus a variant prefab, and the selected instance switches to it.

<figure class="shot"><img src="assets/screenshots/mod-8-save-dialog.png" alt="Save dialog for a prefab instance" loading="lazy"><figcaption>Prefab instance: overwrite everything, or a new variant.</figcaption></figure>

## 5. Check it
Go back to the Scene view. For **new model / prefab / variant** the object already uses the new file (Inspector ▸ MODEL ▸ Path shows it; the prefab is in `prefabs/`). After **Overwrite**, reload the scene view once to see the new shape. Undo (Ctrl/Cmd+Z) in the editor undoes the path change, not the file.

**Check yourself:** one bench is changed, the others are not (new model), or all benches changed (overwrite); the painted details are visible in Play.

Reference: [3D Modeler](modeler.html), [Prefabs](unity-workflow.html). **Next:** [T50 Animator](tut-t50-animator.html).
