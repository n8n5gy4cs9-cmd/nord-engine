// Weapon table (player + enemy reuse). Add weapons in <project>/fpsc/bank.json "weapons" (same fields) — docs/FPS_CREATOR.md §Weapons.
// type: 'melee' | 'hitscan' | 'projectile';  ammo: key of the ammo pool ('bullets'|'shells'|'rockets'|'cells'|null);  mag: rounds per clip (0 = draw from pool directly)
export const AMMO = {
  bullets: { label: 'Bullets', max: 200 },
  shells: { label: 'Shells', max: 50 },
  rockets: { label: 'Rockets', max: 25 },
  cells: { label: 'Cells', max: 150 },
};

export const WEAPONS = {
  knife: { id: 'knife', label: 'Combat knife', slot: 1, type: 'melee', dmg: 40, rate: 0.5, range: 2.1, ammo: null, mag: 0, sfx: 'swing', hitSfx: 'punch', auto: false,
    view: { pos: [0.3, -0.32, 0.55], parts: [{ shape: 'box', s: [0.04, 0.05, 0.4], p: [0, 0, 0.2], c: '#cfd3d8' }, { shape: 'box', s: [0.06, 0.07, 0.16], p: [0, 0, -0.05], c: '#2b2b2b' }] } },
  pistol: { id: 'pistol', label: 'Pistol', slot: 2, type: 'hitscan', dmg: 22, rate: 0.28, spread: 0.008, range: 80, ammo: 'bullets', mag: 12, reload: 1.1, sfx: 'pistol', auto: false, flash: 0.9, recoil: 0.06, tracer: '#ffe6a0',
    view: { pos: [0.26, -0.26, 0.55], parts: [{ shape: 'box', s: [0.055, 0.075, 0.32], p: [0, 0.03, 0.17], c: '#3a3f47' }, { shape: 'box', s: [0.05, 0.05, 0.3], p: [0, -0.02, 0.15], c: '#22252a' }, { shape: 'box', s: [0.05, 0.14, 0.075], p: [0, -0.1, 0.0], r: [0.12, 0, 0], c: '#4a3524' }, { shape: 'box', s: [0.012, 0.02, 0.02], p: [0, 0.08, 0.3], c: '#aaa' }, { shape: 'box', s: [0.012, 0.02, 0.02], p: [0, 0.08, 0.03], c: '#aaa' }], hand: [0, -0.1, 0.0] } },
  shotgun: { id: 'shotgun', label: 'Shotgun', slot: 3, type: 'hitscan', dmg: 11, pellets: 9, rate: 0.95, spread: 0.065, range: 40, ammo: 'shells', mag: 6, reload: 2.2, sfx: 'shotgun', auto: false, flash: 1.5, recoil: 0.16, tracer: '#ffd27a', shake: 0.3,
    view: { pos: [0.28, -0.28, 0.6], parts: [{ shape: 'box', s: [0.08, 0.09, 0.8], p: [0, 0, 0.3], c: '#303338' }, { shape: 'box', s: [0.09, 0.1, 0.34], p: [0, -0.02, 0.1], c: '#6b4a2e' }, { shape: 'box', s: [0.07, 0.14, 0.1], p: [0, -0.1, -0.12], c: '#6b4a2e' }] } },
  rifle: { id: 'rifle', label: 'Assault rifle', slot: 4, type: 'hitscan', dmg: 14, rate: 0.085, spread: 0.018, range: 100, ammo: 'bullets', mag: 30, reload: 1.7, sfx: 'rifle', auto: true, flash: 1.0, recoil: 0.03, tracer: '#fff0a0',
    view: { pos: [0.27, -0.27, 0.55], aim: { zoom: 0.72 }, parts: [{ shape: 'box', s: [0.07, 0.1, 0.62], p: [0, 0, 0.25], c: '#272b30' }, { shape: 'box', s: [0.06, 0.2, 0.09], p: [0, -0.14, 0.12], c: '#1c1f23' }, { shape: 'box', s: [0.07, 0.12, 0.2], p: [0, -0.04, -0.15], c: '#3a3f46' }, { shape: 'box', s: [0.02, 0.04, 0.03], p: [0, 0.07, 0.5], c: '#aaa' }] } },
  rocket: { id: 'rocket', label: 'Rocket launcher', slot: 5, type: 'projectile', dmg: 110, splash: 4.2, rate: 1.1, ammo: 'rockets', mag: 0, sfx: 'rocket', auto: false, flash: 1.4, recoil: 0.12, shake: 0.4,
    projectile: { speed: 22, color: '#ffb040', size: 0.16, light: 6, explode: true, trail: '#9a9a9a' },
    view: { pos: [0.3, -0.3, 0.6], parts: [{ shape: 'cyl', s: [0.17, 0.9, 0.17], p: [0, 0.02, 0.3], r: [Math.PI / 2, 0, 0], c: '#4a5a40' }, { shape: 'cyl', s: [0.22, 0.12, 0.22], p: [0, 0.02, 0.76], r: [Math.PI / 2, 0, 0], c: '#222' }, { shape: 'box', s: [0.06, 0.16, 0.08], p: [0, -0.12, 0.1], c: '#222' }] } },
  plasma: { id: 'plasma', label: 'Plasma rifle', slot: 6, type: 'projectile', dmg: 28, splash: 1.4, rate: 0.14, ammo: 'cells', mag: 0, sfx: 'plasma', auto: true, flash: 1.0, recoil: 0.04,
    projectile: { speed: 34, color: '#6ee7ff', size: 0.1, light: 4, explode: true },
    view: { pos: [0.27, -0.26, 0.58], parts: [{ shape: 'box', s: [0.12, 0.14, 0.62], p: [0, 0, 0.25], c: '#586a80' }, { shape: 'box', s: [0.07, 0.08, 0.34], p: [0, 0, 0.42], c: '#6ee7ff', e: true }, { shape: 'box', s: [0.08, 0.16, 0.1], p: [0, -0.13, 0.05], c: '#2a3138' }] } },
};

/**
 * Aim-down-sights (right mouse button) pose of a weapon: { pos:[x,y,z] view-model position while aiming, zoom: FOV multiplier (<1 zooms in),
 * spread: multiplier on bullet spread, sens: multiplier on mouse look }. Edit any field per weapon with `view.aim` (bank.json); without `pos` the weapon
 * is centred so the top of its forward parts (barrel/sights) sits just under the crosshair.
 */
export function aimOf(w) {
  const v = w?.view ?? {}, a = v.aim ?? {};
  const fwd = (v.parts ?? []).filter((q) => (q.p?.[2] ?? 0) > 0.1);
  const flat = (q) => Math.abs(Math.abs(q.r?.[0] ?? 0) - Math.PI / 2) < 0.3; // a cylinder lying along Z is as tall as it is wide
  const top = fwd.length ? Math.max(...fwd.map((q) => (q.p[1] ?? 0) + (flat(q) ? q.s[2] : q.s[1]) / 2)) : 0.05;
  return { pos: a.pos ?? [0, -top - 0.012, (v.pos?.[2] ?? 0.55) - 0.05], zoom: a.zoom ?? 0.85, spread: a.spread ?? 0.35, sens: a.sens ?? 0.75 };
}

export const weaponDef = (id, bank) => bank?.weapon?.(id) ?? WEAPONS[id] ?? null;
export const WEAPON_ORDER = Object.keys(WEAPONS);
