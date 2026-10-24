import { MonoBehaviour, SerializeField, WaitForSeconds, GameManager } from 'nord';

export default class Spawner extends MonoBehaviour {
  static attributes = SerializeField({ coinEvery: 1.2, enemyEvery: 5 });

  Start() {
    this.StartCoroutine(this.SpawnCoins());
    this.StartCoroutine(this.SpawnEnemies());
  }

  *SpawnCoins() {
    while (true) {
      yield new WaitForSeconds(this.coinEvery);
      if (GameManager.instance.state !== 'playing') continue;
      const x = this.game.rng.range(40, 920), y = this.game.rng.range(40, 500);
      this.Instantiate('prefabs/coin.prefab.json', { pos: [x, y, 1] });
    }
  }

  *SpawnEnemies() {
    while (true) {
      // more score = enemies come faster (but never faster than every 1.5 s)
      yield new WaitForSeconds(Math.max(1.5, this.enemyEvery - GameManager.instance.score * 0.15));
      if (GameManager.instance.state !== 'playing') continue;
      const side = this.game.rng.chance(0.5);
      this.Instantiate('prefabs/enemy.prefab.json', { pos: [side ? 20 : 940, this.game.rng.range(40, 500), 2] });
    }
  }
}
