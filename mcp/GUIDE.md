# Making a game with Nord Engine (AI workflow guide)

You are connected to the **Nord MCP server**. It works on one Nord *project folder* (a folder with `nord.project.json`). Everything is plain JSON + JavaScript files, so you can build a complete game with the tools below. Read this once, then follow the loop.

## The loop
1. **Project.** `project_templates` → `project_new {dir, template}` (or `project_open {path}`). Use `2d` / `3d` for blank, or a starter like `platformer`, `endless-runner`, `fps-arena`, `card-game` when the game resembles one: starting from a working template is much faster than from nothing. `project_info` shows what exists.
2. **Learn the API only when needed.** Unity-style, runnable recipes: `nord_guide {topic:"ex-game-manager"}`, `ex-spawn-destroy`, `ex-collisions`, `ex-time-coroutines`, `ex-ui-hud`, `ex-events`, `ex-ai-states`, `ex-coin-dash` (a whole game), `ex-migration` (C# to JS traps). The project `examples/coin-dash` is a complete small game to copy from. `nord_guide {topic}`: `scripting` (the `NordScript` API), `project-format`, `event-sheets`, `behaviors`, `ui`, `animator`, `multiplayer`, `cookbook`, `api`, `modeler`, `export`. Tutorials: `nord_guide {topic:"t04-platformer"}`. Do not guess API names: read the topic.
3. **Scenes.** `component_schema` lists every component and its fields. `scene_add_entity` / `scene_update_entity` / `scene_remove_entity` edit `scenes/*.scene.json` safely (unique ids, valid format). `scene_get` shows the outline.
4. **Scripts.** Write behaviour with `write_file scripts/<name>.js`:
   ```js
   import { NordScript } from 'nord';
   export default class Player extends NordScript {
     static attributes = { speed: { type: 'number', default: 200 } };
     start() {}
     update(dt) { /* this.input.axis('left','right'), this.entity.pos, this.events.emit(...) */ }
   }
   ```
   Attach it with `scene_add_entity {scripts:[{path:"scripts/player.js", attributes:{…}}]}`. Input actions (`jump`, `left`…) are declared in `nord.project.json` (`input`).
5. **Art and models.** Images/audio go under `assets/` (`write_file` with `encoding: "base64"`; placeholders are fine). 3D props: use the **modeler_*** tools (below), then a `model` component with the saved `.glb`.
6. **Check.** `check_project` after every batch. Fix every reported error before going on.
7. **Play and look.** `serve_start` returns a URL (live reload). Tell the user to open it, or keep iterating. `build_project` makes a static export (`dist/`, `single_file`, `zip`, `host: itch`…).

## Rules that prevent most mistakes
* Paths in scenes/scripts are **project-relative with `/`** (`assets/sprites/player.png`, `models/crate.glb`), never absolute.
* **2D** worlds are pixels, y grows **down**, `display.width/height` is the visible area. **3D** worlds are metres-ish units, y is **up**.
* Entity `id`s must be unique (the tools make them). Never hand-edit ids.
* Prefer small, separate scripts per behaviour and `this.events.emit/on` between them over one giant script.
* Prefer the ready-made library over re-inventing: `library_list {query}` finds scripts/prefabs (AI chase/patrol, cameras, dialogue, inventory, game-over screens, a **Dev Console** prefab with cheat commands…) and `library_add {id}` copies them into the project.
* For testing/cheats add the Dev Console: `library_add {id:"prefab.dev-console"}`, instance the prefab in the first scene, and register game commands from a script with `import { command } from './dev-console.js'` (`command('heal', fn, {description, params:'amount:number=10'})`). The key left of 1 opens it.
* Console log lines starting with a `[Tag]` can be filtered by tag in the editor Console.
* Validate JSON you write by running `check_project`; `write_file` already rejects invalid `.json`.
* A game is done when: it starts without errors in `check_project`, the core loop (move → goal → win/lose → restart) works, there is a title/HUD/game-over, and `build_project` succeeds.

## 3D models with the Modeler tools (`modeler_*`)
They edit the same files as the editor's **3D Modeler** tab (`models/<name>.mesh.json` + `.glb`).
1. `modeler_new {name}` (or `modeler_open {file}` to change an existing model, including a `.glb` used in a scene).
2. Build: `modeler_primitive {kind, size, position, rotation}`, `modeler_extrude`, `modeler_transform`, `modeler_mirror`, `modeler_add_mesh` for custom polygons, `modeler_delete_faces`, `modeler_center_ground`.
3. Address faces with `modeler_describe` (index, direction `+y`/`-x`, centre) or directions like `"+y"`.
4. Texture: `modeler_unwrap`, `modeler_texture_new {size, color}`, `modeler_texture_uv` (where a face sits), `modeler_texture_paint {ops}` (rect, circle, line, polygon, noise, fill; coordinates 0..1, y down).
5. **Look at it**: `modeler_preview {views:["iso","front","top"]}` returns images. Check proportions and texture placement, fix, repeat. Never save blind.
6. `modeler_save {name}` → `models/<name>.glb` (+ editable `.mesh.json` and `.png`). Use it: `scene_add_entity {components:[{"type":"model","path":"models/<name>.glb"}]}`.
Limits: one texture per model, flat shading, no skeleton/animation, faces must be planar convex polygons.

## Keeping this guide true
This guide and `docs/MCP.md` ship with the engine. When engine features change, the engine's AGENTS.md rule requires updating `mcp/GUIDE.md`, the tools and `docs/MCP.md` (`node mcp/nord-mcp.mjs --docs`), and `node --test mcp/mcp.test.mjs` fails when `docs/MCP.md` is stale.
