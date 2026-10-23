import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPanGesture, snapActive, snapValue, zoomAbout, viewHotkey } from './sceneview.js';

test('pan gestures match the Scene view', () => {
  assert.ok(isPanGesture({ button: 1 }));
  assert.ok(isPanGesture({ button: 2 }));
  assert.ok(isPanGesture({ button: 0, altKey: true }));
  assert.ok(isPanGesture({ button: 0 }, { space: true }));
  assert.ok(isPanGesture({ button: 0 }, { hand: true }));
  assert.ok(!isPanGesture({ button: 0 }));
});
test('Ctrl/Cmd inverts snapping', () => {
  assert.equal(snapActive(true, { ctrlKey: false }), true);
  assert.equal(snapActive(true, { ctrlKey: true }), false);
  assert.equal(snapActive(false, { metaKey: true }), true);
  assert.equal(snapValue(13, 8, true), 16);
  assert.equal(snapValue(13, 8, false), 13);
  assert.equal(snapValue(13, 0, true), 13);
});
test('zoom keeps the point under the cursor fixed', () => {
  const v = { x: 30, y: 30, zoom: 1 };
  const wx = (100 - v.x) / v.zoom;
  zoomAbout(v, 100, 100, 2);
  assert.equal(v.zoom, 2);
  assert.ok(Math.abs((100 - v.x) / v.zoom - wx) < 1e-9);
  assert.equal(zoomAbout(v, 0, 0, 100), 6, 'clamped');
});
test('hotkeys', () => {
  assert.equal(viewHotkey({ code: 'KeyQ' }), 'hand');
  assert.equal(viewHotkey({ code: 'KeyF', shiftKey: true }), 'frame');
  assert.equal(viewHotkey({ code: 'KeyF' }), null, 'plain F stays a tool key in the level editors');
  assert.equal(viewHotkey({ code: 'Home' }), 'fit');
  assert.equal(viewHotkey({ code: 'KeyQ', ctrlKey: true }), null);
});
