import { NordScript } from 'nord';
export default class Ball extends NordScript {
  start() { this.hits = 0; }
  onCollisionEnter(other) { this.hits++; window.__ballHits = this.hits; }
}
