import { MonoBehaviour, SerializeField, UnityInput as Input, Time, Mathf, Vector2, Vector3 } from 'nord';

export default class Hero extends MonoBehaviour {
  static attributes = SerializeField({ speed: 160 });               // [SerializeField] float speed = 160;

  Update() {
    // Input.GetAxis gives -1..1 from A/D, W/S, the arrows and a gamepad stick. ClampMagnitude stops diagonals from being 41% faster.
    const move = Vector2.ClampMagnitude(new Vector2(Input.GetAxis('Horizontal'), Input.GetAxis('Vertical')), 1);
    const p = this.position;
    this.position = new Vector3(
      Mathf.Clamp(p.x + move.x * this.speed * Time.deltaTime, 12, 628),    // keep the 24 px hero on the 640 x 360 screen
      Mathf.Clamp(p.y - move.y * this.speed * Time.deltaTime, 12, 348),    // minus: Unity's y points up, Nord's screen y points down
      p.z);
  }
}
