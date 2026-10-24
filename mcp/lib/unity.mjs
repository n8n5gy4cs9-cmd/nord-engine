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

  tool('unity_scene_to_nord', 'Convert a Unity .unity scene or .prefab (text YAML) into a Nord scene/prefab skeleton: GameObjects become entities with the hierarchy, position/rotation/scale, tag, layer, active flag, sprite/camera/collider/rigidbody components, and scripts whose GUID resolves to a .cs file become script references with the serialized values. Unity units are converted: 2D positions to pixels (y flipped; default 100 px per unit, set pixelsPerUnit). Conservative: anything it cannot map is listed in "todo". Writes a Nord file in the open project only when out is given (never overwrites); otherwise returns the JSON. Review the result, then finish by hand with scene_update_entity.', obj({ unityProject: { type: 'string', description: 'Absolute path of the Unity project folder' }, file: { type: 'string', description: 'Path of the .unity/.prefab file relative to the Unity project, e.g. Assets/Scenes/Main.unity' }, pixelsPerUnit: { type: 'number', description: 'Pixels per Unity unit for 2D (default 100)' }, out: { type: 'string', description: 'Nord project path to write, e.g. scenes/main.scene.json' } }, ['unityProject', 'file']), ({ unityProject, file, pixelsPerUnit = 100, out }) => {
    const root = unityRoot(unityProject), abs = path.resolve(root, file);
    if (!abs.startsWith(root + path.sep) || !/\.(unity|prefab)$/.test(abs)) throw new Error('file must be a .unity or .prefab inside the Unity project');
    const docs = parseUnityYaml(fs.readFileSync(abs, 'utf8')), byId = new Map(docs.map((d) => [d.fileId, d])), guids = buildGuidMap(root), todo = [];
    const ppu = pixelsPerUnit, isPrefabFile = abs.endsWith('.prefab');
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
    const is2d = docs.some((d) => [212, 50, 61, 58, 60, 70].includes(d.classId) || (d.classId === 20 && d.props.orthographic === 1));
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
          case 50: e.components.push({ type: 'rigidbody', gravityScale: num(p.m_GravityScale, 1), mass: num(p.m_Mass, 1), bodyType: [ 'dynamic', 'kinematic', 'static' ][num(p.m_BodyType)] ?? 'dynamic' }); break;
          case 61: e.components.push({ type: 'collider', shape: 'box', width: Math.round(num(p.m_Size?.x, 1) * ppu), height: Math.round(num(p.m_Size?.y, 1) * ppu), trigger: p.m_IsTrigger === 1 }); break;
          case 58: e.components.push({ type: 'collider', shape: 'circle', radius: Math.round(num(p.m_Radius, 0.5) * ppu), trigger: p.m_IsTrigger === 1 }); break;
          case 114: {
            const g = p.m_Script?.guid, cs = g ? guids.get(g) : null;
            if (!cs) { todo.push(`"${e.name}": MonoBehaviour with unknown script (package script or missing .cs)`); break; }
            const attrs = {}; for (const [k, v] of Object.entries(p)) if (!k.startsWith('m_') && v !== undefined) attrs[k] = v && typeof v === 'object' ? (v.guid ? `<asset ${guids.get(v.guid) ?? v.guid}>` : v.fileID ? `<ref ${v.fileID}>` : null) : v;
            e.scripts.push({ path: 'scripts/' + path.basename(cs, '.cs').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '.js', attributes: Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== null)) }); todo.push(`write scripts/${path.basename(cs, '.cs').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}.js from ${cs} (use unity_cs_outline)`); break;
          }
          default: todo.push(`"${e.name}": Unity component class ${c.classId} (${c.type}) has no automatic mapping`);
        }
      }
      const kids = (t?.props.m_Children || []).map((ch) => goOfTransform.get(String(ch.fileID ?? /fileID:\s*(\d+)/.exec(String(ch))?.[1]))).filter(Boolean);
      for (const id of kids) { const kg = byId.get(id); if (kg) e.children.push(build(kg)); }
      return e;
    };
    const rootGos = gos.filter((g) => { const t = tOf.get(g.fileId); const f = t?.props.m_Father; return !f || !f.fileID || String(f.fileID) === '0'; });
    const entities = rootGos.map(build);
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
