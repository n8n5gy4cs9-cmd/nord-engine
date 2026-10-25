---
title: T41 Nord Engine Office — interns, bugs and AI
section: Tutorials
order: 41
summary: Build a multiplayer office game with JavaScript puzzles, wiring, coffee timing, pranks, Node authority and a pathfinding AI coworker.
---


Build an original cooperative chaos game set inside the Nord Engine office. Walk around desks, repair wiring, diagnose actual JavaScript mistakes, time the coffee machine, and ship twelve fixes before the shift ends. Browser friends can help as interns or introduce new bugs. A pathfinding AI coworker can fill an empty seat.

**Download:** [Complete Nord Engine Office game and source](assets/downloads/nord-office-source.zip). Unzip into a writable folder, open `nord.project.json` in Nord and press **Play**. The project uses Nord's **HTML tier**, a canvas view and ordinary JavaScript modules. Solo practice runs entirely in the browser. The included Node server adds shared rooms for up to six human players. No API key, npm install or external art is needed.

![Office game with a JavaScript repair task](assets/screenshots/ed-office-task.png)

**Full-code learning route:** After the orientation below, continue to [the complete file-by-file walkthrough](#file-walkthrough). It teaches every main project file in consecutive sections, with the actual code, an explanation of what and why, and a change to try. The expandable complete files at the end are a reference, not the lesson.

## 1. Play one shift before editing

Click **Start / Restart shift**. Use WASD or arrows to walk. Red stations need work; green stations are fixed. Press E near an unclaimed red station to open its task. Escape or Cancel releases it. Walking too far away also cancels work, so you cannot repair a rack from across the room.

There are three minigames:

- **Wire:** click three coloured terminals in the displayed order. A wrong terminal costs morale and releases the task.
- **Bug:** read a short JavaScript line and choose the correct fix. The examples cover array bounds, assignment versus comparison, and milliseconds versus seconds.
- **Coffee:** stop the repeating fill between 55% and 85%. The game clock decides success, including in multiplayer.

Finish twelve tasks within 150 seconds. New faults appear every nine seconds, and unresolved tickets steadily drain morale. Correct repairs restore morale. X introduces a bug at a nearby fixed station, costs morale and has a 15-second cooldown. Use this as playful chaos with friends; excessive pranking can lose the shift.

Ada, the AI coworker, navigates the office, claims tickets and completes work after arriving. Toggle her off for a human-only room or on for help. She is a deterministic local game agent, not a cloud language model. Her work still uses a real station and its ownership rules.

## 2. Find the whole project in Nord

Open these files from the Assets panel in Nord's editor:

| File | What it owns |
| --- | --- |
| `rules.js` | Map, collision, movement, tasks, morale, shift rules and AI |
| `ui/office.ui.json` | Page layout, text and form fields, edited in the UI Designer |
| `lib/nord-ui.js` | The Nord UI runtime that builds the UI file |
| `app.js` | Canvas rendering, keyboard, task UI, solo loop and network client |
| `server.mjs` | Authoritative rooms, sessions, input expiry and host controls |
| `server-kit.mjs` | Node HTTP transport, JSON parsing and static allowlist |
| `style.css` | Page layout and task controls |
| `index.html` | Generated mount entry point |
| `nord.project.json` | Nord HTML project and export identity |

Change the opening description in `ui/office.ui.json` (or the UI Designer), then stop and start Play. Open the Console if a syntax error prevents the page mounting. This project has no engine Scene hierarchy because the HTML tier owns its application lifecycle through `mount(root)`; the canvas map is the game's one level. For scene-based 2D/3D scripting and `game.restart()`, see T33, T34 and T39. Here Start/Restart replaces the shift's data and leaves the page and connections alive.

## 3. Build a tile grid with meaningful stations

`MAP` is an array of equal-length strings. Each character is one tile: `#` is wall, `D` is desk, dots are floor, and letters identify work areas. The canvas uses 32 pixels per tile, but simulation positions are measured in tiles. Keeping these units separate prevents movement from changing when you resize the canvas.

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
```js
const screenX = player.x * 32;
const screenY = player.y * 32;
```

`walkable(x, y)` reads the relevant tile and rejects walls, desks and coordinates outside the map. `movePlayer()` normalizes input, scales it by speed and elapsed seconds, and tests the player's small radius at the candidate position. X and Y move separately so the player slides along a desk rather than getting stuck on it. This game needs no rigid-body physics.

Stations are data entries with a name, position, kind, broken flag and owner. The tile drawing and job list refer to the same entries. Changing a station's location therefore changes both the visible marker and interaction distance.

**Learning check:** add a desk away from a spawn and try walking into it. Move the coffee station in both its map marker and `JOBS` entry, then confirm its red interaction ring follows the new job coordinates. Keep routes open so the AI and humans can reach every station.

## 4. Define a shift as fresh state

`newOffice()` creates jobs, players, score, morale, timers and a short office log. `startShift()` resets the run, positions players and marks the first three stations broken. It preserves the connected player roster so a multiplayer rematch does not require everyone to reconnect.

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
```js
const state = newOffice();
addPlayer(state, 'solo', 'You');
addPlayer(state, 'ai', 'Ada (AI)', true);
startShift(state);
```

`tickOffice(state, dt)` advances the rules. It moves players, progresses AI work, creates timed faults, drains morale and checks victory or failure. Time is capped per simulation step so returning from a suspended browser tab does not perform one enormous movement step. Solo pauses on blur; an online server continues the shared shift independently of a client's focus.

The phase is one of lobby, playing, won or lost. The UI derives its message from that phase. Do not create a second unrelated `gameOver` flag in the drawing code: duplicated state leads to a visible win screen while the server still accepts repairs.

## 5. Claim tasks and validate their results

`beginJob()` checks the phase, distance, broken flag and owner. A player can hold only one task, and a station can belong to only one player. This avoids two interns scoring the same repair simultaneously.

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
```js
if (!job.broken || job.owner || !nearby(player, job)) return false;
job.owner = player.id;
```

A wire task stores its sequence and step. The client displays the sequence; each click submits a terminal index. Only the correct next index advances the step. The third correct choice completes the job. A bug task chooses from `PUZZLES`; its expected answer stays in the shared rules so solo and server use identical decisions.

Coffee stores when the task began. The fill is `(time - began) % 2.4 / 2.4`. The client animates this value, while the rule checks whether it is in the green interval when Pour arrives. Polling latency makes online coffee a little less precise than solo; the broad green zone is deliberate. The client sends a pour intention, not a success boolean.

Completion clears the broken flag and owner, increases team score and the worker's completed count, restores morale and writes a log entry. At twelve fixes the phase becomes won. Wrong answers cost five morale and cancel the task. Distance cancellation releases ownership so another player can work there.

**Learning check:** give the array-bounds puzzle a wrong answer, verify no score is awarded, then try the right answer. Start a wire task, walk away and return: it should be available again. With two players, claim the same station and verify only one receives it.

## 6. Make the office chaotic without random movement bugs

Every nine seconds the server chooses a currently fixed station and breaks it. Existing broken jobs are not replaced mid-task. Morale drains in proportion to the number of open tickets, so unattended work has a clear cost.

Pranks require a nearby fixed station, no active task and an expired cooldown. A prank creates a real new ticket rather than merely changing its colour. Its morale cost and cooldown are rule values, so every client sees the same consequence.

Try changing `goal` from 12 to 8 for a shorter test shift. Keep the 150-second duration while learning, then tune it after playing with friends. A meaningful difficulty change alters ticket pressure, travel time or task complexity, not just label text. The supplied game is deliberately small: one office, five stations and three repair types, all fully implemented.

## 7. Give the AI a real route

Ada chooses an unclaimed broken station, finds a path and walks there at the same movement speed as humans. The pathfinder is a breadth-first search over walkable tile centres. It records the preceding tile and reconstructs a route when it reaches the target.

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
```js
const route = pathTo(ai, targetJob);
const waypoint = route[0];
if (waypoint) movePlayer(ai, waypoint[0] - ai.x, waypoint[1] - ai.y, dt);
```

When close enough, Ada uses `beginJob()` and owns that station. She completes it after 2.5 seconds of local work. This is an explicit bot shortcut for the minigame, not a claim that the bot reads and reasons about JavaScript. It keeps the companion useful while leaving the visible puzzles to humans.

Toggle AI off while a task is claimed and verify the station is released. Add an obstacle and watch Ada route around it. If the bot cannot reach a station, check the map first: BFS cannot solve a blocked room. No API calls, tokens, downloaded model or account are involved.

## 8. Host browser friends with Node

Open a terminal inside the extracted project and run:

**Terminal** (in the project folder, or the folder named in the text above):
```sh
node server.mjs
```

Use Node 22 or newer. Open the printed address in two browsers. Set names, choose the same room, and click Join online office. The first human is host and clicks Start. Other players can join a running shift; their avatar appears at the office spawn. Up to six humans share a room with optional Ada.

The default port is 4383. Override it with `PORT=4483 node server.mjs` and enter the printed address in each page's Server field. Nord Play may run on another port; local HTTP preview requests are supported. Opening the Node-served page is the simplest same-origin setup.

To invite trusted LAN friends:

**Terminal** (in the project folder, or the folder named in the text above):
```sh
HOST=0.0.0.0 node server.mjs
```

Share the host's LAN address and port, and have everyone use that address in Server and the same room code. Their `localhost` refers to their own computer. Allow the chosen host port through the firewall if necessary. This memory-only teaching server has no account system or durable storage. Internet hosting requires a proper HTTPS/authentication/origin deployment; static HTML hosting alone cannot run Node.

![Two connected interns and the AI in one shared office](assets/screenshots/ed-office-online.png)

## 9. Send intentions and keep authority on the server

The browser sends input axes about ten times per second:

**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):
```js
await fetch(server + '/api/input', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: sessionId, dx: 1, dy: 0 })
});
```

The server clamps axes and advances movement on its own 50ms tick. Clients do not send positions, score, morale or task-completed flags. Every player reads snapshots of the same room. This is a simple polling implementation with no prediction, so expect visible network steps; interpolation is a useful later exercise.

If no fresh input arrives for 350ms, the server zeros that player's axes. If a session is inactive for 30 seconds, it releases any claimed task and removes the player. When the host leaves, another human becomes host. Empty rooms are removed. These rules prevent stuck movement and permanently locked tasks after a browser closes.

Only the host can restart the shared shift or toggle Ada. Restart clears jobs, score, timers and player work while retaining the room roster. Solo's Pause button does not pause an online room for everyone. If Node restarts, its rooms disappear: rejoin and start a new shift.

The HTTP helper limits JSON body size, checks request shape and serves an explicit file allowlist. It does not expose arbitrary disk paths or Node source as a static download. The full server source is available in the tutorial archive instead. This is trusted-room educational code; session identifiers are not a production login system.

## 10. Learn from the source research

The repository's `docs/RESEARCH_GAME_TUTORIALS.md` records deep inspection of the requested GitHub sources, with pinned revisions and exact file citations. The office game is an original design: no source for an office game was supplied, so it does not pretend to be a port of one. The useful shared lessons are explicit state machines, one owner for a transition, separating display from rules, and treating unfinished network declarations as different from working multiplayer.

For example, Kirpich's active-piece geometry and staged lock/clear transitions demonstrate why a render call must not be the only authority over game state. In this office, the analogous transition is task ownership → validated repair → score. The browser can display the interaction; the shared rules decide its outcome.

## 11. Verify and export the complete game

Test movement against desks and walls, near/far interactions, wrong and correct puzzle answers, coffee timing, task cancellation, prank cooldown, AI routing, morale loss, victory and restart. In two browsers verify that both see movement, ownership, score and the same result. Stop Node to test connection-error messages, then restart it and rejoin. The repository browser tests cover real keyboard movement, task clicks, pranks, AI completion and two-client snapshots; rule tests cover both win and loss and HTTP host restrictions.

Export the client using Nord's HTML target and serve it over HTTP. Solo practice remains entirely local and offline. Keep the downloaded `server.mjs`, `server-kit.mjs`, `rules.js`, `index.html`, `app.js`, `ui/office.ui.json`, `lib/nord-ui.js` and `style.css` together to host multiplayer. The server serves its own client files; it is a separate running process from the static export.

A useful next feature is interpolation between snapshots. Keep the last two server positions in a view-only structure and blend their screen coordinates; leave collisions and task distance authoritative. Another is adding a fourth puzzle type: define its state in `rules.js`, add its DOM controls in `app.js`, and test success, failure and cancellation before increasing the number of stations.

<!-- GENERATED FILE WALKTHROUGH -->

## Walk through every project file {#file-walkthrough}

Work through these files in order using your downloaded project in Nord. Each numbered part shows the **next consecutive lines** of that file, not a selection of highlights. Read the explanation before changing anything. Edit the existing code in place; do not append another copy of a function. Finish one experiment, observe its result, and undo that change before moving on. The complete files and download at the end remain your reference.

The walkthrough covers the app/game modules, shared helpers used by them, page, styles and project configuration. Binary art/audio/models and minified vendor dependencies are resources rather than lessons in their internal implementation; their paths and contracts are explained where the app uses them.

| File | What you will build or understand |
| --- | --- |
| [rules.js](#walk-rules-js) | Build all office rules: map, players, movement, tasks, pranks, pathfinding and shift results. |
| [app.js](#walk-app-js) | Connect every HTML control, puzzle panel, canvas layer and polling path to the shared office rules. |
| [ui/office.ui.json](#walk-ui-office-ui-json) | Describe the office page as data: title, four controls, map canvas, task panel, the online form with tickets and log, and the footer. |
| [server.mjs](#walk-server-mjs) | Implement the complete room API, host controls and stale-input safety. |
| [server-kit.mjs](#walk-server-kit-mjs) | Read the entire package-free HTTP adapter shared by the game servers. |
| [index.html](#walk-index-html) | Read the complete Nord page entry point and its failure path. |
| [nord.project.json](#walk-nord-project-json) | Read every project field that tells Nord which host, display and services to use. |
| [style.css](#walk-style-css) | Read every stylesheet rule, grouped by the UI responsibility it controls. |

### 1. rules.js {#walk-rules-js}

Build all office rules: map, players, movement, tasks, pranks, pathfinding and shift results.

#### 1.1 — Use readable map and station data

**Read:** `rules.js`, lines 1–43.

<!-- taught-source: nord-office/rules.js:1-43 -->

**File: `rules.js`** (step 1.1, use readable map and station data: the beginning of the file)
```js
// Shared simulation: Node advances online rooms; the browser advances solo practice.
export const MAP = [
  '########################',
  '#......................#',
  '#..DD....DD....DD......#',
  '#..DD....DD....DD......#',
  '#......................#',
  '#......................#',
  '#..W......B......C.....#',
  '#......................#',
  '#......................#',
  '#..DD....DD....DD......#',
  '#..DD....DD....DD......#',
  '#......................#',
  '#.....T........E.......#',
  '#......................#',
  '#......................#',
  '########################',
];
export const JOBS = [
  { name: 'Rewire build rack', x: 3, y: 6, kind: 'wire' },
  { name: 'Fix viewport bug', x: 10, y: 6, kind: 'bug' },
  { name: 'Brew emergency coffee', x: 17, y: 6, kind: 'coffee' },
  { name: 'Repair failing tests', x: 6, y: 12, kind: 'bug' },
  { name: 'Patch HTML exporter', x: 15, y: 12, kind: 'wire' },
];
export const PUZZLES = [
  {
    log: 'for (let i=0; i<=rows.length; i++) draw(rows[i]);',
    choices: ['Change <= to <', 'Delete draw', 'Set i to -1'],
    answer: 0,
  },
  {
    log: 'if (health = 0) gameOver();',
    choices: ['Set health to 100', 'Use health === 0', 'Remove gameOver'],
    answer: 1,
  },
  {
    log: 'const dt = milliseconds; x += speed * dt;',
    choices: ['Double speed', 'Multiply dt by 1000', 'Divide dt by 1000'],
    answer: 2,
  },
];
```

**What and why:** Each map string is one row; matching widths keep indexing predictable. Walls/desks are collision tiles, while JOBS supplies the station name, location and puzzle kind. PUZZLES stores a visible faulty JavaScript line, answer choices and the expected index. The three mistakes are off-by-one iteration, assignment versus equality and milliseconds versus seconds. These are data interpreted by rules/UI, not executable snippets from a remote player.

**Try it / expected result:** Count one map row and move a station on a copy. Keep JOBS coordinates and the corresponding visible marker consistent.

#### 1.2 — Create fresh jobs and players

**Read:** `rules.js`, lines 44–81.

<!-- taught-source: nord-office/rules.js:44-81 -->

**File: `rules.js`** (step 1.2, create fresh jobs and players: the next part of this file; it goes **below** the code of the previous step)
```js
export function newOffice() {
  return {
    players: [],
    jobs: JOBS.map((j, i) => ({
      ...j,
      id: i,
      broken: i < 3,
      owner: null,
      work: 0,
      version: 0,
    })),
    time: 0,
    nextFault: 9,
    score: 0,
    morale: 100,
    phase: 'lobby',
    bot: true,
    goal: 12,
    duration: 150,
    log: ['Welcome to Nord Engine Office. Finish 12 jobs in 150 seconds.'],
  };
}
export function addPlayer(s, id, name, bot = false) {
  const p = {
    id,
    name: String(name || 'Intern').slice(0, 20),
    x: 11.5,
    y: 8.2 + s.players.filter((p) => !p.bot).length * 0.35,
    dx: 0,
    dy: 0,
    bot,
    job: null,
    prank: 0,
    done: 0,
  };
  s.players.push(p);
  return p;
}
```

**What and why:** JOBS.map copies definitions into mutable run records, so completing a job does not alter the global station catalogue. owner/work/version are runtime fields. Team score/morale/time/phase belong to the shift; each player owns position, intended direction, active job, prank cooldown and completion count. Names are length-limited at the boundary.

**Try it / expected result:** Start two fresh state objects and complete a task in one. The other state and the JOBS definitions should remain unchanged.

#### 1.3 — Reset a run without disconnecting the roster

**Read:** `rules.js`, lines 82–104.

<!-- taught-source: nord-office/rules.js:82-104 -->

**File: `rules.js`** (step 1.3, reset a run without disconnecting the roster: the next part of this file; it goes **below** the code of the previous step)
```js
export function startShift(s) {
  s.phase = 'playing';
  s.time = 0;
  s.score = 0;
  s.morale = 100;
  s.nextFault = 9;
  s.log = ['Shift started! E near a station to work.'];
  for (const j of s.jobs) {
    j.broken = j.id < 3;
    j.owner = null;
    j.work = 0;
    j.version++;
  }
  for (const p of s.players) {
    p.x = 11.5;
    p.y = 8.5;
    p.job = null;
    p.dx = 0;
    p.dy = 0;
    p.prank = 0;
    p.done = 0;
  }
}
```

**What and why:** The reset changes phase, clocks, score, morale and log, then restores stations and player work. It preserves player IDs/names and the room roster so an online rematch does not require joining again. Incrementing job version changes the next puzzle sequence. This reset is app-specific state replacement, not Nord scene reload.

**Try it / expected result:** Restart a shared shift. Both human names should remain, while their jobs, scores and positions return to the opening state.

#### 1.4 — Move a small body through a tile grid

**Read:** `rules.js`, lines 105–118.

<!-- taught-source: nord-office/rules.js:105-118 -->

**File: `rules.js`** (step 1.4, move a small body through a tile grid: the next part of this file; it goes **below** the code of the previous step)
```js
export function walkable(x, y) {
  const cell = MAP[Math.floor(y)]?.[Math.floor(x)];
  return cell !== undefined && cell !== '#' && cell !== 'D';
}
export function movePlayer(p, dx, dy, dt) {
  const n = Math.max(1, Math.hypot(dx, dy));
  dx = (dx / n) * 3.3 * dt;
  dy = (dy / n) * 3.3 * dt;
  const fits = (x, y) =>
    [-0.22, 0.22].every((a) => [-0.22, 0.22].every((b) => walkable(x + a, y + b)));
  if (fits(p.x + dx, p.y)) p.x += dx;
  if (fits(p.x, p.y + dy)) p.y += dy;
}
export const nearby = (p, j) => Math.hypot(p.x - (j.x + 0.5), p.y - (j.y + 0.5)) < 1.5;
```

**What and why:** walkable floors fractional coordinates and treats out-of-map positions as blocked. movePlayer normalizes diagonals before multiplying by speed and seconds. Testing four corner offsets gives the player width rather than a point collision. X and Y are accepted independently so motion can slide along a desk. nearby uses station centres with half-tile offsets.

**Try it / expected result:** Hold two directions diagonally and compare speed with straight movement. You should not gain a square-root-of-two speed bonus.

#### 1.5 — Claim and cancel work without duplicate owners

**Read:** `rules.js`, lines 119–151.

<!-- taught-source: nord-office/rules.js:119-151 -->

**File: `rules.js`** (step 1.5, claim and cancel work without duplicate owners: the next part of this file; it goes **below** the code of the previous step)
```js
function note(s, text) {
  s.log.unshift(text);
  s.log.length = Math.min(6, s.log.length);
}
export function beginJob(s, p, id) {
  if (s.phase !== 'playing' || p.job) return false;
  const j = s.jobs.find((v) => v.id === id);
  if (!j?.broken || j.owner || !nearby(p, j)) return false;
  j.owner = p.id;
  j.work = 0;
  p.job = {
    id,
    step: 0,
    puzzle: j.version % PUZZLES.length,
    sequence: [
      (j.id + j.version) % 4,
      (j.id + j.version + 2) % 4,
      (j.id + j.version + 1) % 4,
    ],
    began: s.time,
  };
  return true;
}
export function cancelJob(s, p) {
  if (p.job) {
    const j = s.jobs[p.job.id];
    if (j.owner === p.id) {
      j.owner = null;
      j.work = 0;
    }
    p.job = null;
  }
}
```

**What and why:** note keeps a newest-first bounded log. beginJob checks phase, existing work, station state, owner and distance before claiming it. The player job records progress, a puzzle index, deterministic wire sequence and a start time. cancelJob releases the station only if this player still owns it, then clears local work. These ownership checks prevent simultaneous repairs from counting twice.

**Try it / expected result:** Have two humans press E at the same red station. Only one should claim it; cancel that task and let the other claim it.

#### 1.6 — Complete exactly one job and validate the next step

**Read:** `rules.js`, lines 152–181.

<!-- taught-source: nord-office/rules.js:152-181 -->

**File: `rules.js`** (step 1.6, complete exactly one job and validate the next step: the next part of this file; it goes **below** the code of the previous step)
```js
function complete(s, p) {
  const j = s.jobs[p.job.id];
  j.broken = false;
  j.owner = null;
  j.work = 0;
  j.version++;
  s.score++;
  p.done++;
  s.morale = Math.min(100, s.morale + 7);
  note(s, `${p.name} completed: ${j.name}`);
  p.job = null;
  if (s.score >= s.goal) s.phase = 'won';
}
export function jobStep(s, p, value) {
  if (s.phase !== 'playing' || !p.job) return false;
  const j = s.jobs[p.job.id];
  if (!nearby(p, j)) {
    cancelJob(s, p);
    return false;
  }
  let ok = false;
  if (j.kind === 'wire') {
    ok = value === p.job.sequence[p.job.step];
    if (ok && ++p.job.step < 3) return true;
  }
  if (j.kind === 'bug') ok = value === PUZZLES[p.job.puzzle].answer;
  if (j.kind === 'coffee') {
    const fill = ((s.time - p.job.began) % 2.4) / 2.4;
    ok = fill >= 0.55 && fill <= 0.85;
  }
```

**What and why:** complete clears the fault/owner, increments team and worker counts, restores bounded morale and changes the version before testing victory. jobStep rejects inactive/distant work. Wire tasks compare the next terminal and return early until the final correct input; bug tasks compare one answer; coffee computes elapsed fill from the simulation clock. The client supplies a choice, not a success flag.

**Try it / expected result:** Choose one wrong wire terminal and confirm no score is awarded. Then repair correctly and check team score increases by exactly one.

#### 1.7 — Resolve failure and deliberately introduce faults

**Read:** `rules.js`, lines 182–202.

<!-- taught-source: nord-office/rules.js:182-202 -->

**File: `rules.js`** (step 1.7, resolve failure and deliberately introduce faults: the next part of this file; it goes **below** the code of the previous step)
```js
  if (ok) {
    complete(s, p);
    return true;
  }
  s.morale = Math.max(0, s.morale - 5);
  note(s, `${p.name}: wrong fix — morale -5`);
  cancelJob(s, p);
  return false;
}
export function prank(s, p) {
  if (s.phase !== 'playing' || p.prank > 0 || p.job) return false;
  const j = s.jobs.find((j) => !j.broken && nearby(p, j));
  if (!j) return false;
  j.broken = true;
  j.version++;
  p.prank = 15;
  s.morale = Math.max(0, s.morale - 8);
  note(s, `${p.name} introduced a bug at ${j.name}!`);
  return true;
}
// BFS over tile centres makes the coworker navigate around desks, not teleport through them.
```

**What and why:** A successful step calls complete. A wrong fix costs morale, logs the outcome and releases ownership so work can be retried. prank requires playing state, no current job, no cooldown and a nearby fixed station. It makes a real fault, advances its version, starts a cooldown and costs team morale. This keeps pranks inside the same job/morale model as normal faults.

**Try it / expected result:** Prank a green station twice rapidly. Only the first should succeed, and its colour should change because broken state changed.

#### 1.8 — Search breadth-first through tile centres

**Read:** `rules.js`, lines 203–233.

<!-- taught-source: nord-office/rules.js:203-233 -->

**File: `rules.js`** (step 1.8, search breadth-first through tile centres: the next part of this file; it goes **below** the code of the previous step)
```js
export function pathTo(p, j) {
  const start = [Math.floor(p.x), Math.floor(p.y)],
    goal = [j.x, j.y],
    q = [start],
    prev = new Map([[start.join(','), null]]);
  let found = null;
  for (let i = 0; i < q.length; i++) {
    const v = q[i];
    if (v[0] === goal[0] && v[1] === goal[1]) {
      found = v;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = [v[0] + dx, v[1] + dy],
        k = n.join(',');
      if (!prev.has(k) && walkable(n[0] + 0.5, n[1] + 0.5)) {
        prev.set(k, v);
        q.push(n);
      }
    }
  }
  if (!found) return [];
  const out = [];
  for (let v = found; v; v = prev.get(v.join(','))) out.unshift([v[0] + 0.5, v[1] + 0.5]);
  return out.slice(1);
}
```

**What and why:** The queue starts at the player tile and prev records visited cells plus their parent. Each tile expands four axis neighbours. Because every step has equal cost, the first reached goal gives a shortest tile path. The visited Map prevents loops. Reconstructing parents walks backward, unshift reverses that order, and slice(1) removes the already occupied starting tile.

**Try it / expected result:** Put a desk on the direct route in a copy. Ada should take a longer walkable path, not move through the desk.

#### 1.9 — Give the AI the same movement and ownership rules

**Read:** `rules.js`, lines 234–264.

<!-- taught-source: nord-office/rules.js:234-264 -->

**File: `rules.js`** (step 1.9, give the AI the same movement and ownership rules: the next part of this file; it goes **below** the code of the previous step)
```js
export function tickOffice(s, dt) {
  if (s.phase !== 'playing') return;
  dt = Math.min(0.1, dt);
  s.time += dt;
  for (const p of s.players) {
    p.prank = Math.max(0, p.prank - dt);
    if (p.bot) {
      if (p.job) {
        const j = s.jobs[p.job.id];
        j.work += dt;
        if (j.work >= 2.5) complete(s, p);
      } else {
        const target = s.jobs
          .filter((j) => j.broken && !j.owner)
          .sort(
            (a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y),
          )[0];
        if (target) {
          if (nearby(p, target)) beginJob(s, p, target.id);
          else {
            const waypoint = pathTo(p, target)[0];
            if (waypoint) movePlayer(p, waypoint[0] - p.x, waypoint[1] - p.y, dt);
          }
        }
      }
    } else {
      movePlayer(p, p.dx, p.dy, dt);
      if (p.job && !nearby(p, s.jobs[p.job.id])) cancelJob(s, p);
    }
  }
  if (s.phase !== 'playing') return;
```

**What and why:** The playing guard freezes ended shifts. Each player cooldown decays. Ada either spends time on an owned job or selects the nearest unclaimed fault, uses nearby/beginJob on arrival, and otherwise follows the first BFS waypoint. Human movement uses stored intentions and cancels work when leaving range. The bot’s timed completion is an explicit shortcut for minigames, not a language model.

**Try it / expected result:** Turn Ada off mid-task and ensure her ownership is released, then turn her back on and observe a real walk to a fault.

#### 1.10 — Create pressure, end the shift and serialize a view

**Read:** `rules.js`, lines 265–289.

<!-- taught-source: nord-office/rules.js:265-289 -->

**File: `rules.js`** (step 1.10, create pressure, end the shift and serialize a view: the next part of this file; it goes **below** the code of the previous step)
```js
  if (s.time >= s.nextFault) {
    s.nextFault += 9;
    const j = s.jobs.find((j) => !j.broken);
    if (j) {
      j.broken = true;
      j.version++;
      note(s, `New ticket: ${j.name}`);
    }
  }
  s.morale = Math.max(0, s.morale - s.jobs.filter((j) => j.broken).length * dt * 0.32);
  if (s.time >= s.duration || s.morale <= 0) {
    s.phase = 'lost';
    note(s, 'Shift failed — start a new shift and try again.');
  }
}
export function publicOffice(s, id) {
  return {
    ...s,
    you: id,
    players: s.players.map((p) => ({
      ...p,
      job: p.job ? { ...p.job, puzzle: p.job.puzzle } : null,
    })),
  };
}
```

**What and why:** This second phase check occurs after player work, so a newly won shift is not immediately subjected to another fault/deadline. nextFault advances on schedule, a fixed station becomes broken, and open faults drain morale by elapsed seconds. Time/morale can lose the shift. publicOffice adds the requesting player ID and copies player/job records into a response shape.

**Try it / expected result:** Leave several faults unattended and compare morale drain with a nearly clean office. A won shift should stop accumulating new pressure.


### 2. app.js {#walk-app-js}

Connect every HTML control, puzzle panel, canvas layer and polling path to the shared office rules.

#### 2.1 — Imports, load the UI file and name the handles

**Read:** `app.js`, lines 1–36.

<!-- taught-source: nord-office/app.js:1-36 -->

**File: `app.js`** (step 2.1, imports, load the UI file and name the handles: the beginning of the file)
```js
import {
  MAP,
  JOBS,
  PUZZLES,
  newOffice,
  addPlayer,
  startShift,
  tickOffice,
  beginJob,
  jobStep,
  prank,
  cancelJob,
  nearby,
} from './rules.js';
import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
  // Layout, text and fields live in ui/office.ui.json (edit it in the UI Designer); this file only wires them up.
  const menu = await createUI(root).load('ui/office.ui.json');
  // $('name') = the DOM element with that id (null for ids made later in code, like the coffee meter)
  const $ = (id) => menu.shadow.getElementById(id),
    ctx = $('map').getContext('2d'),
    keys = new Set();
  let s = newOffice(),
    you = 'solo',
    online = false,
    paused = false,
    alive = true,
    last = performance.now(),
    poll = 0,
    busy = false,
    taskKey = '',
    status = '';
  addPlayer(s, you, 'You');
  addPlayer(s, 'ai', 'Ada (AI)', true);
  $('server').value =
    location.port === '4383' ? location.origin : 'http://127.0.0.1:4383';
```

**What and why:** Imports give the host access to the rules, helpers and the Nord UI runtime. mount is async because createUI(root).load fetches the UI file, links the stylesheet inside an isolated shadow root and builds every node before the first line of game code runs. The $ helper returns the real DOM element of a node you named in the file, so existing logic can keep using .value, .textContent and .onclick without searching the page. The map context and key set follow.

**Try it / expected result:** Open the UI file in the UI Designer, rename a node and reload Play. The Console should name the missing node on the first lookup instead of silently doing nothing; rename it back afterwards.

#### 2.2 — Use one command interface for local and online rules

**Read:** `app.js`, lines 37–75.

<!-- taught-source: nord-office/app.js:37-75 -->

**File: `app.js`** (step 2.2, use one command interface for local and online rules: the next part of this file; it goes **below** the code of the previous step)
```js
  const player = () => s.players.find((p) => p.id === you);
  const say = (t) => {
    $('network').textContent = t;
  };
  async function request(route, body) {
    const res = await fetch($('server').value.replace(/\/$/, '') + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || res.status);
    return data;
  }
  async function command(route, body = {}) {
    if (online) {
      try {
        s = await request(route, { id: you, ...body });
      } catch (e) {
        say(e.message);
      }
      return;
    }
    const p = player();
    if (route === 'start') startShift(s);
    if (route === 'work') beginJob(s, p, body.job);
    if (route === 'step') jobStep(s, p, body.value);
    if (route === 'cancel') cancelJob(s, p);
    if (route === 'prank') prank(s, p);
    if (route === 'bot') {
      const ai = s.players.find((p) => p.bot);
      if (ai) {
        cancelJob(s, ai);
        s.players = s.players.filter((p) => !p.bot);
      } else addPlayer(s, 'ai', 'Ada (AI)', true);
    }
    taskKey = '';
  }
```

**What and why:** request handles timeout, JSON and HTTP errors. command either posts an intention and adopts the returned server state or calls the corresponding shared function locally. The bot branch releases owned work before removing Ada. Clearing taskKey forces the task panel to reflect the new operation. This is where authority changes; rendering code does not need two implementations.

**Try it / expected result:** Compare a local repair with an online repair. Both should reach jobStep, but only the online one goes through HTTP.

#### 2.3 — Create sessions and keep shared pause honest

**Read:** `app.js`, lines 76–112.

<!-- taught-source: nord-office/app.js:76-112 -->

**File: `app.js`** (step 2.3, create sessions and keep shared pause honest: the next part of this file; it goes **below** the code of the previous step)
```js
  $('solo').onclick = () => {
    online = false;
    s = newOffice();
    you = 'solo';
    addPlayer(s, you, $('name').value);
    addPlayer(s, 'ai', 'Ada (AI)', true);
    paused = false;
    taskKey = '';
    say('Solo practice. Start a shift when ready.');
  };
  $('join').onclick = async () => {
    try {
      s = await request('join', { name: $('name').value, room: $('room').value });
      you = s.you;
      online = true;
      paused = false;
      keys.clear();
      taskKey = '';
      say(
        `Room ${s.code} · ${s.host === you ? 'You are host' : 'Host starts the shift'} · share this server address and room`,
      );
    } catch (e) {
      say(e.message);
    }
  };
  $('start').onclick = () => {
    paused = false;
    command('start');
  };
  $('bot').onclick = () => command('bot');
  $('pause').onclick = () => {
    if (online) say('Online shifts keep running for everyone.');
    else {
      paused = !paused;
      keys.clear();
    }
  };
```

**What and why:** Solo builds a fresh state and roster. Join adopts the server’s identity and room snapshot only after a successful response. Start and bot use command, while Pause freezes only the local shift. Clearing keys on a join/reset prevents old intent crossing into a new run. Error messages leave the page operable.

**Try it / expected result:** Join two browsers and click Pause in one. It should explain that the shared shift continues rather than freezing the other player.

#### 2.4 — Find an eligible station and handle keyboard intent

**Read:** `app.js`, lines 113–138.

<!-- taught-source: nord-office/app.js:113-138 -->

**File: `app.js`** (step 2.4, find an eligible station and handle keyboard intent: the next part of this file; it goes **below** the code of the previous step)
```js
  function work() {
    const p = player();
    if (!p || paused) return;
    const j = s.jobs.find((j) => j.broken && !j.owner && nearby(p, j));
    if (j) command('work', { job: j.id });
    else say('Walk closer to a red station with an unclaimed ticket.');
  }
  const down = (e) => {
    if (menu.typing) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code))
      e.preventDefault();
    keys.add(e.code);
    if (!e.repeat) {
      if (e.code === 'KeyE') work();
      if (e.code === 'KeyX') command('prank');
      if (e.code === 'Escape') command('cancel');
    }
  };
  const up = (e) => keys.delete(e.code),
    blur = () => {
      keys.clear();
      if (!online) paused = true;
    };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
```

**What and why:** work chooses a nearby broken unowned station, then requests a claim. The key handler ignores text inputs, prevents page scrolling and treats E/X/Escape as one-shot actions. Key release/blur clears movement, and blur pauses solo only. Window listeners are paired with teardown at the end.

**Try it / expected result:** Hold E and verify it does not repeatedly claim/complete a task. Move away from a claimed station and watch it become available again.

#### 2.5 — Rebuild only when the task changes

**Read:** `app.js`, lines 139–178.

<!-- taught-source: nord-office/app.js:139-178 -->

**File: `app.js`** (step 2.5, rebuild only when the task changes: the next part of this file; it goes **below** the code of the previous step)
```js
  function drawTask() {
    const p = player(),
      job = p?.job,
      key = job ? `${job.id}:${job.step}:${job.puzzle}:${job.began}` : '';
    if (key === taskKey) return;
    taskKey = key;
    const box = $('task');
    box.replaceChildren();
    if (!job) return;
    const j = s.jobs[job.id],
      title = document.createElement('h3');
    title.textContent = j.name;
    box.append(title);
    const label = document.createElement('p');
    box.append(label);
    const button = (text, value) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = () => command('step', { value });
      box.append(b);
    };
    if (j.kind === 'wire') {
      label.textContent = `Reconnect in order: ${job.sequence.map((v) => ['RED', 'BLUE', 'GREEN', 'GOLD'][v]).join(' → ')}. Step ${job.step + 1}/3`;
      ['RED', 'BLUE', 'GREEN', 'GOLD'].forEach((v, i) => button(v, i));
    }
    if (j.kind === 'bug') {
      label.textContent = PUZZLES[job.puzzle].log;
      PUZZLES[job.puzzle].choices.forEach((v, i) => button(v, i));
    }
    if (j.kind === 'coffee') {
      label.textContent =
        'Stop the fill between 55% and 85% (green). The server measures elapsed time.';
      const meter = document.createElement('div');
      meter.id = 'coffee';
      box.append(meter);
      button('Pour coffee', 0);
    }
    button('Cancel', -1);
    box.lastChild.onclick = () => command('cancel');
  }
```

**What and why:** The task key combines identity/progress/puzzle/start time. If unchanged, the UI leaves buttons in place instead of recreating them every frame and losing focus. A small button factory sends step values. Wire labels show the ordered sequence, bug labels show actual faulty JavaScript, coffee adds a fill meter, and Cancel overrides the generic step callback with the cancel route.

**Try it / expected result:** Click the first correct wire colour. The panel should advance to step two; the score should still be unchanged.

#### 2.6 — Paint tiles and station status

**Read:** `app.js`, lines 179–212.

<!-- taught-source: nord-office/app.js:179-212 -->

**File: `app.js`** (step 2.6, paint tiles and station status: the next part of this file; it goes **below** the code of the previous step)
```js
  function draw() {
    ctx.fillStyle = '#152238';
    ctx.fillRect(0, 0, 768, 512);
    MAP.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        ctx.fillStyle = tile === '#' ? '#2d4660' : (x + y) % 2 ? '#1e3448' : '#22394d';
        ctx.fillRect(x * 32, y * 32, 32, 32);
        if (tile === 'D') {
          ctx.fillStyle = '#895d55';
          ctx.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
          ctx.fillStyle = '#6be4df';
          ctx.fillRect(x * 32 + 6, y * 32 + 5, 18, 10);
        }
      }),
    );
    for (const j of s.jobs) {
      ctx.fillStyle = j.broken ? '#ed6c83' : '#69d9a0';
      ctx.fillRect(j.x * 32 + 2, j.y * 32 + 2, 28, 28);
      ctx.fillStyle = '#0f1e2d';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(['W', 'B', 'C', 'T', 'E'][j.id], j.x * 32 + 10, j.y * 32 + 23);
      if (j.broken) {
        ctx.strokeStyle = '#ed6c83';
        ctx.beginPath();
        ctx.arc(
          j.x * 32 + 16,
          j.y * 32 + 16,
          25 + Math.sin(s.time * 4) * 3,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
```

**What and why:** The entire canvas is repainted, then map characters choose floor/wall/desk layers. Multiplying tile indices by 32 is the only tile-to-screen conversion. Station markers read broken state for colour and use a sine ring as a visual alert. The ring does not define interaction distance; nearby in rules does.

**Try it / expected result:** Change the alert ring radius visually. You should still need to stand within the same rule distance to press E.

#### 2.7 — Paint people and derive the HUD

**Read:** `app.js`, lines 213–240.

<!-- taught-source: nord-office/app.js:213-240 -->

**File: `app.js`** (step 2.7, paint people and derive the HUD: the next part of this file; it goes **below** the code of the previous step)
```js
    for (const p of s.players) {
      const x = p.x * 32,
        y = p.y * 32;
      ctx.fillStyle = '#0005';
      ctx.beginPath();
      ctx.ellipse(x, y + 10, 12, 5, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = p.bot ? '#b7a0ff' : p.id === you ? '#6ee6ee' : '#ffc86e';
      ctx.fillRect(x - 9, y - 8, 18, 18);
      ctx.fillStyle = '#f5ccaf';
      ctx.fillRect(x - 7, y - 16, 14, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, x, y - 22);
      if (p.job) ctx.fillText('⚙', x, y - 38);
      ctx.textAlign = 'left';
    }
    $('hud').textContent =
      `${paused ? 'PAUSED · ' : ''}${s.phase.toUpperCase()} · ` +
      `${s.score}/${s.goal} fixes · Morale ${Math.ceil(s.morale)} · ` +
      `${Math.max(0, Math.ceil(s.duration - s.time))}s`;
    $('result').textContent =
      s.phase === 'won'
        ? 'BUILD SHIPPED! Great shift. Start another to replay.'
        : s.phase === 'lost'
          ? 'SHIFT FAILED. Try with Ada, share tasks, and keep morale up.'
          : '';
```

**What and why:** Avatars use tile positions converted to pixels, a small shadow, role-dependent clothing, a name and a work indicator. textAlign is restored for later drawing. HUD/result strings read team phase/score/morale/time. No score is awarded here, and a visual success message is not used as a rule condition.

**Try it / expected result:** Inspect a client snapshot while another intern moves. The same player record should drive both its name and avatar position.

#### 2.8 — Update text only when needed and animate coffee from time

**Read:** `app.js`, lines 241–261.

<!-- taught-source: nord-office/app.js:241-261 -->

**File: `app.js`** (step 2.8, update text only when needed and animate coffee from time: the next part of this file; it goes **below** the code of the previous step)
```js
    const nextStatus =
      s.jobs
        .map(
          (j) => `${j.name}: ${j.broken ? (j.owner ? 'IN PROGRESS' : 'BROKEN') : 'OK'}`,
        )
        .join('\n') +
      '\n' +
      s.log.join('\n');
    if (nextStatus !== status) {
      status = nextStatus;
      $('tickets').textContent = nextStatus.split('\n').slice(0, 5).join('\n');
      $('log').textContent = s.log.join('\n');
    }
    drawTask();
    const coffee = $('coffee');
    if (coffee && player()?.job) {
      const fill = ((s.time - player().job.began) % 2.4) / 2.4;
      coffee.style.background = `linear-gradient(to right,#eec76a ${fill * 100}%,transparent 0),linear-gradient(to right,#27394b 55%,#36694d 55%,#36694d 85%,#27394b 85%)`;
      coffee.textContent = Math.round(fill * 100) + '%';
    }
  }
```

**What and why:** Ticket/log text is cached to avoid unnecessary DOM replacement. drawTask decides whether puzzle controls need a rebuild. Coffee’s gradient uses the same elapsed-time formula as validation, while its green target region is fixed. This UI prediction makes the game readable, but the server still determines the result when the pour arrives.

**Try it / expected result:** Pour just outside the green interval. The animated meter should not grant success merely because the button was clicked.

#### 2.9 — Choose local simulation or online snapshots, then dispose

**Read:** `app.js`, lines 262–315.

<!-- taught-source: nord-office/app.js:262-315 -->

**File: `app.js`** (step 2.9, choose local simulation or online snapshots, then dispose: the next part of this file; it goes **below** the code of the previous step)
```js
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = player(),
      dx =
        Number(keys.has('KeyD') || keys.has('ArrowRight')) -
        Number(keys.has('KeyA') || keys.has('ArrowLeft')),
      dy =
        Number(keys.has('KeyS') || keys.has('ArrowDown')) -
        Number(keys.has('KeyW') || keys.has('ArrowUp'));
    if (!online) {
      if (p) {
        p.dx = paused ? 0 : dx;
        p.dy = paused ? 0 : dy;
      }
      if (!paused) tickOffice(s, dt);
    } else {
      poll += dt;
      if (poll > 0.1 && !busy) {
        poll = 0;
        busy = true;
        request('input', { id: you, dx, dy })
          .then(() => request('state?id=' + encodeURIComponent(you)))
          .then((data) => {
            s = data;
          })
          .catch((e) => say(e.message + ' — check server / rejoin'))
          .finally(() => (busy = false));
      }
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__office = {
    get state() {
      return s;
    },
    get you() {
      return you;
    },
    get online() {
      return online;
    },
  };
  return () => {
    alive = false;
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    menu.destroy();
  };
}
```

**What and why:** The loop computes clamped seconds and a directional intention from the held-key Set. Solo assigns those axes and calls tickOffice; online sends input, then requests a snapshot, about ten times per second with a busy guard. It never also runs local authoritative rules online. draw remains common. The final getters support inspection; cleanup stops future frames, removes listeners and clears the mount root.

**Try it / expected result:** Temporarily stop Node and observe the connection message. Rejoin after restarting it; do not expect memory-only rooms to survive a process restart.


### 3. ui/office.ui.json {#walk-ui-office-ui-json}

Describe the office page as data: title, four controls, map canvas, task panel, the online form with tickets and log, and the footer.

#### 3.1 — Page settings, header and controls

**Read:** `ui/office.ui.json`, lines 1–22.

<!-- taught-source: nord-office/ui/office.ui.json:1-22 -->

**File: `ui/office.ui.json`** (step 3.1, page settings, header and controls: the beginning of the file)
```json
{
  "version": 1,
  "name": "office",
  "page": true,
  "styles": [
    "style.css"
  ],
  "body": {
    "margin": "0",
    "background": "#0b1421"
  },
  "root": { "type": "box", "tag": "main", "name": "root", "children": [
    { "type": "box", "tag": "header", "children": [
      { "type": "label", "tag": "h1", "text": "NORD ENGINE OFFICE" },
      { "type": "label", "tag": "p", "text": "Ship the engine. Fix the coffee. Survive your interns." }
    ] },
    { "type": "box", "tag": "nav", "children": [
      { "name": "solo", "type": "button", "text": "Solo + AI practice" },
      { "name": "start", "type": "button", "text": "Start / Restart shift" },
      { "name": "bot", "type": "button", "text": "Toggle AI coworker" },
      { "name": "pause", "type": "button", "text": "Pause solo" }
    ] },
```

**What and why:** Page settings link the stylesheet inside the shadow root and set body colours. The header box holds the title and tagline as labels with semantic tags. The nav box lists solo, start, bot and pause buttons, each with a name used by app.js.

**Try it / expected result:** Rename the tagline in the Designer and reload Play. Only the file changes; app.js is untouched.

#### 3.2 — Map canvas, HUD and task panel

**Read:** `ui/office.ui.json`, lines 23–30.

<!-- taught-source: nord-office/ui/office.ui.json:23-30 -->

**File: `ui/office.ui.json`** (step 3.2, map canvas, HUD and task panel: the next part of this file; it goes **below** the code of the previous step)
```json
    { "class": "layout", "type": "box", "tag": "section", "children": [
      { "type": "box", "children": [
        { "type": "canvas", "w": 768, "h": 512, "attrs": {"aria-label": "Office game map"}, "name": "map" },
        { "name": "hud", "type": "label", "tag": "h2" },
        { "type": "label", "tag": "p", "text": "WASD / arrows: walk · E: work nearby · X: introduce a bug · Esc: cancel task" },
        { "name": "task", "type": "box" },
        { "name": "result", "type": "label", "tag": "p" }
      ] },
```

**What and why:** The layout box places a div with the 768 by 512 map canvas named map, the hud heading, a help paragraph, an empty task box and a result paragraph. The task box starts empty on purpose: app.js builds its buttons when a task begins.

**Try it / expected result:** Select the map canvas and change its Width and Height to 640 and 427, keeping the 3:2 ratio. The drawing scales through CSS but game coordinates stay the same.

#### 3.3 — Online form, tickets and log

**Read:** `ui/office.ui.json`, lines 31–54.

<!-- taught-source: nord-office/ui/office.ui.json:31-54 -->

**File: `ui/office.ui.json`** (step 3.3, online form, tickets and log: the next part of this file; it goes **below** the code of the previous step)
```json
      { "type": "box", "tag": "aside", "children": [
        { "type": "label", "tag": "h2", "text": "Invite interns" },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Name" },
          { "name": "name", "type": "input", "value": "Intern", "maxlength": "20" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Room" },
          { "name": "room", "type": "input", "value": "NORD", "maxlength": "8" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Server" },
          { "name": "server", "type": "input" }
        ] },
        { "name": "join", "type": "button", "text": "Join online office" },
        { "name": "network", "type": "label", "tag": "p", "text": "Run node server.mjs to host friends. Solo works without a server." },
        { "type": "label", "tag": "h2", "text": "Tickets" },
        { "name": "tickets", "type": "box" },
        { "type": "label", "tag": "h2", "text": "Office log" },
        { "name": "log", "type": "box" },
        { "type": "label", "tag": "p", "text": "Host starts the shift. Finish 12 tasks in 150 seconds. Too many open bugs drain morale. X pranks a fixed nearby station, with a 15-second cooldown." },
        { "type": "label", "tag": "p", "text": "Ada is a local pathfinding AI coworker, no account or API key needed." }
      ] }
    ] },
```

**What and why:** The aside holds the labelled name, room and server inputs, the join button, the network message and the empty tickets and log containers that the game fills while playing. The final paragraphs are plain labels with explanatory text.

**Try it / expected result:** Change the room input's maxlength to 4 and try to type a longer room code online; the field refuses extra characters.

#### 3.4 — Footer

**Read:** `ui/office.ui.json`, lines 55–59.

<!-- taught-source: nord-office/ui/office.ui.json:55-59 -->

**File: `ui/office.ui.json`** (step 3.4, footer: the next part of this file; it goes **below** the code of the previous step)
```json
    { "type": "box", "tag": "footer", "children": [
      { "type": "label", "tag": "span", "text": "Crowelian 2026 + Sonnet · Original code and canvas graphics" }
    ] }
  ] }
}
```

**What and why:** The footer is a single label inside a footer box, styled by the existing stylesheet through its tag. No code touches it. Because the footer is data rather than code, a translator or designer can change its wording, style class or tag without reading the game logic, and the Designer preview shows the result instantly.

**Try it / expected result:** Edit the footer credit text in the JSON tab, apply it and save.


### 4. server.mjs {#walk-server-mjs}

Implement the complete room API, host controls and stale-input safety.

#### 4.1 — Create a room and add its host

**Read:** `server.mjs`, lines 1–41.

<!-- taught-source: nord-office/server.mjs:1-41 -->

**File: `server.mjs`** (step 4.1, create a room and add its host: the beginning of the file)
```js
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, failure, roomCode } from './server-kit.mjs';
import {
  newOffice,
  addPlayer,
  startShift,
  tickOffice,
  beginJob,
  jobStep,
  prank,
  cancelJob,
  publicOffice,
} from './rules.js';
export function createOfficeServer({
  port = null,
  host,
  root = path.dirname(fileURLToPath(import.meta.url)),
  clock = Date.now,
} = {}) {
  const rooms = new Map(),
    sessions = new Map();
  const api = (method, url, b) => {
    if (method === 'POST' && url.pathname === '/api/join') {
      if (sessions.size >= 96) return failure(429, 'Server full');
      const code = roomCode(b.room);
      let s = rooms.get(code);
      if (!s) {
        s = newOffice();
        s.code = code;
        addPlayer(s, 'ai', 'Ada (AI)', true);
        rooms.set(code, s);
      }
      if (s.players.filter((p) => !p.bot).length >= 6) return failure(409, 'Room full');
      const id = randomUUID(),
        p = addPlayer(s, id, b.name);
      if (!s.host) s.host = id;
      sessions.set(id, { p, s, seen: clock(), inputAt: 0, actionAt: 0 });
      return publicOffice(s, id);
    }
```

**What and why:** The server factory accepts a root/clock/port for both direct use and tests. Join capacity is bounded globally and per room. A new room receives fresh office rules and Ada, then a unique human is added. The first human becomes host, and a session record owns activity/input/action timestamps. Returning publicOffice gives the client its own ID.

**Try it / expected result:** Join the same room twice with different names. Both should see one room with one Ada, not one bot per browser.

#### 4.2 — Resolve identity and accept only finite axes

**Read:** `server.mjs`, lines 42–56.

<!-- taught-source: nord-office/server.mjs:42-56 -->

**File: `server.mjs`** (step 4.2, resolve identity and accept only finite axes: the next part of this file; it goes **below** the code of the previous step)
```js
    const id = method === 'GET' ? url.searchParams.get('id') : b.id,
      session = sessions.get(id);
    if (!session) return failure(404, 'Session expired; join again');
    const { p, s } = session;
    session.seen = clock();
    if (method === 'GET' && url.pathname === '/api/state') return publicOffice(s, id);
    if (method !== 'POST') return failure(404, 'Unknown endpoint');
    if (url.pathname === '/api/input') {
      if (!Number.isFinite(b.dx) || !Number.isFinite(b.dy))
        return failure(400, 'Finite axes required');
      p.dx = Math.max(-1, Math.min(1, b.dx));
      p.dy = Math.max(-1, Math.min(1, b.dy));
      session.inputAt = clock();
      return { ok: true };
    }
```

**What and why:** Subsequent requests locate the session and refresh its activity timestamp. State is read-only output. Input rejects non-number axes, clamps them to a valid range and records when they arrived. Positions are not accepted from the browser. The simulation will use these axes on the server’s tick.

**Try it / expected result:** Inspect /api/input in the Network panel: it sends dx/dy, not a claimed x/y position or a claimed score.

#### 4.3 — Authorize shared controls and route task intentions

**Read:** `server.mjs`, lines 57–80.

<!-- taught-source: nord-office/server.mjs:57-80 -->

**File: `server.mjs`** (step 4.3, authorize shared controls and route task intentions: the next part of this file; it goes **below** the code of the previous step)
```js
    if (url.pathname === '/api/start') {
      if (s.host !== id) return failure(403, 'Only the room host starts shifts');
      startShift(s);
      return publicOffice(s, id);
    }
    if (url.pathname === '/api/bot') {
      if (s.host !== id) return failure(403, 'Only the host changes AI');
      s.bot = !s.bot;
      if (!s.bot) {
        const ai = s.players.find((v) => v.bot);
        if (ai) cancelJob(s, ai);
        s.players = s.players.filter((v) => !v.bot);
      } else addPlayer(s, 'ai', 'Ada (AI)', true);
      return publicOffice(s, id);
    }
    if (clock() - session.actionAt < 120) return publicOffice(s, id);
    session.actionAt = clock();
    if (url.pathname === '/api/work') beginJob(s, p, b.job);
    else if (url.pathname === '/api/step') jobStep(s, p, b.value);
    else if (url.pathname === '/api/prank') prank(s, p);
    else if (url.pathname === '/api/cancel') cancelJob(s, p);
    else return failure(404, 'Unknown endpoint');
    return publicOffice(s, id);
  };
```

**What and why:** Only the host can restart or toggle AI. Removing Ada cancels her task before removing her record. A short action interval bounds repeated work/prank messages. Each endpoint calls the same rule function as solo, then returns a fresh room snapshot. Unknown routes are errors rather than silently succeeding.

**Try it / expected result:** Try Start from the second human client. It should return a host-only error without resetting the running shift.

#### 4.4 — Stop abandoned movement and release abandoned work

**Read:** `server.mjs`, lines 81–120.

<!-- taught-source: nord-office/server.mjs:81-120 -->

**File: `server.mjs`** (step 4.4, stop abandoned movement and release abandoned work: the next part of this file; it goes **below** the code of the previous step)
```js
  const tick = (dt) => {
    const now = clock();
    for (const [id, v] of sessions) {
      if (now - v.seen > 30000) {
        cancelJob(v.s, v.p);
        v.s.players = v.s.players.filter((p) => p !== v.p);
        sessions.delete(id);
        if (v.s.host === id) v.s.host = v.s.players.find((p) => !p.bot)?.id;
      } else if (now - v.inputAt > 350) {
        v.p.dx = 0;
        v.p.dy = 0;
      }
    }
    for (const [code, s] of rooms) {
      if (!s.players.some((p) => !p.bot)) {
        rooms.delete(code);
        continue;
      }
      tickOffice(s, dt);
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
      '/lib/nord-ui.js': 'lib/nord-ui.js',
      '/ui/office.ui.json': 'ui/office.ui.json',
      '/rules.js': 'rules.js',
      '/style.css': 'style.css',
    },
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  createOfficeServer({ port: Number(process.env.PORT || 4383) });
```

**What and why:** Sessions expire after thirty seconds of silence; cleanup cancels owned work and can promote another host. Axes are zeroed much sooner after stale input, preventing walking forever after a lost connection. Empty rooms are deleted; each nonempty room advances once. The static-file allowlist and direct-entry guard finish a server that can also be imported by tests.

**Try it / expected result:** Close a moving client. It should stop after input expiry, then disappear and release work after session expiry.


### 5. server-kit.mjs {#walk-server-kit-mjs}

Read the entire package-free HTTP adapter shared by the game servers.

#### 5.1 — Create an HTTP response boundary

**Read:** `server-kit.mjs`, lines 1–39.

<!-- taught-source: nord-office/server-kit.mjs:1-39 -->

**File: `server-kit.mjs`** (step 5.1, create an HTTP response boundary: the beginning of the file)
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

#### 5.2 — Parse a bounded API message

**Read:** `server-kit.mjs`, lines 40–68.

<!-- taught-source: nord-office/server-kit.mjs:40-68 -->

**File: `server-kit.mjs`** (step 5.2, parse a bounded API message: the next part of this file; it goes **below** the code of the previous step)
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

#### 5.3 — Serve only named public files and own the tick

**Read:** `server-kit.mjs`, lines 69–103.

<!-- taught-source: nord-office/server-kit.mjs:69-103 -->

**File: `server-kit.mjs`** (step 5.3, serve only named public files and own the tick: the next part of this file; it goes **below** the code of the previous step)
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


### 6. index.html {#walk-index-html}

Read the complete Nord page entry point and its failure path.

#### 6.1 — Load the local runtime and start the app

**Read:** `index.html`, lines 1–8.

<!-- taught-source: nord-office/index.html:1-8 -->

**File: `index.html`** (step 6.1, load the local runtime and start the app: the beginning of the file)
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.nordoffice"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nord Engine Office — interns vs bugs</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

**What and why:** The document declares encoding and viewport, creates the mount container and loads local code. The module imports mount from app.js and awaits initialization for the HTML-tier root. The ready/error flags are inspection signals used by browser checks; they are not a second simulation. The catch logs and exposes initialization errors. The page is served over HTTP so local module and asset URLs resolve consistently.

**Try it / expected result:** Temporarily rename the imported main module on a copy and reopen Play. Inspect the Console/error path, then restore the correct name.


### 7. nord.project.json {#walk-nord-project-json}

Read every project field that tells Nord which host, display and services to use.

#### 7.1 — Identify the project and choose its presentation

**Read:** `nord.project.json`, lines 1–22.

<!-- taught-source: nord-office/nord.project.json:1-22 -->

**File: `nord.project.json`** (step 7.1, identify the project and choose its presentation: the beginning of the file)
```json
{
  "format": 1,
  "name": "Nord Engine Office",
  "id": "com.crowelian.nordoffice",
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

#### 7.2 — Distinguish scene actions from HTML event handling

**Read:** `nord.project.json`, lines 23–64.

<!-- taught-source: nord-office/nord.project.json:23-64 -->

**File: `nord.project.json`** (step 7.2, distinguish scene actions from HTML event handling: the next part of this file; it goes **below** the code of the previous step)
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


### 8. style.css {#walk-style-css}

Read every stylesheet rule, grouped by the UI responsibility it controls.

#### 8.1 — Set the app foundation and reusable visual language

**Read:** `style.css`, lines 1–30.

<!-- taught-source: nord-office/style.css:1-30 -->

**File: `style.css`** (step 8.1, set the app foundation and reusable visual language: the beginning of the file)
```css
:host {
  display: block;
  min-height: 100vh;
  color: #e3edf4;
  font: 15px system-ui;
}
* {
  box-sizing: border-box;
}

main {
  max-width: 1150px;
  margin: auto;
  padding: 18px;
}
h1 {
  color: #69e0e5;
  letter-spacing: 3px;
  margin: 0;
}
header p {
  color: #eac47b;
  margin: 6px 0 16px;
}
nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
```

**What and why:** The opening rules give the host element (:host, the page root that holds the UI) its colour, font and minimum height; the document background and margin come from the body block of the UI file, apply border-box sizing, reset margins and choose system typography. Header, heading and basic control rules establish the app’s hierarchy and affordances. Keeping this local avoids remote font or stylesheet dependencies. The sheet is linked from inside the UI file's shadow root, so selectors such as main, nav and #status match the nodes you named there.

**Try it / expected result:** Change one accent colour on a copy and reopen Play; no gameplay or saved-document data should change.

#### 8.2 — Place the map next to connection controls

**Read:** `style.css`, lines 31–77.

<!-- taught-source: nord-office/style.css:31-77 -->

**File: `style.css`** (step 8.2, place the map next to connection controls: the next part of this file; it goes **below** the code of the previous step)
```css
.layout {
  display: grid;
  grid-template-columns: minmax(0, 768px) 280px;
  gap: 20px;
}
canvas {
  width: 100%;
  border: 2px solid #48627a;
  image-rendering: pixelated;
}
button,
input {
  font: inherit;
  border: 1px solid #45637c;
  border-radius: 5px;
  padding: 9px;
  background: #20394f;
  color: #fff;
}
button {
  cursor: pointer;
  margin: 3px;
}
button:hover {
  background: #3c5c73;
}
input {
  width: 100%;
}
label {
  display: block;
  margin: 8px 0;
  font-size: 12px;
}
h2 {
  font-size: 18px;
  color: #eac47b;
}
p {
  line-height: 1.45;
}
#tickets,
#log {
  white-space: pre-line;
  font-size: 13px;
  line-height: 1.8;
}
```

**What and why:** The desktop grid assigns the map flexible space and the sidebar a fixed readable column. Canvas scales responsively while retaining its simulation tile units. Buttons/inputs share typography and focusable native controls.

**Try it / expected result:** Resize the window: the map may scale, but a worker should not gain a different walking speed.

#### 8.3 — Style task feedback and a readable coffee target

**Read:** `style.css`, lines 78–112.

<!-- taught-source: nord-office/style.css:78-112 -->

**File: `style.css`** (step 8.3, style task feedback and a readable coffee target: the next part of this file; it goes **below** the code of the previous step)
```css
#task {
  background: #253a51;
  padding: 12px;
  border-radius: 8px;
  min-height: 30px;
}
#task p {
  font-family: monospace;
}
#coffee {
  height: 28px;
  text-align: center;
  border: 1px solid #78927e;
  margin: 8px 0;
}
#result {
  font-size: 22px;
  color: #77f1b1;
}
footer {
  padding: 20px;
  color: #7895ad;
  font-size: 12px;
}
@media (max-width: 850px) {
  .layout {
    display: block;
  }
  aside {
    max-width: 500px;
  }
  main {
    padding: 8px;
  }
}
```

**What and why:** Pre-line preserves ticket/log line breaks. The task panel contains live buttons, coffee gets a visible bounded meter and the result has stronger colour/size. The narrow-screen rule stacks the sidebar. These are feedback styles, not the logic that awards a repair.

**Try it / expected result:** Change the coffee border style only. Success must still be decided by the elapsed-time rule, not by CSS colour.

<!-- END GENERATED FILE WALKTHROUGH -->

## Complete project source

The full download contains the entire runnable game and Node server. Every authored text file follows, using the manual's offline CodeMirror viewers with Copy and Wrap controls. The earlier excerpts teach each stage; these complete files are the reference implementation you can run, edit and redistribute under the included project licence.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

<details>
<summary>Complete app.js</summary>

**File: `app.js`** (the complete file, for comparison)
```js
import {
  MAP,
  JOBS,
  PUZZLES,
  newOffice,
  addPlayer,
  startShift,
  tickOffice,
  beginJob,
  jobStep,
  prank,
  cancelJob,
  nearby,
} from './rules.js';
import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
  // Layout, text and fields live in ui/office.ui.json (edit it in the UI Designer); this file only wires them up.
  const menu = await createUI(root).load('ui/office.ui.json');
  // $('name') = the DOM element with that id (null for ids made later in code, like the coffee meter)
  const $ = (id) => menu.shadow.getElementById(id),
    ctx = $('map').getContext('2d'),
    keys = new Set();
  let s = newOffice(),
    you = 'solo',
    online = false,
    paused = false,
    alive = true,
    last = performance.now(),
    poll = 0,
    busy = false,
    taskKey = '',
    status = '';
  addPlayer(s, you, 'You');
  addPlayer(s, 'ai', 'Ada (AI)', true);
  $('server').value =
    location.port === '4383' ? location.origin : 'http://127.0.0.1:4383';
  const player = () => s.players.find((p) => p.id === you);
  const say = (t) => {
    $('network').textContent = t;
  };
  async function request(route, body) {
    const res = await fetch($('server').value.replace(/\/$/, '') + '/api/' + route, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || res.status);
    return data;
  }
  async function command(route, body = {}) {
    if (online) {
      try {
        s = await request(route, { id: you, ...body });
      } catch (e) {
        say(e.message);
      }
      return;
    }
    const p = player();
    if (route === 'start') startShift(s);
    if (route === 'work') beginJob(s, p, body.job);
    if (route === 'step') jobStep(s, p, body.value);
    if (route === 'cancel') cancelJob(s, p);
    if (route === 'prank') prank(s, p);
    if (route === 'bot') {
      const ai = s.players.find((p) => p.bot);
      if (ai) {
        cancelJob(s, ai);
        s.players = s.players.filter((p) => !p.bot);
      } else addPlayer(s, 'ai', 'Ada (AI)', true);
    }
    taskKey = '';
  }
  $('solo').onclick = () => {
    online = false;
    s = newOffice();
    you = 'solo';
    addPlayer(s, you, $('name').value);
    addPlayer(s, 'ai', 'Ada (AI)', true);
    paused = false;
    taskKey = '';
    say('Solo practice. Start a shift when ready.');
  };
  $('join').onclick = async () => {
    try {
      s = await request('join', { name: $('name').value, room: $('room').value });
      you = s.you;
      online = true;
      paused = false;
      keys.clear();
      taskKey = '';
      say(
        `Room ${s.code} · ${s.host === you ? 'You are host' : 'Host starts the shift'} · share this server address and room`,
      );
    } catch (e) {
      say(e.message);
    }
  };
  $('start').onclick = () => {
    paused = false;
    command('start');
  };
  $('bot').onclick = () => command('bot');
  $('pause').onclick = () => {
    if (online) say('Online shifts keep running for everyone.');
    else {
      paused = !paused;
      keys.clear();
    }
  };
  function work() {
    const p = player();
    if (!p || paused) return;
    const j = s.jobs.find((j) => j.broken && !j.owner && nearby(p, j));
    if (j) command('work', { job: j.id });
    else say('Walk closer to a red station with an unclaimed ticket.');
  }
  const down = (e) => {
    if (menu.typing) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code))
      e.preventDefault();
    keys.add(e.code);
    if (!e.repeat) {
      if (e.code === 'KeyE') work();
      if (e.code === 'KeyX') command('prank');
      if (e.code === 'Escape') command('cancel');
    }
  };
  const up = (e) => keys.delete(e.code),
    blur = () => {
      keys.clear();
      if (!online) paused = true;
    };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  function drawTask() {
    const p = player(),
      job = p?.job,
      key = job ? `${job.id}:${job.step}:${job.puzzle}:${job.began}` : '';
    if (key === taskKey) return;
    taskKey = key;
    const box = $('task');
    box.replaceChildren();
    if (!job) return;
    const j = s.jobs[job.id],
      title = document.createElement('h3');
    title.textContent = j.name;
    box.append(title);
    const label = document.createElement('p');
    box.append(label);
    const button = (text, value) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = () => command('step', { value });
      box.append(b);
    };
    if (j.kind === 'wire') {
      label.textContent = `Reconnect in order: ${job.sequence.map((v) => ['RED', 'BLUE', 'GREEN', 'GOLD'][v]).join(' → ')}. Step ${job.step + 1}/3`;
      ['RED', 'BLUE', 'GREEN', 'GOLD'].forEach((v, i) => button(v, i));
    }
    if (j.kind === 'bug') {
      label.textContent = PUZZLES[job.puzzle].log;
      PUZZLES[job.puzzle].choices.forEach((v, i) => button(v, i));
    }
    if (j.kind === 'coffee') {
      label.textContent =
        'Stop the fill between 55% and 85% (green). The server measures elapsed time.';
      const meter = document.createElement('div');
      meter.id = 'coffee';
      box.append(meter);
      button('Pour coffee', 0);
    }
    button('Cancel', -1);
    box.lastChild.onclick = () => command('cancel');
  }
  function draw() {
    ctx.fillStyle = '#152238';
    ctx.fillRect(0, 0, 768, 512);
    MAP.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        ctx.fillStyle = tile === '#' ? '#2d4660' : (x + y) % 2 ? '#1e3448' : '#22394d';
        ctx.fillRect(x * 32, y * 32, 32, 32);
        if (tile === 'D') {
          ctx.fillStyle = '#895d55';
          ctx.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
          ctx.fillStyle = '#6be4df';
          ctx.fillRect(x * 32 + 6, y * 32 + 5, 18, 10);
        }
      }),
    );
    for (const j of s.jobs) {
      ctx.fillStyle = j.broken ? '#ed6c83' : '#69d9a0';
      ctx.fillRect(j.x * 32 + 2, j.y * 32 + 2, 28, 28);
      ctx.fillStyle = '#0f1e2d';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(['W', 'B', 'C', 'T', 'E'][j.id], j.x * 32 + 10, j.y * 32 + 23);
      if (j.broken) {
        ctx.strokeStyle = '#ed6c83';
        ctx.beginPath();
        ctx.arc(
          j.x * 32 + 16,
          j.y * 32 + 16,
          25 + Math.sin(s.time * 4) * 3,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
    for (const p of s.players) {
      const x = p.x * 32,
        y = p.y * 32;
      ctx.fillStyle = '#0005';
      ctx.beginPath();
      ctx.ellipse(x, y + 10, 12, 5, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = p.bot ? '#b7a0ff' : p.id === you ? '#6ee6ee' : '#ffc86e';
      ctx.fillRect(x - 9, y - 8, 18, 18);
      ctx.fillStyle = '#f5ccaf';
      ctx.fillRect(x - 7, y - 16, 14, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, x, y - 22);
      if (p.job) ctx.fillText('⚙', x, y - 38);
      ctx.textAlign = 'left';
    }
    $('hud').textContent =
      `${paused ? 'PAUSED · ' : ''}${s.phase.toUpperCase()} · ` +
      `${s.score}/${s.goal} fixes · Morale ${Math.ceil(s.morale)} · ` +
      `${Math.max(0, Math.ceil(s.duration - s.time))}s`;
    $('result').textContent =
      s.phase === 'won'
        ? 'BUILD SHIPPED! Great shift. Start another to replay.'
        : s.phase === 'lost'
          ? 'SHIFT FAILED. Try with Ada, share tasks, and keep morale up.'
          : '';
    const nextStatus =
      s.jobs
        .map(
          (j) => `${j.name}: ${j.broken ? (j.owner ? 'IN PROGRESS' : 'BROKEN') : 'OK'}`,
        )
        .join('\n') +
      '\n' +
      s.log.join('\n');
    if (nextStatus !== status) {
      status = nextStatus;
      $('tickets').textContent = nextStatus.split('\n').slice(0, 5).join('\n');
      $('log').textContent = s.log.join('\n');
    }
    drawTask();
    const coffee = $('coffee');
    if (coffee && player()?.job) {
      const fill = ((s.time - player().job.began) % 2.4) / 2.4;
      coffee.style.background = `linear-gradient(to right,#eec76a ${fill * 100}%,transparent 0),linear-gradient(to right,#27394b 55%,#36694d 55%,#36694d 85%,#27394b 85%)`;
      coffee.textContent = Math.round(fill * 100) + '%';
    }
  }
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = player(),
      dx =
        Number(keys.has('KeyD') || keys.has('ArrowRight')) -
        Number(keys.has('KeyA') || keys.has('ArrowLeft')),
      dy =
        Number(keys.has('KeyS') || keys.has('ArrowDown')) -
        Number(keys.has('KeyW') || keys.has('ArrowUp'));
    if (!online) {
      if (p) {
        p.dx = paused ? 0 : dx;
        p.dy = paused ? 0 : dy;
      }
      if (!paused) tickOffice(s, dt);
    } else {
      poll += dt;
      if (poll > 0.1 && !busy) {
        poll = 0;
        busy = true;
        request('input', { id: you, dx, dy })
          .then(() => request('state?id=' + encodeURIComponent(you)))
          .then((data) => {
            s = data;
          })
          .catch((e) => say(e.message + ' — check server / rejoin'))
          .finally(() => (busy = false));
      }
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__office = {
    get state() {
      return s;
    },
    get you() {
      return you;
    },
    get online() {
      return online;
    },
  };
  return () => {
    alive = false;
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    menu.destroy();
  };
}
```

</details>

<details>
<summary>Complete index.html</summary>

**File: `index.html`** (the complete file, for comparison)
```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.nordoffice"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nord Engine Office — interns vs bugs</title>
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

**File: `nord.project.json`** (the complete file, for comparison)
```json
{
  "format": 1,
  "name": "Nord Engine Office",
  "id": "com.crowelian.nordoffice",
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

**File: `rules.js`** (the complete file, for comparison)
```js
// Shared simulation: Node advances online rooms; the browser advances solo practice.
export const MAP = [
  '########################',
  '#......................#',
  '#..DD....DD....DD......#',
  '#..DD....DD....DD......#',
  '#......................#',
  '#......................#',
  '#..W......B......C.....#',
  '#......................#',
  '#......................#',
  '#..DD....DD....DD......#',
  '#..DD....DD....DD......#',
  '#......................#',
  '#.....T........E.......#',
  '#......................#',
  '#......................#',
  '########################',
];
export const JOBS = [
  { name: 'Rewire build rack', x: 3, y: 6, kind: 'wire' },
  { name: 'Fix viewport bug', x: 10, y: 6, kind: 'bug' },
  { name: 'Brew emergency coffee', x: 17, y: 6, kind: 'coffee' },
  { name: 'Repair failing tests', x: 6, y: 12, kind: 'bug' },
  { name: 'Patch HTML exporter', x: 15, y: 12, kind: 'wire' },
];
export const PUZZLES = [
  {
    log: 'for (let i=0; i<=rows.length; i++) draw(rows[i]);',
    choices: ['Change <= to <', 'Delete draw', 'Set i to -1'],
    answer: 0,
  },
  {
    log: 'if (health = 0) gameOver();',
    choices: ['Set health to 100', 'Use health === 0', 'Remove gameOver'],
    answer: 1,
  },
  {
    log: 'const dt = milliseconds; x += speed * dt;',
    choices: ['Double speed', 'Multiply dt by 1000', 'Divide dt by 1000'],
    answer: 2,
  },
];
export function newOffice() {
  return {
    players: [],
    jobs: JOBS.map((j, i) => ({
      ...j,
      id: i,
      broken: i < 3,
      owner: null,
      work: 0,
      version: 0,
    })),
    time: 0,
    nextFault: 9,
    score: 0,
    morale: 100,
    phase: 'lobby',
    bot: true,
    goal: 12,
    duration: 150,
    log: ['Welcome to Nord Engine Office. Finish 12 jobs in 150 seconds.'],
  };
}
export function addPlayer(s, id, name, bot = false) {
  const p = {
    id,
    name: String(name || 'Intern').slice(0, 20),
    x: 11.5,
    y: 8.2 + s.players.filter((p) => !p.bot).length * 0.35,
    dx: 0,
    dy: 0,
    bot,
    job: null,
    prank: 0,
    done: 0,
  };
  s.players.push(p);
  return p;
}
export function startShift(s) {
  s.phase = 'playing';
  s.time = 0;
  s.score = 0;
  s.morale = 100;
  s.nextFault = 9;
  s.log = ['Shift started! E near a station to work.'];
  for (const j of s.jobs) {
    j.broken = j.id < 3;
    j.owner = null;
    j.work = 0;
    j.version++;
  }
  for (const p of s.players) {
    p.x = 11.5;
    p.y = 8.5;
    p.job = null;
    p.dx = 0;
    p.dy = 0;
    p.prank = 0;
    p.done = 0;
  }
}
export function walkable(x, y) {
  const cell = MAP[Math.floor(y)]?.[Math.floor(x)];
  return cell !== undefined && cell !== '#' && cell !== 'D';
}
export function movePlayer(p, dx, dy, dt) {
  const n = Math.max(1, Math.hypot(dx, dy));
  dx = (dx / n) * 3.3 * dt;
  dy = (dy / n) * 3.3 * dt;
  const fits = (x, y) =>
    [-0.22, 0.22].every((a) => [-0.22, 0.22].every((b) => walkable(x + a, y + b)));
  if (fits(p.x + dx, p.y)) p.x += dx;
  if (fits(p.x, p.y + dy)) p.y += dy;
}
export const nearby = (p, j) => Math.hypot(p.x - (j.x + 0.5), p.y - (j.y + 0.5)) < 1.5;
function note(s, text) {
  s.log.unshift(text);
  s.log.length = Math.min(6, s.log.length);
}
export function beginJob(s, p, id) {
  if (s.phase !== 'playing' || p.job) return false;
  const j = s.jobs.find((v) => v.id === id);
  if (!j?.broken || j.owner || !nearby(p, j)) return false;
  j.owner = p.id;
  j.work = 0;
  p.job = {
    id,
    step: 0,
    puzzle: j.version % PUZZLES.length,
    sequence: [
      (j.id + j.version) % 4,
      (j.id + j.version + 2) % 4,
      (j.id + j.version + 1) % 4,
    ],
    began: s.time,
  };
  return true;
}
export function cancelJob(s, p) {
  if (p.job) {
    const j = s.jobs[p.job.id];
    if (j.owner === p.id) {
      j.owner = null;
      j.work = 0;
    }
    p.job = null;
  }
}
function complete(s, p) {
  const j = s.jobs[p.job.id];
  j.broken = false;
  j.owner = null;
  j.work = 0;
  j.version++;
  s.score++;
  p.done++;
  s.morale = Math.min(100, s.morale + 7);
  note(s, `${p.name} completed: ${j.name}`);
  p.job = null;
  if (s.score >= s.goal) s.phase = 'won';
}
export function jobStep(s, p, value) {
  if (s.phase !== 'playing' || !p.job) return false;
  const j = s.jobs[p.job.id];
  if (!nearby(p, j)) {
    cancelJob(s, p);
    return false;
  }
  let ok = false;
  if (j.kind === 'wire') {
    ok = value === p.job.sequence[p.job.step];
    if (ok && ++p.job.step < 3) return true;
  }
  if (j.kind === 'bug') ok = value === PUZZLES[p.job.puzzle].answer;
  if (j.kind === 'coffee') {
    const fill = ((s.time - p.job.began) % 2.4) / 2.4;
    ok = fill >= 0.55 && fill <= 0.85;
  }
  if (ok) {
    complete(s, p);
    return true;
  }
  s.morale = Math.max(0, s.morale - 5);
  note(s, `${p.name}: wrong fix — morale -5`);
  cancelJob(s, p);
  return false;
}
export function prank(s, p) {
  if (s.phase !== 'playing' || p.prank > 0 || p.job) return false;
  const j = s.jobs.find((j) => !j.broken && nearby(p, j));
  if (!j) return false;
  j.broken = true;
  j.version++;
  p.prank = 15;
  s.morale = Math.max(0, s.morale - 8);
  note(s, `${p.name} introduced a bug at ${j.name}!`);
  return true;
}
// BFS over tile centres makes the coworker navigate around desks, not teleport through them.
export function pathTo(p, j) {
  const start = [Math.floor(p.x), Math.floor(p.y)],
    goal = [j.x, j.y],
    q = [start],
    prev = new Map([[start.join(','), null]]);
  let found = null;
  for (let i = 0; i < q.length; i++) {
    const v = q[i];
    if (v[0] === goal[0] && v[1] === goal[1]) {
      found = v;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = [v[0] + dx, v[1] + dy],
        k = n.join(',');
      if (!prev.has(k) && walkable(n[0] + 0.5, n[1] + 0.5)) {
        prev.set(k, v);
        q.push(n);
      }
    }
  }
  if (!found) return [];
  const out = [];
  for (let v = found; v; v = prev.get(v.join(','))) out.unshift([v[0] + 0.5, v[1] + 0.5]);
  return out.slice(1);
}
export function tickOffice(s, dt) {
  if (s.phase !== 'playing') return;
  dt = Math.min(0.1, dt);
  s.time += dt;
  for (const p of s.players) {
    p.prank = Math.max(0, p.prank - dt);
    if (p.bot) {
      if (p.job) {
        const j = s.jobs[p.job.id];
        j.work += dt;
        if (j.work >= 2.5) complete(s, p);
      } else {
        const target = s.jobs
          .filter((j) => j.broken && !j.owner)
          .sort(
            (a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y),
          )[0];
        if (target) {
          if (nearby(p, target)) beginJob(s, p, target.id);
          else {
            const waypoint = pathTo(p, target)[0];
            if (waypoint) movePlayer(p, waypoint[0] - p.x, waypoint[1] - p.y, dt);
          }
        }
      }
    } else {
      movePlayer(p, p.dx, p.dy, dt);
      if (p.job && !nearby(p, s.jobs[p.job.id])) cancelJob(s, p);
    }
  }
  if (s.phase !== 'playing') return;
  if (s.time >= s.nextFault) {
    s.nextFault += 9;
    const j = s.jobs.find((j) => !j.broken);
    if (j) {
      j.broken = true;
      j.version++;
      note(s, `New ticket: ${j.name}`);
    }
  }
  s.morale = Math.max(0, s.morale - s.jobs.filter((j) => j.broken).length * dt * 0.32);
  if (s.time >= s.duration || s.morale <= 0) {
    s.phase = 'lost';
    note(s, 'Shift failed — start a new shift and try again.');
  }
}
export function publicOffice(s, id) {
  return {
    ...s,
    you: id,
    players: s.players.map((p) => ({
      ...p,
      job: p.job ? { ...p.job, puzzle: p.job.puzzle } : null,
    })),
  };
}
```

</details>

<details>
<summary>Complete server-kit.mjs</summary>

**File: `server-kit.mjs`** (the complete file, for comparison)
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

**File: `server.mjs`** (the complete file, for comparison)
```js
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, failure, roomCode } from './server-kit.mjs';
import {
  newOffice,
  addPlayer,
  startShift,
  tickOffice,
  beginJob,
  jobStep,
  prank,
  cancelJob,
  publicOffice,
} from './rules.js';
export function createOfficeServer({
  port = null,
  host,
  root = path.dirname(fileURLToPath(import.meta.url)),
  clock = Date.now,
} = {}) {
  const rooms = new Map(),
    sessions = new Map();
  const api = (method, url, b) => {
    if (method === 'POST' && url.pathname === '/api/join') {
      if (sessions.size >= 96) return failure(429, 'Server full');
      const code = roomCode(b.room);
      let s = rooms.get(code);
      if (!s) {
        s = newOffice();
        s.code = code;
        addPlayer(s, 'ai', 'Ada (AI)', true);
        rooms.set(code, s);
      }
      if (s.players.filter((p) => !p.bot).length >= 6) return failure(409, 'Room full');
      const id = randomUUID(),
        p = addPlayer(s, id, b.name);
      if (!s.host) s.host = id;
      sessions.set(id, { p, s, seen: clock(), inputAt: 0, actionAt: 0 });
      return publicOffice(s, id);
    }
    const id = method === 'GET' ? url.searchParams.get('id') : b.id,
      session = sessions.get(id);
    if (!session) return failure(404, 'Session expired; join again');
    const { p, s } = session;
    session.seen = clock();
    if (method === 'GET' && url.pathname === '/api/state') return publicOffice(s, id);
    if (method !== 'POST') return failure(404, 'Unknown endpoint');
    if (url.pathname === '/api/input') {
      if (!Number.isFinite(b.dx) || !Number.isFinite(b.dy))
        return failure(400, 'Finite axes required');
      p.dx = Math.max(-1, Math.min(1, b.dx));
      p.dy = Math.max(-1, Math.min(1, b.dy));
      session.inputAt = clock();
      return { ok: true };
    }
    if (url.pathname === '/api/start') {
      if (s.host !== id) return failure(403, 'Only the room host starts shifts');
      startShift(s);
      return publicOffice(s, id);
    }
    if (url.pathname === '/api/bot') {
      if (s.host !== id) return failure(403, 'Only the host changes AI');
      s.bot = !s.bot;
      if (!s.bot) {
        const ai = s.players.find((v) => v.bot);
        if (ai) cancelJob(s, ai);
        s.players = s.players.filter((v) => !v.bot);
      } else addPlayer(s, 'ai', 'Ada (AI)', true);
      return publicOffice(s, id);
    }
    if (clock() - session.actionAt < 120) return publicOffice(s, id);
    session.actionAt = clock();
    if (url.pathname === '/api/work') beginJob(s, p, b.job);
    else if (url.pathname === '/api/step') jobStep(s, p, b.value);
    else if (url.pathname === '/api/prank') prank(s, p);
    else if (url.pathname === '/api/cancel') cancelJob(s, p);
    else return failure(404, 'Unknown endpoint');
    return publicOffice(s, id);
  };
  const tick = (dt) => {
    const now = clock();
    for (const [id, v] of sessions) {
      if (now - v.seen > 30000) {
        cancelJob(v.s, v.p);
        v.s.players = v.s.players.filter((p) => p !== v.p);
        sessions.delete(id);
        if (v.s.host === id) v.s.host = v.s.players.find((p) => !p.bot)?.id;
      } else if (now - v.inputAt > 350) {
        v.p.dx = 0;
        v.p.dy = 0;
      }
    }
    for (const [code, s] of rooms) {
      if (!s.players.some((p) => !p.bot)) {
        rooms.delete(code);
        continue;
      }
      tickOffice(s, dt);
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
      '/lib/nord-ui.js': 'lib/nord-ui.js',
      '/ui/office.ui.json': 'ui/office.ui.json',
      '/rules.js': 'rules.js',
      '/style.css': 'style.css',
    },
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  createOfficeServer({ port: Number(process.env.PORT || 4383) });
```

</details>

<details>
<summary>Complete style.css</summary>

**File: `style.css`** (the complete file, for comparison)
```css
:host {
  display: block;
  min-height: 100vh;
  color: #e3edf4;
  font: 15px system-ui;
}
* {
  box-sizing: border-box;
}

main {
  max-width: 1150px;
  margin: auto;
  padding: 18px;
}
h1 {
  color: #69e0e5;
  letter-spacing: 3px;
  margin: 0;
}
header p {
  color: #eac47b;
  margin: 6px 0 16px;
}
nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 768px) 280px;
  gap: 20px;
}
canvas {
  width: 100%;
  border: 2px solid #48627a;
  image-rendering: pixelated;
}
button,
input {
  font: inherit;
  border: 1px solid #45637c;
  border-radius: 5px;
  padding: 9px;
  background: #20394f;
  color: #fff;
}
button {
  cursor: pointer;
  margin: 3px;
}
button:hover {
  background: #3c5c73;
}
input {
  width: 100%;
}
label {
  display: block;
  margin: 8px 0;
  font-size: 12px;
}
h2 {
  font-size: 18px;
  color: #eac47b;
}
p {
  line-height: 1.45;
}
#tickets,
#log {
  white-space: pre-line;
  font-size: 13px;
  line-height: 1.8;
}
#task {
  background: #253a51;
  padding: 12px;
  border-radius: 8px;
  min-height: 30px;
}
#task p {
  font-family: monospace;
}
#coffee {
  height: 28px;
  text-align: center;
  border: 1px solid #78927e;
  margin: 8px 0;
}
#result {
  font-size: 22px;
  color: #77f1b1;
}
footer {
  padding: 20px;
  color: #7895ad;
  font-size: 12px;
}
@media (max-width: 850px) {
  .layout {
    display: block;
  }
  aside {
    max-width: 500px;
  }
  main {
    padding: 8px;
  }
}
```

</details>

<details>
<summary>Complete ui/office.ui.json</summary>

**File: `ui/office.ui.json`** (the complete file, for comparison)
```json
{
  "version": 1,
  "name": "office",
  "page": true,
  "styles": [
    "style.css"
  ],
  "body": {
    "margin": "0",
    "background": "#0b1421"
  },
  "root": { "type": "box", "tag": "main", "name": "root", "children": [
    { "type": "box", "tag": "header", "children": [
      { "type": "label", "tag": "h1", "text": "NORD ENGINE OFFICE" },
      { "type": "label", "tag": "p", "text": "Ship the engine. Fix the coffee. Survive your interns." }
    ] },
    { "type": "box", "tag": "nav", "children": [
      { "name": "solo", "type": "button", "text": "Solo + AI practice" },
      { "name": "start", "type": "button", "text": "Start / Restart shift" },
      { "name": "bot", "type": "button", "text": "Toggle AI coworker" },
      { "name": "pause", "type": "button", "text": "Pause solo" }
    ] },
    { "class": "layout", "type": "box", "tag": "section", "children": [
      { "type": "box", "children": [
        { "type": "canvas", "w": 768, "h": 512, "attrs": {"aria-label": "Office game map"}, "name": "map" },
        { "name": "hud", "type": "label", "tag": "h2" },
        { "type": "label", "tag": "p", "text": "WASD / arrows: walk · E: work nearby · X: introduce a bug · Esc: cancel task" },
        { "name": "task", "type": "box" },
        { "name": "result", "type": "label", "tag": "p" }
      ] },
      { "type": "box", "tag": "aside", "children": [
        { "type": "label", "tag": "h2", "text": "Invite interns" },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Name" },
          { "name": "name", "type": "input", "value": "Intern", "maxlength": "20" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Room" },
          { "name": "room", "type": "input", "value": "NORD", "maxlength": "8" }
        ] },
        { "type": "box", "tag": "label", "children": [
          { "type": "label", "tag": "span", "text": "Server" },
          { "name": "server", "type": "input" }
        ] },
        { "name": "join", "type": "button", "text": "Join online office" },
        { "name": "network", "type": "label", "tag": "p", "text": "Run node server.mjs to host friends. Solo works without a server." },
        { "type": "label", "tag": "h2", "text": "Tickets" },
        { "name": "tickets", "type": "box" },
        { "type": "label", "tag": "h2", "text": "Office log" },
        { "name": "log", "type": "box" },
        { "type": "label", "tag": "p", "text": "Host starts the shift. Finish 12 tasks in 150 seconds. Too many open bugs drain morale. X pranks a fixed nearby station, with a 15-second cooldown." },
        { "type": "label", "tag": "p", "text": "Ada is a local pathfinding AI coworker, no account or API key needed." }
      ] }
    ] },
    { "type": "box", "tag": "footer", "children": [
      { "type": "label", "tag": "span", "text": "Crowelian 2026 + Sonnet · Original code and canvas graphics" }
    ] }
  ] }
}
```

</details>
