import { MonoBehaviour, SerializeField, EventBus, Mathf, Time, Vector3 } from 'nord';

export default class Follow extends MonoBehaviour {
  static attributes = SerializeField({ target: 'Hero', stiffness: 8, viewport: [640, 360] });

  Start() {
    this.hero = this.Find(this.target);
    // The level announces its size when it has built itself. EventBus is a global publish/subscribe board.
    this.off = EventBus.Subscribe('level', (size) => { this.bounds = size; this.snap = true; });
  }

  LateUpdate() {                                                         // after every Update(): the hero has already moved this frame
    if (!this.hero || !this.bounds) return;
    const [hw, hh] = [this.viewport[0] / 2, this.viewport[1] / 2];
    const goalX = Mathf.Clamp(this.hero.pos[0], hw, this.bounds.width - hw);
    const goalY = Mathf.Clamp(this.hero.pos[1], hh, this.bounds.height - hh);
    const k = this.snap || this.stiffness === 0 ? 1 : 1 - Math.exp(-this.stiffness * Time.deltaTime);   // the same at 30 and 144 fps
    this.snap = false;
    const p = this.position;
    this.position = new Vector3(Mathf.Lerp(p.x, goalX, k), Mathf.Lerp(p.y, goalY, k), p.z);
  }

  OnDestroy() { this.off?.(); }
}
