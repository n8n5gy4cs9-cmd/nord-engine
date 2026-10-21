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
