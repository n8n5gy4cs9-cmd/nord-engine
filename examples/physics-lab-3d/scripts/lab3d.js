// Physics Lab 3D: Unity-style 3D physics on Havok. `await __lab.selfTest()` runs the checks that tools/physics-lab-test.mjs asserts.
import { MonoBehaviour, Physics, Vector3, Quaternion, Rigidbody, RigidbodyConstraints } from 'nord';

/** Wait `s` seconds of GAME time (the render loop only runs while the page is visible). */
const sleep = (s) => new Promise((res) => { const g = window.__nord, t0 = g.time.elapsed; const t = () => (g.time.elapsed - t0 >= s ? res() : setTimeout(t, 16)); t(); });
export default class Lab3D extends MonoBehaviour {
  start() { window.__lab = this; }
  async make(name, pos, components, extra = {}) {
    const e = await this.scene.spawnData({ name, transform: { pos, rot: extra.rot ?? [0, 0, 0], scale: [1, 1, 1] }, components, tags: [] });
    this.game.physics.flushDirty();
    return e;
  }
  async selfTest() {
    const out = [], ok = (name, pass, info = '') => out.push({ name, ok: !!pass, info: String(info) });
    const box = (size, color = '#d8dee9') => [{ type: 'mesh', shape: 'box', size }, { type: 'material', color }];
    const rb = (o = {}) => ({ type: 'rigidbody', mode: 'dynamic', mass: 1, drag: 0.05, bounce: 0, friction: 0.5, ...o });
    const col = (o) => ({ type: 'collider', ...o });
    const v = (a, b, c) => new Vector3(a, b, c);

    // queries
    const ray = Physics.RaycastAll(v(0, 1.2, 0), Vector3.forward); ok('RaycastAll: cube then sphere', ray.map((h) => h.collider.name).join() === 'Cube,Ball', ray.map((h) => `${h.collider.name}@${h.distance.toFixed(2)}`).join());
    ok('RaycastAll distance to the cube face', Math.abs(ray[0].distance - 9) < 0.01);
    const sc = Physics.SphereCast(v(0, 1.2, 0), 0.5, Vector3.forward); ok('SphereCast hits the cube early', sc.collider?.name === 'Cube' && Math.abs(sc.distance - 8.5) < 0.02, sc.distance);
    const miss = Physics.Raycast(v(0, 2.3, 0), Vector3.forward, 100); const fat = Physics.SphereCast(v(0, 2.3, 0), 0.5, Vector3.forward);
    ok('a thin ray misses where a fat one touches', !miss.collider && fat.collider?.name === 'Cube', `${miss.collider?.name} / ${fat.collider?.name}`);
    ok('BoxCast', Physics.BoxCast(v(0, 1.2, 0), v(0.5, 0.5, 0.5), Vector3.forward).collider?.name === 'Cube');
    ok('CapsuleCast', Physics.CapsuleCast(v(5, 1, 0), v(5, 3, 0), 0.25, Vector3.forward).collider?.name === 'Capsule');
    ok('OverlapBox / OverlapSphere / Check*', Physics.OverlapBox(v(0, 1.2, 10), v(0.2, 0.2, 0.2)).length === 1 && Physics.OverlapSphere(v(0, 1.2, 20), 0.2).length === 1 && Physics.CheckSphere(v(0, 1.2, 20), 0.1) && !Physics.CheckSphere(v(0, 9, 20), 0.1));
    const results = []; ok('RaycastNonAlloc fills the array', Physics.RaycastNonAlloc(v(0, 1.2, 0), Vector3.forward, results, 50) === 2 && results.length === 2);

    // hinge door
    await sleep(0.5);
    const door = this.scene.find('Door'), post = this.scene.find('HingePost'); const w0 = door.worldPos.slice();
    Rigidbody.Of(door).AddForce(v(0, 0, 60), 1);
    let maxZ = 0, dmin = 99, dmax = 0; for (let i = 0; i < 20; i++) { await sleep(0.06); const w = door.worldPos, d = Math.hypot(w[0] + 8, w[2]); maxZ = Math.max(maxZ, Math.abs(w[2])); dmin = Math.min(dmin, d); dmax = Math.max(dmax, d); }
    ok('hinge: the door swings about its post and keeps its radius', maxZ > 0.8 && dmax - dmin < 0.25, `max |z| ${maxZ.toFixed(2)}, radius ${dmin.toFixed(2)}..${dmax.toFixed(2)} (was ${Math.hypot(w0[0] + 8, w0[2]).toFixed(2)})`);

    // fixed joint
    const fa = this.scene.find('FixedA'), fb = this.scene.find('FixedB'); await sleep(1.5);
    const rel = Math.hypot(fb.worldPos[0] - fa.worldPos[0], fb.worldPos[1] - fa.worldPos[1], fb.worldPos[2] - fa.worldPos[2]);
    ok('FixedJoint: the two blocks fell together and stayed one unit apart', fa.worldPos[1] < 3 && Math.abs(rel - 1) < 0.1, `rel ${rel.toFixed(3)}, y ${fa.worldPos[1].toFixed(2)}`);

    // spring
    const sw = this.scene.find('SpringWeight'); const ys = []; for (let i = 0; i < 40; i++) { await sleep(0.05); ys.push(sw.worldPos[1]); }
    ok('SpringJoint: the weight hangs below its anchor, not fallen to the floor', Math.min(...ys) > 1.5 && Math.min(...ys) < 8, `${Math.min(...ys).toFixed(2)}..${Math.max(...ys).toFixed(2)}`);

    // axis constraints
    const f = await this.make('Frozen', [-3, 6, -6], [...box([1, 1, 1]), rb({ freezePositionX: true, freezeRotationY: true }), col({ shape: 'box', size: [1, 1, 1] })]);
    const rf = Rigidbody.Of(f); rf.velocity = v(5, 0, 0); rf.angularVelocity = v(0, 5, 0); await sleep(0.6);
    ok('freezePositionX: x stays, y falls', Math.abs(f.worldPos[0] + 3) < 0.05 && f.worldPos[1] < 5.5, `${f.worldPos.map((n) => n.toFixed(2))}`);
    const yaw = Math.abs(f.rot[1] ?? 0); ok('freezeRotationY: no turning about y', yaw < 1, `rot ${f.rot.map((n) => n.toFixed(1))}`);

    // IgnoreCollision: fall through the ground
    const g = this.scene.find('Ground'), d = await this.make('Ghost', [-3, 4, 6], [...box([1, 1, 1]), rb(), col({ shape: 'box', size: [1, 1, 1] })]);
    Physics.IgnoreCollision(d, g); await sleep(1.5);
    ok('IgnoreCollision: falls through', d.worldPos[1] < -1, d.worldPos[1]);
    const d2 = await this.make('Solid', [-5, 4, 6], [...box([1, 1, 1]), rb(), col({ shape: 'box', size: [1, 1, 1] })]); await sleep(1.5);
    ok('without it the box rests on the ground', d2.worldPos[1] > 0.3, d2.worldPos[1]);
    Physics.IgnoreCollision(d, g, false);

    // layers: bodies on layer 1 pass through layer 0 once the pair of layers is ignored
    const L = await this.make('LayerBox', [-7, 4, 6], [...box([1, 1, 1]), rb(), col({ shape: 'box', size: [1, 1, 1] })]);
    L.layer = 1; this.game.physics.build(L); this.game.physics.flushDirty(); Physics.IgnoreLayerCollision(0, 1); await sleep(1.5);
    ok('IgnoreLayerCollision: layer 1 falls through layer 0', L.worldPos[1] < -1, L.worldPos[1]); Physics.IgnoreLayerCollision(0, 1, false);

    // continuous detection: a fast small sphere stops at a thin wall
    const mk = async (mode, z) => {
      await this.make(`Wall${mode}`, [12, 1, z], [...box([0.1, 2, 4]), rb({ mode: 'static' }), col({ shape: 'box', size: [0.1, 2, 4] })]);
      const b = await this.make(`Bullet${mode}`, [2, 1, z], [...box([0.4, 0.4, 0.4]), rb({ gravityScale: 0, collisionDetection: mode }), col({ shape: 'sphere', radius: 0.2 })]);
      Rigidbody.Of(b).velocity = v(400, 0, 0); await sleep(0.5); return b.worldPos[0];
    };
    const xc = await mk('continuous', -10); ok('continuous detection: the bullet stops at the thin wall', xc < 13, `ended at x=${xc.toFixed(1)}`);

    // hinge motor: the door keeps turning
    const d3 = this.scene.find('Door'); const angleOf = () => Math.atan2(d3.worldPos[2], d3.worldPos[0] + 8);
    const hj = d3.getComponent('joint'); hj.data.useMotor = true; hj.data.motorSpeed = 120; this.game.physics.removeJoint(hj); this.game.physics.addJoint(hj);
    const a0 = angleOf(); await sleep(0.8); const a1 = angleOf();
    ok('hinge motor turns the door', Math.abs(a1 - a0) > 0.3, `${a0.toFixed(2)} → ${a1.toFixed(2)} rad`);
    this.game.resume?.();
    return out;
  }
}
