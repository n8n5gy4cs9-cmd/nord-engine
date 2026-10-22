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
- [x] G1-1 Navigation: Alt+LMB orbit, Alt+Cmd+LMB / MMB pan, wheel zoom, hold RMB = mouse look + WASD fly (Q/E down/up, Shift x3, speed 9 u/s accelerating, wheel = fly speed), Alt+RMB zoom (3D, as Unity's SceneViewMotion.cs); Alt+LMB / MMB / RMB pan, wheel zoom (2D). Headless test: tools/viewport-fly-test.mjs
- [x] G1-2 Tools Q hand, W move, E rotate, R scale, T rect: 2D axis/plane move, rotate ring, axis+uniform scale, Rect tool with 8 resize handles about the opposite edge (Godot canvas_item select-mode logic; tools/viewport-rect-test.mjs); 3D Babylon gizmos with plane handles + uniform scale cube
- [~] G1-3 Local/Global (3D move/rotate gizmos follow the object) + Pivot/Center toolbar toggles; Center is stored but has no effect until multi-object gizmos exist
- [x] G1-4 Snapping: hold Ctrl/Cmd to toggle snap while dragging (2D + 3D); step values from settings (vertex snap not done)
- [~] G1-5 Multi-select: Shift/Ctrl/Cmd toggle (2D+3D), 2D marquee, selection outlines (3D mesh outline, 2D dashed); gizmo/drag still moves only the primary object; 3D marquee todo
- [~] G1-6 Frame selected (F) and Frame all (Shift+F, Edit menu, palette) done; 2D/3D mode switch follows the project type; view cube/axis gizmo todo
- [~] G1-7 Drag an asset from Assets over the Scene view: ghost preview (sprite image in 2D, marker on the ground plane in 3D), drop = new entity placed there (snap-aware). Built on egui's drag state because the native web view eats pointer events — NOT verified in the native window; sprite/model/prefab/audio entities via the existing asset→entity rules
- [x] G1-8 Viewport bar ▸ Gizmos ▾: Grid, camera/light icons, collider outlines (2D + new 3D wireframes)
## G2 Hierarchy and Inspector
- [x] G2-1 Drag reorder + re-parent with drop lines; multi-select
- [~] G2-2 Active checkbox + blue prefab name done; lock/hide toggles todo (need a scene-format field)
- [~] G2-3 Inspector component ⋮ menu (Reset, Copy/Paste values, Move up/down, Docs, Remove) done; per-component enable toggle todo
- [~] G2-4 Add Component popup is searchable; categories todo
- [x] G2-5 Multi-object edit: Active / Transform for all selected (mixed shows —), Add component to all
- [~] G2-6 Image pickers show a thumbnail of the current texture (drag & drop onto slots existed); material/model thumbnails in the dropdown todo
- [~] G2-7 Inspector lock (padlock) done; Debug mode todo
## G3 Prefabs
- [x] G3-1 Prefab mode: Assets/Inspector ▸ Open prefab edits the prefab on its own (breadcrumb ◀ Scene › Prefab, Save, auto-save on exit)
- [~] G3-2 Inspector Apply all / Revert all done (writes the prefab file); per-field Apply to prefab todo
- [x] G3-3 Drag Hierarchy entity into Assets (or right-click ▸ Create prefab) = prefab; Unpack; Unpack completely
- [x] G3-4 Prefab variants (`variantOf` + `overrides`, runtime + editor; Create variant in Assets/Inspector); nested prefabs: instances inside prefabs expand at runtime and unpack completely
- [~] G3-5 Added/removed components already round-trip (array override replaces); overrides on prefab children todo (children of an instance are not shown in the Hierarchy)
## G4 Project, materials, import
- [x] G4-1 Project browser: thumbnail size slider + type filter (existed), ★ favourites filter, Find references (context menu)
- [x] G4-2 Material assets `*.mat.json` + Inspector (colour, textures, tiling/offset, normal, emissive; no custom shader yet), Babylon runtime loads them
- [~] G4-3 Material preview: flat-shaded sphere approximation in the Inspector; real lit preview and Project thumbnails todo
- [~] G4-4 Texture import: filter + wrap (Inspector, sidecar meta, Phaser+Babylon); PPU, pivot, max size, Sprite-editor hand-off todo
- [~] G4-5 Dropping an asset on an Inspector slot works (existed); dropping onto a Hierarchy row / Scene object todo
- [~] G4-6 Model import: uniform scale (Inspector on a selected model, sidecar meta, Babylon); materials remap todo
## G5 Build and Game view
- [x] G5-1 Build Settings window (File menu / Shift+Cmd+B): scenes in build (`export.excludeScenes`, exporter drops them), start scene, platform list, Build / Build And Run (single-file page opened in the browser)
- [~] G5-2 Platforms listed (Web builds; desktop via the existing Desktop app dialog; Android/iOS shown as planned)
- [x] G5-3 Game view: resolution drop-down, scale slider, Maximize on Play, Stats overlay
- [x] G5-4 Error Pause, Clear on Play, Play focused (Maximize on Play)
## G6 Improve existing tools
- [~] G6-1 UI Designer: anchor preset grid + more preview resolutions done; canvas scaler and on-canvas rect handles todo
- [~] G6-2 UI Designer: Copy/Paste nodes (buttons + Ctrl/Cmd+C/V) done; vbox/hbox layout panels and undo existed; sprite-state buttons, skin tint, UI prefabs todo
- [~] G6-3 Graph: Group button, minimap, reroute/comment nodes, auto-arrange and node search existed/added; subgraphs todo
- [~] G6-4 Graph: variables panel existed; F1 / Docs button opens the node reference; live flow highlight while playing todo
- [~] G6-5 Event sheets: Find in sheet added (ACE picker search existed); Inspector-style param editors, debug highlight, F1 docs todo
- [ ] G6-6 FPS Level + 2D Level editors: share Scene-view navigation/snapping/hotkeys — not started
## G7 Fun features
- [x] G7-1 File ▸ New scene… dialog with templates (empty, 2D, 3D, UI host)
- [x] G7-2 Find References / project search (Project tab, Assets right-click ▸ Find references; existed since M10)
- [x] G7-3 Play mode ▸ Inspector *Apply to scene*: live transform/active/field values written into the scene entity
- [x] G7-4 Window ▸ Profiler: fps, frame-time graph, objects, draw calls, memory, top event-sheet costs (polls the game debugger)
- [x] G7-5 Game view 📷 screenshot → `screenshots/shot-N.png` (GIF recorder todo)
- [x] G7-6 Help ▸ First 10 minutes checklist (ticks itself)
- [x] G7-7 Signals: ▾ method picker from the target's script source
## G8 Fix old things
- [x] G8-1 `nord-core schema::schemas_parse` (23 vs 22) fix
- [x] G8-2 Strict Clippy clean (`cargo clippy --workspace --all-targets -- -D warnings`)
- [ ] G8-3 Playwright suites T36/T38/T40–T43 after UI conversion
- [~] G8-4 KNOWN_ISSUES.md updated for G0–G9; full walk todo
- [ ] G8-5 Verify native egui parts on macOS (F5/F6, remote tree, F1) and record in KNOWN_ISSUES
## G9 Look: PlayCanvas-style UI aesthetics (owner reference screenshot: PlayCanvas editor)
Target look (own theme + icons, no PlayCanvas assets/code copied; behaviour only): dark blue-grey panels (#20292b / #293538 range) with thin
dividers; narrow **vertical tool rail** on the far left (Move/Rotate/Scale, World/Local, Snap, Focus, Camera, Lights…) with an orange active
accent; panel headers = small orange ▼ collapse arrow + UPPERCASE title (HIERARCHY, ASSETS, SETTINGS) with + / copy / delete icons on the right;
Hierarchy = tree with dot/expand icons and a search field; viewport has a floating top bar (scene tabs, Perspective drop-down, gizmo/settings/fullscreen
and a big Play button); Inspector = collapsible UPPERCASE sections with flat dark inputs, label-left/value-right rows with unit suffix chips (Divisions, Size);
bottom Assets panel = folder tree + large folder tiles, filter drop-down + search + Library toggle; slim status bar at the bottom.
- [x] G9-1 New egui theme
- [x] G9-2 Panel headers: UPPERCASE dock tab titles + orange collapse arrows in the Inspector (right-aligned header icons only where panels already had toolbars)
- [x] G9-3 Left vertical tool rail
- [x] G9-4 Viewport top bar (laid out above the native webview, since a floating egui layer would be covered by it): scene tabs, Perspective/Ortho drop-down, gizmo + settings + fullscreen buttons, big Play button
- [x] G9-5 Inspector: UPPERCASE sections, flat 2px widgets, unit suffixes (u, °, ×)
- [x] G9-6 Assets: coloured type icons + filled amber folder tiles, Library button
- [~] G9-7 Status bar shows selection + entity count; coloured icons in hierarchy/assets; full icon pass todo

## G10 Unity-style coding (owner request, do later)
Keep the current NordScript API; add helpers/libraries so scripts feel like Unity C# (behaviour only, no Unity code).
- [x] G10-1 Singleton helper (`Singleton.get(Class)` / `static instance`) + persistent-across-scenes option
- [x] G10-2 GameManager / AudioManager / SceneManager-style ready-made services (`Game.loadScene`, `Game.pause`, score/state store, events)
- [x] G10-3 Unity-like API names: `GetComponent`, `Find`, `FindWithTag`, `Instantiate`, `Destroy`, `Time.deltaTime`, `Input.GetKey`, `Mathf`, `Vector2/3`, coroutines (`StartCoroutine`/`yield WaitForSeconds`)
- [x] G10-4 Lifecycle aliases: Awake/Start/Update/FixedUpdate/LateUpdate/OnEnable/OnDisable/OnDestroy, OnCollisionEnter/OnTriggerEnter
- [x] G10-5 `[SerializeField]`-style attributes, ScriptableObject-like data assets, Object pool, simple event bus/UnityEvent
- [x] G10-6 Script templates ("New script" menu: MonoBehaviour-like, Singleton, GameManager) + manual chapter + examples

G10 done 2026-10-22: `runtime/core/unity.js` (+ core.test.mjs tests), templates in Assets menu, manual chapter 4 section. Not run in a browser/editor yet.

## Status 2026-10-22 (end of session)
Done: G0-1..3, G1-1/2/4, G2-1/5, G3-1/3/4, G4-1/2, G5-1/3/4, G7-1..7, G8-1/2, G9-1..6, G10 all. Partial: G0-4, G1-3/5/6/7, G2-2/3/4/6/7, G3-2/5, G4-3/4/5/6, G5-2, G6-1..5, G8-4, G9-7. Not started: G6-6, G8-3/5.
Screenshots for the docs are rendered offscreen: `DUMP_SHOTS=$PWD/docs/screenshots cargo test -p nord-editor --test shots -- --ignored` (webview panes are not part of the images).
