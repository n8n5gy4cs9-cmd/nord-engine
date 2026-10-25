import { MonoBehaviour, PlayerPrefs, SceneManager } from 'nord';

export default class Title extends MonoBehaviour {
  Start() {
    const best = PlayerPrefs.GetInt('ember.best', 0);
    this.audio.music('assets/audio/music/music_menu_chill.mp3', { volume: 0.5 });
    this.widgets = [                                                 // keep them: UI outlives the scene unless we remove it
      this.ui.label('EMBER CRYPT', { screen: 'hud', anchor: 'c', y: -100, size: 60, color: '#ffb86b' }),
      this.ui.label('Find two keys. Open two gates. Escape.', { screen: 'hud', anchor: 'c', y: -52, size: 18, color: '#cfd8ff' }),
      this.ui.button('Play', () => SceneManager.LoadScene('scenes/main.scene.json'), { screen: 'hud', anchor: 'c', y: 20 }),
      this.ui.label('WASD / arrows move   Space or J attacks   Esc pauses', { screen: 'hud', anchor: 'c', y: 138, size: 14, color: '#8d93b3' }),
    ];
    if (best) this.widgets.push(this.ui.label(`Best score ${best}`, { screen: 'hud', anchor: 'c', y: 62, size: 16, color: '#ffd34d' }));
  }

  OnDestroy() { this.widgets?.forEach((w) => w.remove()); }
}
