# Harrison's Command

A one-level proof of concept in the spirit of **Carrier Command 2**: you live on a big moving aircraft carrier (the *Harrison*), walk around it in first person, and run the war
from the **computers** in its command centre. 1 player on mouse + keyboard, or **2 players with a gamepad in split-screen** (top/bottom).

**The level** — three islands in the sea. Gamma Isle (north) holds the enemy HQ guarded by gun towers and mortar pits; Beta Isle has two outposts; Alpha Isle is empty.
Sail the carrier near Gamma, launch your **Walrus** amphibious tanks (and **Manta** gunships), and destroy the HQ. Enemy **drones** hit the carrier every minute or so — run out
on deck and shoot them down with the blaster. If the hull reaches 0 the carrier is lost.

**Controls (Player 1)** — click the game to capture the mouse · WASD move · mouse look · click / G fire · Space jump · **E use a computer** (stand next to it) · Esc/E leave it.
**Player 2** — plug in a gamepad and press any button: left stick move · right stick look · RT fire · A use / confirm · B leave · X recall · Y next unit · Start stop.
`?players=2` in the URL forces split-screen (for testing without a gamepad). Inside a computer the mouse / right stick moves a cursor on the map screen.

**The computers** (command centre = the big island in the middle of the deck):
- **NAVIGATION** (port wall) — map screen: pick a point, click to set the ship's course (X = all stop).
- **UNIT COMMAND** (starboard wall) — Tab selects a unit, click orders it: on the map = move, on an enemy = attack; R recalls it to the carrier's stern to repair; X holds.
- **UNIT CAMERA** (stern wall, left) — a live chase camera on the selected unit.
- **SHIP STATUS** (stern wall, right) — hull, speed, heading, unit health, enemy HQ.
The map and unit-camera screens are real **render-to-texture** cameras (an orthographic top-down camera and a chase camera), so what you see on the monitor is the live 3D world.

**What is reused (not reinvented)**
- *Kenney Starter Kits* (MIT): FPS kit blaster + drone + sounds, City Builder buildings and trees, Racing trucks (parked on deck), Platformer character (the other player).
- *Starter-Kit-FPS* `player.gd`: movement speed 5, gravity 20, mouse sensitivity 700, gamepad look — ported to JavaScript.
- *Warzone 2100* stats (GPL-2.0+): Light Cannon, Mini-Rocket Pod, HMG, Mortar damage/range/fire-rate, tower/HQ hit points and armour, Python/Retaliation bodies — `scripts/hc/wz-stats.json`,
  with WZ's armour rule `max(damage/3, damage − armour)` in `scripts/hc/sim.js`.
- *nordrep* split-screen layout (`n8n5gy4cs9-cmd/nordrep`, `src/core/split.rs`) → `scripts/hc/split.js` (supports 1-4 viewports; the game uses 1-2).
**What is generated**: the carrier, Walrus, Manta, gun tower, mortar pit and the three islands are low-poly glTF models written by `tools/gen_harrison_models.mjs`; textures and map icons are hand-pixelled (`tools/art/harrison`).
Not included: Carrier Command 2's own Lua node editor is proprietary and could not be cloned — the computers here are plain code (see `GUIDE.md` to add more).

Code: `scripts/harrison.js` (scene, players, computers, HUD) · `scripts/hc/sim.js` (ship, units, enemies — pure, testable with node) · `scripts/hc/layout.js` (ship/island geometry shared with the model generator) ·
`scripts/hc/split.js`. Replace art and models: `assets.md`. Extend it: `GUIDE.md`. Credits: Crowelian 2026 + Sonnet; third-party notes in the engine repo's `THIRD_PARTY.md`.
