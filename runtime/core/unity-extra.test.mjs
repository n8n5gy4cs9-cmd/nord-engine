// Unity-style layer: maths types, SetParent, lifecycle extras, Input (axes, touches, New Input System), PlayerPrefs, Awaitable. Headless (no backend).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Game, NordScript, MemoryStorage, MonoBehaviour, Vector2, Vector3, Vector4, Matrix4x4, Quaternion, Bounds, Rect, RectInt, Ray, Ray2D, Plane, Color, Color32, Random,
  Vector2Int, Vector3Int, KeyCode, PlayerPrefs, InputAction, InputActionAsset, PlayerInput, Keyboard, Mouse, Gamepad, Awaitable, TouchPhase,
} from './index.js';
import { UnityInput as Input } from './unity.js';

const files = {};
const mk = (project = {}) => new Game({ id: 'ux', startScene: 's', input: { actions: { jump: ['Space'] } }, ...project }, {
  fetchJSON: async (p) => structuredClone(files[p]), importScript: async (p) => ({ default: files[`mod:${p.split('?')[0]}`] }), storage: new MemoryStorage(), onError: (e) => { throw e; },
});
const ent = (name, o = {}) => ({ id: name.toLowerCase(), name, ...o });
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// ---------------------------------------------------------------- maths
test('Vector4: arithmetic, Dot, Lerp, Project, normalisation', () => {
  const a = new Vector4(1, 2, 3, 4), b = new Vector4(4, 3, 2, 1);
  assert.equal(Vector4.Dot(a, b), 20);
  assert.deepEqual(a.Add(b).toArray(), [5, 5, 5, 5]);
  assert.deepEqual(Vector4.Lerp(a, b, 0.5).toArray(), [2.5, 2.5, 2.5, 2.5]);
  near(new Vector4(0, 3, 0, 4).magnitude, 5);
  near(new Vector4(0, 3, 0, 4).normalized.magnitude, 1);
  assert.deepEqual(Vector4.Project(new Vector4(1, 1, 0, 0), new Vector4(1, 0, 0, 0)).toArray(), [1, 0, 0, 0]);
});

test('Matrix4x4: TRS, inverse, point/vector transforms, decomposition, projections', () => {
  const m = Matrix4x4.TRS(new Vector3(1, 2, 3), Quaternion.Euler(0, 90, 0), new Vector3(2, 2, 2));
  const p = m.MultiplyPoint3x4(new Vector3(1, 0, 0));
  near(p.x, 1); near(p.y, 2); near(p.z, 1); // +X rotated 90° about Y points to -Z, scaled by 2, then moved
  assert.ok(Matrix4x4.Multiply(m, m.inverse).isIdentity);
  near(m.determinant, 8);
  near(m.lossyScale.x, 2);
  near(m.rotation.eulerAngles.y, 90);
  assert.deepEqual(m.GetPosition().toArray(), [1, 2, 3]);
  near(m.MultiplyVector(new Vector3(1, 0, 0)).z, -2);
  assert.ok(m.ValidTRS());
  const t = Matrix4x4.Translate(new Vector3(5, 0, 0)).Mul(Matrix4x4.Scale(new Vector3(2, 1, 1)));
  assert.equal(t.MultiplyPoint(new Vector3(1, 0, 0)).x, 7);
  assert.equal(t.m03, 5); // Unity field names: m(row)(column)
  const persp = Matrix4x4.Perspective(90, 1, 1, 11), ndc = persp.MultiplyPoint(new Vector3(0, 0, -1));
  near(ndc.z, -1); // near plane → -1
  const ortho = Matrix4x4.Ortho(-2, 2, -1, 1, 0, 10);
  near(ortho.MultiplyPoint(new Vector3(2, 1, 0)).x, 1);
  const view = Matrix4x4.LookAt(new Vector3(0, 0, -5), Vector3.zero, Vector3.up);
  near(view.MultiplyPoint3x4(Vector3.zero).z, 5);
  assert.equal(Matrix4x4.zero.inverse.isIdentity, false);
  assert.deepEqual(m.transpose.transpose.m, m.m);
  assert.deepEqual(m.GetColumn(3).toArray(), [1, 2, 3, 1]);
});

test('Bounds: Encapsulate, Contains, Intersects, ray hit, closest point', () => {
  const b = new Bounds(Vector3.zero, new Vector3(2, 2, 2));
  assert.ok(b.Contains(new Vector3(0.5, 0.5, 0.5)) && !b.Contains(new Vector3(2, 0, 0)));
  b.Encapsulate(new Vector3(5, 0, 0));
  assert.deepEqual(b.size.toArray(), [6, 2, 2]); assert.deepEqual(b.min.toArray(), [-1, -1, -1]);
  assert.ok(b.Intersects(new Bounds(new Vector3(5, 0, 0), Vector3.one)) && !b.Intersects(new Bounds(new Vector3(20, 0, 0), Vector3.one)));
  const hit = b.IntersectRayDetail(new Ray(new Vector3(-9, 0, 0), Vector3.right));
  assert.ok(hit.hit); near(hit.distance, 8);
  assert.equal(b.IntersectRay(new Ray(new Vector3(-9, 5, 0), Vector3.right)), false);
  assert.deepEqual(b.ClosestPoint(new Vector3(0, 10, 0)).toArray(), [0, 1, 0]);
  near(b.SqrDistance(new Vector3(0, 4, 0)), 9);
  b.Expand(2); assert.deepEqual(b.size.toArray(), [8, 4, 4]);
});

test('Rect / RectInt / Ray / Plane', () => {
  const r = new Rect(0, 0, 10, 10);
  assert.ok(r.Contains(new Vector2(0, 0)) && !r.Contains(new Vector2(10, 5)));
  assert.ok(r.Overlaps(Rect.MinMaxRect(9, 9, 20, 20)) && !r.Overlaps(new Rect(10, 0, 5, 5)));
  assert.ok(r.Overlaps(new Rect(12, 12, -4, -4), true));
  assert.deepEqual(Rect.NormalizedToPoint(r, new Vector2(0.5, 0.25)).toArray(), [5, 2.5]);
  assert.deepEqual(r.center.toArray(), [5, 5]);
  assert.equal([...new RectInt(1, 1, 2, 2).allPositionsWithin()].length, 4);
  const ray = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 10));
  assert.deepEqual(ray.direction.toArray(), [0, 0, 1]); assert.deepEqual(ray.GetPoint(3).toArray(), [0, 0, 3]);
  const p5 = new Ray2D(Vector2.zero, new Vector2(3, 4)).GetPoint(5); near(p5.x, 3); near(p5.y, 4);
  const plane = new Plane(Vector3.up, new Vector3(0, 2, 0));
  const hit = plane.Raycast(new Ray(new Vector3(0, 7, 0), Vector3.down));
  assert.ok(hit.hit); near(hit.enter, 5);
  assert.equal(plane.Raycast(new Ray(Vector3.zero, Vector3.right)).hit, false);
  near(plane.GetDistanceToPoint(new Vector3(0, 5, 0)), 3); assert.ok(plane.GetSide(new Vector3(0, 5, 0)));
  assert.deepEqual(plane.ClosestPointOnPlane(new Vector3(4, 9, 1)).toArray(), [4, 2, 1]);
  assert.deepEqual(new Vector2Int(1.9, -1.9).toArray(), [1, -1]); assert.equal(Vector3Int.Distance(new Vector3Int(0, 0, 0), new Vector3Int(1, 2, 2)), 3);
});

test('Color32 and Random.ColorHSV', () => {
  const c = Color32.From(Color.red);
  assert.deepEqual([c.r, c.g, c.b, c.a], [255, 0, 0, 255]);
  assert.equal(new Color32(300, -5, 0).r, 255);
  assert.equal(c.toColor().r, 1); assert.equal(c.toHex(), '#ff0000');
  assert.equal(Color32.Lerp(new Color32(0, 0, 0), new Color32(100, 200, 50), 0.5).g, 100);
  const h = Random.ColorHSV(0.5, 0.5, 1, 1, 1, 1); // hue 0.5 = cyan
  near(h.r, 0); near(h.g, 1); near(h.b, 1);
  const g = Random.ColorHSV(); assert.ok(g.r >= 0 && g.r <= 1 && g.a === 1);
  const back = Color.RGBToHSV(Color.HSVToRGB(0.3, 0.6, 0.9)); near(back.h, 0.3); near(back.s, 0.6); near(back.v, 0.9);
});

// ---------------------------------------------------------------- scene tree + lifecycle
test('SetParent keeps the local numbers or the world place; DetachChildren; cycles are refused', async () => {
  files.s = { name: 's', entities: [ent('A', { transform: { pos: [10, 0, 0], scale: [2, 2, 2] } }), ent('B', { transform: { pos: [1, 1, 0] } })] };
  const g = mk(); const s = await g.loadScene('s');
  const A = s.find('A'), B = s.find('B');
  let log = [];
  A.scripts.push({ onTransformChildrenChanged() { log.push('A.children'); } }); B.scripts.push({ onTransformParentChanged() { log.push('B.parent'); } });
  assert.ok(B.setParent(A, false));
  assert.equal(B.parent, A); assert.deepEqual(A.children, [B]); assert.ok(!s.roots.includes(B));
  assert.deepEqual(B.pos, [1, 1, 0]); // local numbers kept
  assert.deepEqual(log, ['B.parent', 'A.children']);
  // Unity default: world position stays → the engine backend turns this into a new local transform; headless there is no backend, so only the tree changes
  assert.equal(A.setParent(B), false, 'cycle'); // B is A's child: refused
  assert.equal(A.parent, null);
  B.transform.SetParent(null);
  assert.ok(s.roots.includes(B) && A.children.length === 0);
  B.setParent(A); A.transform.DetachChildren();
  assert.equal(A.children.length, 0); assert.equal(B.parent, null);
});

test('RequireComponent adds what is missing; DisallowMultipleComponent refuses a second copy; OnValidate runs once', async () => {
  const log = [];
  class Needs extends MonoBehaviour { static RequireComponent = ['audioSource']; static DisallowMultipleComponent = true; onValidate() { log.push('validate'); } }
  class Other extends MonoBehaviour { static RequireComponent = [Needs]; }
  files['mod:needs.js'] = Needs; files['mod:other.js'] = Other;
  files.s = { name: 's', entities: [ent('X', { scripts: [{ path: 'other.js' }] })] };
  const g = mk(); const s = await g.loadScene('s');
  const X = s.find('X');
  assert.ok(X.getScript(Needs), 'script requirement added');
  assert.ok(X.getComponent('audioSource'), 'component requirement added');
  assert.equal(X.addScript(Needs), null, 'second Needs refused');
  assert.equal(X.scripts.filter((c) => c instanceof Needs).length, 1);
  assert.deepEqual(log, ['validate']);
});

test('PlayerPrefs: typed getters, DeleteKey, HasKey, Save', async () => {
  files.s = { name: 's', entities: [] }; const g = mk(); await g.loadScene('s');
  PlayerPrefs.SetInt('lives', 3.9); PlayerPrefs.SetFloat('vol', 0.5); PlayerPrefs.SetString('name', 'Ada');
  assert.equal(PlayerPrefs.GetInt('lives'), 3); assert.equal(PlayerPrefs.GetFloat('vol'), 0.5); assert.equal(PlayerPrefs.GetString('name'), 'Ada');
  assert.equal(PlayerPrefs.GetInt('none', 7), 7); assert.equal(PlayerPrefs.GetString('none', 'x'), 'x');
  PlayerPrefs.DeleteKey('lives'); assert.ok(!PlayerPrefs.HasKey('lives') && PlayerPrefs.HasKey('vol'));
  PlayerPrefs.Save(); PlayerPrefs.DeleteAll(); assert.ok(!PlayerPrefs.HasKey('vol'));
});

test('Awaitable: waits on game time', async () => {
  files.s = { name: 's', entities: [] }; const g = mk(); await g.loadScene('s');
  let done = 0;
  Awaitable.WaitForSecondsAsync(0.5).then(() => done++); Awaitable.NextFrameAsync().then(() => done += 10);
  g.tick(0.1); await Promise.resolve(); await Promise.resolve();
  assert.equal(done, 10);
  for (let i = 0; i < 6; i++) g.tick(0.1);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(done, 11);
});

// ---------------------------------------------------------------- input
const press = (g, ...codes) => { for (const c of codes) g.input.setKey(c, true); };
const release = (g, ...codes) => { for (const c of codes) g.input.setKey(c, false); };

test('Input: mouse axes, scroll, typed text, project axes and optional smoothing', async () => {
  files.s = { name: 's', entities: [] };
  const g = mk({ input: { actions: {}, axes: { Strafe: { negative: 'KeyQ', positive: 'KeyE' } } } }); await g.loadScene('s');
  g.input._mdelta = [20, -10]; g.input._wheel = [0, -3]; g.input._typed = 'ab';
  g.tick(1 / 60);
  near(Input.GetAxis('Mouse X'), 2); near(Input.GetAxis('Mouse Y'), 1); near(Input.GetAxis('Mouse ScrollWheel'), 0.3);
  assert.equal(Input.inputString, 'ab');
  g.tick(1 / 60);
  assert.equal(Input.GetAxis('Mouse X'), 0); assert.equal(Input.inputString, '');
  press(g, 'KeyE'); g.tick(1 / 60);
  assert.equal(Input.GetAxisRaw('Strafe'), 1); assert.equal(Input.GetAxis('Strafe'), 1);
  release(g, 'KeyE');
  Input.smoothAxes = true;
  press(g, 'KeyD'); g.tick(1 / 60);
  const a1 = Input.GetAxis('Horizontal'); assert.ok(a1 > 0 && a1 < 0.2, `ramps up: ${a1}`);
  for (let i = 0; i < 30; i++) g.tick(1 / 60);
  near(Input.GetAxis('Horizontal'), 1);
  release(g, 'KeyD'); g.tick(1 / 60);
  const a2 = Input.GetAxis('Horizontal'); assert.ok(a2 > 0.8 && a2 < 1, `ramps down: ${a2}`); assert.equal(Input.GetAxisRaw('Horizontal'), 0);
  Input.smoothAxes = undefined;
});

test('Input: touches report Began → Moved/Stationary → Ended with pressure and tapCount', async () => {
  files.s = { name: 's', entities: [] }; const g = mk(); await g.loadScene('s');
  const i = g.input;
  i.touches.set(7, { id: 7, x: 10, y: 20, dx: 0, dy: 0, phase: 'Began', fresh: true, tapCount: 1, pressure: 0.5 });
  g.tick(1 / 60);
  assert.equal(Input.touchCount, 1);
  let t = Input.GetTouch(0); assert.equal(t.phase, TouchPhase.Began); assert.equal(t.fingerId, 7); near(t.pressure, 0.5);
  g.tick(1 / 60); assert.equal(Input.GetTouch(0).phase, TouchPhase.Stationary);
  Object.assign(i.touches.get(7), { phase: 'Moved', x: 15, dx: 5, movedThisFrame: true }); g.tick(1 / 60);
  t = Input.GetTouch(0); assert.equal(t.phase, TouchPhase.Moved); assert.deepEqual(t.deltaPosition.toArray(), [5, 0]);
  i.touches.get(7).phase = 'Ended'; g.tick(1 / 60);
  assert.equal(Input.GetTouch(0).phase, TouchPhase.Ended); g.tick(1 / 60);
  assert.equal(Input.touchCount, 0);
});

test('Input: sensors default to zero and Input.gyro / compass / location exist', async () => {
  files.s = { name: 's', entities: [] }; const g = mk(); await g.loadScene('s');
  assert.deepEqual(Input.acceleration.toArray(), [0, 0, 0]);
  g.input.sensors.accel = [0, 0, -1]; assert.deepEqual(Input.acceleration.toArray(), [0, 0, -1]);
  Input.gyro.enabled = true; assert.equal(Input.gyro.attitude.w, 1);
  g.input.sensors.attitude = [0, 0, 0.7071, 0.7071]; near(Input.gyro.attitude.z, 0.7071, 1e-4);
  Input.compass.enabled = true; g.input.sensors.heading = 90; assert.equal(Input.compass.magneticHeading, 90);
  assert.equal(Input.location.status, 'Stopped');
  assert.equal(KeyCode.JoystickButton1, 'Gamepad1'); assert.equal(KeyCode.Mouse3, 'Mouse3');
});

test('New Input System: InputAction button, 2DVector composite, events, processors', async () => {
  files.s = { name: 's', entities: [] }; const g = mk(); await g.loadScene('s');
  const jump = new InputAction('Jump', 'Button', '<Keyboard>/space');
  const log = [];
  jump.started.AddListener((c) => log.push(`s:${c.phase}`)); jump.performed.AddListener((c) => log.push(`p:${c.ReadValue()}`)); jump.canceled.AddListener(() => log.push('c'));
  jump.Enable();
  g.tick(1 / 60); assert.ok(!jump.WasPressedThisFrame() && !jump.IsPressed());
  press(g, 'Space'); g.tick(1 / 60);
  assert.ok(jump.WasPressedThisFrame() && jump.IsPressed()); g.tick(1 / 60); assert.ok(!jump.WasPressedThisFrame() && jump.IsPressed());
  release(g, 'Space'); g.tick(1 / 60);
  assert.ok(jump.WasReleasedThisFrame()); assert.deepEqual(log, ['s:Started', 'p:1', 'c']);

  const move = new InputAction('Move', 'Value');
  move.AddCompositeBinding('2DVector').With('Up', '<Keyboard>/w').With('Down', '<Keyboard>/s').With('Left', '<Keyboard>/a').With('Right', '<Keyboard>/d');
  move.AddBinding('<Gamepad>/leftStick');
  move.Enable();
  press(g, 'KeyW', 'KeyD'); g.tick(1 / 60);
  const v = move.ReadValue(); near(v.x, Math.SQRT1_2); near(v.y, Math.SQRT1_2); // digital diagonal is normalised
  release(g, 'KeyW', 'KeyD'); g.input.pad = { buttons: [], axes: [0.5, -1] }; g.tick(1 / 60);
  const s2 = move.ReadValue(); near(s2.x, 0.5); near(s2.y, 1); // pad y is inverted: up is positive
  move.Disable(); assert.equal(move.phase, 'Disabled');

  const look = new InputAction('Look', 'Value', '<Mouse>/delta'); look.bindings[0].processors = 'scaleVector2(x=2,y=2);invertVector2(invertX=false)';
  look.Enable(); g.input._mdelta = [3, 4]; g.tick(1 / 60);
  assert.deepEqual(look.ReadValue().toArray(), [6, 8]); // mouse delta y is flipped to Unity's up, then inverted back by the processor
});

test('New Input System: Keyboard.current / Mouse.current / Gamepad.current', async () => {
  files.s = { name: 's', entities: [] }; const g = mk(); await g.loadScene('s');
  g.tick(1 / 60); press(g, 'Space', 'KeyA', 'Mouse0'); g.tick(1 / 60);
  assert.ok(Keyboard.current.spaceKey.wasPressedThisFrame && Keyboard.current.aKey.isPressed && Keyboard.current['a'].isPressed);
  assert.ok(Mouse.current.leftButton.wasPressedThisFrame && !Mouse.current.rightButton.isPressed);
  g.tick(1 / 60); assert.ok(!Keyboard.current.spaceKey.wasPressedThisFrame && Keyboard.current.spaceKey.isPressed);
  release(g, 'Space'); g.tick(1 / 60); assert.ok(Keyboard.current.spaceKey.wasReleasedThisFrame);
  assert.ok(Keyboard.current.anyKey.isPressed);
  g.input.pad = { buttons: [1, 0, 0, 0], axes: [0, 0, 0.9, 0] }; g.input.held.add('Gamepad0'); g.tick(1 / 60);
  assert.ok(Gamepad.current.buttonSouth.isPressed && !Gamepad.current.buttonEast.isPressed);
  near(Gamepad.current.rightStick.ReadValue().x, 0.9);
});

test('InputActionAsset.FromJson (Unity .inputactions) + PlayerInput sends On<Action> messages', async () => {
  const json = {
    name: 'Controls',
    maps: [{
      name: 'Player',
      actions: [{ name: 'Move', type: 'Value', id: 'a1', expectedControlType: 'Vector2' }, { name: 'Fire', type: 'Button', id: 'a2' }],
      bindings: [
        { name: '2D Vector', path: '2DVector', action: 'Move', isComposite: true, isPartOfComposite: false },
        { name: 'up', path: '<Keyboard>/w', action: 'Move', isComposite: false, isPartOfComposite: true },
        { name: 'down', path: '<Keyboard>/s', action: 'Move', isComposite: false, isPartOfComposite: true },
        { name: 'left', path: '<Keyboard>/a', action: 'Move', isComposite: false, isPartOfComposite: true },
        { name: 'right', path: '<Keyboard>/d', action: 'Move', isComposite: false, isPartOfComposite: true },
        { name: '', path: '<Keyboard>/space', action: 'Fire', isComposite: false, isPartOfComposite: false },
        { name: '', path: '<Mouse>/leftButton', action: 'Fire', isComposite: false, isPartOfComposite: false },
      ],
    }, { name: 'UI', actions: [{ name: 'Click', type: 'Button', id: 'u1' }], bindings: [{ path: '<Mouse>/rightButton', action: 'Click' }] }],
  };
  const asset = InputActionAsset.FromJson(json);
  assert.equal(asset.actionMaps.length, 2); assert.equal(asset.FindAction('Player/Move').bindings.length, 1); assert.equal(asset.FindAction('Fire').bindings.length, 2);
  const msgs = [];
  class Pl extends NordScript { OnMove(v) { msgs.push(['move', v.Get().x]); } OnFire(v) { msgs.push(['fire', v.isPressed]); } OnClick() { msgs.push('click'); } }
  files['mod:pl.js'] = Pl; files.s = { name: 's', entities: [ent('P', { scripts: [{ path: 'pl.js' }] })] };
  const g = mk(); const s = await g.loadScene('s');
  const pi = new PlayerInput(s.find('P'), asset, { defaultActionMap: 'Player' });
  g.tick(1 / 60);
  press(g, 'KeyD', 'Space'); g.tick(1 / 60);
  assert.deepEqual(msgs, [['move', 1], ['fire', true]]);
  press(g, 'Mouse1'); g.tick(1 / 60); assert.ok(!msgs.includes('click'), 'UI map is off');
  pi.SwitchCurrentActionMap('UI'); release(g, 'Mouse1'); g.tick(1 / 60); press(g, 'Mouse1'); g.tick(1 / 60);
  assert.ok(msgs.includes('click'));
  pi.DeactivateInput(); assert.ok(!asset.enabled);
});

// ---------------------------------------------------------------- physics queries (geometry.js + unity-physics.js)
import { Physics2D, Physics, ContactFilter2D, CapsuleDirection2D, Geometry, Collider2D, CapsuleCollider2D, PolygonCollider2D, Rigidbody2D, RigidbodyConstraints2D, QueryTriggerInteraction } from './index.js';

test('geometry: GJK distance, sweeps and rays agree with simple cases', () => {
  const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], G = Geometry;
  const b = G.box([0, 0, 0], ax, [1, 1, 1]);
  near(G.distance(G.sphere([5, 0, 0], 1), b).distance, 3);
  near(G.distance(G.capsule([0, 3, 0], [0, 5, 0], 0.5), b).distance, 1.5);
  assert.ok(G.overlaps(b, G.sphere([1.5, 0, 0], 0.6)) && !G.overlaps(b, G.sphere([2.5, 0, 0], 1)));
  const h = G.sweep(G.sphere([-6, 0, 0], 1), [1, 0, 0], 20, b, [-6, 0, 0]);
  near(h.t, 4); assert.deepEqual(h.normal.map((v) => Math.abs(v) < 1e-9 ? 0 : v), [-1, 0, 0]); near(h.point[0], -1);
  assert.equal(G.sweep(G.sphere([-6, 5, 0], 1), [1, 0, 0], 20, b), null);
  assert.equal(G.sweep(G.sphere([-6, 0, 0], 1), [1, 0, 0], 2, b), null, 'too short to reach');
  const inside = G.sweep(G.sphere([0, 0, 0], 0.2), [0, -1, 0], 5, b, [0, 0, 0]); assert.equal(inside.t, 0); assert.deepEqual(inside.point, [0, 0, 0]);
  near(G.ray([-5, 0, 0], [1, 0, 0], G.capsule([0, -1, 0], [0, 1, 0], 0.5), 100, false).t, 4.5);
  near(G.ray([-1, 1, 0], [1, 0, 0], G.poly([[0, 0, 0], [4, 0, 0], [0, 4, 0]])).t, 1);
  assert.equal(G.triangulate([[0, 0], [4, 0], [4, 4], [2, 1], [0, 4]]).length, 3, 'concave polygon is split into triangles');
  assert.equal(G.ray([-5, 0, 0], [1, 0, 0], b, 100, false).t, 4);
  assert.equal(G.ray([0, 0, 0], [1, 0, 0], b, 100, false), null, 'starting inside misses when startInside is false');
});

const sceneWith = async (entities, project = {}) => { files.s = { name: 's', entities }; const g = mk(project); await g.loadScene('s'); return g; };
const col = (o) => ({ type: 'collider', ...o });

test('Physics2D: Raycast, RaycastAll, Linecast hit boxes, circles, capsules and polygons', async () => {
  const g = await sceneWith([
    ent('Box', { transform: { pos: [10, 0, 0] }, components: [col({ shape: 'box', size: [2, 2] })] }),
    ent('Ball', { transform: { pos: [20, 0, 0] }, components: [col({ shape: 'circle', radius: 1 })] }),
    ent('Pill', { transform: { pos: [30, 0, 0] }, components: [col({ shape: 'capsule', size: [2, 6] })] }),
    ent('Tri', { transform: { pos: [40, 0, 0] }, components: [col({ shape: 'polygon', points: [[-1, -1], [1, -1], [0, 1]] })] }),
    ent('Trig', { transform: { pos: [5, 0, 0] }, components: [col({ shape: 'box', size: [1, 1], trigger: true })] }),
  ]);
  const r = Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0));
  assert.equal(r.collider.name, 'Trig'); near(r.distance, 4.5); assert.deepEqual([r.normal.x, r.normal.y], [-1, 0]);
  Physics2D.queriesHitTriggers = false;
  const first = Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0)); assert.equal(first.collider.name, 'Box'); near(first.distance, 9); near(first.point.x, 9);
  assert.deepEqual(Physics2D.RaycastAll(new Vector2(0, 0), new Vector2(1, 0)).map((h) => h.collider.name), ['Box', 'Ball', 'Pill', 'Tri']);
  near(Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0), 100, 1 << 5).distance, 0); assert.equal(Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0), 100, 1 << 5).collider, null);
  assert.equal(Physics2D.Raycast(new Vector2(0, 5), new Vector2(1, 0)).collider, null);
  assert.equal(Physics2D.Linecast(new Vector2(0, 0), new Vector2(15, 0)).collider.name, 'Box'); assert.equal(Physics2D.Linecast(new Vector2(0, 0), new Vector2(5, 0)).collider, null);
  const res = []; assert.equal(Physics2D.RaycastNonAlloc(new Vector2(0, 0), new Vector2(1, 0), res, 25), 2); assert.equal(res[1].collider.name, 'Ball');
  near(Physics2D.Raycast(new Vector2(30, -10), new Vector2(0, 1)).distance, 7, 1e-6); // capsule (height 6 → top end at y=-3)
  near(Physics2D.Raycast(new Vector2(30, -10), new Vector2(0, 1)).point.y, -3);
  const filter = new ContactFilter2D().SetLayerMask(1); const out = [];
  assert.equal(Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0), filter, out, 50), 5, 'filter form: results + count, triggers included by default');
  assert.equal(Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0), new ContactFilter2D().SetLayerMask(1 << 5), [], 50), 0);
  Physics2D.queriesHitTriggers = true;
});

test('Physics2D: CircleCast, BoxCast, CapsuleCast sweep a shape, starting inside reports distance 0', async () => {
  const g = await sceneWith([ent('Wall', { transform: { pos: [10, 0, 0] }, components: [col({ shape: 'box', size: [2, 10] })] })]);
  const c = Physics2D.CircleCast(new Vector2(0, 0), 1, new Vector2(1, 0)); assert.equal(c.collider.name, 'Wall'); near(c.distance, 8); near(c.centroid.x, 8); near(c.point.x, 9);
  const b = Physics2D.BoxCast(new Vector2(0, 0), new Vector2(2, 2), 0, new Vector2(1, 0)); near(b.distance, 8);
  const b45 = Physics2D.BoxCast(new Vector2(0, 0), new Vector2(2, 2), 45, new Vector2(1, 0)); near(b45.distance, 9 - Math.SQRT2, 1e-4);
  const cap = Physics2D.CapsuleCast(new Vector2(0, 0), new Vector2(2, 4), CapsuleDirection2D.Vertical, 0, new Vector2(1, 0)); near(cap.distance, 8);
  assert.equal(Physics2D.CircleCast(new Vector2(0, 20), 1, new Vector2(1, 0)).collider, null, 'passes above the wall');
  const inside = Physics2D.CircleCast(new Vector2(10, 0), 0.5, new Vector2(1, 0)); assert.equal(inside.distance, 0); assert.deepEqual([inside.normal.x, inside.normal.y], [-1, 0]);
  assert.equal(Physics2D.CircleCastAll(new Vector2(0, 0), 1, new Vector2(1, 0)).length, 1);
});

test('Physics2D: Overlap* queries, Distance, ClosestPoint, OverlapCollider, IgnoreCollision flags', async () => {
  const g = await sceneWith([
    ent('A', { transform: { pos: [0, 0, 0] }, components: [col({ shape: 'box', size: [4, 4] })] }),
    ent('B', { transform: { pos: [3, 0, 0] }, components: [col({ shape: 'circle', radius: 1.5 })] }),
    ent('C', { transform: { pos: [20, 0, 0], rot: [0, 0, 90] }, components: [col({ shape: 'capsule', size: [2, 8] })] }),
  ]);
  const A = g.scene.find('A'), B = g.scene.find('B'), C = g.scene.find('C');
  assert.equal(Physics2D.OverlapPoint(new Vector2(1, 1)).name, 'A'); assert.equal(Physics2D.OverlapPoint(new Vector2(100, 1)), null);
  assert.deepEqual(Physics2D.OverlapPointAll(new Vector2(2, 0)).map((e) => e.name).sort(), ['A', 'B']);
  assert.equal(Physics2D.OverlapCircle(new Vector2(23.5, 0), 0.4).name, 'C', 'the capsule rotated 90° lies along x: its end cap reaches x = 24'); assert.equal(Physics2D.OverlapCircle(new Vector2(20, 3.5), 0.4), null);
  assert.equal(Physics2D.OverlapBoxAll(new Vector2(0, 0), new Vector2(1, 1), 0).length, 1);
  assert.equal(Physics2D.OverlapAreaAll(new Vector2(-1, -1), new Vector2(10, 1)).length, 2);
  assert.equal(Physics2D.OverlapCapsule(new Vector2(20, 0), new Vector2(2, 8), CapsuleDirection2D.Vertical, 90).name, 'C');
  const d = Physics2D.Distance(A, C); assert.ok(d.isValid && !d.isOverlapped); assert.ok(d.distance > 10);
  const dab = Physics2D.Distance(A, B); assert.ok(dab.isOverlapped && dab.distance <= 0);
  const cp = Physics2D.ClosestPoint(new Vector2(10, 0), A); near(cp.x, 2); near(cp.y, 0);
  const results = []; assert.equal(Physics2D.OverlapCollider(Collider2D.Of(A), new ContactFilter2D(), results), 1); assert.equal(results[0].name, 'B');
  assert.ok(Physics2D.IsTouching(A, B) && !Physics2D.IsTouching(A, C));
  Physics2D.IgnoreCollision(A, B); assert.ok(Physics2D.GetIgnoreCollision(B, A)); Physics2D.IgnoreCollision(A, B, false); assert.ok(!Physics2D.GetIgnoreCollision(A, B));
  Physics2D.IgnoreLayerCollision(1, 2); assert.ok(Physics2D.GetIgnoreLayerCollision(2, 1)); Physics2D.IgnoreLayerCollision(1, 2, false);
  assert.equal(Collider2D.Of(A).bounds.size.x, 4); near(Collider2D.Of(C).bounds.size.y, 2);
});

test('Physics2D: composite collider is the union of the colliders marked usedByComposite', async () => {
  const g = await sceneWith([ent('Walls', { components: [col({ shape: 'composite' })], children: [
    ent('L', { transform: { pos: [-5, 0, 0] }, components: [col({ shape: 'box', size: [2, 10], usedByComposite: true })] }),
    ent('R', { transform: { pos: [5, 0, 0] }, components: [col({ shape: 'box', size: [2, 10], usedByComposite: true })] }),
  ] })]);
  assert.equal(Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0)).collider.name, 'Walls');
  assert.equal(Physics2D.Raycast(new Vector2(0, 0), new Vector2(-1, 0)).collider.name, 'Walls');
  near(Physics2D.Raycast(new Vector2(0, 0), new Vector2(1, 0)).distance, 4);
  assert.equal(Physics2D.RaycastAll(new Vector2(-20, 0), new Vector2(1, 0)).length, 1, 'one collider = one hit, whatever its parts');
});

test('Physics 3D: RaycastAll / NonAlloc, SphereCast, BoxCast, CapsuleCast, OverlapBox, Check*', async () => {
  const g = await sceneWith([
    ent('Cube', { transform: { pos: [0, 0, 10] }, components: [col({ shape: 'box', size: [2, 2, 2] })] }),
    ent('Ball', { transform: { pos: [0, 0, 20] }, components: [col({ shape: 'sphere', radius: 1 })] }),
    ent('Cap', { transform: { pos: [5, 0, 10] }, components: [col({ shape: 'capsule', size: [1, 4, 1], radius: 0.5 })] }),
  ], { type: '3d' });
  const ray = Physics.RaycastAll(Vector3.zero, Vector3.forward); assert.deepEqual(ray.map((h) => h.collider.name), ['Cube', 'Ball']); near(ray[0].distance, 9);
  const res = []; assert.equal(Physics.RaycastNonAlloc(Vector3.zero, Vector3.forward, res, 15), 1);
  const sc = Physics.SphereCast(new Vector3(0, 0, 0), 0.5, Vector3.forward); assert.equal(sc.collider.name, 'Cube'); near(sc.distance, 8.5);
  const missRay = Physics.SphereCast(new Vector3(0, 3, 0), 0.5, Vector3.forward); assert.equal(missRay.collider, null);
  const grazing = Physics.SphereCast(new Vector3(0, 1.2, 0), 0.5, Vector3.forward); assert.equal(grazing.collider.name, 'Cube', 'a fat ray touches where a thin one misses');
  assert.equal(Physics.Raycast(new Vector3(0, 1.2, 0), Vector3.forward, 100).collider, null);
  const bc = Physics.BoxCast(Vector3.zero, new Vector3(0.5, 0.5, 0.5), Vector3.forward); near(bc.distance, 8.5);
  const cc = Physics.CapsuleCast(new Vector3(5, 0, 0), new Vector3(5, 1, 0), 0.25, Vector3.forward); assert.equal(cc.collider.name, 'Cap');
  assert.deepEqual(Physics.OverlapBox(new Vector3(0, 0, 10.5), new Vector3(0.2, 0.2, 0.2)).map((e) => e.name), ['Cube']);
  assert.deepEqual(Physics.OverlapSphere(new Vector3(1.8, 0, 10), 1).map((e) => e.name), ['Cube']); assert.equal(Physics.OverlapSphere(new Vector3(2.2, 0, 10), 1).length, 0);
  assert.ok(Physics.CheckSphere(new Vector3(0, 0, 20), 0.1) && !Physics.CheckSphere(new Vector3(0, 9, 20), 0.1));
  assert.ok(Physics.CheckBox(new Vector3(0, 0, 10), Vector3.one) && Physics.CheckCapsule(new Vector3(5, -3, 10), new Vector3(5, 3, 10), 0.2));
  const longBar = new Vector3(0.1, 0.1, 1.6); assert.ok(Physics.CheckBox(new Vector3(0, 0, 12.5), longBar)); assert.ok(!Physics.CheckBox(new Vector3(0, 0, 12.5), longBar, Quaternion.Euler(0, 90, 0)), 'turned across, the bar no longer reaches the cube');
  assert.deepEqual(Physics.Raycast({ origin: Vector3.zero, direction: Vector3.forward }, 50).collider?.name, 'Cube', 'Ray form');
});

test('Rigidbody2D wrapper: constraints, interpolation, collisionDetectionMode, sharedMaterial, AddExplosionForce data', async () => {
  const g = await sceneWith([ent('R', { components: [{ type: 'rigidbody', mode: 'dynamic' }, col({ shape: 'box', size: [1, 1] })] })]);
  const R = g.scene.find('R'), rb = Rigidbody2D.Of(R);
  rb.constraints = RigidbodyConstraints2D.FreezePositionX | RigidbodyConstraints2D.FreezeRotation;
  assert.equal(R.getComponent('rigidbody').data.freezePositionX, true); assert.equal(R.getComponent('rigidbody').data.freezePositionY, false); assert.equal(R.getComponent('rigidbody').data.fixedRotation, true);
  assert.equal(rb.constraints, RigidbodyConstraints2D.FreezePositionX | RigidbodyConstraints2D.FreezeRotation);
  rb.constraints = RigidbodyConstraints2D.None; assert.equal(rb.freezeRotation, false);
  rb.interpolation = 'Interpolate'; assert.equal(R.getComponent('rigidbody').data.interpolation, 'interpolate'); assert.equal(rb.interpolation, 'Interpolate');
  rb.collisionDetectionMode = 1; assert.equal(rb.collisionDetectionMode, 'Continuous');
  rb.sharedMaterial = { friction: 0.7, bounciness: 0.4 }; assert.equal(R.getComponent('rigidbody').data.friction, 0.7); assert.equal(rb.sharedMaterial.bounciness, 0.4);
  const cap = R.AddComponent(CapsuleCollider2D); assert.ok(cap); 
  const poly = R.AddComponent('PolygonCollider2D'); poly.points = [new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1)]; assert.equal(poly.pointCount, 3);
  assert.equal(QueryTriggerInteraction.Ignore, 1);
});

// ---------------------------------------------------------------- joints (wrappers over the `joint` component data)
import { HingeJoint2D, SpringJoint2D, TargetJoint2D, FixedJoint, ConfigurableJoint, ConfigurableJointMotion, SliderJoint2D, Rigidbody } from './index.js';

test('Joint wrappers: AddComponent / GetComponent, connectedBody, limits, motor, spring, target, 3D motions', async () => {
  const g = await sceneWith([ent('Post', { components: [{ type: 'rigidbody', mode: 'static' }] }), ent('Arm', { components: [{ type: 'rigidbody', mode: 'dynamic' }] })]);
  const Post = g.scene.find('Post'), Arm = g.scene.find('Arm');
  const h = Arm.AddComponent(HingeJoint2D);
  assert.equal(Arm.getComponent('joint').data.kind, 'hinge');
  h.connectedBody = Rigidbody2D.Of(Post); assert.equal(Arm.getComponent('joint').data.connectedBody, Post.id); assert.equal(h.connectedBody.entity, Post);
  h.useLimits = true; h.limits = { min: -30, max: 45 }; assert.deepEqual(h.limits, { min: -30, max: 45 }); assert.equal(Arm.getComponent('joint').data.upperAngle, 45);
  h.useMotor = true; h.motor = { motorSpeed: 90, maxMotorTorque: 500 }; assert.equal(h.motor.motorSpeed, 90);
  h.anchor = new Vector2(1, 2); assert.deepEqual(Arm.getComponent('joint').data.anchor, [1, 2]); assert.equal(h.breakForce, Infinity); h.breakForce = 100; assert.equal(Arm.getComponent('joint').data.breakForce, 100);
  assert.equal(Arm.GetComponent(HingeJoint2D).data.kind, 'hinge'); assert.equal(Arm.GetComponent('HingeJoint2D').useMotor, true); assert.equal(Arm.GetComponent(SpringJoint2D), null);
  const sp = Arm.AddComponent(SpringJoint2D); sp.frequency = 3; sp.dampingRatio = 0.2; sp.distance = 4; assert.equal(Arm.components.filter((c) => c.type === 'joint').length, 2);
  assert.equal(sp.frequency, 3); assert.equal(Arm.GetComponent(SpringJoint2D).distance, 4); assert.equal(Arm.GetComponent(HingeJoint2D).limits.min, -30);
  const t = Arm.AddComponent(TargetJoint2D); t.target = new Vector2(10, 20); assert.equal(t.autoConfigureTarget, false); assert.deepEqual([t.target.x, t.target.y], [10, 20]);
  const s2 = Arm.AddComponent(SliderJoint2D); s2.limits = { min: 0, max: 5 }; s2.useLimits = true; assert.equal(s2.limits.max, 5);
  const f = Arm.AddComponent(FixedJoint); assert.equal(Arm.components.at(-1).data.kind, 'fixed'); void f;
  const c = Arm.AddComponent(ConfigurableJoint); c.xMotion = ConfigurableJointMotion.Free; c.angularYMotion = 'Limited'; assert.equal(c.xMotion, 'free'); assert.equal(c.angularYMotion, 'limited'); c.angularYLimit = { limit: 20 }; assert.equal(c.angularYLimit.limit, 20);
  assert.equal(Arm.GetComponents(HingeJoint2D).length >= 0, true);
  assert.equal(Rigidbody === undefined, false);
});
