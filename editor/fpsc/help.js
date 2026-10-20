// In-editor help (shown with F1). Keep in sync with docs/FPS_CREATOR.md.
export const HELP = `
<h3>Build a level in 5 steps</h3>
<ol>
<li><b>Room tool (R)</b> — drag a rectangle on the map: floor, ceiling and a wall ring appear. Pick textures in <i>Build</i>.</li>
<li><b>Wall tool (W)</b> — choose a piece (Door, Window, Arch, Fence…) in <i>Build</i>, then click an edge between two cells, or drag a line between grid points.</li>
<li><b>Items tab</b> — click an enemy, pickup or light, then click the map (or drag the card onto the map). Always add a <i>Player start</i> and a <i>Level exit</i>.</li>
<li><b>Inspector</b> (right) — name things, attach <i>Scripts</i> and add <i>Rules</i> (no-code logic).</li>
<li><b>F5</b> plays the level right here; <b>Ctrl+S</b> saves to <code>levels/</code>. The 3D view on the right updates as you build.</li>
</ol>
<h3>Map controls</h3>
<table>
<tr><td>Pan</td><td>middle / right mouse drag, or Space + drag</td></tr><tr><td>Zoom</td><td>mouse wheel · <code>Home</code> fits the level</td></tr>
<tr><td>Tools</td><td><code>V</code> select · <code>W</code> wall · <code>R</code> room · <code>F</code> floor · <code>C</code> ceiling · <code>G</code> fill · <code>S</code> stairs/height/pillars · <code>A</code> add item · <code>P</code> path · <code>X</code> erase · <code>I</code> eyedropper (or Alt+click)</td></tr>
<tr><td>Edit</td><td>Ctrl+Z/Y undo/redo · Ctrl+C/X/V/D copy/cut/paste/duplicate · Del · Q/E rotate · arrows nudge (Shift = a whole cell)</td></tr>
<tr><td>Layers</td><td>PageUp/PageDown change storey · layers are stacked floors (1 storey = 3.2 m) — stairs connect them</td></tr>
<tr><td>Views</td><td><code>Tab</code> cycles 2D / split / 3D · 3D: right-drag look, WASD/QE fly, F focus selection, click to select</td></tr>
<tr><td>Test</td><td><code>F5</code> from the player start · <code>Shift+F5</code> from the cursor / selected item</td></tr>
</table>
<h3>Scripts — attach behaviour</h3>
<p>Every entity gets default scripts from the bank (an enemy has a brain, a pickup gives something). In the <i>Inspector → Scripts</i> you can tune their parameters, switch them off, remove them or <b>attach more</b> (also by dragging a script from the Scripts tab onto an entity). A script is one JavaScript file:</p>
<pre style="background:#1c1c1c;padding:8px;border-radius:6px;white-space:pre-wrap">export default {
  id: 'my-script', title: 'My script', cat: 'Custom', desc: 'What it does',
  params: { speed: { type: 'number', label: 'Speed', default: 2, min: 0, max: 10 } },   // → shown as a form in the Inspector
  start(c) {}, update(c, dt) {}, use(c, by) {}, hurt(c, amount, src) {}, die(c, src) {}, event(c, name, data) {}, heard(c, pos, src, dist) {},
};</pre>
<p><code>c.self</code> the entity · <code>c.p</code> parameters · <code>c.s</code> private state · <code>c.player</code> · <code>c.game</code> · <code>c.say()</code> <code>c.sound()</code> <code>c.emit()</code> <code>c.on()</code> <code>c.after()</code> <code>c.find()</code> <code>c.targets()</code>. Create one from a template in <i>Assets → New script</i>, or open any built-in script and <i>Make an editable copy</i>.</p>
<h3>Rules — logic without code</h3>
<p>A rule is <b>WHEN</b> (level starts / used / killed / enters zone / timer / event …) → <b>DO</b> (open door, message, spawn, give item, light on/off, win …) on a <b>target</b> (an entity name, <code>#tag</code> for a group, or a door name). Name things in the Inspector so rules can find them. Events look like <code>switch1.used</code> or <code>door1.opened</code>.</p>
<h3>Doors, keys and switches</h3>
<p>Select a door piece → give it a <i>name</i>, optionally <i>lock</i> it with a key colour (then place the matching key pickup somewhere), and untick <i>Opens by itself</i> if a switch/rule should open it. A <i>Wall switch</i> with <i>Target</i> = the door name opens/closes it.</p>
<h3>Adding assets (the rules)</h3>
<table>
<tr><th>What</th><th>Do this</th></tr>
<tr><td>Texture</td><td>PNG/JPG, seamless, power-of-two (256–512 px). Assets → Texture, or copy to <code>fpsc/textures/</code> and add <code>{"id","label","cat":"wall|floor|ceiling|door","size":2,"url":"fpsc/textures/x.png"}</code> to <code>textures</code> in <code>fpsc/bank.json</code>. <i>size</i> = metres per repeat.</td></tr>
<tr><td>Wall piece</td><td>Add to <code>pieces</code> in <code>bank.json</code>: <code>{"id","label","cat","parts":[{"u":[0,1],"y":[0,3.2],"t":[-0.15,0.15],"mat":"main"}]}</code> — boxes in edge space (u = fraction along the 4 m edge, y = metres, t = thickness). <code>mat</code>: main/trim/door/glass/mesh. <code>solid</code>, <code>opaque</code>, <code>bullet</code> default true; add <code>"door":{"style":"up|side|swing"}</code> and <code>"leaf":true</code> on moving parts for a door.</td></tr>
<tr><td>Sprite enemy / prop</td><td>PNG with transparency, feet at the bottom edge. Assets → Sprite: pick which built-in it should behave like (same scripts, stats, sounds).</td></tr>
<tr><td>3D model</td><td>.glb, 1 unit = 1 m, origin at the feet, facing +Z. Assets → 3D model.</td></tr>
<tr><td>Entity (data)</td><td><code>{"id":"my_boss","label":"My boss","extends":"enemy_boss","props":{"health":{"type":"number","default":3000}},"scripts":[{"id":"ai-boss","params":{"damage":20}}]}</code> in <code>entities</code>. Anything not given is inherited from <code>extends</code>.</td></tr>
<tr><td>Sound</td><td>WAV/OGG/MP3 in <code>fpsc/sounds/</code> and <code>"sounds":{"pistol":"fpsc/sounds/my_pistol.wav"}</code>. A built-in name (pistol, door, pickup…) replaces the synth sound.</td></tr>
<tr><td>Weapon</td><td><code>weapons</code> in bank.json: same fields as <code>runtime/fpsc/weapons.js</code> (type, dmg, rate, mag, ammo, spread, view parts…). Give it to the player with the Player start's <i>Weapons</i> list or a <code>weapon_&lt;id&gt;</code> pickup script.</td></tr>
<tr><td>Script</td><td>Assets → New script, or put <code>fpsc/scripts/name.js</code> in the project and list its path in <code>scripts</code> in bank.json.</td></tr>
</table>
<p class="muted">Everything stays inside your project and works offline; exports include <code>fpsc/</code> automatically.</p>
<h3>Tips</h3>
<ul>
<li>Lights are <b>baked</b> (walls block them → dark rooms next door). Give a light a <i>name</i> or a rule and it becomes dynamic (switchable, flickers) — a few of those are fine, hundreds are not.</li>
<li>Outdoors: set <i>Level → Sky</i> and <i>Outside ground</i>, and leave the ceiling off (Shift+C paints "open sky").</li>
<li>Two storeys: add a layer, build the upper room, put <i>Stairs</i> on the lower layer and leave the cell above the stair top without a floor.</li>
<li>Click the ✓ button to list problems (missing player start, bad targets, duplicate names).</li>
</ul>`;
