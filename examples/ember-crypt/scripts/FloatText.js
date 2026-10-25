import { MonoBehaviour, Destroy, Time, Mathf, Vector3 } from 'nord';

/** Lives on the floattext prefab: rises 22 pixels while fading out, then removes itself. */
export default class FloatText extends MonoBehaviour {
  Start() { this.age = 0; this.y0 = this.position.y; }

  Update() {
    this.age += Time.deltaTime;
    const k = Mathf.Clamp01(this.age / 0.8);
    this.position = new Vector3(this.position.x, this.y0 - 22 * (1 - (1 - k) * (1 - k)), this.position.z);
    this.entity.native?.setAlpha(1 - k);
    if (k >= 1) Destroy(this.entity);
  }
}
