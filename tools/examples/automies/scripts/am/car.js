// Automies — car handling: a planar JavaScript port of Driver 2's physics from OpenDriver2/REDRIVER2 (GPL-2.0, src_rebuild/Game/C/):
//   handling.c  ProcessCarPad()                 → pad(): steering ramp, analogue steering curve, brake/accelerate thrust, handbrake/wheelspin flags
//   wheelforces.c GetFrictionScalesDriver1()     → frictionScales(): front/rear grip split, handbrake, burnout, auto-brake build-up
//   wheelforces.c AddWheelForcesDriver1()        → wheelForces(): per-wheel lateral force from slip velocity (speed-dependent gain), locked wheels, drag
//   wheelforces.c ConvertTorqueToAngularAcceleration + handling.c GlobalTimeStep → integrate()
//   gamesnd.c GetEngineRevs()/ControlCarRevs()   → revs(): gears, rev limiter, the power cut while changing gear
//   camera.c PlaceCameraFollowCar()              → see chaseCamera() in automies.js (same smoothing constants)
// Driver 2 runs at 30 Hz in fixed-point (ONE = 4096, ~112 world units per metre — confirmed by its own constants: the burnout cut-off 452952 is 29.6 m/s).
// This port keeps the original formulas and constants in their own units and converts at the edges (U, KV below), so numbers stay recognisable when you
// compare with the C code. Only the 3D rigid body parts (suspension height, pitch/roll, ground normals) are replaced by a flat ground — see GUIDE.md.
export const DT = 1 / 30;                 // fixed step, like the original
export const U = 112;                     // D2 world units per metre
const K_VEL = U * 4096 * DT;              // D2 velocity units per (m/s): 4096 velocity units = 1 world unit per frame
const K_ANG = Math.pow(2, 24) * DT;       // D2 angular velocity units per (rad/s): avel / 2^24 = radians per frame
// Tuning: Driver 2's unit scale is not exactly metric, so raw forces give ~3 g launches and brakes. LINEAR_DAMP divides every linear acceleration
// (thrust, tyre forces, drag alike → the top speed is unchanged). 1 = the original numbers.
export const LINEAR_DAMP = 1.7;
const fixedh = (x) => x / 4096;           // FIXEDH() without the rounding (floats)
export const ANG = (a) => (a / 4096) * Math.PI * 2; // D2 angle (4096 = full turn) → radians

// {frictionScaleRatio, aggressiveBraking, fourWheelDrive, autoBrakeOn} — handlingType[] in wheelforces.c
export const HANDLING = [
  { fs: 32, aggressive: 1, awd: 0, autoBrake: 1 }, { fs: 29, aggressive: 0, awd: 0, autoBrake: 0 }, { fs: 45, aggressive: 1, awd: 1, autoBrake: 0 },
  { fs: 55, aggressive: 1, awd: 1, autoBrake: 0 }, { fs: 68, aggressive: 1, awd: 1, autoBrake: 0 }, { fs: 32, aggressive: 1, awd: 0, autoBrake: 1 }, { fs: 29, aggressive: 0, awd: 0, autoBrake: 0 },
];
// gamesnd.c geard[2][4] = { lowidl_ws, low_ws, hi_ws, ratio_ac, ratio_id }; row 0 = player cars, row 1 = civilian cars
const GEARS = [
  [[0, 0, 163, 144, 135], [86, 133, 260, 90, 85], [186, 233, 360, 60, 57], [286, 326, 9999, 48, 45]],
  [[0, 0, 50, 144, 135], [43, 66, 100, 90, 85], [93, 116, 150, 60, 57], [143, 163, 9999, 48, 45]],
];
const MAX_REV_DROP = 1440, MAX_REV_RISE = 1600;

/**
 * cos: { powerRatio, traction (4096 = normal), twistY (yaw inertia^-1), wheelbase, track (m), length, width (m), mass (relative), hnd (index into HANDLING) }
 * State is in metres / seconds / radians; yaw is the heading (forward = (sin yaw, cos yaw), +yaw turns right).
 */
export class Car {
  constructor(cos, { x = 0, z = 0, yaw = 0, civ = false } = {}) {
    this.cos = cos; this.civ = civ; this.hnd = HANDLING[cos.hnd ?? 0];
    this.x = x; this.z = z; this.yaw = yaw; this.vx = 0; this.vz = 0; this.w = 0; // w = yaw rate rad/s
    this.thrust = 0; this.wheelAngle = 0; this.handbrake = 0; this.wheelspin = 0; this.autoBrake = 0; this.wheelSpeed = 0; this.speedU = 0;
    this.locked = [0, 0, 0, 0]; this.onGrass = [false, false, false, false]; this.revs = 0; this.gear = 0; this.changingGear = false;
    this.frontVel = 0; this.rearVel = 0; this.damage = 0; this.pitch = 0; this.roll = 0; this.lastPad = {};
    this.hw = (cos.wheelbase ?? 2.6) / 2; this.ht = (cos.track ?? 1.5) / 2;
    this.grass = null; // optional (x,z) → boolean
  }
  get speed() { return Math.hypot(this.vx, this.vz); }                              // m/s
  get forward() { return (this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw)); } // signed m/s along the heading
  get steer() { return ANG(this.wheelAngle); }                                      // front wheel angle (rad)

  /** One 30 Hz step. pad = { accel, brake, left, right, handbrake, wheelspin, fast (fast-steer), steer (analogue −127..127, or undefined) } */
  step(pad, grass = null) {
    this.processPad(pad);
    this.wheelForces(grass);
    this.revsStep();
  }

  // ---- ProcessCarPad (handling.c) -----------------------------------------------------------------------------------
  processPad(p) {
    const c = this;
    if (c.autoBrake > 90) c.autoBrake = 90;
    if (p.handbrake) c.handbrake = 1;
    else {
      c.handbrake = 0; c.wheelspin = p.wheelspin ? 1 : 0;
      if (c.wheelspin && c.wheelSpeed > 452952) { c.wheelspin = 0; p = { ...p, accel: true }; } // burnout ends at ~30 m/s
    }
    let steerKeys = p.left || p.right;
    if (p.steer === undefined || p.steer === null) {
      const max = p.fast ? 511 : 352, step = p.fast ? 64 : 32;
      if (p.right) c.wheelAngle = Math.min(max, c.wheelAngle + step);
      if (p.left) c.wheelAngle = Math.max(-max, c.wheelAngle - step);
      c.autoBrake = steerKeys ? c.autoBrake + 1 : 0;
    } else { // analogue: cubic response (int_steer³ / 80 · 0.4 / 32), faster curve with fast-steer
      const s = Math.max(-127, Math.min(127, p.steer)), cube = s * Math.abs(s) * Math.abs(s);
      const a = p.fast ? (cube / 60) * 0.6 / 32 : (cube / 80) * 0.4 / 32;
      c.wheelAngle = Math.max(-511, Math.min(511, a)); steerKeys = Math.abs(a) > 270 ? true : steerKeys;
      c.autoBrake = Math.abs(a) < 270 ? 0 : c.autoBrake + 1;
    }
    if (p.steer === undefined || p.steer === null) {
      if (!steerKeys) { if (c.wheelAngle < -64) c.wheelAngle += 64; else if (c.wheelAngle < 65) c.wheelAngle = 0; else c.wheelAngle -= 64; }
    } else if (!p.left && !p.right && Math.abs(p.steer) < 8) c.wheelAngle = 0;
    c.thrust = 0;
    const pr = c.cos.powerRatio * (c.boost ?? 1); // boost: rubber-banding for police (like D2's chase cars)
    if (p.brake) { // brakes while rolling forward, reverse once (nearly) stopped
      let rws = fixedh((c.wheelSpeed * 1500) / 1024);
      rws = -rws < 23 ? -5000 : ((rws + 278) * -4778) / 256;
      c.thrust = fixedh(pr * rws);
    } else if (p.accel) {
      c.thrust = fixedh(pr * 4915);
      if (!c.civ && c.hnd === HANDLING[0] && c.changingGear) c.thrust = 1; // automatic gearbox: power cut while shifting (hndType 0)
    }
    c.lastPad = p;
  }

  // ---- GetFrictionScalesDriver1 (wheelforces.c) ---------------------------------------------------------------------
  frictionScales() {
    const c = this, hp = c.hnd; let front, rear;
    front = c.thrust < 0 ? 1453 : c.thrust < 1 ? 937 : 820;
    let ab = c.autoBrake;
    if (!c.wheelspin && hp.autoBrake && ab > 0 && c.wheelSpeed > 0) { let q = ab << 1; if (ab > 13) { ab = 13; q = 26; } front += (q + ab) * 15; }
    if (c.thrust < 0 && c.wheelSpeed > 41943 && hp === HANDLING[0]) c.locked = [1, 1, 1, 1]; else c.locked = [0, 0, 0, 0]; // hard braking locks all four wheels
    if (!c.handbrake) { if (c.wheelspin) front += 600; }
    else {
      if (c.thrust > -1) c.thrust = 0;
      front += c.wheelSpeed < 1 ? -375 : 656;
      c.locked[1] = c.locked[3] = 1; c.wheelspin = 0; // handbrake locks the rear pair
    }
    if (c.wheelSpeed < 0 && c.thrust > -1 && !c.handbrake) front -= 400;
    rear = 0x780 - front;
    if (c.wheelspin) c.thrust = fixedh(c.cos.powerRatio * 5000);
    if (c.thrust < 0 && c.wheelSpeed > 41943 && hp.aggressive) { front = (front * 10) / 8; rear = (rear * 10) / 8; }
    else front = c.onGrass[0] ? (front * 40 - front) / 32 : (front * 36 - front) / 32;
    front = (front * hp.fs) / 32; rear = (rear * hp.fs) / 32;
    const tr = c.cos.traction ?? 4096; if (tr !== 4096) { front = fixedh(front * tr); rear = fixedh(rear * tr); }
    return [front, rear];
  }

  // ---- AddWheelForcesDriver1 + torque + integration -----------------------------------------------------------------
  wheelForces(grassFn) {
    const c = this, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
    const vx = c.vx * K_VEL, vz = c.vz * K_VEL, avel = c.w * K_ANG; // D2 units
    // speed estimate (units/frame): larger component + half the smaller
    const a = Math.abs(vx / 4096), b = Math.abs(vz / 4096); c.speedU = a < b ? b + a / 2 : a + b / 2;
    let old = (c.speedU * 3) / 2; old = old < 32 ? old * -72 + 3696 : 1424 - old; if (old > 3300) old = 3300;
    const cdx = sy * 4096, cdz = cy * 4096, dirS = c.yaw + ANG(c.wheelAngle), sdx = Math.sin(dirS) * 4096, sdz = Math.cos(dirS) * 4096;
    c.wheelSpeed = (cdz / 64) * (vz / 64) + (cdx / 64) * (vx / 64);
    const [frontFS, rearFS] = this.frictionScales();
    let accX = 0, accZ = 0, torque = 0; c.frontVel = c.rearVel = 0;
    const disp = [[-c.ht, c.hw], [-c.ht, -c.hw], [c.ht, c.hw], [c.ht, -c.hw]]; // 0 FL, 1 RL, 2 FR, 3 RR (odd = rear, as in the C code)
    for (let i = 3; i >= 0; i--) {
      const dx = disp[i][0] * U, dz = disp[i][1] * U;
      const rx = dx * cy + dz * sy, rz = -dx * sy + dz * cy;               // wheel offset in world axes (units)
      const wxm = c.x + rx / U, wzm = c.z + rz / U;
      const grass = grassFn ? grassFn(wxm, wzm) : false; c.onGrass[i] = grass;
      const frictionCoef = ((grass ? 2048 : 4096) * 32400 >> 15) + 500;      // wetness = 0
      const pvx = fixedh(avel * rz) + vx, pvz = fixedh(-avel * rx) + vz;     // point velocity
      let lfx, lfz;
      if (c.locked[i]) { const d = Math.atan2(pvx / 64, pvz / 64); lfx = Math.sin(d) * 4096; lfz = Math.cos(d) * 4096; }
      else if (i & 1) { lfz = -cdx; lfx = cdz; } else { lfz = -sdx; lfx = sdz; }
      let slide = (pvx / 64) * (lfx / 64) + (pvz / 64) * (lfz / 64);
      const wheelspd = Math.abs((old / 64) * (slide / 64));
      if (slide > 50000) slide = 12500; else if (slide < -50000) slide = -12500; else slide = Math.max(-12500, Math.min(12500, fixedh(old * slide)));
      let side, fx = 0, fz = 0;
      if (i & 1) { // rear
        if (!c.locked[i]) {
          side = fixedh(rearFS * slide);
          if (c.hnd.autoBrake && side * c.wheelAngle > 0) c.autoBrake = -1;
          fx = -lfz * c.thrust; fz = lfx * c.thrust;
        } else side = (frontFS * slide) / 16384;
        if (c.rearVel < wheelspd) c.rearVel = wheelspd;
      } else { // front
        side = (frontFS * slide + 2048) / 4096;
        if (c.locked[i]) {
          side = ((frontFS * slide + 2048) / 8192 + side) / 2;
          const ff = (fixedh(-side * lfx) * sdz - fixedh(-side * lfz) * sdx) / 2048;
          fx = ff * sdz; fz = -ff * sdx;
        }
        if (c.frontVel < wheelspd) c.frontVel = wheelspd;
      }
      fx += -side * lfx - vx * 12; fz += -side * lfz - vz * 12;
      fx = (fixedh(fx) * frictionCoef) / 4096; fz = (fixedh(fz) * frictionCoef) / 4096;
      accX += fx; accZ += fz; torque += fixedh(rz * fx - rx * fz);
    }
    // ConvertTorqueToAngularAcceleration (yaw only): aacc·twistY − avel/32
    const aacc = torque * (c.cos.twistY ?? 4) - avel / 32;
    let nvx = vx + accX / LINEAR_DAMP, nvz = vz + accZ / LINEAR_DAMP, nav = Math.max(-0x800000, Math.min(0x800000, avel + aacc));
    if (c.speedU < 1 && Math.abs(nvx) + Math.abs(nvz) < 1000 && !c.thrust) { nvx = nvz = 0; nav = 0; } // rests when almost still
    c.vx = nvx / K_VEL; c.vz = nvz / K_VEL; c.w = nav / K_ANG;
    c.x += c.vx * DT; c.z += c.vz * DT; c.yaw += c.w * DT;
    c.accLong = (accX * sy + accZ * cy) / LINEAR_DAMP / K_VEL / DT; c.accLat = (accX * cy - accZ * sy) / LINEAR_DAMP / K_VEL / DT; // m/s², for body roll / pitch
  }

  // ---- GetEngineRevs + ControlCarRevs (gamesnd.c) -------------------------------------------------------------------
  engineRevs() {
    const c = this, g = GEARS[c.civ ? 1 : 0]; let gear = c.gear, ws = c.wheelSpeed;
    if (ws > 0) {
      ws = Math.floor(ws / 2048); if (gear > 3) gear = 3;
      for (let n = 0; n < 8; n++) {
        const lws = c.thrust < 1 ? g[gear][0] : g[gear][1]; let last = gear;
        if (ws < lws && gear > 0) last = gear - 1; if (ws > g[gear][2] && gear < 3) last = last + 1;
        if (last === gear) break; gear = last;
      }
      c.gear = gear;
    } else { ws = -ws / 2048; gear = 0; c.gear = 0; }
    return ws * g[gear][c.thrust !== 0 ? 3 : 4];
  }
  revsStep() {
    const c = this; let desired = c.engineRevs(), old = c.revs, acc = c.thrust; c.changingGear = false;
    if (c.wheelspin) { desired = 20160; if (old < 8000) old = 8000; c.gear = 0; }
    let n = desired; const drop = old - n;
    if (drop > MAX_REV_DROP) { acc = 0; c.changingGear = true; n = old - MAX_REV_DROP; }
    if (n - old > MAX_REV_RISE) n = old + MAX_REV_RISE;
    c.revs = Math.max(0, Math.min(30719, n));
  }
}

/** Collision shape helpers (planar OBB): returns the 4 corners of a car in world metres. */
export function corners(c) {
  const hl = (c.cos.length ?? 4.4) / 2, hw = (c.cos.width ?? 1.9) / 2, s = Math.sin(c.yaw), co = Math.cos(c.yaw), out = [];
  for (const [a, b] of [[-hw, hl], [hw, hl], [hw, -hl], [-hw, -hl]]) out.push([c.x + a * co + b * s, c.z - a * s + b * co]);
  return out;
}
