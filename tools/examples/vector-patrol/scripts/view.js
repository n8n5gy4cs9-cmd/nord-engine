import { vertexSource, fragmentSource } from './retro-shader.js';
export class FlightView {
  constructor(script) {
    this.script = script;
    this.game = script.game;
    const b = this.game.backend;
    this.B = b.B;
    this.scene = b.scene;
    this.engine = b.engine;
    this.canvas = b.canvas;
    this.materials = new Map();
    this.originals = [];
    this.retro = true;
    this.visuals = [];
    for (const entity of script.scene.all())
      for (const mesh of entity.__meshes ?? []) {
        if (!mesh.getTotalVertices?.()) continue;
        const old = mesh.material,
          color = old?.albedoColor ?? old?.diffuseColor ?? this.B.Color3.White(),
          key = color.toHexString();
        let mat = this.materials.get(key);
        if (!mat) {
          mat = new this.B.ShaderMaterial(
            'retro-' + key,
            this.scene,
            { vertexSource, fragmentSource },
            {
              attributes: ['position', 'normal'],
              uniforms: ['worldViewProjection', 'world', 'uColor', 'uRetro', 'uGrid'],
            },
          );
          mat.setColor3('uColor', color);
          this.materials.set(key, mat);
        }
        this.originals.push([mesh, old]);
        mesh.material = mat;
      }
    this.player = script.scene.find('Fighter');
    this.carrier = script.scene.find('Carrier');
    this.drones = Array.from({ length: 14 }, (_, i) => script.scene.find('Drone' + i));
    this.gates = Array.from({ length: 3 }, (_, i) => script.scene.find('Gate' + i));
    const material = (name, color) => {
      const m = new this.B.StandardMaterial(name, this.scene);
      m.disableLighting = true;
      m.emissiveColor = this.B.Color3.FromHexString(color);
      return m;
    };
    this.green = material('player laser', '#6affbc');
    this.red = material('hostile laser', '#ff765a');
    this.dot = material('ground dot', '#4b9995');
    this.gold = material('energy cell', '#f8df75');
    const pool = (count, kind, mat, size) =>
      Array.from({ length: count }, (_, i) => {
        const mesh = this.B.MeshBuilder.CreateBox(
          kind + i,
          { width: size, height: size, depth: kind === 'shot' ? 1.6 : size },
          this.scene,
        );
        mesh.material = mat;
        this.visuals.push(mesh);
        return mesh;
      });
    this.shots = pool(40, 'shot', this.green, 0.12);
    this.hostile = pool(60, 'hostile', this.red, 0.28);
    this.cells = pool(6, 'cell', this.gold, 0.7);
    this.dots = pool(200, 'dot', this.dot, 0.14);
    this.terrain = new this.B.StandardMaterial('canyon', this.scene);
    this.terrain.diffuseColor = this.B.Color3.FromHexString('#28625d');
    this.terrain.specularColor = this.B.Color3.Black();
    this.ground = this.B.MeshBuilder.CreateGround(
      'canyon floor',
      { width: 300, height: 500 },
      this.scene,
    );
    this.ground.position.set(0, -5.7, 190);
    this.ground.material = this.terrain;
    this.visuals.push(this.ground);
    this.mountains = Array.from({ length: 18 }, (_, i) => {
      const m = this.B.MeshBuilder.CreateCylinder(
        'canyon ridge' + i,
        {
          diameterTop: 0,
          diameterBottom: 18 + (i % 3) * 7,
          height: 12 + (i % 4) * 4,
          tessellation: 4,
        },
        this.scene,
      );
      m.material = this.terrain;
      this.visuals.push(m);
      return m;
    });
    this.light = new this.B.HemisphericLight(
      'canyon light',
      new this.B.Vector3(-0.6, 1, -0.4),
      this.scene,
    );
    this.light.intensity = 0.95;
    this.scene.activeCamera.setTarget(new this.B.Vector3(0, 0, 40));
    this.setRetro(true);
  }
  setRetro(on) {
    this.retro = on;
    this.engine.setHardwareScalingLevel(
      on ? Math.max(1, this.canvas.clientWidth / 320) : 1,
    );
    this.canvas.style.imageRendering = on ? 'pixelated' : 'auto';
    for (const m of this.materials.values()) {
      m.setFloat('uRetro', on ? 1 : 0);
      m.setVector2(
        'uGrid',
        new this.B.Vector2(
          this.engine.getRenderWidth() / 2,
          this.engine.getRenderHeight() / 2,
        ),
      );
    }
  }
  draw(s) {
    this.player.pos = [s.x, s.y, 0];
    this.player.rot = [0, 0, s.roll > 2.25 ? ((3 - s.roll) / 0.75) * 360 : -s.x * 3];
    this.player.scale = s.shield > 0 ? [1.25, 1.25, 1.25] : [1.2, 1.2, 1.2];
    const entities = (pool, items, fn) =>
      pool.forEach((e, i) => {
        e.enabled = i < items.length;
        if (e.enabled) {
          e.pos = [items[i].x ?? 0, items[i].y ?? 0, items[i].z];
          fn?.(e, items[i]);
        }
      });
    entities(
      this.drones,
      s.enemies.slice(0, 14),
      (e, v) => (e.rot = [0, 0, Math.sin(s.time + v.id) * 12]),
    );
    entities(this.gates, s.gates);
    this.carrier.enabled = s.boss && !s.won;
    this.carrier.pos = [0, 0, s.bossZ];
    this.carrier.rot = [0, 0, 0];
    const native = (pool, items) =>
      pool.forEach((m, i) => {
        m.setEnabled(i < items.length);
        if (i < items.length) m.position.set(items[i].x, items[i].y, items[i].z);
      });
    native(this.shots, s.shots);
    native(this.hostile, s.hostile);
    native(this.cells, s.cells);
    this.dots.forEach((m, i) =>
      m.position.set(
        ((i % 10) - 4.5) * 8,
        -5.5,
        12 + Math.floor(i / 10) * 10 - (s.distance % 10),
      ),
    );
    this.mountains.forEach((m, i) =>
      m.position.set(
        (i % 2 ? -1 : 1) * (25 + (i % 3) * 5),
        0,
        20 + Math.floor(i / 2) * 28 - (s.distance % 28),
      ),
    );
  }
  dispose() {
    for (const [mesh, mat] of this.originals) if (!mesh.isDisposed()) mesh.material = mat;
    for (const m of this.materials.values()) m.dispose();
    for (const m of this.visuals) m.dispose();
    for (const m of [this.green, this.red, this.dot, this.gold]) m.dispose();
    this.terrain.dispose();
    this.light.dispose();
    this.engine.setHardwareScalingLevel(1);
  }
}
