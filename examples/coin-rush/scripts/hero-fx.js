import { NordScript } from 'nord';

// Hero animation + sound glue (kept separate from the movement controller on purpose).
export default class HeroFx extends NordScript {
  start() { this.sprite = this.entity.getComponent('animatedSprite'); this.off = [this.events.on('jump', () => this.audio.play('assets/audio/sfx/coin.wav', { volume: 0.2 }))]; }
  onDestroy() { this.off?.forEach((o) => o()); }
  update() {
    const g = this.physics.isGrounded(this.entity), dir = this.input.axis('left', 'right'), want = this.entity.stunned ? 'hurt' : !g ? 'jump' : dir ? 'walk' : 'idle';
    if (want !== this.sprite.current) this.sprite.play(want);
  }
}
