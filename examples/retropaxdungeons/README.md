# RetroPaxDungeons
A one-level, turn-based roguelike proof of concept in the spirit of **Shattered Pixel Dungeon**: a sewer level (depth 5) with rats, gnoll scouts and crabs,
sleeping and wandering monsters, fog of war, unidentified potions and scrolls, hunger — and the **Goo** boss, which heals in water and pumps itself
up for triple-damage slams. Kill the Goo, then take the stairs down.

**Controls** — arrows / WASD move or attack (bump), Q E Z C diagonals, Space rest, 1-8 use / equip items, mouse click = travel (click a monster to attack), R new game (`?seed=N` replays a level).

**What is ported from Shattered Pixel Dungeon** (GPL-3.0, https://github.com/00-Evan/shattered-pixel-dungeon): `ShadowCaster` field of view, `PathFinder` BFS, `Patch` water/grass
generation, `Char.hit/attack` combat maths (accuracy vs. evasion, damage − armour DR, `NormalIntRange`), the `Mob` AI states (sleeping / wandering / hunting with
SPD's noticing odds), Rat/Gnoll/Crab/Goo stats and Goo's pump-up + water-healing behaviour, hero levelling and regeneration, weapon/armour strength penalties.
**Simplified:** one hand-written room-and-door generator instead of SPD's builders, no buffs system, no ranged items.
All **art is original, with an ImageGen redraw and hand-drawn effects/lettering** — see `assets.md` to replace it. Because it derives from SPD code, this example is **GPL-3.0**.

Code: `scripts/dungeon.js` (Phaser view + input + HUD) and `scripts/rpd/*.js` (pure rules; headless balance test: `node tools/rpd-sim.mjs`).
