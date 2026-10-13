# Rules (ported from fallout2-ce, with sfall-era fixes)
- SPECIAL derived stats (`rules.js derived`): HP 15+ST+2EN, AP 5+AG/2, AC=AG, Carry 25+25ST, Seq 2PE, Crit=LK, melee bonus ST-5.
- Skills: Small Guns 5+4AG, Unarmed 30+2(AG+ST), Melee 20+2(ST+AG), Speech 5CH, Repair 3IN, Doctor 5+PE+IN; tag +20.
- To-hit (`combat.cc attackDetermineToHit`): skill + distance term (-4 × (dist − 2·(PE−2))), −10 per critter in line of fire, −20 per missing ST, − target AC, −20 aimed, clamped 5..95 (sfall cap). Unspent AP add to AC until your next turn.
- Damage: roll weapon range (+melee bonus), subtract DT, apply DR%; critical = ×2 ignoring armour; crit chance = LK (+25 aimed). Miss with roll ≥96 may fumble (lose AP).
- Modern mode: same stats, but the mouse aim decides: spread from skill/movement/aiming, projectiles, AC = dodge chance (max 40%), dodge roll i-frames.
- Not ported: perks, traits, hit locations, ammo types, hex grid.
