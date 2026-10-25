import { NordScript } from 'nord';

export default class Title extends NordScript {
  async start() {
    const best = this.save.get('ember.best', 0);
    this.audio.music('assets/audio/music/music_menu_chill.mp3', { volume: 0.5 });
    const at = (name, x, y, z, comps, layer = 0) => this.scene.spawnData({ name, tags: [], layer, transform: { pos: [x, y, z], rot: [0, 0, 0], scale: [1, 1, 1] }, components: comps, scripts: [], children: [] });
    await at('Floor', 320, 400, -5, [{ type: 'sprite', texture: 'assets/sprites/floor.png', size: [1280, 800], tint: '#3a3a4a', alpha: 1 }]);
    await at('Embers', 320, 370, 1, [{ type: 'particles', texture: 'assets/particles/spark.png', tint: '#ffb86b', tintEnd: '#ff4a1c', frequency: 70, lifespan: 3200,
      speed: [15, 40], angle: [255, 285], emitRadius: 280, scale: [0.5, 0], alpha: [1, 0] }]);
    await at('Hero', 250, 246, 3, [{ type: 'animatedSprite', texture: 'assets/sprites/hero.png', anim: 'idle', tint: '#ffffff' }]);
    await at('Slime', 392, 252, 3, [{ type: 'animatedSprite', texture: 'assets/sprites/enemy_slime.png', anim: 'idle' }]);
    await at('Brazier', 320, 244, 3, [{ type: 'sprite', texture: 'assets/sprites/brazier.png', size: [40, 40], tint: '#ffffff', alpha: 1 }]);

    this.widgets = [                                                // keep them: UI outlives the scene unless we remove it
      this.ui.label('EMBER CRYPT', { screen: 'hud', anchor: 'c', y: -100, size: 60, color: '#ffb86b' }),
      this.ui.label('Find two keys. Open two gates. Escape.', { screen: 'hud', anchor: 'c', y: -52, size: 18, color: '#cfd8ff' }),
      this.ui.button('Play', () => this.game.loadScene('scenes/main.scene.json'), { screen: 'hud', anchor: 'c', y: 20 }),
      this.ui.label('WASD / arrows move   Space or J attacks   Esc pauses', { screen: 'hud', anchor: 'c', y: 138, size: 14, color: '#8d93b3' }),
    ];
    if (best) this.widgets.push(this.ui.label(`Best score ${best}`, { screen: 'hud', anchor: 'c', y: 62, size: 16, color: '#ffd34d' }));
  }

  onDestroy() { this.widgets?.forEach((w) => w.remove()); }
}
