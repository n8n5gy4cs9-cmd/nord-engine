---
title: T24 A platformer from events
section: Tutorials
order: 24
summary: Make a small platformer with an event sheet and behaviors — coins, enemies, a turret and a win — with no scripts.
---
**Result:** a one-screen platformer: run and jump, collect coins, dodge slimes and a turret, reach the flag.
**Already built:** `examples/event-sheets/` (regenerate with `node tools/gen_eventsheet_demo.mjs`). Open it, press play, then read along.

<figure class="shot"><img src="assets/screenshots/es-1-start.png" alt="Start of the event sheet platformer" loading="lazy"><figcaption>Where we start: hero on the ground, coins floating, slimes patrolling, a turret in the corner.</figcaption></figure>

::: dummies
You will write almost no code. The pieces are **behaviors** (ready movement) and **events** (rules). Think "what should happen when…?" for each rule.
:::

## 1. A hero that moves
Give the Hero entity a collider and the **Platform** behavior. Give the ground and ledges **Solid**, the cloud platform **Jumpthru**. Add input actions `left`, `right`, `jump` to `nord.project.json`. Run it: the hero runs, jumps (twice with `doubleJump`) and lands.

## 2. Look alive (animation)
Three events in a group, using *Else*:
1. `Hero Platform is-jumping` **or** `is-falling` (Or-block) → `set-animation "jump"`
2. `else` + `Hero Platform is-moving` → `set-animation "walk"`
3. `else` → `set-animation "idle"`

And every tick: `set-mirrored  Hero.Platform.Facing < 0`.

## 3. Coins
`Hero is-overlapping Coin` → `add-to-var coins 1`, play a sound, `Coin destroy`. Because *is-overlapping* picked only the touching coin, `destroy` removes just that one.

<figure class="shot"><img src="assets/screenshots/es-2-coin.png" alt="Coins counted in the HUD after collecting one" loading="lazy"><figcaption>The HUD text is one event: every tick, <code>Hud set-text "Coins " &amp; coins &amp; "   Lives " &amp; lives</code>.</figcaption></figure>

## 4. Enemies
Slimes move with **Sine** (horizontal, magnitude 90). They share the tag `enemy`, so one event covers all of them: `Hero is-overlapping enemy` + `trigger-once-while-true` → `subtract-from-var lives 1`, move the hero back to the start. An event `lives <= 0` → `restart-layout`.

## 5. A turret
Add **Turret** to the robot: `targetType: "Hero"`, `rateOfFire: 0.6`. It turns toward the hero when it has a clear line (Solids block it). Then one event does the shooting:
`Turret on-shoot` → `create-object Bullet at Turret.X, Turret.Y`, then `Bullet set-angle-of-motion Turret.Angle`. The bullet prefab has **Bullet** + **DestroyOutsideLayout**, so shots clean themselves up. Another event, `Hero is-overlapping Bullet`, makes them hurt.

## 6. Win
`Hero is-overlapping Flag` and `won = 0` → set `won` to 1, show *You win!* on the Message text, disable the hero's Platform.

<figure class="shot"><img src="assets/screenshots/es-5-win.png" alt="You win message after reaching the flag" loading="lazy"><figcaption>The finished game. The whole rule set is under 50 lines of JSON.</figcaption></figure>

## Try next
* Add a **Timer** on the Turret to change its fire rate every 5 seconds.
* Give Coins a **Tween** to float up and fade when collected (`tween-property opacity`), destroying them on `on-tween-finished`.
* Make the slimes follow you with **Pathfinding** (`find-path Hero.X, Hero.Y` every second).
* Mix in a JavaScript script for something special — scripts and events work in the same scene.

Test it from the terminal: `node tools/eventsheet-demo-test.mjs` (headless Chromium; screenshots land in `target/eventsheets/`).
