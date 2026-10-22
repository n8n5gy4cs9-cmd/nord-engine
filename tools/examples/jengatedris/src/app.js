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
