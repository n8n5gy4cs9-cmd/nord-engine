// Local command whitelist; deliberately no eval, completion or in-console command listing.
import { FONT_SIZES } from './ui-config.js';
import { TECHS, tech } from './research.js';
import { newRookie } from './tactical.js';
export class DevConsole {
  constructor(host) {
    this.h = host; this.open = false; this.history = []; this.cursor = 0;
    this.el = document.createElement('section'); this.el.dataset.xkomConsole = ''; this.el.style.cssText = `position:fixed;inset:auto 0 0;height:38%;z-index:9000;background:#061016f5;color:#9ac8b1;border-top:1px solid #365447;padding:12px;box-sizing:border-box;font:${FONT_SIZES.console}px/1.5 monospace;display:none`;
    this.log = document.createElement('pre'); this.log.style.cssText = 'margin:0;height:calc(100% - 35px);overflow:auto;white-space:pre-wrap'; this.log.textContent = 'Developer console. Command reference: commands.txt\n';
    this.input = document.createElement('input'); this.input.setAttribute('aria-label', 'Developer command'); this.input.autocomplete = 'off'; this.input.spellcheck = false; this.input.style.cssText = 'width:100%;box-sizing:border-box;background:#0b1d25;border:1px solid #365447;color:#d6efdf;font:inherit;padding:4px';
    this.el.append(this.log, this.input); document.body.append(this.el);
    this.key = e => {
      if (this.h.pause?.open) return;
      if (e.code === 'Backquote' || e.key === 'F2') { e.preventDefault(); e.stopImmediatePropagation(); if (e.type === 'keydown' && !e.repeat) this.toggle(); return; }
      if (!this.open) return; e.stopImmediatePropagation();
      if (e.type === 'keyup') return;
      if (e.key === 'Escape') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'Enter') { e.preventDefault(); const text = this.input.value.trim(); this.input.value = ''; if (text) { this.history.push(text); this.cursor = this.history.length; this.write('> ' + text); try { this.write(this.run(text)); } catch (err) { this.write(err.message); } } }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.cursor = Math.max(0, Math.min(this.history.length, this.cursor + (e.key === 'ArrowUp' ? -1 : 1))); this.input.value = this.history[this.cursor] ?? ''; }
    };
    window.addEventListener('keydown', this.key, true); window.addEventListener('keyup', this.key, true);
  }
  toggle() { this.open = !this.open; this.el.style.display = this.open ? 'block' : 'none'; this.h.game.input.held.clear(); this.h.air.keys = {}; this.h.rts.keys = {}; if (this.open) this.input.focus(); else this.input.blur(); }
  write(text) { this.log.textContent = (this.log.textContent + text + '\n').slice(-10000); this.log.scrollTop = this.log.scrollHeight; }
  destroy() { window.removeEventListener('keydown', this.key, true); window.removeEventListener('keyup', this.key, true); this.el.remove(); }
  run(text) {
    const [cmd, ...args] = text.toLowerCase().split(/\s+/), h = this.h, C = h.C;
    const number = (i, min, max, fallback) => { const n = args[i] === undefined ? fallback : Number(args[i]); if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) throw Error('Invalid numeric argument. See commands.txt.'); return n; };
    const leave = () => { if (h.tac.busy && h.tac.s) throw Error('Wait for the tactical action to finish.'); h.screenRevision++; h.tac.destroy(); if (h.rts.objs) h.rts.destroy(); if (h.air.objs) h.air.destroy(); h.help.close(); h.clearScreen(); };
    const redraw = () => { if (h.mode === 'geo') h.geoscape(); else if (h.mode === 'base') h.baseScreen(); };
    if (cmd === 'finale') { leave(); C.kills = h.attrs.goal; if (!C.R.done.includes('elerium')) C.R.done.push('alloys', 'laser', 'elerium'); C.R.done = [...new Set(C.R.done)]; h.geoscape(); h.launchFinale(); return 'Final operation loaded.'; }
    if (cmd === 'help') return 'Commands are documented only in commands.txt.';
    if (cmd === 'clear') { this.log.textContent = ''; return ''; }
    if (cmd === 'state') return JSON.stringify({ mode: h.mode, day: C.day, funds: C.funds, threat: C.presence, kills: C.kills, tech: C.R.done, occupied: C.towns.filter(t => t.occupied).map(t => t.name), paused: C.clockPaused });
    if (['title', 'geo', 'base', 'rts', 'mission', 'air'].includes(cmd)) {
      const aliens = cmd === 'mission' ? number(0, 1, 20, 6) : null, seed = cmd === 'mission' ? number(1, 0, 2147483647, h.seed) : h.seed;
      leave(); if (cmd === 'title') h.titleScreen(); else if (cmd === 'geo') h.geoscape(); else if (cmd === 'base') h.baseScreen(); else if (cmd === 'rts') h.startRts();
      else { const site = { ...h.makeSites()[0], ...(cmd === 'mission' ? { aliens, seed } : {}) }; if (!C.squad.length) C.squad.push(newRookie(h.mulberry(seed), 0)); cmd === 'air' ? h.intercept(site) : h.deploy(site); } return 'Screen loaded.';
    }
    if (cmd === 'money') { C.funds = Math.max(0, C.funds + number(0, -10000000, 10000000)); redraw(); return `FUNDS $${C.funds}`; }
    if (cmd === 'tech') { if (args[0] !== 'all' && !tech(args[0])) throw Error('Unknown technology. See commands.txt.'); const unlock = id => { const t = tech(id); for (const req of t.req) unlock(req); if (!C.R.done.includes(id)) C.R.done.push(id); }; for (const t of args[0] === 'all' ? TECHS : [tech(args[0])]) unlock(t.id); C.R.active = null; C.R.progress = 0; redraw(); return 'Research granted; combat upgrades apply to new missions.'; }
    if (cmd === 'presence') { C.presence = number(0, 0, 100); redraw(); return `THREAT ${C.presence}%`; }
    if (cmd === 'clock') { if (!['pause', 'resume'].includes(args[0])) throw Error('Invalid clock argument. See commands.txt.'); C.clockPaused = args[0] === 'pause'; h.refreshClock(); return 'Clock updated.'; }
    if (cmd === 'tick') { if (!['geo', 'base'].includes(h.mode)) throw Error('Use a campaign screen first.'); const days = number(0, 1, 30); h.advanceCampaign(days * 90, true); return 'Campaign time advanced.'; }
    if (cmd === 'recruit') { const count = number(0, 1, 6, 1); for (let i = 0; i < count && C.squad.length < 6; i++) C.squad.push(newRookie(h.mulberry(h.seed + C.squad.length), C.squad.length)); redraw(); return `SQUAD ${C.squad.length}`; }
    if (cmd === 'win' || cmd === 'lose') { leave(); h.ending(cmd === 'win'); return 'Ending loaded.'; }
    throw Error('Unknown command. See commands.txt.');
  }
}
