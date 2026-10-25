import { MonoBehaviour, SerializeField, EntityRef } from 'nord';

export default class Clock extends MonoBehaviour {
  // Inspector fields. Each one holds the NAME of an object in the scene; the Inspector shows a picker for it.
  static attributes = SerializeField({
    hoursPivot: EntityRef('Hours Arm Pivot'),
    minutesPivot: EntityRef('Minutes Arm Pivot'),
    secondsPivot: EntityRef('Seconds Arm Pivot'),
  });
}
