---
title: T11 3D physics (FPS)
section: Tutorials
order: 11
summary: First-person controller, crates, hit-scan shooting.
---
**Project:** `nord new arena -t fps-arena` · finished: `examples/fps-arena`.

1. The player is an entity with `rigidbody` (dynamic, `fixedRotation`), `collider` capsule and the library `fps3d.js` script; the **camera is a child** called `Camera` at local `y = 0.7`.
2. Tune feel in the Inspector: `speed`, `sprintFactor`, `jumpSpeed`, `sensitivity`.
3. Crates: `rigidbody` dynamic + `collider` box + `physics-crate.js` (breakable). Walls and floor: collider only.
4. Shooting: `physics-hitscan.js` casts `game.physics.raycast(from, to, { ignore })` from the camera and emits damage on the hit entity.
5. Targets use `health` and a tiny script that counts kills (`arena.js` in the example).

Reference: [Physics](physics.html). **Next:** [T12 Enemy AI](tut-t12-enemy-ai.html).
