# 3D Modeler (editor tab)
A small polygon modeller + pixel texture painter + UV editor for quick prop fixes, in `editor/modeler/` (web page embedded in the editor like the UI Designer; **Open in browser** works too). Mesh editing core ported from the owner's BlockSmith app (`mesh-model.js`, parts of `modeler.js`); texture painter and UV editor are new. Uses vendored **three.js 0.180.0** (`vendor/three/`, editor only; never part of an export).

## Files (project `models/`, written through `/api/fpsc/save`)
`<name>.mesh.json` (format `nord-mesh-1`: `vertices`, `faces[{v, uv}]`, `colors`, `seams`, `color`, `texture` as PNG data URL; `blocksmith-mesh-1` files open too), `<name>.glb`/`.gltf` (texture + vertex colours), `<name>.obj` + `.mtl` + `.png`, `<name>.png` (texture only). `?file=models/x.mesh.json` opens a file. Outside the editor Save downloads instead.

## Tools
Create: cube, plane, cylinder, sphere, draw polygon, add vertex, fill boundary, **Import OBJ**. Select face/edge/vertex. Transform gizmo or numeric. Edit: extrude, inset, loop cut, split edge, cut face, detach, merge, weld, optimize, delete, flip, triangulate, bevel, **subdivide all, mirror X/Y/Z, center on ground**. Texture tab: pencil, eraser, fill, picker, brush size, mirror X, 16–512 px, UV overlay, load PNG, **Paint on model**. UV editor tab: drag faces or single UV points, flip/rotate/fit, select island, auto unwrap, pack, snap to texel. Undo/redo, local draft in `localStorage` (`nord.mesh-draft`).

## Scene models (Inspector ▸ MODEL ▸ ⋮ ▸ Open in 3D Modeler)
`?file=models/x.glb&entity=<id>&prefab=<path>` opens a `.glb`/`.gltf` as is (three.js `GLTFLoader`, vendored): meshes merged with node transforms, first texture kept (max 1024 px), plain material colours baked to vertex colours, duplicates welded. **Save** then shows a dialog (overwrite / new model / new prefab / new prefab variant) and POSTs `{t:'model-saved', mode, file, entity, prefab}` to `/api/ipc`; the editor (`EditorState::modeler_saved`, `prefab.rs`) switches the object's `model.path`, makes the prefab or the variant (override diff) and pushes the new context back to the page. Lost on save: skeleton/animation, extra textures, smooth normals. Full guide + tutorials: manual chapter *3D Modeler*, T49, T54. Screenshots: `node tools/modeler-shots.mjs`.

## Scene mesh primitives (Inspector ▸ MESH ▸ Edit as model in 3D Modeler)
`?mesh=<shape>&size=x,y,z&seg=n&ename=<name>&entity=<id>` builds the primitive as editable geometry (box→cube, sphere, cylinder, capsule→cylinder, plane/ground, torus; sizes as in `runtime/babylon/components.js`). **Save** offers *new model for this object* / *new prefab* (no overwrite: there is no file). The editor's `modeler_saved` replaces the object's `mesh` component by `model {path}` (also for the base entity when a prefab variant is made). Not saving sends no message, so the scene is untouched. Console: lines and the filter buttons now carry Info / Warn / Error / Build icons.

## Picture layers (editor/modeler/layers.js)
Texture tab ▸ **Layer** tool + panel under the texture: add PNG/JPG/WebP pictures (file picker, drop, paste, project PNGs), move / resize (corner handles, Shift = free) / rotate (Shift = 15°) / flip / opacity / crop (cut) / duplicate / order / trim transparent / remove colour / fit to the UV area of the selected faces. Layers are working objects only: they are **merged into the single texture** (`bake`) when painting with another tool, on Merge, and before save/export (`finalizeTexture`), so the model keeps one PNG. Pictures shrink to 512 px on import; texture size 16–1024; optional colour reduction (6/5/4 bits) at save; PNG size shown (red over 2 MB). Layers are not stored in `.mesh.json`.

## Limits / not done
GLB import only through Open in 3D Modeler (no menu to import an arbitrary file yet), no skeleton/animation authoring, no vertex-colour bake. Texture is one image per mesh. Undo keeps whole-mesh snapshots (80 steps / 32 MB). Native-window behaviour (wry) not verified here.

## AI / MCP
The same files can be edited headlessly by an AI agent: see `docs/MCP.md` (`modeler_*` tools incl. `modeler_preview`).
