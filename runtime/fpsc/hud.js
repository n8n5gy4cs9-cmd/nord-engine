// DOM heads-up display: health/armor/ammo, weapon bar, keys, messages, objective, minimap, pause/death/win screens. Scoped CSS (.fpsc-*).
const CSS = `
.fpsc-hud{position:absolute;inset:0;pointer-events:none;font:600 14px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;color:#eaf1ff;text-shadow:0 1px 3px #000;user-select:none;overflow:hidden}
.fpsc-hud *{box-sizing:border-box}
.fpsc-cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;opacity:.9}
.fpsc-cross:before,.fpsc-cross:after{content:"";position:absolute;background:#fff;box-shadow:0 0 2px #000}
.fpsc-cross:before{left:8px;top:0;width:2px;height:18px;clip-path:polygon(0 0,100% 0,100% 30%,0 30%,0 70%,100% 70%,100% 100%,0 100%)}
.fpsc-cross:after{top:8px;left:0;height:2px;width:18px;clip-path:polygon(0 0,30% 0,30% 100%,0 100%,70% 100%,70% 0,100% 0,100% 100%)}
.fpsc-stats{position:absolute;left:18px;bottom:16px;display:flex;gap:14px;align-items:flex-end}
.fpsc-big{font:800 40px/1 system-ui,sans-serif}
.fpsc-bar{width:150px;height:8px;background:#0008;border:1px solid #fff4;border-radius:4px;overflow:hidden;margin-top:4px}
.fpsc-bar i{display:block;height:100%;background:#ff4d4d;transition:width .15s}
.fpsc-bar.armor i{background:#4aa0ff}
.fpsc-lab{font-size:11px;letter-spacing:.12em;opacity:.8}
.fpsc-ammo{position:absolute;right:18px;bottom:16px;text-align:right}
.fpsc-weapons{position:absolute;right:18px;bottom:96px;display:flex;gap:4px}
.fpsc-weapons span{padding:3px 8px;border-radius:5px;background:#0007;border:1px solid #fff3;font-size:12px;opacity:.55}
.fpsc-weapons span.on{opacity:1;border-color:#ffd23a;color:#ffd23a}
.fpsc-keys{position:absolute;left:18px;bottom:100px;display:flex;gap:6px}
.fpsc-keys i{width:16px;height:16px;border-radius:3px;border:2px solid #fff8;display:block}
.fpsc-msg{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:20px;padding:6px 16px;border-radius:8px;background:#000a;max-width:70%;text-align:center;opacity:0;transition:opacity .25s}
.fpsc-msg.on{opacity:1}
.fpsc-obj{position:absolute;left:18px;top:16px;max-width:42%;font-size:13px;padding:6px 10px;background:#0009;border-left:3px solid #ffd23a;border-radius:4px}
.fpsc-obj:empty{display:none}
.fpsc-top{position:absolute;right:18px;top:12px;text-align:right;font-size:12px;opacity:.85}
.fpsc-mini{position:absolute;right:18px;top:48px;width:150px;height:150px;border-radius:8px;background:#000a;border:1px solid #fff3}
.fpsc-prompt{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-size:16px;padding:4px 12px;background:#000a;border-radius:6px;display:none}
.fpsc-hurt{position:absolute;inset:0;background:radial-gradient(ellipse at center,#0000 40%,#ff000099 100%);opacity:0;transition:opacity .25s}
.fpsc-pick{position:absolute;inset:0;opacity:0;transition:opacity .3s}
.fpsc-boss{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:44%;display:none;text-align:center}
.fpsc-boss .fpsc-bar{width:100%;height:12px}
.fpsc-screen{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#000b;pointer-events:auto;text-align:center}
.fpsc-screen.on{display:flex}
.fpsc-screen h1{margin:0;font:800 44px/1.1 system-ui,sans-serif;letter-spacing:.04em}
.fpsc-screen p{margin:0;max-width:560px;font-weight:500;opacity:.9;white-space:pre-line}
.fpsc-screen button{pointer-events:auto;font:700 16px system-ui;padding:10px 22px;border-radius:8px;border:1px solid #fff5;background:#243148;color:#fff;cursor:pointer}
.fpsc-screen button:hover{background:#34476a}
.fpsc-row{display:flex;gap:10px}
.fpsc-dead h1{color:#ff5a5a}.fpsc-won h1{color:#6dff9b}
`;
const KEYCOL = { red: '#ff4040', blue: '#4aa0ff', yellow: '#ffe040', green: '#50ff70' };

export class Hud {
  constructor(container) {
    if (!document.getElementById('fpsc-css')) { const s = document.createElement('style'); s.id = 'fpsc-css'; s.textContent = CSS; document.head.appendChild(s); }
    const r = this.root = document.createElement('div'); r.className = 'fpsc-hud';
    r.innerHTML = `<div class="fpsc-pick"></div><div class="fpsc-hurt"></div><div class="fpsc-cross"></div>
<div class="fpsc-obj"></div><div class="fpsc-top"></div><canvas class="fpsc-mini" width="150" height="150"></canvas>
<div class="fpsc-boss"><div class="fpsc-lab"></div><div class="fpsc-bar"><i></i></div></div>
<div class="fpsc-keys"></div><div class="fpsc-stats"><div><div class="fpsc-lab">HEALTH</div><div class="fpsc-big hp">100</div><div class="fpsc-bar hpb"><i style="width:100%"></i></div></div><div><div class="fpsc-lab">ARMOR</div><div class="fpsc-big ar">0</div><div class="fpsc-bar armor"><i style="width:0"></i></div></div></div>
<div class="fpsc-weapons"></div><div class="fpsc-ammo"><div class="fpsc-lab wl"></div><div class="fpsc-big am"></div></div>
<div class="fpsc-prompt"></div><div class="fpsc-msg"></div>
<div class="fpsc-screen fpsc-pause"><h1>Paused</h1><p class="help"></p><div class="fpsc-row"><button data-a="resume">Resume</button><button data-a="restart">Restart level</button><button data-a="quit">Quit</button></div></div>
<div class="fpsc-screen fpsc-dead"><h1>You died</h1><p class="why"></p><div class="fpsc-row"><button data-a="checkpoint">Retry from checkpoint</button><button data-a="restart">Restart level</button></div></div>
<div class="fpsc-screen fpsc-won"><h1>Level complete</h1><p class="stats"></p><div class="fpsc-row"><button data-a="restart">Play again</button><button data-a="next">Next level</button><button data-a="quit">Quit</button></div></div>
<div class="fpsc-screen fpsc-intro"><h1 class="t"></h1><p class="intro"></p><div class="fpsc-row"><button data-a="begin">Click to play</button></div></div>`;
    container.appendChild(r);
    this.$ = (s) => r.querySelector(s);
    this.cross = this.$('.fpsc-cross'); this.mini = this.$('.fpsc-mini'); this.mctx = this.mini.getContext('2d');
    this.handlers = {};
    r.addEventListener('click', (e) => { const a = e.target?.dataset?.a; if (a) this.handlers[a]?.(); });
    this.msgT = 0; this.hurtT = 0; this.pickT = 0;
    this.$('.help').textContent = 'WASD move · Mouse look · Shift sprint · Space jump · C crouch · E use / open · LMB fire · R reload · 1-6 / wheel weapons · F flashlight · M minimap · Esc pause';
  }
  on(action, fn) { this.handlers[action] = fn; }
  set(sel, text) { const el = this.$(sel); if (el && el.textContent !== String(text)) el.textContent = text; }
  update(p) {
    this.set('.hp', Math.max(0, Math.ceil(p.hp))); this.$('.hpb i').style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
    this.set('.ar', Math.ceil(p.armor)); this.$('.armor i').style.width = `${Math.max(0, Math.min(100, p.armor))}%`;
    const w = p.weapon; this.set('.wl', w ? w.label.toUpperCase() : ''); this.set('.am', !w || !w.ammo ? '∞' : w.mag ? `${p.mag} / ${p.reserve}` : `${p.reserve}`);
    if (p.weaponsKey !== this._wk) {
      this._wk = p.weaponsKey; const box = this.$('.fpsc-weapons'); box.innerHTML = '';
      for (const x of p.weapons) { const s = document.createElement('span'); s.textContent = `${x.slot} ${x.short ?? x.label.split(' ').pop()}`; if (x.id === w?.id) s.className = 'on'; box.appendChild(s); }
    }
    const kk = p.keys.join(','); if (kk !== this._kk) { this._kk = kk; this.$('.fpsc-keys').innerHTML = p.keys.map((k) => `<i style="background:${KEYCOL[k] ?? k}" title="${k} key"></i>`).join(''); }
    this.set('.fpsc-top', `${p.kills}/${p.totalKills} kills · ${p.score} pts · ${p.time}`);
  }
  message(text, secs = 3) { const m = this.$('.fpsc-msg'); m.textContent = text; m.classList.add('on'); this.msgT = secs; }
  objective(text) { this.$('.fpsc-obj').textContent = text ? `▶ ${text}` : ''; }
  prompt(text) { const p = this.$('.fpsc-prompt'); p.style.display = text ? 'block' : 'none'; if (text) p.textContent = text; }
  hurt() { this.$('.fpsc-hurt').style.opacity = '1'; this.hurtT = 0.25; }
  pickup(color) { const p = this.$('.fpsc-pick'); p.style.background = `${color}55`; p.style.opacity = '1'; this.pickT = 0.12; }
  boss(name, frac) { const b = this.$('.fpsc-boss'); b.style.display = frac == null ? 'none' : 'block'; if (frac != null) { b.querySelector('.fpsc-lab').textContent = name; b.querySelector('i').style.width = `${Math.max(0, frac * 100)}%`; } }
  tick(dt) {
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) this.$('.fpsc-msg').classList.remove('on');
    if (this.hurtT > 0 && (this.hurtT -= dt) <= 0) this.$('.fpsc-hurt').style.opacity = '0';
    if (this.pickT > 0 && (this.pickT -= dt) <= 0) this.$('.fpsc-pick').style.opacity = '0';
  }
  screen(name, on, data = {}) {
    const el = this.$(`.fpsc-${name}`); if (!el) return;
    if (name === 'dead' && data.why !== undefined) this.$('.why').textContent = data.why;
    if (name === 'won') this.$('.stats').textContent = data.stats ?? '';
    if (name === 'intro') { this.$('.intro').textContent = data.text ?? ''; this.$('.fpsc-intro .t').textContent = data.title ?? ''; }
    el.classList.toggle('on', !!on);
  }
  get anyScreen() { return !!this.root.querySelector('.fpsc-screen.on'); }
  show(on) { this.root.style.display = on ? '' : 'none'; }
  dispose() { this.root.remove(); }
}
