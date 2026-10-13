# Vallout 2: New Kerava — PLAN

**One-liner:** a comic Fallout 2 clone set in quarantined Kerava, Finland (1990s/2000s vibes). Tero (no surname) must survive the alien-fallout wasteland and reach the Klaukkala safe zone.

## Stack (reuse, don't reinvent)
| Need | Source |
|---|---|
| Engine, runtime, Phaser 4, loader, audio, save | **nord-engine** (`engine/` = vendored `runtime/core`, `runtime/phaser`, `vendor/phaser`; pinned in `engine/NORD_ENGINE.md`) |
| Game rules (SPECIAL, derived stats, to-hit, damage, AP, sequence, XP) | **fallout2-ce** (`combat.cc` `attackDetermineToHit`, `stat.cc`, `skill.cc`) — ported to `game/scripts/v/rules.js` (pure, node-testable) |
| Bug-fix knowledge | **sfall** — adopted fixes listed in `docs/RULES.md` (e.g. distance/Perception fix, no negative AC, to-hit cap 95) |
| UI/modern-engine ideas | **falltergeist** (reference only: HUD layout, cursor modes) |
| Bitmap font + text helper | nord-engine `forgotten` example (`pixeltext.js`, `font.png`) |
| Pixel-art pipeline | nord-engine `tools/pixelart.mjs` (hand-typed text grids → PNG; **no random/procedural pixel generation** — every sprite is typed art) |
| Audio synth | nord-engine `tools/gen_xkom_audio.mjs` pattern (oscillator/noise SFX + looping music) |

## Architecture
```
engine/            vendored nord-engine runtime (MIT)
game/              Nord project (nord.project.json, index.html, scenes, scripts, assets, assets.md)
  scripts/valout.js     entry NordScript: state machine (title → create → worldmap ↔ area → ending)
  scripts/v/data.js     items, enemies, skills, locations, quests, dialogue (pure data)
  scripts/v/rules.js    F2 rules port (pure)
  scripts/v/mapgen.js   seeded procedural area generator (pure)
  scripts/v/path.js     A*, line of sight (pure)
  scripts/v/ui.js       F2 HUD, panels (inventory, character, dialogue, world map)
  scripts/v/play.js     area view: iso render, entities, classic + modern controls, combat
tools/art/         hand-typed pixel art sources → `node tools/pixelart.mjs valout`
tools/gen_audio.mjs    SFX + music synth
tools/shots.mjs        headless Chromium screenshots
```
## Game design summary
- 640×480, isometric 32×16 tiles, 8-dir movement, dead-desert Kerava built procedurally from landmarks.
- **Two control modes** (toggle F10 / title menu): **Classic F2** (turn-based, AP, cursor modes, default) and **Modern** (WASD move, mouse aim + shoot, dodge, quick slots, real-time).
- 5 locations on a world map: Keravan asema → Kauppakaari/Karuselli → Sampola/Ahjo → Keravanjoki nest → Klaukkala gate.
- Main quest, 4 side quests, drunks, wall-kicking minigame (Saku & Möttönen, Rane), green fuzzy dice as the key item.
- Ending: kill quota (25 aliens) collapses the hive, **or** hit Klaukkala with the dice-fitted moped (2 endings).
## Milestones
M0 scaffold+docs · M1 pixel art · M2 rules+data+mapgen · M3 area view (classic) · M4 combat · M5 UI/HUD/panels · M6 dialogue+quests+world map · M7 modern controls · M8 audio · M9 test+screenshots+polish.
See `tasks.md`.
