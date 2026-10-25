---
title: 59 · Unity API: math types
section: Examples
order: 59
summary: Vector4, Matrix4x4, Bounds, Rect, RectInt, Ray, Ray2D, Plane, Color32, Vector2Int and Vector3Int, Random.ColorHSV, AnimationCurve and Gradient, with the Unity names and results.
---

**Goal:** use Unity's maths types in Nord scripts, with the same members and the same results. They are plain classes (no engine needed): `import { Matrix4x4, Bounds, … } from 'nord'`.

The common ones (`Vector2`, `Vector3`, `Quaternion`, `Mathf`) are in the [Unity-style scripting API](api-unity.html). This page covers the rest.

> **Trap:** JavaScript cannot overload operators. Where Unity writes `a * b`, write `a.Mul(b)` (vectors, matrices) or `Matrix4x4.Multiply(a, b)`. `a + b` is `a.Add(b)`. Matrices store 16 numbers in column-major order like Unity, and `m.m03` etc. are Unity's field names (`m`*row*`column`).

## Vector4, Vector2Int, Vector3Int
| Type | Members |
|---|---|
| `Vector4` | `x y z w`, `zero`, `one`, `Dot`, `Distance`, `Lerp`, `LerpUnclamped`, `MoveTowards`, `Scale`, `Project`, `Min`, `Max`, `magnitude`, `sqrMagnitude`, `normalized`, `Normalize()`, `Add/Sub/Mul/Div`, `Set`, `toVector3()`, `Vector4.From(v)` |
| `Vector2Int`, `Vector3Int` | integer vectors (`x y (z)` are truncated): `zero`, `one`, `up/down/left/right`, `Distance`, `FloorToInt`, `CeilToInt`, `RoundToInt`, `Add/Sub/Mul/Scale`, `magnitude`, `toVector2()` / `toVector3()` |

## Matrix4x4
**File: `scripts/Matrices.js`** (new file, the whole file)
```js
import { MonoBehaviour, Matrix4x4, Vector3, Quaternion } from 'nord';

export default class Matrices extends MonoBehaviour {
  Start() {
    // Translation · Rotation · Scale: scale first, then rotate, then move
    const m = Matrix4x4.TRS(new Vector3(1, 2, 3), Quaternion.Euler(0, 90, 0), new Vector3(2, 2, 2));
    const p = m.MultiplyPoint3x4(new Vector3(1, 0, 0));       // (1, 2, 1)
    this.log('point', p.toString(), 'scale', m.lossyScale.toString(), 'back', m.inverse.MultiplyPoint3x4(p).toString());

    const proj = Matrix4x4.Perspective(60, 16 / 9, 0.1, 100); // OpenGL convention, like Unity
    const ndc = proj.MultiplyPoint(new Vector3(0, 0, -10));   // divides by w
    this.log('depth in clip space', ndc.z);
  }
}
```
| Member | Meaning |
|---|---|
| `Matrix4x4.identity`, `zero` | |
| `TRS(pos, rot, scale)`, `Translate(v)`, `Rotate(q)`, `Scale(v)` | build |
| `Perspective(fov, aspect, near, far)`, `Ortho(l, r, b, t, near, far)`, `Frustum(...)`, `LookAt(from, to, up)` | projection and view (OpenGL convention: the camera looks down −Z, clip z −1..1) |
| `Multiply(a, b)`, `a.Mul(b)`, `a.Mul(vector4)` | matrix × matrix, matrix × Vector4 |
| `MultiplyPoint(p)`, `MultiplyPoint3x4(p)`, `MultiplyVector(v)` | with the perspective divide / affine only / direction only |
| `inverse`, `transpose`, `determinant`, `isIdentity` | |
| `GetPosition()`, `rotation`, `lossyScale`, `ValidTRS()` | decompose |
| `GetColumn(i)`, `GetRow(i)`, `SetColumn`, `SetRow`, `Get(row, col)`, `Set(row, col, v)`, `m00 … m33` | elements |
| `TransformPlane(plane)` | |

A singular matrix has an `inverse` of all zeros (as in Unity).

## Bounds, Rect, RectInt
**File: `scripts/Areas.js`** (new file, the whole file)
```js
import { MonoBehaviour, Bounds, Rect, Ray, Vector3, Vector2 } from 'nord';

export default class Areas extends MonoBehaviour {
  Start() {
    const b = new Bounds(Vector3.zero, new Vector3(2, 2, 2));          // centre, size
    b.Encapsulate(new Vector3(5, 0, 0));                               // grow to include a point
    this.log(b.size.toString(), b.Contains(new Vector3(1, 0, 0)));     // (6, 2, 2) true
    const hit = b.IntersectRayDetail(new Ray(new Vector3(-9, 0, 0), Vector3.right));
    this.log(hit.hit, hit.distance);                                   // true 8  (IntersectRay(ray, out distance) as one result)

    const r = new Rect(0, 0, 10, 10);
    this.log(r.Contains(new Vector2(5, 5)), r.Overlaps(Rect.MinMaxRect(9, 9, 20, 20)));  // true true
  }
}
```
| `Bounds` | |
|---|---|
| `new Bounds(center, size)`, `center`, `size`, `extents`, `min`, `max` | |
| `Encapsulate(point or bounds)`, `Expand(number or Vector3)`, `SetMinMax(min, max)` | |
| `Contains(p)`, `Intersects(b)`, `IntersectRay(ray)`, `IntersectRayDetail(ray)` → `{ hit, distance }` | |
| `SqrDistance(p)`, `ClosestPoint(p)` | |

| `Rect` / `RectInt` | |
|---|---|
| `new Rect(x, y, w, h)` or `new Rect(position, size)`, `Rect.MinMaxRect(xMin, yMin, xMax, yMax)` | |
| `x y width height xMin xMax yMin yMax min max center position size` | settable like Unity |
| `Contains(p)` (left/top edge in, right/bottom edge out), `Overlaps(rect, allowInverse)`, `Rect.PointToNormalized`, `Rect.NormalizedToPoint` | |
| `RectInt`: `allPositionsWithin()` (a generator), `Contains`, `Overlaps`, `xMin …` | |

> **Trap:** `collider.bounds` gives a `Bounds` in world space. In 2D its `z` is 0 and its size on z is 0.

## Ray, Ray2D, Plane
| Type | Members |
|---|---|
| `Ray(origin, direction)` | `origin`, `direction` (always normalised), `GetPoint(distance)`. `Camera.ScreenPointToRay(p)` returns one. |
| `Ray2D` | the same with `Vector2`. |
| `Plane(normal, point)`, `Plane(normal, distance)`, `Plane(a, b, c)` (three points) | `normal`, `distance`, `GetDistanceToPoint`, `GetSide`, `SameSide`, `ClosestPointOnPlane`, `Raycast(ray)` → `{ hit, enter }` (`enter` = distance along the ray), `flipped`, `Flip()`, `Translate`, `Set3Points`, `SetNormalAndPosition` |

**File: `scripts/Aim.js`** (new file, the whole file: where does the mouse touch the ground plane?)
```js
import { MonoBehaviour, Plane, Vector3, Camera, UnityInput as Input } from 'nord';

export default class Aim extends MonoBehaviour {
  Update() {
    const ray = Camera.main.ScreenPointToRay(Input.mousePosition);   // 3D project
    const ground = new Plane(Vector3.up, Vector3.zero);
    const r = ground.Raycast(ray);
    if (r.hit) this.transform.position = ray.GetPoint(r.enter);
  }
}
```

## Color, Color32, Random.ColorHSV
| Member | Meaning |
|---|---|
| `Color32(r, g, b, a)` | four bytes 0–255 (values are rounded and clamped). `Color32.From(color)`, `color32.toColor()`, `Color32.Lerp`, `toHex()`. |
| `Color.HSVToRGB(h, s, v)`, `Color.RGBToHSV(c)` → `{ h, s, v }` | all 0..1 |
| `color.grayscale`, `Color.orange`, `Color.purple` | |
| `Random.ColorHSV()` or `Random.ColorHSV(hueMin, hueMax, satMin, satMax, valMin, valMax, alphaMin, alphaMax)` | a random colour; the limits default to the whole range |
| `Random.rotation`, `Random.insideUnitCircleNormalized` | |

**File: `scripts/Confetti.js`** (new file, the whole file)
```js
import { MonoBehaviour, Random, Color32 } from 'nord';

export default class Confetti extends MonoBehaviour {
  Start() {
    const c = Random.ColorHSV(0, 1, 0.6, 1, 0.8, 1);          // bright, saturated colours only
    this.entity.set('sprite', 'tint', c.toHex());
    this.log(Color32.From(c).toString());                      // RGBA(212, 40, 91, 255)
  }
}
```

## AnimationCurve and Gradient
`AnimationCurve` and `Gradient` are what Unity components use for width curves, colour over time and easing.

**File: `scripts/Curves.js`** (new file, the whole file)
```js
import { MonoBehaviour, AnimationCurve, Keyframe, Gradient, GradientColorKey, GradientAlphaKey, Color } from 'nord';

export default class Curves extends MonoBehaviour {
  Start() {
    const curve = new AnimationCurve(new Keyframe(0, 0), new Keyframe(1, 1));
    this.log(curve.Evaluate(0.5));                                       // 0.5 (smooth Hermite between the keys)
    this.log(AnimationCurve.EaseInOut(0, 0, 1, 1).Evaluate(0.1));        // slow start: 0.028
    const g = new Gradient();
    g.SetKeys([new GradientColorKey(Color.red, 0), new GradientColorKey(Color.blue, 1)], [new GradientAlphaKey(1, 0), new GradientAlphaKey(0, 1)]);
    this.log(g.Evaluate(0.5).toHex(), g.Evaluate(0.5).a);                // #800080 0.5
  }
}
```
`AnimationCurve`: `keys`, `AddKey`, `RemoveKey`, `MoveKey`, `Evaluate(t)`, `preWrapMode` / `postWrapMode` (`'Clamp'`, `'Loop'`, `'PingPong'`), `Linear(...)`, `EaseInOut(...)`, `Constant(...)`. `Gradient`: `SetKeys`, `Evaluate(t)`, `colorKeys`, `alphaKeys`, `mode` (`'Blend'` or `'Fixed'`).

## Check yourself
* `node --test runtime/core/unity-extra.test.mjs` runs the examples of this page as assertions (matrix inverse, bounds, plane raycast, Color32, gradients).
* Results match the Unity documentation: `Matrix4x4.TRS` then `MultiplyPoint3x4`, `Bounds.Encapsulate`, `Plane.Raycast`.

Next: [Input](ex-unity-api-input.html). Back to: [Scripting and objects](ex-unity-api-scripting.html).
