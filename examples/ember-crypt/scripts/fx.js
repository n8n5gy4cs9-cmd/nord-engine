import { Instantiate, Destroy, Time } from 'nord';

/** Small visual effects, all made from prefabs. A static helper class like Unity's "effects manager". */
export default class Fx {
  /** A number or word that floats up and fades (the FloatText script on the prefab does the moving). */
  static FloatText(x, y, text, color = '#ffffff') {
    return Instantiate('prefabs/floattext.prefab.json', { pos: [x, y - 10, 5], overrides: { components: { 0: { text: String(text), color } } } });
  }

  /** A one-shot burst of particles. Settings override the burst prefab. */
  static Burst(x, y, settings = {}) {
    const o = { tint: '#ffd27a', tintEnd: '#ff5a1f', burst: 14, lifespan: 450, ...settings };
    return Instantiate('prefabs/burst.prefab.json', { pos: [x, y, 6], overrides: { components: { 0: o } } }).then((fx) => Destroy(fx, o.lifespan / 1000 + 0.3));
  }

  /** Freeze the game for a blink on a heavy hit. Real time: the game clock is the thing we slow down. */
  static HitStop(ms = 60) {
    Time.timeScale = 0.05;
    setTimeout(() => { Time.timeScale = 1; }, ms);
  }
}
