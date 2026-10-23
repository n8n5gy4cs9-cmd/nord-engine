// Title screen: loads the menu UI and starts a run.
import { MonoBehaviour } from 'nord';

export default class Menu extends MonoBehaviour {
  async Start() {
    this.screen = await this.game.ui.load('ui/menu.ui.json');
    this.screen.set('best', this.game.save.get('neon-harbor-best', 0));
    this.screen.on('play', () => { this.game.audio?.play('assets/audio/sfx/confirm.wav', { bus: 'ui' }); this.game.loadScene('scenes/harbor.scene.json'); });
    this.game.audio?.play('assets/audio/music/music_action.mp3', { bus: 'music', loop: true, volume: 0.2 });
  }

  OnDestroy() { this.screen?.destroy(); this.game.audio?.stopMusic?.(); }
}
