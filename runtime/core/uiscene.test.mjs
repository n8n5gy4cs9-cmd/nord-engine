import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scalerFactor, compileSkin, tintSkin, validate } from './uiscene.js';

test('canvas scaler: constant / scale (log blend) / fit', () => {
  assert.equal(scalerFactor(undefined, 800, 600), 1);
  assert.equal(scalerFactor({ mode: 'constant', factor: 2 }, 800, 600), 2);
  assert.equal(scalerFactor({ mode: 'scale', ref: [1280, 720], match: 0 }, 2560, 720), 2, 'match width');
  assert.equal(scalerFactor({ mode: 'scale', ref: [1280, 720], match: 1 }, 2560, 720), 1, 'match height');
  assert.ok(Math.abs(scalerFactor({ mode: 'scale', ref: [1280, 720] }, 2560, 1440) - 2) < 1e-9);
  assert.equal(scalerFactor({ mode: 'fit', ref: [1280, 720] }, 640, 640), 0.5);
  assert.equal(scalerFactor({ mode: 'scale' }, 0, 0), 1, 'unmeasured host');
});

test('sprite-state rules compile to hover / pressed / disabled selectors', () => {
  const css = compileSkin({ styles: { '.sp1': { image: { src: 'a.png', slice: [4, 4, 4, 4] }, hover: { image: { src: 'b.png', slice: [4, 4, 4, 4] } }, pressed: { image: { src: 'c.png' } }, disabled: { image: { src: 'd.png' } } } } }, '/');
  assert.match(css, /\.sp1\{[^}]*a\.png/);
  assert.match(css, /\.sp1:hover\{[^}]*b\.png/);
  assert.match(css, /\.sp1:active\{[^}]*c\.png/);
  assert.match(css, /\.sp1:disabled\{[^}]*d\.png/);
});

test('tintSkin leaves a skin alone without a canvas', async () => {
  const skin = { styles: { button: { image: { src: 'x.png', tint: '#ff0000' } } } };
  assert.equal(await tintSkin(skin), skin);
});

test('scaler and sprites are accepted by validate()', () => {
  assert.deepEqual(validate({ scaler: { mode: 'scale', ref: [1280, 720] }, root: { type: 'panel', children: [{ type: 'button', name: 'b', sprites: { normal: 'a.png' } }] } }), []);
});
