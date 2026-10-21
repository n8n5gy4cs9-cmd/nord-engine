# Two Floors

Arrows/WASD step or bump-attack. Space waits one turn. H drinks a potion. Collect the key to open the central door. E uses nearby stairs. On floor 2 recover the relic to win. R restarts both floors. Each successful move, attack, wait or potion gives visible monsters a turn; walls and locked doors do not consume turns.

Open levels/floor1.level2d.json or floor2.level2d.json in 2D Level. Tiles define walkability; object Inspector → dungeon-object.js defines kind, HP, accuracy, defense, damage range, armor, value and next scene. Level controller is scripts/dungeon-game.js; its attributes define floor number and tile size. Save with the same floor1/floor2 basename to update the scene used by stairs. Use as game start on floor1. Original art, GPL-3.0-or-later rules adaptation; SOURCE.md and LICENSE.md.
