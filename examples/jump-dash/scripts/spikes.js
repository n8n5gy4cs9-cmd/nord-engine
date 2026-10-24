import { MonoBehaviour, SerializeField } from 'nord';
import Player from './player.js';

export default class Spikes extends MonoBehaviour {
  static attributes = SerializeField({ damage: 1 });
  OnTriggerEnter(other) { other.getScript(Player)?.Hurt(); }   // only the player has a Player script
}
