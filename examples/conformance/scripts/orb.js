import { NordScript } from 'nord';
export default class Orb extends NordScript {
  start() { this.after(0.8, () => this.entity.destroy()); window.__orbs = (window.__orbs ?? 0) + 1; }
}
