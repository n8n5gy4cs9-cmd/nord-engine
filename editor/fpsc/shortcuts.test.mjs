import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHORTCUTS, normalizeShortcuts, matchesShortcut } from './shortcuts.js';

test('missing and invalid saved shortcuts fall back independently', () => {
  assert.deepEqual(normalizeShortcuts(), DEFAULT_SHORTCUTS);
  const value = normalizeShortcuts({ test: { key: ' F6 ', command: true }, test_here: { key: 42 }, stop: { key: 'not a key' } });
  assert.equal(value.test.key, 'F6');
  assert.equal(value.test.command, true);
  assert.deepEqual(value.test_here, DEFAULT_SHORTCUTS.test_here);
  assert.deepEqual(value.stop, DEFAULT_SHORTCUTS.stop);
});

test('modifiers are exact, command accepts Mac/PC, held keys do not restart', () => {
  const b = { key: 'F8', command: true, shift: false, alt: false };
  assert.ok(matchesShortcut({ key: 'F8', code: 'F8', metaKey: true }, b));
  assert.ok(matchesShortcut({ key: 'F8', code: 'F8', ctrlKey: true }, b));
  assert.ok(!matchesShortcut({ key: 'F8', code: 'F8' }, b));
  assert.ok(!matchesShortcut({ key: 'F8', code: 'F8', ctrlKey: true, shiftKey: true }, b));
  assert.ok(!matchesShortcut({ key: 'F8', code: 'F8', ctrlKey: true, repeat: true }, b));
});

test('shifted digits and punctuation match their physical key', () => {
  assert.ok(matchesShortcut({ key: '!', code: 'Digit1', shiftKey: true }, { key: '1', shift: true, command: false, alt: false }));
  assert.ok(matchesShortcut({ key: '>', code: 'Period', shiftKey: true }, { key: '.', shift: true, command: false, alt: false }));
  assert.ok(matchesShortcut({ key: 'Escape', code: 'Escape', shiftKey: true }, DEFAULT_SHORTCUTS.stop));
});
