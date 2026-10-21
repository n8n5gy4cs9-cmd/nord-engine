#!/usr/bin/env node
// Generates the FPS Creator demo level "Outpost Zero" (templates/fps-creator/levels/level1.fpsl.json) from code, so it can be re-made and tested.
// Usage: node tools/gen_fpsc_level.mjs [out.json]   (default: templates/fps-creator/levels/level1.fpsl.json)   Needs no browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newLevel, newLayer, setCell, setEdge, CELL, normalize } from '../runtime/fpsc/level.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? path.join(root, 'templates/fps-creator/levels/level1.fpsl.json');

export function outpostZero() {
  const lv = newLevel({ name: 'Outpost Zero', w: 44, d: 42 });
  lv.author = 'Crowelian 2026 + Sonnet';
  lv.layers.push(newLayer('Tower roof'));
  Object.assign(lv.settings, {
    sky: 'day', ground: 'grass', ambient: 0.5,
    intro: 'The outpost went dark three hours ago.\nFind the red key, get to the lab terminal, open the boss gate — and get out alive.\n\nWASD move · mouse look · E use · F flashlight · 1-6 weapons',
    objective: 'Find the exit. Hint: a red key opens the armory.',
  });
  let n = 0; const id = () => `e${String(++n).padStart(3, '0')}`;
  const ent = (type, cx, cz, o = {}) => { const e = { id: id(), type, x: cx * CELL, z: cz * CELL, layer: o.layer ?? 0, rot: o.rot ?? 0, name: o.name ?? '', tag: o.tag ?? '', target: o.target ?? '', props: o.props ?? {}, scripts: o.scripts ?? [], rules: o.rules ?? [] }; if (o.path) e.path = o.path.map(([x, z]) => [x * CELL, z * CELL]); if (o.y) e.y = o.y; lv.entities.push(e); return e; };
  const room = (L, x0, z0, x1, z1, { floor = 'floor_concrete', ceil = 'ceiling_tiles', wall = 'wall', tex = 'concrete', cells = true } = {}) => {
    if (cells) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) setCell(lv, L, x, z, { f: floor, c: ceil || null });
    for (let x = x0; x <= x1; x++) { setEdge(lv, L, x, z0, 'H', { k: wall, t: tex }); setEdge(lv, L, x, z1 + 1, 'H', { k: wall, t: tex }); }
    for (let z = z0; z <= z1; z++) { setEdge(lv, L, x0, z, 'V', { k: wall, t: tex }); setEdge(lv, L, x1 + 1, z, 'V', { k: wall, t: tex }); }
  };
  const edge = (L, x, z, o, piece) => setEdge(lv, L, x, z, o, piece);
  const cx = (c) => c + 0.5; // centre of a cell, in cell units

  // 1. start bunker -------------------------------------------------------------------------------------------------------------
  room(0, 2, 17, 7, 22, { floor: 'floor_concrete', tex: 'bunker' });
  edge(0, 8, 19, 'V', { k: 'door', t: 'bunker', td: 'door_metal' });
  ent('player_start', 4.5, 19.5, { rot: 90 });
  ent('light_ceiling', 3.5, 18.5); ent('light_ceiling', 5.5, 21);
  ent('table', 3.2, 21.2, { rot: 0 }); ent('chair', 3.6, 20.4, { rot: 200 }); ent('crate', 6.4, 17.7); ent('crate', 6.8, 18.3, { y: 0.9 }); ent('ammo_bullets', 6, 21.5); ent('health_small', 2.8, 17.9);
  ent('message_zone', 5, 19.5, { props: { w: 4, d: 4, text: 'Mission: find the exit.  [E] opens doors, [F] flashlight, [R] reload.', seconds: 6 } });
  ent('locker', 2.6, 19.8, { rot: 90 }); ent('plant', 7.2, 21.6);

  // Diagonal start-bunker corners are visible from the first room; all original edge data is retained.
  for (const [x,z,corner] of [[2,17,'SW'],[7,17,'SE'],[2,22,'NW'],[7,22,'NE']]) setCell(lv,0,x,z,{shape:{kind:'diagonal',corner,t:'bunker'}});

  // 2. corridor ------------------------------------------------------------------------------------------------------------------
  for (let x = 8; x <= 13; x++) { setCell(lv, 0, x, 19, { f: 'floor_concrete', c: 'ceiling_tiles' }); edge(0, x, 19, 'H', { k: x === 11 ? 'window' : 'wall', t: 'concrete' }); edge(0, x, 20, 'H', { k: 'wall', t: 'concrete' }); }
  edge(0, 14, 19, 'V', { k: 'doorway', t: 'concrete' });
  ent('light_neon', 9.5, 19.5); ent('light_neon', 12.5, 19.5);
  ent('enemy_guard', 12.4, 19.5, { rot: 270, path: [[12.4, 19.5], [9.6, 19.5]], props: { health: 40 } });
  ent('barrel', 8.7, 19.9);

  // 3. hall --------------------------------------------------------------------------------------------------------------------
  room(0, 14, 14, 21, 24, { floor: 'wood_floor', tex: 'plaster' });
  edge(0, 14, 19, 'V', { k: 'doorway', t: 'plaster' });
  for (const z of [15, 16, 17, 21, 22, 23]) edge(0, 22, z, 'V', { k: z % 2 ? 'window' : 'window_wide', t: 'plaster' });
  edge(0, 22, 19, 'V', { k: 'doorway', t: 'plaster' }); edge(0, 22, 18, 'V', { k: 'wall', t: 'plaster' }); edge(0, 22, 20, 'V', { k: 'wall', t: 'plaster' });
  edge(0, 17, 14, 'H', { k: 'door', t: 'metal_panel', td: 'door_red', name: 'armory', lock: 'red' });
  edge(0, 17, 25, 'H', { k: 'door', t: 'metal_panel', td: 'door_scifi' });
  ent('light_ceiling', 16, 16); ent('light_ceiling', 19, 16); ent('light_ceiling', 17.5, 22); ent('light_ceiling', 15.5, 19.5); ent('light_ceiling', 20, 21); ent('light_warm', 15, 23, { props: { range: 7 } });
  ent('light_alarm', 17.5, 19.5, { name: 'alarm1', props: { on: false } });
  ent('enemy_soldier', 19, 21, { rot: 180, path: [[19, 21], [19, 16], [15.5, 16], [15.5, 21]], props: { drop: 'ammo_bullets' } });
  ent('enemy_soldier', 16, 15.5, { rot: 90, props: {} }); ent('barrel_explosive', 20.4, 15.4); ent('barrel_explosive', 20.4, 15.9);
  ent('crate', 15.4, 23.4); ent('crate_metal', 20.2, 23.2); ent('table', 17.5, 17.4); ent('chair', 18.5, 17.5, { rot: 270 }); ent('sandbags', 19.5, 19.2, { rot: 90 });
  ent('checkpoint', 15, 19.5);
  ent('spawn_point', 16, 21, { name: 'sp_hall' });

  // Rounded hall corners demonstrate the same cuts at a larger scale without changing its doors/patrols.
  for (const [x,z,corner] of [[14,14,'SW'],[21,14,'SE'],[14,24,'NW'],[21,24,'NE']]) setCell(lv,0,x,z,{shape:{kind:'round',corner,t:'plaster'}});

  // 4. armory (red key) -------------------------------------------------------------------------------------------------------------
  room(0, 14, 8, 21, 13, { floor: 'floor_concrete', tex: 'metal_plate' });
  edge(0, 17, 14, 'H', { k: 'door', t: 'metal_panel', td: 'door_red', name: 'armory', lock: 'red' });
  ent('light_ceiling', 16, 10.5); ent('light_ceiling', 19.5, 10.5); ent('fx_sparks', 14.6, 8.6);
  ent('weapon_shotgun', 15.5, 12); ent('ammo_shells', 16.5, 12.2); ent('ammo_shells', 17.2, 12.2); ent('weapon_rifle', 20, 12); ent('ammo_bullets', 19.2, 12.2); ent('armor', 18, 9.5); ent('health_large', 15.5, 9.2); ent('weapon_rocket', 20.2, 9.2); ent('ammo_rockets', 19.4, 9.2);
  ent('locker', 14.6, 11, { rot: 90 }); ent('locker', 14.6, 10, { rot: 90 }); ent('crate_big', 20.2, 11);

  // 5. lab -----------------------------------------------------------------------------------------------------------------------
  room(0, 14, 25, 21, 30, { floor: 'tile_checker', tex: 'tiles_white', ceil: 'ceiling_tiles' });
  edge(0, 17, 25, 'H', { k: 'door', t: 'metal_panel', td: 'door_scifi' });
  ent('light_neon', 16, 27); ent('light_neon', 19.5, 27); ent('light_neon', 17.5, 29.2);
  ent('npc_scientist', 15, 28.7, { rot: 90, name: 'dr', props: { lines: 'You made it! The terminal on the north wall opens the boss gate.\nBut it will trip the alarm… be ready.\nThe red key? Up the tower in the courtyard.' } });
  ent('terminal', 19.4, 29.4, { rot: 180, name: 'labterm', props: { text: 'ALARM TRIPPED — BOSS GATE UNLOCKED', seconds: 4, prompt: 'Hack the terminal' },
    rules: [{ when: 'used', do: 'open', target: 'bossgate', once: true }, { when: 'used', do: 'emit', text: 'alarm', once: true }, { when: 'used', do: 'objective', text: 'Reach the boss arena north of the courtyard and escape.', once: true }, { when: 'used', do: 'spawn', text: 'enemy_drone', value: 2, target: 'sp_hall', once: true, delay: 2 }] });
  ent('fx_steam', 20.6, 25.9); ent('table', 15.4, 26.2); ent('plant', 21, 25.8); ent('plant', 14.7, 25.7); ent('health_small', 20.6, 26);

  // 6. courtyard (outdoors) + fence --------------------------------------------------------------------------------------------------
  for (let x = 22; x <= 35; x++) edge(0, x, 11, 'H', { k: 'fence', t: 'concrete' });
  for (let z = 11; z <= 25; z++) edge(0, 36, z, 'V', { k: 'fence', t: 'concrete' });
  for (let x = 22; x <= 23; x++) edge(0, x, 26, 'H', { k: 'fence', t: 'concrete' });
  for (let x = 35; x <= 35; x++) edge(0, x, 26, 'H', { k: 'fence', t: 'concrete' });
  for (let x = 23; x <= 35; x++) for (let z = 11; z <= 25; z++) if (!(x >= 32 && x <= 35 && z >= 13 && z <= 16)) setCell(lv, 0, x, z, { f: x > 22 && z > 17 && x < 31 ? 'dirt' : 'grass' });
  for (let z = 11; z <= 18; z++) edge(0, 22, z, 'V', { k: 'fence', t: 'concrete' });
  for (let z = 20; z <= 25; z++) if (![21, 22, 23].includes(z)) edge(0, 22, z, 'V', { k: 'fence', t: 'concrete' });
  ent('checkpoint', 24, 19.5);
  ent('tree', 25, 13.5); ent('tree', 28, 22.5); ent('tree', 34.5, 20.5); ent('tree', 24.2, 24.2); ent('rock', 27, 14.5); ent('rock', 30.5, 23.5, { rot: 40 });
  ent('fx_smoke', 30.5, 23.6); ent('fx_fire', 28.6, 19.3, { props: { range: 6 } }); ent('sandbags', 27, 18.5, { rot: 90 }); ent('sandbags', 29.5, 20.5); ent('barrel_explosive', 28.6, 19.8); ent('barrel', 25.5, 17.3);
  ent('enemy_soldier', 29.5, 21.5, { rot: 180 }); ent('enemy_soldier', 27, 16.5, { rot: 90, path: [[27, 16.5], [27, 22], [31, 22], [31, 16.5]] });
  ent('enemy_heavy', 33.5, 20, { rot: 180, props: { drop: 'health_large' } });
  ent('health_small', 25, 21); ent('ammo_bullets', 26, 12.2); ent('coin', 30, 12.6); ent('coin', 30.6, 12.6); ent('gem', 34.7, 24.2);
  ent('spawn_zone', 28, 17.5, { props: { w: 8, d: 3, spawn: 'enemy_runner', count: 3, spread: 4, once: true } });
  // toxic pit: lowered floor + hazard
  for (let x = 25; x <= 27; x++) for (let z = 23; z <= 24; z++) setCell(lv, 0, x, z, { f: 'asphalt', h: -0.8 });
  ent('hazard_zone', 26.5, 24, { props: { w: 12, d: 8, damage: 14, h: 2 } });
  ent('light_green', 26.5, 24, { props: { range: 6 }, y: -0.3 }); // eerie glow in the pit
  ent('message_zone', 26.5, 22, { props: { w: 12, d: 4, text: 'Toxic pit — jump over it or go around.', seconds: 3 } });

  // 7. tower (2 storeys): key + turret + sniper on the roof ---------------------------------------------------------------------------
  room(0, 32, 13, 35, 16, { floor: 'floor_concrete', ceil: null, tex: 'stone' });
  edge(0, 32, 14, 'V', { k: 'door', t: 'stone', td: 'door_wood' });
  setCell(lv, 0, 34, 14, { f: 'floor_concrete', s: { id: 'stairs', d: 'N' } });
  for (let x = 32; x <= 35; x++) for (let z = 13; z <= 16; z++) if (!(x === 34 && z === 14)) setCell(lv, 1, x, z, { f: 'floor_concrete' });
  for (let x = 32; x <= 35; x++) { edge(1, x, 13, 'H', { k: 'railing', t: 'concrete' }); edge(1, x, 17, 'H', { k: 'railing', t: 'concrete' }); }
  for (let z = 13; z <= 16; z++) { edge(1, 32, z, 'V', { k: 'railing', t: 'concrete' }); edge(1, 36, z, 'V', { k: 'railing', t: 'concrete' }); }
  ent('light_torch', 33, 14.1, { rot: 0 }); ent('light_torch', 35, 15.9, { layer: 1 });
  ent('key_red', 33.2, 16.3, { layer: 1, rot: 0 }); ent('enemy_turret', 35.2, 13.7, { layer: 1, rot: 270, props: { health: 90 } }); ent('enemy_sniper', 32.8, 13.7, { layer: 1, rot: 90 });
  ent('health_small', 33.5, 14.7);

  // 8. boss arena ---------------------------------------------------------------------------------------------------------------------
  room(0, 24, 27, 34, 37, { floor: 'floor_concrete', tex: 'scifi', ceil: 'ceiling_tiles' });
  edge(0, 29, 26, 'H', { k: 'door_wide', t: 'scifi', td: 'door_scifi', name: 'bossgate', lock: 'yellow', auto: false });
  for (const x of [26, 32]) for (const z of [29, 34]) setCell(lv, 0, x, z, { p: 'pillar_big', pt: 'concrete_dark' });
  ent('light_red', 26, 29.5, { props: { range: 12 } }); ent('light_red', 32.5, 29.5, { props: { range: 12 } }); ent('light_red', 26, 35); ent('light_red', 32.5, 35); ent('light_cold', 29.5, 32, { props: { range: 14, intensity: 0.8 } });
  ent('checkpoint', 29.5, 28);
  ent('health_large', 25.2, 27.8); ent('ammo_shells', 33.5, 27.8); ent('ammo_rockets', 33.5, 28.5); ent('armor', 25.2, 28.6);
  ent('enemy_boss', 29.5, 34.5, { rot: 180, name: 'warden', props: { name_bar: 'THE WARDEN', health: 1200 } });
  ent('level_exit', 29.5, 36.6, { props: { need: 'warden.died', w: 6, d: 2, next: '' } });
  return normalize(lv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const lv = outpostZero();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(lv, null, 1) + '\n');
  console.log(`wrote ${path.relative(root, out)}  (${lv.entities.length} entities, ${lv.layers.reduce((a, l) => a + Object.keys(l.cells).length, 0)} cells, ${lv.layers.reduce((a, l) => a + Object.keys(l.edges).length, 0)} wall pieces)`);
}
