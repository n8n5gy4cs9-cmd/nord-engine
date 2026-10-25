import { Singleton, GameManager, UnityEvent, EventBus, PlayerPrefs, Time } from 'nord';

/** The rules of one run: what the hero carries, the clock, and how it ends. Lives live in the GameManager. */
export default class Run extends Singleton {
  Awake() {
    const gm = GameManager.instance;                                  // every run starts with full hearts, even after a trip to the title screen
    gm.score = 0; gm.lives = gm.attrs.startLives; gm.state = 'playing';
    this.coins = 0;
    this.keys = 0;
    this.elapsed = 0;
    this.ended = false;
    this.best = PlayerPrefs.GetInt('ember.best', 0);
    this.onChanged = new UnityEvent();                               // public UnityEvent onChanged;
    this.onEnded = new UnityEvent();
  }

  Start() {
    this.off = EventBus.Subscribe('gameover', () => this.End(false)); // the GameManager says so when the last heart is gone
    this.audio.music('assets/audio/music/music_adventure.mp3', { volume: 0.35 });
  }

  AddCoin(n = 1) { this.coins += n; this.onChanged.Invoke(); }
  AddKey() { this.keys++; this.onChanged.Invoke(); }

  /** Doors call this: spends a key if there is one. */
  UseKey() {
    if (this.keys <= 0) return false;
    this.keys--;
    this.onChanged.Invoke();
    return true;
  }

  Heal() { const gm = GameManager.instance; gm.SetLives(Math.min(gm.attrs.startLives, gm.lives + 1)); }

  Update() {
    if (this.ended) return;
    this.elapsed += Time.deltaTime;
    this.tick = (this.tick ?? 0) - Time.deltaTime;
    if (this.tick <= 0) { this.tick = 0.25; this.onChanged.Invoke(); }
  }

  End(win) {
    if (this.ended) return;
    this.ended = true;
    const score = this.coins * 10 + (win ? Math.max(0, 300 - Math.floor(this.elapsed)) * 5 : 0);   // a faster win is worth more
    const record = win && score > this.best;
    if (record) { this.best = score; PlayerPrefs.SetInt('ember.best', score); }
    this.audio.stopMusic();
    this.audio.play(`assets/audio/music/${win ? 'jingle_victory' : 'jingle_game_over'}.mp3`, { volume: 0.7 });
    this.onEnded.Invoke({ win, score, best: this.best, record, coins: this.coins, time: this.elapsed });
  }

  OnDestroy() { this.off?.(); }
}
