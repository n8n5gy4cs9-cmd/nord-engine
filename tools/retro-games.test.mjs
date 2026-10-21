import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  driver,
  traffic,
  updateDriver,
  padInput,
  COURSE,
} from './examples/coastline-sprint/src/track.js';
import { newFlight, tick } from './examples/vector-patrol/scripts/sim.js';
test('coast steering, nitro, traffic impact, checkpoints, finish and timeout', () => {
  const p = driver(),
    cars = traffic();
  for (let i = 0; i < 100; i++)
    updateDriver(p, { accel: 1, brake: 0, steer: 0, boost: true }, 0.02, []);
  assert(p.speed > 0 && p.nitro < 1);
  p.z = COURSE.checkpoints[0] - 1;
  p.speed = 3000;
  const time = p.time;
  assert(
    updateDriver(p, { accel: 1, brake: 0, steer: 0 }, 0.02, []).includes('checkpoint'),
  );
  assert(p.time > time);
  p.cooldown = 0;
  const hits = p.hits;
  updateDriver(p, { accel: 0, brake: 0, steer: 0 }, 0.01, [{ z: p.z + 10, x: p.x }]);
  assert.equal(p.hits, hits + 1);
  p.z = COURSE.length - 1;
  p.speed = 3000;
  updateDriver(p, { accel: 1, brake: 0, steer: 0 }, 0.02, []);
  assert(p.finished);
  const q = driver();
  q.time = 0.001;
  updateDriver(q, { accel: 0, brake: 0, steer: 0 }, 0.02, cars);
  assert(q.lost);
});
test('gamepad mapping and independent split-screen driver state', () => {
  const a = driver(0),
    b = driver(1);
  assert.notEqual(a.x, b.x);
  const input = padInput({
    axes: [0.5],
    buttons: Array.from({ length: 8 }, (_, i) => ({ value: i === 7 ? 1 : 0 })),
  });
  assert.equal(input.accel, 1);
  assert.equal(input.steer, 0.5);
  updateDriver(b, input, 0.05, []);
  assert(b.z > 0);
  assert.equal(a.z, 0);
});
test('flight steering, roll grace, shooting, damage, pickup and complete boss win', () => {
  const s = newFlight(),
    none = { x: 0, y: 0, fire: false, roll: false };
  tick(s, { ...none, x: 1, roll: true }, 0.05);
  assert(s.x > 0 && s.shield > 0);
  s.enemies = [{ id: 1, x: s.x, y: s.y, z: 12, hp: 1, fire: 10 }];
  s.shots = [{ x: s.x, y: s.y, z: 8 }];
  tick(s, none, 0.02);
  assert.equal(s.enemies.length, 0);
  assert(s.score >= 100);
  s.shield = 0;
  s.hostile = [{ x: s.x, y: s.y, z: 1, vx: 0, vy: 0 }];
  tick(s, none, 0.02);
  assert(s.hp < 100);
  const hp = s.hp;
  tick(s, none, 0.02);
  assert.equal(s.hp, hp);
  s.cells = [{ x: s.x, y: s.y, z: 1 }];
  tick(s, none, 0.02);
  assert(s.hp > hp);
  s.time = 66;
  s.boss = true;
  s.bossZ = 48;
  s.bossHP = 1;
  s.shots = [{ x: 0, y: 0, z: 46 }];
  tick(s, none, 0.02);
  assert(s.won && s.score >= 2500);
  const score = s.score;
  tick(s, none, 0.05);
  assert.equal(s.score, score);
});

test('off-road drag never accelerates a stopped car', () => {
  const p = driver();
  p.x = 1.5;
  updateDriver(p, { accel: 0, brake: 0, steer: 0, boost: false }, 0.05, []);
  assert.equal(p.speed, 0);
  assert.equal(p.z, 0);
});

test('flight death and boss defeat cannot award both outcomes in one frame', () => {
  const s = newFlight();
  s.time = 66;
  s.hp = 1;
  s.shield = 0;
  s.bossHP = 1;
  s.bossZ = 48;
  s.enemies = [{ id: 1, x: 0, y: 0, z: 0.2, hp: 1, fire: 99 }];
  s.shots = [{ x: 0, y: 0, z: 46 }];
  tick(s, { x: 0, y: 0, fire: false, roll: false }, 0.02);
  assert(s.lost);
  assert.equal(s.won, false);
  assert(s.score < 2500);
});
