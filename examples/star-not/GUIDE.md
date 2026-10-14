# Star-Not — expedition guide

A complete small adventure inside our solar system. There are exactly three peoples: **Earth-race, Mars-race and Venutians**. Patrols belong to those peoples, including rogue crews; no fourth race is introduced.

## Goal
Recover the three relay cores at Mercury, Saturn and Neptune, obtain the Mars and Venutian accords, then activate the solar relay at Earth by day 40. Earth already supports your mission. Travel and combat cost days; the campaign does not advance while you read menus.

## An approachable route
1. Start a new expedition at Earth. Select a co-op option on the title screen if wanted.
2. Travel to Mercury; salvage its relay core and two scrap.
3. Go to Mars; trade those two scrap for the Mars accord (or win its friendly duel). Dock to refuel/repair.
4. Visit Jupiter; collect clean ice and two scrap.
5. Visit Venus; deliver the ice for the Venutian accord. Dock.
6. Visit Saturn; defeat the rogue Mars patrol and recover its core.
7. Visit Uranus if needed; its one-time supplies refill fuel/crew and give two scrap.
8. Visit Neptune; defeat the rogue Venutian patrol and recover its core.
9. Return to Earth; activate the relay. The victory screen completes the game.

Click a planet, or choose it in the destination list. Travel buttons show fuel/day costs. Earth docks are free; Mars/Venus docks become available after their accords. One scrap converts to three fuel. If stranded, an emergency tow returns to Earth for three days and two crew. Upgrading at Earth costs two scrap and increases weapon damage.

## Combat
Ships turn and thrust, then keep drifting until you brake. Both arena edges wrap around. Shots wrap too, and expire quickly. Shields block damage for about one second, then need five seconds to recharge. Disable the enemy ship to win; if all allied ships are disabled, rescue crews return you to orbit. Repair and retry while time remains. Retreat costs two days.

| Action | Player 1 keyboard | Player 2 shared keyboard | Player 2 standard gamepad |
|---|---|---|---|
| Turn | Left / Right arrows | A / D | Left stick horizontal |
| Thrust | Up arrow | W | Stick up or right trigger |
| Brake | Down arrow | S | B / Circle |
| Fire | Space | F | A / Cross |
| Shield | Either Shift | G | X / Square |
| Pause | Esc or P | Shared | Start / Menu |

## Co-op
Choose **Co-op · shared keyboard** or **Co-op · P2 gamepad** before an encounter, on the title screen or in the orbit menu. P1 controls the campaign; P2 is a combat wingmate in a mint-tinted Earth ship. P2's craft has 16 hull and is restored each encounter. An enemy has a little more hull in co-op. Friendly shots never hurt allies. If one allied ship survives and wins, the encounter is won—even if P1 was disabled. Both ships must be disabled for combat defeat.

Press a gamepad button after connecting so the browser exposes it. If the controller is missing, pause and connect it, or return to orbit and change the pilot mode. Shared keyboard support depends on the keyboard's simultaneous-key limit. This example does not support network co-op.

## Mobile / touch
Combat automatically shows a code-drawn joystick and FIRE/SHIELD buttons on touch devices. Enable/disable them from the orbit menu to try them with a mouse as well. Drag left/right to turn, up to thrust, down to brake; hold FIRE/SHIELD for those actions. Landscape is recommended. The reusable module is `scripts/sn/touch.js`; its action names and right/bottom insets can be changed for another Nord game.

## Saves/audio
Progress autosaves at strategic changes and encounter results. Menu offers Save checkpoint, portable JSON Export/Import, Mute, Resume and Title. A battle is not saved frame-by-frame: loading returns to its planet checkpoint. An imported save is checked before replacing progress. Start/Continue is also the audio-unlock gesture. Three original WAV tracks loop; eight WAV effects are separate reusable files.

## Source and tutorial
`tools/examples/star-not/` is the editable source. `node tools/gen_examples.mjs star-not` copies it into `examples/star-not/`. Full reconstruction tutorial: `docs/manual/nord/tutorials/tut-t20-star-not.html`; reusable assets: assets.md. Gameplay code is GPL-2.0-or-later because a small normal-thrust rule was adapted from the requested UQM branch; source attribution in SOURCE.md and COPYING. Original art/audio are MIT; font retains its own licence. Crowelian 2026 + Sonnet.
