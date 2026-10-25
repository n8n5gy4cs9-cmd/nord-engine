// Small effects shared by many scripts. Plain functions: no entity, no state.

/** Text that floats up and fades out. Layer 1 keeps it above the darkness. */
export function floatText(scene, x, y, text, color = '#ffffff', size = 12) {
  scene.spawnData({
    name: 'FloatText', tags: [], layer: 1,
    transform: { pos: [x, y - 10, 5], rot: [0, 0, 0], scale: [1, 1, 1] },
    components: [{ type: 'text', text: String(text), size, color, bold: true, stroke: '#000000', strokeThickness: 3 }],
    scripts: [], children: [],
  }).then((e) => {
    const s = { dy: 0, a: 1 };
    scene.scheduler.tween(s, { dy: -22, a: 0 }, {
      duration: 0.8, ease: 'quadOut',
      onUpdate: () => { if (!e.destroyed) { e.pos = [x, y - 10 + s.dy, 5]; e.native.setAlpha(s.a); } },
      onComplete: () => e.destroy(),
    });
  });
}

/** A one-shot burst of particles at a point. */
export function burst(scene, x, y, { texture = 'assets/particles/spark.png', tint = '#ffd27a', tintEnd = '#ff5a1f', count = 14, speed = [40, 140], life = 450 } = {}) {
  scene.spawnData({
    name: 'Burst', tags: [], layer: 1,
    transform: { pos: [x, y, 6], rot: [0, 0, 0], scale: [1, 1, 1] },
    components: [{ type: 'particles', texture, tint, tintEnd, burst: count, emitting: false, lifespan: life, speed, scale: [0.5, 0], alpha: [1, 0] }],
    scripts: [], children: [],
  }).then((e) => scene.scheduler.after(life / 1000 + 0.2, () => e.destroy()));
}

/** Freezes the game for a blink on a heavy hit. Real time: the game clock is the thing being slowed. */
export function hitStop(game, ms = 60) {
  game.timeScale = 0.05;
  setTimeout(() => { game.timeScale = 1; }, ms);
}
