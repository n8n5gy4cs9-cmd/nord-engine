import { MonoBehaviour, WaitForSeconds, WaitUntil, GameManager } from 'nord';

// Endless waves: wave n spawns 3 + n enemies, the next wave starts when they are all gone.
export default class Spawner extends MonoBehaviour {
  Start() { this.StartCoroutine(this.Waves()); }

  *Waves() {
    for (let wave = 1; ; wave++) {
      GameManager.instance.Set('wave', wave);                       // free data store; the HUD listens to 'data'
      yield new WaitForSeconds(1.5);
      for (let i = 0; i < 3 + wave; i++) {
        if (GameManager.instance.state !== 'playing') return;
        this.SpawnEnemy(wave);
        yield new WaitForSeconds(0.45);
      }
      yield new WaitUntil(() => this.FindGameObjectsWithTag('enemy').length === 0 || GameManager.instance.state !== 'playing');
    }
  }

  async SpawnEnemy(wave) {
    const edge = this.game.rng.int(0, 3), x = this.game.rng.range(0, 960), y = this.game.rng.range(0, 540);
    const pos = [[x, -20], [x, 560], [-20, y], [980, y]][edge];
    const e = await this.Instantiate('prefabs/enemy.prefab.json', { pos: [pos[0], pos[1], 3] });
    e.set('sprite', 'tint', wave > 3 ? '#ff9f43' : '#ff5d5d');       // later waves look different
  }
}
