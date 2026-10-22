# godotize-nordengine-tasks.md
Plan: `docs/GODOTIZE_PLAN.md`. Goal: Nord Engine edits like Unity (Scene/Game/Hierarchy/Inspector/Project/Prefabs), built on Godot's open design (MIT, `REFE/godot-master`), keeping Event sheets, FPS Level, 2D Level, UI Designer, Graph.
**Working rule (owner): clone, don't reinvent.** For each task first open the matching Godot file (MIT) and translate its logic; use Unity only to match behaviour/shortcuts (its licence forbids copying code).
Tick with `[x]`, also register in PRD.json via `node tools/tasks.mjs add M13 "…"` / `done`. Unity code in `REFE/UnityCsReference-master` is reference-only.

## G0 Foundations
- [x] G0-1 Unity layout presets (2 by 3, Tall, Wide) in View ▸ Layout (custom save/load: dock state already persists)
- [x] G0-2 Scene and Game side by side via the Unity layouts (Play only activates Game inside its own dock leaf, so Scene stays visible)
- [x] G0-3 Menu bar: File / Edit / Assets / GameObject / Component / Window (was View) / Project / Help like Unity
- [~] G0-4 Shortcut table in Settings matching Unity defaults (read-only list done; rebinding todo)
## G1 Scene view
- [x] G1-1 Navigation: Alt+LMB orbit, Alt+Cmd+LMB / MMB pan, wheel zoom, RMB orbit + WASDQE fly (3D); Alt+LMB / MMB pan, wheel zoom (2D) (JS unverified in a browser: no Playwright here)
- [~] G1-2 Tools Q hand, W move, E rotate, R scale, T rect (keys, toolbar, 2D+3D viewport done; dedicated rect handles todo)
- [~] G1-3 Local/Global (3D move/rotate gizmos follow the object) + Pivot/Center toolbar toggles; Center is stored but has no effect until multi-object gizmos exist
- [x] G1-4 Snapping: hold Ctrl/Cmd to toggle snap while dragging (2D + 3D); step values from settings (vertex snap not done)
- [~] G1-5 Multi-select: Shift/Ctrl/Cmd toggle (2D+3D), 2D marquee, selection outlines (3D mesh outline, 2D dashed); gizmo/drag still moves only the primary object; 3D marquee todo
- [~] G1-6 Frame selected (F) and Frame all (Shift+F, Edit menu, palette) done; 2D/3D mode switch follows the project type; view cube/axis gizmo todo
- [ ] G1-7 Drag assets from Project into Scene view (sprite, model, prefab, audio) with ghost preview
- [ ] G1-8 Draw modes / gizmo toggles (grid, icons, colliders, lights)
## G2 Hierarchy and Inspector
- [ ] G2-1 Drag reorder + re-parent with drop lines; multi-select
- [ ] G2-2 Active checkbox, prefab icon + blue name, lock/hide toggles per row
- [ ] G2-3 Inspector component cards: enable toggle, ⋮ menu (Reset, Copy/Paste values, Move up/down, Remove)
- [ ] G2-4 Add Component searchable popup with categories
- [ ] G2-5 Multi-object edit (mixed values shown as —)
- [ ] G2-6 Object/texture/material pickers with thumbnails and drag & drop
- [ ] G2-7 Inspector lock + Debug mode
## G3 Prefabs
- [ ] G3-1 Prefab mode (open prefab in isolation, breadcrumb, Save/Auto save)
- [ ] G3-2 Overrides menu: Apply all / Revert all / per-field Apply to prefab
- [ ] G3-3 Drag Hierarchy entity into Project = create prefab; Unpack; Unpack completely
- [ ] G3-4 Nested prefabs + prefab variants
- [ ] G3-5 Overrides for children and added/removed components (not only field values)
## G4 Project, materials, import
- [ ] G4-1 Project browser: thumbnails size slider, type/label filters, favourites, Find references
- [ ] G4-2 Material assets `*.mat.json` + Inspector (colour, texture slots, tiling/offset, normal, emissive, shader)
- [ ] G4-3 Material preview sphere/quad in Inspector and Project
- [ ] G4-4 Texture import settings (filter, PPU, pivot, wrap, max size) + sprite slicing hand-off to Sprite editor
- [ ] G4-5 Change texture/material by dropping onto object or Inspector slot (Scene view and Hierarchy too)
- [ ] G4-6 Model import settings (scale, materials remap)
## G5 Build and Game view
- [ ] G5-1 Build Settings window (scenes in build, platform list, Build / Build And Run)
- [ ] G5-2 Platforms: Web, macOS, Windows (cross), Linux; plan Android/iOS
- [ ] G5-3 Game view: aspect/resolution drop-down, scale slider, Maximize on Play, Stats overlay
- [ ] G5-4 Error Pause, Clear on Play (done), Play focused
## G6 Improve existing tools
- [ ] G6-1 UI Designer: Canvas scaler + resolution preview, anchor preset grid, on-canvas rect handles
- [ ] G6-2 UI Designer: Layout groups, sprite-state buttons, tint in skins, copy/paste/undo polish, UI prefabs
- [ ] G6-3 Graph: comments/groups, reroute, categorised search-to-add, subgraphs, minimap, auto-layout
- [ ] G6-4 Graph: variables panel, live flow highlight while playing, F1 node docs
- [ ] G6-5 Event sheets: Inspector-style param editors, search, debug highlight, F1 docs
- [ ] G6-6 FPS Level + 2D Level editors: share Scene-view navigation/snapping/hotkeys
## G7 Fun features
- [ ] G7-1 Scene templates and "New scene" dialog
- [ ] G7-2 Find in scenes / project search; Find References
- [ ] G7-3 Play-mode "Apply to scene" for remote edits
- [ ] G7-4 Profiler panel (fps, entities, draw calls, memory)
- [ ] G7-5 Screenshot / GIF recorder from Game view
- [ ] G7-6 In-editor "first 10 minutes" tutorial
- [ ] G7-7 Signals: method picker from script source (finish M8-32)
## G8 Fix old things
- [ ] G8-1 `nord-core schema::schemas_parse` (23 vs 22) fix
- [ ] G8-2 Five strict-Clippy lints
- [ ] G8-3 Playwright suites T36/T38/T40–T43 after UI conversion
- [ ] G8-4 Walk KNOWN_ISSUES.md; close or document each; owner-only items listed
- [ ] G8-5 Verify native egui parts on macOS (F5/F6, remote tree, F1) and record in KNOWN_ISSUES
## G9 Look: PlayCanvas-style UI aesthetics (owner reference screenshot: PlayCanvas editor)
Target look (own theme + icons, no PlayCanvas assets/code copied; behaviour only): dark blue-grey panels (#20292b / #293538 range) with thin
dividers; narrow **vertical tool rail** on the far left (Move/Rotate/Scale, World/Local, Snap, Focus, Camera, Lights…) with an orange active
accent; panel headers = small orange ▼ collapse arrow + UPPERCASE title (HIERARCHY, ASSETS, SETTINGS) with + / copy / delete icons on the right;
Hierarchy = tree with dot/expand icons and a search field; viewport has a floating top bar (scene tabs, Perspective drop-down, gizmo/settings/fullscreen
and a big Play button); Inspector = collapsible UPPERCASE sections with flat dark inputs, label-left/value-right rows with unit suffix chips (Divisions, Size);
bottom Assets panel = folder tree + large folder tiles, filter drop-down + search + Library toggle; slim status bar at the bottom.
- [ ] G9-1 New egui theme "PlayCanvas" (colours, 2px rounding, flat inputs, orange accent) in `assets/themes/themes.json`, set as default
- [ ] G9-2 Panel header style: orange collapse arrow + UPPERCASE title + right-aligned action icons (all docks)
- [ ] G9-3 Left vertical tool rail (move/rotate/scale, world/local, snap, focus, camera, lights) driving the Scene view tools
- [ ] G9-4 Floating viewport top bar: scene tabs, Perspective/Ortho drop-down, gizmo + settings + fullscreen buttons, big Play button
- [ ] G9-5 Inspector: collapsible UPPERCASE sections, flat inputs with unit chips, label-left/value-right rows
- [ ] G9-6 Assets panel: folder tree + large folder tiles, type filter + search + Library toggle
- [ ] G9-7 Slim status bar (selected property/path left, counters right); icon set consistent (Lucide, already vendored)

## G10 Unity-style coding (owner request, do later)
Keep the current NordScript API; add helpers/libraries so scripts feel like Unity C# (behaviour only, no Unity code).
- [ ] G10-1 Singleton helper (`Singleton.get(Class)` / `static instance`) + persistent-across-scenes option
- [ ] G10-2 GameManager / AudioManager / SceneManager-style ready-made services (`Game.loadScene`, `Game.pause`, score/state store, events)
- [ ] G10-3 Unity-like API names: `GetComponent`, `Find`, `FindWithTag`, `Instantiate`, `Destroy`, `Time.deltaTime`, `Input.GetKey`, `Mathf`, `Vector2/3`, coroutines (`StartCoroutine`/`yield WaitForSeconds`)
- [ ] G10-4 Lifecycle aliases: Awake/Start/Update/FixedUpdate/LateUpdate/OnEnable/OnDisable/OnDestroy, OnCollisionEnter/OnTriggerEnter
- [ ] G10-5 `[SerializeField]`-style attributes, ScriptableObject-like data assets, Object pool, simple event bus/UnityEvent
- [ ] G10-6 Script templates ("New script" menu: MonoBehaviour-like, Singleton, GameManager) + manual chapter + examples
