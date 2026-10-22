---
title: T10 3D scene & camera
section: Tutorials
order: 10
summary: Primitives, lights, shadows, skybox and an orbit camera.
---
**Project:** `nord new box3d -t 3d` · look at `examples/playground-3d`.

1. Ground: entity with [`mesh`](component-mesh.html) `shape: ground`, `size: [20, 0, 20]` and a [`material`](component-material.html) `color: #5e81ac`.
2. A cube at `[0, 0.5, 0]` (`mesh` box, `castShadow: true`).
3. Sun: entity with [`light`](component-light.html) `kind: directional`, `castShadows: true`, rotate it `[50, -30, 0]`.
4. Sky: entity with [`skybox`](component-skybox.html) `path: assets/skybox/day`.
5. Camera: entity with [`camera`](component-camera.html) `type: orbit`, `radius: 8`, `follow: <cube name>`, `userControl: true`.
6. Move around: **Alt+left-drag** orbits, **middle-drag** pans, **F** frames the selection; **Q W E R T** pick Hand / Move / Rotate / Scale / Rect, and **Local/Global** in the toolbar switches the gizmo space. Drag an asset from **Assets** over the Scene view to place it where you drop it. The **Gizmos ▾** menu in the Scene bar shows or hides the grid, camera/light icons and collider outlines.
7. Polish: [`postProcess`](component-postProcess.html) `bloom: true`, `vignette: 0.3`, `tonemap: true`.
7. Models: drop `assets/packs/kenney-platformer-3d/models/character.glb` into your `assets/` and add a [`model`](component-model.html).

Reference: [3D games](3d.html). **Next:** [T11 3D physics (FPS)](tut-t11-3d-physics.html).
