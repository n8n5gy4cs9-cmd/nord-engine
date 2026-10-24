import { Singleton } from 'nord';
export default class Keeper extends Singleton { static persistent = true; Awake() { this.value = 41; } }
