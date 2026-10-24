---
title: 18 · Migration guide: C# habits to JavaScript
section: Examples
order: 18
summary: The Unity to Nord API table and the traps C# developers meet in JavaScript (this, null, vectors, async, equality).
---

## API translation table
| Unity | Nord (Unity-style layer) | Nord (native) |
|---|---|---|
| `transform.position` | `this.position` (a `Vector3`) | `entity.pos` (`[x, y, z]` array) |
| `transform.localPosition` | `this.localPosition` | `entity.pos` (relative to parent); `entity.worldPos` absolute |
| `transform.rotation` / `eulerAngles` | `this.Rotate(x,y,z)` | `entity.rot = [x, y, z]` **degrees** |
| `transform.localScale` | – | `entity.scale = [x, y, z]` |
| `transform.Translate(v)` | `this.Translate(x, y, z)` | assign `pos` |
| `transform.parent`, `GetChild` | – | `entity.parent`, `entity.children`, `entity.find('Name')` |
| `gameObject.name / tag / layer` | `this.name`, `this.tag` | `entity.name`, `entity.tags` (array), `entity.layer` |
| `SetActive(false)` | `this.SetActive(false)` | `entity.enabled = false` |
| `GetComponent<T>()` | `this.GetComponent(T)` | `entity.getScript(Class)` / `entity.getComponent('sprite')` |
| `AddComponent<T>()` | – | `entity.addComponent('sprite', data)` / `entity.addScript(Class, attrs)` |
| `Instantiate(p, pos, rot)` | `this.Instantiate(path, {pos})` | `await scene.spawn(path, {pos, rot})` |
| `Destroy(o, t)` | `this.Destroy(o, t)` | `entity.destroy()` |
| `Find / FindWithTag / FindObjectOfType` | `this.Find…` | `scene.find / findByTag / all()` |
| `Time.deltaTime / time / timeScale` | `Time.deltaTime…` | `dt` argument, `game.time.elapsed`, `game.timeScale` |
| `Input.GetKey / GetKeyDown / GetAxis` | `UnityInput.GetKey…` | `input.down / pressed / axis / vec` (actions) |
| `Rigidbody2D.velocity` | – | `physics.setVelocity(entity, vx, vy)` |
| `Rigidbody.AddForce` | – | set velocity each step, or use library `physics-*` scripts |
| `Physics.Raycast` | – | `physics.raycast(from, to, {ignore})` (3D) |
| `Physics2D.OverlapBox` | – | `physics.overlapBox(x, y, w, h)` |
| `OnCollisionEnter / OnTriggerEnter` | same names | `onCollisionEnter / onTriggerEnter(other)` |
| `StartCoroutine`, `WaitForSeconds` | same | `scheduler.after / every`, tweens |
| `Invoke / InvokeRepeating` | same | `this.after(sec, fn)` / `this.every(sec, fn)` |
| `Mathf.*` | `Mathf.*` | `clamp, lerp, remap, deg2rad…` |
| `Vector2/3`, `Quaternion` | `Vector2/3` | plain arrays + `vec.add / sub / scale / len / norm / lerp` (no Quaternion: rotations are Euler degrees) |
| `Random.Range` | `Mathf.Random` or rng | `this.rng.range(a, b)`, `.int`, `.chance`, `.pick(arr)` |
| `PlayerPrefs` | `PlayerPrefs` | `this.save.get / set` |
| `SceneManager.LoadScene` | `SceneManager.LoadScene` | `game.loadScene(path)`, `game.restart()` |
| `DontDestroyOnLoad` | `static persistent = true` | behavior `Persist` |
| `ScriptableObject` | `ScriptableObject.Load(path)` | `game.loadJSON(path)` |
| `Debug.Log` | `Debug.Log` | `this.log`, `console.log('[Tag] …')` |
| `[SerializeField]`, `[Range]`, `[Header]` | `SerializeField({...})` | `static attributes = { x: { type, default, min, max, label, description } }` |
| `UnityEvent` | `UnityEvent` | `entity.on / emit`, `game.events` |
| `Animator.SetBool` | – | `entity.getComponent('animator').setBool(name, v)` ([Animator](animator.html)) |
| `AudioSource.Play` | – | `this.audio.play(path, {volume})` |
| `Canvas / Text / Button` | – | `this.ui.label / button / bar`, `.ui.json` scenes |
| `Application.Quit` | `Application.Quit()` | `game.pause()` (a web game cannot close its tab) |

## The traps (C# to JavaScript)
**1. `this` and callbacks.** Inside a normal `function () {}` callback `this` is not your script. Use arrow functions:
```js
this.after(1, () => this.explode());        // arrow: this = the script
this.after(1, function () { this.explode(); });   // WRONG: this is not the script
```
**2. Positions are arrays and are copied.** `const p = entity.pos; p[0] += 1;` changes the entity's data but the engine is not told: call `entity.touch()`, or assign a new array (`entity.pos = [x, y, z]`). `entity.pos` returns the real array, so copy it if you want a snapshot: `const old = [...entity.pos]`.

**3. Equality.** Use `===` (not `==`). Arrays and objects compare by identity: `[1,2] === [1,2]` is `false`. Compare entities with `===` (same object) and vectors with a distance check.

**4. `null` vs `undefined`.** A missing object is `null` from `find()`, a missing property is `undefined`. Guard with `if (!target)` or optional chaining `target?.getScript(Health)?.takeDamage(1)`.

**5. No static types.** A typo in a property name is not a compile error: it is `undefined` at runtime. The editor's Code tab underlines unknown names where it can, and the Console shows the line when it fails. Keep scripts small and test often (hot reload helps).

**6. Numbers.** All numbers are floating point; `5 / 2` is `2.5` (use `Math.floor` or `Math.trunc` for integer division). `%` can be negative: `((a % n) + n) % n`.

**7. Async is not a coroutine.** `await` waits for a Promise (loading); it does not stop when the object is destroyed. Spawning returns a Promise (`await this.scene.spawn(...)`). For gameplay waiting use coroutines or `this.after`.

**8. Lifecycle names differ by style.** MonoBehaviour: `Awake Start Update FixedUpdate LateUpdate`. NativeScript: `init start update fixedUpdate lateUpdate`. If a method never runs, check the capitals and do not mix.

**9. Destroy is deferred.** `Destroy(x)` removes it at the end of the frame; check `x.destroyed` instead of `x == null`.

**10. Imports are the "using" and the references.** One script per file, `export default class Name extends …`; reference another script by `import Name from './name.js';`. There are no namespaces and no assembly definitions; circular imports between two scripts work if you only use the other class inside methods.

**11. Collections.** `List<T>` = `Array` (`push`, `filter`, `map`, `find`, `includes`, `splice`); `Dictionary<K,V>` = `Map` or a plain object; `HashSet<T>` = `Set`. `foreach (var x in list)` = `for (const x of list)`.

**12. Strings.** `$"Score {n}"` = `` `Score ${n}` `` (backticks). `string.Format` does not exist; use template strings and `n.toFixed(1)`.

**13. Time units.** Everything is in seconds; rotations in degrees; 2D distances in pixels; 3D in metres. No `Quaternion`: to rotate towards a direction compute the angle with `Math.atan2` (see [Camera and 3D](ex-camera-3d.html)).

**14. Physics is stepped at 60 Hz.** Put physics work in `FixedUpdate`; read input in `Update`. `Input.GetKeyDown` style checks must be in `Update`.

**15. No Editor-only attributes.** There is no `[ExecuteInEditMode]` and no custom inspectors: Inspector fields come from `static attributes`; editor tools are separate pages (UI Designer, Graph, Animator…).

## Where things live (project layout)
```
my-game/
├─ nord.project.json      # = ProjectSettings: display, physics, input actions, start scene
├─ scenes/*.scene.json    # = Scenes
├─ prefabs/*.prefab.json  # = Prefabs (and variants)
├─ scripts/*.js           # = Assets/Scripts
├─ assets/…               # = images, audio, models, fonts, materials (*.mat.json)
├─ ui/*.ui.json           # = UI Toolkit / Canvas prefabs
├─ anim/*.animator.json   # = Animator controllers
└─ data/*.json            # = ScriptableObject-style data
```
Nothing is compiled or imported into a hidden database: files are plain JSON and JavaScript, so Git diffs and merges work, and the whole project can be edited by hand or by an AI agent (see [AI and MCP](ai-mcp.html)).

## Mental-model cheat sheet
* **GameObject** = *Entity*; **Component** = data (sprite, collider…), **Script** = code on the entity.
* **Prefab** = a saved entity; **instances** keep a link and store only overrides (Inspector shows the blue override markers).
* **Update order**: all `fixedUpdate` steps, then timers/tweens, then `update`, built-in components, behaviors, `lateUpdate`, then deferred destroys.
* The **Scene view** and the **Game view** are what you know; **Play** runs the game in the Game panel with live Hierarchy / Inspector.
