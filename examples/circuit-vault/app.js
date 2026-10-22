import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
// The page is described in ui/vault.ui.json (edit it in the UI Designer); this file only wires it up.
const menu = await createUI(root).load('ui/vault.ui.json');
const $ = s => menu.shadow.querySelector(s); // ids come from the node names in the UI file
let id, run, busy = false, generation = 0, replaying = false;
const status = text => { $('#status').textContent = text; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function controls() {
  $('#start').disabled = busy || replaying;
  $('#replay').disabled = busy || replaying || !run || run.done;
  menu.shadow.querySelectorAll('[data-tile]').forEach(b => b.disabled = busy || replaying || !run || run.done);
}
async function api(route, body) {
  const base = new URL($('#api').value);
  const response = await fetch(new URL(route, base), {
    method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {},
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `HTTP ${response.status}`);
  return data;
}
async function leaderboard() {
  const { board } = await api('/api/board');$('#board').replaceChildren();
  for (const row of board) { const li = document.createElement('li');li.textContent = `${row.name} — ${row.score}`;$('#board').append(li); }
}
function draw() {
  status(run.done ? (run.won ? `VAULT OPEN! Score ${run.score}` : 'Alarm! No lives left. Start a new heist.')
    : `Stage ${run.round}/6 | Input ${run.cursor}/${run.round} | Lives ${run.lives} | Score ${run.score}`);
  controls();
}
async function replay() {
  if (!run || run.done || replaying) return;
  replaying = true;controls();const token = generation;
  status('Watch the circuit…');
  for (const tile of run.sequence) {
    if (token !== generation) break;
    const button = $(`[data-tile="${tile}"]`);button.classList.add('lit');await delay(350);button.classList.remove('lit');await delay(150);
  }
  replaying = false;draw();
}
$('#replay').onclick = () => replay();
$('#start').onclick = async () => {
  if (busy || replaying) return;busy = true;controls();generation++;
  try { const data = await api('/api/start', { name: $('#pilot').value });id = data.id;run = data.run;await leaderboard();busy = false;await replay(); }
  catch (e) { status(`Connection failed: ${e.message}. Run node server.mjs and check the API field.`); }
  finally { busy = false;controls(); }
};
for (const button of menu.shadow.querySelectorAll('[data-tile]')) button.onclick = async () => {
  if (busy || replaying || !run || run.done) return;busy = true;controls();const round = run.round;
  try { ({ run } = await api('/api/step', { id, tile: Number(button.dataset.tile) }));draw();
    if (run.done) await leaderboard();else if (run.round !== round) { busy = false;await replay(); }
  } catch (e) { status(`Request failed: ${e.message}. Start a new heist if the server restarted.`); }
  finally { busy = false;controls(); }
};
controls();

}
