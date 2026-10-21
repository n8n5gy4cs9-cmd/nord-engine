---
title: T40 JengaTedris — grid, physics and Node battle
section: Tutorials
order: 40
summary: Complete array-based grid game, real Matter compound tower and authoritative two-browser battle, with every source file.
---


Make a complete original falling-block game in three modes: a crisp grid challenge, a chaotic rigid-body tower, and a real two-browser battle. You will learn arrays, candidate movement, rotation, row compaction, seeded randomness, Matter compounds and server-owned game state. The project is called **JengaTedris**; it uses original code and canvas graphics, with no cartridge, ROM or commercial-game assets.

**Download:** [Complete JengaTedris project and source](assets/downloads/jengatedris-source.zip). Unzip, open `nord.project.json` in Nord, and press **Play**. This example uses Nord's **HTML tier**: one page and JavaScript modules, with a canvas as its view. You edit ordinary project files in Nord's code editor and export through the same HTML workflow as other Nord apps. A tilemap or four sprite entities could replace the canvas view without changing the grid rules.

![Playable grid game with next and hold previews](assets/screenshots/ed-tedris-grid.png)

## 1. Learn the finished game's controls

**Grid run:** arrows or A/D/S move and soft-drop, Up/W rotates, Space hard-drops, and C holds a piece once per lock. A translucent ghost shows the landing position. Clear 20 rows to win. Score increases for dropping and row clears; every five cleared rows increases gravity. The best solo score survives page reloads. Pause and Restart work during a run and after a loss.

**Physics tower:** left/right or A/D push the active rigid piece, Q/E rotate it, and Down slams it. Survive 18 pieces. Pieces keep their angles and can lean, slide and topple; this mode has no row clearing. A piece settles when slow for a short interval, or the seven-second control window ends, then the next one spawns. A high stack at the next spawn ends the run.

**Battle:** run the included Node server, join the same room in two browsers, and both click Ready. Each player has a separate grid. Clearing two or more rows sends `cleared - 1` garbage rows to the rival. The server owns falling, moves, row clears, attacks and the result. A top-out ends the round; after a result, both can Ready again for a fresh match. Online battles keep running when a tab loses focus; local modes pause on blur.

## 2. Open the project and follow its files

Select the project files in Nord's Assets panel and open them in the editor. Keep the Console visible while changing code. Stop and start Play after edits so modules reload.

| File | Responsibility |
| --- | --- |
| `rules.js` | Pure grid rules shared by browser and Node |
| `app.js` | Input, canvas drawing, menus, best score and battle requests |
| `chaos.js` | Actual Matter world, compound pieces, forces and drawing |
| `server.mjs` | Two-player rooms, authoritative battle updates and garbage |
| `server-kit.mjs` | Small Node HTTP/JSON transport and static file allowlist |
| `style.css` | Responsive page, inputs and canvases |
| `vendor/phaser/phaser.min.js` | Nord's pinned offline Phaser build, which includes Matter |

Start by changing `JengaTedris` in `app.js` and the highlight colour in `style.css`, then run your copy. No bundler or npm install is needed. The download includes the physics bundle and its licence. Its minified library code is packaged rather than expanded in this guide; all game and server source is listed at the end.

## 3. Represent the board as data, not falling pixels

The board is a 20-row array; each row contains ten colour indices. Zero means empty. Seven shapes each contain four integer offsets. The active piece stores type, grid X/Y and rotation. Its four occupied cells are derived by `cells(piece)`.

```js
const board = Array.from({ length: 20 }, () => Array(10).fill(0));
```

Use `Array.from` to make independent rows. `Array(20).fill(Array(10).fill(0))` would reuse the same row object twenty times: changing one cell would change every row.

Open `fits()` in `rules.js`. It checks all four cells against horizontal walls, the bottom, and occupied board cells. Cells above the board are allowed while a piece enters. A candidate is tested before becoming current state:

```js
const candidate = { ...state.active, x: state.active.x + 1 };
if (fits(state, candidate)) state.active = candidate;
```

The view reads the board and draws rectangles. It never decides whether a move is legal. This is why moving an entity down with `pos.y += dropSpeed` alone is insufficient: a grid game still needs discrete cell collision, locking, line clearing and top-out rules.

**Learning check:** move against the left wall, rotate there and verify no occupied cell leaves the board. Change the board width only after finding every use of `W`; the supplied page and battle views deliberately use ten columns.

## 4. Rotate candidates and give the player useful feedback

`cells()` rotates offsets through a 4×4 local grid using `[x, y] → [3-y, x]`. The square is unchanged. `rotate()` tries the new orientation at offsets `0, -1, 1, -2, 2` and accepts the first legal candidate. These are simple horizontal wall kicks, not an implementation of a commercial rotation standard.

The ghost copies the active piece and moves the copy down until the next step fails. Drawing that copy at low opacity tells the player where Space will place it. The real piece is unaffected.

Hold stores the current type and spawns either the preview or the held type. The `held` flag prevents cycling repeatedly before locking a piece. When swapping with an occupied hold slot, keep the next queue intact; don't silently consume an extra bag entry.

The seven-bag shuffles one of every shape with the state-owned random generator. Both battle players begin with the same seed and therefore the same initial piece order. This makes tests reproducible and openings fair; garbage holes also consume that player's generator, so later order can diverge after different battle events. Do not describe it as a cryptographically secret or competitive anti-cheat random system.

## 5. Lock, clear, compact and score

Gravity accumulates elapsed seconds. When the delay passes, try one downward cell. If that fails, lock the four cells. A piece that locks above the visible board loses immediately. The supplied game has immediate locking; adding a lock delay is an extension, not a hidden feature.

After writing the four cells, keep only rows that still contain an empty cell. The number removed is the clear count. Prepend that many **new** empty rows to restore the height:

```js
const kept = state.board.filter(row => row.some(value => !value));
const cleared = H - kept.length;
state.board = [
  ...Array.from({ length: cleared }, () => Array(W).fill(0)),
  ...kept
];
```

Scores for one through four lines are 100, 300, 500 and 800, multiplied by the level. Soft-drop adds one per moved cell; hard-drop adds two. Reset the hold gate, spawn the preview, and check the 20-row goal.

**Learning check:** create a nearly filled bottom row in `newGrid()` on a temporary copy and clear it with the missing shape. Confirm the rows above move down, the top is empty, the score changes once, and a new active piece appears. Restore the normal initializer afterward. A screenshot of a falling piece alone does not verify compaction.

## 6. Make physics mode actually topple

![Matter compound pieces settle at real angles](assets/screenshots/ed-tedris-physics.png)

Arcade AABB physics does not provide the angular rigid-body contacts needed here. The supplied 2D mode uses **Matter**, already bundled in Nord's local Phaser build. Havok would suit a separate 3D tower, but is not required for this 2D implementation.

`createChaos()` loads `vendor/phaser/phaser.min.js` locally, retrieves `Phaser.Physics.Matter.Matter`, creates an Engine, and adds a static floor and two walls. Each shape becomes four rectangle parts in one compound body:

```js
const parts = SHAPES[type].map(([x, y]) =>
  M.Bodies.rectangle(110 + x * 24, 45 + y * 24, 23, 23));
const body = M.Body.create({ parts, friction: .7, restitution: .04 });
M.Composite.add(engine.world, body);
```

Read the complete `chaos.js` for density, input and lifetime details. A compound keeps the four blocks together as one rigid object. Four independent bodies would scatter instead of behaving as a tetromino.

Input applies force to the active body, and Q/E changes angular velocity. `Engine.update()` advances the world using milliseconds, so the controller converts seconds with `dt * 1000`. Render the body's actual polygon vertices; do not draw an unrotated grid shape at its centre.

The survival rules inspect stack height and active speed, not array rows. Friction and restitution change the feel dramatically. Try friction `.2` versus `.7`; record which makes the stack slide more. Physics mode is local-only, so two browsers are not expected to reproduce the same tower exactly.

## 7. Run a real battle server

Open a terminal in the extracted project folder:

```sh
node server.mjs
```

Node 22 or newer is recommended. Open the printed address in two browser tabs. Enter different names, use room `NORD`, click Join in each and then Ready in each. Put the tabs side by side. Drop a piece in one and watch that player's miniature board update in the other.

The default port is 4382. If busy:

```sh
PORT=4482 node server.mjs
```

Set the page's Server field to that server address. In Nord Play, the game page and Node API use different local ports; the helper permits local HTTP preview origins. Opening the Node-served page puts client and API on the same origin and is the easiest setup.

For friends on your trusted local network:

```sh
HOST=0.0.0.0 node server.mjs
```

Find the host computer's LAN address and have friends open that address with port 4382; put the same address in Server and choose the same room. `localhost` on a friend's computer points to their computer, not yours. Permit the chosen port in the host firewall if needed. The server has no account system or durable database; it is a small trusted-room teaching implementation. Internet deployment needs HTTPS, authentication and a deployment-specific origin policy, not a public port forward of this development server.

## 8. Follow a move from browser to authoritative server

The browser sends an action name rather than a score or new board:

```js
await fetch(server + '/api/action', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: session.id, action: 'left' })
});
```

`server.mjs` resolves the session and room, validates the action, applies a small rate limit, and calls the same `action()` used in solo mode. A 50ms server tick advances gravity. The client polls snapshots about five times per second; the supplied battle deliberately favours understandable authoritative code over prediction and rollback.

`lastClear` records the result of one rule step. Two or more clears add garbage to the opponent; garbage shifts rows upward and adds a row with one hole. If occupied cells are pushed out at the top, that player loses. The round result is computed on the server. The client cannot win merely by changing a DOM score.

Rooms hold two players. A session inactive for 30 seconds expires; its seat becomes available and the remaining room returns to waiting. Ready after a finished round resets both grids with a fresh shared seed. Ready requests during a live battle are rejected, so they cannot reset the opponent's progress. Live battles do not support unilateral pause. Leave returns your page to local mode; its server seat expires shortly afterward.

**Learning check:** stop the server while the battle page is open. The network area should report a connection error. Restart Node and join again: memory-only rooms do not survive a server restart. A static HTML export contains client files, but it cannot execute Node; host `server.mjs` separately for online play.

## 9. Source research and deliberate choices

The requested Kirpich and TengenTetrisDisasm sources were inspected at pinned revisions, including collision, rotation, lock/clear sequencing, input repeat and multiplayer-related code. The detailed findings and citations are in the engine repository's `docs/RESEARCH_GAME_TUTORIALS.md`. Kirpich's serial multiplayer wiring is explicitly unfinished, so it was not reused as a working network layer. Tengen's disassembly and cartridge content remain reference-only. No source or assets from either project are copied into this game.

The implementation here uses clear candidate checks, fresh-row compaction and a seven-bag rather than reproducing cartridge quirks. Physics mode is a separate ruleset because arbitrary angles and perfect grid compaction are incompatible assumptions. These choices keep each mode teachable and testable.

## 10. Verify, export and extend

Before exporting, check wall collision, blocked rotation, soft/hard drop, ghost, once-per-piece hold, one- and multi-row clears, overflow, pause, restart and best-score persistence. In physics mode verify actual angular motion and a new piece after settling. In battle verify two names, both Ready, shared state, garbage, result and rematch. The repository tests cover grid rules, real HTTP authority, actual Matter rotation/settling and two browser clients.

Use Nord's HTML export for a static client. All physics code is local; there are no CDN calls. Keep `server.mjs`, `server-kit.mjs` and `rules.js` together when hosting the Node game. The source download already includes them. A good extension is a lock-delay timer or a three-piece preview. Add one rule and a focused test before adding more presentation.

## Complete project source

The archive contains every file needed for the complete local game and Node battle, including the pinned physics bundle and licences. Below are all authored game, server, page, configuration and style files in the manual's local CodeMirror viewer. Copy the complete files when following from an empty project; the smaller excerpts above explain the decisions.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

### app.js

```js
import { newGrid, cells, ghost, COLORS, action, tickGrid, SHAPES } from './rules.js';
import { createChaos } from './chaos.js';
export function mount(root) {
  root.innerHTML = /* HTML */ `
    <link rel="stylesheet" href="style.css" />
    <main>
      <h1>
        JengaTedris
        <small>GRID / TOPPLE / BATTLE</small>
      </h1>
      <nav>
        <button id="grid">Grid run</button>
        <button id="chaos">Physics tower</button>
        <button id="pause">Pause / Resume</button>
        <button id="restart">Restart</button>
      </nav>
      <section class="layout">
        <canvas width="300" height="600" aria-label="Game board"></canvas>
        <aside>
          <h2 id="status"></h2>
          <p id="stats"></p>
          <canvas id="next" width="200" height="160"></canvas>
          <p>Grid: arrows move/down, ↑ rotate, Space drop, C hold. Clear 20 rows!</p>
          <p>
            Physics: ← → push, Q / E rotate, ↓ slam. Survive 18 rigid pieces; no row
            clears.
          </p>
          <h2>Battle a friend</h2>
          <label>
            Name
            <input id="name" value="Builder" maxlength="20" />
          </label>
          <label>
            Room
            <input id="room" value="NORD" maxlength="8" />
          </label>
          <label>
            Server
            <input id="server" />
          </label>
          <button id="join">Join battle</button>
          <button id="ready">Ready / Rematch</button>
          <button id="leave">Leave battle</button>
          <p id="network">
            Start node server.mjs for multiplayer. Same room, two browsers, both Ready.
          </p>
          <canvas id="rival" width="150" height="300"></canvas>
          <p>
            Two or more cleared rows send garbage to your rival. The server owns both
            boards.
          </p>
        </aside>
      </section>
      <footer>
        Original game · Crowelian 2026 + Sonnet · Best grid score:
        <b id="best"></b>
      </footer>
    </main>
  `;
  const $ = (id) => root.querySelector('#' + id),
    canvas = root.querySelector('canvas'),
    ctx = canvas.getContext('2d'),
    keys = new Set();
  $('server').value =
    location.port === '4382' ? location.origin : 'http://127.0.0.1:4382';
  let mode = 'grid',
    grid = newGrid(Date.now() >>> 0),
    chaos = null,
    paused = false,
    last = performance.now(),
    alive = true,
    battle = null,
    queue = Promise.resolve(),
    busy = false,
    poll = 0;
  let best = 0;
  try {
    best = Number(localStorage.getItem('jengatedris.best') || 0);
  } catch {}
  $('best').textContent = best;
  function reset() {
    if (mode === 'battle') {
      message('Use Ready / Rematch after the battle ends.');
      return;
    }
    chaos?.dispose();
    chaos = null;
    grid = newGrid(Date.now() >>> 0);
    paused = false;
    keys.clear();
    if (mode === 'chaos') startChaos();
  }
  async function startChaos() {
    try {
      chaos = await createChaos();
    } catch (e) {
      message(e.message);
      mode = 'grid';
    }
  }
  const message = (t) => ($('network').textContent = t);
  const base = () => $('server').value.replace(/\/$/, '');
  async function request(route, body) {
    const r = await fetch(base() + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(4000),
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || r.status);
    return data;
  }
  function accept(data) {
    battle = data;
    const own = data.players.find((p) => p.id === data.id);
    if (own) grid = own.grid;
    message(
      `${data.room} · ${data.players.map((p) => p.name + (p.ready ? ' ✓' : '')).join(' vs ')} · ${data.phase}${data.winner ? ' · Winner: ' + data.winner : ''}`,
    );
  }
  function send(name) {
    queue = queue
      .then(async () => {
        if (!battle) return;
        accept(await request('action', { id: battle.id, action: name }));
      })
      .catch((e) => message(e.message + ' — join again if expired'));
  }
  $('grid').onclick = () => {
    battle = null;
    mode = 'grid';
    reset();
  };
  $('chaos').onclick = () => {
    battle = null;
    mode = 'chaos';
    reset();
  };
  $('restart').onclick = reset;
  $('pause').onclick = () => {
    if (mode === 'battle') {
      message('Live battles cannot pause one player.');
      return;
    }
    paused = !paused;
    keys.clear();
  };
  $('join').onclick = async () => {
    try {
      const data = await request('join', {
        room: $('room').value,
        name: $('name').value,
      });
      chaos?.dispose();
      chaos = null;
      mode = 'battle';
      paused = false;
      accept(data);
    } catch (e) {
      message(e.message);
    }
  };
  $('ready').onclick = async () => {
    if (!battle) return;
    try {
      accept(await request('ready', { id: battle.id }));
    } catch (e) {
      message(e.message);
    }
  };
  $('leave').onclick = () => {
    battle = null;
    mode = 'grid';
    reset();
    message('Left locally; the server releases the seat after 30 seconds.');
  };
  const map = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowDown: 'down',
    KeyS: 'down',
    ArrowUp: 'rotate',
    KeyW: 'rotate',
    Space: 'drop',
    KeyC: 'hold',
  };
  const down = (e) => {
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (map[e.code] || e.code === 'KeyQ' || e.code === 'KeyE') e.preventDefault();
    keys.add(e.code);
    if (paused || mode === 'chaos') return;
    const name = map[e.code];
    if (name && (!e.repeat || ['left', 'right', 'down'].includes(name))) {
      if (mode === 'battle') send(name);
      else action(grid, name);
    }
  };
  const up = (e) => keys.delete(e.code),
    blur = () => {
      keys.clear();
      if (mode !== 'battle') paused = true;
    };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  function board(context, s, scale = 30) {
    context.fillStyle = COLORS[0];
    context.fillRect(0, 0, scale * 10, scale * 20);
    const block = (x, y, color, alpha = 1) => {
      if (y < 0) return;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2);
      context.fillStyle = '#ffffff22';
      context.fillRect(x * scale + 2, y * scale + 2, scale - 4, 3);
      context.globalAlpha = 1;
    };
    s.board.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) block(x, y, COLORS[v]);
      }),
    );
    if (!s.over)
      for (const [x, y] of cells(ghost(s))) block(x, y, COLORS[s.active.type + 1], 0.22);
    for (const [x, y] of cells(s.active)) block(x, y, COLORS[s.active.type + 1]);
  }
  function draw() {
    ctx.fillStyle = '#122130';
    ctx.fillRect(0, 0, 300, 600);
    if (mode === 'chaos' && chaos) chaos.draw(ctx);
    else board(ctx, grid);
    $('status').textContent = paused
      ? 'PAUSED'
      : mode === 'chaos'
        ? chaos?.over
          ? chaos.won
            ? 'TOWER SURVIVED!'
            : 'TOWER OVERFLOW!'
          : 'PHYSICS TOWER'
        : grid.over
          ? grid.won
            ? '20 ROWS CLEAR!'
            : 'STACK OVERFLOW'
          : mode === 'battle'
            ? 'LIVE BATTLE'
            : 'GRID RUN';
    $('stats').textContent =
      mode === 'chaos'
        ? `Piece ${chaos?.count || 0}/18 · settle each rigid tetromino`
        : `Score ${grid.score} · Rows ${grid.lines}/20 · Level ${grid.level}`;
    const n = $('next').getContext('2d');
    n.clearRect(0, 0, 200, 160);
    n.fillStyle = '#d8e8ef';
    n.font = '14px monospace';
    n.fillText('NEXT', 4, 16);
    n.fillText('HOLD', 4, 90);
    for (const [type, oy] of [
      [grid.next, 22],
      [grid.hold, 96],
    ])
      if (type !== null)
        for (const [x, y] of SHAPES[type]) {
          n.fillStyle = COLORS[type + 1];
          n.fillRect(x * 22 + 24, y * 22 + oy, 20, 20);
        }
    const opponent = battle?.players.find((p) => p.id !== battle.id);
    const rc = $('rival').getContext('2d');
    rc.clearRect(0, 0, 150, 300);
    if (opponent) board(rc, opponent.grid, 15);
  }
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      if (mode === 'grid') tickGrid(grid, dt);
      if (mode === 'chaos') chaos?.tick(dt, keys);
    }
    if (mode === 'grid' && grid.score > best) {
      best = grid.score;
      $('best').textContent = best;
      try {
        localStorage.setItem('jengatedris.best', best);
      } catch {}
    }
    poll += dt;
    if (mode === 'battle' && battle && poll > 0.2 && !busy) {
      poll = 0;
      busy = true;
      request('state?id=' + encodeURIComponent(battle.id))
        .then(accept)
        .catch((e) => message(e.message))
        .finally(() => (busy = false));
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__tedris = {
    get grid() {
      return grid;
    },
    get chaos() {
      return chaos;
    },
    get mode() {
      return mode;
    },
    get battle() {
      return battle;
    },
    get paused() {
      return paused;
    },
  };
  return () => {
    alive = false;
    chaos?.dispose();
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    root.replaceChildren();
  };
}
```

<details>
<summary>Complete chaos.js</summary>

```js
// Matter is already bundled with Nord's pinned Phaser. No CDN and no extra npm install.
import { SHAPES, COLORS } from './rules.js';
export async function createChaos() {
  if (!window.Phaser)
    await new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = 'vendor/phaser/phaser.min.js';
      tag.onload = resolve;
      tag.onerror = () => reject(Error('Missing local vendor/phaser/phaser.min.js'));
      document.head.append(tag);
    });
  const M = window.Phaser.Physics.Matter.Matter;
  const engine = M.Engine.create();
  engine.gravity.y = 0.8;
  const walls = [
    M.Bodies.rectangle(150, 590, 320, 24, { isStatic: true }),
    M.Bodies.rectangle(-12, 300, 24, 600, { isStatic: true }),
    M.Bodies.rectangle(312, 300, 24, 600, { isStatic: true }),
  ];
  M.Composite.add(engine.world, walls);
  const s = {
    engine,
    M,
    blocks: [],
    active: null,
    count: 0,
    over: false,
    won: false,
    time: 0,
    settle: 0,
  };
  s.spawn = () => {
    const type = s.count % 7;
    const parts = SHAPES[type].map(([x, y]) =>
      M.Bodies.rectangle(110 + x * 24, 45 + y * 24, 23, 23),
    );
    const body = M.Body.create({
      parts,
      friction: 0.7,
      restitution: 0.04,
      density: 0.004,
    });
    body.color = COLORS[type + 1];
    M.Composite.add(engine.world, body);
    s.blocks.push(body);
    s.active = body;
    s.count++;
    s.time = 0;
    s.settle = 0;
  };
  s.spawn();
  s.tick = (dt, keys) => {
    if (s.over) return;
    dt = Math.min(dt, 0.033);
    s.time += dt;
    const b = s.active;
    M.Body.applyForce(b, b.position, {
      x:
        ((keys.has('ArrowRight') || keys.has('KeyD')) -
          (keys.has('ArrowLeft') || keys.has('KeyA'))) *
        0.0015,
      y: keys.has('ArrowDown') ? 0.009 : 0,
    });
    if (keys.has('KeyQ')) M.Body.setAngularVelocity(b, -0.035);
    if (keys.has('KeyE')) M.Body.setAngularVelocity(b, 0.035);
    M.Engine.update(engine, dt * 1000);
    if (s.time > 1 && b.speed < 0.3) s.settle += dt;
    else s.settle = 0;
    if (s.settle > 0.65 || s.time > 7) {
      if (s.blocks.some((v) => v.position.y < 90 && v !== b)) {
        s.over = true;
        return;
      }
      if (s.count >= 18) {
        s.over = true;
        s.won = true;
      } else s.spawn();
    }
  };
  s.draw = (ctx) => {
    for (const b of [...walls, ...s.blocks])
      for (const p of b.parts.length > 1 ? b.parts.slice(1) : [b]) {
        ctx.fillStyle = b.color || '#69818b';
        ctx.beginPath();
        p.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#172432';
        ctx.stroke();
      }
  };
  s.dispose = () => {
    M.Composite.clear(engine.world, false);
    M.Engine.clear(engine);
  };
  return s;
}
```

</details>

<details>
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.jengatedris"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JengaTedris — grid, topple and battle</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete nord.project.json</summary>

```json
{
  "format": 1,
  "name": "JengaTedris",
  "id": "com.crowelian.jengatedris",
  "type": "html",
  "engineVersion": "0.1.0",
  "startScene": "",
  "display": {
    "width": 640,
    "height": 360,
    "scale": "fit",
    "pixelArt": false,
    "background": "#2e3440"
  },
  "physics": {
    "engine": "none",
    "gravity": [
      0,
      0,
      0
    ]
  },
  "input": {
    "actions": {
      "left": [
        "KeyA",
        "ArrowLeft"
      ],
      "right": [
        "KeyD",
        "ArrowRight"
      ],
      "up": [
        "KeyW",
        "ArrowUp"
      ],
      "down": [
        "KeyS",
        "ArrowDown"
      ],
      "jump": [
        "Space",
        "KeyW",
        "ArrowUp"
      ],
      "fire": [
        "Space",
        "Mouse0"
      ],
      "interact": [
        "KeyE",
        "Enter"
      ]
    }
  },
  "plugins": [
    "ui",
    "audio"
  ],
  "ui": {
    "skin": "cyber",
    "theme": "nord"
  }
}
```

</details>

<details>
<summary>Complete rules.js</summary>

```js
// Grid mode has no physics bodies. Board values are colour indices, zero means empty.
export const W = 10,
  H = 20;
export const SHAPES = [
  [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
];
export const COLORS = [
  '#122130',
  '#55dcf4',
  '#f7d774',
  '#c18aff',
  '#72dda2',
  '#fa7894',
  '#789ef5',
  '#f6aa66',
  '#637485',
];
export function random(s) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function next(s) {
  if (!s.bag.length) {
    s.bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 6; i > 0; i--) {
      const j = Math.floor(random(s) * (i + 1));
      [s.bag[i], s.bag[j]] = [s.bag[j], s.bag[i]];
    }
  }
  return s.bag.pop();
}
export function cells(p) {
  let pts = SHAPES[p.type].map((v) => [...v]);
  for (let r = 0; r < p.r; r++) pts = pts.map(([x, y]) => [3 - y, x]);
  return pts.map(([x, y]) => [p.x + x, p.y + y]);
}
export function fits(s, p) {
  return cells(p).every(
    ([x, y]) => x >= 0 && x < W && y < H && (y < 0 || !s.board[y][x]),
  );
}
function spawn(s, type = s.next, advance = true) {
  s.active = { type, x: 3, y: -1, r: 0 };
  if (advance) s.next = next(s);
  s.fall = 0;
  if (!fits(s, s.active)) s.over = true;
}
export function newGrid(seed = 12345) {
  const s = {
    seed,
    board: Array.from({ length: H }, () => Array(W).fill(0)),
    bag: [],
    next: 0,
    active: null,
    hold: null,
    held: false,
    score: 0,
    lines: 0,
    level: 1,
    fall: 0,
    over: false,
    won: false,
    lastClear: 0,
  };
  s.next = next(s);
  spawn(s);
  return s;
}
export function move(s, dx, dy) {
  const p = { ...s.active, x: s.active.x + dx, y: s.active.y + dy };
  if (!fits(s, p)) return false;
  s.active = p;
  return true;
}
export function rotate(s) {
  if (s.active.type === 1) return;
  for (const dx of [0, -1, 1, -2, 2]) {
    const p = { ...s.active, x: s.active.x + dx, r: (s.active.r + 1) % 4 };
    if (fits(s, p)) {
      s.active = p;
      return;
    }
  }
}
function lock(s) {
  const pts = cells(s.active);
  if (pts.some(([, y]) => y < 0)) {
    s.over = true;
    return;
  }
  for (const [x, y] of pts) s.board[y][x] = s.active.type + 1;
  const kept = s.board.filter((row) => row.some((v) => !v)),
    cleared = H - kept.length;
  s.lastClear = cleared;
  s.lines += cleared;
  s.score += [0, 100, 300, 500, 800][cleared] * s.level;
  s.level = 1 + Math.floor(s.lines / 5);
  s.board = [...Array.from({ length: cleared }, () => Array(W).fill(0)), ...kept];
  s.held = false;
  spawn(s);
  if (s.lines >= 20) {
    s.won = true;
    s.over = true;
  }
}
export function action(s, name) {
  if (s.over) return;
  s.lastClear = 0;
  if (name === 'left') move(s, -1, 0);
  if (name === 'right') move(s, 1, 0);
  if (name === 'rotate') rotate(s);
  if (name === 'down') {
    if (move(s, 0, 1)) s.score++;
    else lock(s);
  }
  if (name === 'drop') {
    let n = 0;
    while (move(s, 0, 1)) n++;
    s.score += n * 2;
    lock(s);
  }
  if (name === 'hold' && !s.held) {
    const t = s.active.type;
    if (s.hold === null) {
      s.hold = t;
      spawn(s);
    } else {
      const h = s.hold;
      s.hold = t;
      spawn(s, h, false);
    }
    s.held = true;
  }
}
export function tickGrid(s, dt) {
  s.lastClear = 0;
  if (s.over) return;
  s.fall += Math.min(0.1, dt);
  const delay = Math.max(0.09, 0.72 - (s.level - 1) * 0.08);
  if (s.fall >= delay) {
    s.fall = 0;
    if (!move(s, 0, 1)) lock(s);
  }
}
export function garbage(s, count = 1) {
  if (s.over) return;
  for (let n = 0; n < count; n++) {
    if (s.board[0].some(Boolean)) {
      s.over = true;
      return;
    }
    s.board.shift();
    const hole = Math.floor(random(s) * W);
    s.board.push(Array.from({ length: W }, (_, x) => (x === hole ? 0 : 8)));
  }
  if (!fits(s, s.active)) s.over = true;
}
export function ghost(s) {
  const p = { ...s.active };
  while (fits(s, { ...p, y: p.y + 1 })) p.y++;
  return p;
}
```

</details>

<details>
<summary>Complete server-kit.mjs</summary>

```js
// Small HTTP transport shared by the teaching servers. No npm packages.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
export function serve({
  root,
  files,
  api,
  tick,
  port = 4382,
  host = process.env.HOST || '127.0.0.1',
}) {
  const server = http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(data));
    };
    const origin = req.headers.origin;
    if (origin) {
      try {
        const u = new URL(origin);
        if (u.protocol !== 'http:' && u.protocol !== 'https:')
          return json(403, { error: 'HTTP origin required' });
        if (
          u.host !== req.headers.host &&
          !['localhost', '127.0.0.1'].includes(u.hostname)
        )
          return json(403, { error: 'Open the game from this server' });
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
        res.setHeader('access-control-allow-headers', 'content-type');
        res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      } catch {
        return json(403, { error: 'Invalid origin' });
      }
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        let body = {};
        if (req.method === 'POST') {
          if (!req.headers['content-type']?.startsWith('application/json'))
            return json(415, { error: 'Send JSON' });
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (Buffer.byteLength(raw) > 2048) return json(413, { error: 'Too large' });
          }
          try {
            body = JSON.parse(raw);
          } catch {
            return json(400, { error: 'Invalid JSON' });
          }
          if (!body || typeof body !== 'object' || Array.isArray(body))
            return json(400, { error: 'Send an object' });
        } else if (req.method !== 'GET')
          return json(405, { error: 'GET or POST required' });
        const result = api(req.method, url, body);
        return json(result.status ?? 200, result.data ?? result);
      }
      const name = files[url.pathname];
      if (req.method !== 'GET' || !name) return json(404, { error: 'Not found' });
      const mime =
        {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.mjs': 'text/javascript',
          '.css': 'text/css',
          '.md': 'text/plain',
        }[path.extname(name)] || 'application/octet-stream';
      const bytes = await fs.readFile(path.join(root, name));
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
      res.end(bytes);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) json(500, { error: 'Server error' });
      else res.end();
    }
  });
  const interval = setInterval(() => tick(0.05), 50);
  server.on('close', () => clearInterval(interval));
  if (port !== null)
    server.listen(port, host, () =>
      console.log(
        `Open http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port} (HOST=${host})`,
      ),
    );
  return server;
}
export const failure = (status, error) => ({ status, data: { error } });
export const roomCode = (value) =>
  String(value ?? 'NORD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'NORD';
```

</details>

<details>
<summary>Complete server.mjs</summary>

```js
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, failure, roomCode } from './server-kit.mjs';
import { newGrid, action, tickGrid, garbage } from './rules.js';
export function createBattleServer({
  port = null,
  host,
  root = path.dirname(fileURLToPath(import.meta.url)),
  clock = Date.now,
} = {}) {
  const rooms = new Map(),
    sessions = new Map();
  let now = clock();
  const snapshot = (p) => {
    const r = rooms.get(p.room);
    return {
      id: p.id,
      room: p.room,
      phase: r.phase,
      winner: r.winner,
      players: r.players.map((v) => ({
        id: v.id,
        name: v.name,
        ready: v.ready,
        grid: v.grid,
      })),
    };
  };
  function attack(r, p) {
    const n = p.grid.lastClear;
    if (n >= 2) for (const q of r.players) if (q !== p) garbage(q.grid, n - 1);
  }
  function finish(r) {
    if (r.phase !== 'playing') return;
    const losers = r.players.filter((p) => p.grid.over && !p.grid.won),
      winner = r.players.find((p) => p.grid.won);
    if (losers.length || winner) {
      r.phase = 'finished';
      r.winner =
        winner?.name ||
        (losers.length === 2 ? 'Draw' : r.players.find((p) => !p.grid.over)?.name) ||
        'Draw';
      for (const p of r.players) p.ready = false;
    }
  }
  const api = (method, url, b) => {
    if (method === 'POST' && url.pathname === '/api/join') {
      if (sessions.size >= 64) return failure(429, 'Server full');
      const code = roomCode(b.room);
      let r = rooms.get(code);
      if (!r) {
        r = { players: [], phase: 'waiting', winner: null };
        rooms.set(code, r);
      }
      if (r.players.length >= 2)
        return failure(409, 'Room has two players; choose another code');
      const p = {
        id: randomUUID(),
        room: code,
        name: String(b.name || 'Builder').slice(0, 20),
        grid: newGrid(),
        seen: now,
        ready: false,
        lastAction: 0,
      };
      r.players.push(p);
      sessions.set(p.id, p);
      return snapshot(p);
    }
    const p = sessions.get(method === 'GET' ? url.searchParams.get('id') : b.id);
    if (!p) return failure(404, 'Session expired; join again');
    p.seen = now;
    const r = rooms.get(p.room);
    if (method === 'GET' && url.pathname === '/api/state') return snapshot(p);
    if (method === 'POST' && url.pathname === '/api/ready') {
      if (r.phase === 'playing')
        return failure(409, 'Finish this battle before rematching');
      p.ready = true;
      if (r.players.length === 2 && r.players.every((v) => v.ready)) {
        const seed = now >>> 0;
        for (const v of r.players) v.grid = newGrid(seed);
        r.phase = 'playing';
        r.winner = null;
      }
      return snapshot(p);
    }
    if (method === 'POST' && url.pathname === '/api/action') {
      if (!['left', 'right', 'rotate', 'down', 'drop', 'hold'].includes(b.action))
        return failure(400, 'Unknown action');
      if (r.phase === 'playing' && clock() - p.lastAction >= 24) {
        p.lastAction = clock();
        action(p.grid, b.action);
        attack(r, p);
        finish(r);
      }
      return snapshot(p);
    }
    return failure(404, 'Unknown endpoint');
  };
  const tick = (dt) => {
    now = clock();
    for (const [code, r] of rooms) {
      for (const p of [...r.players])
        if (now - p.seen > 30000) {
          sessions.delete(p.id);
          r.players.splice(r.players.indexOf(p), 1);
          r.phase = 'waiting';
          r.players.forEach((v) => (v.ready = false));
        }
      if (!r.players.length) {
        rooms.delete(code);
        continue;
      }
      if (r.phase === 'playing') {
        for (const p of r.players) {
          tickGrid(p.grid, dt);
          attack(r, p);
        }
        finish(r);
      }
    }
  };
  return serve({
    root,
    port,
    host,
    api,
    tick,
    files: {
      '/': 'index.html',
      '/index.html': 'index.html',
      '/app.js': 'app.js',
      '/rules.js': 'rules.js',
      '/chaos.js': 'chaos.js',
      '/style.css': 'style.css',
      '/vendor/phaser/phaser.min.js': 'vendor/phaser/phaser.min.js',
    },
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  createBattleServer({ port: Number(process.env.PORT || 4382) });
```

</details>

<details>
<summary>Complete style.css</summary>

```css
html {
  background: #0a1522;
}
html,
body {
  height: auto;
  min-height: 100%;
}
* {
  box-sizing: border-box;
}
body {
  background: #0a1522;
  color: #d8e8ef;
  font: 16px system-ui;
  margin: 0;
}
main {
  max-width: 850px;
  margin: auto;
  padding: 18px;
}
h1 {
  color: #6de1ef;
  margin: 4px 0 12px;
}
small {
  font-size: 12px;
  color: #eec677;
}
nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
button,
input {
  font: inherit;
  padding: 8px;
  border: 1px solid #3e6070;
  border-radius: 6px;
  background: #20364a;
  color: #f4f8ff;
}
button {
  cursor: pointer;
}
button:hover {
  background: #35536b;
}
.layout {
  display: flex;
  gap: 22px;
  align-items: flex-start;
}
canvas {
  border: 1px solid #35536b;
  max-width: 100%;
  image-rendering: pixelated;
}
aside {
  max-width: 350px;
}
aside h2 {
  font-size: 18px;
  color: #eec677;
}
label {
  display: block;
  font-size: 13px;
  margin: 8px 0;
}
input {
  width: 100%;
  font-size: 14px;
}
p {
  line-height: 1.45;
  font-size: 14px;
}
#next {
  border: 0;
}
#rival {
  float: right;
}
footer {
  clear: both;
  padding: 12px;
  color: #8faab8;
  font-size: 12px;
}
@media (max-width: 620px) {
  .layout {
    flex-direction: column;
  }
  main {
    padding: 8px;
  }
}
```

</details>
