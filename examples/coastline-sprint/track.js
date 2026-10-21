export const COURSE = {
  length: 180000,
  limit: 65,
  checkpoints: [60000, 120000],
  bonus: 18,
  maxSpeed: 4800,
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function curve(z) {
  const t = z / COURSE.length;
  return t < 0.12 ? 0 : Math.sin(z / 8500) * 0.65 * (t > 0.9 ? 0.3 : 1);
}
export const hill = (z) => Math.sin(z / 12000) * 450 + Math.sin(z / 4700) * 90;
export function driver(index = 0) {
  return {
    index,
    x: index ? 0.3 : -0.3,
    z: 0,
    speed: 0,
    time: COURSE.limit,
    elapsed: 0,
    nitro: 1,
    checkpoint: 0,
    hits: 0,
    cooldown: 0,
    finished: false,
    lost: false,
    steer: 0,
  };
}
export const traffic = () =>
  Array.from({ length: 24 }, (_, i) => ({
    id: i,
    z: 7000 + i * 6900,
    x: [-0.64, 0, 0.64][i % 3],
    speed: 1350 + (i % 4) * 210,
  }));
export function updateDriver(p, input, dt, cars) {
  if (p.finished || p.lost) return [];
  dt = Math.min(dt, 0.05);
  const events = [];
  p.elapsed += dt;
  p.time = Math.max(0, p.time - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.skid = Math.max(0, (p.skid ?? 0) - dt);
  const boost = input.boost && p.nitro > 0 && input.accel > 0;
  p.nitro = clamp(p.nitro + (boost ? -0.4 : 0.14) * dt, 0, 1);
  p.speed = clamp(
    p.speed + (input.accel * 2400 - input.brake * 4200 - 500) * dt,
    0,
    COURSE.maxSpeed * (boost ? 1.3 : 1),
  );
  p.steer = input.steer;
  p.x +=
    input.steer * dt * (0.5 + p.speed / COURSE.maxSpeed) * 1.25 -
    ((curve(p.z) * p.speed) / COURSE.maxSpeed) * dt * 0.7;
  p.x = clamp(p.x, -1.8, 1.8);
  if (Math.abs(p.x) > 1.05) p.speed = Math.max(0, p.speed - 3200 * dt);
  if (
    p.skid === 0 &&
    p.speed > 1800 &&
    ((input.brake > 0.2 && Math.abs(input.steer) > 0.4) || Math.abs(p.x) > 1.15)
  ) {
    p.skid = 0.8;
    events.push('skid');
  }
  p.z += p.speed * dt;
  if (p.cooldown === 0)
    for (const car of cars)
      if (Math.abs(car.z - p.z) < 500 && Math.abs(car.x - p.x) < 0.23) {
        p.speed *= 0.3;
        p.cooldown = 1.4;
        p.hits++;
        events.push('crash');
        break;
      }
  if (
    p.checkpoint < COURSE.checkpoints.length &&
    p.z >= COURSE.checkpoints[p.checkpoint]
  ) {
    p.checkpoint++;
    p.time += COURSE.bonus;
    events.push('checkpoint');
  }
  if (p.z >= COURSE.length) {
    p.z = COURSE.length;
    p.finished = true;
    events.push('win');
  } else if (p.time === 0) {
    p.lost = true;
    events.push('crash');
  }
  return events;
}
export function padInput(pad) {
  const button = (i) => pad?.buttons?.[i]?.value ?? 0;
  const axis = pad?.axes?.[0] ?? 0;
  return {
    steer: Math.abs(axis) > 0.14 ? axis : 0,
    accel: Math.max(button(7), button(0)),
    brake: Math.max(button(6), button(1)),
    boost: button(2) > 0.5,
  };
}
