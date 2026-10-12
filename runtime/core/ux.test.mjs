import test from 'node:test';
import assert from 'node:assert/strict';
import { UndoStack, createI18n, virtualRange, moveItem } from '../../library/apps/_ux.js';

test('undo stack: undo/redo, coalescing, limit, redo cleared by new push', () => {
  let v = 0; const st = new UndoStack(3);
  const set = (to, key, t) => { const from = v; v = to; st.push({ undo: () => { v = from; }, redo: () => { v = to; } }, { key, now: t }); };
  set(1, 'slider', 0); set(2, 'slider', 100); set(3, 'slider', 200);
  assert.equal(st.past.length, 1, 'coalesced'); st.undo(); assert.equal(v, 0); st.redo(); assert.equal(v, 3);
  set(10, null, 5000); st.undo(); assert.equal(v, 3); set(20, null, 6000); assert.equal(st.canRedo, false);
  [1, 2, 3, 4].forEach((n, i) => set(n, null, 9000 + i * 1000)); assert.equal(st.past.length, 3, 'limit');
});
test('i18n: fallback, plurals, formatting', () => {
  const t = createI18n({ en: { hi: 'Hello {name}', files: { one: '{n} file', other: '{n} files' } }, de: { hi: 'Hallo {name}', files: { one: '{n} Datei', other: '{n} Dateien' } } }, { locale: 'de-AT' });
  assert.equal(t.locale, 'de'); assert.equal(t.t('hi', { name: 'Ada' }), 'Hallo Ada'); assert.equal(t.t('files', { n: 1 }), '1 Datei'); assert.equal(t.t('files', { n: 5 }), '5 Dateien');
  t.locale = 'fr'; assert.equal(t.t('files', { n: 2 }), '2 files', 'falls back to en'); assert.equal(t.t('missing'), 'missing');
  t.locale = 'de'; assert.equal(t.number(1234.5), '1.234,5'); assert.equal(t.bytes(2048), '2 KB'); assert.equal(t.dir(), 'ltr');
});
test('virtual range and reorder', () => {
  assert.deepEqual(virtualRange(10000, 28, 0, 560, 0), { start: 0, end: 20, offset: 0, total: 280000 });
  const r = virtualRange(10000, 28, 28000, 560, 5); assert.equal(r.start, 995); assert.equal(r.end, 10000 > 1025 ? 1025 : 10000); assert.equal(r.offset, 995 * 28);
  assert.equal(virtualRange(3, 28, 0, 560).end, 3);
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
});
