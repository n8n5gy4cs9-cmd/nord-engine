// Tiny event emitter used for the global bus and per-entity events.
export class Events {
  #h = new Map();
  on(name, fn) {
    if (!this.#h.has(name)) this.#h.set(name, new Set());
    this.#h.get(name).add(fn);
    return () => this.off(name, fn);
  }
  once(name, fn) {
    const off = this.on(name, (...a) => { off(); fn(...a); });
    return off;
  }
  off(name, fn) { this.#h.get(name)?.delete(fn); }
  emit(name, data) {
    for (const fn of [...(this.#h.get(name) ?? [])]) fn(data);
  }
  clear() { this.#h.clear(); }
}
