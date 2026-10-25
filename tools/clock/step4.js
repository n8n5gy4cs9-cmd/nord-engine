import { MonoBehaviour, SerializeField, EntityRef, Quaternion } from 'nord';

const hoursToDegrees = -30, minutesToDegrees = -6, secondsToDegrees = -6;     // C# const: values that never change

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

    const time = new Date();                                  // read the clock once: C# DateTime.Now
    this.hours.transform.localRotation = Quaternion.Euler(0, 0, hoursToDegrees * time.getHours());
    this.minutes.transform.localRotation = Quaternion.Euler(0, 0, minutesToDegrees * time.getMinutes());
    this.seconds.transform.localRotation = Quaternion.Euler(0, 0, secondsToDegrees * time.getSeconds());
  }
}
