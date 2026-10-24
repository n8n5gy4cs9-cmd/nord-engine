// The ready-made GameManager (score, state, events) attached to the Director. Not persistent: every run owns its manager.
import { GameManager } from 'nord';

GameManager.persistent = false;
export default GameManager;
