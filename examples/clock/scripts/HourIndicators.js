import { MonoBehaviour, SerializeField, Header, Tooltip, Button } from 'nord';

/** Optional helper for the clock: builds the twelve hour indicators for you. It does nothing while the game runs; it works in the editor. */
export default class HourIndicators extends MonoBehaviour {
  static attributes = SerializeField({
    radius: Header('Layout', Tooltip('Distance of every indicator from the centre of the clock', 4)),
    depth: Tooltip('Z position: negative is in front of the face', -0.25),
    indicatorSize: [0.5, 1, 0.1],
    material: { type: 'asset', assetType: 'material', default: 'assets/materials/hour-indicator.mat.json' },
    generate: Button('Generate hour indicators', 'GenerateHourIndicators'),
  });

  /** Runs in the editor when you press the button in the Inspector. `ctx.entity` is the object that has this script (the clock). */
  static GenerateHourIndicators(ctx) {
    for (const old of ctx.FindAll((e) => /^Hour Indicator \d+$/.test(e.name))) ctx.Destroy(old);   // regenerate cleanly

    const { radius, depth, indicatorSize, material } = ctx.attrs;
    for (let hour = 1; hour <= 12; hour++) {
      const angle = (hour * 30 * Math.PI) / 180;               // each hour is 30 degrees, clockwise from the top
      ctx.CreateChild({
        name: `Hour Indicator ${hour}`,
        pos: [radius * Math.sin(angle), radius * Math.cos(angle), depth],
        rot: [0, 0, -hour * 30],                               // clockwise is negative, like the manual version
        scale: indicatorSize,
        components: [
          { type: 'mesh', shape: 'box', size: [1, 1, 1], castShadow: true },
          { type: 'material', asset: material },
        ],
      });
    }
    ctx.log('Created 12 hour indicators');
  }
}
