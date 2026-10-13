// Developer console (F2 or backtick): settings + cheats. Whitelisted commands only, no eval. Type `help` for the list.
import { Area } from './play.js';
import { ITEMS, LOCS, QUESTS, SPECIAL, SKILLS, QUOTA } from './data.js';
import * as R from './rules.js';

export const cheats = { god: false, ohk: false };
const hurt = Area.prototype.hurt; // god mode / one-hit-kill hook
Area.prototype.hurt = function (e, dmg, by) { if (cheats.god && e.kind === 'player') return; if (cheats.ohk && e.kind === 'enemy') dmg = Math.max(dmg, e.hp); return hurt.call(this, e, dmg, by); };

const HELP = [
  'SETTINGS',
  '  settings                 show all settings',
  '  set mode classic|modern  control mode (F10)',
  '  set sfx|music <0-100>    volume',
  '  set god|ohk on|off       invulnerable / one-hit kills',
  '  set time <hour 0-23>     time of day',
  'CHEATS',
  '  heal                     full HP',
  '  give <item> [n]          add item   (items = list ids)',
  '  xp <n> | level <n>       experience / reach level',
  '  stat <ST|PE|EN|CH|IN|AG|LK> <1-10>   set SPECIAL',
  '  skill <id> <n>           set skill points (skills = list ids)',
  '  kills <n>                set alien kill count',
  '  kill                     kill every enemy in this area',
  '  quest <id> <step>        set quest step (quests = list ids)',
  '  flag <name> [0|1]        set a story flag',
  'NAVIGATION',
  '  goto <place>             load an area (places = list ids)',
  '  items | skills | quests | places    list ids',
  '  ending escape|victory|death',
  '  save | load | title | state | clear | help',
];

export class DevConsole {
  constructor(ctx) {
    this.ctx = ctx; this.open = false; this.history = []; this.cursor = 0;
    this.el = document.createElement('section'); this.el.style.cssText = 'position:fixed;inset:auto 0 0;height:38%;z-index:9000;background:#061008f5;color:#9ad8a8;border-top:1px solid #365447;padding:12px;box-sizing:border-box;font:14px/1.4 monospace;display:none';
    this.log = document.createElement('pre'); this.log.style.cssText = 'margin:0;height:calc(100% - 35px);overflow:auto;white-space:pre-wrap'; this.log.textContent = 'Vallout console. Type help.\n';
    this.input = document.createElement('input'); this.input.setAttribute('aria-label', 'Console command'); this.input.autocomplete = 'off'; this.input.spellcheck = false; this.input.style.cssText = 'width:100%;box-sizing:border-box;background:#0b1d12;border:1px solid #365447;color:#d6efdf;font:inherit;padding:4px';
    this.el.append(this.log, this.input); document.body.append(this.el);
    this.key = (e) => {
      if (e.code === 'Backquote' || e.key === 'F2') { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown' && !e.repeat) this.toggle(); return; }
      if (!this.open) return; e.stopImmediatePropagation();
      if (e.type === 'keyup') return;
      if (e.key === 'Escape') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'Enter') { e.preventDefault(); const t = this.input.value.trim(); this.input.value = ''; if (t) { this.history.push(t); this.cursor = this.history.length; this.write('> ' + t); try { this.write(this.run(t)); } catch (err) { this.write(err.message); } } }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.cursor = Math.max(0, Math.min(this.history.length, this.cursor + (e.key === 'ArrowUp' ? -1 : 1))); this.input.value = this.history[this.cursor] ?? ''; }
    };
    window.addEventListener('keydown', this.key, true); window.addEventListener('keyup', this.key, true);
  }
  toggle() { const c = this.ctx; this.open = !this.open; this.el.style.display = this.open ? 'block' : 'none'; c.modal += this.open ? 1 : -1; for (const k in c.keys) c.keys[k] = false; if (this.open) this.input.focus(); else this.input.blur(); }
  write(t) { this.log.textContent = (this.log.textContent + t + '\n').slice(-10000); this.log.scrollTop = this.log.scrollHeight; }
  destroy() { window.removeEventListener('keydown', this.key, true); window.removeEventListener('keyup', this.key, true); this.el.remove(); }
  run(text) {
    const ctx = this.ctx, [cmd, ...a] = text.toLowerCase().split(/\s+/), G = ctx.G, c = G?.char, au = ctx.game.audio, scr = () => ctx.self.screens;
    const need = () => { if (!c) throw Error('Start a game first.'); };
    const num = (i, lo, hi) => { const n = Number(a[i]); if (!Number.isFinite(n) || n < lo || n > hi) throw Error(`Number ${lo}..${hi} expected.`); return Math.round(n); };
    const onoff = (v) => { if (v !== 'on' && v !== 'off') throw Error('Use on or off.'); return v === 'on'; };
    const pick = (obj, what) => { if (!(a[0] in obj)) throw Error(`Unknown ${what}. Type ${what}s to list.`); return a[0]; };
    const hud = () => { ctx.hud?.refresh(); ctx.area?.hudRefresh?.(); };
    const settings = () => `mode ${ctx.mode} · sfx ${Math.round(au.volume('sfx') * 100)} · music ${Math.round(au.volume('music') * 100)} · god ${cheats.god ? 'on' : 'off'} · ohk ${cheats.ohk ? 'on' : 'off'}${G ? ` · time ${Math.floor(G.time / 60) % 24}h` : ''}`;
    switch (cmd) {
      case 'help': return HELP.join('\n');
      case 'clear': this.log.textContent = ''; return '';
      case 'settings': return settings();
      case 'set': {
        const [k, v] = [a[0], a[1]];
        if (k === 'mode') { if (v !== 'classic' && v !== 'modern') throw Error('classic or modern.'); ctx.setMode(v); }
        else if (k === 'sfx' || k === 'music') { a.shift(); au.volume(k, num(0, 0, 100) / 100); }
        else if (k === 'god') cheats.god = onoff(v); else if (k === 'ohk') cheats.ohk = onoff(v);
        else if (k === 'time') { need(); a.shift(); G.time = num(0, 0, 23) * 60; }
        else throw Error('Unknown setting. Type settings.');
        return settings();
      }
      case 'god': case 'ohk': cheats[cmd] = a[0] ? onoff(a[0]) : !cheats[cmd]; return `${cmd} ${cheats[cmd] ? 'on' : 'off'}`;
      case 'heal': need(); c.hp = c.maxHp; c.drunk = 0; hud(); return `HP ${c.hp}/${c.maxHp}`;
      case 'give': { need(); const id = pick(ITEMS, 'item'); ctx.give(id, a[1] ? num(1, 1, 999) : 1); return `Gave ${ITEMS[id].name}.`; }
      case 'xp': { need(); const up = R.addXp(c, num(0, 1, 100000)); hud(); return `XP ${c.xp}${up ? `, level ${c.lvl}` : ''}`; }
      case 'level': { need(); const n = num(0, 1, 30); while (c.lvl < n) R.addXp(c, R.xpForLevel(c.lvl) - c.xp); hud(); return `Level ${c.lvl}`; }
      case 'stat': { need(); const s = (a[0] ?? '').toUpperCase(); if (!SPECIAL.includes(s)) throw Error(`Stat: ${SPECIAL.join(' ')}`); a.shift(); c.S[s] = num(0, 1, 10); c.maxHp = R.derived(c.S).maxHp + (c.lvl - 1) * R.hpPerLevel(c.S); c.hp = Math.min(c.hp, c.maxHp); hud(); return `${s} ${c.S[s]}`; }
      case 'skill': { need(); const id = pick(Object.fromEntries(SKILLS.map((s) => [s, 1])), 'skill'); c.sk ??= {}; a.shift(); c.sk[id] = num(0, 0, 200); return `${id} ${R.skillValue(c, id)}%`; }
      case 'kills': need(); G.kills = num(0, 0, 999); return `Kills ${G.kills}/${QUOTA}`;
      case 'kill': { const ar = ctx.area; if (!ar) throw Error('Not in an area.'); const es = ar.ents.filter((e) => e.kind === 'enemy' && !e.dead); es.forEach((e) => ar.killEnemy(e, 'player')); return `Killed ${es.length}.`; }
      case 'quest': { need(); const id = pick(QUESTS, 'quest'); a.shift(); ctx.setQuest(id, num(0, 1, 9)); return `${id} step ${G.quests[id]}`; }
      case 'flag': need(); if (!a[0]) throw Error('Flag name expected.'); G.flags[a[0]] = a[1] === '0' ? 0 : 1; return `${a[0]} = ${G.flags[a[0]]}`;
      case 'goto': { need(); const id = pick(LOCS, 'place'); if (!G.visited.includes(id)) G.visited.push(id); ctx.here = id; this.toggle(); scr().startArea(id); return ''; }
      case 'ending': if (!['escape', 'victory', 'death'].includes(a[0])) throw Error('escape, victory or death.'); this.toggle(); ctx.endGame(a[0]); return '';
      case 'save': need(); return ctx.save() ? 'Saved.' : 'Save failed.';
      case 'load': return ctx.load() ? (this.toggle(), '') : 'No save.';
      case 'title': this.toggle(); scr().title(); return '';
      case 'items': return Object.keys(ITEMS).join(' ');
      case 'skills': return SKILLS.join(' ');
      case 'quests': return Object.keys(QUESTS).join(' ');
      case 'places': return Object.keys(LOCS).join(' ');
      case 'state': need(); return JSON.stringify({ here: ctx.here, hp: c.hp, lvl: c.lvl, xp: c.xp, kills: G.kills, quests: G.quests, flags: G.flags });
      default: throw Error('Unknown command. Type help.');
    }
  }
}
