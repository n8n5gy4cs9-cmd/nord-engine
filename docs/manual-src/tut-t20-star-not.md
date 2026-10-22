---
title: T20 Build Star-Not, a complete small space adventure
section: Tutorials
order: 20
summary: Recreate the solar chart, three races, diplomacy, ship combat, campaign saves, co-op and ending.
---
**Result:** a complete short adventure in our solar system, with exactly three peoples: Earth-race, Mars-race and Venutians. Recover relay cores, negotiate, manage fuel, fight patrols, and finish the mission at Earth. An optional second pilot helps in combat on the shared keyboard or a gamepad.

**Working example:** `examples/star-not/`. **Editable engine sources:** `tools/examples/star-not/`. This tutorial includes every gameplay module and the project/scene setup so you can recreate the example in your own folder.

::: dummies
A complete small game needs a beginning, a goal, choices, feedback and an ending. It does not need a whole galaxy. Star-Not has eight planets, a few encounters and one clear mission; that keeps the project understandable.
:::

## 1. Write the game plan first
Use this one-page plan:

| Question | Answer |
|---|---|
| What does the player do? | Travel, talk, collect supplies and fight short ship encounters. |
| What is the goal? | Three cores + Mars accord + Venutian accord; activate the relay at Earth. |
| What creates pressure? | Travel and encounters use days; the relay window closes after day 40. |
| What happens after a mistake? | Rescue returns the fleet to orbit. Repair and retry; a tow prevents being permanently stranded. |
| What is co-op? | P1 handles the campaign; P2 is an extra allied ship during combat. |
| What is outside this game's scope? | Other star systems, extra races, multiplayer networking, colonies, complex economies. |

This is a game design, not a list of technologies. Every feature above contributes to the mission. [The larger-project guide](tut-t21-project-design.html) explains how to scale this approach.

## 2. Create the project structure
Make your own `my-star-not` folder:

```text
my-star-not/
  index.html
  nord.project.json
  scenes/main.scene.json
  scripts/
    star-not.js
    sn/
      data.js
      flight.js
      dom.js
      touch.js                 Reusable code-drawn joystick and buttons
  assets/
    sprites/space.png
    sprites/space.png.meta.json
    ui/portraits.png
    ui/portraits.png.meta.json
    ui/game.css
    fonts/inter.woff2
    fonts/LICENSE
    audio/
      music/cruise.wav
      music/combat.wav
      music/victory.wav
      sfx/laser.wav
      sfx/hit.wav
      sfx/explosion.wav
      sfx/travel.wav
      sfx/hail.wav
      sfx/confirm.wav
      sfx/victory.wav
      sfx/defeat.wav
  GUIDE.md
  assets.md
  SOURCE.md
  COPYING
```

Scenes describe the starting entities. Scripts describe behavior. Assets are replaceable files. Keeping those separate makes it clear where to look when you change something.

## 3. Add the project settings
Create `nord.project.json` from this complete file. The **2D tier** selects Nord's Phaser adapter. The logical screen is 1024×720; `fit` preserves its shape when the window changes size.

The action names separate the two pilots. P1 uses arrows; P2 uses WASD. Giving both players the same “left” action would make them steer together.

::: example-code examples/star-not/nord.project.json json

## 4. Add the boot page
Create `index.html`. It loads the local Phaser runtime, imports Nord's `boot`, reads the project file and starts it. The import map makes `import { NordScript } from 'nord'` work in your scripts.

::: example-code examples/star-not/index.html html

The engine URLs are local routes supplied by `nord serve`. For export, Nord copies the pinned engine/runtime files into the output. Do not replace these with a CDN.

## 5. Add the starting scene
Create `scenes/main.scene.json` using the whole file below. It has a camera, an off-screen atlas source and the Expedition entity with the main script attached.

The atlas source makes the loader discover the spritesheet before the script creates the visible objects. It is not a visible gameplay object.

::: example-code examples/star-not/scenes/main.scene.json json

## 6. Copy the reusable sprites and audio
Copy the entire `assets` folder from `examples/star-not/` into your own project, including the sidecars and font licence. You can replace files later at the same paths.

<figure class="shot"><img src="assets/tutorials/star-not-space.png" alt="Star-Not atlas: three ships, the Sun and eight planets, satellite, asteroid, pulse and explosion" loading="lazy"><figcaption>Game sprites: examples/star-not/assets/sprites/space.png. Index 0 is the Earth ship; indices 4–12 are the Sun and eight planets.</figcaption></figure>
<figure class="shot"><img src="assets/tutorials/star-not-ui.png" alt="Star-Not atlas with the three race portraits and fuel, crew, treaty, relay and other interface icons" loading="lazy"><figcaption>UI sprites: examples/star-not/assets/ui/portraits.png. Three portraits and thirteen reusable interface symbols.</figcaption></figure>

The full numbered inventory and every sound path are in `examples/star-not/assets.md`. The exact built-in ImageGen prompts are in `ART_DIRECTION.md`. The artwork and audio are original; none came from UQM.

A sprite uses the PNG and its metadata together:

```json
{ "type": "sprite", "texture": "assets/sprites/space.png", "frame": 0, "size": [64, 64] }
```

`frame` selects one picture in the atlas. `size` controls its displayed dimensions. Metadata records the source frame dimensions.

## 7. Add the little DOM helper
Copy `examples/star-not/scripts/sn/dom.js`, or create it with this code. It is Nord's existing app DOM helper. Star-Not uses `h` to put accessible buttons, lists and text inside a Nord UI panel.

::: example-code examples/star-not/scripts/sn/dom.js javascript

## 8. Describe the solar system in data.js
Paste the complete file into `scripts/sn/data.js`.

- **RACES** contains the three people's names, portraits, ship frames, dialogue and combat numbers.
- **PLANETS** contains only our eight planets. The Sun is a separate visual object. Positions are a readable chart, not astronomical scale.
- **freshCampaign** creates one complete new campaign state. This makes New expedition predictable.
- **travelCost** computes fuel/day costs before enabling the travel button.
- **missionReady** is the single rule for whether Earth can complete the mission.
- **validCampaign** checks imported save data before the game uses it.

::: example-code examples/star-not/scripts/sn/data.js javascript

Keep dialogue and balance numbers here instead of scattering them among drawing code. Changing a ship's speed should not require finding every place that ship appears.

## 9. Build ship motion in flight.js
A ship has position, facing direction and velocity. **Thrust** changes velocity in the direction the nose faces. Turning alone does not turn the existing drift. Braking reduces velocity. Wrapping moves a ship from one edge to the opposite edge.

The normal-thrust rule is a small simplified adaptation from the requested `0xDEC0DE/sc2-uqm` branch `uqm-ee`, commit `d0f959d013b52c275f27d944039073d066dc8c93`. The rest of this campaign is original. Keep `SOURCE.md` and `COPYING` with redistributed game code: the game is GPL-2.0-or-later. Original new sprites/audio have their separate MIT permission.

Create `scripts/sn/flight.js`:

::: example-code examples/star-not/scripts/sn/flight.js javascript

`dt` is seconds since the previous update. Multiplying motion by it makes speed independent of the display's frame rate. `shortestTurn` avoids spinning almost a full circle when a target is just across the angle boundary. `wrappedDelta` lets the enemy aim correctly across arena edges.

## 10. Define co-op controls
P1's input comes from Nord's named keyboard actions. Shared-keyboard P2 uses different actions. Gamepad P2 uses the first connected controller's standard axes/buttons:

| Action | P1 | P2 keyboard | P2 gamepad |
|---|---|---|---|
| Turn | Left/Right arrows | A/D | Stick horizontal |
| Thrust | Up arrow | W | Stick up / right trigger |
| Brake | Down arrow | S | B / Circle |
| Fire | Space | F | A / Cross |
| Shield | Shift | G | X / Square |
| Pause | Esc/P | Shared | Start / Menu |

`gamepadControls` in flight.js returns a plain object, just like the keyboard code. This lets the movement code stay the same for both devices. A dead zone ignores tiny stick movements. Press a controller button so the browser exposes it.

P2 has a separate 16-hull ship. Friendly shots do not damage teammates. A surviving teammate can finish the fight if the other is disabled. Co-op mode is selected before combat; it does not split the campaign or create network multiplayer.

## 10b. Add mobile controls
Create `scripts/sn/touch.js` with this reusable module. The joystick calls Nord's existing `virtualJoystick`; the buttons call `input.setVirtual` using the same action names as keyboard controls. The game shows them automatically on a coarse-pointer device, or you can enable them in the orbit menu for desktop pointer testing. Landscape is recommended for this 1024×720 game.

::: example-code examples/star-not/scripts/sn/touch.js javascript

For other games, [the mobile controls guide](mobile-controls.html) explains action mapping, UI placement and cleanup.

## 11. Create the cockpit stylesheet
Put this in `assets/ui/game.css`. The logical-size UI panel is scaled to match the game canvas, so menus and the solar chart stay aligned when the window changes size.

Buttons have real text. Portraits and resource icons support those labels. The right panel explains the selected planet, actions and remaining objectives; it is not just decoration.

::: example-code examples/star-not/assets/ui/game.css css

## 12. Connect the game in star-not.js
Create `scripts/star-not.js` with the whole module below. Read it one responsibility at a time:

1. **start / prepare:** load CSS, create a Nord UI panel and create reusable Nord sprite entities. A loading state protects updates until preparation completes.
2. **title:** choose Solo, shared-keyboard co-op or P2 gamepad, then New/Continue. That button gesture also unlocks browser audio.
3. **map:** display the planets, mission ship and destination actions. Selecting a planet does not spend resources until Travel is pressed.
4. **planetActions:** give each planet a few explicit choices. One-time supplies cannot be farmed repeatedly. Allied docks prevent unnecessary softlocks.
5. **modal / talk / help / pause:** present readable information, manage pause and clear held input when returning from menus.
6. **battle:** create fighter state, assign reused sprite entities and select the enemy's race.
7. **update:** read controls, move ships, let the enemy aim, move bullets, resolve damage and look for encounter completion.
8. **finishBattle:** grant the reward or recover the fleet, advance time and write the planet checkpoint.
9. **ending:** present an actual win/lose screen and a way to start again.
10. **onDestroy:** remove listeners, styling, UI and music owned by this script.

::: example-code examples/star-not/scripts/star-not.js javascript

## 13. Notice the Nord way of doing things
The game uses **NordScript**, `this.scene.spawnData`, Nord `sprite`/`text` components, `entity.pos`/`rot`/`set`, `this.input`, `this.ui`, `this.audio` and `this.game.save`.

It does **not** create a second Phaser game or a separate Phaser scene. Nord owns that runtime. Flight and campaign rules are ordinary JavaScript helpers; they do not need to know how sprites are drawn.

The object pools are small, fixed lists of reusable Nord entities. Disabled bullet/explosion entities are reused when needed, rather than creating unlimited visual objects during a fight.

## 14. Connect sounds and music
The three music tracks are `cruise.wav`, `combat.wav` and `victory.wav`. The Audio manager loops music and crossfades between tracks. The eight effects play once for shots, damage, travel, dialogue, confirmation and encounter results.

```javascript
this.audio.play('assets/audio/sfx/laser.wav', { volume: 0.5 });
this.audio.music('assets/audio/music/cruise.wav', { fade: 0.45, volume: 0.32 });
```

The New/Continue click calls `audio.unlock()`. Browsers require that player gesture. Keep audio files local and include them when exporting.

To create fresh versions of the supplied original synthesized audio, explicitly run `node tools/gen_star_not_audio.mjs` in the engine checkout, then `node tools/gen_examples.mjs star-not`. The generator source is below; it writes WAV files, not network requests. Do not run it after supplying your own replacements unless you want to overwrite them.

::: example-code tools/gen_star_not_audio.mjs javascript

## 15. Understand saving and completion
One plain campaign object holds progress. Strategic changes and encounter results save it in Nord's versioned slot storage. Export save downloads portable JSON; Import validates that JSON before replacing the campaign.

The checkpoint is a **planet checkpoint**, not every bullet in the arena. Loading during combat returns to orbit so the encounter can restart. This is a deliberate small-game rule, explained in the menu.

Victory needs all three cores and both new accords at Earth. Defeat happens after day 40. These rules belong to the campaign; a separate screen merely explains the result.

## 16. Open and play your copy

```bash
nord serve my-star-not
```

Follow the guide route: Mercury → Mars → Jupiter → Venus → Saturn → Uranus if supplies are needed → Neptune → Earth. Mars accepts the Mercury scrap; Venus accepts the Jupiter ice. Dock after earning accords. Both outer patrols must be defeated for their cores.

Choose co-op before the next encounter. P2 helps in combat; P1 handles travel and dialogue. If using a shared keyboard, its hardware may limit how many keys it can report at once. A standard gamepad avoids that overlap.

## 17. Keep the source and licence with the game
Copy `GUIDE.md`, `assets.md`, `SOURCE.md` and `COPYING` from the example into your project. They explain controls, reuse, source attribution and the game-code licence. When you redistribute a modified GPL game, keep the source and licence obligations in mind; the new artwork/audio and font have their own permissions recorded alongside them.

## 18. Share the finished game
Use the editor's Export or `nord build my-star-not`. Share the complete output folder. Keep your editable project and source attribution separately. The game uses only local runtime, artwork and audio files.

For your next, bigger game, use [the design and folder-structure guide](tut-t21-project-design.html) to choose one small vertical slice before expanding the content.
