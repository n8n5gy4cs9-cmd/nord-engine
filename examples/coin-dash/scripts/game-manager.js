import { GameManager } from 'nord';

// Score, lives, state ('playing' / 'gameover') and Restart() come from the built-in GameManager.
// Other scripts use it like a C# singleton: GameManager.instance.AddScore(1).
export default class CoinGameManager extends GameManager {}
