// Unity lifecycle extras: OnBecameVisible / OnBecameInvisible, OnApplicationFocus / Pause / Quit, OnValidate, [RequireComponent] / [DisallowMultipleComponent].
// Plain JS on Entity / Scene; backends only answer `isVisible(entity)`.
//
//   class Mover extends MonoBehaviour {
//     static RequireComponent = [Rigidbody2D, 'collider'];     // added automatically when the script is added
//     static DisallowMultipleComponent = true;                 // a second Mover on the same object is refused
//     OnBecameVisible() { … }  OnBecameInvisible() { … }       // camera starts / stops seeing the object
//     OnApplicationFocus(hasFocus) { … }  OnApplicationPause(paused) { … }  OnApplicationQuit() { … }
//     OnValidate() { … }                                       // after the script's fields were set or edited
//   }

/** Filled by unity-extra.js: `ensureRequired(entity, need)` adds a required component/script (Unity wrapper class, Nord component name or script class). */
export const sceneHooks = { ensureRequired: null };

// ---------------------------------------------------------------- scene system: visibility + OnValidate
const defines = (s, nord, unity) => !!s[unity] || (typeof s[nord] === 'function' && !s[nord].__alias);
const WANTS_VIS = (e) => e.scripts.some((s) => defines(s, 'onBecameVisible', 'OnBecameVisible') || defines(s, 'onBecameInvisible', 'OnBecameInvisible'));

/** Scene system (registered by Game.loadScene): OnBecameVisible/Invisible, OnValidate. */
export class LifecycleSystem {
  constructor(scene) { this.scene = scene; this.state = new WeakMap(); this.valid = new WeakSet(); }
  #validate(e) {
    for (const s of e.scripts) {
      if (this.valid.has(s)) continue;
      this.valid.add(s);
      if (defines(s, 'onValidate', 'OnValidate')) { try { s.onValidate(); } catch (err) { this.scene.game.reportError(err, s, 'onValidate'); } }
    }
  }
  start() { for (const e of this.scene.all()) this.#validate(e); }
  onCreated(e) { this.#validate(e); }
  update() {
    const backend = this.scene.game.backend;
    if (!backend?.isVisible) return;
    for (const e of this.scene.all()) {
      if (e.destroyed || !e.scripts.length || !WANTS_VIS(e)) continue;
      const now = e.enabled && !!backend.isVisible(e), was = this.state.get(e);
      if (now === was) continue;
      this.state.set(e, now);
      e.callScripts(now ? 'onBecameVisible' : 'onBecameInvisible');
    }
  }
}

// ---------------------------------------------------------------- application events
const toAll = (g, method, ...args) => { for (const e of g?.scene?.all?.() ?? []) e.callScripts(method, ...args); };
/** Browser focus / tab visibility / page close → OnApplicationFocus(bool), OnApplicationPause(bool), OnApplicationQuit() on every script of the running scene. */
export function installApplicationEvents(g) {
  if (g._appEvents || typeof window === 'undefined') return;
  g._appEvents = true;
  window.addEventListener('focus', () => toAll(g, 'onApplicationFocus', true));
  window.addEventListener('blur', () => toAll(g, 'onApplicationFocus', false));
  document.addEventListener('visibilitychange', () => toAll(g, 'onApplicationPause', document.hidden));
  window.addEventListener('pagehide', () => fireApplicationQuit(g));
}
/** `Application.Quit()` and closing the page call this (once per game). */
export function fireApplicationQuit(g) { if (!g || g._quitFired) return; g._quitFired = true; toAll(g, 'onApplicationQuit'); }

// ---------------------------------------------------------------- RequireComponent / DisallowMultipleComponent
/**
 * Called before a script instance is added to an entity. Returns false when `static DisallowMultipleComponent = true` and the entity already has one.
 * `static RequireComponent = [Rigidbody2D, 'collider', OtherScript]` adds what is missing (Unity wrapper classes, Nord component names or script classes).
 */
export function prepareScript(entity, Class, ensure) {
  if ((Class?.DisallowMultipleComponent || Class?.disallowMultipleComponent) && entity.scripts.some((s) => s.constructor === Class)) {
    entity.scene.game.warn(`[nord] ${Class.name}: DisallowMultipleComponent — ${entity.name} already has one`);
    return false;
  }
  for (const need of [].concat(Class?.RequireComponent ?? Class?.requireComponent ?? [])) ensure(entity, need);
  return true;
}
