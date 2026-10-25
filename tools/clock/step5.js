import { MonoBehaviour, SerializeField, EntityRef, Quaternion } from 'nord';

const hoursToDegrees = -30, minutesToDegrees = -6, secondsToDegrees = -6;

export default class Clock extends MonoBehaviour {
  static attributes = SerializeField({
    hoursPivot: EntityRef('Hours Arm Pivot'),
    minutesPivot: EntityRef('Minutes Arm Pivot'),
    secondsPivot: EntityRef('Seconds Arm Pivot'),
  });

  Start() {
    this.hours = this.Find(this.hoursPivot);
    this.minutes = this.Find(this.minutesPivot);
    this.seconds = this.Find(this.secondsPivot);
  }

  Update() {                                                  // every frame, so the arms follow the time
    const time = new Date();
    this.hours.transform.localRotation = Quaternion.Euler(0, 0, hoursToDegrees * time.getHours());
    this.minutes.transform.localRotation = Quaternion.Euler(0, 0, minutesToDegrees * time.getMinutes());
    this.seconds.transform.localRotation = Quaternion.Euler(0, 0, secondsToDegrees * time.getSeconds());
  }
}
