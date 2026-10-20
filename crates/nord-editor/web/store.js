// Browser glue for the Nord editor (M11-06): IndexedDB persistence for the in-memory project tree, file pickers, downloads.
// Plain JS, no dependencies, no network.
let dbp;
const db = () =>
  (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('nord-editor', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));

/** Every stored file as [[path, Uint8Array], ...]. */
export async function load_all() {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction('files');
    const s = t.objectStore('files');
    const k = s.getAllKeys();
    const v = s.getAll();
    t.oncomplete = () => res(k.result.map((key, i) => [key, v.result[i]]));
    t.onerror = () => rej(t.error);
  });
}

export function put(path, bytes) {
  const copy = bytes.slice(); // `bytes` is a view into wasm memory: copy before anything async
  return db().then((d) => d.transaction('files', 'readwrite').objectStore('files').put(copy, path));
}

export async function del(path) {
  const d = await db();
  d.transaction('files', 'readwrite').objectStore('files').delete(path);
}

/** Open the browser file picker. Resolves to [[name, Uint8Array], ...] (empty when cancelled). */
export function pick_files(accept, multiple) {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = multiple;
    i.onchange = async () => res(await Promise.all([...i.files].map(async (f) => [f.name, new Uint8Array(await f.arrayBuffer())])));
    i.oncancel = () => res([]);
    i.click();
  });
}

/** Save bytes as a downloaded file. */
export function download(name, bytes) {
  bytes = bytes.slice();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes]));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** GET a same-origin file; Uint8Array or null. */
export async function fetch_bytes(url) {
  try {
    const r = await fetch(url);
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
