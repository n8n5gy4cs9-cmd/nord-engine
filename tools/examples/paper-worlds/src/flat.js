import { WIDTH, HEIGHT, paint } from './model.js';
import { loadScript } from './desk.js';
export async function createFlat(parent, getBoard, change) {
  await loadScript('vendor/phaser/phaser.min.js');
  const P = window.Phaser;
  let scene,
    texture,
    image,
    drag = null,
    tool = 'pen',
    color = '#32a7a0',
    text = '',
    zoom = 0.75,
    pan = { x: 120, y: 105 },
    balls = [],
    player = null,
    walls = [],
    keys = null;
  const game = new P.Game({
    type: P.AUTO,
    parent,
    width: 960,
    height: 640,
    backgroundColor: '#dce5e6',
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: {
      create() {
        scene = this;
        texture = this.textures.createCanvas('paper', WIDTH, HEIGHT);
        image = this.add.image(0, 0, 'paper').setOrigin(0);
        this.cameras.main.setBounds(-20000, -20000, 40000, 40000);
        keys = this.input.keyboard.createCursorKeys();
        this.input.on('pointerdown', (p) => {
          const q = point(p);
          if (tool === 'hand') {
            drag = { kind: 'hand', sx: p.x, sy: p.y, px: pan.x, py: pan.y };
            return;
          }
          if (player) return;
          if (tool === 'text' || tool === 'sticky') {
            getBoard().shapes.push({
              kind: tool,
              x: q.x,
              y: q.y,
              w: 230,
              h: 160,
              text: text || 'New idea',
              color,
            });
            change();
            redraw();
            return;
          }
          drag = {
            kind: tool,
            x: q.x,
            y: q.y,
            w: 0,
            h: 0,
            text: tool === 'rect' && text.toLowerCase() === 'door' ? 'door' : '',
            color,
            points: [[q.x, q.y]],
          };
        });
        this.input.on('pointermove', (p) => {
          if (!drag) return;
          if (drag.kind === 'hand') {
            pan.x = drag.px - (p.x - drag.sx) / zoom;
            pan.y = drag.py - (p.y - drag.sy) / zoom;
            applyCamera();
            return;
          }
          const q = point(p);
          if (drag.kind === 'pen') drag.points.push([q.x, q.y]);
          else {
            drag.w =
              drag.kind === 'circle'
                ? Math.hypot(q.x - drag.x, q.y - drag.y)
                : q.x - drag.x;
            drag.h = q.y - drag.y;
          }
          redraw();
          paint(texture.context, { ...getBoard(), shapes: [...getBoard().shapes, drag] });
          texture.refresh();
        });
        const end = () => {
          if (drag && drag.kind !== 'hand') {
            if (drag.kind === 'rect') {
              if (drag.w < 0) {
                drag.x += drag.w;
                drag.w = -drag.w;
              }
              if (drag.h < 0) {
                drag.y += drag.h;
                drag.h = -drag.h;
              }
            }
            getBoard().shapes.push(drag);
            change();
          }
          drag = null;
          redraw();
        };
        this.input.on('pointerup', end);
        this.input.on('gameout', end);
        this.input.on('wheel', (_p, _objects, _dx, dy) => {
          zoom = Math.max(0.2, Math.min(2.5, zoom * (dy > 0 ? 0.9 : 1.1)));
          applyCamera();
        });
        redraw();
        applyCamera();
      },
      update() {
        if (player) {
          const x = Number(keys.right.isDown) - Number(keys.left.isDown),
            y = Number(keys.down.isDown) - Number(keys.up.isDown);
          player.body.setVelocity(x * 180, y * 180);
          if (player.x > 1100 && player.y > 720) {
            parent.dispatchEvent(new CustomEvent('mazewin'));
            stopPlay();
          }
        }
      },
    },
  });
  function point(p) {
    const v = scene.cameras.main.getWorldPoint(p.x, p.y);
    return {
      x: Math.max(0, Math.min(WIDTH, v.x)),
      y: Math.max(0, Math.min(HEIGHT, v.y)),
    };
  }
  function applyCamera() {
    if (scene) {
      scene.cameras.main.setZoom(zoom);
      scene.cameras.main.scrollX = pan.x;
      scene.cameras.main.scrollY = pan.y;
    }
  }
  function redraw() {
    if (texture) {
      paint(texture.context, getBoard());
      texture.refresh();
    }
  }
  function stopPlay() {
    player?.destroy();
    player = null;
    balls.forEach((v) => v.destroy());
    balls = [];
    walls.forEach((v) => v.destroy());
    walls = [];
  }
  function play(mode) {
    stopPlay();
    zoom = 0.75;
    pan = { x: 120, y: 105 };
    applyCamera();
    if (!scene) return;
    scene.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
    if (mode === 'balls') {
      scene.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
      for (const s of getBoard().shapes.filter((s) => s.kind === 'circle')) {
        const r = Math.max(10, Math.min(90, s.w)),
          v = scene.add.circle(
            s.x,
            s.y,
            r,
            P.Display.Color.HexStringToColor(s.color).color,
            0.8,
          );
        scene.physics.add.existing(v);
        v.body
          .setCircle(r)
          .setBounce(0.95)
          .setCollideWorldBounds(true)
          .setVelocity(120, -60)
          .setGravityY(240);
        balls.push(v);
      }
      scene.physics.add.collider(balls, balls);
    }
    if (mode === 'maze') {
      for (const s of getBoard().shapes.filter(
        (s) => s.kind === 'rect' && s.text !== 'door',
      )) {
        const v = scene.add.rectangle(
          s.x + s.w / 2,
          s.y + s.h / 2,
          Math.max(4, s.w),
          Math.max(4, s.h),
          0x23384b,
        );
        scene.physics.add.existing(v, true);
        walls.push(v);
      }
      player = scene.add.circle(55, 55, 12, 0xf18b75);
      scene.physics.add.existing(player);
      player.body.setCircle(12).setCollideWorldBounds(true);
      scene.physics.add.collider(player, walls);
      const goal = scene.add.rectangle(1150, 790, 70, 70, 0x32a7a0, 0.5);
      walls.push(goal);
    }
  }
  await new Promise((resolve) => {
    const wait = () => (scene ? resolve() : requestAnimationFrame(wait));
    wait();
  });
  return {
    game,
    redraw,
    play,
    stopPlay,
    get canvas() {
      return texture.canvas;
    },
    setTool(t, c, txt) {
      tool = t;
      color = c;
      text = txt;
      stopPlay();
    },
    fit() {
      zoom = 0.75;
      pan = { x: 120, y: 105 };
      applyCamera();
    },
    dispose() {
      stopPlay();
      game.destroy(true);
    },
  };
}
