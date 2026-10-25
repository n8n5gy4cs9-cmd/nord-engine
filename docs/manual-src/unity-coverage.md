---
title: Unity coverage
section: Manual
order: 37
summary: What of Unity's scripting API works in Nord, what works with limits, and what is missing. Honest list with counts.

---

::: dummies
Choose the row that matches your current task. Names in code are case-sensitive. Follow the linked manual chapter for setup steps before using this quick reference.
:::

Short answer: **not 100%, but almost all of what a gameplay programmer uses**. Scripts, input (old and new system), time, prefabs, coroutines, triggers, physics 2D and 3D with joints, line and trail renderers, masks, saving and scenes are covered; the gaps are NavMesh, Cinemachine, Terrain, editor scripting and a few smaller classes (see "Nice to have" below). This page is the honest list. `✔` works with the Unity name, `◐` works with limits, `✘` not available in Unity style (the **Native way** column says what to use instead; native code always works next to Unity-style code).

Status of this page: updated for version 0.3.0. The unit tests are `runtime/core/unity-extra.test.mjs` (maths, tree, input, queries, joints, renderers; `node --test runtime/core/*.test.mjs`) and the browser checks of the three Lab projects ([Physics Lab](ex-physics-lab.html)).

## Counts

The tables below have **98 rows** (each row is one Unity feature or a small group of closely related members that most gameplay scripts use): **✔ 67, ◐ 19, ✘ 12**. That is **68% fully** and **88% fully or partly**. It counts rows, not lines of code or how often each feature is used. Version 0.3.0 raised it from 49% to 68%; the remaining rows are the ones in the "nice to have" list below.

## MonoBehaviour and GameObject

| Unity | Status | Native way / note |
|---|---|---|
| `Awake` `Start` `Update` `FixedUpdate` `LateUpdate` | ✔ | |
| `OnEnable` `OnDisable` `OnDestroy` | ✔ | |
| `OnTriggerEnter/Exit(2D)` | ✔ | `other` is the entity |
| `OnCollisionEnter/Exit(2D)` | ✔ | |
| `OnTriggerStay` `OnCollisionStay` | ✔ | synthesised each frame while touching |
| `OnMouseDown/Up/Enter/Exit/Over/Drag` | ✔ | bounding box test |
| `OnBecameVisible/Invisible` | ✔ | the camera starts or stops seeing the object's pictures / meshes; see [Scripting and objects](ex-unity-api-scripting.html) |
| `OnApplicationFocus/Pause/Quit` | ✔ | window focus, tab hidden, page closed / `Application.Quit()` |
| `OnValidate`, `OnTransformParentChanged`, `OnTransformChildrenChanged` | ✔ | `OnValidate` runs after the fields were set |
| `Reset`, `OnDrawGizmos`, `OnDrawGizmosSelected` | ✘ | editor only: draw with `Debug.DrawLine` (2D) or a `lineRenderer` |
| `[SerializeField]`, `[Range]`, `Enum`, `EntityRef` | ✔ | `static attributes = SerializeField({…})` |
| `[Header]`, `[Tooltip]`, `[Space]`, `[TextArea]`, `[HideInInspector]`, read-only fields | ✔ | `Header('x', f)`, `Tooltip(…)`, `Space(…)`, `TextArea(…)`, `HideInInspector(…)`, `ReadOnly(…)` or the same keys in the field object |
| Inspector button (custom editor / `[ContextMenu]`) | ◐ | `Button('Label', 'method')` runs a **static** method with an editor context (`ctx.entity`, `CreateChild`, …); edits the scene as one undo step. See [Build a clock](ex-clock.html) |
| `[RequireComponent]`, `[DisallowMultipleComponent]` | ✔ | `static RequireComponent = [Rigidbody2D, 'collider']`, `static DisallowMultipleComponent = true` |
| `[CreateAssetMenu]` | ✘ | editor only |
| `gameObject`, `transform`, `tag`, `name` | ✔ | |
| `gameObject.SetActive`, `activeSelf`, `activeInHierarchy` | ✔ | |
| `CompareTag`, `FindWithTag`, `Find`, `FindObjectOfType` | ✔ | |
| `GetComponent<T>` (scripts, Unity component classes, Nord components) | ✔ | |
| `GetComponentInChildren` / `InParent` / `GetComponents` | ✔ | |
| `AddComponent<T>` | ✔ | |
| `SendMessage` `BroadcastMessage` `SendMessageUpwards` | ✔ | |
| `Instantiate(prefab, pos, rot, parent)`, `Destroy(obj, t)` | ✔ | returns a Promise (loading), overrides per instance |
| `DontDestroyOnLoad` | ✔ | |
| `StartCoroutine` `StopCoroutine` `StopAllCoroutines` | ✔ | stop by Coroutine object, not by name |
| `Invoke` `InvokeRepeating` `CancelInvoke` `IsInvoking` | ✔ | |
| `WaitForSeconds`, `WaitUntil`, `WaitWhile`, `WaitForEndOfFrame`, `WaitForFixedUpdate`, `yield return null` | ✔ | `WaitForSecondsRealtime` waits scaled time |
| `Awaitable` (`NextFrameAsync`, `WaitForSecondsAsync`, `FixedUpdateAsync`, `EndOfFrameAsync`, `FromAsyncOperation`) | ✔ | game time; no threads in the browser (`MainThreadAsync` / `BackgroundThreadAsync` return at once) |

## Transform

| Unity | Status | Note |
|---|---|---|
| `position`, `localPosition`, `eulerAngles`, `localEulerAngles`, `rotation`, `localRotation`, `localScale`, `lossyScale` | ✔ | 2D rotation is Z, **clockwise**; y points **down** |
| `forward`, `right`, `up` | ✔ | 2D: `right` and `up` follow the sprite's own axes in screen space |
| `Translate(…, Space)`, `Rotate`, `RotateAround`, `LookAt` | ✔ | `RotateAround` 2D uses Z |
| `TransformPoint`, `InverseTransformPoint`, `TransformDirection` | ✔ | parents' rotation is not part of world position (backend applies it natively) |
| `parent`, `root`, `childCount`, `GetChild`, `Find("A/B")`, `IsChildOf` | ✔ | |
| `SetSiblingIndex`, `SetAsFirstSibling` | ✔ | changes the list order, not the draw order (use `position.z`) |
| `SetParent(parent, worldPositionStays)`, `DetachChildren` | ✔ | at run time, 2D and 3D; the local transform is recomputed so the object does not jump |
| `Quaternion` (`Euler`, `AngleAxis`, `LookRotation`, `Slerp`, `Lerp`, `FromToRotation`, `Inverse`, `RotateTowards`, `*` vector) | ✔ | |

## Math, time, random

| Unity | Status | Note |
|---|---|---|
| `Vector2`, `Vector3` (operators as methods: `Add`, `Sub`, `Mul`) | ◐ | JS has no operator overloading, so `a + b` is `a.Add(b)` |
| `Vector4`, `Matrix4x4`, `Bounds`, `Rect`, `RectInt`, `Ray`, `Ray2D`, `Plane`, `Vector2Int`, `Vector3Int` | ✔ | [Math types](ex-unity-api-math.html) |
| `AnimationCurve`, `Keyframe`, `Gradient` | ✔ | |
| `Mathf.*` (Lerp, Clamp, SmoothDamp, Repeat, PingPong, DeltaAngle, PerlinNoise, NextPowerOfTwo, …) | ✔ | |
| `Color` (named colours, `Lerp`, `FromHex`, `HSVToRGB`, `RGBToHSV`), `Color32` | ✔ | |
| `Random.Range/value/insideUnitCircle/onUnitSphere/InitState/ColorHSV/rotation` | ✔ | two whole numbers give an integer like C# |
| `Time.deltaTime`, `fixedDeltaTime`, `time`, `timeScale`, `unscaledDeltaTime`, `frameCount`, `smoothDeltaTime`, `realtimeSinceStartup` | ✔ | |
| `Time.captureFramerate`, `Time.maximumDeltaTime` setter | ✘ | |

## Input

| Unity | Status | Note |
|---|---|---|
| `Input.GetKey/Down/Up(KeyCode or "space")` | ✔ | key names and `KeyCode.X` both work |
| `Input.GetAxis("Horizontal"/"Vertical")`, `GetAxisRaw` | ✔ | WASD, arrows, gamepad stick |
| `Input.GetButton*("Jump","Fire1","Submit", your own)` | ✔ | falls back to Unity's default keys |
| `Input.GetMouseButton*`, `mousePosition` | ✔ | screen = canvas pixels |
| `Input.mouseScrollDelta` | ✔ | |
| `Input.touchCount`, `GetTouch`, `touches` | ✔ | phases `Began/Moved/Stationary/Ended/Canceled`, pressure, radius, `tapCount` |
| `Input.GetAxis("Mouse X" / "Mouse Y" / "Mouse ScrollWheel")`, project axes with sensitivity and gravity, `inputString` | ✔ | smoothing is optional (`input.smoothAxes`) |
| `Input.acceleration`, `gyro`, `compass`, `location`, `deviceOrientation` | ✔ | browser sensors; zero on a desktop. See [Input](ex-unity-api-input.html) |
| New Input System: `InputAction`, `InputActionMap`, `InputActionAsset` (Unity `.inputactions` JSON), `PlayerInput`, `Keyboard/Mouse/Gamepad/Touchscreen.current` | ✔ | bindings, composites, processors; interactions other than the default are ignored |
| `Cursor.lockState`, `Cursor.visible` | ✔ | |

## Physics 2D / 3D

| Unity | Status | Note |
|---|---|---|
| `Rigidbody2D` / `Rigidbody`: `velocity`, `bodyType`, `isKinematic`, `mass`, `drag`, `gravityScale`, `freezeRotation`, `simulated`, `AddForce` (Force, Impulse), `MovePosition`, `angularVelocity` | ◐ | arcade and matter 2D; `AddForce` approximates by velocity change; Havok 3D basics |
| `Rigidbody.AddExplosionForce`, `constraints`, `interpolation`, `collisionDetectionMode` | ✔ | 2D: all three; 3D: constraints and detection (`interpolation` has no visual effect in 3D) |
| `Collider2D` family: `isTrigger`, `size`, `radius`, `offset`, `attachedRigidbody`, `bounds`, `usedByComposite` | ✔ | box, circle, **capsule, polygon, edge, composite** (exact on matter; arcade uses the bounding box); 3D box, sphere, capsule, cylinder |
| `PhysicsMaterial2D` (friction, bounciness) | ◐ | rigidbody fields `bounce`, `friction` |
| `Physics2D.Raycast/RaycastAll/RaycastNonAlloc/Linecast/Overlap*(All, NonAlloc)/OverlapCollider/Distance/ClosestPoint/IsTouching/gravity`, `ContactFilter2D` | ✔ | exact for every shape, rotation included |
| `Physics2D.CircleCast/BoxCast/CapsuleCast` (+ `All`, `NonAlloc`), `IgnoreCollision`, `IgnoreLayerCollision` | ✔ | |
| `Physics.Raycast/RaycastAll/RaycastNonAlloc/Linecast/OverlapSphere/OverlapBox/OverlapCapsule/Check*/ClosestPoint/IgnoreCollision/gravity` (3D) | ✔ | Havok does the plain ray; everything else reads the collider shapes |
| `Physics.SphereCast/BoxCast/CapsuleCast` (+ `All`, `NonAlloc`) (3D) | ✔ | |
| Joints: `HingeJoint2D`, `SpringJoint2D`, `DistanceJoint2D`, `FixedJoint2D`, `SliderJoint2D`, `WheelJoint2D`, `TargetJoint2D`, `RelativeJoint2D`, `FrictionJoint2D`, `HingeJoint`, `FixedJoint`, `SpringJoint`, `CharacterJoint`, `ConfigurableJoint` | ✔ | 2D on matter (arcade: pin, spring, distance, target only); 3D on Havok; `breakForce` in 2D only |
| `CharacterController`, `NavMeshAgent` | ✘ | physics body movement; [Pathfinding](ex-pathfinding.html) |
| `LayerMask`, layer names | ◐ | layers are numbers; names not stored |

## Rendering and components

| Unity | Status | Note |
|---|---|---|
| `SpriteRenderer`: `sprite`, `color`, `flipX/Y`, `enabled`, `sortingOrder`, `size` | ◐ | `sprite` is a texture path that must already be loaded by some scene or prefab |
| `Animator`: `SetFloat/Bool/Integer/Trigger`, `Play`, `speed`, state | ✔ | controller from the Animator tab; 2D clips and 3D glTF clips |
| `Animation` (legacy), `AnimationClip` API, `Animator.CrossFade`, blend trees, animation events API | ✘ | frame events as entity events |
| `AudioSource`: `clip`, `Play`, `Stop`, `volume`, `loop`, `PlayOneShot`, `isPlaying`, `PlayClipAtPoint` | ✔ | spatial audio ✘ |
| `AudioListener`, `AudioMixer` | ◐ | buses `master/music/sfx/ui` via `this.audio.volume(bus, v)` |
| `Camera.main`, `orthographicSize`, `fieldOfView`, `backgroundColor`, `ScreenToWorldPoint`, `WorldToScreenPoint`, `ScreenPointToRay`, `ViewportToWorldPoint`, matrices | ✔ | 2D and 3D; screen = canvas pixels, origin top-left |
| `Camera` shake / flash (Cinemachine impulse) | ✔ | `Camera.main.Shake()`, `Flash()` |
| `Cinemachine` (virtual cameras, blends) | ✘ | the library camera scripts |
| `Light` (3D): `color`, `intensity`, `enabled`, `type` | ◐ | `range`, `spotAngle`, `cookie` ✘ |
| URP 2D Light / ShadowCaster2D | ◐ | library scripts `light2d*.js`, see [2D lights](ex-lights-2d.html) |
| `ParticleSystem`: `Play`, `Stop`, `Emit`, `isPlaying` | ◐ | modules (`main`, `emission`, `shape`…) ✘: edit the component fields in the Particles tab |
| `MeshRenderer.material.color/metallic/roughness`, `SetColor`, `SetFloat` | ◐ | PBR basics only |
| `Shader` / `Shader Graph` / `MaterialPropertyBlock` | ◐ | replaced by **Shadertoy** shaders ([Shadertoy](ex-shadertoy.html)): components, 3D materials and a post effect; the PBR `material` component for normal surfaces |
| Post-processing `Volume` | ◐ | `PostProcessing.Add('crt', {…})` over the stock effects (blur, glow, vignette, crt, pixelate, hue…) |
| `LineRenderer`, `TrailRenderer`, `SpriteMask`, `SpriteShapeController` | ✔ | [Lines, trails, masks and shapes](ex-unity-api-rendering.html); textured lines are not drawn |
| `Tilemap` (`SetTile`, `GetTile`), Rule Tiles | ✘ | tilemap component + painter; map-as-text loaders |
| `Terrain`, `ProBuilder`, `VideoPlayer` | ✘ | 3D Modeler, `video` component natively |
| `Skybox`, `RenderSettings`, fog, light probes | ✘ | scene `settings`, `skybox` component |

## UI

| Unity | Status | Note |
|---|---|---|
| uGUI/TextMeshPro `Text.text`, `color`; `Button.onClick`; `Slider.value`; `Image` | ◐ | the `this.ui.label/button/bar/image/panel` handles plus the UI Designer; Unity class names are not mirrored |
| `Canvas`, `CanvasScaler`, `RectTransform` anchors | ◐ | UI Designer anchors; the HUD layer is in screen pixels (see [Vector Rocks](ex-vector-rocks.html) for a scaler pattern) |
| UI Toolkit (`UXML`, `VisualElement`) | ✘ | UI scenes (`.ui.json`) |
| `EventSystem`, `IPointerClickHandler` | ✘ | `OnMouseDown` and UI action names |

## Application, scenes, data

| Unity | Status | Note |
|---|---|---|
| `SceneManager.LoadScene`, `LoadSceneAsync`, `GetActiveScene`, `sceneLoaded` | ✔ | path instead of build index |
| `Application.platform`, `isEditor`, `Quit`, `targetFrameRate`, `persistentDataPath`, `productName`, `version`, `OpenURL`, `isFocused`, `systemLanguage` | ✔ | `persistentDataPath` is a `nord://` label (browser storage) |
| `PlayerPrefs` (Int/Float/String, HasKey, DeleteKey, DeleteAll, Save) | ✔ | writes are immediate, `Save` does nothing |
| `JsonUtility.ToJson/FromJson/FromJsonOverwrite` | ✔ | |
| `Resources.Load/LoadAsync` | ◐ | JSON/text data; textures and audio load through components and `audio.play(path)` |
| `ScriptableObject` (`CreateAssetMenu`) | ◐ | JSON files + `ScriptableObject.Load` |
| `UnityEvent`, `EventBus`, C# events | ✔ | |
| `Addressables`, `AssetBundle`, `AsyncOperationHandle` | ✘ | file paths, `game.loadJSON` |
| `Screen.width/height/fullScreen`, `Screen.SetResolution` | ◐ | width and height only |
| `Debug.Log/Warning/Error/Assert/LogFormat`, `Debug.DrawLine/DrawRay` | ◐ | `Draw*` work in 2D Phaser only; no gizmo drawing in the editor |

## Singletons and services (Nord adds these in Unity style)

| `GameManager` (score, lives, state, Pause, Restart, SaveHighScore), `Singleton`, `AudioManager`, `ObjectPool` | ✔ | |

## Nice to have (not built, in the order we would build them)

The full table with what to do today is on [Unity API in Nord: the map](ex-unity-api.html). In short:

1. `NavMeshAgent` / `NavMesh`, `CharacterController` (use [Pathfinding](ex-pathfinding.html) and a rigidbody controller).
2. 3D `Rigidbody.interpolation` on screen, `Physics.ComputePenetration`, contact lists, 3D joint `breakForce`.
3. Layer names (`LayerMask.NameToLayer`), `PhysicsMaterial2D` assets.
4. `MeshCollider`, `WheelCollider`, `ConstantForce`, `Terrain`, `ProBuilder`, `Cloth`.
5. Animator blend trees and layers, `AudioMixer`, spatial audio, `ParticleSystem` modules.
6. `Cinemachine`, UI Toolkit, `EventSystem`, Addressables, Rule Tiles, `Gizmos`.

If you need something marked ✘ today, use the native API (`entity.native`, `this.physics`, `this.game.backend`) from the same script; both styles can live in one file.


## Check yourself

Confirm the result in your saved project. Check Console errors and compare exact names with the linked reference if the result differs.

Next: [Unity scripting cheatsheet](cheat-sheet-unity.html). Back to: [Cheatsheets](cookbook.html).
