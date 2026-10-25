---
title: Maths, timing and coroutines cheatsheet
section: Guides
group: Unity scripting and gameplay
order: 13
summary: Vectors, angles, clamping, interpolation, random ranges, frame time, coroutines and pause limitations.
---
Use these helpers from `nord` inside Unity-style scripts. Read [Unity maths](ex-unity-api-math.html) when you need matrix, bounds, ray or plane operations beyond this daily lookup.

::: dummies
A position says where something is. A direction says which way it points. A velocity says how quickly its position changes. Multiplying a velocity by elapsed seconds gives a displacement for this frame. The units are your best error detector.
:::

## Numbers and vectors

| Need | Helper / operation | Meaning |
|---|---|---|
| Keep a value in a range | `Mathf.Clamp(value, min, max)` | Stops below min and above max |
| Keep a fraction valid | `Mathf.Clamp01(value)` | Clamps to 0..1; useful for health bars |
| Blend endpoints | `Mathf.Lerp(a, b, t)` | A fraction along a to b; t is not a duration |
| Move at a bounded rate | `Mathf.MoveTowards(current, target, speed * Time.deltaTime)` | Maximum change this frame |
| Compare approximate floats | `Mathf.Approximately(a, b)` | Avoids relying on exact floating-point equality |
| Wrap repeated motion | `Mathf.Repeat(t, length)` | Repeating interval |
| Back-and-forth motion | `Mathf.PingPong(t, length)` | Triangle-wave movement |
| Construct a vector | `new Vector2(x, y)` / `new Vector3(x, y, z)` | Component values |
| Vector arithmetic | `a.Add(b)`, `a.Sub(b)`, `a.Mul(scale)` | Explicit methods; JavaScript does not overload + or * |
| Vector length | `direction.magnitude` | Distance or length |
| Unit direction | `direction.normalized` | Direction with length 1, subject to zero-vector handling |
| Rotate from degrees | `Quaternion.Euler(x, y, z)` | Quaternion from Euler angles |

Do not use `a + b` to add vectors. Keep degree-based rotation helpers distinct from JavaScript's radian-based trigonometry. Check local versus world coordinates when the object has a rotated or scaled parent.

## Transform reminders

| Property / operation | Coordinate space | Caution |
|---|---|---|
| `this.transform.position` | World | Includes parent transforms |
| `this.transform.localPosition` | Parent-relative | Parent motion affects the result |
| `this.transform.localScale` | Parent-relative | World scale also includes ancestors |
| `this.transform.SetParent(parent, true)` | Preserves world placement | Parent can be a supported wrapper/entity or null |
| `this.transform.TransformPoint(point)` | Local point to world point | Includes translation and scale |
| `this.transform.TransformDirection(direction)` | Local direction to world direction | Direction conversion is not point conversion |

> **Trap:** `Mathf.SmoothDamp(...)` returns an object with `value` and `velocity` in Nord. Save the returned velocity for the next call; there is no C# ref parameter.

## Time and waiting

| Need | Use | Unit / limitation |
|---|---|---|
| Movement per render frame | `Time.deltaTime` | Scaled seconds |
| Fixed-step reference interval | `Time.fixedDeltaTime` | Current implementation reports 1/60 second |
| Elapsed game time | `Time.time` | Game seconds |
| A clock independent of scene time scale | `Time.realtimeSinceStartup` | Monotonic clock seconds; not a saved game timestamp |
| Slow motion | `Time.timeScale = 0.5` | Restore the previous scale afterward |
| Freeze scene ticking | `this.game.pause()` | A frozen scene cannot process its own Update to resume |
| Resume from an active UI callback | `this.game.resume()` | A button can remain responsive while scene updates are paused |
| Start a generator | `this.StartCoroutine(this.Sequence())` | Sequence must be a generator method |
| Wait in the generator | `yield new WaitForSeconds(1)` | Scaled game seconds |
| Wait for a condition | `yield new WaitUntil(() => ready)` | The predicate is checked while the coroutine is stepped |
| Cancel owned generators | `this.StopAllCoroutines()` | Use when the behavior's work should end |

`WaitForSecondsRealtime` currently inherits the same scheduler behavior as WaitForSeconds; do not treat its name as a guarantee that it continues during a paused scene. Likewise, `unscaledDeltaTime` cannot create updates while the scene loop is stopped. The [API differences](api-unity.html#coroutines) document these compatibility limits.

## Random values
`Random.Range(0, 10)` uses integer behavior for integer endpoints: 0 through 9. Float endpoints use floating-point behavior. Use the documented random helper consistently; a reproducible simulation needs deliberate seed management, not scattered calls to Math.random.

## Check yourself
Test a moving object at different frame rates, with a rotated parent, and during pause. Explain whether each calculation uses pixels, world units, degrees, a fraction or seconds.

Next: [UI, audio and saves](cheat-sheet-presentation.html). Back to: [Cheatsheets](cookbook.html).
