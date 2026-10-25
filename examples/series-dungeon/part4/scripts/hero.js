import { MonoBehaviour, SerializeField, UnityInput as Input, Vector2 } from 'nord';

export default class Hero extends MonoBehaviour {
  static attributes = SerializeField({ speed: 160 });

  FixedUpdate() {
    const move = Vector2.ClampMagnitude(new Vector2(Input.GetAxis('Horizontal'), Input.GetAxis('Vertical')), 1);
    this.velocity = new Vector2(move.x, -move.y).Mul(this.speed);     // rb.velocity = ...: the physics engine moves us and stops us at walls
  }
}
