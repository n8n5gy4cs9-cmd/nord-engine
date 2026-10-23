# godotize-nordengine-tasks.md
Plan: `docs/GODOTIZE_PLAN.md`. Goal: Nord Engine edits like Unity (Scene/Game/Hierarchy/Inspector/Project/Prefabs), built on Godot's open design (MIT, `REFE/godot-master`), keeping Event sheets, FPS Level, 2D Level, UI Designer, Graph.
**Working rule (owner): clone, don't reinvent.** For each task first open the matching Godot file (MIT) and translate its logic; use Unity only to match behaviour/shortcuts (its licence forbids copying code).
Tick with `[x]`, also register in PRD.json via `node tools/tasks.mjs add M13 "…"` / `done`. Unity code in `REFE/UnityCsReference-master` is reference-only.

## G0 Foundations
- [x] G0-1 Unity layout presets (2 by 3, Tall, Wide) in View ▸ Layout (custom save/load: dock state already persists)
- [x] G0-2 Scene and Game side by side via the Unity layouts (Play only activates Game inside its own dock leaf, so Scene stays visible)
- [x] G0-3 Menu bar: File / Edit / Assets / GameObject / Component / Window (was View) / Project / Help like Unity
- [x] G0-4 Settings ▸ Shortcuts: every editor shortcut is rebindable (click the key box, press the new keys; orange = clash, ↺ = back to default). `crates/nord-editor/src/keymap.rs` (defaults = Unity); the Scene view page forwards all keys and the keymap decides what they do
## G1 Scene view
- [x] G1-1 Navigation: Alt+LMB orbit, Alt+Cmd+LMB / MMB pan, wheel zoom, hold RMB = mouse look + WASD fly (Q/E down/up, Shift x3, speed 9 u/s accelerating, wheel = fly speed), Alt+RMB zoom (3D, as Unity's SceneViewMotion.cs); Alt+LMB / MMB / RMB pan, wheel zoom (2D). Headless test: tools/viewport-fly-test.mjs
- [x] G1-2 Tools Q hand, W move, E rotate, R scale, T rect: 2D axis/plane move, rotate ring, axis+uniform scale, Rect tool with 8 resize handles about the opposite edge (Godot canvas_item select-mode logic; tools/viewport-rect-test.mjs); 3D Babylon gizmos with plane handles + uniform scale cube
- [x] G1-3 Local/Global + Pivot/Center: with several objects selected the gizmo sits on the primary (Pivot) or at the centre of the selection (Center) and the whole group moves/rotates/scales about it (2D + 3D; tools/viewport-multi-test.mjs, viewport-multi3d-test.mjs)
- [x] G1-4 Snapping: hold Ctrl/Cmd to toggle snap while dragging (2D + 3D); step values from settings (vertex snap not done)
- [x] G1-5 Multi-select: Shift/Ctrl/Cmd toggle (2D+3D), marquee in 2D and 3D (LMB drag on empty space), selection outlines, gizmo and drag move/rotate/scale every selected object (one undo step, `transforms` message)
- [x] G1-6 Frame selected (F) / Frame all (Shift+F); 2D/3D mode follows the project type; 3D axis gizmo (top right) shows the view orientation and clicking an axis cone looks along it
- [x] G1-7 Drag an asset from Assets over the Scene view: ghost preview, drop = new entity placed there (snap-aware), or — dropped on an object — sets that object's sprite/model/audio/material or attaches the script. The viewport half is tested headless (viewport-multi-test.mjs); the egui→webview drag itself is built on egui's drag state and still NOT verified in the native window (KNOWN_ISSUES)
- [x] G1-8 Viewport bar ▸ Gizmos ▾: Grid, camera/light icons, collider outlines (2D + new 3D wireframes)
## G2 Hierarchy and Inspector
- [x] G2-1 Drag reorder + re-parent with drop lines; multi-select
- [x] G2-2 Active checkbox + blue prefab name; lock (not pickable) and hide (not drawn in the Scene view) toggles on each Hierarchy row — scene fields `locked` / `hidden` (editor only; the game ignores them)
- [x] G2-3 Inspector component ⋮ menu (Reset, Copy/Paste values, Move up/down, Docs, Remove) + per-component Enabled checkbox (`componentEnabled: false` = the runtime does not create the component)
- [x] G2-4 Add Component popup is searchable and grouped (Rendering, Physics, Audio, UI, Gameplay, Effects)
- [x] G2-5 Multi-object edit: Active / Transform for all selected (mixed shows —), Add component to all
- [x] G2-6 Asset pickers show thumbnails: the current image next to the box and a small picture on every dropdown row (images, materials and models via the thumbnail cache)
- [x] G2-7 Inspector lock (padlock) + Debug mode (raw entity JSON)
## G3 Prefabs
- [x] G3-1 Prefab mode: Assets/Inspector ▸ Open prefab edits the prefab on its own (breadcrumb ◀ Scene › Prefab, Save, auto-save on exit)
- [x] G3-2 Inspector Apply all / Revert all (writes the prefab file) + per-field ⬆ Apply to prefab next to each overridden value
- [x] G3-3 Drag Hierarchy entity into Assets (or right-click ▸ Create prefab) = prefab; Unpack; Unpack completely
- [x] G3-4 Prefab variants (`variantOf` + `overrides`, runtime + editor; Create variant in Assets/Inspector); nested prefabs: instances inside prefabs expand at runtime and unpack completely
- [x] G3-5 Children of a prefab instance are listed under it in the Hierarchy (blue, read-only structure); selecting one edits its components / scripts / effects as overrides stored on the instance (`overrides.children.<index>…`, merged by the existing runtime `applyOverrides`)
## G4 Project, materials, import
- [x] G4-1 Project browser: thumbnail size slider + type filter (existed), ★ favourites filter, Find references (context menu)
- [x] G4-2 Material assets `*.mat.json` + Inspector (colour, textures, tiling/offset, normal, emissive; no custom shader yet), Babylon runtime loads them
- [x] G4-3 Lit material preview: CPU-shaded sphere (Lambert + Blinn-Phong, metal-tinted specular, Fresnel rim, texture with tiling/offset, emissive, alpha) in the Inspector and as Project thumbnails (`nord_core::thumbs::render_material`)
- [x] G4-4 Texture import: filter, wrap, pixels-per-unit, pivot presets, max size (Phaser applies them; sprites keep their world size when downscaled) and an Open in Sprite editor button
- [x] G4-5 Dropping an asset on an Inspector slot, on a Hierarchy row or on a Scene-view object sets/attaches it (`EditorState::drop_asset_on_entity`)
- [x] G4-6 Model import: uniform scale + material remap (glTF/GLB material names → project `*.mat.json`, sidecar `materials`, applied by the Babylon backend)
## G5 Build and Game view
- [x] G5-1 Build Settings window (File menu / Shift+Cmd+B): scenes in build (`export.excludeScenes`, exporter drops them), start scene, platform list, Build / Build And Run (single-file page opened in the browser)
- [x] G5-2 Platforms: Web, Desktop app, and Android/iOS as a ready Capacitor project (`dist/mobile`: game in `www/` + `capacitor.config.json`, `package.json`, `README-MOBILE.md`). Building the APK/IPA still needs Android Studio / Xcode on the owner's machine (not run here)
- [x] G5-3 Game view: resolution drop-down, scale slider, Maximize on Play, Stats overlay
- [x] G5-4 Error Pause, Clear on Play, Play focused (Maximize on Play)
## G6 Improve existing tools
- [x] G6-1 UI Designer: anchor preset grid, preview resolutions, canvas scaler (`scaler`: constant / scale with screen / fit, runtime + designer) and on-canvas rect handles (tools/uidesigner-rect-test.mjs)
- [x] G6-2 UI Designer: Copy/Paste, layout panels, undo; sprite-state buttons (`sprites`: normal/hover/pressed/disabled), skin tint (`image.tint` in skin rules), UI prefabs (Make UI prefab / Unpack / Open prefab on `instance` nodes)
- [x] G6-3 Graph: Group, minimap, reroute/comment, auto-arrange, search; Make subgraph (selection → own graph file + Run Graph File node, values in as a/b, Return node out; tools/graph-subgraph-test.mjs)
- [x] G6-4 Graph: variables panel, F1 / Docs, live flow highlight while playing (nodes flash green; the game only reports while a Graph editor is open)
- [x] G6-5 Event sheets: Find in sheet, ACE picker search, Inspector-style Parameters form (colour picker / checkbox / number drag / text with autocomplete), debug highlight of events that ran in the last frames (sheets without includes), F1 over a condition/action opens its manual section
- [x] G6-6 FPS Level + 2D Level editors share `editor/common/sceneview.js` with the Scene view: pan (MMB / RMB / Alt+LMB / Space / Q hand tool), wheel zoom about the cursor, Ctrl/Cmd toggles snapping, Home fit, Shift+F frame selection (FPS keeps its own Alt/Ctrl placement keys and RMB-look 3D preview)
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
- [x] G8-3 Playwright suites T36/T38/T40–T43 after UI conversion
- [~] G8-4 KNOWN_ISSUES.md updated for G0–G9; headless items re-verified 2026-10-23, native-window items remain
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
- [x] G9-7 Icon pass: Lucide icons on every menu command (File/Edit/Assets/GameObject/Component/Window/Project/Help), Window entries use the tab icons, glyph buttons (lock, eye, star, camera, reset, apply) replaced by icon buttons; status bar shows selection + entity count. Dock tab titles stay text (egui_dock cannot draw an icon in a title)

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
Done: everything except the checking tasks. Open: G8-3 (Playwright suites T36/T38/T40–T43), G8-4 (full KNOWN_ISSUES walk), G8-5 (verify native egui parts on macOS).
2026-10-23: the former partial/not-started feature list (G0-4, G1-3/5/6/7, G2-2/3/4/6/7, G3-2/5, G4-3/4/5/6, G5-2, G6-1..6, G9-7) is done — see the ticked lines above.
Screenshots for the docs are rendered offscreen: `DUMP_SHOTS=$PWD/docs/screenshots cargo test -p nord-editor --test shots -- --ignored` (webview panes are not part of the images).
