import { MonoBehaviour } from 'nord';
export default class Explosion extends MonoBehaviour {
  Start() { this.Destroy(this.entity, 0.9); }       // the particles are done after < 1 second
}
