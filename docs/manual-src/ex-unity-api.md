---
title: 57 · Unity API in Nord: the map
section: Examples
order: 57
summary: Every Unity command that works in Nord, in Unity's own groups, with links to the pages that explain them. Plus the honest list of what is not built yet.
---

**Goal:** know where to find a Unity command you remember, and what to do when Nord does not have it.

Nord has a Unity-style coding layer on top of its engine. You write JavaScript, but the names, the lifecycle and the behaviour follow Unity: `MonoBehaviour`, `Update`, `transform.Translate`, `Rigidbody2D.AddForce`, `Physics2D.CircleCast`, `LineRenderer`, `InputAction`. This page is the map; each group has its own page with examples you can paste.

**File: `scripts/Example.js`** (new file, the whole file: the import line every Unity-style script starts with)
```js
import { MonoBehaviour, Vector2, Vector3, Quaternion, Mathf, Time, Debug, Physics2D, Rigidbody2D, UnityInput as Input, KeyCode } from 'nord';
```
> **Trap:** Unity's `Input` is exported as `UnityInput` (Nord already has its own `Input` class). Write `UnityInput as Input` once and use `Input.GetAxis` as always.

## The groups

| Unity group | What works | Page |
|---|---|---|
| **Scripting and objects** | `MonoBehaviour` events (`Awake`, `Start`, `Update`, `FixedUpdate`, `LateUpdate`, `OnEnable`, `OnDisable`, `OnDestroy`, `OnBecameVisible`, `OnBecameInvisible`, `OnApplicationFocus/Pause/Quit`, `OnValidate`, `OnTransformParentChanged`), `GetComponent` family, `Instantiate` / `Destroy`, `transform.SetParent`, `DetachChildren`, `RequireComponent`, `DisallowMultipleComponent`, coroutines, `Awaitable`, `Invoke`, `PlayerPrefs` (with `Save` and `DeleteKey`) | [Scripting and objects](ex-unity-api-scripting.html) |
| **Math types** | `Vector2`, `Vector3`, `Vector4`, `Vector2Int`, `Vector3Int`, `Quaternion`, `Matrix4x4`, `Bounds`, `Rect`, `RectInt`, `Ray`, `Ray2D`, `Plane`, `Color`, `Color32`, `Mathf`, `Random` (with `ColorHSV`), `AnimationCurve`, `Gradient` | [Math types](ex-unity-api-math.html) |
| **Input** | `Input.GetKey/GetButton/GetAxis` (also `Mouse X`, `Mouse Y`, `Mouse ScrollWheel`, project axes with smoothing), touches with pressure and tap count, accelerometer, gyroscope, compass, location, `inputString`, the whole **New Input System** (`InputAction`, `InputActionMap`, `InputActionAsset` from `.inputactions` files, `PlayerInput`, `Keyboard.current`, `Mouse.current`, `Gamepad.current`) | [Input](ex-unity-api-input.html) |
| **Physics 2D** | `Rigidbody2D` (constraints, interpolation, collision detection, explosion force), box / circle / capsule / polygon / edge / composite colliders, `Raycast`, `Linecast`, `CircleCast`, `BoxCast`, `CapsuleCast` (+ `All` / `NonAlloc`), every `Overlap*`, `Distance`, `ClosestPoint`, `IgnoreCollision`, `IgnoreLayerCollision`, `ContactFilter2D`, all nine 2D joints | [Physics 2D](ex-unity-api-physics2d.html) |
| **Physics 3D** | `Rigidbody` (constraints), `Physics.Raycast/RaycastAll/RaycastNonAlloc`, `SphereCast`, `BoxCast`, `CapsuleCast`, `OverlapSphere/Box/Capsule`, `Check*`, `IgnoreCollision`, `HingeJoint`, `FixedJoint`, `SpringJoint`, `CharacterJoint`, `ConfigurableJoint`, `Camera.WorldToScreenPoint` / `ScreenToWorldPoint` / `ScreenPointToRay` | [Physics 3D and joints](ex-unity-api-physics3d.html) |
| **Rendering** | `LineRenderer`, `TrailRenderer`, `SpriteMask`, `SpriteShapeController`, `Camera` conversions, curves and gradients, **Shadertoy shaders** instead of `Shader` / Shader Graph | [Lines, trails, masks and shapes](ex-unity-api-rendering.html), [Shadertoy](ex-shadertoy.html) |
| **Everything older** | `Transform`, `GameObject`, `Time`, `Application`, `SceneManager`, `Resources`, `JsonUtility`, `ScriptableObject`, `UnityEvent`, `AudioSource`, `Animator`, `SpriteRenderer`, `ParticleSystem`, `Light`, UI helpers | [Unity-style scripting API](api-unity.html), [Unity helpers cookbook](ex-unity-helpers.html), [Unity coverage](unity-coverage.html) |

A complete bench for the physics side is the **Physics Lab** project: [Physics Lab](ex-physics-lab.html).

## What every Unity name means in Nord
* **Names are the Unity names**, in JavaScript: methods in `PascalCase`, properties in `camelCase`, enums as objects (`RigidbodyConstraints2D.FreezeRotation`).
* **No operators on objects.** JavaScript cannot overload `+` or `*`. `a + b` is `a.Add(b)`, `a * 2` is `a.Mul(2)`, `m1 * m2` is `Matrix4x4.Multiply(m1, m2)` or `m1.Mul(m2)`.
* **`out` and `ref` parameters become return values.** `Physics2D.Raycast(...)` returns the hit (check `hit.collider`); `plane.Raycast(ray)` returns `{ hit, enter }`; `Mathf.SmoothDamp` returns `{ value, velocity }`.
* **A collider is an entity.** `hit.collider` is the object that was hit (it has `name`, `tag`, `CompareTag`, `GetComponent`); `hit.collider.gameObject` is the same object.
* **2D means pixels and y down.** Positions are pixels, rotation is clockwise degrees, and y grows **down** the screen. So `Vector2.up` (0, 1) points *down* on screen; "up" is `Vector2.down` / `(0, -1)`, and Unity's `Input.GetAxis('Vertical')` has to be negated for movement (the Coin Dash example does `-Input.GetAxis('Vertical')`). When you convert a Unity project, positions are multiplied by `pixelsPerUnit` and y is negated (see [Convert a Unity project](ex-unity-conversion.html)).
* **Layers are numbers.** `LayerMask.GetMask(0, 3)` gives `(1 << 0) | (1 << 3)`; an object's layer is `entity.layer`. Layer names are not stored (nice to have).

## Not built yet: "nice to have"
These Unity features are known gaps. Each one lists the Nord way to get the same result today.

| Unity | Status | Instead |
|---|---|---|
| `Cinemachine` | not planned | the camera scripts in the Library (follow, shake, deadzone) |
| `Shader`, Shader Graph, `MaterialPropertyBlock`, `Material.SetTexture` | replaced | a **Shadertoy** shader ([Shadertoy](ex-shadertoy.html)); the standard `material` component for normal PBR |
| `NavMeshAgent`, `NavMesh.CalculatePath` | not built | [Pathfinding](ex-pathfinding.html) (grid A*) |
| `CharacterController` | not built | a `rigidbody` with `freezeRotation` and `Rigidbody.velocity`, or the 3D controller scripts in the Library |
| `Tilemap.SetTile` / `GetTile` as a Unity class | partly | the `tilemap` component has `tileAt` / `setTile` ([Tilemaps](ex-tilemap-levels.html)) |
| `Terrain`, `ProBuilder`, `VideoPlayer` class | not built | the 3D Modeler, the `video` component |
| `MeshCollider`, `WheelCollider`, `ConstantForce`, `Cloth` | not built | convex `box` / `capsule` / `cylinder` colliders, a script that applies force every `FixedUpdate` |
| Joint breaking in 3D (`breakForce`), joint `reactionForce` | not available | breaking works in 2D; in 3D remove the joint component from a script |
| 3D `Rigidbody.interpolation` | stored, no visual effect | in 3D Havok runs inside the render step; smooth a follow camera with `Vector3.Lerp` or `Mathf.SmoothDamp` |
| `Physics.ComputePenetration`, contact lists (`GetContacts`) | not built | `Physics2D.Distance(a, b)` (2D) or the collision callbacks' `contact` object |
| `PhysicsMaterial2D` assets | partly | `friction` and `bounce` fields on the `rigidbody` (and `sharedMaterial = { friction, bounciness }`) |
| Layer names, `LayerMask.NameToLayer` | not built | numbers (`entity.layer`) |
| `OnDrawGizmos`, `OnDrawGizmosSelected`, `Reset` | editor-only | write the debug picture with `Debug.DrawLine` (2D) or a `lineRenderer` |
| `IPointerClickHandler`, `EventSystem` | not built | `OnMouseDown` and UI actions |
| `Addressables`, `AssetBundle`, UI Toolkit (`UXML`) | not built | file paths and `game.loadJSON`; UI scenes (`.ui.json`) |
| Rule Tiles, `Sprite Atlas` | not built | the tilemap editor's auto-tiling, the sprite sheet pipeline |
| Audio: `AudioMixer`, spatial blend, reverb zones | not built | buses `master/music/sfx/ui` with `audio.volume(bus, v)` |
| Animator blend trees, layers, `CrossFade` | not built | the Animator controller with transitions ([Animation](ex-animation.html)) |
| `Gizmos`, `Handles`, custom editors | editor-only | `Button('Label', 'method')` attributes for Inspector buttons |

If you need one of these, say so in the issue list: the list above is the order we would build them in, top to bottom.

## Check yourself
* A Unity script you remember pasted into `scripts/` (with the import line) runs; where a method is missing the console says `x is not a function` with the name, and the table above has the substitute.
* Every page in this group has a runnable example; the Physics Lab and the Shadertoy Lab projects run all of them.

Next: [Scripting and objects](ex-unity-api-scripting.html). Back to: [Examples index](examples.html).
