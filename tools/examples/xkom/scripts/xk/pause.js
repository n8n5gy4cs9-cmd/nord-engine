// A campaign checkpoint menu. Scene clocks/tweens pause too, including an in-flight tactical action.
export class PauseMenu {
  constructor(host) {
    this.h = host; this.open = false;
    this.el = document.createElement('section'); this.el.dataset.xkomPause = '';
    this.el.style.cssText = 'position:fixed;inset:0;z-index:9500;background:#020710c9;display:none;align-items:center;justify-content:center;font:14px/1.5 monospace;color:#cad8db';
    const box = document.createElement('div'); box.style.cssText = 'width:320px;max-width:90vw;background:#101e2c;border:1px solid #536b7e;padding:20px;box-sizing:border-box;box-shadow:0 8px 40px #000';
    const title = document.createElement('div'); title.textContent = 'CAMPAIGN PAUSED'; title.style.cssText = 'color:#83b9c5;margin-bottom:12px;letter-spacing:2px'; box.append(title);
    this.note = document.createElement('p'); this.note.textContent = 'Combat saves return to HQ. The interrupted operation restarts.'; this.note.style.cssText = 'font-size:11px;color:#9aabb5';
    const button = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'display:block;width:100%;margin:6px 0;padding:8px;border:1px solid #506b7e;background:#243747;color:#e0e5da;font:inherit;cursor:pointer'; b.onclick = fn; box.append(b); return b; };
    button('Resume', () => this.close());
    button('Save campaign', () => { this.note.textContent = host.saveCampaign() ? 'Saved. Combat loads at HQ; operation restarts.' : 'Save unavailable: browser storage is blocked or full.'; this.refresh(); });
    this.load = button('Load campaign', () => { if (host.loadCampaign()) this.close(); });
    this.clock = button('Campaign clock', () => { host.C.clockPaused = !host.C.clockPaused; host.refreshClock(); this.refresh(); });
    button('Return to title', () => { host.saveCampaign(); this.close(); host.leaveMission(); host.titleScreen(); });
    box.append(this.note); this.el.append(box); document.body.append(this.el);
    this.key = e => {
      if (host.dev?.open || host.startGate?.active || host.help.open) return;
      const toggle = ['p', 'P', 'Escape'].includes(e.key) && ['geo','base','tac','rts','air','alert'].includes(host.mode);
      if (!this.open && !toggle) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type === 'keydown' && !e.repeat && toggle) this.open ? this.close() : this.show();
    };
    window.addEventListener('keydown', this.key, true); window.addEventListener('keyup', this.key, true);
  }
  refresh() { this.load.disabled = !this.h.savedCampaign(); this.clock.textContent = 'Strategic clock: ' + (this.h.C.clockPaused ? 'paused' : 'running'); }
  show() { this.open = true; this.el.style.display = 'flex'; this.h.ps.time.paused = true; this.h.ps.tweens.paused = true; this.h.game.input.held.clear(); this.h.rts.keys = {}; this.h.air.keys = {}; this.h.rts.drag = null; this.h.air.mouseDown = false; this.refresh(); }
  close() { this.open = false; this.el.style.display = 'none'; this.h.ps.time.paused = false; this.h.ps.tweens.paused = false; this.h.game.input.held.clear(); }
  destroy() { this.close(); window.removeEventListener('keydown', this.key, true); window.removeEventListener('keyup', this.key, true); this.el.remove(); }
}
