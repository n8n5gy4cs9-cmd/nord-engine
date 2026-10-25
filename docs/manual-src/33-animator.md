---
title: Animator
section: Manual
group: Gameplay, sound and interfaces
order: 33
summary: A Unity-style state machine for sprite animation. Parameters, states, transitions with conditions, Any State, live testing.
---

::: dummies
This is a reference chapter: you do not have to complete every section. Choose one task, make that change in the editor, and press Play to check the result. An **entity** is an object in your scene; a **component** adds a capability; a **script** adds your own rules.
:::

The **Animator** switches the animation of a sprite for you. Instead of writing `if (moving) play('run')` in every script, you draw states (Idle, Run, Jump) and the arrows between them, and the game follows the arrows while your script only sets a few values like `speed` or `jump`.

## Make one

1. **Assets ▸ right-click ▸ New animator controller** (or Window ▸ Editors ▸ Animator). It is saved as `anim/<name>.animator.json`.
2. Add **Parameters** on the left: *float* (speed), *int* (health), *bool* (grounded), *trigger* (jump: a one-shot that resets itself).
3. Add **states** (**+ State**). Each state plays one clip of your sprite sheet (type its name in *Animation*; the list is filled from the sprite sheets' animations).
4. Select a state, press **Make transition**, click the target. On the right set **Has exit time** (leave after the clip finished) and/or **Conditions** (all must be true).
5. **Any State** is a state that is always active: use it for things that can happen from anywhere (Hurt, Die).
6. Press **▶ Test**, change the parameters in the left panel and watch the green state move.

On the entity add an **Animated Sprite** (2D) or a **Model** (3D, then *Animation* = the glTF animation name) and an **Animator** component (controller = your file). For models, *Animation* in a state is the glTF animation name, *Speed* and *Loop* apply to it, and the model component's own *Animation* field should stay empty.

## From a script

**File: your script, for example `scripts/Player.js`** (inside `update(dt)`)
```js
const anim = this.entity.getComponent('animator');
anim.setFloat('speed', Math.abs(this.vx));
if (jumped) anim.setTrigger('jump');
anim.get('speed'); anim.state; // current state name
```

::: tip
The orange state is the default (the one the sprite starts in). A transition with no exit time and no conditions can never fire: the **Checks** list tells you.
:::

Full format and rules: `docs/ANIMATOR.md`.


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
