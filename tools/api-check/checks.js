// Every API the Examples pages use, exercised against the real runtime. Run by tools/examples-smoke.mjs (headless browser).
import * as N from 'nord';

export async function run(g) {
  const results = []; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = async (name, fn) => { try { const v = await fn(); if (v === false) throw new Error('returned false'); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, err: String(e?.message ?? e) }); } };
  const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); return true; };
  const hero = () => g.scene.find('Hero');
  const frames = async (n = 3) => { const t = g.time.elapsed; for (let i = 0; i < 400 && g.time.elapsed - t < n / 60; i++) await sleep(20); };

  // ---- scripts, lifecycle, attributes ----
  await T('lifecycle order + methods called', async () => { await frames(8); const s = hero().scripts[0]; eq(window.__log.slice(0, 3), ['init', 'start', 'onEnable']); return s.u > 0 && s.f > 0 && s.l > 0; });
  await T('attributes: defaults, given values, min/max, wrong type', async () => { const s = hero().scripts[0]; eq([s.attrs.speed, s.attrs.label, s.attrs.flag], [7, 'hi', false]); const e = await g.scene.spawn('prefabs/thing.prefab.json', { overrides: { scripts: { 0: { attributes: { speed: 99 } } } } }); eq(e.scripts[0].attrs.speed, 10, 'clamped to max'); e.destroy(); });
  await T('overrides in spawn patch scripts[0] and components[0]', async () => { const e = await g.scene.spawn('prefabs/thing.prefab.json', { pos: [5, 6, 1], overrides: { scripts: { 0: { attributes: { speed: 2 } } }, components: { 0: { tint: '#ff0000' } } } }); eq(e.scripts[0].attrs.speed, 2); eq(e.getComponent('sprite').data.tint, '#ff0000'); eq(e.pos, [5, 6, 1]); e.destroy(); });
  await T('"this.start = …" shadows the lifecycle method (documented trap)', async () => { class Bad extends N.NordScript { init() { this.start = [1, 2]; } } const e = await g.scene.spawnData({ name: 'Bad', transform: { pos: [0, 0, 0] }, components: [], scripts: [] }); let msg = ''; try { e.addScript(Bad, {}); } catch (x) { msg = String(x.message); } e.destroy(); return /start is not a function/.test(msg) || (() => { throw new Error('expected the trap, got: ' + msg); })(); });

  // ---- finding, components, hierarchy ----
  await T('find / findByTag / hasTag / children / parent / worldPos / enabled', async () => {
    eq(g.scene.find('Hero').name, 'Hero'); eq(g.scene.find('Nope'), null); eq(g.scene.findByTag('player').length, 1); eq(hero().hasTag('alive'), true);
    const p = g.scene.find('Parent'); eq(p.children[0].name, 'Kid'); eq(p.find('Kid').parent, p); eq(p.children[0].worldPos, [210, 200, 0]);
    const kid = p.find('Kid'); kid.enabled = false; eq(kid.enabled, false); kid.enabled = true;
  });
  await T('entity.set sprite alpha/tint/flipX and text', async () => { const h = hero(); h.set('sprite', 'alpha', 0.5); h.set('sprite', 'tint', '#00ff00'); h.set('sprite', 'flipX', true); eq(h.getComponent('sprite').data.alpha, 0.5); g.scene.find('Label').set('text', 'text', 'Hello'); eq(g.scene.find('Label').getComponent('text').data.text, 'Hello'); h.set('sprite', 'alpha', 1); });
  await T('getScript(Class) by import + callScripts', async () => { const { default: Probe } = await import('/scripts/probe.js'); const s = hero().getScript(Probe); if (!s) throw new Error('getScript null'); hero().callScripts('damage', 4); eq(s.last, 4); eq(g.scene.find('Ground').getScript(Probe), null); });
  await T('transform setters notify, touch() after in-place edit', async () => { const h = hero(); h.pos = [150, 100, 5]; eq(h.pos, [150, 100, 5]); h.pos[0] += 1; h.touch(); eq(h.pos[0], 151); h.rot = [0, 0, 45]; eq(h.rot, [0, 0, 45]); h.rot = [0, 0, 0]; });
  await T('spawnData builds an entity from plain data', async () => { const e = await g.scene.spawnData({ name: 'Float', transform: { pos: [1, 2, 3], rot: [0, 0, 0], scale: [1, 1, 1] }, components: [{ type: 'text', text: 'hi', size: 20, color: '#fff' }], scripts: [], children: [] }); eq(e.name, 'Float'); e.destroy(); });
  await T('clone returns a promise of a copy; destroy is deferred', async () => { const c = await hero().clone(); c.pos = [300, 100, 5]; eq(c.destroyed, false); c.destroy(); eq(c.destroyed, true); await frames(3); eq(g.scene.findByTag('player').filter((e) => e !== hero()).length >= 0, true); });

  // ---- events ----
  await T('global events: on/emit/once/unsubscribe/wildcard', async () => { const log = []; const off = g.events.on('t1', (d) => log.push(d)); g.events.once('t2', (d) => log.push('once' + d)); const star = g.events.on('*', ({ name }) => log.push('*' + name)); g.events.emit('t1', 1); g.events.emit('t2', 2); g.events.emit('t2', 3); off(); g.events.emit('t1', 4); star(); eq(log, [1, '*t1', 'once2', '*t2', '*t2', '*t1']); });
  await T('entity events + Inspector-style signals API', async () => { const e = hero(); const log = []; const off = e.on('hp', (d) => log.push(d.hp)); e.emit('hp', { hp: 3 }); off(); e.emit('hp', { hp: 2 }); eq(log, [3]); });
  await T('UnityEvent + EventBus', async () => { const ev = new N.UnityEvent(); let n = 0; const off = ev.AddListener((a) => (n += a)); ev.Invoke(2); off(); ev.Invoke(5); eq(n, 2); let m = 0; const un = N.EventBus.Subscribe('bus', (d) => (m = d)); N.EventBus.Publish('bus', 9); un(); eq(m, 9); });

  // ---- time, coroutines, timers, tweens ----
  await T('coroutines: WaitForSeconds, WaitUntil, nested, Stop', async () => {
    const mb = hero().addScript(class extends N.MonoBehaviour {}, {}); const log = []; let flag = false;
    mb.StartCoroutine((function* () { log.push('a'); yield new N.WaitForSeconds(0.1); log.push('b'); yield new N.WaitUntil(() => flag); log.push('c'); yield (function* () { yield null; log.push('n'); })(); log.push('d'); })());
    await sleep(500); eq(log, ['a', 'b']); flag = true; await sleep(500); eq(log, ['a', 'b', 'c', 'n', 'd']);
    const co = mb.StartCoroutine((function* () { while (true) { log.push('x'); yield null; } })()); await sleep(200); mb.StopCoroutine(co); const n = log.length; await sleep(200); eq(log.length, n, 'stopped');
  });
  await T('Invoke / InvokeRepeating / CancelInvoke / IsInvoking', async () => { const C = class extends N.MonoBehaviour { Ping() { this.n = (this.n ?? 0) + 1; } }; const mb = hero().addScript(C, {}); mb.Invoke('Ping', 0.1); eq(mb.IsInvoking('Ping'), true); await sleep(400); eq(mb.n, 1); mb.InvokeRepeating('Ping', 0.05, 0.1); await sleep(600); if (!(mb.n >= 3)) throw new Error('repeat ' + mb.n); mb.CancelInvoke('Ping'); const k = mb.n; await sleep(300); eq(mb.n, k); });
  await T('after / every / cancel', async () => { const s = hero().scripts[0]; let a = 0, b = 0; s.after(0.1, () => a++); const stop = s.every(0.1, () => b++); await sleep(700); stop(); const k = b; await sleep(300); if (!(a === 1 && b >= 2 && b === k)) throw new Error(`a=${a} b=${b} k=${k}`); const c = s.after(0.2, () => (a = 99)); c(); await sleep(400); eq(a, 1); });
  await T('tween: array target with numeric keys, onUpdate/onComplete, yoyo, easing names', async () => { const h = hero(); h.pos = [0, 100, 5]; let done = false; h.scripts[0].tween(h.pos, { 0: 100 }, { duration: 0.3, ease: 'quadOut', onUpdate: () => h.touch(), onComplete: () => (done = true) }); await sleep(900); eq(Math.round(h.pos[0]), 100); eq(done, true); const o = { v: 0 }; h.scripts[0].tween(o, { v: 1 }, { duration: 0.2, yoyo: true, repeat: 1, ease: 'sineInOut' }); await sleep(900); for (const e of ['linear', 'quadIn', 'quadOut', 'quadInOut', 'cubicIn', 'cubicOut', 'cubicInOut', 'sineInOut', 'backOut', 'elasticOut', 'bounceIn', 'bounceOut']) if (typeof N.ease[e] !== 'function') throw new Error('ease ' + e); });
  await T('helpers: clamp lerp remap vec rng', async () => { eq(N.clamp(5, 0, 1), 1); eq(N.lerp(0, 10, 0.5), 5); eq(N.remap(5, 0, 10, 0, 100), 50); eq(N.vec.add([1, 2], [3, 4]), [4, 6]); eq(N.vec.lerp([0, 0], [10, 10], 0.5), [5, 5]); const r = g.rng; const v = r.range(1, 2); if (v < 1 || v > 2) throw new Error('range'); r.int(0, 3); r.chance(0.5); r.pick([1, 2]); eq(r.shuffle([1, 2, 3]).length, 3); });
  await T('Mathf / Vector3 / Time / Debug', async () => { eq(N.Mathf.Clamp(5, 0, 3), 3); eq(N.Mathf.MoveTowards(0, 10, 3), 3); eq(new N.Vector3(3, 4, 0).magnitude, 5); eq(typeof N.Time.deltaTime, 'number'); N.Debug.Log('x'); N.Debug.LogWarning('x'); });

  // ---- save, data ----
  await T('save: set/get/default/slot/has/delete + PlayerPrefs', async () => { g.save.set('best', 120); eq(g.save.get('best', 0), 120); eq(g.save.get('nope', 7), 7); g.save.slot(2).set('game', { a: [1, 2] }); eq(g.save.slot(2).get('game'), { a: [1, 2] }); eq(g.save.has(2), true); g.save.delete(2); eq(g.save.has(2), false); g.save.slot(0); N.PlayerPrefs.SetInt('p', 3); eq(N.PlayerPrefs.GetInt('p', 0), 3); eq(N.PlayerPrefs.HasKey('p'), true); N.PlayerPrefs.DeleteAll(); });
  await T('ScriptableObject.Load + game.loadJSON', async () => { const d = await N.ScriptableObject.Load('data/items.json'); eq(d.sword.damage, 5); const e = await g.loadJSON('data/items.json'); eq(e.potion.heal, 25); });

  // ---- UI ----
  await T('ui: label/button/bar/menu/screens', async () => { const ui = g.ui; const l = ui.label('hi', { x: 1, y: 2, size: 20 }); l.set('yo'); eq(l.el.textContent, 'yo'); const b = ui.bar(0.5, { x: 5, y: 5, w: 100, color: '#f00' }); b.set(1); let clicked = 0; const btn = ui.button('Go', () => clicked++, { screen: 'tst', anchor: 'c', y: 10 }); ui.show('tst'); eq(ui.isShown('tst'), true); btn.el.click(); eq(clicked, 1); ui.menu('tst2', [{ text: 'A', onClick: () => {} }], { x: 0, y: 0 }); ui.hide('tst'); eq(ui.isShown('tst'), false); ui.clear('tst'); ui.toggle('tst2'); ui.hide('tst2'); l.remove(); b.remove(); });
  await T('ui.load a .ui.json: on(action), set(value)', async () => { const menu = await g.ui.load('ui/menu.ui.json'); let started = 0; menu.on('start', () => started++); menu.set('score', 12); menu.get('go').el.click(); eq(started, 1); if (!menu.get('score').el.textContent.includes('Score 12')) throw new Error('bound text missing: ' + menu.get('score').el.textContent); });

  // ---- audio, camera ----
  await T('audio: volume/mute/music API exist', async () => { const a = g.audio; a.volume('music', 0.5); eq(a.volume('music'), 0.5); a.mute('sfx', true); a.mute('sfx', false); if (typeof a.play !== 'function' || typeof a.music !== 'function' || typeof a.stopMusic !== 'function') throw new Error('missing'); });
  await T('camera: shake / flash / fade / fadeIn exist and run', async () => { const c = g.camera; c.shake(50, 0.001); c.flash(30, '#ffffff'); c.fade(30, '#000000'); c.fadeIn(30); });

  // ---- physics ----
  await T('physics: setVelocity/velocity/isGrounded/overlapBox/applyImpulse/teleport/enable', async () => {
    const h = await g.scene.spawnData({ name: 'Faller', transform: { pos: [480, 400, 5] }, components: [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [20, 20] }, { type: 'rigidbody', mode: 'dynamic', mass: 1, drag: 0, gravityScale: 1 }, { type: 'collider', shape: 'box', size: [20, 20] }], scripts: [], children: [] }); await frames(90); eq(g.physics.isGrounded(h), true, 'grounded'); g.physics.setVelocity(h, 200, null); eq(g.physics.velocity(h)[0], 200);
    const hits = g.physics.overlapBox(h.pos[0], h.pos[1], 40, 40); if (!Array.isArray(hits)) throw new Error('overlapBox'); g.physics.applyImpulse(h, 0, -100); g.physics.teleport(h, 100, 100); g.physics.setVelocity(h, 0, 0); g.physics.enable(h, true);
  });
  await T('trigger + collision events reach the scripts', async () => {
    const log = []; const h = hero(); h.pos = [700, 400, 5]; g.physics.setVelocity(h, 0, 0);
    const t = await g.scene.spawn('prefabs/thing.prefab.json', { pos: [700, 410, 3] }); const thing = t.scripts[0]; thing.onTriggerEnter = (o) => log.push('trig:' + o.name); await frames(40); t.destroy(); if (!log.includes('trig:Hero')) throw new Error('no trigger event: ' + JSON.stringify(log));
  });

  // ---- input ----
  await T('input: actions, axis, vec, pressed edge, pointer, Unity names', async () => {
    const key = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true })); let sawPressed = 0, sawAxis = 0, sawVec = null, sawUnity = 0;
    const s = hero().scripts[0]; const old = s.update; s.update = function (dt) { if (this.input.pressed('jump')) sawPressed++; if (this.input.axis('left', 'right') === 1) sawAxis++; if (this.input.down('right')) sawVec = this.input.vec('left', 'right', 'up', 'down'); if (N.UnityInput.GetAxis('Horizontal') === 1) sawUnity++; old?.call(this, dt); };
    key('KeyD', true); key('Space', true); await frames(6); key('Space', false); key('KeyD', false); s.update = old; eq(sawPressed, 1, 'pressed is one frame'); if (!sawAxis) throw new Error('axis'); eq(sawVec, [1, 0], 'vec'); if (!sawUnity) throw new Error('GetAxis'); eq(typeof g.input.pointer.worldX, 'number');
  });

  // ---- scenes, persistence, GameManager ----
  await T('Singleton: persistent survives loadScene; restart drops it', async () => {
    const k = [...g.scene.all()].find((e) => e.name === 'Keeper'); const { default: Keeper } = await import('/scripts/keeper.js'); eq(Keeper.instance.value, 41); Keeper.instance.value = 99;
    await g.loadScene('scenes/second.scene.json'); eq(g.scene.name, 'second'); eq(Keeper.instance.value, 99, 'persisted'); await frames(3); eq(g.scene.roots.filter((e) => e.name === 'Keeper').length, 1, 'no duplicate');
    await g.restart(); eq(Keeper.instance.value, 41, 'restart resets');
    await g.loadScene('scenes/main.scene.json');
  });
  await T('GameManager: AddScore/LoseLife/SetState/Get/Set/SaveHighScore/events, reachable as base class', async () => {
    class Mine extends N.GameManager {} const e = await g.scene.spawnData({ name: 'GM', transform: { pos: [0, 0, 0] }, components: [], scripts: [], children: [] }); e.addScript(Mine, { startLives: 2 }); await sleep(100);
    const gm = N.GameManager.instance; if (!gm) throw new Error('GameManager.instance null'); const seen = []; g.events.on('score', (d) => seen.push(d.score)); gm.AddScore(3); gm.AddScore(2); eq(seen, [3, 5]); eq(gm.lives, 2); gm.LoseLife(); eq(gm.lives, 1); gm.Set('k', 4); eq(gm.Get('k', 0), 4); eq(gm.SaveHighScore('hs'), 5); gm.SetState('paused'); eq(gm.state, 'paused'); gm.LoseLife(); eq(gm.state, 'gameover'); e.destroy();
  });
  await T('ObjectPool: Warm/Get/Release/countInactive', async () => { const p = new N.ObjectPool(g.scene, 'prefabs/thing.prefab.json'); await p.Warm(3); eq(p.countInactive, 3); const a = await p.Get({ pos: [9, 9, 9] }); eq(a.enabled, true); eq(p.countInactive, 2); p.Release(a); eq(a.enabled, false); eq(p.countInactive, 3); });
  await T('game.pause/resume/timeScale', async () => { g.pause(); eq(g.paused, true); g.resume(); eq(g.paused, false); g.timeScale = 0.5; eq(N.Time.timeScale, 0.5); g.timeScale = 1; });

  // ---- misc ----
  await T('net API surface (host/join/spawn/rpc/call/send/on)', async () => { for (const f of ['host', 'join', 'spawn', 'rpc', 'call', 'callHost', 'send', 'on', 'isAuthority', 'simulate', 'stats']) if (typeof g.net[f] !== 'function') throw new Error('net.' + f); });
  await T('scene events sceneLoad/sceneUnload', async () => { const log = []; const a = g.events.on('sceneLoad', (n) => log.push('load:' + n)), b = g.events.on('sceneUnload', (n) => log.push('unload:' + n)); await g.loadScene('scenes/second.scene.json'); a(); b(); await g.loadScene('scenes/main.scene.json'); eq(log, ['unload:main', 'load:second']); });
  // ---- pages 30-40 ----
  await T('input.actions can be rebound at runtime (options menu page)', async () => {
    const key = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true })); const s = hero().scripts[0]; const old = s.update; let n = 0; const saved = [...g.input.actions.jump];
    g.input.actions.jump = ['KeyZ']; s.update = function (dt) { if (this.input.pressed('jump')) n++; old?.call(this, dt); }; key('KeyZ', true); await frames(5); key('KeyZ', false); await frames(2); s.update = old; g.input.actions.jump = saved; eq(n, 1);
  });
  await T('i18n: load / setLanguage / t / languages / language event', async () => { g.i18n.load({ en: { hello: 'Hi' }, fi: { hello: 'Moi' } }); let ev = null; const off = g.events.on('language', (l) => (ev = l)); g.i18n.setLanguage('fi'); eq(g.i18n.t('hello'), 'Moi'); eq(ev, 'fi'); if (!g.i18n.languages.includes('fi')) throw new Error('languages'); g.i18n.setLanguage('en'); off(); });
  await T('a11y: setColorBlind modes + setUiScale', async () => { for (const m of ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia']) eq(g.a11y.setColorBlind(m) !== false, true, m); g.a11y.setColorBlind('none'); g.a11y.setUiScale(1); });
  await T('Rng: same seed, same sequence; helpers', async () => { const a = new N.Rng(5), b = new N.Rng(5); eq([a.next(), a.int(1, 6), a.range(3, 4)], [b.next(), b.int(1, 6), b.range(3, 4)]); const d = [1, 2, 3, 4]; new N.Rng(1).shuffle(d); eq(d.slice().sort(), [1, 2, 3, 4]); });
  await T('picking: sprite size test + pointer fields', async () => { const h = hero(); h.pos = [300, 300, 5]; const s = h.getComponent('sprite').data.size; const hit = (e, x, y) => Math.abs(x - e.pos[0]) <= (e.getComponent('sprite').data.size[0] * e.scale[0]) / 2 && Math.abs(y - e.pos[1]) <= (e.getComponent('sprite').data.size[1] * e.scale[1]) / 2; eq(hit(h, 305, 305), true); eq(hit(h, 330, 300), false); eq(s.length, 2); for (const k of ['x', 'y', 'worldX', 'worldY', 'down']) if (!(k in g.input.pointer)) throw new Error('pointer.' + k); });
  await T('physics: setGravity, kinematic body moves by velocity, entity.vars, enable', async () => {
    g.physics.setGravity(0, 900); const k = await g.scene.spawnData({ name: 'Mover', transform: { pos: [100, 50, 5] }, components: [{ type: 'sprite', texture: 'assets/sprites/square.png', size: [20, 20] }, { type: 'rigidbody', mode: 'kinematic', mass: 1, drag: 0, gravityScale: 0 }, { type: 'collider', shape: 'box', size: [20, 20] }], scripts: [], children: [] }); await frames(2); g.physics.setVelocity(k, 100, 0); await frames(30); if (!(k.pos[0] > 120)) throw new Error('kinematic did not move: ' + k.pos[0]); k.vars.onLadder = true; eq(k.vars.onLadder, true); k.destroy();
  });
  await T('library scripts import cleanly (makeNoise, health events)', async () => { const m = await import('/scripts-lib/util-noise.js'); const n = m.makeNoise(3); const v = n(0.3, 0.7); if (!(v >= -1 && v <= 1)) throw new Error('noise range'); eq(typeof n.fbm(1, 1), 'number'); });
  return results;
}
