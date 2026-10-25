// The visible screen inside the monitor bezel. A plain static helper class, like a Unity static utility.
export default class Playfield {
  static Left = 40;
  static Right = 760;
  static Top = 36;
  static Bottom = 564;
  static Width = 720;
  static Height = 528;

  /** Asteroids has no walls: leave on one side, come back on the other. */
  static Wrap(entity, margin = 0) {
    const p = entity.pos;
    let x = p[0], y = p[1];
    if (x < Playfield.Left - margin) x += Playfield.Width + margin * 2;
    else if (x > Playfield.Right + margin) x -= Playfield.Width + margin * 2;
    if (y < Playfield.Top - margin) y += Playfield.Height + margin * 2;
    else if (y > Playfield.Bottom + margin) y -= Playfield.Height + margin * 2;
    if (x !== p[0] || y !== p[1]) entity.pos = [x, y, p[2]];
  }

  /** A random point on the border of the screen. */
  static RandomEdgePoint() {
    return Math.random() < 0.5
      ? [Math.random() < 0.5 ? Playfield.Left : Playfield.Right, Playfield.Top + Math.random() * Playfield.Height]
      : [Playfield.Left + Math.random() * Playfield.Width, Math.random() < 0.5 ? Playfield.Top : Playfield.Bottom];
  }
}
