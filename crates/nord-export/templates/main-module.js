import { boot } from './runtime/{{backend}}/index.js';
try {
  const project = await (await fetch('nord.project.json')).json();
  await boot(project, { container: document.getElementById('stage'), libBase: './vendor' });
  window.__nord_ready = true;
} catch (e) { console.error(e); window.__nord_error = String(e); }
