import { MonoBehaviour, SerializeField, EntityRef, Quaternion } from 'nord';

export default class Clock extends MonoBehaviour {
  static attributes = SerializeField({
    hoursPivot: EntityRef('Hours Arm Pivot'),
    minutesPivot: EntityRef('Minutes Arm Pivot'),
    secondsPivot: EntityRef('Seconds Arm Pivot'),
  });

  Start() {
    this.hours = this.Find(this.hoursPivot);                  // the field is a name, Find turns it into the object
    this.hours.transform.localRotation = Quaternion.Euler(0, 0, -30);     // always one o'clock for now
  }
}
