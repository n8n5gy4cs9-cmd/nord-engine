// @nord {"id":"ui.touch-controls","title":"Virtual joystick & touch buttons","category":"ui","tier":["2d","3d"],"tags":["touch","mobile","joystick"],"requires":["ui"],"description":"On-screen joystick (drives left/right/up/down) and up to two action buttons (e.g. jump, fire) for touch devices. Only shown on touch screens unless 'always' is set."}
import { NordScript, virtualJoystick } from 'nord';

export default class TouchControls extends NordScript {
  static attributes = { always: { type: 'bool', default: false }, buttons: { type: 'array', default: ['jump', 'fire'], label: 'Action names for the right-hand buttons' }, size: { type: 'int', default: 120 } };
  start() {
    if (!this.attrs.always && !('ontouchstart' in window)) return;
    const root = this.ui.screen('touch'); root.style.pointerEvents = 'none'; this.ui.show('touch');
    this.joy = virtualJoystick(this.input, root, { size: this.attrs.size }); this.joy.el.style.pointerEvents = 'auto'; this.els = [];
    this.attrs.buttons.slice(0, 2).forEach((act, i) => {
      const b = this.ui.doc.createElement('div'); b.textContent = act; b.style.cssText = `position:absolute;right:${24 + i * 80}px;bottom:${24 + i * 40}px;width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font:600 13px sans-serif;color:#fff;touch-action:none;pointer-events:auto;user-select:none`;
      b.onpointerdown = () => this.input.setVirtual(act, true); b.onpointerup = b.onpointercancel = b.onpointerleave = () => this.input.setVirtual(act, false); root.append(b); this.els.push(b);
    });
  }
  onDestroy() { this.joy?.destroy(); this.els?.forEach((e) => e.remove()); }
}
