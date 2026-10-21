#!/usr/bin/env node
// Original FPS Creator example "Hotel Meridian": three storeys (basement, lobby floor, guest floor), three staircases and a hotel glass entrance door
// with black frames. Layers sit at layer*3.2 m, so layer 0 is the basement AND the grass level; the lobby floor is reached by the porch stairs.
// Usage: node tools/fpsc-hotel-demo.mjs [out.json]   (default: templates/fps-creator/levels/hotel.fpsl.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newLevel, newLayer, setCell, setEdge, CELL, normalize } from '../runtime/fpsc/level.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function hotelMeridian() {
  const lv = newLevel({ name: 'Hotel Meridian', w: 24, d: 20 });
  lv.author = 'Crowelian 2026 + Sonnet';
  lv.layers[0].name = 'Basement / grass level'; lv.layers.push(newLayer('Lobby floor'), newLayer('Guest floor'));
  Object.assign(lv.settings, {
    sky: 'day', ground: 'grass', ambient: 0.55,
    intro: 'Hotel Meridian has been quiet since last night.\nFind the red key in the boiler room, open the suite on the guest floor, and use the yellow key on the basement service door.\n\nThree floors: basement, lobby, guest rooms.',
    objective: 'Red key (boiler room) → Suite 204 → yellow key → basement service door.',
  });
  let n = 0; const id = () => `h${String(++n).padStart(3, '0')}`;
  const ent = (type, cx, cz, o = {}) => lv.entities.push({ id: id(), type, x: cx * CELL, z: cz * CELL, layer: o.layer ?? 0, rot: o.rot ?? 0, name: o.name ?? '', tag: o.tag ?? '', target: o.target ?? '', props: o.props ?? {}, scripts: o.scripts ?? [], rules: o.rules ?? [], ...(o.y != null ? { y: o.y } : {}) });
  const cells = (L, x0, z0, x1, z1, f, c) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) setCell(lv, L, x, z, { f, c }); };
  const edge = (L, x, z, o, piece) => setEdge(lv, L, x, z, o, piece);
  const wallRun = (L, o, a, b, at, piece) => { for (let i = a; i <= b; i++) edge(L, o === 'H' ? i : at, o === 'H' ? at : i, o, piece); };
  const IN = 'plaster', OUT = 'brick', X0 = 6, X1 = 13, Z0 = 8, Z1 = 13;
  // outer shell of one storey: brick outside, plaster inside (t = +x/+z side, tb = the other side)
  const shell = (L, inTex = IN) => {
    wallRun(L, 'H', X0, X1, Z0, { k: 'wall', t: inTex, tb: OUT }); wallRun(L, 'H', X0, X1, Z1 + 1, { k: 'wall', t: OUT, tb: inTex });
    wallRun(L, 'V', Z0, Z1, X0, { k: 'wall', t: inTex, tb: OUT }); wallRun(L, 'V', Z0, Z1, X1 + 1, { k: 'wall', t: OUT, tb: inTex });
  };
  const inner = { k: 'wall', t: IN };

  // ---- layer 0: basement (y 0) ---------------------------------------------------------------------------------------------------
  cells(0, X0, Z0, X1, Z1, 'floor_concrete', 'ceiling_tiles');
  shell(0, 'concrete');
  wallRun(0, 'H', 6, 9, 10, { k: 'wall', t: 'concrete' }); wallRun(0, 'H', 10, 13, 10, { k: 'wall', t: 'concrete' }); // corridor z10-11, south side
  wallRun(0, 'H', 6, 9, 12, { k: 'wall', t: 'concrete' }); wallRun(0, 'H', 13, 13, 12, { k: 'wall', t: 'concrete' }); // north side (x10-12 open: stairs hall)
  wallRun(0, 'V', 8, 9, 10, { k: 'wall', t: 'concrete' }); wallRun(0, 'V', 12, 13, 10, { k: 'wall', t: 'concrete' }); // boiler / hall divider
  edge(0, 7, 10, 'H', { k: 'door', t: 'concrete', td: 'door_metal' });           // storage
  edge(0, 11, 10, 'H', { k: 'door', t: 'concrete', td: 'door_metal' });          // laundry
  edge(0, 7, 12, 'H', { k: 'door', t: 'concrete', td: 'door_metal', name: 'boilerdoor' }); // boiler room
  edge(0, 14, 10, 'V', { k: 'door', t: 'concrete', td: 'door_yellow', lock: 'yellow', name: 'servicedoor' }); // service door to the grass
  edge(0, 14, 11, 'V', { k: 'wall', t: 'concrete' });
  // stairs up to the lobby floor: stair cell (12,12) climbs north to z=13 (y 3.2); no ceiling over stairs, cell above is a hole on layer 1
  // A low wall closes each stair's high end: it is stepped over at stair height, but stops anyone walking in from the lower floor (floorAt would see no floor there).
  setCell(lv, 0, 12, 12, { f: 'floor_concrete', s: { id: 'stairs', d: 'N' }, c: null });
  edge(0, 12, 12, 'V', { k: 'wall', t: 'concrete' }); edge(0, 13, 12, 'V', { k: 'wall', t: 'concrete' }); edge(0, 12, 13, 'H', { k: 'wall_low', t: 'concrete' });
  // entrance porch stairs outside (layer 0 stair cell at (9,5) climbs to the porch at z=6) + plinth walls under the porch
  setCell(lv, 0, 9, 5, { f: 'floor_concrete', s: { id: 'stairs', d: 'N' } });
  edge(0, 9, 5, 'V', { k: 'wall_low', t: 'concrete' }); edge(0, 10, 5, 'V', { k: 'wall_low', t: 'concrete' });
  edge(0, 8, 6, 'V', { k: 'wall', t: 'concrete' }); edge(0, 8, 7, 'V', { k: 'wall', t: 'concrete' }); edge(0, 12, 6, 'V', { k: 'wall', t: 'concrete' }); edge(0, 12, 7, 'V', { k: 'wall', t: 'concrete' });
  for (const x of [8, 10, 11]) edge(0, x, 6, 'H', { k: 'wall', t: 'concrete' });

  // ---- layer 1: lobby floor (y 3.2) ----------------------------------------------------------------------------------------------
  cells(1, X0, Z0, 10, Z1, 'marble', 'ceiling_tiles');            // lobby
  cells(1, 11, Z0, X1, Z1, 'tile_checker', 'ceiling_tiles');      // restaurant
  shell(1);
  wallRun(1, 'V', 8, 9, 11, inner); wallRun(1, 'V', 11, 13, 11, inner);   // lobby | restaurant wall with a wide opening at z=10
  edge(1, 11, 10, 'V', { k: 'doorway_wide', t: IN });
  edge(1, 9, 8, 'H', { k: 'door_glass_hotel', t: IN, tb: OUT, name: 'entrance' }); // hotel door, black frame (default trim = black_metal)
  for (const x of [7, 8, 11, 12]) edge(1, x, 8, 'H', { k: 'window_wide', t: IN, tb: OUT });
  for (const x of [7, 9, 12]) edge(1, x, 14, 'H', { k: 'window', t: OUT, tb: IN });
  edge(1, 14, 10, 'V', { k: 'window_wide', t: OUT, tb: IN }); edge(1, 6, 10, 'V', { k: 'window_wide', t: IN, tb: OUT });
  // porch
  cells(1, 8, 6, 11, 7, 'marble', 'ceiling_tiles');
  for (const z of [6, 7]) { edge(1, 8, z, 'V', { k: 'railing', t: 'concrete' }); edge(1, 12, z, 'V', { k: 'railing', t: 'concrete' }); }
  for (const x of [8, 10, 11]) edge(1, x, 6, 'H', { k: 'railing', t: 'concrete' });
  // stairs up (lobby): stair cell (7,12) climbs north to z=13, landing is on layer 2; hole + ceiling on layer 2, railings round the hole
  setCell(lv, 1, 7, 12, { f: 'marble', s: { id: 'stairs', d: 'N' }, c: null }); setCell(lv, 1, 7, 13, null);
  edge(1, 7, 12, 'V', { k: 'wall', t: IN }); edge(1, 8, 12, 'V', { k: 'wall', t: IN }); edge(1, 7, 14, 'H', { k: 'wall', t: OUT, tb: IN }); edge(1, 7, 13, 'H', { k: 'wall_low', t: IN });
  edge(1, 7, 13, 'V', { k: 'wall', t: IN }); edge(1, 8, 13, 'V', { k: 'wall', t: IN });   // the empty cell above the stair top must be walled in
  // stairs down (restaurant): hole at (12,12); railings W/E/S; landing cell (12,13) stays floor
  setCell(lv, 1, 12, 12, { f: null, c: 'ceiling_tiles' });
  edge(1, 12, 12, 'V', { k: 'railing', t: 'concrete' }); edge(1, 13, 12, 'V', { k: 'railing', t: 'concrete' }); edge(1, 12, 12, 'H', { k: 'railing', t: 'concrete' });

  // ---- layer 2: guest floor (y 6.4) ----------------------------------------------------------------------------------------------
  cells(2, X0, Z0, X1, Z1, 'carpet', 'ceiling_tiles');
  shell(2);
  setCell(lv, 2, 7, 12, { f: null, c: 'ceiling_tiles' }); // stairwell hole under a ceiling
  wallRun(2, 'H', 6, 8, 10, inner); wallRun(2, 'H', 9, 10, 10, inner); wallRun(2, 'H', 11, 13, 10, inner);      // south rooms | corridor
  wallRun(2, 'V', 8, 9, 9, inner); wallRun(2, 'V', 8, 9, 11, inner);                                              // 201 | 202 | 203
  wallRun(2, 'H', 8, 13, 12, inner);                                                                              // corridor | north rooms (x6-7 alcove is open)
  wallRun(2, 'V', 12, 13, 8, inner); wallRun(2, 'V', 12, 13, 11, inner);                                          // alcove | suite | store
  for (const x of [7, 9, 12]) edge(2, x, 10, 'H', { k: 'door_swing', t: IN, td: 'door_wood' });                    // 201 202 203
  edge(2, 9, 12, 'H', { k: 'door', t: IN, td: 'door_red', lock: 'red', name: 'suite204' });                       // suite (locked)
  edge(2, 12, 12, 'H', { k: 'door_swing', t: IN, td: 'door_wood' });
  for (const x of [7, 9, 12]) edge(2, x, 8, 'H', { k: 'window_wide', t: IN, tb: OUT });
  for (const x of [9, 12]) edge(2, x, 14, 'H', { k: 'window', t: OUT, tb: IN });
  edge(2, 14, 10, 'V', { k: 'window_wide', t: OUT, tb: IN }); edge(2, 6, 10, 'V', { k: 'window_wide', t: IN, tb: OUT });
  edge(2, 7, 12, 'V', { k: 'railing', t: 'concrete' }); edge(2, 7, 12, 'H', { k: 'railing', t: 'concrete' });   // around the stair hole (W, S); E side is the suite wall
  edge(2, 8, 12, 'V', { k: 'wall', t: IN });

  // ---- entities --------------------------------------------------------------------------------------------------------------------
  ent('player_start', 9.5, 3.5, { rot: 0 });
  ent('tree', 4.5, 5.5); ent('tree', 15.5, 4.5); ent('plant', 8.4, 6.5, { layer: 1 }); ent('plant', 11.5, 6.5, { layer: 1 });
  ent('light_warm', 9.5, 7, { layer: 1, props: { range: 8 } });
  ent('message_zone', 9.5, 4.2, { props: { w: 5, d: 3, text: 'Hotel Meridian. Stairs up to the lobby, glass doors open by themselves.', seconds: 5 } });
  // lobby
  ent('light_ceiling', 7.5, 9.5, { layer: 1 }); ent('light_ceiling', 9.5, 12, { layer: 1 }); ent('light_ceiling', 12, 9.5, { layer: 1 }); ent('light_ceiling', 12, 12, { layer: 1 });
  ent('table', 8.5, 11.2, { layer: 1 }); ent('chair', 8.1, 11.9, { layer: 1, rot: 180 }); ent('plant', 6.7, 8.7, { layer: 1 }); ent('plant', 10.3, 8.7, { layer: 1 });
  ent('terminal', 8.9, 12.8, { layer: 1, rot: 180 }); ent('npc_civilian', 8, 12.2, { layer: 1, rot: 180 });
  ent('enemy_guard', 9.5, 10.5, { layer: 1, rot: 0, props: { health: 60 } });
  ent('health_small', 6.8, 11.5, { layer: 1 }); ent('checkpoint', 9.5, 9.2, { layer: 1 });
  // restaurant
  for (const [x, z] of [[12.3, 9.3], [13, 11]]) { ent('table', x, z, { layer: 1 }); ent('chair', x - 0.5, z, { layer: 1, rot: 90 }); }
  ent('enemy_soldier', 12.5, 10.2, { layer: 1, rot: 180 }); ent('ammo_bullets', 13.2, 8.7, { layer: 1 }); ent('message_zone', 12.5, 12.8, { layer: 1, props: { w: 3, d: 2, text: 'Stairs down to the basement. Mind the railing.', seconds: 4 } });
  ent('message_zone', 7.5, 11.2, { layer: 1, props: { w: 3, d: 2, text: 'Stairs up to the guest floor.', seconds: 3 } });
  // basement
  ent('light_ceiling', 7.5, 10.8, { layer: 0 }); ent('light_ceiling', 11.5, 10.8, { layer: 0 }); ent('light_flicker', 9.8, 11, { layer: 0 });
  ent('light_ceiling', 7.5, 9, { layer: 0 }); ent('light_ceiling', 11.5, 9, { layer: 0 }); ent('light_red', 7.5, 12.6, { layer: 0, props: { range: 6 } });
  ent('crate', 6.8, 8.7, { layer: 0 }); ent('crate_metal', 8.6, 9.2, { layer: 0 }); ent('barrel', 6.6, 9.6, { layer: 0 });   // storage
  ent('locker', 10.6, 8.6, { layer: 0, rot: 180 }); ent('locker', 13.3, 9.4, { layer: 0, rot: 90 }); ent('health_large', 12.4, 8.7, { layer: 0 });    // laundry
  ent('barrel_explosive', 6.7, 12.7, { layer: 0 }); ent('barrel_explosive', 8.8, 12.6, { layer: 0 }); ent('fx_steam', 8.4, 13.3, { layer: 0 });
  ent('enemy_heavy', 7.8, 12.9, { layer: 0, rot: 180, props: { health: 220 } }); ent('key_red', 6.6, 13.3, { layer: 0 });
  ent('enemy_soldier', 11, 11.4, { layer: 0, rot: 270 }); ent('ammo_shells', 10.8, 12.8, { layer: 0 }); ent('weapon_shotgun', 13.4, 12.8, { layer: 0 });
  ent('message_zone', 7.5, 10.6, { layer: 0, props: { w: 3, d: 2, text: 'The boiler-room door is behind the corridor’s west end.', seconds: 3 } });
  // guest floor
  ent('light_ceiling', 8, 11, { layer: 2 }); ent('light_ceiling', 12, 11, { layer: 2 }); ent('light_ceiling', 7, 9, { layer: 2 }); ent('light_ceiling', 9.5, 9, { layer: 2 }); ent('light_ceiling', 12, 9, { layer: 2 }); ent('light_ceiling', 9.5, 13, { layer: 2 }); ent('light_ceiling', 12, 13, { layer: 2 });
  ent('table', 7, 8.7, { layer: 2 }); ent('chair', 7.8, 9.2, { layer: 2, rot: 90 }); ent('health_small', 6.8, 9.3, { layer: 2 });
  ent('table', 9.6, 8.6, { layer: 2 }); ent('armor', 10.2, 9.4, { layer: 2 });
  ent('enemy_soldier', 12, 9, { layer: 2, rot: 180, props: { health: 70 } }); ent('ammo_bullets', 13.2, 8.6, { layer: 2 });
  ent('enemy_guard', 10.8, 10.8, { layer: 2, rot: 270, props: { health: 60 } });
  ent('plant', 13.2, 10.2, { layer: 2 }); ent('plant', 6.6, 10.2, { layer: 2 });
  ent('table', 9.5, 13.2, { layer: 2 }); ent('chair', 9, 12.6, { layer: 2, rot: 0 }); ent('key_yellow', 9.6, 12.8, { layer: 2, y: 0.9 }); ent('light_warm', 9.3, 13, { layer: 2, props: { range: 6 } });  // suite 204
  ent('crate', 12.3, 13.3, { layer: 2 }); ent('ammo_rockets', 13.2, 12.6, { layer: 2 }); ent('weapon_rifle', 11.7, 12.6, { layer: 2 });
  ent('checkpoint', 7, 11, { layer: 2 });
  // exit: outside the basement service door
  ent('level_exit', 16.2, 10.8, { layer: 0, props: { w: 3, d: 3, next: '' } });
  ent('light_warm', 15.2, 10.5, { layer: 0, props: { range: 7 } });
  return normalize(lv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? path.join(root, 'templates/fps-creator/levels/hotel.fpsl.json');
  const lv = hotelMeridian();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(lv, null, 1) + '\n');
  console.log(`wrote ${path.relative(root, out)}  (${lv.entities.length} entities, ${lv.layers.map((l) => Object.keys(l.cells).length).join('/')} cells)`);
}
