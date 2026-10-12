import { NordScript } from 'nord';
export default class Hero extends NordScript {
  static attributes = { speed: { type: 'number', default: 120, min: 0 }, jump: { type: 'number', default: 380 } };
  start() { this.sprite = this.entity.getComponent('animatedSprite'); this.coins = 0; this.hud = this.scene.find('Score'); }
  fixedUpdate() {
    const dir = this.input.axis('left', 'right');
    this.physics.setVelocity(this.entity, dir * this.attrs.speed, null);
    if (dir) this.sprite.setFlip(dir < 0);
    if (this.input.pressed('jump') && this.physics.isGrounded(this.entity)) this.physics.setVelocity(this.entity, null, -this.attrs.jump);
  }
  update() {
    const want = !this.physics.isGrounded(this.entity) ? 'jump' : this.input.axis('left', 'right') ? 'walk' : 'idle';
    if (want !== this.sprite.current) this.sprite.play(want);
  }
  onTriggerEnter(other) { if (other.hasTag('coin')) { this.coins++; this.audio.play('assets/audio/sfx/coin.wav'); other.destroy(); this.hud.set('uiLabel', 'text', `Score: ${this.coins}`); this.game.camera.flash(150); } }
}
