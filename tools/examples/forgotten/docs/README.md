# Forgotten Wars

A one-level **Advance Wars 2-style turn-based tactics** proof of concept: **Ember Legion** (you, orange) against the **Cobalt Pact** (computer, blue) on the 20×14 map
*The Crossing* — two armies, one river, two bridges and a ford. Capture the enemy HQ or destroy their army. A complete little game: move, attack, counter-attack,
capture, build units, repair, terrain defence, a computer opponent that plays by the same rules, and hot-seat for two humans.

**Controls** — mouse: click a unit to select, click a blue tile to move, pick *Attack / Capture / Wait* from the menu; right-click or **X / Esc** cancels; click an empty tile (or **Tab / E**) for the
system menu (*End turn*). Keyboard: arrows / WASD move the cursor, **Z / Enter / Space** confirms, **X / Esc / Backspace** cancels. Click one of your **factories** (empty) to build.
Click an *enemy* unit to see where it could hit next turn (red tiles). `?hotseat=1` in the URL (or the *hotseat* attribute) lets two people share the keyboard; `?seed=N` fixes the damage luck.

**Rules in one paragraph** — Damage = base % (attacker vs defender, table in `scripts/fw/data.js`) × attacker HP × terrain defence (★ stars of the defender's tile × its HP) + 0–9 % luck.
Direct units are countered if they survive; artillery (range 2–3) cannot move and fire, and is never countered. Infantry and Mechs capture cities, factories and the HQ (20 points minus their
HP per turn; moving away resets it). Each property you own pays 1000 per turn; units standing on your properties are repaired 2 HP for 20 % of their price. Factories build one unit a turn; new units
cannot act that turn. Move types: foot / mech / tread / tyres / air — woods slow wheels and tracks, mountains stop vehicles, rivers are only crossed on bridges and shoals.

**Under the hood** — `scripts/fw/rules.js` is pure game logic (no Phaser, runs in node: `node tools/fw-sim.mjs` plays AI vs AI), `scripts/fw/ai.js` is the computer player, `scripts/fw/data.js` holds units, terrain and
the damage chart, `scripts/forgotten.js` is the view/controller (tiles, sprites, menus, animations), `assets/maps/crossing.map` is the level in plain text.
All pixel art is hand-drawn (one character = one pixel, `tools/art/forgotten/*.mjs`), 16×16 and shown at 2×.

**Honesty** — the reference decompilation `Eebit/aw2bhr` (a work-in-progress *assembly* decompilation, no readable gameplay tables) was cloned and studied but **no data, code or art from it, or from Nintendo / Intelligent Systems, is included**.
The mechanics follow the publicly documented Advance Wars 2 model; the unit values are a hand-typed subset; names, art, map, music and sounds are original / Nord placeholders.
`GUIDE.md` explains how to grow this into the full game; `assets.md` how to replace the art. Credits: Crowelian 2026 + Sonnet.
