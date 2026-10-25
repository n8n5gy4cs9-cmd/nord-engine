---
title: Objects, prefabs and events cheatsheet
section: Guides
group: Unity scripting and gameplay
order: 11
summary: Find objects, get components, expose fields, spawn prefabs, change scenes, and clean up subscriptions.
---
Use these operations inside a class extending `MonoBehaviour`. For complete files, follow [Spawning and Destroy](ex-spawn-destroy.html) or [Events](ex-events.html).

::: dummies
An entity is the object. A component is one capability. A script instance is one running copy of your behavior. A prefab is the recipe used to create more objects. Finding a recipe is not the same as having a live object.
:::

## Set up the object first
Select an entity in @ui[Hierarchy]. Use @ui[Inspector ▸ + Add component] for its renderer, collider or body, then @ui[+ Add script] for behavior. Save the scene. You should see both the component fields and script fields before testing.

**In the file** your current `.scene.json`, each entity has its component data and script entries. Prefab data is stored separately in `.prefab.json`; use [Project format](project-format.html) when comparing or editing saved data.

## Find and connect

| Need | Call inside MonoBehaviour | Return / caution |
|---|---|---|
| Current object | `this.gameObject` | The attached entity |
| Find by name or id | `this.Find('Player')` | Entity or no result; guard before use |
| First object with tag | `this.FindWithTag('enemy')` | Entity or `null` |
| All with tag | `this.FindGameObjectsWithTag('enemy')` | Array |
| Component on this object | `this.GetComponent('Rigidbody2D')` | Wrapper or `null` |
| Another script on this object | `this.GetComponent(Health)` | Import the script class `Health` first |
| Search children / parents | `this.GetComponentInChildren(Type)` / `this.GetComponentInParent(Type)` | Check missing results |
| Inspect a child | `this.GetChild(0)` | Child entity or no result |
| Test a tag | `this.CompareTag('player')` | Boolean |

Prefer an Inspector reference when designers must choose a specific object. Import `SerializeField` and `EntityRef`, declare the reference with those helpers, then assign it in the Inspector. See [Unity API attributes](api-unity.html#serializefield-and-inspector-attributes) for field types and defaults.

## Create, activate and destroy

| Task | Operation | Important behavior |
|---|---|---|
| Spawn a prefab | `await this.Instantiate('prefabs/coin.prefab.json', { pos: [100, 80, 0] })` | Returns a Promise of an entity; method must be `async` |
| Clone an entity | `await this.Instantiate(source)` | Also asynchronous at the call site |
| Disable this object | `this.SetActive(false)` | Its normal gameplay updates stop; do not rely on its Update to re-enable itself |
| Destroy this object | `this.Destroy()` | Ends this object's lifetime |
| Destroy another later | `this.Destroy(target, 2)` | Delay is in game seconds |
| Change scene | `await SceneManager.LoadScene('scenes/level2.scene.json')` | Import SceneManager; old scene objects are replaced |
| Restart scene | `SceneManager.ReloadScene()` | Recreates starting scene state |

> **Trap:** after an `await`, the scene may have changed. Check that the caller and target are still valid before applying a delayed result. Cache references during setup, but do not reuse old scene objects after a scene load.

## Events and ownership

| Operation | Call | Ownership rule |
|---|---|---|
| Subscribe globally | `this.game.events.on('score', handler)` | Returns an unsubscribe function; keep it |
| Emit globally | `this.game.events.emit('score', { score: 10 })` | Sender and receiver agree on the payload shape |
| Subscribe on one entity | `target.on('damage', handler)` | Keep the returned unsubscribe function |
| Remove a subscription | Call the saved unsubscribe function | Release it in OnDestroy |
| Create a UI element | `this.ui.label('Hello')` | Keep its handle; remove it when the owner is destroyed |

Do not subscribe in Update: one subscription per frame quickly becomes hundreds. Subscribe once during setup and release once during cleanup. Use OnEnable/OnDisable pairs instead when the listener should exist only while enabled.

## Check yourself
Test a missing target, two spawned instances, and a scene restart. There should be no stale-reference error or doubled event response after restarting.

Next: [Input and physics](cheat-sheet-input-physics.html). Back to: [Cheatsheets](cookbook.html).
