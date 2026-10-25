import { MonoBehaviour, SerializeField, EntityRef, UnityInput as Input, KeyCode } from 'nord';

const two = (n) => String(n).padStart(2, '0');

export default class DigitalClock extends MonoBehaviour {
  static attributes = SerializeField({
    timeText: EntityRef('Time Text'),
    dateText: EntityRef('Date Text'),
    use24Hour: true,
    blinkColon: true,
  });

  Start() {
    // GetComponent('TextMesh') is the Unity name for the `text` component
    this.timeMesh = this.timeText.GetComponent('TextMesh');
    this.dateMesh = this.dateText.GetComponent('TextMesh');
  }

  Update() {
    if (Input.GetKeyDown(KeyCode.Space)) this.use24Hour = !this.use24Hour;   // Space switches 24 h / 12 h

    const now = new Date();
    let hours = now.getHours();
    const suffix = this.use24Hour ? '' : (hours >= 12 ? ' PM' : ' AM');
    if (!this.use24Hour) hours = hours % 12 || 12;

    const colon = this.blinkColon && now.getSeconds() % 2 === 1 ? ' ' : ':';
    this.SetText(this.timeMesh, `${two(hours)}${colon}${two(now.getMinutes())}${colon}${two(now.getSeconds())}${suffix}`);
    this.SetText(this.dateMesh, now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
  }

  // only touch the text when it changed: redrawing a texture sixty times a second for nothing is wasteful
  SetText(mesh, text) {
    if (mesh.text !== text) mesh.text = text;
  }
}
