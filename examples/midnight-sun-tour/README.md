# Midnight Sun Tour

*Mikko Levon's: Midnight Sun Tour* — a Finnish road-trip **travel adventure + band tycoon + festival simulator**.
Drive a converted sauna-bus from Kuusamo to Turku for Ruisrock 1991: manage fuel, food, morale and hype, survive moose and roadside
karaoke, run a merch table and a garage, play fourteen minigames, then manage the three-day Ruisrock festival yourself.

Start with `nord serve examples/midnight-sun-tour`, or open it in Nord Editor. Read `GUIDE.md` for controls and strategy and `assets.md`
for the reusable art, music and SFX.

**Origin.** Cloned from the author's earlier NordScrap-engine game (`TEMP/midnight_sun_tour`). The game code (`scripts/game/*.js`) runs
unchanged on top of `scripts/nordscrap/compat.js`, a small compatibility layer that provides NordScrap's `Draw2D`, `Input`, `Audio`,
`Scene`, `SaveLoad`, `Style` (film grain + vignette) and the `Model3D`/`Transform` primitives used by the Star Fox minigame, backed by a
canvas, Nord's audio buses and Nord's save store. New in this version: the **Tour Office** tycoon layer (`mg_tycoon.js`), a painted
overworld map, eight new road encounters, a cleaner city menu, and a game that no longer freezes if a minigame throws.

Source: `tools/examples/midnight-sun-tour/` — regenerate with `node tools/gen_examples.mjs midnight-sun-tour` (never edit `examples/` by
hand). Test: `node tools/midnight-sun-test.mjs [frames] [seed]` (tycoon rules + headless fuzz of all minigames). Crowelian 2026 + Sonnet.
