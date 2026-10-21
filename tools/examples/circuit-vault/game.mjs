import { project } from '../lib.mjs';
export default () => ({
  name: 'Circuit Vault — Node game workshop',
  project: { ...project('circuit-vault', 'Circuit Vault', 'html'), startScene: '' },
  html: { module: 'app.js', files: ['app.js','style.css','server.mjs','rules.mjs'].map(name => ({from:'tools/examples/circuit-vault/src/'+name,to:name})).concat([{from:'LICENSE',to:'LICENSE'}]) },
  readme: '# Circuit Vault\nT36. A memory/heist game backed by a real Node HTTP server. From this folder run `node server.mjs`, then open the local URL printed by the server. Nord Play can call that same loopback server. Six stages, lives, deadline per input, server-computed score, local top-ten leaderboard, replay and connection-error UI. No npm packages. Board is memory-only; this is a local teaching server, not production multiplayer/anti-cheat.\n',
});
