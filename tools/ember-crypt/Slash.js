import { MonoBehaviour, Destroy, Time, Mathf } from 'nord';

/** The sword's white crescent: a translucent circle that grows and fades in 0.18 seconds. */
export default class Slash extends MonoBehaviour {
  Start() { this.age = 0; }

  Update() {
    this.age += Time.deltaTime;
    const k = Mathf.Clamp01(this.age / 0.18);
    const s = Mathf.Lerp(0.6, 1.5, k);
    this.entity.scale = [s, s, 1];
    this.entity.native?.setAlpha(0.7 * (1 - k));
    if (k >= 1) Destroy(this.entity);
  }
}
