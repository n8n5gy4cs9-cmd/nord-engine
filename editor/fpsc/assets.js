// "Assets" tab: add your own textures, sprite enemies/props, 3D models, sounds and scripts — files go into <project>/fpsc/… and are registered in fpsc/bank.json.
import { el, modal, toast } from './forms.js';

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(f); });

export const SCRIPT_TEMPLATES = {
  blank: (id, title) => `// ${title} — a custom FPS Creator script. Attach it to any entity in the editor (Inspector → Scripts → Attach).
// Hooks (all optional, each gets the script context "c"):
//   start(c)  update(c, dt)  use(c, by)  hurt(c, amount, src)  die(c, src)  event(c, name, data)  heard(c, pos, src, dist)
// c.self = the entity (x y z rot hp props name tag target model …)   c.p = your parameters   c.s = your private state
// c.player  c.game  c.say(text, secs)  c.sound(name)  c.emit(evt)  c.on(evt, fn)  c.after(sec, fn)  c.find(nameOrTag)  c.targets()
export default {
  id: '${id}', title: '${title}', cat: 'Custom', desc: 'Describe what this script does.',
  params: {
    speed: { type: 'number', label: 'Speed', default: 2, min: 0, max: 20 },
    message: { type: 'string', label: 'Message', default: 'Hello from ${id}!' },
  },
  start(c) { c.s.t = 0; },
  update(c, dt) { c.s.t += dt; },
  use(c, by) { c.say(c.p.message, 2); c.emit('used'); },
};
`,
  enemy: (id, title) => `// ${title} — a custom enemy brain. Put it on any enemy (replace its default AI by removing "Shooter AI"/"Melee AI" first).
import { followPath, canSee, turnTo, yawTo } from '../../scripts/fpsc/ai.js';

export default {
  id: '${id}', title: '${title}', cat: 'AI', desc: 'Walks toward the player when it can see them and hurts them on contact.',
  params: { speed: { type: 'number', label: 'Speed', default: 2.5, min: 0.2, max: 10 }, damage: { type: 'number', label: 'Damage', default: 10, min: 0, max: 100 }, sight: { type: 'number', label: 'Sight (m)', default: 20, min: 1, max: 80 } },
  update(c, dt) {
    const e = c.self, p = c.player; if (!e.alive || !p.alive) return;
    if (canSee(c.game, e, p, c.p.sight, 360)) {
      followPath(c.game, e, { x: p.x, z: p.z, layer: p.layer }, c.p.speed, dt);
      if (Math.hypot(p.x - e.x, p.z - e.z) < 1.4 && (c.s.cool = (c.s.cool ?? 0) - dt) <= 0) { c.s.cool = 0.8; p.hurt(c.p.damage, e); c.sound('punch'); }
    }
  },
  die(c) { c.say('Got one!', 1); },
};
`,
  pickup: (id, title) => `// ${title} — a custom pickup: touch it to get something. Put it on any entity (e.g. the "Custom pickup").
export default {
  id: '${id}', title: '${title}', cat: 'Items', desc: 'Heals a bit and plays a sound when touched.',
  params: { heal: { type: 'number', label: 'Heal amount', default: 15, min: 0, max: 200 } },
  update(c, dt) {
    const e = c.self, p = c.player; if (c.s.taken || !p.alive) return;
    if (e.model) { c.s.t = (c.s.t ?? 0) + dt; e.model.inner.rotation.y = c.s.t * 2; }
    if (Math.hypot(p.x - e.x, p.z - e.z) < 1) { c.s.taken = true; p.heal(c.p.heal); c.sound('health'); c.say('+' + c.p.heal + ' health', 1.5); e.setModelVisible(false); e.emit('touched'); }
  },
};
`,
  trigger: (id, title) => `// ${title} — a custom trigger: runs when the player is inside the entity's zone (use a "Trigger zone" entity).
import { inZone } from '../../scripts/fpsc/behaviours/_util.js';

export default {
  id: '${id}', title: '${title}', cat: 'Triggers', desc: 'Does something once when the player steps in.',
  params: { text: { type: 'string', label: 'Message', default: 'You triggered it!' } },
  update(c) {
    if (c.s.done || !inZone(c.self, c.player)) return;
    c.s.done = true; c.say(c.p.text, 3); c.sound('alert'); c.emit('enter');
    // c.game.spawn('enemy_zombie', c.self.x, c.self.z, c.self.layer);  // …or spawn something
    // c.game.setDoor(c.game.doorsNamed('door1')[0], true, { force: true });  // …or open a door
  },
};
`,
};

export function assetsPanel(ed) {
  const root = el('div'), bj = ed.bankJson;
  root.append(el('div', { class: 'tip' }, el('b', {}, 'Add your own content'), ' — files are copied into your project\'s ', el('code', {}, 'fpsc/'), ' folder and registered in ', el('code', {}, 'fpsc/bank.json'), '. They appear in the palettes straight away and ship with exported games. Full rules: Help (F1) → "Adding assets".'));
  if (!ed.api.available) root.append(el('div', { class: 'tip', style: { borderColor: '#7a5a1a', background: '#3a2c10', color: '#ffd89a' } }, 'The editor is not connected to a project server (opened as a plain file?). Uploads are disabled — use the editor from Nord ("FPS Level" tab) or `nord serve`.'));

  const section = (title, hint, ...rows) => el('details', { class: 'sec', style: { padding: '6px 0' } }, el('summary', {}, title), el('div', { class: 'muted', style: { margin: '2px 0 6px' } }, hint), ...rows);
  const field = (label, input) => el('div', { class: 'row' }, el('label', {}, label), input);
  const file = (accept) => el('input', { type: 'file', accept, style: { width: '100%' } });
  const disabled = !ed.api.available;

  // ---- texture
  { const f = file('image/png,image/jpeg,image/webp'), id = el('input', { type: 'text', placeholder: 'e.g. rusty_metal' }), cat = el('select', {}, ...['wall', 'floor', 'ceiling', 'door'].map((c) => el('option', { value: c }, c))), sz = el('input', { type: 'number', value: 2, min: 0.25, max: 16, step: 0.25 });
    root.append(section('＋ Texture (PNG/JPG)', 'A seamless image. "Tile size" = how many metres one repeat covers. Works on every wall piece / floor.', field('Image', f), field('Name', id), field('Used for', cat), field('Tile size (m)', sz),
      el('button', { class: 'primary', disabled, onclick: async () => { if (!f.files[0]) return toast('Pick an image first'); const name = slug(id.value || f.files[0].name.replace(/\.[^.]+$/, '')), ext = (f.files[0].name.match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'png').toLowerCase(); const path = `fpsc/textures/${name}.${ext}`; await ed.api.save(path, await readFile(f.files[0])); await ed.editBank((b) => { (b.textures ??= []).filter((t) => t.id !== name); b.textures = (b.textures ?? []).filter((t) => t.id !== name); b.textures.push({ id: name, label: id.value || name, cat: cat.value, size: +sz.value || 2, url: path }); }); toast(`Texture "${name}" added`); } }, 'Add texture'))); }

  // ---- sprite
  { const f = file('image/png,image/webp'), id = el('input', { type: 'text', placeholder: 'e.g. my_ghost' }), base = el('select', {}, ...ed.bank.entities.filter((e) => !e.custom && ['Enemies', 'Props', 'Pickups', 'Allies'].includes(e.cat)).map((e) => el('option', { value: e.id }, `${e.cat}: ${e.label}`))), w = el('input', { type: 'number', value: 1.2, step: 0.1, min: 0.2 }), h = el('input', { type: 'number', value: 1.8, step: 0.1, min: 0.2 });
    root.append(section('＋ Sprite enemy / prop (PNG with transparency)', 'A flat picture that always faces the player (classic Doom look). It copies the behaviour of the entity you pick, so a sprite "Zombie" fights like the built-in one.', field('Image', f), field('Name', id), field('Behaves like', base), field('Width (m)', w), field('Height (m)', h),
      el('button', { class: 'primary', disabled, onclick: async () => { if (!f.files[0]) return toast('Pick an image first'); const name = slug(id.value || f.files[0].name.replace(/\.[^.]+$/, '')), path = `fpsc/art/${name}.png`; await ed.api.save(path, await readFile(f.files[0])); const b0 = ed.bank.entity(base.value); await ed.editBank((b) => { b.entities = (b.entities ?? []).filter((e) => e.id !== name); b.entities.push({ id: name, label: id.value || name, cat: b0.cat, extends: base.value, color: b0.color, glyph: b0.glyph, model: { kind: 'billboard', url: path, w: +w.value, h: +h.value }, height: +h.value }); }); toast(`"${name}" added to Items → ${b0.cat}`); } }, 'Add sprite entity'))); }

  // ---- model
  { const f = file('.glb,.gltf,model/gltf-binary'), id = el('input', { type: 'text', placeholder: 'e.g. my_robot' }), base = el('select', {}, ...ed.bank.entities.filter((e) => !e.custom && ['Enemies', 'Props', 'Pickups', 'Allies'].includes(e.cat)).map((e) => el('option', { value: e.id }, `${e.cat}: ${e.label}`))), sc = el('input', { type: 'number', value: 1, step: 0.1, min: 0.01 });
    root.append(section('＋ 3D model (.glb)', 'A glTF binary. Origin at its feet, facing +Z (forward). Scale so 1 unit = 1 metre.', field('Model', f), field('Name', id), field('Behaves like', base), field('Scale', sc),
      el('button', { class: 'primary', disabled, onclick: async () => { if (!f.files[0]) return toast('Pick a .glb first'); const name = slug(id.value || f.files[0].name.replace(/\.[^.]+$/, '')), path = `fpsc/models/${name}.glb`; await ed.api.save(path, await readFile(f.files[0])); const b0 = ed.bank.entity(base.value); await ed.editBank((b) => { b.entities = (b.entities ?? []).filter((e) => e.id !== name); b.entities.push({ id: name, label: id.value || name, cat: b0.cat, extends: base.value, color: b0.color, glyph: b0.glyph, model: { kind: 'glb', url: path, scale: +sc.value || 1 } }); }); toast(`"${name}" added to Items → ${b0.cat}`); } }, 'Add 3D model entity'))); }

  // ---- sound
  { const f = file('audio/*'), nm = el('input', { type: 'text', list: 'dl-snd', placeholder: 'e.g. pistol  (a built-in name replaces it)' });
    root.append(section('＋ Sound (WAV / OGG / MP3)', 'Give it a name. If the name matches a built-in sound (pistol, door, pickup, alarm…) your file replaces the synthesized one everywhere. Otherwise use the name in Rules → Play sound or script params.', field('File', f), field('Name', nm), el('datalist', { id: 'dl-snd' }, ...ed.soundNames().map((n) => el('option', { value: n }))),
      el('button', { class: 'primary', disabled, onclick: async () => { if (!f.files[0]) return toast('Pick an audio file first'); const name = slug(nm.value || f.files[0].name.replace(/\.[^.]+$/, '')), ext = f.files[0].name.match(/\.(wav|ogg|mp3|m4a|flac)$/i)?.[1]?.toLowerCase() ?? 'wav', path = `fpsc/sounds/${name}.${ext}`; await ed.api.save(path, await readFile(f.files[0])); await ed.editBank((b) => { (b.sounds ??= {})[name] = path; }); toast(`Sound "${name}" added`); } }, 'Add sound'))); }

  // ---- script
  { const id = el('input', { type: 'text', placeholder: 'e.g. open-on-kill' }), title = el('input', { type: 'text', placeholder: 'Title shown in the editor' }), tpl = el('select', {}, ...[['blank', 'Blank (hooks + docs)'], ['enemy', 'Enemy brain'], ['pickup', 'Pickup'], ['trigger', 'Trigger zone']].map(([v, l]) => el('option', { value: v }, l)));
    root.append(el('details', { class: 'sec', open: ed.assetFocus === 'script', style: { padding: '6px 0' } }, el('summary', {}, '＋ New script'), el('div', { class: 'muted', style: { margin: '2px 0 6px' } }, 'Creates fpsc/scripts/<id>.js from a template and registers it. Edit it in the Code tab of the Nord editor (or any text editor) — the next level test picks it up.'),
      field('Id', id), field('Title', title), field('Template', tpl),
      el('button', { class: 'primary', disabled, onclick: async () => { const sid = slug(id.value).replace(/_/g, '-'); if (!id.value) return toast('Give the script an id'); const path = `fpsc/scripts/${sid}.js`; await ed.api.save(path, SCRIPT_TEMPLATES[tpl.value](sid, title.value || sid)); await ed.editBank((b) => { b.scripts = (b.scripts ?? []).filter((p) => p !== path); b.scripts.push(path); }); toast(`Script "${sid}" created in ${path}`); } }, 'Create script'))); }

  // ---- what you have
  root.append(el('h4', {}, 'Your assets'));
  const list = [];
  for (const t of bj.textures ?? []) list.push(['Texture', t.id, () => ed.editBank((b) => { b.textures = b.textures.filter((x) => x.id !== t.id); })]);
  for (const t of bj.entities ?? []) list.push(['Entity', t.id, () => ed.editBank((b) => { b.entities = b.entities.filter((x) => x.id !== t.id); })]);
  for (const t of bj.pieces ?? []) list.push(['Piece', t.id, () => ed.editBank((b) => { b.pieces = b.pieces.filter((x) => x.id !== t.id); })]);
  for (const [n] of Object.entries(bj.sounds ?? {})) list.push(['Sound', n, () => ed.editBank((b) => { delete b.sounds[n]; })]);
  for (const p of bj.scripts ?? []) list.push(['Script', p, () => ed.editBank((b) => { b.scripts = b.scripts.filter((x) => x !== p); })]);
  if (!list.length) root.append(el('div', { class: 'muted' }, 'Nothing yet.'));
  for (const [kind, name, rm] of list) root.append(el('div', { class: 'row' }, el('span', { class: 'badge', style: { flex: 'none' } }, kind), el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, name), el('button', { style: { flex: 'none' }, title: 'Unregister (the file stays in your project)', onclick: rm }, '✕')));
  if (ed.bank.warns.length) { root.append(el('h4', {}, 'Warnings')); for (const w of ed.bank.warns) root.append(el('div', { style: { color: 'var(--warn)' } }, `⚠ ${w}`)); }
  root.append(el('h4', {}, 'Advanced'), el('div', { class: 'row' }, el('button', { onclick: () => ed.editBankRaw() }, 'Edit fpsc/bank.json (raw)…'), el('button', { onclick: () => ed.reloadBank() }, 'Reload bank')));
  void modal; return root;
}
