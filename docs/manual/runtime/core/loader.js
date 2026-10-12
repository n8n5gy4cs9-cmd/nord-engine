// Asset loader: progress reporting, offline-safe (relative paths only), file:// safe via inlined bundle.
// In single-file/file:// exports the builder defines `globalThis.__NORD_FILES__ = { "assets/x.png": "data:..." }`.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/** Throws on absolute/external URLs so a stray CDN reference fails loudly instead of breaking offline. */
export function safePath(path) {
  if (EXTERNAL.test(path) || path.startsWith('/') || path.split('/').includes('..')) throw new Error(`[nord] external or unsafe asset path: ${path}`);
  return path;
}

export class Loader {
  constructor({ files = globalThis.__NORD_FILES__, inlineOnly = false, fetchFn = (...a) => globalThis.fetch(...a) } = {}) {
    this.files = files ?? null;
    this.inlineOnly = inlineOnly; // single-file/file:// exports: a path missing from the bundle is an error, never a fetch
    this.fetchFn = fetchFn;
    this.cache = new Map();
  }
  url(path) { safePath(path); return this.files?.[path] ?? path; }
  async #get(path, kind) {
    const key = `${kind}:${path}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, (async () => {
        if (this.inlineOnly && !(path in (this.files ?? {}))) throw new Error(`[nord] ${path} is not in the inlined bundle`); // never fetch on file://
        const res = await this.fetchFn(this.url(path));
        if (!res.ok) throw new Error(`[nord] failed to load ${path} (${res.status})`);
        return kind === 'json' ? res.json() : kind === 'text' ? res.text() : res.arrayBuffer();
      })());
    }
    return this.cache.get(key);
  }
  json(path) { return this.#get(path, 'json'); }
  text(path) { return this.#get(path, 'text'); }
  binary(path) { return this.#get(path, 'binary'); }
  /** Optional sidecar `<asset>.meta.json` (spritesheet frames, anims, filter…). Resolves to null when absent. */
  async meta(path) {
    const key = `meta:${path}`;
    if (!this.cache.has(key)) this.cache.set(key, this.#get(`${path}.meta.json`, 'json').catch(() => null));
    return this.cache.get(key);
  }
  /** Load many `{path, kind}` (kind: json|text|binary); calls onProgress(done, total, path). Rejects with all failures listed. */
  async loadAll(list, onProgress = () => {}) {
    let done = 0;
    const errors = [];
    await Promise.all(list.map(async ({ path, kind = 'binary' }) => {
      try { await this.#get(path, kind); } catch (e) { errors.push(e.message); }
      onProgress(++done, list.length, path);
    }));
    if (errors.length) throw new Error(errors.join('\n'));
  }
}
