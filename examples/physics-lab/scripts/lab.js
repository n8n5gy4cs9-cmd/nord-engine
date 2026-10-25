// Physics Lab: a bench for the Unity-style physics layer (shapes, joints, constraints, queries, ignore pairs, interpolation, continuous detection).
// Everything is readable from the browser console as window.__lab; `await __lab.selfTest()` runs the checks that tools/physics-lab-test.mjs asserts.
import { MonoBehaviour, Physics2D, Vector2, Rigidbody2D, RigidbodyConstraints2D, Awaitable } from 'nord';

const wait = () => new Promise((r) => setTimeout(r, 0));
export default class Lab extends MonoBehaviour {
  static attributes = {};
  start() { window.__lab = this; this.triggers = 0; this.breaks = 0; }
  OnTriggerEnter() { this.triggers++; }
  OnJointBreak() { this.breaks++; }
  snapshot() {
    const q = (name) => this.scene.find(name);
    const p = (e) => ({ x: Math.round(e.worldPos[0] * 10) / 10, y: Math.round(e.worldPos[1] * 10) / 10, rot: Math.round((e.rot[2] ?? 0) * 10) / 10 });
    return Object.fromEntries(['Ball', 'Capsule', 'LShape', 'Bob', 'SpringBob'].map((n) => [n, p(q(n))]));
  }
  ray(ox, oy, dx, dy, dist = Infinity) { const h = Physics2D.Raycast(new Vector2(ox, oy), new Vector2(dx, dy), dist); return { name: h.collider?.name ?? null, d: h.distance, x: h.point.x, y: h.point.y }; }
  circle(ox, oy, r, dx, dy) { const h = Physics2D.CircleCast(new Vector2(ox, oy), r, new Vector2(dx, dy)); return { name: h.collider?.name ?? null, d: h.distance }; }

  /** Spawn an entity from JSON and wait until the physics adapter has built its body. */
  async make(name, pos, components, extra = {}) {
    const e = await this.scene.spawnData({ name, transform: { pos: [pos[0], pos[1], 0], rot: [0, 0, extra.rot ?? 0], scale: [1, 1, 1] }, components, tags: extra.tags ?? [] });
    this.game.physics.flushDirty();
    return e;
  }
  step(n = 1) { for (let i = 0; i < n; i++) this.game.physics.step(1 / 60); }

  async selfTest() {
    const capE0 = () => this.scene.find('Capsule');
    const g = this.game, ph = g.physics, out = [], ok = (name, pass, info = '') => out.push({ name, ok: !!pass, info: String(info) });
    g.pause(); // the test steps the world by hand
    const rb = (o = {}) => ({ type: 'rigidbody', mode: 'dynamic', mass: 1, drag: 0, bounce: 0, friction: 0.3, freezeRotationZ: false, ...o });
    const col = (o) => ({ type: 'collider', ...o });

    // shapes: everything at rest on the floor, each at its own x (the scene objects have been falling since the page loaded)
    const matter = ph.kind === 'matter';
    this.step(240);
    const s = this.snapshot();
    if (matter) {
    // 100 tall, 40 wide: it stands (y ≈ 510) or lies on its side (y ≈ 540), depending on what the rolling ball did to it
      ok('capsule rests on the floor (round ends, no tunnelling)', s.Capsule.y > 500 && s.Capsule.y < 545, JSON.stringify(s.Capsule));
    ok('L polygon rests on the floor or the composite', s.LShape.y > 440 && Number.isFinite(s.LShape.x), JSON.stringify(s.LShape));
    ok('ball is finite', Number.isFinite(s.Ball.x) && Number.isFinite(s.Ball.y), JSON.stringify(s.Ball));

    // composite collider = one body made of its two boxes
    const h = this.ray(460, 300, 0, 1); const h2 = this.ray(580, 300, 0, 1); const gap = this.ray(520, 300, 0, 1);
    ok('composite: left part hit', h.name === 'Composite' && Math.abs(h.y - 500) < 0.01, JSON.stringify(h));
    ok('composite: right part hit', h2.name === 'Composite', JSON.stringify(h2));
    ok('composite: the gap between the parts is open', gap.name === 'Floor', JSON.stringify(gap));
    ok('children of a composite have no body of their own', !ph.bodies.has(this.scene.find('CompL')));

    // pendulum: the hinge keeps its rod length
    const bob = this.scene.find('Bob'); bob.rot = [0, 0, 30]; bob.pos = [490, 181.2, 0];
    let dmin = 1e9, dmax = 0; for (let i = 0; i < 180; i++) { this.step(); const d = Math.hypot(bob.worldPos[0] - 560, bob.worldPos[1] - 60); dmin = Math.min(dmin, d); dmax = Math.max(dmax, d); }
    ok('hinge: bob stays on its rod', dmax - dmin < 6 && dmax < 146, `${dmin.toFixed(1)}..${dmax.toFixed(1)}`);
    const sb = this.scene.find('SpringBob'); const ys = []; for (let i = 0; i < 120; i++) { this.step(); ys.push(sb.worldPos[1]); }
    ok('spring: bob settles near its rest length under gravity', Math.abs(ys.at(-1) - 166) < 40, `${Math.min(...ys).toFixed(0)}..${Math.max(...ys).toFixed(0)}, ends ${ys.at(-1).toFixed(0)}`);

    }

    // IgnoreCollision: a box dropped onto the floor falls through when the pair is ignored
    const floor = this.scene.find('Floor');
    const a = await this.make('Dropper', [18, 300], [rb(), col({ shape: 'box', size: [20, 20] })]);
    Physics2D.IgnoreCollision(a, floor); this.step(180);
    ok('IgnoreCollision: passes through the floor', a.worldPos[1] > 640, a.worldPos[1]);
    Physics2D.IgnoreCollision(a, floor, false);
    const b = await this.make('Dropper2', [770, 300], [rb(), col({ shape: 'box', size: [20, 20] })]);
    Physics2D.IgnoreLayerCollision(0, 1); b.layer = 1; floor.layer = 0; const bb = this.game.physics; bb.build(b); bb.flushDirty();
    Physics2D.IgnoreLayerCollision(0, 1, false);

    // axis constraints: the frozen axis does not move
    const c = await this.make('Frozen', [700, 300], [rb({ freezePositionX: true }), col({ shape: 'box', size: [20, 20] })]);
    Rigidbody2D.Of(c).velocity = new Vector2(300, 0); this.step(30);
    ok('freezePositionX: x does not change, y falls', Math.abs(c.worldPos[0] - 700) < 0.01 && c.worldPos[1] > 300, `${c.worldPos[0]}, ${c.worldPos[1]}`);
    const rbc = Rigidbody2D.Of(c); rbc.constraints = RigidbodyConstraints2D.FreezePositionY; rbc.velocity = new Vector2(100, 0); const y0 = c.worldPos[1]; this.step(10);
    ok('constraints setter: freeze Y instead', Math.abs(c.worldPos[1] - y0) < 0.5 && c.worldPos[0] > 700, `${c.worldPos[1]} (was ${y0}), x ${c.worldPos[0]}`);

    // continuous detection: a fast small ball tunnels through a thin wall unless it is continuous
    const mkTunnel = async (mode, x) => {
      await this.make(`Wall${mode}`, [x, 300], [rb({ mode: 'static' }), col({ shape: 'box', size: [4, 200] })]);
      const ball = await this.make(`Fast${mode}`, [x - 200, 300], [rb({ gravityScale: 0, collisionDetection: mode }), col({ shape: 'circle', radius: 4 })]);
      Rigidbody2D.Of(ball).velocity = new Vector2(6000, 0); this.step(10); return ball.worldPos[0];
    };
    const xd = await mkTunnel('discrete', 330), xc = await mkTunnel('continuous', 530);
    ok('continuous detection stops at a thin wall', xc < 535, `continuous ended at x=${xc.toFixed(0)}`);
    ok('discrete detection can tunnel (documents why continuous exists)', xd > 335, `discrete ended at x=${xd.toFixed(0)}`);

    // interpolation: drawn position lies between the last two steps
    const i1 = await this.make('Smooth', [60, 100], [rb({ interpolation: 'interpolate', gravityScale: 0 }), col({ shape: 'box', size: [10, 10] })]);
    Rigidbody2D.Of(i1).velocity = new Vector2(600, 0); this.step(2); const before = i1.native.x; this.step(1); ph.interpolate(0.5);
    const mid = i1.native.x, after = i1.worldPos[0]; ph.endInterpolate();
    ok('interpolation: the container is drawn between the two steps', mid < after && mid > before, `before ${before.toFixed(2)} drawn ${mid.toFixed(2)} real ${after.toFixed(2)}`);

    // queries on the live world
    const top = this.ray(capE0().worldPos[0], 0, 0, 1); ok('Raycast sees the capsule shape (round top)', top.name === 'Capsule', JSON.stringify(top));
    const capE = this.scene.find('Capsule'), cap = Physics2D.OverlapPointAll(new Vector2(capE.worldPos[0], capE.worldPos[1])).map((e) => e.name);
    ok('OverlapPoint inside the capsule', cap.includes('Capsule'), cap.join(','));
    g.resume();
    return out;
  }
}
