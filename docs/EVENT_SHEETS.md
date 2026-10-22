# Event sheets (M10) — Construct-style visual logic

Runtime: `runtime/core/eventsheet/` (engine-agnostic, runs on every JS tier). Tests: `node --test runtime/core/eventsheet.test.mjs`.
Attach a sheet to a scene: `"settings": { "eventSheet": "events/main.events.json" }` (one sheet per scene, like a Construct layout).

## File (`*.events.json`)
```json
{ "format": 1, "name": "main", "events": [
  { "type": "variable", "name": "score", "valueType": "number", "value": 0 },
  { "type": "include", "path": "events/common.events.json" },
  { "type": "group", "title": "Player", "active": true, "children": [ … ] },
  { "type": "function-block", "name": "AddScore", "params": [{ "name": "n", "initialValue": 1 }], "returnType": "number", "actions": [ … ] },
  { "type": "event", "block": "and",
    "conditions": [ { "object": "Keyboard", "id": "on-key-pressed", "params": { "key": "Space" } } ],
    "actions":    [ { "object": "Player", "id": "add-to-instance-var", "params": { "variable": "jumps", "value": "1" } } ],
    "children":   [ …sub-events, local variables… ] } ] }
```
Event types: `event`, `group`, `variable` (global at top level / local inside an event's `children`; `isStatic`, `isConstant`), `function-block`, `include`, comments (`{type:"comment"}` ignored).
`block: "or"` = Or-block. A condition may be `inverted`. An event may be `disabled`. Params are **expression strings** except "raw" params (names, comparisons, keys).

## Semantics (same as Construct)
- Events run top to bottom each tick. Conditions are ANDed (Or-block: ORed). Actions run, then sub-events.
- **Picking / SOL**: an object condition (e.g. `Enemy` *Compare X*) filters the instances; later conditions, actions and sub-events only see the survivors. An object type is an entity **name or tag** (so tags act as Construct *families*).
- **Triggers** (first condition only): On start/end of layout, On key pressed/released, On action pressed (Nord input actions), On click, On created, On destroyed, On collision with. They run when fired, not every tick.
- `Else` runs when the previous event of the chain did not; `Trigger once while true`; `Every X seconds`; loops `For each`, `Repeat`, `For`, `While` run the rest of the event per iteration (`loopindex`, `loopindex("name")`).
- `Wait` and `Create object` suspend the remaining actions of that event, keeping picks and locals; the created instance is picked.
- Functions: `Functions → Call` action or `Functions.Name(args)` expression; `Function.Param(i)`, `Function.ReturnValue`, *Set return value*.
- Errors in one event are reported once and do not stop the others.

## Expressions
`+ - * / % ^`, `= != < <= > >=`, `&` (string concat), `&& || !`, `a ? b : c`, numbers/"strings", variables, `Obj.Prop`, `Obj(i).Prop`, `Obj.Count`, builtins
(abs floor ceil round sqrt sin/cos/tan (degrees) atan2 min max clamp lerp distance angle random(a,b) choose int len left right mid find replace uppercase lowercase zeropad tonumber…), `dt time tickcount loopindex pi`, `Mouse.X`, `LocalStorage.ItemValue(k)`.
No `eval`; expressions are parsed + cached.

## Extending
`registerPlugin('Name', { conditions, actions, expressions })` and `registerObjectAces({…})` (see header of `aces.js`) — the future addon SDK (M10-27) builds on this.

## Status / gaps
The interpreter is the reference implementation; `nord build` additionally compiles sheets ahead of time (see *Compiler*). Editor: the **Event sheets** tab (see below). *Is overlapping* uses the `collider` boxes (`behaviors/util.js bbox`). Behaviors: `docs/BEHAVIORS.md`. Families/containers: `scene.settings.families` / `containers`. Manual: Event sheets chapter + generated reference.

## Editor panel (M10-04/05) — `crates/nord-editor/src/panels/events.rs`
Tab **Event sheets** (Window menu). Pick/create a `events/*.events.json`, edit, **Save**; **Attach to scene** sets `settings.eventSheet` (then save the scene).
- Events, groups, variables, comments, includes, function blocks; each event shows conditions (left) and actions (right). Sub-events, Or-block, disabled, invert (`!`), duplicate, delete, ▲▼ reorder, **drag handle ⠿** (drop on a row = move before it; groups and nesting work, no dropping a node into itself).
- **＋ Add condition / action** opens a searchable picker (`system compare`, `platform jump`). The list comes from `crates/nord-editor/assets/aces.json`, exported from the live runtime registries: run `node tools/export-aces.mjs` after changing/adding ACEs (`--check` verifies it is current).
- Parameters are expression boxes with **autocomplete** (sheet variables, scene entity names/tags/families, builtin functions, plugin expressions like `Mouse.X`, `Hero.X`); raw params (names, comparisons, keys) are plain text. The object of a non-System ACE is a button with a menu of scene objects (or type any tag/family).
- Undo/redo: snapshots of the whole sheet (edits within 600 ms merge). Not yet shared with the scene undo stack.
- Not done: typed pickers for layer/animation/audio params, keyboard navigation, comment colours, event-sheet-aware Cmd+Z, visual debugger.

## Data objects (M10-26) — `runtime/core/eventsheet/objects.js`
Named non-world objects, like Construct's Array / Dictionary / JSON / AJAX. Declare them as an event-list entry or in the scene settings, then use them like any object:
```json
{ "type": "object", "name": "Inventory", "plugin": "Array", "width": 0, "global": true }
"settings": { "dataObjects": { "Config": "Dictionary", "Net": { "plugin": "AJAX" } } }
```
- **Array** (1–3D): set-size, set-at-xyz, push-back/front, pop, insert, delete, sort, reverse, shuffle, clear, load-json; `At(x,y,z)`, `Width`, `Sum`, `IndexOf(v)`, `Front`, `Back`, `AsJSON`.
- **Dictionary**: set-key, add-to-key, delete-key, clear, load-json; `Get(k)`, `GetDefault(k,v)`, `Count`, `KeyAt(i)`, `ValueAt(i)`, `AsJSON`. Iterate with Repeat + `KeyAt(loopindex)`.
- **JSON**: parse, set-path, `Get("a.b.0.c")`, `Count(path)`, `KeyAt(path,i)`, `AsString`, `Error`.
- **AJAX**: request / post-data with a tag; triggers *On completed (tag)*, *On error (tag)*, *On any completed*; `LastData`, `LastError`, `StatusCode`.
- `global: true` keeps the object when the scene changes (stored on the game). Addons add types with `registerDataType` (same ACE shape; functions get the instance first).
- Also new plugins: **Touch** (On tap / On touch end / Is touching, `Touch.X/Y`) and **Gamepad** (`Is connected`, `Button is down`, `Gamepad.Axis(pad, axis)`). Text objects are the `text` component (`Set text`). Not done: Tiled Background, 9-Patch, Spritefont, Drawing Canvas, Video.

## Starter templates (M10-29)
Five event-sheet-only templates (`templates/es-*`, also playable under `examples/`): **es-platformer** (the T24 game), **es-topdown-shooter** (WASD + mouse aim, bullets, chasing enemies), **es-endless-runner**, **es-lights-out** (puzzle: instance variables, *Pick by evaluate*, loops) and **es-menu-starter** (menu / options / game scenes, language + volume, string tables). Sources: `tools/examples/es-*/game.mjs` (run `node tools/gen_examples.mjs es-lights-out …`; es-platformer reads `examples/event-sheets`). Headless playtests: `node tools/es-templates-test.mjs [id]` (screenshots in `target/es-templates/`).
New runtime pieces they needed: **Events** plugin (*On game event*, *Emit event* — the global bus, `uiButton "event"`), `uiButton`/`uiLabel` follow `textKey` and *Set text*, centre anchor `"anchor": "c"` for UI widgets.

## Compiler (M10-03) — `runtime/core/eventsheet/compile.js`
`nord build` (default; `--no-compile-events` turns it off, Node needed) runs `node tools/compile-sheets.mjs <build> --annotate`: every `*.events.json` (includes resolved like the loader does) gets a sibling `*.events.compiled.js` — one JavaScript function per distinct expression (`"score * 2"` → `(env) => (num(env.name("score")) * 2)`), plus a standard **source map** (generated line → the event's line in the sheet JSON, with the sheet embedded) — and the build's sheet JSON gets `"compiled": "<path>"`. At load the runner imports the module and uses its table; **anything not in it, a missing/broken module, and hot reload still go through the interpreter** (with a console warning for a bad module), so behaviour cannot diverge by accident: `eventsheet.test.mjs` evaluates 23 expressions both ways and compares with `Object.is`, `tools/compiled-export-test.mjs` exports a game and checks it runs from the compiled sheet in Chromium. Your project files are never modified (only the staged output). Single-file exports are not compiled.
What is compiled is the *expressions* (parsing and AST walking disappear at runtime); events, picking, triggers and actions still run in the sheet runner. A full event-to-JS code generator would duplicate those semantics for a small further gain and was deliberately not built. Debugger event paths (`2.0.1`) and the source map line numbers refer to the same events. `node tools/compile-sheets.mjs <dir> --check` shows what would compile.
