---
title: 30 · C# to JavaScript: the language side by side
section: Examples
order: 30
summary: Classes, inheritance, interfaces, properties, enums, generics, LINQ, events, async and null handling: the C# you know and the JavaScript that replaces it.
---

You do not need to learn "all of JavaScript". These are the C# habits and what to write instead, so a Unity script converts line by line.

## Classes, fields, constructors
```cs
public class Enemy : Character {
    public int hp = 10;
    private float speed;
    public Enemy(float s) { speed = s; }
    public override void Hit(int n) { base.Hit(n); hp -= n; }
}
```

**Example** (C# on the left in the text above, JavaScript here; not a file, just the shape of the language):
```js
class Enemy extends Character {
  hp = 10;                                   // a field (public by default)
  #speed;                                    // # makes it private (really private)
  constructor(s) { super(); this.#speed = s; }
  Hit(n) { super.Hit(n); this.hp -= n; }     // no "override" keyword: same name = override
}
```
In Nord, **scripts** are classes that extend `NordScript` or `MonoBehaviour`; you do not write constructors for them (use `Awake` / `init`). Plain helper classes (no engine base) are fine and need `new`.

## Visibility and static
`public`/`private` keywords do not exist. Convention: a leading `_` ("please do not touch") or `#private` fields. `static` works the same: `static count = 0; static Create() {}` called as `Enemy.Create()`. A class-level constant: `static MAX = 10`.

## Interfaces and abstract classes
There are no interfaces. Use **duck typing**: if it has the method, call it.
```cs
interface IDamageable { void TakeDamage(int n); }
if (other.TryGetComponent<IDamageable>(out var d)) d.TakeDamage(5);
```

**Example** (not a file, JavaScript patterns that replace C# interfaces):
```js
const target = other.getScript(Health);          // a concrete class, or:
other.callScripts('takeDamage', 5);              // calls it on every script that has that method (SendMessage style)
other.emit('damage', { amount: 5 });             // or an event: anything that listens reacts
```
Abstract base: a base class whose methods `throw new Error('override me')`.

## Properties
```cs
public int Hp { get; private set; }
public bool Alive => Hp > 0;
```

**Example** (not a file, inside a class body):
```js
get alive() { return this.hp > 0; }              // getter (no parentheses when you read it: this.alive)
set hp(v) { this._hp = Math.max(0, v); }         // setter
```

## Enums
```cs
enum State { Idle, Run, Jump }   var s = State.Run;
```

**Example** (not a file, at the top of any script):
```js
const State = Object.freeze({ Idle: 'idle', Run: 'run', Jump: 'jump' });   // string "enum": easy to log
let s = State.Run;  if (s === State.Run) { /* … */ }
```
Inspector dropdown: `{ type: 'enum', options: ['idle', 'run', 'jump'], default: 'idle' }`.

## Variables, types, null
```cs
int a = 5; float f = 1.5f; string s = "x"; bool b = true; var list = new List<int>();
```

**Example** (not a file, inside any method):
```js
let a = 5, f = 1.5, s = 'x', b = true;     // let = changeable, const = fixed reference (the object's insides can still change)
const list = [];
```
There is one number type. Integer division: `Math.trunc(7 / 2)` → 3. `null` and `undefined` both mean "nothing": `x ?? 5` (default when null/undefined), `x?.y` (safe access), `x ||= 5` (assign default).

## Collections and LINQ
| C# | JavaScript |
|---|---|
| `List<T>`, `T[]` | `Array`: `push`, `pop`, `shift`, `splice`, `includes`, `indexOf`, `length` |
| `Dictionary<K,V>` | `Map` (`set/get/has/delete`) or a plain object `{ key: value }` |
| `HashSet<T>` | `Set` (`add/has/delete`) |
| `foreach (var x in list)` | `for (const x of list)` |
| `for (int i = 0; i < n; i++)` | same |
| `list.Where(x => x > 1)` | `list.filter((x) => x > 1)` |
| `list.Select(x => x * 2)` | `list.map((x) => x * 2)` |
| `list.FirstOrDefault(x => ...)` | `list.find((x) => ...)` (undefined when none) |
| `list.Any(...)` / `All(...)` | `list.some(...)` / `list.every(...)` |
| `list.OrderBy(x => x.hp)` | `[...list].sort((a, b) => a.hp - b.hp)` (sort changes the array: copy first) |
| `list.Sum(x => x.hp)` | `list.reduce((t, x) => t + x.hp, 0)` |
| `list.Count` / `Count(pred)` | `list.length` / `list.filter(pred).length` |
| `list.Contains(x)` | `list.includes(x)` |
| `string.Join(",", list)` | `list.join(',')` |
| `new int[5]` | `new Array(5).fill(0)` or `Array.from({ length: 5 }, () => 0)` |
| `(a, b)` tuple | `[a, b]` array, destructured: `const [a, b] = f();` |

## Strings
`$"HP {hp}/{max}"` → `` `HP ${hp}/${max}` `` (backticks). `s.Length` → `s.length`; `s.Substring(1, 3)` → `s.slice(1, 4)`; `s.Split(',')` → `s.split(',')`; `s.ToUpper()` → `s.toUpperCase()`; `float.ToString("F1")` → `n.toFixed(1)`; `int.Parse("5")` → `Number('5')` or `parseInt('5', 10)`.

## Delegates, events, lambdas
```cs
public event Action<int> OnHit;   OnHit += Handler;   OnHit?.Invoke(5);   Action a = () => Debug.Log("x");
```

**Example** (not a file, inside a method of a script):
```js
this.entity.emit('hit', 5);   const off = this.entity.on('hit', (n) => this.log(n));   off();   const a = () => this.log('x');
```
Arrow functions (`(x) => x + 1`) are lambdas. Always use them for callbacks inside scripts so `this` stays your script ([Migration](ex-migration.html)).

## Generics and types
There are none: one function works with any value. `GetComponent<Health>()` becomes `getScript(Health)` (pass the class). If you want documentation of types, JSDoc comments (`/** @param {number} n */`) help the editor.

## Exceptions
`try { ... } catch (e) { this.error(e.message); } finally { ... }` works like C#. `throw new Error('message')`. A script that throws in `update` is caught by the engine and shown in the Console; the game continues.

## async / await instead of Task
```cs
async Task Load() { var t = await Download(); }
```

**Example** (not a file, a method of a script class):
```js
async load() { const data = await this.game.loadJSON('data/items.json'); }
```
`await` pauses *this function* until the Promise is done. It is for loading, not for game timing (use coroutines). Run several in parallel: `await Promise.all([a(), b()])`.

## Equality, copying, comparing
`===` strict equality (never `==`). Objects and arrays are compared by identity; copy with `[...arr]`, `{ ...obj }` (shallow) or `structuredClone(x)` (deep). `Vector3` equality: compare numbers or use `Vector3.Distance(a, b) < 0.001`.

## Math
`Mathf.Sin` → `Math.sin` (radians; convert with `deg2rad` / `rad2deg` from `'nord'`), `Mathf.Abs` → `Math.abs`, `Mathf.Max/Min` → `Math.max/min`, `Mathf.Clamp` → `clamp` (import from `'nord'`), `Mathf.Lerp` → `lerp`, `Mathf.Floor` → `Math.floor`, `Mathf.PI` → `Math.PI`, `Random.Range(a, b)` → `this.rng.range(a, b)` (float) / `this.rng.int(a, b)` (integer, both ends included).

## Namespaces and files
One class per file, `export default class X`, and `import X from './x.js'` where you use it. There is no `using`, no namespace and no assembly. Helpers that are not classes: `export function f() {}` and `import { f } from './util.js'`.

## Unity attributes
`[SerializeField]` / `public` fields → `static attributes = { name: { type, default } }`. `[Range(0,10)]` → `min` / `max`. `[Header("x")]` → `label`. `[Tooltip("x")]` → `description`. `[RequireComponent(typeof(Rigidbody))]` → just add the component to the object. `[ContextMenu]`, custom editors, `[ExecuteInEditMode]`: not available.
