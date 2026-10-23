# 3D Modeler (editor tab)
A small polygon modeller + pixel texture painter + UV editor for quick prop fixes, in `editor/modeler/` (web page embedded in the editor like the UI Designer; **Open in browser** works too). Mesh editing core ported from the owner's BlockSmith app (`mesh-model.js`, parts of `modeler.js`); texture painter and UV editor are new. Uses vendored **three.js 0.180.0** (`vendor/three/`, editor only; never part of an export).

## Files (project `models/`, written through `/api/fpsc/save`)
`<name>.mesh.json` (format `nord-mesh-1`: `vertices`, `faces[{v, uv}]`, `colors`, `seams`, `color`, `texture` as PNG data URL; `blocksmith-mesh-1` files open too), `<name>.glb`/`.gltf` (texture + vertex colours), `<name>.obj` + `.mtl` + `.png`, `<name>.png` (texture only). `?file=models/x.mesh.json` opens a file. Outside the editor Save downloads instead.

## Tools
Create: cube, plane, cylinder, sphere, draw polygon, add vertex, fill boundary, **Import OBJ**. Select face/edge/vertex. Transform gizmo or numeric. Edit: extrude, inset, loop cut, split edge, cut face, detach, merge, weld, optimize, delete, flip, triangulate, bevel, **subdivide all, mirror X/Y/Z, center on ground**. Texture tab: pencil, eraser, fill, picker, brush size, mirror X, 16–512 px, UV overlay, load PNG, **Paint on model**. UV editor tab: drag faces or single UV points, flip/rotate/fit, select island, auto unwrap, pack, snap to texel. Undo/redo, local draft in `localStorage` (`nord.mesh-draft`).

## Limits / not done
No GLB import, no skeleton/animation authoring, no vertex-colour bake. Texture is one image per mesh. Undo keeps whole-mesh snapshots (80 steps / 32 MB). Native-window behaviour (wry) not verified here.
