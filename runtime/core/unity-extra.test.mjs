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
