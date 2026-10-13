// IndexedDB keeps text and pictures together without a server or external library.
export async function openNotebook() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('nord.notepaint', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transact = (mode, action) => new Promise((resolve, reject) => {
    const tx = db.transaction('documents', mode);
    const request = action(tx.objectStore('documents'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Save cancelled'));
  });
  return {
    all: () => transact('readonly', s => s.getAll()),
    put: doc => transact('readwrite', s => s.put(doc)),
    remove: id => transact('readwrite', s => s.delete(id)),
    close: () => db.close(),
  };
}
export const newDocument = (title = 'Untitled') => ({ id: globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), title, text: '', image: '', updatedAt: Date.now() });
export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function readDocument(value) {
  if (value?.format !== 'notepaint' || value.version !== 1 || !value.document || typeof value.document.text !== 'string' || typeof value.document.title !== 'string') throw new Error('Choose a Notepaint .json document.');
  const d = value.document;
  if (d.image && (typeof d.image !== 'string' || !d.image.startsWith('data:image/png;base64,') || d.image.length > 12000000)) throw new Error('The drawing must be an embedded PNG under 12 MB.');
  if (d.text.length > 1000000) throw new Error('The note is too large (maximum 1 million characters).');
  return { ...newDocument(d.title.slice(0, 120)), text: d.text, image: d.image || '' };
}
