import test from 'node:test';
import assert from 'node:assert/strict';
import { initWorld, advanceClock, resolveContact, fillContacts, phase, snapshot, validSave } from './examples/xkom/scripts/xk/campaign.js';
const make = () => { const C = { day: 3, missions: 0, rtsDone: 0, presence: 0, funds: 3000 }; initWorld(C, Array.from({ length: 40 }, (_, i) => [i, 4]), 42); return C; };
test('persistent contacts, slow first occupation, penalties, replacements and liberation', () => {
  const C = make(), first = C.contacts[0], ids = C.contacts.map(s => s.id);
  advanceClock(C, 359, 42); assert.deepEqual(C.contacts.map(s => s.id), ids); assert.equal(C.towns.some(t => t.occupied), false);
  const r = advanceClock(C, 1, 42); assert.equal(r.days, 1); assert.equal(C.idleDays, 4); assert.equal(C.funds, 2800); assert.equal(C.towns.find(t => t.id === first.townId).occupied, true); assert.ok(r.events[0].includes('OCCUPIED')); assert.equal(C.contacts.length, 3); assert.ok(!C.contacts.some(s => s.id === first.id));
  const target = C.contacts.find(s => s.townId === first.townId) ?? { id: -1, townId: first.townId }; resolveContact(C, target, true, 42); assert.equal(C.towns.find(t => t.id === first.townId).occupied, false);
});
test('pause preserves partial day; mission calendar changes do not expire waiting deadlines', () => {
  const C = make(); advanceClock(C, 30, 42); C.clockPaused = true; advanceClock(C, 900, 42); assert.equal(C.clockSeconds, 30); assert.equal(C.idleDays, 0);
  C.day += 30; C.clockPaused = false; advanceClock(C, 60, 42); assert.equal(C.idleDays, 1); assert.equal(C.towns.some(t => t.occupied), false);
});
test('enemy strength increases with missions and waiting, bounded for the tactical map', () => {
  const C = make(), initial = C.contacts.map(s => s.aliens); C.contacts = []; C.contactSerial = 0; C.missions = 20; C.idleDays = 20; fillContacts(C, 42);
  assert.ok(C.contacts.every(s => s.aliens >= Math.min(...initial) + 10 && s.aliens <= 20));
});

test('score and research gate a two-stage finale; checkpoints are independent and versioned', async () => {
  const { newSquad } = await import('./examples/xkom/scripts/xk/tactical.js');
  const C = Object.assign(make(), { squad: newSquad(42), kills: 0, lost: 0, over: false, sourceSecured: false, R: { done: [], active: null, progress: 0 } });
  assert.equal(phase(C, 40), 'GATHER INTEL'); C.kills = 40; assert.equal(phase(C, 40), 'RESEARCH ELERIUM'); C.R.done = ['alloys','laser','elerium']; assert.equal(phase(C, 40), 'SOURCE RAID');
  const s = snapshot(C, 42, 40); assert.equal(validSave(s), true); C.sourceSecured = true; C.funds = 0; assert.equal(s.C.sourceSecured, false); assert.equal(s.C.funds, 3000); assert.equal(phase(C, 40), 'FINAL ASSAULT');
  assert.equal(validSave({ ...s, version: 0 }), false); assert.equal(validSave({ version: 1, seed: 42, goal: 40, C: {} }), false); C.over = true; C.victory = true; assert.equal(phase(C, 40), 'VICTORY');
});
