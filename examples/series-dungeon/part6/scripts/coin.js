import { MonoBehaviour, GameManager, Destroy, Random, Time, Vector3 } from 'nord';

export default class Coin extends MonoBehaviour {
  Start() {
    this.y0 = this.position.y;
    this.t = Random.value * 6;                                       // every coin bobs out of step with the others
    this.taken = false;
  }

  Update() {
    this.t += Time.deltaTime;
    const p = this.position;
    this.position = new Vector3(p.x, this.y0 + Math.sin(this.t * 4) * 2, p.z);
  }

  OnTriggerEnter(other) {                                            // Unity: OnTriggerEnter2D(Collider2D other)
    if (this.taken || !other.hasTag('Hero')) return;                 // other.CompareTag("Hero")
    this.taken = true;                                               // Destroy() happens at the end of the frame
    GameManager.instance.AddScore(1);
    Destroy(this.entity);
  }
}
