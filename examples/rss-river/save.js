// Versioned save slots on top of localStorage (or any Storage-like object).
export class Save {
  constructor(gameId, { version = 1, storage = globalThis.localStorage, migrate = null } = {}) {
    this.prefix = `nord:${gameId}:`;
    this.version = version;
    this.storage = storage ?? new MemoryStorage();
    this.migrate = migrate; // (data, fromVersion) => data
    this.slotId = 0;
  }
  slot(n) { this.slotId = n; return this; }
  #key(n = this.slotId) { return `${this.prefix}slot${n}`; }
  #read(n) {
    try {
      const raw = this.storage.getItem(this.#key(n));
      if (!raw) return { v: this.version, data: {} };
      const o = JSON.parse(raw);
      if (o.v < this.version && this.migrate) { o.data = this.migrate(o.data, o.v); o.v = this.version; }
      return o;
    } catch { return { v: this.version, data: {} }; }
  }
  get(k, def) { const d = this.#read().data; return k in d ? d[k] : def; }
  set(k, v) { const o = this.#read(); o.data[k] = v; o.v = this.version; o.t = Date.now(); this.storage.setItem(this.#key(), JSON.stringify(o)); }
  all() { return this.#read().data; }
  has(n = this.slotId) { return this.storage.getItem(this.#key(n)) != null; }
  delete(n = this.slotId) { this.storage.removeItem(this.#key(n)); }
}
export class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
}
