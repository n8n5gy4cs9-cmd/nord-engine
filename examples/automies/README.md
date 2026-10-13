# Automies

A one-level **Driver 2-style 3D driving game** proof of concept: **The Getaway — Haven Bay.** You have robbed the bank; reach all 15 checkpoints and the safehouse before the clock runs out
while civilian traffic fills the streets and the police hunt you down (more of them the worse your felony). One or two players: **split-screen, player 2 on a gamepad**.

**Controls** — Player 1 (keyboard): **W** throttle · **S** brake, and reverse once stopped · **A / D** steer · **Space** handbrake · **Shift** fast steer (hold) · **H** horn · **L** look back (hold) · **R** reset to the last checkpoint (costs 6 s) · **P** pause.
Player 2 (gamepad — connect it and press any button to join): **left stick** steer · **RT** throttle · **LT** brake / reverse · **A or B** handbrake · **LB / RB** fast steer · **X** horn · **Y** look back · **Start** reset.
With two gamepads connected, player 1 can use the first one too (the keyboard keeps working) and player 2 gets the second. `?players=2` in the URL forces split-screen, `?bot=1` lets bots drive (a demo / screenshot mode).

**Driving like Driver 2** — the handling is a **JavaScript port of Driver 2's physics from the open source REDRIVER2** (GPL-2.0, `scripts/am/car.js`): the same per-wheel tyre model (speed-dependent slip gain, front/rear grip split that shifts with steering, braking and
the handbrake), locked wheels sliding, the *auto-brake* grip build-up while you hold a turn, burnouts, the cubic analogue steering curve and fast steer, automatic gears with the power cut while shifting, and the same smoothed rear chase camera. It is not a pure arcade model: lift off before a corner, tap the handbrake to swing the tail, and
a hard brake locks the wheels. Cars have different grip classes (`scripts/am/cars.js`): the muscle car (P1) and the sport coupe (P2) beat the slippery cabs and vans of the traffic; police cruisers have the grippiest tyres.

**The game** — 15 checkpoints (yellow / orange / cyan beam; the arrow at the top points at the next one, the minimap shows everything), +12 s each. Crashes damage the car (100 % = wrecked: you respawn at the last checkpoint after 3 s and lose 6 s); hitting civilians and police raises the **felony** bar, which brings more cops (up to 4).
Police use the same car physics as you, rubber-band to catch up and powerslide round corners; they ram. Civilians drive in their lane, brake for cars and slow for turns; roadworks block a lane here and there. In two-player games the first to the safehouse wins, otherwise whoever is ahead when time runs out.

**Under the hood** — `scripts/am/car.js` (handling, node-testable: `node tools/am-sim.mjs` prints 0-100, braking distance, skid-pad radius and handbrake-turn numbers for every car), `scripts/am/sim.js` (the whole world and mission without any rendering: `node tools/am-sim.mjs --mission 120 2` lets bots play it),
`scripts/am/traffic.js` (civilian + police drivers), `scripts/am/collide.js`, `scripts/am/city.js` (the map parser), `scripts/automies.js` (the Babylon view, cameras, HUD, audio), `assets/maps/haven.map` (the city, plain text).
Art: Kenney roads, buildings and trucks (MIT) plus generated low-poly cars, towers and landmarks, and **hand-pixelled textures**.

**Honesty** — the cloned repository `OpenDriver2/REDRIVER2` needs the original game data to run, so only its *code* is used (as the reference for the handling port); **no Driver 2 data, models, textures, sounds or levels are included** and the city, cars and everything else are original or Kenney's.
The physics constants are Driver 2's, but the unit scale and a global acceleration damping were tuned by hand (see `car.js`). Not in this PoC: hills and jumps, suspension, on-foot play, pedestrians, traffic lights, day/night/weather, car damage models beyond a meter, a real mission script.
`GUIDE.md` explains how to grow it; `assets.md` how to replace the models, textures and sounds. Credits: Crowelian 2026 + Sonnet. Because it derives from GPL-2.0 code, this example is GPL-2.0-compatible — see `THIRD_PARTY.md`.
