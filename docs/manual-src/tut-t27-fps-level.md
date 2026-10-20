---
title: T27 Build your first FPS level
section: Tutorials
order: 27
summary: Rooms, a door, enemies, a key, a switch and an exit — then play it.
---
**Project:** template **FPS Creator (level editor)**. Open the **FPS Level** tab. Choose **File ▸ New** (*empty level*) so we start from nothing.

1. **A room.** Press `R`, drag a 6×5 rectangle on the map. You get a floor, ceiling and walls. In **Build** pick *Red brick* for the wall slot first if you like.
2. **Light.** **Items ▸ Lights ▸ Ceiling lamp** → click in the middle of the room. The 3D view lights up.
3. **A door.** In **Build ▸ Doors** pick *Door (slides up)*, press `W` and click the middle of the east wall. A second room: press `R` and drag a 4×4 rectangle next to it, wall to wall.
4. **Start and exit.** **Items ▸ Markers**: *Player start* in room 1 (`Q`/`E` rotate it to face the door), *Level exit* in room 2.
5. **Press F5.** Walk to the door — it opens by itself. Walk into the exit pad: *Level complete*.
6. **An enemy.** **Items ▸ Enemies ▸ Guard** → click room 2. Select it and open **Inspector ▸ Scripts ▸ Shooter AI**: lower *Accuracy* to 0.3 and *Damage per shot* to 3 to be kind. Press `P`, click two points to give it a patrol path.
7. **A locked door.** Select the door, tick **Locked with key ▸ red**, name it `vault`. Place **Pickups ▸ Red key** in room 1.
8. **A switch instead.** Place **Props ▸ Wall switch** in room 1, set its **Target** to `vault`. Untick **Opens by itself** on the door. Press E on the switch in the test.
9. **A rule.** Select the guard → **Rules ▸ + Add rule**: *When it is killed → Show message → "Nice shot!"*.
10. **Save** (`Ctrl+S`) as `levels/level2.fpsl.json`. In the project's FPS Level entity set **Level file** to it and press **Run**.

**Next:** [FPS Creator chapter](fps-creator.html) · add your own texture or enemy in the **Assets** tab.
