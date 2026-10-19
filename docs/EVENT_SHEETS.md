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
Interpreter only (no JS codegen / source maps yet → M10-03 stays open). Editor: the **Event sheets** tab (see below). *Is overlapping* uses the `collider` boxes (`behaviors/util.js bbox`). Behaviors: `docs/BEHAVIORS.md`. Families/containers: `scene.settings.families` / `containers`. Manual: Event sheets chapter + generated reference.

## Editor panel (M10-04/05) — `crates/nord-editor/src/panels/events.rs`
Tab **Event sheets** (View menu). Pick/create a `events/*.events.json`, edit, **Save**; **Attach to scene** sets `settings.eventSheet` (then save the scene).
- Events, groups, variables, comments, includes, function blocks; each event shows conditions (left) and actions (right). Sub-events, Or-block, disabled, invert (`!`), duplicate, delete, ▲▼ reorder, **drag handle ⠿** (drop on a row = move before it; groups and nesting work, no dropping a node into itself).
- **＋ Add condition / action** opens a searchable picker (`system compare`, `platform jump`). The list comes from `crates/nord-editor/assets/aces.json`, exported from the live runtime registries: run `node tools/export-aces.mjs` after changing/adding ACEs (`--check` verifies it is current).
- Parameters are expression boxes with **autocomplete** (sheet variables, scene entity names/tags/families, builtin functions, plugin expressions like `Mouse.X`, `Hero.X`); raw params (names, comparisons, keys) are plain text. The object of a non-System ACE is a button with a menu of scene objects (or type any tag/family).
- Undo/redo: snapshots of the whole sheet (edits within 600 ms merge). Not yet shared with the scene undo stack.
- Not done: typed pickers for layer/animation/audio params, keyboard navigation, comment colours, event-sheet-aware Cmd+Z, visual debugger.
