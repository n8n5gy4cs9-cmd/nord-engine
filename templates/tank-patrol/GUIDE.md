# Tiny Tank Patrol

WASD/arrows drive in four directions. Hold Space to fire. Destroy three red tanks while protecting the green HQ. Wooden crates are destructible; metal obstacles and solid tiles stop shells. R resets the arena.

Open levels/arena.level2d.json in the 2D Level Creator. Select a tank/brick/base and edit tank-object.js attributes: kind, hp, speed, fireDelay and score. The Level controller scripts/tank-game.js has bullet speed, player fire delay, time limit and enemy aggression in Level controller attributes. Save as arena to update scenes/arena.scene.json, or Use as game start for another name. New Solid tiles are respected by gameplay. Read the full HTML tutorial in the manual.
