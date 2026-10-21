import { Save } from './save.js';
import { newBoards, validateBoards, portfolioHTML } from './model.js';
import { createFlat } from './flat.js';
import { createWorld } from './world.js';
import { download } from './desk.js';
export async function mount(root) {
  root.innerHTML = /* HTML */ `
    <link rel="stylesheet" href="style.css" />
    <main>
      <header>
        <div class="brand">
          <span class="mascot"></span>
          <div>
            <h1>Paper Worlds</h1>
            <p>A little room for big ideas.</p>
          </div>
        </div>
        <div>
          <button id="mode">Explore 3D desk</button>
          <button id="save">Save</button>
          <button id="export">Export desk</button>
        </div>
      </header>
      <section class="workbench">
        <aside>
          <label>
            YOUR BOARDS
            <select id="boards"></select>
          </label>
          <label>
            Tool
            <select id="tool">
              <option value="pen">Pen</option>
              <option value="hand">Pan workspace</option>
              <option value="rect">Rectangle / door</option>
              <option value="circle">Circle</option>
              <option value="sticky">Sticky note</option>
              <option value="text">Text</option>
            </select>
          </label>
          <label>
            Ink
            <input id="color" type="color" value="#32a7a0" />
          </label>
          <label>
            Text / rectangle label
            <textarea id="text" placeholder="Type door for a portal rectangle"></textarea>
          </label>
          <button id="undo">Undo last shape</button>
          <button id="fit">Fit page</button>
          <div class="rule"></div>
          <h3>Make it playful</h3>
          <button id="balls">Bounce circles</button>
          <button id="maze">Play drawn maze</button>
          <button id="stop">Stop minigame</button>
          <button id="shake">Shake stickies</button>
          <button id="ride">Ride pen graph</button>
          <div class="rule"></div>
          <button id="png">Download PNG</button>
          <button id="json">Backup JSON</button>
          <label>
            Import desk JSON
            <input id="import" type="file" accept=".json" />
          </label>
          <p>
            Wheel zooms. Pan tool moves the workspace. In 3D drag to orbit and wheel to
            zoom; click a paper to edit, a door to travel, a sticky to flick.
          </p>
        </aside>
        <div>
          <div class="titlebar">
            <b id="title"></b>
            <span id="badge">2D STUDIO</span>
          </div>
          <div id="flat"></div>
          <canvas id="world" hidden></canvas>
          <p id="status">
            Draw a rectangle labelled door to link the next board. Draw a graph with the
            pen for a camera ride.
          </p>
        </div>
      </section>
      <footer>10 boards · local-first · Crowelian 2026 + Sonnet</footer>
    </main>
  `;
  const $ = (id) => root.querySelector('#' + id);
  const save = new Save('paper-worlds');
  let boards = save.get('boards', null),
    active = 0,
    world = null,
    in3d = false,
    revision = 0,
    saved = 0;
  const embedded = document.querySelector('#desk-data');
  if (embedded) {
    try {
      const v = JSON.parse(embedded.textContent);
      if (validateBoards(v)) boards = v;
    } catch {}
  }
  if (!validateBoards(boards)) boards = newBoards();
  const say = (t) => ($('status').textContent = t);
  const flat = await createFlat(
    $('flat'),
    () => boards[active],
    () => {
      revision++;
      say('Edited · autosaving locally');
    },
  );
  const options = () => {
    $('boards').replaceChildren(
      ...boards.map((b, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = `${String(i + 1).padStart(2, '0')} ${b.title}`;
        return o;
      }),
    );
    $('boards').value = active;
    $('title').textContent = boards[active].title;
  };
  options();
  const tool = () => flat.setTool($('tool').value, $('color').value, $('text').value);
  for (const id of ['tool', 'color', 'text']) $(id).addEventListener('input', tool);
  tool();
  flat.fit();
  // Serialize view changes so double-clicks cannot leave an orphaned 3D engine.
  let modeChange = Promise.resolve();
  function mode(to3d) {
    modeChange = modeChange.then(() => changeMode(to3d));
    return modeChange;
  }
  async function changeMode(to3d) {
    if (to3d === in3d) return;
    try {
      if (to3d) {
        say('Preparing the desk and Havok…');
        world?.dispose();
        world = await createWorld($('world'), boards, (id) => {
          active = id;
          options();
          flat.redraw();
          mode(false);
        });
        world.refresh(active, flat.canvas);
        flat.stopPlay();
        flat.game.scene.pause('default');
      }
      in3d = to3d;
      $('flat').hidden = in3d;
      $('world').hidden = !in3d;
      $('mode').textContent = in3d ? 'Return to 2D studio' : 'Explore 3D desk';
      $('badge').textContent = in3d ? '3D DESK' : '2D STUDIO';
      if (in3d) world.resize();
      else {
        world?.setActive(false);
        world?.scene.detachControl();
        flat.game.scene.resume('default');
      }
      say(
        in3d
          ? 'Orbit the desk. Click a paper, glowing door or sticky.'
          : 'Wheel zooms · Pan tool moves · edit the selected board',
      );
    } catch (e) {
      say(e.message);
    }
  }
  $('mode').onclick = () => mode(!in3d);
  $('boards').onchange = () => {
    active = Number($('boards').value);
    flat.stopPlay();
    flat.redraw();
    options();
    if (in3d) world.focus(active);
  };
  $('undo').onclick = () => {
    boards[active].shapes.pop();
    flat.redraw();
    revision++;
  };
  $('fit').onclick = () => flat.fit();
  $('balls').onclick = () => {
    mode(false);
    flat.play('balls');
    say('Circles are now Arcade balls. Stop minigame to edit again.');
  };
  $('maze').onclick = () => {
    mode(false);
    flat.play('maze');
    say(
      'Arrow keys move the tiny coral player to the lower-right goal. Rectangles are solid maze walls.',
    );
  };
  $('stop').onclick = () => {
    flat.stopPlay();
    say('Back to drawing.');
  };
  $('flat').addEventListener('mazewin', () =>
    say('MAZE COMPLETE! You walked your own drawing.'),
  );
  $('shake').onclick = async () => {
    await mode(true);
    world?.shake();
  };
  $('ride').onclick = async () => {
    await mode(true);
    try {
      world?.ride(boards[active]);
    } catch (e) {
      say(e.message);
    }
  };
  function persist() {
    try {
      save.set('boards', boards);
      saved = revision;
      say('Saved on this device · ' + new Date().toLocaleTimeString());
    } catch (e) {
      say('Storage full or unavailable: export JSON to keep your work. ' + e.message);
    }
  }
  $('save').onclick = persist;
  const timer = setInterval(() => {
    if (revision !== saved) persist();
  }, 1500);
  $('png').onclick = () =>
    flat.canvas.toBlob((blob) =>
      download('paper-' + (active + 1) + '.png', blob, 'image/png'),
    );
  $('json').onclick = () =>
    download('paper-worlds.json', JSON.stringify(boards, null, 2));
  $('import').onchange = async () => {
    const file = $('import').files[0];
    if (!file) return;
    if (file.size > 5000000) {
      say('Desk JSON must be under 5 MB.');
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      if (!validateBoards(data))
        throw Error('Expected ten boards with supported shapes.');
      boards = data;
      active = 0;
      revision++;
      options();
      flat.redraw();
      await mode(false);
      persist();
    } catch (e) {
      say(e.message);
    }
  };
  $('export').onclick = async () => {
    try {
      persist();
      const response = await fetch('portfolio.html');
      if (!response.ok) throw Error('Missing portfolio.html');
      const template = await response.text();
      download('my-paper-desk.html', portfolioHTML(template, boards), 'text/html');
      say(
        'Desk HTML downloaded. Put it beside the exported lib/vendor files, then serve that folder over HTTP.',
      );
    } catch (e) {
      say(e.message);
    }
  };
  let pinch = 0;
  const pinchStart = (e) => {
      if (e.touches.length === 2)
        pinch = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
    },
    pinchMove = (e) => {
      if (e.touches.length === 2 && pinch) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (dist < pinch * 0.65) {
          pinch = 0;
          mode(true);
        }
      }
    };
  $('flat').addEventListener('touchstart', pinchStart, { passive: true });
  $('flat').addEventListener('touchmove', pinchMove, { passive: true });
  window.__paper = {
    get boards() {
      return boards;
    },
    get active() {
      return active;
    },
    get world() {
      return world;
    },
    flat,
    get in3d() {
      return in3d;
    },
  };
  return () => {
    clearInterval(timer);
    if (revision !== saved) persist();
    world?.dispose();
    flat.dispose();
    root.replaceChildren();
  };
}
