// Small deterministic campaign clock. Only the view decides whether real time is allowed to advance.
export const DAY_SECONDS = 90;
const NAMES = ['HAVEN', 'ASHFORD', 'RIVERTON', 'NORTHWATCH', 'GREYHAVEN', 'MERIDIAN'];
const TYPES = [{ kind: 'SCOUT LANDING', icon: 0, base: 4, relief: 8 }, { kind: 'FARM RAID', icon: 0, base: 5, relief: 10 }, { kind: 'TERROR SITE', icon: 1, base: 7, relief: 14 }];
function random(seed) { return () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function initWorld(C, land, seed) {
  C.idleDays = 0; C.clockSeconds = 0; C.clockPaused = false; C.contactSerial = 0;
  const r = random(seed), used = new Set(); C.towns = NAMES.slice(0, Math.min(6, land.length)).map((name, id) => {
    let i; do { i = Math.floor(r() * land.length); } while (used.has(i)); used.add(i); const [x, y] = land[i]; return { id, name, x, y, occupied: false };
  }); C.contacts = []; fillContacts(C, seed);
}
export function fillContacts(C, seed) {
  while (C.contacts.length < Math.min(3, C.towns.length)) {
    const serial = C.contactSerial++, r = random(seed + serial * 7919 + C.missions * 31), available = C.towns.filter(t => !C.contacts.some(s => s.townId === t.id));
    const town = available[Math.floor(r() * available.length)], type = TYPES[Math.floor(r() * TYPES.length)];
    C.contacts.push({ ...type, name: town.name, x: town.x, y: town.y, townId: town.id, id: serial, aliens: Math.min(20, type.base + Math.floor(C.missions / 2) + Math.floor(C.idleDays / 3) + (town.occupied ? 2 : 0) + C.rtsDone), seed: Math.floor(r() * 1e6), expires: C.idleDays + 4 + C.contacts.length });
  }
}
export function resolveContact(C, site, win, seed) {
  const town = C.towns.find(t => t.id === site.townId); if (town) town.occupied = !win;
  C.contacts = C.contacts.filter(s => s.id !== site.id); fillContacts(C, seed);
}
export function idleDay(C, seed) {
  C.idleDays++; C.day++; const occupied = C.towns.filter(t => t.occupied).length;
  C.presence += 1 + occupied; C.funds = Math.max(0, C.funds - occupied * 50);
  const expired = C.contacts.filter(s => s.expires <= C.idleDays), events = [];
  for (const site of expired) {
    const town = C.towns.find(t => t.id === site.townId); if (!town.occupied) { town.occupied = true; C.funds = Math.max(0, C.funds - 200); C.presence += 8; events.push(`${town.name} OCCUPIED: -$200, THREAT +8`); }
    else { C.presence += 3; events.push(`${town.name}: ALIEN GARRISON REINFORCED`); }
  }
  C.contacts = C.contacts.filter(s => s.expires > C.idleDays); fillContacts(C, seed); return events;
}
export function advanceClock(C, seconds, seed) {
  if (C.clockPaused) return { days: 0, events: [] };
  C.clockSeconds += Math.max(0, seconds); let days = 0; const events = [];
  while (C.clockSeconds >= DAY_SECONDS) { C.clockSeconds -= DAY_SECONDS; days++; events.push(...idleDay(C, seed)); if (C.presence >= 100) { C.clockSeconds = 0; break; } }
  return { days, events };
}

// Intel comes from combat; Elerium analysis finds the source. The final raid opens the last Hive assault.
export function phase(C, goal) {
  if (C.over) return C.victory ? 'VICTORY' : 'DEFEAT';
  if (C.sourceSecured) return 'FINAL ASSAULT';
  if (C.kills < goal) return 'GATHER INTEL';
  return C.R.done.includes('elerium') ? 'SOURCE RAID' : 'RESEARCH ELERIUM';
}
export function snapshot(C, seed, goal, news = '') {
  return JSON.parse(JSON.stringify({ version: 1, seed, goal, news, C }));
}
// Saves are campaign checkpoints, deliberately independent of scene objects/timers.
export function validSave(s) {
  if (!s || s.version !== 1 || !Number.isFinite(s.seed) || !Number.isInteger(s.goal) || s.goal < 5 || s.goal > 200) return false;
  const C = s.C;
  if (!C || typeof C.over !== 'boolean' || !Array.isArray(C.squad) || C.squad.length > 6 || !C.squad.length) return false;
  if (!['funds','presence','kills','missions','lost','day','rtsDone','idleDays','clockSeconds','contactSerial'].every(k => Number.isFinite(C[k]) && C[k] >= 0)) return false;
  if (!C.R || !Array.isArray(C.R.done) || !C.R.done.every(id => ['alloys','armor','stims','logistics','laser','elerium','turrets'].includes(id)) || !Number.isFinite(C.R.progress) || (C.R.active !== null && !['alloys','armor','stims','logistics','laser','elerium','turrets'].includes(C.R.active))) return false;
  return Array.isArray(C.towns) && C.towns.length === 6 && C.towns.every(t => Number.isInteger(t.id) && Number.isFinite(t.x) && Number.isFinite(t.y) && typeof t.name === 'string' && typeof t.occupied === 'boolean') && Array.isArray(C.contacts) && C.contacts.length === 3 && C.contacts.every(t => C.towns.some(x => x.id === t.townId) && Number.isFinite(t.seed) && Number.isFinite(t.expires) && Number.isFinite(t.aliens)) && C.squad.every(m => typeof m.name === 'string' && ['hp','tu','kills','missions','firing','react'].every(k => Number.isFinite(m[k])));
}
