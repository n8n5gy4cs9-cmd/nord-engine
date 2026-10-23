---
title: T50 A hero that idles, walks and jumps (Animator)
section: Tutorials
order: 50
summary: Draw an animation state machine for a sprite with parameters and transitions, test it live, and drive it from a script.
---
**Result:** the platformer hero switches between `idle`, `walk` and `jump` by itself while your script only sets `speed` and `grounded`. Allow 25 minutes. **Start from:** `examples/platformer` (its hero sheet has the clips `idle`, `walk`, `jump`).

::: dummies
Without an Animator your script says "play walk now, play idle now" everywhere. With one you draw the rules once (an **arrow** from Idle to Walk when `speed > 0.1`) and the game follows them.
:::

## 1. Create the controller
**Assets ▸ right-click ▸ New animator controller** makes `anim/new-controller.animator.json` and opens the **Animator** tab. Rename the file to `hero.animator.json`.

## 2. Parameters and states
1. **+ Parameter** `speed` (type *float*) and `grounded` (type *bool*, tick the default).
2. The `Idle` state exists already (animation `idle`). **+ State** `Walk` (animation `walk`), **+ State** `Jump` (animation `jump`). The animation field suggests the clips of your sprite sheets.

## 3. Transitions
1. Select **Idle**, press **Make transition**, click **Walk**. On the right untick **Has exit time**, press **+ Condition**: `speed` `>` `0.1`.
2. Do the same Walk → Idle with `speed` `<` `0.1`.
3. Select **Any State**, make a transition to **Jump** with condition `grounded` is false (Jump from anywhere).
4. Jump → Idle with `grounded` is true.
5. The **Checks** list on the left must say *No problems*.
6. Press **▶ Test**. Change `speed` and `grounded` in the left panel: the green state follows your arrows.

## 4. Use it
On the hero entity keep the **animatedSprite** and add an **animator** component: **Controller** = `anim/hero.animator.json`. In the hero script:
```js
update() {
  const a = this.entity.getComponent('animator');
  a.setFloat('speed', Math.abs(this.vx));
  a.setBool('grounded', this.onGround);
}
```
(Use your script's own names for velocity and ground state.) Press Play.

**Check yourself:** the hero stands in `idle`, plays `walk` while moving and `jump` in the air. If nothing changes, make sure the hero's own `animatedSprite` does not set an animation on every frame. For 3D models the same controller works: put the animator next to a **model** component and use the glTF animation names. Reference: [Animator](animator.html). **Next:** [T51 Ship it with hosting presets](tut-t51-hosting-presets.html).
