export function mount(root) {
root.innerHTML = `<link rel="stylesheet" href="style.css"><main><h1>CIRCUIT VAULT</h1>
<p>Memorise the numbered circuit. Repeat it to unlock six vault stages.</p>
<label>Pilot <input id="pilot" maxlength="20" value="Pilot"></label>
<label>API <input id="api" value="http://127.0.0.1:4381"></label>
<button id="start">New heist</button><button id="replay" disabled>Replay sequence</button>
<p id="status" role="status">Start the local Node server, then choose New heist.</p>
<div id="tiles">${['CYAN','PINK','GOLD','GREEN'].map((c,i)=>`<button data-tile="${i}">${i+1}<small>${c}</small></button>`).join('')}</div>
<h2>Local leaderboard</h2><ol id="board"></ol><p>Node remembers the top ten until you stop the process.</p></main>`;
const $ = s => root.querySelector(s);
let id, run, busy = false, generation = 0, replaying = false;
const status = text => { $('#status').textContent = text; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function controls() {
  $('#start').disabled = busy || replaying;
  $('#replay').disabled = busy || replaying || !run || run.done;
  root.querySelectorAll('[data-tile]').forEach(b => b.disabled = busy || replaying || !run || run.done);
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
for (const button of root.querySelectorAll('[data-tile]')) button.onclick = async () => {
  if (busy || replaying || !run || run.done) return;busy = true;controls();const round = run.round;
  try { ({ run } = await api('/api/step', { id, tile: Number(button.dataset.tile) }));draw();
    if (run.done) await leaderboard();else if (run.round !== round) { busy = false;await replay(); }
  } catch (e) { status(`Request failed: ${e.message}. Start a new heist if the server restarted.`); }
  finally { busy = false;controls(); }
};
controls();

}
