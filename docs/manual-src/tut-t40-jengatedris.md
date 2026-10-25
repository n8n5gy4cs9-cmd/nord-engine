---
title: T40 JengaTedris — grid, physics and Node battle
section: Tutorials
order: 40
summary: Complete array-based grid game, real Matter compound tower and authoritative two-browser battle, with every source file.
---


Make a complete original falling-block game in three modes: a crisp grid challenge, a chaotic rigid-body tower, and a real two-browser battle. You will learn arrays, candidate movement, rotation, row compaction, seeded randomness, Matter compounds and server-owned game state. The project is called **JengaTedris**; it uses original code and canvas graphics, with no cartridge, ROM or commercial-game assets.

**Download:** [Complete JengaTedris project and source](assets/downloads/jengatedris-source.zip). Unzip, open `nord.project.json` in Nord, and press **Play**. This example uses Nord's **HTML tier**: one page and JavaScript modules, with a canvas as its view. You edit ordinary project files in Nord's code editor and export through the same HTML workflow as other Nord apps. A tilemap or four sprite entities could replace the canvas view without changing the grid rules.

![Playable grid game with next and hold previews](assets/screenshots/ed-tedris-grid.png)

**Full-code learning route:** After the orientation below, continue to [the complete file-by-file walkthrough](#file-walkthrough). It teaches every main project file in consecutive sections, with the actual code, an explanation of what and why, and a change to try. The expandable complete files at the end are a reference, not the lesson.

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
| `ui/menu.ui.json` | All page layout, text and form fields, edited in the UI Designer |
| `lib/nord-ui.js` | The Nord UI runtime that builds the UI file (a copy of `runtime/core/uiscene.js`) |
| `chaos.js` | Actual Matter world, compound pieces, forces and drawing |
| `server.mjs` | Two-player rooms, authoritative battle updates and garbage |
| `server-kit.mjs` | Small Node HTTP/JSON transport and static file allowlist |
| `style.css` | Responsive page, inputs and canvases |
| `vendor/phaser/phaser.min.js` | Nord's pinned offline Phaser build, which includes Matter |

Start by changing `JengaTedris` in `ui/menu.ui.json` (or in the UI Designer) and the highlight colour in `style.css`, then run your copy. No bundler or npm install is needed. The download includes the physics bundle and its licence. Its minified library code is packaged rather than expanded in this guide; all game and server source is listed at the end.

## 3. Represent the board as data, not falling pixels

The board is a 20-row array; each row contains ten colour indices. Zero means empty. Seven shapes each contain four integer offsets. The active piece stores type, grid X/Y and rotation. Its four occupied cells are derived by `cells(piece)`.

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
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

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
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

**Terminal** (in the project folder, or the folder named in the text above):
```sh
node server.mjs
```

Node 22 or newer is recommended. Open the printed address in two browser tabs. Enter different names, use room `NORD`, click Join in each and then Ready in each. Put the tabs side by side. Drop a piece in one and watch that player's miniature board update in the other.

The default port is 4382. If busy:

**Terminal** (in the project folder, or the folder named in the text above):
```sh
PORT=4482 node server.mjs
```

Set the page's Server field to that server address. In Nord Play, the game page and Node API use different local ports; the helper permits local HTTP preview origins. Opening the Node-served page puts client and API on the same origin and is the easiest setup.

For friends on your trusted local network:

**Terminal** (in the project folder, or the folder named in the text above):
```sh
HOST=0.0.0.0 node server.mjs
```

Find the host computer's LAN address and have friends open that address with port 4382; put the same address in Server and choose the same room. `localhost` on a friend's computer points to their computer, not yours. Permit the chosen port in the host firewall if needed. The server has no account system or durable database; it is a small trusted-room teaching implementation. Internet deployment needs HTTPS, authentication and a deployment-specific origin policy, not a public port forward of this development server.

## 8. Follow a move from browser to authoritative server

The browser sends an action name rather than a score or new board:

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
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

<!-- GENERATED FILE WALKTHROUGH -->

## Walk through every project file {#file-walkthrough}

Work through these files in order using your downloaded project in Nord. Each numbered part shows the **next consecutive lines** of that file, not a selection of highlights. Read the explanation before changing anything. Edit the existing code in place; do not append another copy of a function. Finish one experiment, observe its result, and undo that change before moving on. The complete files and download at the end remain your reference.

The walkthrough covers the app/game modules, shared helpers used by them, page, styles and project configuration. Binary art/audio/models and minified vendor dependencies are resources rather than lessons in their internal implementation; their paths and contracts are explained where the app uses them.

| File | What you will build or understand |
| --- | --- |
| [rules.js](#walk-rules-js) | Build every grid rule, from literal shape cells through rotation, hold, gravity and garbage. |
| [chaos.js](#walk-chaos-js) | Build every piece of the separate real-physics survival mode. |
| [app.js](#walk-app-js) | Read the entire host page and client loop for all three modes. |
| [ui/menu.ui.json](#walk-ui-menu-ui-json) | Describe the whole page as data: header, mode buttons, board canvas, side panel with the battle form and footer. Semantic tags keep the existing stylesheet working. |
| [server.mjs](#walk-server-mjs) | Build the complete authoritative two-player room lifecycle. |
| [server-kit.mjs](#walk-server-kit-mjs) | Read the entire package-free HTTP adapter shared by the game servers. |
| [index.html](#walk-index-html) | Read the complete Nord page entry point and its failure path. |
| [nord.project.json](#walk-nord-project-json) | Read every project field that tells Nord which host, display and services to use. |
| [style.css](#walk-style-css) | Read every stylesheet rule, grouped by the UI responsibility it controls. |

### 1. rules.js {#walk-rules-js}

Build every grid rule, from literal shape cells through rotation, hold, gravity and garbage.

#### 1.1 — Define seven pieces as four local cells

**Read:** `rules.js`, lines 1–47.

<!-- taught-source: jengatedris/rules.js:1-47 -->

**File: `rules.js`** (step 1.1, define seven pieces as four local cells: the beginning of the file)
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
```

**What and why:** W/H set board dimensions. Each SHAPES entry lists four offsets in a local four-by-four box, not four positions in the world. A type index selects one entry; colour values use type plus one so zero remains empty. These tables are shared by geometry and previews, preventing a preview shape from disagreeing with collision.

**Try it / expected result:** Count the offsets in each entry: every piece must have four. Change a colour rather than geometry first, then verify active/preview cells stay consistent.

#### 1.2 — Generate reproducible bags

**Read:** `rules.js`, lines 48–72.

<!-- taught-source: jengatedris/rules.js:48-72 -->

**File: `rules.js`** (step 1.2, generate reproducible bags: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** The colour table includes empty and garbage colours. random updates a 32-bit seed and scales it to a fraction. next fills a bag with all seven types, shuffles it using a shrinking index range, then pops one type. Saving the generator in the state makes seeded openings reproducible in tests and battles; it is not a secure random source.

**Try it / expected result:** Start two newGrid states with the same seed and compare several pieces. They should agree until different operations consume their random streams.

#### 1.3 — Convert local cells and test a candidate

**Read:** `rules.js`, lines 73–88.

<!-- taught-source: jengatedris/rules.js:73-88 -->

**File: `rules.js`** (step 1.3, convert local cells and test a candidate: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** cells copies offsets before rotating them so the global SHAPES table stays unchanged. Each quarter-turn maps x/y through the four-cell box, then adds the active piece origin. fits checks all four cells, allowing negative y during entry but rejecting side/bottom collisions and occupied visible cells. spawn resets rotation/fall and checks immediate overflow.

**Try it / expected result:** Move a piece against a wall. A rejected candidate should not change the original offsets or move another piece of that type.

#### 1.4 — Initialize independent rows and test movement transactionally

**Read:** `rules.js`, lines 89–115.

<!-- taught-source: jengatedris/rules.js:89-115 -->

**File: `rules.js`** (step 1.4, initialize independent rows and test movement transactionally: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** Array.from creates distinct row arrays. Shared rows made with fill(oneArray) would corrupt multiple rows at once. next is prepared before spawn consumes it. move creates a candidate object, tests it, then commits it; the boolean lets soft drop and gravity decide whether to lock. No pixel coordinates appear in these decisions.

**Try it / expected result:** Temporarily write one board cell in the Console. Only its own row should change.

#### 1.5 — Try kicks and lock four cells

**Read:** `rules.js`, lines 116–146.

<!-- taught-source: jengatedris/rules.js:116-146 -->

**File: `rules.js`** (step 1.5, try kicks and lock four cells: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** Square rotation is a no-op. Other rotations try horizontal offsets in priority order and accept the first fit; if none fit, state stays unchanged. lock first detects cells above the visible board, then writes type+1. It removes full rows, scores using the old level, computes the next level, prepends fresh empty rows and resets the hold gate before spawning. The goal sets a final result.

**Try it / expected result:** Create a near-full row in a test copy, clear it, and verify the top row becomes empty and score changes once.

#### 1.6 — Dispatch player intentions and implement hold

**Read:** `rules.js`, lines 147–175.

<!-- taught-source: jengatedris/rules.js:147-175 -->

**File: `rules.js`** (step 1.6, dispatch player intentions and implement hold: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** The dispatcher stops at game over and clears lastClear for this operation. Soft drop either moves and scores or locks; hard drop repeatedly tries move until blocked, scores by distance and locks once. Hold has empty and swap cases. Passing false to spawn during a swap preserves the next queue, and held prevents repeated swaps before lock.

**Try it / expected result:** Hold twice before locking. The second press should do nothing. After locking, hold should become available again.

#### 1.7 — Separate gravity, garbage and ghost prediction

**Read:** `rules.js`, lines 176–203.

<!-- taught-source: jengatedris/rules.js:176-203 -->

**File: `rules.js`** (step 1.7, separate gravity, garbage and ghost prediction: the next part of this file; it goes **below** the code of the previous step)
```js
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

**What and why:** Gravity accumulates seconds until the level-dependent delay passes, then attempts one grid step. Garbage shifts the board upward and adds one row with a seeded hole; occupied cells pushed out or a blocked active piece cause top-out. ghost moves a copy down until the next candidate fails, so it predicts Space without changing the active piece.

**Try it / expected result:** Compare the ghost with the actual hard-drop landing. In battle, watch garbage push existing rows upward rather than overwrite the bottom row.


### 2. chaos.js {#walk-chaos-js}

Build every piece of the separate real-physics survival mode.

#### 2.1 — Load local physics and make a static container

**Read:** `chaos.js`, lines 1–20.

<!-- taught-source: jengatedris/chaos.js:1-20 -->

**File: `chaos.js`** (step 2.1, load local physics and make a static container: the beginning of the file)
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
```

**What and why:** The optional script load uses the packaged Phaser build, whose Matter namespace supplies the solver. The engine gets gravity plus a floor and two static side walls. Static means the solver does not accelerate those bodies under gravity. This coordinate system is canvas pixels and milliseconds, separate from grid cells and seconds.

**Try it / expected result:** Change gravity from 0.8 to 0.4 temporarily. Pieces should descend more slowly while grid mode stays unchanged.

#### 2.2 — Spawn one compound instead of four loose blocks

**Read:** `chaos.js`, lines 21–51.

<!-- taught-source: jengatedris/chaos.js:21-51 -->

**File: `chaos.js`** (step 2.2, spawn one compound instead of four loose blocks: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** The state owns every body and the active piece. spawn uses the same SHAPES offsets to make four rectangles, but Body.create combines them into one rigid object with friction, restitution and density. Colour is render data. Resetting time/settle for each spawn gives every active piece its own control window.

**Try it / expected result:** Rotate a falling piece. Its four cells should stay joined; independent Matter bodies would fall apart.

#### 2.3 — Apply controls, step the solver and detect settling

**Read:** `chaos.js`, lines 52–79.

<!-- taught-source: jengatedris/chaos.js:52-79 -->

**File: `chaos.js`** (step 2.3, apply controls, step the solver and detect settling: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** The dt cap limits solver steps. Left/right input contributes force; Q/E changes angular velocity and Down adds a downward force. Engine.update expects milliseconds. A slow body must remain slow for 0.65 seconds after its opening second to count as settled; the seven-second timeout keeps the game progressing. Before spawning, the stack-height check can lose the run, while surviving eighteen pieces wins.

**Try it / expected result:** Tap rotate, release it and watch contacts change the angle. A simple grid y increment could not produce this motion.

#### 2.4 — Draw actual solver vertices and release the world

**Read:** `chaos.js`, lines 80–97.

<!-- taught-source: jengatedris/chaos.js:80-97 -->

**File: `chaos.js`** (step 2.4, draw actual solver vertices and release the world: the next part of this file; it goes **below** the code of the previous step)
```js
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

**What and why:** Matter compounds include a parent part; drawing parts.slice(1) avoids drawing that extra bounding part. Polygon vertices already contain physical rotation and translation, so no separate canvas angle calculation is needed. The returned dispose callback clears bodies and engine state when changing mode.

**Try it / expected result:** Switch Physics → Grid → Physics. A fresh tower should start, with no old bodies falling into the new world.


### 3. app.js {#walk-app-js}

Read the entire host page and client loop for all three modes.

#### 3.1 — Imports, load the UI file and name the handles

**Read:** `app.js`, lines 1–23.

<!-- taught-source: jengatedris/app.js:1-23 -->

**File: `app.js`** (step 3.1, imports, load the UI file and name the handles: the beginning of the file)
```js
import { newGrid, cells, ghost, COLORS, action, tickGrid, SHAPES } from './rules.js';
import { createChaos } from './chaos.js';
import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
  // Layout, text and fields live in ui/menu.ui.json (edit it in the UI Designer); this file only wires them up.
  const menu = await createUI(root).load('ui/menu.ui.json');
  // $('name') = the real DOM element of a node you named in the UI file
  const $ = (id) => menu.$(id).el,
    canvas = $('board'),
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
```

**What and why:** Imports give the host access to the rules, helpers and the Nord UI runtime. mount is async because createUI(root).load fetches the UI file, links the stylesheet inside an isolated shadow root and builds every node before the first line of game code runs. The $ helper returns the real DOM element of a node you named in the file, so existing logic can keep using .value, .textContent and .onclick without searching the page. The canvas and keys set follow.

**Try it / expected result:** Open the UI file in the UI Designer, rename a node and reload Play. The Console should name the missing node on the first lookup instead of silently doing nothing; rename it back afterwards.

#### 3.2 — Load the local best and reset owned modes

**Read:** `app.js`, lines 24–48.

<!-- taught-source: jengatedris/app.js:24-48 -->

**File: `app.js`** (step 3.2, load the local best and reset owned modes: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** Storage failures are caught so the game still runs. reset refuses to locally overwrite an online battle, disposes the old physics world, creates fresh grid state, unpauses and clears held keys. startChaos handles asynchronous library creation and falls back to grid with a message if it fails.

**Try it / expected result:** Pause, restart, and verify fresh state moves again. Switch away from physics and confirm its bodies are gone.

#### 3.3 — Implement a request and accept a snapshot

**Read:** `app.js`, lines 49–69.

<!-- taught-source: jengatedris/app.js:49-69 -->

**File: `app.js`** (step 3.3, implement a request and accept a snapshot: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** request chooses GET for polling or JSON POST for commands and adds a timeout. HTTP failure text becomes a useful error. accept replaces battle state with the server snapshot, selects your grid by session ID and formats the roster/result. No client-submitted score is trusted here.

**Try it / expected result:** Stop the Node process mid-battle. The network area should report failure; the page should not silently pretend local changes are a server result.

#### 3.4 — Preserve action order and wire local mode controls

**Read:** `app.js`, lines 70–96.

<!-- taught-source: jengatedris/app.js:70-96 -->

**File: `app.js`** (step 3.4, preserve action order and wire local mode controls: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** A promise queue sends actions in order rather than letting network completion reorder left/rotate/drop. Clearing battle state before choosing a local mode prevents later controls from using the old session. Pause is deliberately local-only; a shared battle cannot be stopped for just one participant.

**Try it / expected result:** Press rotate then drop in battle. The queued requests should preserve that order in the Network panel.

#### 3.5 — Join, ready and leave deliberately

**Read:** `app.js`, lines 97–125.

<!-- taught-source: jengatedris/app.js:97-125 -->

**File: `app.js`** (step 3.5, join, ready and leave deliberately: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** Join posts room/name before switching mode, so a failed connection leaves the local game usable. Successful join disposes physics and accepts the authoritative snapshot. Ready requires a session and reports server rejection; Leave returns locally and explains delayed seat expiry. These are three different lifecycle actions, not interchangeable reset buttons.

**Try it / expected result:** Join a full room and observe the error. Choose another room rather than overwriting the current two players.

#### 3.6 — Convert keys into actions without hijacking text fields

**Read:** `app.js`, lines 126–156.

<!-- taught-source: jengatedris/app.js:126-156 -->

**File: `app.js`** (step 3.6, convert keys into actions without hijacking text fields: the next part of this file; it goes **below** the code of the previous step)
```js
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
    if (menu.typing) return;
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
```

**What and why:** The key table maps several physical keys to one intention. The handler ignores focused inputs, prevents page scrolling for game keys and tracks held keys for physics. Grid actions allow repeat only for lateral/down movement; rotate/drop/hold trigger once. Blur clears keys and pauses local modes, while live battles continue on the server.

**Try it / expected result:** Hold Space: it should not instantly hard-drop an unlimited stream of pieces through repeated keydown events.

#### 3.7 — Paint locked cells, prediction and active cells in order

**Read:** `app.js`, lines 157–177.

<!-- taught-source: jengatedris/app.js:157-177 -->

**File: `app.js`** (step 3.7, paint locked cells, prediction and active cells in order: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** The block helper converts grid coordinates to pixels, skips above-board cells and restores globalAlpha after ghost painting. Board cells paint first, ghost second and the active piece last. A scale parameter reuses this renderer for the half-size opponent board without duplicating collision logic.

**Try it / expected result:** Look at the ghost through an active piece: the real piece should remain opaque. Removing the alpha reset would make later cells incorrectly translucent.

#### 3.8 — Derive status and previews from existing state

**Read:** `app.js`, lines 178–221.

<!-- taught-source: jengatedris/app.js:178-221 -->

**File: `app.js`** (step 3.8, derive status and previews from existing state: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** draw chooses the physics or grid renderer, then derives the status from mode, pause and result flags. It does not decide whether a line cleared. The next/hold preview reads SHAPES directly; null hold avoids indexing a nonexistent shape. The rival is whichever snapshot player is not you, and is painted through the same board function at scale 15.

**Try it / expected result:** Clear a row and inspect the preview and score together. They should reflect one state transition, not separate UI counters.

#### 3.9 — Choose one clock owner and stop cleanly

**Read:** `app.js`, lines 222–275.

<!-- taught-source: jengatedris/app.js:222-275 -->

**File: `app.js`** (step 3.9, choose one clock owner and stop cleanly: the next part of this file; it goes **below** the code of the previous step)
```js
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
    menu.destroy();
  };
}
```

**What and why:** Local grid/physics advance only when unpaused. Best score belongs only to local grid mode and is persisted defensively. Online mode polls about five times a second with a busy guard, rather than also running local gravity. draw and the next animation request continue for UI responsiveness. Getters expose state to checks; teardown stops future frames, destroys physics, removes listeners and clears the root.

**Try it / expected result:** Compare a battle snapshot in two browsers: gravity should agree because Node owns it. Closing/reopening Play must not retain the old frame loop.


### 4. ui/menu.ui.json {#walk-ui-menu-ui-json}

Describe the whole page as data: header, mode buttons, board canvas, side panel with the battle form and footer. Semantic tags keep the existing stylesheet working.

#### 4.1 — Page settings, header and mode buttons

**Read:** `ui/menu.ui.json`, lines 1–22.

<!-- taught-source: jengatedris/ui/menu.ui.json:1-22 -->

**File: `ui/menu.ui.json`** (step 4.1, page settings, header and mode buttons: the beginning of the file)
```json
{
  "version": 1,
  "name": "menu",
  "page": true,
  "styles": [
    "style.css"
  ],
  "body": {
    "margin": "0",
    "background": "#0a1522"
  },
  "root": { "type": "box", "tag": "main", "name": "root", "children": [
    { "type": "box", "tag": "h1", "children": [
      { "type": "label", "tag": "span", "text": "JengaTedris" },
      { "type": "label", "tag": "small", "text": "GRID / TOPPLE / BATTLE" }
    ] },
    { "type": "box", "tag": "nav", "children": [
      { "name": "grid", "type": "button", "text": "Grid run" },
      { "name": "chaos", "type": "button", "text": "Physics tower" },
      { "name": "pause", "type": "button", "text": "Pause / Resume" },
      { "name": "restart", "type": "button", "text": "Restart" }
    ] },
```

**What and why:** The file declares version 1, marks the screen as a page so it flows in the document, links style.css inside its own shadow root and sets the body colours. The root is a box with tag main. Header text and the four mode buttons are nodes with names; box nodes can carry a semantic tag such as h1 or nav, so CSS rules written for those tags still apply.

**Try it / expected result:** Add a fifth button inside the nav box in the Designer, name it help and save. Reload Play and look for it beside Restart; it does nothing until app.js listens for it. Delete it again.

#### 4.2 — Board canvas and the side panel

**Read:** `ui/menu.ui.json`, lines 23–51.

<!-- taught-source: jengatedris/ui/menu.ui.json:23-51 -->

**File: `ui/menu.ui.json`** (step 4.2, board canvas and the side panel: the next part of this file; it goes **below** the code of the previous step)
```json
    { "class": "layout", "type": "box", "tag": "section", "children": [
      { "type": "canvas", "w": 300, "h": 600, "attrs": {"aria-label": "Game board"}, "name": "board" },
      { "type": "box", "tag": "aside", "children": [
        { "name": "status", "type": "label", "tag": "h2" },
        { "name": "stats", "type": "label", "tag": "p" },
        { "name": "next", "type": "canvas", "w": 200, "h": 160 },
        { "type": "label", "tag": "p", "text": "Grid: arrows move/down, ↑ rotate, Space drop, C hold. Clear 20 rows!" },
        { "type": "label", "tag": "p", "text": "Physics: ← → push, Q / E rotate, ↓ slam. Survive 18 rigid pieces; no row clears." },
        { "type": "label", "tag": "h2", "text": "Battle a friend" },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Name" },
          { "name": "name", "type": "input", "value": "Builder", "maxlength": "20" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Room" },
          { "name": "room", "type": "input", "value": "NORD", "maxlength": "8" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Server" },
          { "name": "server", "type": "input" }
        ] },
        { "name": "join", "type": "button", "text": "Join battle" },
        { "name": "ready", "type": "button", "text": "Ready / Rematch" },
        { "name": "leave", "type": "button", "text": "Leave battle" },
        { "name": "network", "type": "label", "tag": "p", "text": "Start node server.mjs for multiplayer. Same room, two browsers, both Ready." },
        { "name": "rival", "type": "canvas", "w": 150, "h": 300 },
        { "type": "label", "tag": "p", "text": "Two or more cleared rows send garbage to your rival. The server owns both boards." }
      ] }
    ] },
```

**What and why:** A canvas node creates the 300 by 600 board with an aria-label and the name board, which app.js reads with $('board'). The aside box holds the status, stats, next-piece canvas, instructions, and the battle form: labelled inputs for name, room and server plus join, ready and leave buttons and the rival canvas. Every field the code reads has a name.

**Try it / expected result:** Change the Room default from NORD to LAB and reload. The input starts with the new value without any change to app.js.

#### 4.3 — Footer and the best-score label

**Read:** `ui/menu.ui.json`, lines 52–57.

<!-- taught-source: jengatedris/ui/menu.ui.json:52-57 -->

**File: `ui/menu.ui.json`** (step 4.3, footer and the best-score label: the next part of this file; it goes **below** the code of the previous step)
```json
    { "type": "box", "tag": "footer", "children": [
      { "type": "label", "tag": "span", "text": "Original game · Crowelian 2026 + Sonnet · Best grid score:" },
      { "name": "best", "type": "label", "tag": "b" }
    ] }
  ] }
}
```

**What and why:** The footer is a box with the credit text and a label named best. The game writes the best grid score into it with textContent. Keeping dynamic values in named labels means the layout can change freely while the game keeps working.

**Try it / expected result:** Rename the footer text in the Designer and reload Play. The best score still appears because the node name is unchanged.


### 5. server.mjs {#walk-server-mjs}

Build the complete authoritative two-player room lifecycle.

#### 5.1 — Separate sessions, rooms and public snapshots

**Read:** `server.mjs`, lines 1–46.

<!-- taught-source: jengatedris/server.mjs:1-46 -->

**File: `server.mjs`** (step 5.1, separate sessions, rooms and public snapshots: the beginning of the file)
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
```

**What and why:** The factory receives port/root/clock so tests can use a controlled local server. Rooms hold two players and a phase; sessions locate one player by ID. snapshot chooses the output fields rather than returning arbitrary transport objects. attack translates multi-line clears into opponent garbage. finish computes the room result and clears ready flags for the next round.

**Try it / expected result:** Inspect a snapshot after a clear: both players should be present, but only server-applied rule changes should affect their boards.

#### 5.2 — Create rooms without exceeding capacity

**Read:** `server.mjs`, lines 47–70.

<!-- taught-source: jengatedris/server.mjs:47-70 -->

**File: `server.mjs`** (step 5.2, create rooms without exceeding capacity: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** Join validates capacity, normalizes the room name and creates waiting state only when needed. Each player gets a unique session ID, fresh grid, display name and activity/rate timestamps. The record is inserted in both room roster and session lookup before returning a snapshot. These maps solve different lookup problems.

**Try it / expected result:** Open a third browser in the same room. It should receive Room has two players rather than becoming an invisible third competitor.

#### 5.3 — Validate Ready and execute bounded intentions

**Read:** `server.mjs`, lines 71–100.

<!-- taught-source: jengatedris/server.mjs:71-100 -->

**File: `server.mjs`** (step 5.3, validate Ready and execute bounded intentions: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** Every later route resolves an existing session and refreshes activity. State returns a snapshot. Ready rejects an ongoing game, then starts only when both players have readied; both grids receive the same new seed. Action accepts a fixed vocabulary and rate limit, applies shared rules, sends attacks and evaluates the result. The client never supplies a replacement board.

**Try it / expected result:** Click Ready while playing and inspect the rejection. The existing round must not reset.

#### 5.4 — Expire sessions and advance both boards on one server clock

**Read:** `server.mjs`, lines 101–142.

<!-- taught-source: jengatedris/server.mjs:101-142 -->

**File: `server.mjs`** (step 5.4, expire sessions and advance both boards on one server clock: the next part of this file; it goes **below** the code of the previous step)
```js
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

**What and why:** The tick updates activity time, removes silent sessions after thirty seconds and returns a lone player to waiting. Empty rooms are deleted. Only playing rooms tick gravity, apply attacks and evaluate a result. serve receives an explicit client-file list, and the final direct-execution guard starts the server only when this module is the program entry point.

**Try it / expected result:** Close one client and wait for expiry. The remaining client should return to waiting and a new player should be able to take the seat.


### 6. server-kit.mjs {#walk-server-kit-mjs}

Read the entire package-free HTTP adapter shared by the game servers.

#### 6.1 — Create an HTTP response boundary

**Read:** `server-kit.mjs`, lines 1–39.

<!-- taught-source: jengatedris/server-kit.mjs:1-39 -->

**File: `server-kit.mjs`** (step 6.1, create an HTTP response boundary: the beginning of the file)
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
```

**What and why:** The imported Node modules handle sockets, files and paths. serve receives game-specific api/tick callbacks and an explicit public-file map. json writes a content type and disables caching before serializing the result. The origin branch permits same-origin clients and local Nord previews, while rejecting unrelated remote origins. This is a trusted-room development policy, not an account system.

**Try it / expected result:** Open the game through its Node server, then through Nord Play with the same Server address. Both supported origins should receive JSON.

#### 6.2 — Parse a bounded API message

**Read:** `server-kit.mjs`, lines 40–68.

<!-- taught-source: jengatedris/server-kit.mjs:40-68 -->

**File: `server-kit.mjs`** (step 6.2, parse a bounded API message: the next part of this file; it goes **below** the code of the previous step)
```js
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
```

**What and why:** OPTIONS answers a browser preflight before gameplay. API POST bodies must declare JSON, remain under 2048 bytes and parse as an object. GET is allowed for snapshots. Returning early for invalid input prevents malformed messages from reaching game rules. api returns either plain data or a status/data result, which the adapter normalizes through json.

**Try it / expected result:** Send an invalid action with the browser Network panel and inspect its HTTP status; distinguish transport validation from the game-specific unknown-action error.

#### 6.3 — Serve only named public files and own the tick

**Read:** `server-kit.mjs`, lines 69–103.

<!-- taught-source: jengatedris/server-kit.mjs:69-103 -->

**File: `server-kit.mjs`** (step 6.3, serve only named public files and own the tick: the next part of this file; it goes **below** the code of the previous step)
```js
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

**What and why:** The file map resolves URL paths to known project files; arbitrary requested disk paths are not joined directly. MIME types tell the browser how to load modules/styles. A catch turns failures into a 500 response. setInterval calls game rules every 50ms, close clears it, and optional port null makes tests control listening. failure and roomCode centralize error shape and safe room naming.

**Try it / expected result:** Request server.mjs in the browser URL. It should return Not found; the source is distributed through the archive rather than this static allowlist.


### 7. index.html {#walk-index-html}

Read the complete Nord page entry point and its failure path.

#### 7.1 — Load the local runtime and start the app

**Read:** `index.html`, lines 1–8.

<!-- taught-source: jengatedris/index.html:1-8 -->

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

**What and why:** The document declares encoding and viewport, creates the mount container and loads local code. The module imports mount from app.js and awaits initialization for the HTML-tier root. The ready/error flags are inspection signals used by browser checks; they are not a second simulation. The catch logs and exposes initialization errors. The page is served over HTTP so local module and asset URLs resolve consistently.

**Try it / expected result:** Temporarily rename the imported main module on a copy and reopen Play. Inspect the Console/error path, then restore the correct name.


### 8. nord.project.json {#walk-nord-project-json}

Read every project field that tells Nord which host, display and services to use.

#### 8.1 — Identify the project and choose its presentation

**Read:** `nord.project.json`, lines 1–22.

<!-- taught-source: jengatedris/nord.project.json:1-22 -->

**File: `nord.project.json`** (step 8.1, identify the project and choose its presentation: the beginning of the file)
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
```

**What and why:** format and engineVersion identify the serialized contract, while name/id give human and stable application identity. type chooses the host; startScene is used by a scene backend and is empty for these HTML apps. Display fields request dimensions, fit behaviour, pixel-art treatment and background. Physics selects a runtime engine; the rail shooter uses custom rules with none, while HTML-hosted libraries are initialized in their own modules.

**Try it / expected result:** Change only the display title/name in a copy and reopen the project. Do not change the stable ID casually if you want to keep the same save namespace.

#### 8.2 — Distinguish scene actions from HTML event handling

**Read:** `nord.project.json`, lines 23–64.

<!-- taught-source: jengatedris/nord.project.json:23-64 -->

**File: `nord.project.json`** (step 8.2, distinguish scene actions from HTML event handling: the next part of this file; it goes **below** the code of the previous step)
```json
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

**What and why:** The input object maps action names to keyboard codes for Nord scene scripts. Vector Patrol reads these through this.input. HTML-tier hosts in the other projects read their own DOM events, so editing this action table alone does not rewrite those handlers. plugins/ui declare ordinary scene services and skin/theme; any remaining desktop configuration is the native capability contract rather than a browser CORS override.

**Try it / expected result:** For Vector Patrol, add a second fire key and test it. For an HTML app, locate its key handler instead of expecting this table to change DOM input.


### 9. style.css {#walk-style-css}

Read every stylesheet rule, grouped by the UI responsibility it controls.

#### 9.1 — Set the app foundation and reusable visual language

**Read:** `style.css`, lines 1–44.

<!-- taught-source: jengatedris/style.css:1-44 -->

```css
:host {
  display: block;
  min-height: 100vh;
  color: #d8e8ef;
  font: 16px system-ui;
}
* {
  box-sizing: border-box;
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
```

**What and why:** The opening rules give the host element (:host, the page root that holds the UI) its colour, font and minimum height; the document background and margin come from the body block of the UI file, apply border-box sizing, reset margins and choose system typography. Header, heading and basic control rules establish the app’s hierarchy and affordances. Keeping this local avoids remote font or stylesheet dependencies. The sheet is linked from inside the UI file's shadow root, so selectors such as main, nav and #status match the nodes you named there.

**Try it / expected result:** Change one accent colour on a copy and reopen Play; no gameplay or saved-document data should change.

#### 9.2 — Lay out board and previews

**Read:** `style.css`, lines 45–80.

<!-- taught-source: jengatedris/style.css:45-80 -->

```css
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
```

**What and why:** Flex layout keeps board and sidebar together; canvas rules preserve crisp pixels without changing internal canvas dimensions. Sidebar/label/input rules establish readable configuration controls.

**Try it / expected result:** Resize slowly and compare CSS display size with the fixed canvas.width used by rendering.

#### 9.3 — Clear auxiliary content and stack on narrow screens

**Read:** `style.css`, lines 81–94.

<!-- taught-source: jengatedris/style.css:81-94 -->

```css
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

**What and why:** The rival float is cleared before footer text. The media query changes the layout direction and page padding for small windows rather than altering grid width or physics coordinates.

**Try it / expected result:** Narrow below 620 pixels. The sidebar should move below the board while the rules still use ten columns.

<!-- END GENERATED FILE WALKTHROUGH -->

## Complete project source

The archive contains every file needed for the complete local game and Node battle, including the pinned physics bundle and licences. Below are all authored game, server, page, configuration and style files in the manual's local CodeMirror viewer. Copy the complete files when following from an empty project; the smaller excerpts above explain the decisions.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

<details>
<summary>Complete app.js</summary>

**File: `style.css`** (step 9.3, clear auxiliary content and stack on narrow screens: the next part of this file; it goes **below** the code of the previous step)
```js
import { newGrid, cells, ghost, COLORS, action, tickGrid, SHAPES } from './rules.js';
import { createChaos } from './chaos.js';
import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
  // Layout, text and fields live in ui/menu.ui.json (edit it in the UI Designer); this file only wires them up.
  const menu = await createUI(root).load('ui/menu.ui.json');
  // $('name') = the real DOM element of a node you named in the UI file
  const $ = (id) => menu.$(id).el,
    canvas = $('board'),
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
    if (menu.typing) return;
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
    menu.destroy();
  };
}
```

</details>

<details>
<summary>Complete chaos.js</summary>

**File: `style.css`** (step 9.3, clear auxiliary content and stack on narrow screens: the next part of this file; it goes **below** the code of the previous step)
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

**File: `style.css`** (step 9.3, clear auxiliary content and stack on narrow screens: the next part of this file; it goes **below** the code of the previous step)
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

**File: `style.css`** (step 9.3, clear auxiliary content and stack on narrow screens: the next part of this file; it goes **below** the code of the previous step)
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

**File: `style.css`** (step 9.3, clear auxiliary content and stack on narrow screens: the next part of this file; it goes **below** the code of the previous step)
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

**File: `style.css`** (step 9.3, clear auxiliary content and stack on narrow screens: the next part of this file; it goes **below** the code of the previous step)
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
:host {
  display: block;
  min-height: 100vh;
  color: #d8e8ef;
  font: 16px system-ui;
}
* {
  box-sizing: border-box;
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

<details>
<summary>Complete ui/menu.ui.json</summary>

**File: `style.css`** (step 9.3, clear auxiliary content and stack on narrow screens: the next part of this file; it goes **below** the code of the previous step)
```json
{
  "version": 1,
  "name": "menu",
  "page": true,
  "styles": [
    "style.css"
  ],
  "body": {
    "margin": "0",
    "background": "#0a1522"
  },
  "root": { "type": "box", "tag": "main", "name": "root", "children": [
    { "type": "box", "tag": "h1", "children": [
      { "type": "label", "tag": "span", "text": "JengaTedris" },
      { "type": "label", "tag": "small", "text": "GRID / TOPPLE / BATTLE" }
    ] },
    { "type": "box", "tag": "nav", "children": [
      { "name": "grid", "type": "button", "text": "Grid run" },
      { "name": "chaos", "type": "button", "text": "Physics tower" },
      { "name": "pause", "type": "button", "text": "Pause / Resume" },
      { "name": "restart", "type": "button", "text": "Restart" }
    ] },
    { "class": "layout", "type": "box", "tag": "section", "children": [
      { "type": "canvas", "w": 300, "h": 600, "attrs": {"aria-label": "Game board"}, "name": "board" },
      { "type": "box", "tag": "aside", "children": [
        { "name": "status", "type": "label", "tag": "h2" },
        { "name": "stats", "type": "label", "tag": "p" },
        { "name": "next", "type": "canvas", "w": 200, "h": 160 },
        { "type": "label", "tag": "p", "text": "Grid: arrows move/down, ↑ rotate, Space drop, C hold. Clear 20 rows!" },
        { "type": "label", "tag": "p", "text": "Physics: ← → push, Q / E rotate, ↓ slam. Survive 18 rigid pieces; no row clears." },
        { "type": "label", "tag": "h2", "text": "Battle a friend" },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Name" },
          { "name": "name", "type": "input", "value": "Builder", "maxlength": "20" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Room" },
          { "name": "room", "type": "input", "value": "NORD", "maxlength": "8" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Server" },
          { "name": "server", "type": "input" }
        ] },
        { "name": "join", "type": "button", "text": "Join battle" },
        { "name": "ready", "type": "button", "text": "Ready / Rematch" },
        { "name": "leave", "type": "button", "text": "Leave battle" },
        { "name": "network", "type": "label", "tag": "p", "text": "Start node server.mjs for multiplayer. Same room, two browsers, both Ready." },
        { "name": "rival", "type": "canvas", "w": 150, "h": 300 },
        { "type": "label", "tag": "p", "text": "Two or more cleared rows send garbage to your rival. The server owns both boards." }
      ] }
    ] },
    { "type": "box", "tag": "footer", "children": [
      { "type": "label", "tag": "span", "text": "Original game · Crowelian 2026 + Sonnet · Best grid score:" },
      { "name": "best", "type": "label", "tag": "b" }
    ] }
  ] }
}
```

</details>
