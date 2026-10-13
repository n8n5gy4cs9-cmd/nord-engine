# PRD — Vallout 2: New Kerava
## Goals
1. Feel like Fallout 2 (iso view, SPECIAL, AP turn combat, F2 interface, cursor modes, pip-style panels, dark humour).
2. Comedy: Finnish 90s/2000s Kerava — Kummeli-style teens Saku & Möttönen kicking walls, Rane on moped ("Hei Rane!", "Asiaa!"), drunks, Kossu, lonkero, salmiakki, Nokia 3310, VR trains, Karuselli, Ahjo.
3. Full short campaign: story + missions, shorter than F2, with an ending.
4. Two control modes; classic default.
5. All art/audio replaceable by filename (`game/assets.md`).
## Functional requirements
- FR1 Title screen, character creation (SPECIAL 5 pts, 2 tag skills), control mode selector.
- FR2 World map (nodes + travel + random encounters).
- FR3 Procedural areas from seed + location theme (roads, ruins, trees, wrecks, drunks, aliens).
- FR4 Classic combat: sequence, AP, move cost, hit %, aimed shot, crits, AC, DR, armor, ammo-free simplification, XP, level-up.
- FR5 Inventory (weight, equip weapon/armor, use items), Character screen (skills, level up), Log.
- FR6 Dialogue trees with skill checks (Speech, Luck) and quest flags.
- FR7 Quests: main chain + sides; quest log in NOKIA panel.
- FR8 Modern mode: WASD, mouse aim, LMB shoot, RMB alt/kick, Space dodge, 1–3 quick items, E interact, Shift sprint.
- FR9 Ending when ≥25 aliens killed or Klaukkala reached; end screens with stats.
- FR10 Save/load (engine `save`), SFX + 3 music tracks.
## Non-goals
Full F2 content, hex grid, perks, party system, real F2 assets (all art original).
## Acceptance
Game boots from `node tools/serve.mjs` → `/game/`, playable title→ending, no console errors, screenshots in `docs/screenshots/`.
