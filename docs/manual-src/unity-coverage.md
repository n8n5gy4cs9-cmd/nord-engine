---
title: Unity coverage
section: Manual
order: 37
summary: What of Unity's scripting API works in Nord, what works with limits, and what is missing. Honest list with counts.

---
Short answer: **not 100%**. The everyday gameplay API (scripts, input, time, prefabs, coroutines, triggers, GameManager, UI labels, save, scenes) is covered; large parts of the *rest* of Unity (joints, NavMesh, Cinemachine, LineRenderer, custom shaders, Terrain, editor scripting) have no Unity-style entry point yet. This page is the honest list. `✔` works with the Unity name, `◐` works with limits, `✘` not available in Unity style (the **Native way** column says what to use instead; native code always works next to Unity-style code).

Status of this page: written 2026-10-25 from reading the engine (`runtime/core/unity.js`, `runtime/core/unity-extra.js`, `runtime/phaser`, `runtime/babylon`). The newest additions (Transform, component wrappers, Physics2D queries, Quaternion) were written **without running new tests** (only the 91 existing unit tests were run to check nothing broke); treat them as unverified until `runtime/core/unity-extra.test.mjs` exists.

## Counts

The tables below have **92 rows** (each row is one Unity feature or a small group of closely related members that most gameplay scripts use): **✔ 45, ◐ 23, ✘ 24**. That is **49% fully** and **74% fully or partly**. It counts rows, not lines of code or how often each feature is used: the missing rows are the less common ones, but a game that needs joints, NavMesh or a custom shader will hit a gap at once.

## MonoBehaviour and GameObject

| Unity | Status | Native way / note |
|---|---|---|
| `Awake` `Start` `Update` `FixedUpdate` `LateUpdate` | ✔ | |
| `OnEnable` `OnDisable` `OnDestroy` | ✔ | |
| `OnTriggerEnter/Exit(2D)` | ✔ | `other` is the entity |
| `OnCollisionEnter/Exit(2D)` | ✔ | |
| `OnTriggerStay` `OnCollisionStay` | ✔ | synthesised each frame while touching |
| `OnMouseDown/Up/Enter/Exit/Over/Drag` | ✔ | bounding box test |
| `OnBecameVisible/Invisible` | ✘ | compare position with the camera view yourself |
| `OnApplicationFocus/Pause/Quit` | ✘ | `window` events |
| `OnValidate`, `Reset`, `OnDrawGizmos` | ✘ | editor only |
| `[SerializeField]`, `[Range]`, `Enum`, `EntityRef` | ✔ | `static attributes = SerializeField({…})` |
| `[Header]`, `[Tooltip]`, `[Space]`, `[TextArea]`, `[HideInInspector]`, read-only fields | ✔ | `Header('x', f)`, `Tooltip(…)`, `Space(…)`, `TextArea(…)`, `HideInInspector(…)`, `ReadOnly(…)` or the same keys in the field object |
| Inspector button (custom editor / `[ContextMenu]`) | ◐ | `Button('Label', 'method')` runs a **static** method with an editor context (`ctx.entity`, `CreateChild`, …); edits the scene as one undo step. See [Build a clock](ex-clock.html) |
| `[RequireComponent]`, `[CreateAssetMenu]`, `[DisallowMultipleComponent]` | ✘ | |
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
| `async/await` as `Awaitable` | ◐ | plain `await` of Promises |

## Transform

| Unity | Status | Note |
|---|---|---|
| `position`, `localPosition`, `eulerAngles`, `localEulerAngles`, `rotation`, `localRotation`, `localScale`, `lossyScale` | ✔ | 2D rotation is Z, **clockwise**; y points **down** |
| `forward`, `right`, `up` | ✔ | 2D: `right` and `up` follow the sprite's own axes in screen space |
| `Translate(…, Space)`, `Rotate`, `RotateAround`, `LookAt` | ✔ | `RotateAround` 2D uses Z |
| `TransformPoint`, `InverseTransformPoint`, `TransformDirection` | ✔ | parents' rotation is not part of world position (backend applies it natively) |
| `parent`, `root`, `childCount`, `GetChild`, `Find("A/B")`, `IsChildOf` | ✔ | |
| `SetSiblingIndex`, `SetAsFirstSibling` | ✔ | changes the list order, not the draw order (use `position.z`) |
| `SetParent`, `DetachChildren` | ✘ | the scene tree is fixed at creation: `Instantiate(path, { parent })` or build it in the editor |
| `Quaternion` (`Euler`, `AngleAxis`, `LookRotation`, `Slerp`, `Lerp`, `FromToRotation`, `Inverse`, `RotateTowards`, `*` vector) | ✔ | |

## Math, time, random

| Unity | Status | Note |
|---|---|---|
| `Vector2`, `Vector3` (operators as methods: `Add`, `Sub`, `Mul`) | ◐ | JS has no operator overloading, so `a + b` is `a.Add(b)` |
| `Vector4`, `Matrix4x4`, `Bounds`, `Rect`, `Ray` | ✘ | arrays and plain objects |
| `Mathf.*` (Lerp, Clamp, SmoothDamp, Repeat, PingPong, DeltaAngle, PerlinNoise, NextPowerOfTwo, …) | ✔ | |
| `Color` (named colours, `Lerp`, `FromHex`), `Color32` | ◐ | `Color32` ✘ |
| `Random.Range/value/insideUnitCircle/onUnitSphere/InitState`, `Random.ColorHSV` | ◐ | `ColorHSV` ✘; two whole numbers give an integer like C# |
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
| `Input.touchCount`, `GetTouch`, `touches` | ◐ | position and phase; no pressure, radius or tap count |
| `Input.GetAxis("Mouse X")`, `acceleration`, `compass`, `gyro` | ✘ | |
| New Input System (`InputAction`, `PlayerInput`) | ✘ | project **actions** (`this.input.down('jump')`) are the equivalent |
| `Cursor.lockState`, `Cursor.visible` | ✔ | |

## Physics 2D / 3D

| Unity | Status | Note |
|---|---|---|
| `Rigidbody2D` / `Rigidbody`: `velocity`, `bodyType`, `isKinematic`, `mass`, `drag`, `gravityScale`, `freezeRotation`, `simulated`, `AddForce` (Force, Impulse), `MovePosition`, `angularVelocity` | ◐ | arcade and matter 2D; `AddForce` approximates by velocity change; Havok 3D basics |
| `Rigidbody.AddExplosionForce`, `constraints` axes, `interpolation`, `collisionDetectionMode` | ✘ | |
| `Collider2D` family: `isTrigger`, `size`, `radius`, `offset`, `attachedRigidbody`, `bounds` | ✔ | box and circle (capsule, polygon, composite ✘) |
| `PhysicsMaterial2D` (friction, bounciness) | ◐ | rigidbody fields `bounce`, `friction` |
| `Physics2D.Raycast/RaycastAll/Linecast/OverlapCircle(All)/OverlapBox(All)/OverlapPoint/OverlapArea(All)/gravity` | ✔ | box and circle colliders, rotation ignored |
| `Physics2D.CircleCast/BoxCast/CapsuleCast`, `IgnoreCollision`, `IgnoreLayerCollision`, layer collision matrix | ✘ | |
| `Physics.Raycast/Linecast/OverlapSphere/gravity` (3D) | ◐ | Raycast exact (Havok); OverlapSphere approximate |
| `Physics.SphereCast/BoxCast/RaycastNonAlloc/OverlapBox` (3D) | ✘ | |
| Joints (`HingeJoint2D`, `SpringJoint2D`, `FixedJoint`, …) | ✘ | matter constraints or Havok constraints natively |
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
| `Camera.main`, `orthographicSize`, `fieldOfView`, `backgroundColor`, `ScreenToWorldPoint`, `WorldToScreenPoint` | ◐ | 2D exact; 3D conversions ✘ (use a physics ray) |
| `Camera` shake / flash (Cinemachine impulse) | ✔ | `Camera.main.Shake()`, `Flash()` |
| `Cinemachine` (virtual cameras, blends) | ✘ | the library camera scripts |
| `Light` (3D): `color`, `intensity`, `enabled`, `type` | ◐ | `range`, `spotAngle`, `cookie` ✘ |
| URP 2D Light / ShadowCaster2D | ◐ | library scripts `light2d*.js`, see [2D lights](ex-lights-2d.html) |
| `ParticleSystem`: `Play`, `Stop`, `Emit`, `isPlaying` | ◐ | modules (`main`, `emission`, `shape`…) ✘: edit the component fields in the Particles tab |
| `MeshRenderer.material.color/metallic/roughness`, `SetColor`, `SetFloat` | ◐ | PBR basics only |
| `Shader` / `Shader Graph` / custom `Material` properties, `MaterialPropertyBlock` | ✘ | custom GLSL needs a native Babylon `ShaderMaterial` / Phaser `PostFXPipeline` |
| Post-processing `Volume` | ◐ | `PostProcessing.Add('crt', {…})` over the stock effects (blur, glow, vignette, crt, pixelate, hue…) |
| `LineRenderer`, `TrailRenderer`, `Sprite Mask`, `SpriteShape` | ✘ | baked sprites, particle trails |
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
| `PlayerPrefs` (Int/Float/String, HasKey, DeleteAll) | ✔ | `Save`, `DeleteKey` ✘ (writes are immediate) |
| `JsonUtility.ToJson/FromJson/FromJsonOverwrite` | ✔ | |
| `Resources.Load/LoadAsync` | ◐ | JSON/text data; textures and audio load through components and `audio.play(path)` |
| `ScriptableObject` (`CreateAssetMenu`) | ◐ | JSON files + `ScriptableObject.Load` |
| `UnityEvent`, `EventBus`, C# events | ✔ | |
| `Addressables`, `AssetBundle`, `AsyncOperationHandle` | ✘ | file paths, `game.loadJSON` |
| `Screen.width/height/fullScreen`, `Screen.SetResolution` | ◐ | width and height only |
| `Debug.Log/Warning/Error/Assert/LogFormat`, `Debug.DrawLine/DrawRay` | ◐ | `Draw*` work in 2D Phaser only; no gizmo drawing in the editor |

## Singletons and services (Nord adds these in Unity style)

| `GameManager` (score, lives, state, Pause, Restart, SaveHighScore), `Singleton`, `AudioManager`, `ObjectPool` | ✔ | |

## What "100%" would still need (and what we recommend)

1. **Joints, `CharacterController`, `NavMeshAgent`**: real engine features first, then a facade. Largest gap for physics-heavy games.
2. **Custom shaders and materials** (`Shader`, `Material.SetTexture`, `MaterialPropertyBlock`): needs a Babylon/Phaser-neutral material layer.
3. **`LineRenderer` / `TrailRenderer`**: easy to add in the Phaser backend (graphics) and Babylon (lines).
4. **Tilemap runtime API** (`SetTile`/`GetTile`): the component stores data; a mutation API is missing.
5. **`Transform.SetParent`**: needs runtime re-parenting in `Scene` and both backends.
6. **3D camera conversions** and `Physics.SphereCast`.
7. **Verification:** write `runtime/core/unity-extra.test.mjs` and an e2e script for the wrappers (`Rigidbody2D` rebuild, `Physics2D.Raycast`, `Camera.ScreenToWorldPoint`, touch and wheel input).

If you need something marked ✘ today, use the native API (`entity.native`, `this.physics`, `this.game.backend`) from the same script; both styles can live in one file.
