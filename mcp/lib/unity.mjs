// Read-only helpers that inventory a Unity project (or a single C# file) so an AI can convert it to Nord.
// They never modify the Unity folder. unity_scene_to_nord only writes a Nord scene inside the open Nord project.
// Keep docs/MCP.md in sync (node mcp/nord-mcp.mjs --docs).
import fs from 'node:fs';
import path from 'node:path';

const obj = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const SKIP = /(^|\/)(Library|Temp|obj|Logs|\.git|node_modules)(\/|$)/;

function walk(dir, out = [], root = dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name), r = path.relative(root, f).split(path.sep).join('/');
    if (SKIP.test(r)) continue;
    if (e.isDirectory()) walk(f, out, root); else out.push(r);
  }
  return out;
}

/** Outline of a C# file: classes, base types, fields, lifecycle methods and the Unity APIs it uses. */
export function csOutline(src) {
  const classes = [];
  const re = /(?:public|internal|abstract|sealed|static|partial|\s)*\b(class|struct|interface|enum)\s+(\w+)\s*(?::\s*([\w\s,.<>]+))?\s*\{/g;
  for (let m; (m = re.exec(src));) classes.push({ kind: m[1], name: m[2], bases: (m[3] || '').split(',').map((s) => s.trim()).filter(Boolean) });
  const LIFE = ['Awake', 'OnEnable', 'Start', 'Update', 'FixedUpdate', 'LateUpdate', 'OnDisable', 'OnDestroy', 'OnTriggerEnter2D', 'OnTriggerExit2D', 'OnTriggerStay2D', 'OnCollisionEnter2D', 'OnCollisionExit2D', 'OnTriggerEnter', 'OnTriggerExit', 'OnCollisionEnter', 'OnCollisionExit', 'OnMouseDown', 'OnMouseUp', 'OnBecameVisible', 'OnBecameInvisible', 'OnGUI', 'OnValidate', 'Reset', 'OnApplicationQuit', 'OnDrawGizmos', 'OnDrawGizmosSelected'];
  const lifecycle = LIFE.filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(src) && new RegExp(`(void|IEnumerator)\\s+${n}\\s*\\(`).test(src));
  const fields = [];
  const fre = /((?:\[[^\]]+\]\s*)*)\b(public|private|protected|internal)?\s*(?:static\s+)?(?:readonly\s+)?([\w<>\[\],.?]+)\s+(\w+)\s*(?:=\s*([^;]+))?;/g;
  for (let m; (m = fre.exec(src));) {
    const attrs = m[1] || '', vis = m[2] || 'private';
    if (/^(return|using|new|var|else|throw|yield)$/.test(m[3]) || /\(/.test(m[4])) continue;
    const serialized = (vis === 'public' && !/NonSerialized|HideInInspector/.test(attrs)) || /SerializeField/.test(attrs);
    if (serialized) fields.push({ name: m[4], type: m[3], default: m[5]?.trim() ?? null, header: /Header\("([^"]+)"/.exec(attrs)?.[1] ?? null, range: /Range\(([^)]+)\)/.exec(attrs)?.[1] ?? null });
  }
  const coroutines = [...src.matchAll(/IEnumerator\s+(\w+)\s*\(/g)].map((m) => m[1]);
  const apis = new Set();
  for (const [name, re2] of Object.entries({
    input: /\bInput\.(GetAxis|GetButton|GetKey|GetMouse|touch|mousePosition)/, newInput: /UnityEngine\.InputSystem|PlayerInput|InputAction/, physics: /\bRigidbody2?D?\b|Physics2?D?\.|AddForce|OverlapCircle|Raycast/,
    ui: /UnityEngine\.UI|TMPro|TextMeshPro|\bCanvas\b|\bButton\b/, audio: /AudioSource|AudioClip|AudioMixer/, animation: /\bAnimator\b|SetTrigger|SetBool|SetFloat/, scene: /SceneManager|LoadScene/, prefs: /PlayerPrefs/,
    coroutine: /StartCoroutine|IEnumerator|WaitForSeconds/, instantiate: /\bInstantiate\s*\(|\bDestroy\s*\(/, scriptable: /ScriptableObject|CreateAssetMenu/, events: /UnityEvent|\bevent\s+Action|\bAction</, singleton: /static\s+\w+\s+(Instance|instance)/,
    cinemachine: /Cinemachine/, navmesh: /NavMesh/, networking: /Mirror|Netcode|PhotonNetwork|NetworkBehaviour/, tilemap: /Tilemap|TileBase/, particles: /ParticleSystem/, async: /\basync\b|\bawait\b|UniTask/, editor: /UnityEditor|#if UNITY_EDITOR/, shader: /Shader\.|Material\b|\.material\b/,
  })) if (re2.test(src)) apis.add(name);
  return { classes, lifecycle, fields, coroutines, apis: [...apis], lines: src.split('\n').length };
}

/** Minimal Unity YAML reader: documents separated by `--- !u!<classId> &<fileId>`, flat `key: value` and `{a: 1, b: 2}` values. */
export function parseUnityYaml(text) {
  const docs = [];
  for (const chunk of text.split(/^--- !u!(\d+) &(\d+)[^\n]*\n/m).slice(1).reduce((a, v, i, arr) => (i % 3 === 0 ? [...a, { classId: +v, fileId: arr[i + 1], body: arr[i + 2] }] : a), [])) {
    const lines = chunk.body.split('\n'), type = (lines[0] || '').replace(/:$/, '').trim(), props = {};
    const stack = [{ indent: -1, o: props }];
    let listKey = null;
    for (const raw of lines.slice(1)) {
      if (!raw.trim() || raw.trim().startsWith('#')) continue;
      const indent = raw.length - raw.trimStart().length, t = raw.trim();
      if (t.startsWith('- ')) {
        const holder = stack.at(-1).o, k = listKey;
        if (k && Array.isArray(holder[k])) { const v = t.slice(2), kv = /^([\w.]+):\s*(\{.*\})$/.exec(v); holder[k].push(kv ? { [kv[1]]: parseInline(kv[2]) } : (parseInline(v) ?? v)); }
        continue;
      }
      const m = /^([^:]+):\s*(.*)$/.exec(t);
      if (!m) continue;
      while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
      const [, k, v] = m, holder = stack.at(-1).o;
      if (v === '') { holder[k] = []; listKey = k; if (indent >= 0) stack.push({ indent, o: holder, k }); stack.pop(); } else { holder[k] = parseInline(v) ?? v; listKey = null; }
    }
    docs.push({ classId: chunk.classId, fileId: chunk.fileId, type, props });
  }
  return docs;
}
function parseInline(v) {
  v = v.trim();
  if (v === '[]') return [];
  if (v.startsWith('{') && v.endsWith('}')) {
    const o = {}; let depth = 0, cur = '', parts = [];
    for (const ch of v.slice(1, -1)) { if (ch === '{') depth++; if (ch === '}') depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; }
    if (cur.trim()) parts.push(cur);
    for (const p of parts) { const i = p.indexOf(':'); if (i < 0) continue; const key = p.slice(0, i).trim(), val = p.slice(i + 1).trim(); o[key] = parseInline(val) ?? val; }
    return o;
  }
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v) && v.replace(/\D/g, '').length < 16) return Number(v);
  return undefined;
}

const guidOf = (meta) => /guid:\s*([0-9a-f]{32})/.exec(meta)?.[1];

function buildGuidMap(root) {
  const map = new Map();
  for (const f of walk(root)) if (f.endsWith('.meta')) { const g = guidOf(fs.readFileSync(path.join(root, f), 'utf8')); if (g) map.set(g, f.slice(0, -5)); }
  return map;
}

export function unityTools(ctx) {
  const T = [];
  const tool = (name, description, inputSchema, handler) => T.push({ name, description, inputSchema, handler, group: 'project' });
  const unityRoot = (p) => {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) throw new Error(`${p} does not exist`);
    return abs;
  };

  tool('unity_scan', 'Read-only inventory of a Unity project folder (the one with Assets/ and ProjectSettings/): Unity version, packages, scenes in build order, prefabs, every C# script with classes/base types/serialized fields/lifecycle/Unity APIs used, assets by type, tags, layers, input axes, physics gravity. Use it FIRST when converting a Unity project; then read the nord_guide topic "ex-unity-conversion". Never modifies the Unity folder.', obj({ path: { type: 'string', description: 'Absolute path of the Unity project folder' } }, ['path']), ({ path: p }) => {
    const root = unityRoot(p), files = walk(root);
    const read = (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } };
    const ver = /m_EditorVersion:\s*(\S+)/.exec(read('ProjectSettings/ProjectVersion.txt'))?.[1] ?? 'unknown';
    let packages = {}; try { packages = JSON.parse(read('Packages/manifest.json')).dependencies ?? {}; } catch { /* none */ }
    const byExt = {}; for (const f of files) if (f.startsWith('Assets/') && !f.endsWith('.meta')) { const e = path.extname(f).slice(1).toLowerCase() || '(none)'; byExt[e] = (byExt[e] || 0) + 1; }
    const tm = read('ProjectSettings/TagManager.asset');
    const tags = [...(/tags:\n((?:\s*- .*\n)*)/.exec(tm)?.[1] ?? '').matchAll(/- (.+)/g)].map((m) => m[1].trim());
    const layers = (/layers:\n((?:\s*-.*\n)*)/.exec(tm)?.[1] ?? '').split('\n').filter((l) => l.trim().startsWith('-')).map((l, i) => [i, l.replace(/^\s*-\s*/, '').trim()]).filter(([, n]) => n);
    const axes = [...read('ProjectSettings/InputManager.asset').matchAll(/m_Name:\s*(.+)/g)].map((m) => m[1].trim());
    const grav = /m_Gravity:\s*(\{[^}]*\})/.exec(read('ProjectSettings/Physics2DSettings.asset'))?.[1] ?? null;
    const inBuild = [...read('ProjectSettings/EditorBuildSettings.asset').matchAll(/path:\s*(\S+\.unity)/g)].map((m) => m[1]);
    const scripts = files.filter((f) => f.startsWith('Assets/') && f.endsWith('.cs') && !/(^|\/)(Editor|Plugins|ThirdParty|TextMesh Pro)(\/|$)/.test(f)).map((f) => ({ file: f, ...csOutline(read(f)) }));
    const apis = {}; for (const s of scripts) for (const a of s.apis) apis[a] = (apis[a] || 0) + 1;
    const out = {
      unityVersion: ver, packages, scenes: files.filter((f) => f.endsWith('.unity')), buildScenes: inBuild, prefabs: files.filter((f) => f.endsWith('.prefab')), scriptableObjectAssets: files.filter((f) => f.endsWith('.asset') && f.startsWith('Assets/')),
      assetCounts: byExt, tags, layers: Object.fromEntries(layers), inputAxes: [...new Set(axes)], physics2dGravity: grav, scriptCount: scripts.length, unityApiUsage: apis, scripts,
      hints: [
        packages['com.unity.cinemachine'] ? 'Cinemachine: use the camera follow/shake from the library, see ex-unity-packages.' : null,
        packages['com.unity.inputsystem'] ? 'New Input System: map actions to game.input.actions, see ex-input-movement.' : null,
        apis.networking ? 'Networking code found: Nord has its own multiplayer (ex-multiplayer), rewrite do not port.' : null,
        apis.navmesh ? 'NavMesh found: use the navigation library scripts, see ex-3d-controllers.' : null,
        apis.editor ? 'UnityEditor code found: editor scripts are NOT converted, drop them.' : null,
      ].filter(Boolean),
    };
    return JSON.stringify(out, null, 2);
  });

  tool('unity_cs_outline', 'Outline of one C# file (or pasted C# source): classes, base types, [SerializeField]/public fields with defaults, lifecycle methods, coroutines and which Unity systems it touches. Use it before rewriting a script as a Nord script.', obj({ path: { type: 'string', description: 'Absolute path of a .cs file' }, source: { type: 'string', description: 'C# source text instead of a path' } }), ({ path: p, source }) => {
    if (!p && !source) throw new Error('Give path or source');
    return JSON.stringify(csOutline(source ?? fs.readFileSync(unityRoot(p), 'utf8')), null, 2);
  });

  tool('unity_scene_to_nord', 'Convert a Unity .unity scene or .prefab (text YAML) into a Nord scene/prefab skeleton: GameObjects become entities with the hierarchy, position/rotation/scale, tag, layer, active flag, sprite/camera components, colliders (box, circle, capsule, composite; 3D box, sphere, capsule), Rigidbody / Rigidbody2D with constraints, interpolation and collision detection, 2D and 3D joints (hinge, spring, distance, fixed, slider, wheel, target, relative, friction, character, configurable), LineRenderer, TrailRenderer, SpriteMask, and scripts whose GUID resolves to a .cs file become script references with the serialized values. Unity units are converted: 2D positions to pixels (y flipped; default 100 px per unit, set pixelsPerUnit). Conservative: anything it cannot map is listed in "todo". Writes a Nord file in the open project only when out is given (never overwrites); otherwise returns the JSON. Review the result, then finish by hand with scene_update_entity.', obj({ unityProject: { type: 'string', description: 'Absolute path of the Unity project folder' }, file: { type: 'string', description: 'Path of the .unity/.prefab file relative to the Unity project, e.g. Assets/Scenes/Main.unity' }, pixelsPerUnit: { type: 'number', description: 'Pixels per Unity unit for 2D (default 100)' }, out: { type: 'string', description: 'Nord project path to write, e.g. scenes/main.scene.json' } }, ['unityProject', 'file']), ({ unityProject, file, pixelsPerUnit = 100, out }) => {
    const root = unityRoot(unityProject), abs = path.resolve(root, file);
    if (!abs.startsWith(root + path.sep) || !/\.(unity|prefab)$/.test(abs)) throw new Error('file must be a .unity or .prefab inside the Unity project');
    const docs = parseUnityYaml(fs.readFileSync(abs, 'utf8')), byId = new Map(docs.map((d) => [d.fileId, d])), guids = buildGuidMap(root), todo = [];
    const ppu = pixelsPerUnit, isPrefabFile = abs.endsWith('.prefab'), joints = [], entByGo = new Map();
    const gos = docs.filter((d) => d.classId === 1);
    const transformOf = (go) => (go.props.m_Component || []).map((c) => byId.get(String(c.component?.fileID ?? /fileID:\s*(\d+)/.exec(String(c))?.[1]))).find((d) => d && (d.classId === 4 || d.classId === 224));
    const tOf = new Map(gos.map((g) => [g.fileId, transformOf(g)]));
    const goOfTransform = new Map([...tOf].filter(([, t]) => t).map(([gid, t]) => [t.fileId, gid]));
    const num = (v, d = 0) => (typeof v === 'number' ? v : d);
    const quatToEulerZ = (q) => Math.round(((Math.atan2(2 * (num(q.w, 1) * num(q.z) + num(q.x) * num(q.y)), 1 - 2 * (num(q.y) ** 2 + num(q.z) ** 2)) * 180) / Math.PI) * 100) / 100;
    const quatToEuler = (q) => {
      const x = num(q.x), y = num(q.y), z = num(q.z), w = num(q.w, 1), d = 180 / Math.PI, r = (n) => Math.round(n * d * 100) / 100;
      return [r(Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))), r(Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x))))), r(Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)))];
    };
    const comps = (go) => (go.props.m_Component || []).map((c) => byId.get(String(c.component?.fileID ?? ''))).filter(Boolean);
    const is2d = docs.some((d) => [212, 50, 61, 58, 60, 70, 66, 68, 231, 232, 233, 234, 235, 254, 255, 256, 257].includes(d.classId) || (d.classId === 20 && d.props.orthographic === 1));
    let n = 0; const nextId = () => 'e' + (++n);
    const build = (go) => {
      const t = tOf.get(go.fileId), lp = t?.props.m_LocalPosition ?? {}, ls = t?.props.m_LocalScale ?? {}, lr = t?.props.m_LocalRotation ?? {};
      const e = { id: nextId(), name: String(go.props.m_Name ?? 'GameObject'), enabled: go.props.m_IsActive !== 0, tags: go.props.m_TagString && !['Untagged'].includes(go.props.m_TagString) ? [String(go.props.m_TagString)] : [], layer: num(go.props.m_Layer), transform: is2d ? { pos: [Math.round(num(lp.x) * ppu * 100) / 100, Math.round(-num(lp.y) * ppu * 100) / 100, 0], rot: [0, 0, -quatToEulerZ(lr)], scale: [num(ls.x, 1), num(ls.y, 1), 1] } : { pos: [num(lp.x), num(lp.y), num(lp.z)], rot: quatToEuler(lr), scale: [num(ls.x, 1), num(ls.y, 1), num(ls.z, 1)] }, components: [], scripts: [], children: [], prefab: null };
      for (const c of comps(go)) {
        const p = c.props;
        switch (c.classId) {
          case 4: case 224: break;
          case 212: { const g = p.m_Sprite?.guid, tex = g ? guids.get(g) : null; const col = p.m_Color ?? {}; e.components.push({ type: 'sprite', texture: tex ? 'assets/' + path.basename(tex) : '', tint: '#' + [col.r, col.g, col.b].map((v) => Math.round(num(v, 1) * 255).toString(16).padStart(2, '0')).join(''), flipX: p.m_FlipX === 1 }); if (tex) todo.push(`copy ${tex} to assets/${path.basename(tex)} (Unity pixels-per-unit is in its .meta)`); break; }
          case 20: e.components.push({ type: 'camera', zoom: 1 }); todo.push(`camera "${e.name}": orthographic size ${p['orthographic size'] ?? p.m_OrthographicSize ?? '?'} → Nord shows (viewport height / zoom) pixels; set display size and zoom`); break;
          case 50: { // Rigidbody2D: body type, mass, drag, gravity, constraints (bit 1 = freeze X, 2 = freeze Y, 4 = freeze rotation), interpolation, collision detection
            const cs = num(p.m_Constraints);
            e.components.push({ type: 'rigidbody', mode: ['dynamic', 'kinematic', 'static'][num(p.m_BodyType)] ?? 'dynamic', mass: num(p.m_Mass, 1), drag: num(p.m_LinearDrag ?? p.m_LinearDamping, 0), gravityScale: num(p.m_GravityScale, 1),
              freezePositionX: !!(cs & 1), freezePositionY: !!(cs & 2), freezeRotationZ: !!(cs & 4), interpolation: ['none', 'interpolate', 'extrapolate'][num(p.m_Interpolate)] ?? 'none', collisionDetection: num(p.m_CollisionDetection) === 1 ? 'continuous' : 'discrete' });
            break;
          }
          case 54: { // Rigidbody (3D): constraints 2/4/8 = freeze position X/Y/Z, 16/32/64 = freeze rotation X/Y/Z
            const cs = num(p.m_Constraints);
            e.components.push({ type: 'rigidbody', mode: p.m_IsKinematic === 1 ? 'kinematic' : 'dynamic', mass: num(p.m_Mass, 1), drag: num(p.m_Drag ?? p.m_LinearDamping, 0), angularDrag: num(p.m_AngularDrag, 0.05), gravityScale: p.m_UseGravity === 0 ? 0 : 1,
              freezePositionX: !!(cs & 2), freezePositionY: !!(cs & 4), freezePositionZ: !!(cs & 8), freezeRotationX: !!(cs & 16), freezeRotationY: !!(cs & 32), freezeRotationZ: !!(cs & 64), interpolation: ['none', 'interpolate', 'extrapolate'][num(p.m_Interpolate)] ?? 'none', collisionDetection: ['discrete', 'continuous', 'continuousDynamic', 'continuousSpeculative'][num(p.m_CollisionDetection)] ?? 'discrete' });
            break;
          }
          case 61: e.components.push({ type: 'collider', shape: 'box', size: [Math.round(num(p.m_Size?.x, 1) * ppu), Math.round(num(p.m_Size?.y, 1) * ppu)], offset: [Math.round(num(p.m_Offset?.x) * ppu), Math.round(-num(p.m_Offset?.y) * ppu)], trigger: p.m_IsTrigger === 1, usedByComposite: p.m_UsedByComposite === 1 }); break;
          case 58: e.components.push({ type: 'collider', shape: 'circle', radius: Math.round(num(p.m_Radius, 0.5) * ppu), offset: [Math.round(num(p.m_Offset?.x) * ppu), Math.round(-num(p.m_Offset?.y) * ppu)], trigger: p.m_IsTrigger === 1, usedByComposite: p.m_UsedByComposite === 1 }); break;
          case 70: e.components.push({ type: 'collider', shape: 'capsule', size: [Math.round(num(p.m_Size?.x, 1) * ppu), Math.round(num(p.m_Size?.y, 2) * ppu)], direction: num(p.m_Direction) === 1 ? 'horizontal' : 'vertical', offset: [Math.round(num(p.m_Offset?.x) * ppu), Math.round(-num(p.m_Offset?.y) * ppu)], trigger: p.m_IsTrigger === 1 }); break;
          case 66: e.components.push({ type: 'collider', shape: 'composite' }); todo.push(`"${e.name}": CompositeCollider2D → shape composite; colliders marked "Used By Composite" on the children have usedByComposite on`); break;
          case 60: e.components.push({ type: 'collider', shape: 'polygon', points: [], trigger: p.m_IsTrigger === 1 }); todo.push(`"${e.name}": PolygonCollider2D points are not read from the YAML; fill collider.points (Unity units × ${ppu}, y flipped) or use the Sprite outline`); break;
          case 68: e.components.push({ type: 'collider', shape: 'edge', points: [], trigger: p.m_IsTrigger === 1 }); todo.push(`"${e.name}": EdgeCollider2D points are not read from the YAML; fill collider.points`); break;
          case 65: e.components.push({ type: 'collider', shape: 'box', size: [num(p.m_Size?.x, 1), num(p.m_Size?.y, 1), num(p.m_Size?.z, 1)], offset: [num(p.m_Center?.x), num(p.m_Center?.y), num(p.m_Center?.z)], trigger: p.m_IsTrigger === 1 }); break;
          case 135: e.components.push({ type: 'collider', shape: 'sphere', radius: num(p.m_Radius, 0.5), offset: [num(p.m_Center?.x), num(p.m_Center?.y), num(p.m_Center?.z)], trigger: p.m_IsTrigger === 1 }); break;
          case 136: e.components.push({ type: 'collider', shape: 'capsule', size: [num(p.m_Radius, 0.5) * 2, num(p.m_Height, 2), num(p.m_Radius, 0.5) * 2], radius: num(p.m_Radius, 0.5), offset: [num(p.m_Center?.x), num(p.m_Center?.y), num(p.m_Center?.z)], trigger: p.m_IsTrigger === 1 }); break;
          case 231: case 232: case 233: case 234: case 235: case 254: case 255: case 256: case 257: { // 2D joints
            const kind = { 231: 'spring', 232: 'distance', 233: 'hinge', 234: 'slider', 235: 'wheel', 254: 'relative', 255: 'fixed', 256: 'friction', 257: 'target' }[c.classId], a = p.m_Anchor ?? {}, ca = p.m_ConnectedAnchor ?? {};
            const j = { type: 'joint', kind, anchor: [Math.round(num(a.x) * ppu * 100) / 100, Math.round(-num(a.y) * ppu * 100) / 100, 0], connectedAnchor: [Math.round(num(ca.x) * ppu * 100) / 100, Math.round(-num(ca.y) * ppu * 100) / 100, 0], autoConfigureConnectedAnchor: p.m_AutoConfigureConnectedAnchor !== 0, collideConnected: p.m_EnableCollision === 1,
              breakForce: Number.isFinite(num(p.m_BreakForce, Infinity)) && num(p.m_BreakForce) > 0 && num(p.m_BreakForce) < 1e30 ? num(p.m_BreakForce) : 0, useLimits: p.m_UseLimits === 1 || p.m_UseAngleLimits === 1, lowerAngle: -num(p.m_AngleLimits?.m_UpperAngle ?? p.m_LowerAngle), upperAngle: -num(p.m_AngleLimits?.m_LowerAngle ?? p.m_UpperAngle),
              useMotor: p.m_UseMotor === 1, motorSpeed: num(p.m_Motor?.m_MotorSpeed), maxMotorTorque: num(p.m_Motor?.m_MaximumMotorForce, 10000), distance: Math.round(num(p.m_Distance) * ppu * 100) / 100, autoConfigureDistance: p.m_AutoConfigureDistance !== 0, frequency: num(p.m_Frequency, 5), dampingRatio: num(p.m_DampingRatio, 0.5), maxForce: num(p.m_MaxForce, 10000) };
            joints.push({ comp: j, ref: String(p.m_ConnectedRigidBody?.fileID ?? 0) }); e.components.push(j); break;
          }
          case 59: case 138: case 145: case 144: case 153: { // 3D joints
            const kind = { 59: 'hinge', 138: 'fixed', 145: 'spring', 144: 'ball', 153: 'configurable' }[c.classId], a = p.m_Anchor ?? {}, ax = p.m_Axis ?? {};
            const j = { type: 'joint', kind, anchor: [num(a.x), num(a.y), num(a.z)], axis: [num(ax.x, 1), num(ax.y), num(ax.z)], autoConfigureConnectedAnchor: p.m_AutoConfigureConnectedAnchor !== 0, collideConnected: p.m_EnableCollision === 1,
              useLimits: p.m_UseLimits === 1, lowerAngle: num(p.m_Limits?.min), upperAngle: num(p.m_Limits?.max), useMotor: p.m_UseMotor === 1, motorSpeed: num(p.m_Motor?.targetVelocity), maxMotorTorque: num(p.m_Motor?.force, 10000), distance: num(p.m_MaxDistance), frequency: num(p.m_Spring, 5), dampingRatio: num(p.m_Damper, 0.5) };
            joints.push({ comp: j, ref: String(p.m_ConnectedBody?.fileID ?? 0) }); e.components.push(j); if (kind === 'configurable') todo.push(`"${e.name}": ConfigurableJoint motions / limits are not read; set joint.xMotion … angularZMotion and the limits`); break;
          }
          case 120: e.components.push({ type: 'lineRenderer', points: [], startWidth: num(p.m_Parameters?.widthMultiplier, 1), endWidth: num(p.m_Parameters?.widthMultiplier, 1), loop: p.m_Loop === 1, useWorldSpace: p.m_UseWorldSpace === 1 }); todo.push(`"${e.name}": LineRenderer positions, width curve and gradient are not read from the YAML; fill lineRenderer.points / widthCurve / colors`); break;
          case 96: e.components.push({ type: 'trailRenderer', time: num(p.m_Time, 1), minVertexDistance: Math.round(num(p.m_MinVertexDistance, 0.1) * ppu * 100) / 100 }); todo.push(`"${e.name}": TrailRenderer width curve and gradient are not read from the YAML`); break;
          case 331: e.components.push({ type: 'spriteMask', shape: 'texture' }); todo.push(`"${e.name}": SpriteMask → spriteMask (set texture or shape); SpriteRenderers need maskInteraction (visibleInsideMask / visibleOutsideMask)`); break;
          case 114: {
            const g = p.m_Script?.guid, cs = g ? guids.get(g) : null;
            if (!cs) { todo.push(`"${e.name}": MonoBehaviour with unknown script (package script or missing .cs)`); break; }
            const attrs = {}; for (const [k, v] of Object.entries(p)) if (!k.startsWith('m_') && v !== undefined) attrs[k] = v && typeof v === 'object' ? (v.guid ? `<asset ${guids.get(v.guid) ?? v.guid}>` : v.fileID ? `<ref ${v.fileID}>` : null) : v;
            e.scripts.push({ path: 'scripts/' + path.basename(cs, '.cs').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '.js', attributes: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== null)) }); todo.push(`write scripts/${path.basename(cs, '.cs').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}.js from ${cs} (use unity_cs_outline)`); break;
          }
          default: todo.push(`"${e.name}": Unity component class ${c.classId} (${c.type}) has no automatic mapping`);
        }
      }
      entByGo.set(go.fileId, e);
      const kids = (t?.props.m_Children || []).map((ch) => goOfTransform.get(String(ch.fileID ?? /fileID:\s*(\d+)/.exec(String(ch))?.[1]))).filter(Boolean);
      for (const id of kids) { const kg = byId.get(id); if (kg) e.children.push(build(kg)); }
      return e;
    };
    const rootGos = gos.filter((g) => { const t = tOf.get(g.fileId); const f = t?.props.m_Father; return !f || !f.fileID || String(f.fileID) === '0'; });
    const entities = rootGos.map(build);
    for (const { comp, ref } of joints) { // the other body: the entity that owns the referenced Rigidbody
      const target = ref !== '0' ? entByGo.get(String(byId.get(ref)?.props.m_GameObject?.fileID ?? '')) : null;
      if (target) comp.connectedBody = target.id; else if (ref !== '0') todo.push(`joint on a body: connectedBody ${ref} was not found in this file`);
    }
    for (const pi of docs.filter((d) => d.classId === 1001)) {
      const src = guids.get(/"guid":"([0-9a-f]{32})"/.exec(JSON.stringify(pi.props.m_SourcePrefab ?? {}))?.[1] ?? '') ?? 'unknown prefab';
      todo.push(`prefab instance of ${src}: create a Nord prefab from it (run this tool on the .prefab) and instance it with scene_add_entity prefab:{path} (overrides listed in the Unity file)`);
    }
    const result = isPrefabFile ? { format: 1, name: path.basename(file, '.prefab'), entity: entities[0] ?? null } : { format: 1, name: path.basename(file, '.unity'), settings: {}, entities };
    result.todo = [...new Set(todo)];
    result.note = `${is2d ? '2D' : '3D'} project guessed from components. Positions ${is2d ? `converted to pixels (y down, ${ppu} px/unit)` : 'kept in world units'}.`;
    if (out) {
      const dest = path.resolve(ctx.projectRoot(), out);
      if (!dest.startsWith(ctx.projectRoot() + path.sep)) throw new Error('out must be inside the Nord project');
      if (fs.existsSync(dest)) throw new Error(out + ' already exists (this tool never overwrites)');
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const { todo: t2, note, ...clean } = result; fs.writeFileSync(dest, JSON.stringify(clean, null, 2) + '\n');
      return `Wrote ${out} (${entities.length} root entities).\n${result.note}\nTODO:\n- ${result.todo.join('\n- ') || 'nothing'}`;
    }
    return JSON.stringify(result, null, 2);
  });
  return T;
}
