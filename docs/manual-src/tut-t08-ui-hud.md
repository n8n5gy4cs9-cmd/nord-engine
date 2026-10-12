---
title: T08 UI & HUD
section: Tutorials
order: 8
summary: Score, hearts, menus and game-over screen.
---
**Project:** `examples/space-shooter` or `examples/platformer`.

1. Add the library `ui-hud.js` to any entity: hearts bound to the `Player`'s `health` events, plus a coin counter fed by `pickup` events.
2. Score: add `score.js` — it listens to `events.emit('score', n)`, shows a combo-multiplied score and stores the high score in `save`.
3. Your own label: `const l = this.ui.label('Wave 1', { anchor: 'tr', x: 12, y: 8, size: 24 }); l.set('Wave 2');`
4. Menu: `ui-main-menu.js` and `ui-pause.js` (library) build screens with `ui.menu`; `ui-gameover.js` shows when the player dies.
5. Make it yours: `this.ui.setTheme({ theme: 'dracula', skin: 'cyber' })` or set `ui.skin`/`ui.theme` in the project file.

Reference: [UI & HUD](ui.html). **Next:** [T09 Audio](tut-t09-audio.html).
