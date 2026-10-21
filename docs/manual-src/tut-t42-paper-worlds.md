---
title: T42 Paper Worlds — draw in 2D, explore your ideas in 3D
section: Tutorials
order: 42
summary: A complete local-first drawing app with ten paper boards, Phaser tools, Babylon textures, Havok sticky toys, doors, minigames and an exportable 3D portfolio. Full source and original sprites.
---

Build **Paper Worlds**, a useful drawing studio that becomes a playful 3D desk. Sketch with a pen, add shapes, text and sticky notes, zoom around your workspace, then explore ten papers in Babylon. Flick sticky notes with Havok, walk through a drawn door, play a maze or ride a graph you sketched. Save locally and share an actual 3D desk, with all source and assets supplied.

**Download:** [Complete Paper Worlds project, source and sprites](assets/downloads/paper-worlds-source.zip). Extract into a writable folder, open `nord.project.json` in Nord and press **Play**. No npm, account or external library download is required. This is an original app inspired by the usefulness of sketch tools such as Excalidraw; it does not copy Excalidraw source or assets.

![Paper Worlds drawing studio](assets/screenshots/ed-paper-studio.png)

## 1. Understand the actual Nord setup

The working project uses Nord's **HTML tier** as the host for a local Phaser 4.2.1 drawing view and a local Babylon 3D view. Nord currently selects one scene backend per engine project; there is no “add Babylon adapter” setting that converts an existing Phaser Entity into a Babylon Entity. This tutorial implements the bridge explicitly through shared board data and a canvas texture, so the downloaded app runs in the current engine.

Open `app.js` in Nord's code editor. It implements `mount(root)` and wires the views to a common model. The conceptual BoardManager is this module; the Pen is an input tool in `flat.js`; Sticky is one saved shape rendered as a 2D note or a 3D rigid box. This makes the boundary visible and teachable without inventing unsupported Inspector components.

| File | Role |
| --- | --- |
| `model.js` | Ten boards, supported shape records, validation and shared painting |
| `flat.js` | Phaser canvas texture, tools, pan/zoom and Arcade minigames |
| `world.js` | Babylon papers, sticky physics, drawn doors and graph ride |
| `desk.js` | Local Babylon/Havok setup, lighting, texture and download helpers |
| `app.js` | Menus, active board, Nord Save, import/export and view switching |
| `portfolio.html` | Template for the exported 3D portfolio page |
| `save.js` | Nord's existing versioned Save class, backed by localStorage |
| `assets/dev-desk-sprites.png` | Supplied original stationery/mascot sprite sheet |

**First edit:** change the subtitle in `app.js`, stop Play and start again. Use the Console for syntax errors. The complete source listings at the end match the downloadable project.

## 2. Make drawing data independent of the renderer

A board has an ID, a title and a `shapes` array. Shapes store their kind, position, colour and geometry. A pen stroke is an array of points; a rectangle stores X/Y/width/height; text and stickies store a string. The supplied ten-board initializer includes one note, one door and a graph to make the first exploration useful.

```js
const sticky = {
  kind: 'sticky', x: 110, y: 190, w: 230, h: 160,
  text: 'Draw. Zoom out. Play.', color: '#f5d889'
};
```

`paint(context, board)` draws this data into a 1200×850 page. It also paints a subtle dot grid. The workspace can pan far beyond the page and zoom, while each printable board has a fixed page size. This is a practical large workspace with ten pages, not an unbounded document database.

A renderer is replaceable because it reads these records. Do not save native Phaser GameObjects or Babylon meshes into JSON: they contain runtime resources and cycles. Save the shape record and rebuild the view.

**Learning check:** change a saved sticky's text in `newBoards()` on a fresh browser save, or add a note through the UI. The note should appear in the 2D page and in the paper texture in 3D. Existing saved boards intentionally override the initializer.

## 3. Build the Phaser pen and shape tools

`createFlat()` creates a local Phaser game with Arcade available for the minigames. Its drawing surface is a Phaser CanvasTexture shown by one Image. This keeps many strokes inexpensive while Phaser owns input, camera and the game loop.

On pointer down, convert screen coordinates through `camera.getWorldPoint()`. Create a draft shape. Pointer movement appends pen points or adjusts rectangle/circle dimensions. Pointer up commits the draft to the active board and increments the save revision. Negative rectangle dimensions are normalized so dragging up-left still produces a valid rectangle.

```js
const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
```

Use this conversion before storing points; raw browser pixels would drift when zoomed. The Pan tool changes camera scroll instead of creating shapes. Wheel input changes camera zoom. **Fit page** returns to a useful framing. Text and Sticky place a record using the text field; Rectangle uses the field value `door` as a special label. Undo removes the last committed shape.

Try pen, rectangle, circle, text and sticky once before moving on. The app intentionally keeps selection/editing simple: use Undo and redraw rather than expecting a full vector editor with handles and layers.

## 4. Turn the page into a live 3D paper

Click **Explore 3D desk**. Ten Babylon planes sit over a lit desk. `world.js` creates a DynamicTexture for each board and uses `paint()` to reproduce its page. For the active board it copies the actual Phaser CanvasTexture canvas into Babylon's texture context:

```js
const context = paper.texture.getContext();
context.drawImage(flat.canvas, 0, 0, 1024, 768);
paper.texture.update();
```

This is the concrete bridge: a browser canvas can supply pixels to a Babylon DynamicTexture. In a scene-based Phaser script, `entity.native` is your route to a native Phaser object; here `flat.canvas` is explicit because the HTML host owns the Phaser game itself.

The paper material uses the texture as an unlit emissive surface so handwriting stays readable from either side. A directional light and shadow generator illuminate the desk and sticky bodies; paper meshes cast shadows onto the desk. Do not turn a white page into a black panel by relying on a back-facing plane's diffuse lighting.

Orbit by dragging, zoom with the wheel, and click a paper to return to its 2D editor. The board selector can focus a board in 3D. A two-finger pinch inward also opens the desk on touch devices; the explicit mode button is the reliable alternative on desktop.

![Ten papers, a drawn door and physical sticky notes](assets/screenshots/ed-paper-desk.png)

## 5. Give stickies real Havok bodies

Every sticky record creates a small 3D box above its paper. `desk.js` loads the included Havok JavaScript and WASM locally, enables a Babylon HavokPlugin, and gives the desk a static box collider. Sticky boxes receive dynamic PhysicsAggregates with mass, friction and restitution.

```js
const aggregate = new BABYLON.PhysicsAggregate(mesh,
  BABYLON.PhysicsShapeType.BOX,
  { mass: .2, restitution: .55, friction: .45 }, scene);
```

Click a sticky to apply an impulse, or click **Shake stickies** to scatter the collection. Actual contact simulation makes them fall, bounce and settle. The 2D note remains a static drawing record. The shared identity is its data; the Phaser and Babylon views use separate native objects and physics systems. Returning to drawing preserves the note, while rebuilding the desk resets the toy simulation.

**Learning check:** raise restitution a little and compare the bounce. Do not put Arcade and Havok bodies on the same native object: Arcade is 2D, and a Babylon rigid body belongs to the 3D world.

## 6. Draw a door and travel to another board

Choose Rectangle, type `door` in the label field and draw a rectangle. In 3D, `world.js` finds that label and builds three glowing boxes as a frame. Its pick metadata points to the next board, wrapping after board ten.

Clicking the frame interpolates the orbit target and camera radius toward the linked board, then opens its editor. A normal paper click edits that paper directly. The door is a small interaction convention: your drawing data triggers creation of 3D geometry.

Try making a door on board two and using it to reach board three. The supplied implementation has ten linked boards; it does not claim unlimited generated worlds. To add explicit destinations, store `targetBoard` on a rectangle and validate it before creating pick metadata.

## 7. Play three things you drew

**Bounce circles:** draw circles and click Bounce circles. Each circle gets a temporary Phaser Arcade body, bounce, gravity and world bounds. The circle drawing remains saved; the moving toy is temporary. Stop minigame removes the temporary objects.

**Play drawn maze:** draw ordinary rectangles as walls, leaving a route from the upper-left to the lower-right. Click Play drawn maze and use arrows to move the tiny coral player. The goal is the teal square near the page's lower-right. Maze rectangles become static Arcade bodies; door-labelled rectangles are excluded. World bounds use the full page dimensions so the goal remains reachable. Stop returns to editing.

**Ride pen graph:** sketch a pen line with at least four points, then click Ride pen graph. The last suitable stroke maps to a 3D path, becomes a smooth Catmull–Rom tube, and drives a FreeCamera along sampled points. When the ride finishes, the orbit camera returns. This is a visual camera ride, not a physical rollercoaster simulation.

These features reuse saved geometry while changing its interpretation. Keep the play objects separate so running a minigame cannot silently move the original drawing.

## 8. Save, back up and handle storage limits

The app uses Nord's Save class, the same service exposed as `game.save` in scene scripts. The HTML host creates an explicit instance:

```js
const save = new Save('paper-worlds');
save.set('boards', boards);
```

A revision counter triggers autosave after edits. Save writes immediately. JSON backup downloads the editable data, and Import checks for ten supported boards before replacing your workspace. Browser localStorage is per origin: changing the dev-server port or clearing site data can make the old save unavailable. Export JSON before moving machines or clearing storage.

If storage is full or blocked, the UI tells you to make a JSON backup. The app remains useful without a login or connection. Physics poses are intentionally temporary and are not included in the document save.

## 9. Export a portfolio desk

Download PNG produces the active page as a normal browser download; choose your project's `dist` folder in the save dialog if that is where you want it. Browsers cannot silently write to an arbitrary folder on disk.

**Export desk** embeds all ten boards into `portfolio.html` and downloads `my-paper-desk.html`. Export the complete Nord project as HTML, place this downloaded page beside its exported `world.js`, `model.js`, `desk.js`, vendor and asset folders, and serve that folder over HTTP. Share the folder as a zip or host it. The page opens directly in the 3D desk, supports orbiting/focusing papers and door travel, and carries your drawings rather than the recipient's local save. The required local libraries are included in the full project download. `portfolioHTML()` encodes the boards as JSON data and escapes `<` before embedding it, so text such as `</script>` remains drawing content. Its replacement callback also preserves literal `$&` and other dollar tokens.

Optional multiplayer/hosting: add a Node relay for validated drawing operations and serve the HTML export from the same origin; no Node implementation is included here.

**WASM, briefly:** WebAssembly is compiled code loaded by JavaScript; this app already uses the supplied Havok `.wasm` for physics, while the drawing/UI remains an HTML/JavaScript app. Nord's Rust/WASM target is a separate route for Rust applications, not a switch that compiles this JavaScript into Rust.

## 10. Finish with a focused check

Draw one stroke and note, save and reload, check the note survives, explore the desk, flick a sticky, use a door, try a circle and a maze, then export PNG, JSON and the desk. The automated smoke checks real Phaser drawing/save, Babylon/Havok, graph ride and desk download; full touch gestures and creative usability still benefit from human testing.

## Complete project source

All authored files follow in the manual's offline CodeMirror viewers. The complete archive also includes the original sprite sheet and pinned Phaser, Babylon and Havok libraries with licences. Minified dependencies are supplied in the archive rather than expanded as teaching code.

<!-- GENERATED GAME SOURCE: regenerate with node tools/build-code-workshops.mjs -->

### app.js

```js
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
```

<details>
<summary>Complete desk.js</summary>

```js
// Cache the pending promise too: rapid view changes must wait for the same script.
const scriptLoads = new Map();
export function loadScript(src) {
  if (!scriptLoads.has(src)) {
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.dataset.local = src;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        scriptLoads.delete(src);
        reject(Error('Cannot load ' + src));
      };
      document.head.append(script);
    });
    scriptLoads.set(src, pending);
  }
  return scriptLoads.get(src);
}
export async function createDesk(canvas, { physics = true } = {}) {
  await loadScript('vendor/babylonjs/babylon.js');
  const B = window.BABYLON;
  const engine = new B.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    }),
    scene = new B.Scene(engine);
  scene.clearColor = B.Color4.FromHexString('#101b2bff');
  const camera = new B.ArcRotateCamera(
    'Orbit',
    -Math.PI / 2,
    0.67,
    28,
    new B.Vector3(0, 0, 0),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 70;
  camera.wheelPrecision = 25;
  camera.minZ = 0.1;
  const fill = new B.HemisphericLight('Sky', new B.Vector3(0, 1, 0), scene);
  fill.intensity = 0.65;
  const light = new B.DirectionalLight('Sun', new B.Vector3(-0.4, -1, 0.5), scene);
  light.position.set(8, 18, -8);
  light.intensity = 1.2;
  const shadows = new B.ShadowGenerator(1024, light);
  shadows.useBlurExponentialShadowMap = true;
  shadows.blurKernel = 16;
  const mat = new B.StandardMaterial('Desk surface', scene);
  mat.diffuseColor = B.Color3.FromHexString('#253a46');
  mat.specularColor = new B.Color3(0.1, 0.1, 0.1);
  const desk = B.MeshBuilder.CreateBox(
    'Desk',
    { width: 45, depth: 35, height: 0.6 },
    scene,
  );
  desk.position.y = -0.45;
  desk.material = mat;
  desk.receiveShadows = true;
  const aggregates = [];
  if (physics) {
    await loadScript('vendor/havok/HavokPhysics_umd.js');
    const havok = await window.HavokPhysics({
      locateFile: (name) => 'vendor/havok/' + name,
    });
    scene.enablePhysics(new B.Vector3(0, -9.81, 0), new B.HavokPlugin(true, havok));
    aggregates.push(
      new B.PhysicsAggregate(
        desk,
        B.PhysicsShapeType.BOX,
        { mass: 0, restitution: 0.2 },
        scene,
      ),
    );
  }
  const paper = (name, width, height, paint) => {
    const mesh = B.MeshBuilder.CreatePlane(
      name,
      { width, height, sideOrientation: B.Mesh.DOUBLESIDE },
      scene,
    );
    mesh.rotation.x = Math.PI / 2;
    const texture = new B.DynamicTexture(
      name + ' texture',
      { width: 1024, height: 768 },
      scene,
      false,
    );
    const material = new B.StandardMaterial(name + ' material', scene);
    material.emissiveTexture = texture;
    material.emissiveColor = B.Color3.White();
    material.disableLighting = true;
    material.diffuseColor = B.Color3.Black();
    material.specularColor = B.Color3.Black();
    material.backFaceCulling = false;
    mesh.material = material;
    shadows.addShadowCaster(mesh);
    mesh.receiveShadows = true;
    paint?.(texture.getContext());
    texture.update();
    return { mesh, texture, material };
  };
  const box = (name, pos, color = '#f6d675', mass = 0.2) => {
    const mesh = B.MeshBuilder.CreateBox(
      name,
      { width: 1.1, height: 0.13, depth: 0.9 },
      scene,
    );
    mesh.position.copyFromFloats(...pos);
    const material = new B.StandardMaterial(name + ' paint', scene);
    material.diffuseColor = B.Color3.FromHexString(color);
    mesh.material = material;
    shadows.addShadowCaster(mesh);
    const aggregate = physics
      ? new B.PhysicsAggregate(
          mesh,
          B.PhysicsShapeType.BOX,
          { mass, restitution: 0.55, friction: 0.45 },
          scene,
        )
      : null;
    if (aggregate) aggregates.push(aggregate);
    return { mesh, aggregate };
  };
  const update = new Set(),
    render = () => {
      for (const fn of update) fn(Math.min(0.05, engine.getDeltaTime() / 1000));
      scene.render();
    };
  engine.runRenderLoop(render);
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);
  return {
    B,
    engine,
    scene,
    camera,
    shadows,
    paper,
    box,
    update,
    resize,
    setActive(on) {
      engine.stopRenderLoop(render);
      if (on) engine.runRenderLoop(render);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      for (const a of aggregates) a.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
export function download(name, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

</details>

<details>
<summary>Complete flat.js</summary>

```js
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
```

</details>

<details>
<summary>Complete index.html</summary>

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="nord-app-id" content="com.crowelian.paperworlds"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paper Worlds — a playful 2D/3D drawing desk</title>
<style>html,body{margin:0;height:100%;background:#2e3440}#app{height:100vh}</style></head>
<body><div id="app"></div>
<script type="module">
import { mount } from './app.js';
try { await mount(document.getElementById('app')); window.__nord_ready = true; } catch (e) { console.error(e); window.__nord_error = String(e); }
</script></body></html>
```

</details>

<details>
<summary>Complete model.js</summary>

```js
export const WIDTH = 1200,
  HEIGHT = 850;
export function newBoards() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i,
    title: [
      'Launch plan',
      'Build ideas',
      'Sketchbook',
      'Links & doors',
      'Tiny maze',
      'Release notes',
      'Experiments',
      'Garden',
      'Roadmap',
      'Portfolio',
    ][i],
    shapes:
      i === 0
        ? [
            {
              kind: 'text',
              x: 90,
              y: 90,
              text: 'Make something worth exploring.',
              color: '#23384b',
            },
            {
              kind: 'sticky',
              x: 110,
              y: 190,
              w: 230,
              h: 160,
              text: 'Draw. Zoom out. Play.',
              color: '#f5d889',
            },
            {
              kind: 'rect',
              x: 650,
              y: 230,
              w: 240,
              h: 330,
              text: 'door',
              color: '#6a9cff',
            },
            {
              kind: 'pen',
              color: '#32a7a0',
              points: [
                [100, 620],
                [210, 540],
                [330, 590],
                [460, 420],
                [610, 490],
                [760, 350],
                [1000, 470],
              ],
            },
          ]
        : [],
  }));
}
export function paint(ctx, board, { background = true } = {}) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  if (background) {
    ctx.fillStyle = '#faf7ed';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#d5d9d6';
    for (let y = 25; y < HEIGHT; y += 25)
      for (let x = 25; x < WIDTH; x += 25) ctx.fillRect(x, y, 1, 1);
  }
  for (const s of board.shapes) {
    ctx.strokeStyle = s.color || '#23384b';
    ctx.fillStyle = s.color || '#23384b';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (s.kind === 'pen') {
      ctx.beginPath();
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    if (s.kind === 'rect') {
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      if (s.text === 'door') {
        ctx.fillStyle = '#6a9cff22';
        ctx.fillRect(s.x, s.y, s.w, s.h);
      }
    }
    if (s.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(4, Math.abs(s.w)), 0, 7);
      ctx.stroke();
    }
    if (s.kind === 'sticky') {
      ctx.shadowColor = '#21364b33';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#26384b';
    }
    if (s.text) {
      ctx.font = s.kind === 'text' ? '32px system-ui' : '24px system-ui';
      String(s.text)
        .split('\n')
        .slice(0, 8)
        .forEach((line, i) =>
          ctx.fillText(line.slice(0, 60), s.x + 12, s.y + 36 + i * 30),
        );
    }
  }
}
export function validateBoards(data) {
  const num = (v) => Number.isFinite(v) && Math.abs(v) <= 40000;
  const valid = (s) =>
    s &&
    ['pen', 'rect', 'circle', 'sticky', 'text'].includes(s.kind) &&
    (!s.color || /^#[0-9a-f]{6}$/i.test(s.color)) &&
    (!s.text || (typeof s.text === 'string' && s.text.length <= 10000)) &&
    (s.kind === 'pen'
      ? Array.isArray(s.points) &&
        s.points.length <= 10000 &&
        s.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(num))
      : num(s.x) && num(s.y) && (s.kind === 'text' || (num(s.w) && num(s.h))));
  return (
    Array.isArray(data) &&
    data.length === 10 &&
    data.every(
      (b) =>
        b &&
        typeof b.title === 'string' &&
        b.title.length <= 200 &&
        Array.isArray(b.shapes) &&
        b.shapes.length <= 1000 &&
        b.shapes.every(valid),
    )
  );
}

// Embed JSON as data, preserving literal replacement tokens and preventing </script> markup.
export function portfolioHTML(template, boards) {
  const data = JSON.stringify(boards).replaceAll('<', '\\u003c');
  return template.replace('/*BOARD_DATA*/', () => data);
}
```

</details>

<details>
<summary>Complete nord.project.json</summary>

```json
{
  "format": 1,
  "name": "Paper Worlds",
  "id": "com.crowelian.paperworlds",
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
<summary>Complete portfolio.html</summary>

```html
<!doctype html>
<html lang="en">
  <meta charset="utf-8" />
  <title>My Paper Worlds desk</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body {
      margin: 0;
      background: #101b2b;
      color: #eaf2ef;
      font: 16px system-ui;
    }
    header {
      position: absolute;
      z-index: 2;
      padding: 16px;
    }
    canvas {
      width: 100vw;
      height: 100vh;
      display: block;
      touch-action: none;
    }
    button {
      padding: 10px;
      margin: 8px;
    }
  </style>
  <header>
    <b>My Paper Worlds desk</b>
    <p id="hint">Orbit, click papers to focus; click glowing doors to travel.</p>
    <button id="all">View all boards</button>
  </header>
  <canvas id="desk"></canvas>
  <script id="desk-data" type="application/json">
    /*BOARD_DATA*/
  </script>
  <script type="module">
    import { createWorld } from './world.js';
    const boards = JSON.parse(document.querySelector('#desk-data').textContent);
    try {
      const world = await createWorld(document.querySelector('canvas'), boards, (id) => {
        world.focus(id);
        document.querySelector('#hint').textContent = boards[id].title;
      });
      document.querySelector('#all').onclick = () => {
        world.camera.setTarget(world.B.Vector3.Zero());
        world.camera.radius = 28;
      };
    } catch (e) {
      document.querySelector('#hint').textContent =
        e.message + ' — serve beside the exported project files.';
    }
  </script>
</html>
```

</details>

<details>
<summary>Complete save.js</summary>

```js
// Versioned save slots on top of localStorage (or any Storage-like object).
export class Save {
  constructor(gameId, { version = 1, storage = globalThis.localStorage, migrate = null } = {}) {
    this.prefix = `nord:${gameId}:`;
    this.version = version;
    this.storage = storage ?? new MemoryStorage();
    this.migrate = migrate; // (data, fromVersion) => data
    this.slotId = 0;
  }
  slot(n) { this.slotId = n; return this; }
  #key(n = this.slotId) { return `${this.prefix}slot${n}`; }
  #read(n) {
    try {
      const raw = this.storage.getItem(this.#key(n));
      if (!raw) return { v: this.version, data: {} };
      const o = JSON.parse(raw);
      if (o.v < this.version && this.migrate) { o.data = this.migrate(o.data, o.v); o.v = this.version; }
      return o;
    } catch { return { v: this.version, data: {} }; }
  }
  get(k, def) { const d = this.#read().data; return k in d ? d[k] : def; }
  set(k, v) { const o = this.#read(); o.data[k] = v; o.v = this.version; o.t = Date.now(); this.storage.setItem(this.#key(), JSON.stringify(o)); }
  all() { return this.#read().data; }
  has(n = this.slotId) { return this.storage.getItem(this.#key(n)) != null; }
  delete(n = this.slotId) { this.storage.removeItem(this.#key(n)); }
}
export class MemoryStorage {
  #m = new Map();
  getItem(k) { return this.#m.has(k) ? this.#m.get(k) : null; }
  setItem(k, v) { this.#m.set(k, String(v)); }
  removeItem(k) { this.#m.delete(k); }
}
```

</details>

<details>
<summary>Complete style.css</summary>

```css
html,
body {
  height: auto;
  min-height: 100%;
  background: #101b2b;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  color: #dbe9ee;
  font: 14px system-ui;
}
main {
  max-width: 1400px;
  margin: auto;
  padding: 22px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding-bottom: 20px;
}
.brand {
  display: flex;
  gap: 14px;
  align-items: center;
}
h1 {
  margin: 0;
  font-size: 30px;
  letter-spacing: -1px;
}
header p {
  margin: 5px 0;
  color: #8ba3af;
}
.mascot {
  width: 62px;
  height: 62px;
  display: inline-block;
  background: url(assets/dev-desk-sprites.png) 0 100%/400% 200%;
}
button,
input,
select,
textarea {
  font: inherit;
  color: #e7f2f5;
  background: #21374a;
  border: 1px solid #3e596e;
  border-radius: 7px;
  padding: 9px;
}
button {
  cursor: pointer;
  margin: 4px 0;
}
button:hover {
  background: #335269;
}
header button:first-child {
  background: #287e7a;
}
label {
  display: block;
  margin: 12px 0;
  font-size: 12px;
  color: #9bb4c1;
}
select,
textarea {
  display: block;
  width: 100%;
  margin-top: 6px;
}
textarea {
  height: 76px;
  resize: vertical;
}
aside button {
  width: 100%;
  text-align: left;
}
.workbench {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 20px;
}
aside {
  padding: 8px 16px;
  background: #15283a;
  border-radius: 12px;
}
aside p {
  font-size: 12px;
  line-height: 1.6;
  color: #9bb4c1;
}
.rule {
  height: 1px;
  background: #34495b;
  margin: 15px 0;
}
h3 {
  font-size: 12px;
  color: #88d4c8;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.titlebar {
  display: flex;
  justify-content: space-between;
  background: #203447;
  padding: 14px;
  border-radius: 10px 10px 0 0;
}
#badge {
  font-size: 11px;
  color: #88d4c8;
}
#flat,
#world {
  width: 100%;
  height: 640px;
  background: #dce5e6;
  overflow: hidden;
  border-radius: 0 0 10px 10px;
}
#flat canvas {
  max-width: 100%;
  display: block;
}
#world {
  touch-action: none;
}
#status {
  color: #a8c4cd;
  line-height: 1.6;
}
footer {
  padding-top: 20px;
  color: #718e9e;
  font-size: 12px;
}
[hidden] {
  display: none !important;
}
@media (max-width: 850px) {
  .workbench {
    grid-template-columns: 160px minmax(0, 1fr);
  }
  main {
    padding: 8px;
  }
  header {
    flex-wrap: wrap;
  }
}
```

</details>

<details>
<summary>Complete world.js</summary>

```js
import { createDesk } from './desk.js';
import { WIDTH, HEIGHT, paint } from './model.js';
export async function createWorld(canvas, boards, select) {
  const d = await createDesk(canvas),
    { B, scene, camera } = d;
  const papers = [],
    stickies = [],
    portals = [];
  let flying = null,
    ride = null;
  boards.forEach((board, i) => {
    const p = d.paper('Board ' + i, 6, 4.25, (ctx) => {
      ctx.save();
      ctx.scale(1024 / WIDTH, 768 / HEIGHT);
      paint(ctx, board);
      ctx.restore();
    });
    p.mesh.position.set(((i % 5) - 2) * 7, 0.12, (Math.floor(i / 5) - 0.5) * 6);
    p.mesh.metadata = { board: i };
    papers.push(p);
    for (const s of board.shapes.filter((s) => s.kind === 'sticky')) {
      const pos = [
        p.mesh.position.x + (s.x / WIDTH - 0.5) * 6,
        0.5,
        p.mesh.position.z + (s.y / HEIGHT - 0.5) * 4.25,
      ];
      const box = d.box('Sticky note', pos, s.color);
      box.mesh.metadata = { sticky: true };
      stickies.push(box);
    }
    if (board.shapes.some((s) => s.kind === 'rect' && s.text === 'door')) {
      const at = p.mesh.position;
      const material = new B.StandardMaterial('Door glow', scene);
      material.emissiveColor = B.Color3.FromHexString('#4de1d0');
      for (const [x, y, w, h] of [
        [-0.8, 1.3, 0.15, 2.6],
        [0.8, 1.3, 0.15, 2.6],
        [0, 2.6, 1.75, 0.15],
      ]) {
        const frame = B.MeshBuilder.CreateBox(
          'Drawn door',
          { width: w, height: h, depth: 0.15 },
          scene,
        );
        frame.position.set(at.x + x, y, at.z + 1.4);
        frame.material = material;
        frame.metadata = { door: (i + 1) % 10 };
        portals.push(frame);
      }
    }
  });
  scene.onPointerObservable.add((info) => {
    if (info.type !== B.PointerEventTypes.POINTERPICK) return;
    const pick = info.pickInfo,
      meta = pick?.pickedMesh?.metadata;
    if (!meta) return;
    if (meta.sticky) {
      const v = stickies.find((s) => s.mesh === pick.pickedMesh);
      v?.aggregate?.body.applyImpulse(
        new B.Vector3(1.7, 3, -1),
        v.mesh.getAbsolutePosition(),
      );
    }
    if (meta.door !== undefined) {
      flying = {
        from: camera.target.clone(),
        to: papers[meta.door].mesh.position.clone(),
        t: 0,
        id: meta.door,
      };
    }
    if (meta.board !== undefined && !flying && !ride) select(meta.board);
  });
  d.update.add((dt) => {
    if (flying) {
      flying.t += dt;
      camera.setTarget(B.Vector3.Lerp(flying.from, flying.to, Math.min(1, flying.t)));
      camera.radius = Math.max(3, camera.radius - dt * 20);
      if (flying.t >= 1) {
        const id = flying.id;
        flying = null;
        select(id);
      }
    }
    if (ride) {
      ride.t += dt * 0.06;
      const n = Math.min(
        ride.points.length - 2,
        Math.floor(ride.t * (ride.points.length - 1)),
      );
      ride.camera.position.copyFrom(ride.points[n]).addInPlace(new B.Vector3(0, 0.8, 0));
      ride.camera.setTarget(ride.points[n + 1]);
      if (ride.t >= 1) {
        scene.activeCamera = camera;
        ride.camera.dispose();
        ride.mesh.dispose();
        ride = null;
      }
    }
  });
  return {
    ...d,
    papers,
    stickies,
    refresh(id, source) {
      const p = papers[id],
        ctx = p.texture.getContext();
      ctx.clearRect(0, 0, 1024, 768);
      ctx.drawImage(source, 0, 0, 1024, 768);
      p.texture.update();
    },
    shake() {
      for (const s of stickies)
        s.aggregate?.body.applyImpulse(
          new B.Vector3(
            (Math.random() - 0.5) * 4,
            2 + Math.random() * 2,
            (Math.random() - 0.5) * 4,
          ),
          s.mesh.getAbsolutePosition(),
        );
    },
    ride(board) {
      if (ride) return;
      const line = board.shapes
        .filter((s) => s.kind === 'pen' && s.points.length > 3)
        .at(-1);
      if (!line) throw Error('Draw a pen graph with at least four points first.');
      const pts = line.points
        .filter((_, i) => i % Math.max(1, Math.floor(line.points.length / 30)) === 0)
        .map(
          ([x, y]) =>
            new B.Vector3(
              (x / WIDTH - 0.5) * 26,
              1 + (1 - y / HEIGHT) * 6,
              (x / WIDTH - 0.5) * 14,
            ),
        );
      const points = B.Curve3.CreateCatmullRomSpline(pts, 8).getPoints(),
        mesh = B.MeshBuilder.CreateTube(
          'Graph track',
          { path: points, radius: 0.08 },
          scene,
        );
      const mat = new B.StandardMaterial('Track teal', scene);
      mat.emissiveColor = B.Color3.FromHexString('#3dd4c5');
      mesh.material = mat;
      const rc = new B.FreeCamera('Coaster', points[0], scene);
      scene.activeCamera = rc;
      ride = { points, camera: rc, mesh, t: 0 };
    },
    focus(id) {
      camera.setTarget(papers[id].mesh.position);
      camera.radius = 10;
    },
  };
}
```

</details>
