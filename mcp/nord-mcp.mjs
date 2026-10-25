#!/usr/bin/env node
// Nord Engine MCP server (stdio, no dependencies): project/scene/script tools + headless 3D Modeler tools + built-in guidance.
//   node mcp/nord-mcp.mjs [--project DIR] [--only modeler|project]
//   node mcp/nord-mcp.mjs --docs            write docs/MCP.md (tool reference, generated)
//   node mcp/nord-mcp.mjs --config <claude|opencode|codex|pi>   print the client configuration
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { projectTools, GUIDE_TOPICS } from './lib/project.mjs';
import { modelerTools } from './lib/modeler.mjs';
import { spriteTools } from './lib/sprite.mjs';
import { unityTools } from './lib/unity.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const engineRoot = path.resolve(here, '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const only = arg('--only');
const VERSION = '0.1.0';

let project = path.resolve(arg('--project') ?? process.env.NORD_PROJECT ?? process.cwd());
const ctx = { engineRoot, projectRoot: () => project, setProject: (p) => { project = p; }, server: null, call: (n, a) => tools.get(n).handler(a, ctx) };
const list = [...(only ? [] : [...projectTools(ctx), ...unityTools(ctx)]), ...(only === 'project' ? [...projectTools(ctx), ...unityTools(ctx)] : []), ...(!only || only === 'modeler' ? modelerTools(ctx) : []), ...(!only || only === 'sprite' ? spriteTools(ctx) : [])];
const tools = new Map(list.map((t) => [t.name, t]));

const PROMPTS = {
  'convert-unity-project': { description: 'Convert a Unity project (or tutorial) to a Nord project.', text: (a) => `Convert the Unity project at ${a.path || '(ask the user for the absolute path of the Unity project folder)'} into the open Nord project.\nFirst nord_guide topic "ex-unity-conversion" (the playbook) and "ex-migration", then unity_scan. Plan the order (scenes, prefabs, scripts, UI, audio), use unity_scene_to_nord for each scene/prefab, rewrite every script with unity_cs_outline as the checklist, copy assets, run check_project after each batch, serve_start and verify it plays. List what could not be converted at the end.` },
  'convert-unity-tutorial': { description: 'Rebuild a Unity tutorial (pasted text/code) in Nord.', text: (a) => `Rebuild this Unity tutorial in the open Nord project: ${a.path || '(ask the user for the tutorial text or link)'}.\nRead nord_guide topic "ex-unity-conversion" and "ex-migration" first. Translate each step (scene setup, components, C# scripts) to Nord scenes, entities and scripts; use unity_cs_outline on pasted C#; run check_project after each step and test the result.` },
  'make-a-game': { description: 'Plan and build a complete game with Nord.', text: (a) => `Build a complete, playable game: ${a.idea || '(ask the user what game)'}.\nFirst call nord_guide (no topic), then follow its loop: pick a template with project_templates, create the project, add scenes/entities/scripts, run check_project after each batch, serve_start, and build_project at the end. Use the modeler_* tools and modeler_preview for any 3D props. Keep a short todo list and finish every item.` },
  'model-a-prop': { description: 'Model and texture a 3D prop with the Modeler tools and put it in a scene.', text: (a) => `Model "${a.prop || 'a prop'}" for the open Nord project using the modeler_* tools. Build it from primitives, unwrap, texture it, check it with modeler_preview (iso, front, top), fix problems, then modeler_save and add it to the scene with scene_add_entity (model component).` },
};

const textResult = (r) => (typeof r === 'string' ? { content: [{ type: 'text', text: r }] } : { content: [{ type: 'text', text: r.text }, ...(r.images || []).map((data) => ({ type: 'image', data, mimeType: 'image/png' }))] });
async function handle(msg) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': return { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: only ? `nord-${only}` : 'nord', version: VERSION }, instructions: 'Nord Engine game-making tools. Start with the nord_guide tool (read it first), then follow its loop. For 3D props use modeler_* and always modeler_preview the result; for 2D pixel art use sprite_* and always sprite_preview.' };
    case 'ping': return {};
    case 'tools/list': return { tools: list.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
    case 'tools/call': {
      const t = tools.get(params.name); if (!t) return { isError: true, content: [{ type: 'text', text: `Unknown tool ${params.name}` }] };
      try { return textResult(await t.handler(params.arguments || {}, ctx)); } catch (e) { return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] }; }
    }
    case 'resources/list': return { resources: Object.keys(GUIDE_TOPICS).map((k) => ({ uri: `nord://guide/${k}`, name: `Nord guide: ${k}`, mimeType: 'text/markdown' })) };
    case 'resources/read': { const k = String(params.uri || '').replace('nord://guide/', ''); const text = tools.get('nord_guide') ? await tools.get('nord_guide').handler({ topic: k }, ctx) : 'guide tool not enabled'; return { contents: [{ uri: params.uri, mimeType: 'text/markdown', text }] }; }
    case 'prompts/list': return { prompts: Object.entries(PROMPTS).map(([name, p]) => ({ name, description: p.description, arguments: [{ name: name === 'make-a-game' ? 'idea' : name.startsWith('convert') ? 'path' : 'prop', required: false }] })) };
    case 'prompts/get': { const p = PROMPTS[params.name]; if (!p) throw Object.assign(new Error('Unknown prompt'), { code: -32602 }); return { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text(params.arguments || {}) } }] }; }
    default: if (id === undefined) return undefined; throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }
}

let docMode = false;
const abs = (f) => (docMode ? `<engine>/mcp/${f}` : path.join(here, f));
const CONFIGS = {
  claude: (server, args) => `# Claude Code (project scope; add --scope user for all projects)\nclaude mcp add ${server} -- node ${abs('nord-mcp.mjs')} ${args}\n\n# or .mcp.json in the project:\n${JSON.stringify({ mcpServers: { [server]: { command: 'node', args: [abs('nord-mcp.mjs'), ...args.split(' ').filter(Boolean)] } } }, null, 2)}`,
  opencode: (server, args) => `# opencode.json (project) or ~/.config/opencode/opencode.json\n${JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp: { [server]: { type: 'local', command: ['node', abs('nord-mcp.mjs'), ...args.split(' ').filter(Boolean)], enabled: true } } }, null, 2)}`,
  codex: (server, args) => `# ~/.codex/config.toml   (or: codex mcp add ${server} -- node ${abs('nord-mcp.mjs')} ${args})\n[mcp_servers.${server}]\ncommand = "node"\nargs = [${[abs('nord-mcp.mjs'), ...args.split(' ').filter(Boolean)].map((a) => JSON.stringify(a)).join(', ')}]`,
  pi: (server, args) => `# pi has no built-in MCP client; use the pi-mcp-adapter extension, then ~/.pi/agent/mcp.json (or .pi/mcp.json in the project):\n${JSON.stringify({ mcpServers: { [server]: { command: 'node', args: [abs('nord-mcp.mjs'), ...args.split(' ').filter(Boolean)] } } }, null, 2)}`,
};

if (argv.includes('--config')) {
  const c = arg('--config'); if (!CONFIGS[c]) { console.error('client must be one of: ' + Object.keys(CONFIGS).join(', ')); process.exit(2); }
  console.log(CONFIGS[c](only ? `nord-${only}` : 'nord', [only ? `--only ${only}` : '', `--project ${arg('--project') ?? '/path/to/your/project'}`].filter(Boolean).join(' '))); process.exit(0);
}
if (argv.includes('--docs')) {
  docMode = true;
  const g = (name) => list.filter((t) => t.group === name).map((t) => `### \`${t.name}\`\n${t.description}\n\n${Object.keys(t.inputSchema.properties).length ? 'Parameters: ' + Object.entries(t.inputSchema.properties).map(([k, v]) => `\`${k}\`${t.inputSchema.required.includes(k) ? '*' : ''} (${v.type || 'any'})`).join(', ') : 'No parameters.'}\n`).join('\n');
  const doc = `# Nord MCP server (AI game making)\n\n<!-- GENERATED by \`node mcp/nord-mcp.mjs --docs\`. Edit mcp/GUIDE.md, mcp/lib/*.mjs or this generator, never this file. -->\n\nAn MCP server (stdio, Node 18+, no dependencies) that lets an AI agent (Claude Code, opencode, Codex, pi, any MCP client) build a complete Nord game: create projects, edit scenes and scripts, validate, build, model/texture 3D props and draw 2D pixel-art sprites with a software preview so the AI can *see* its work. It starts with built-in guidance (\`nord_guide\`, resources \`nord://guide/<topic>\`, prompts \`make-a-game\` and \`model-a-prop\`) that reads the engine's own docs, so the guidance is always as current as the docs.\n\n## Install\nThe server lives in the engine repo (\`mcp/nord-mcp.mjs\`). Build the CLI once (\`cargo build -p nord-cli\`; needed for \`project_new\`, \`check_project\`, \`build_project\`, \`serve_start\`). Replace paths with yours; \`node mcp/nord-mcp.mjs --config <client>\` prints these for your checkout.\n\n${Object.keys(CONFIGS).map((c) => `### ${c}\n\`\`\`\n${CONFIGS[c]('nord', '--project /path/to/your/project')}\n\`\`\`\n`).join('\n')}\nEntries: \`nord\` (everything), \`nord-modeler\` (\`--only modeler\`: just the 3D tools) and \`nord-sprite\` (\`--only sprite\`: just the 2D sprite tools). Set \`NORD_PROJECT\` or \`--project\` so tools know the project; \`project_open\` switches at runtime. \`NORD_BIN\` points at a specific \`nord\` binary.\n\n## Safety\nFile tools are jailed to the project folder (no \`..\`, symlinks resolved, \`.git\`/\`target\`/\`node_modules\` protected, 8 MB limit, JSON validated). There is no delete tool and no shell tool. \`serve_start\` runs only \`nord serve\` on the project.\n\n## Tools (${list.length})\n### Project, scenes and guidance\n${g('project')}\n### 3D Modeler\n${g('modeler')}\n### 2D Sprite editor\n${g('sprite')}\n## Keeping it in sync\nAdd or change tools in \`mcp/lib/\`, update \`mcp/GUIDE.md\` when workflows change, run \`node mcp/nord-mcp.mjs --docs\`. \`node --test mcp/\` fails if this file is stale or a tool is undocumented.\n`;
  fs.writeFileSync(path.join(engineRoot, 'docs/MCP.md'), doc); console.log('wrote docs/MCP.md (' + list.length + ' tools)'); process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin });
const send = (o) => process.stdout.write(JSON.stringify(o) + '\n');
rl.on('line', async (line) => {
  if (!line.trim()) return; let msg; try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
  try { const result = await handle(msg); if (msg.id !== undefined && result !== undefined) send({ jsonrpc: '2.0', id: msg.id, result }); } catch (e) { if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: e.code || -32603, message: String(e.message || e) } }); }
});
process.on('exit', () => ctx.server?.child.kill());
