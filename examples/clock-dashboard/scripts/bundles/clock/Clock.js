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

  Update() {
    const now = new Date();
    // like TimeOfDay.TotalSeconds: seconds since midnight, with the fraction, so the arms glide instead of ticking
    const totalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    this.hours.transform.localRotation = Quaternion.Euler(0, 0, hoursToDegrees * (totalSeconds / 3600));
    this.minutes.transform.localRotation = Quaternion.Euler(0, 0, minutesToDegrees * (totalSeconds / 60));
    this.seconds.transform.localRotation = Quaternion.Euler(0, 0, secondsToDegrees * totalSeconds);
  }
}
