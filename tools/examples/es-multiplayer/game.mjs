import { E, rect, text, project, C, A, sys, EV, setv, V, group, comment, with_, col, SHARED_ASSETS } from '../es-lib.mjs';

export default () => {
  const btn = (name, label, y, event) => E(name, { c: [{ type: 'uiButton', text: label, x: 0, y, anchor: 'c', w: 200, event }] });
  const events = [
    comment('Two-player squares over WebRTC. One player presses Host, the other (same Wi-Fi, same `nord serve` address) presses Join. WASD moves your square; the other player\'s square follows.'),
    V('status', 'Press Host on one device and Join on the other'),
    group('Lobby', [
      EV([C('Events', 'on-event', { name: 'host' })], [A('Multiplayer', 'host', { room: '"lobby"' }), setv('status', '"Hosting - waiting for a player…"')]),
      EV([C('Events', 'on-event', { name: 'join' })], [setv('status', '"Joining…"'), A('Multiplayer', 'join', { room: '"lobby"' })]),
      EV([C('Multiplayer', 'on-connected')], [setv('status', '"Connected!"')]),
    ]),
    group('Sync', [
      EV([C('Multiplayer', 'is-connected')], [A('Multiplayer', 'send', { name: '"x"', value: 'Me.X' }), A('Multiplayer', 'send', { name: '"y"', value: 'Me.Y' })]),
      EV([C('Multiplayer', 'on-message', { name: 'x' })], [A('Other', 'set-x', { x: 'Multiplayer.Last' })]),
      EV([C('Multiplayer', 'on-message', { name: 'y' })], [A('Other', 'set-y', { y: 'Multiplayer.Last' })]),
    ]),
    EV([sys('every-tick')], [A('Hud', 'set-text', { text: 'status & "   (peers: " & Multiplayer.PeerCount & ")"' })]),
  ];
  return {
    name: 'Multiplayer squares (event sheet)',
    project: project('es-multiplayer', 'Multiplayer Squares', '2d', { bg: '#2e3440', physics: { engine: 'arcade', gravity: [0, 0, 0] } }),
    scenes: { main: { settings: { eventSheet: 'events/main.events.json' }, entities: [
      with_(rect('Me', 160, 220, 24, 24, '#88c0d0', { z: 5, c: [col(24, 24)] }), { behaviors: [{ type: 'EightDirection', properties: { maxSpeed: 200 } }, { type: 'BoundToLayout' }] }),
      rect('Other', 480, 220, 24, 24, '#ebcb8b', { z: 4 }),
      text('Hud', 320, 18, '', { size: 14 }),
      btn('HostButton', 'Host', -110, 'host'), btn('JoinButton', 'Join', -70, 'join'),
    ] } },
    files: { 'events/main.events.json': { format: 1, name: 'main', events } },
    assets: [...SHARED_ASSETS],
    template: { id: 'es-multiplayer', title: 'Multiplayer squares (event sheet)', description: 'Two-player WebRTC demo: host/join in the same room over the local network (needs `nord serve`), positions synced with Send/On message.' },
    readme: '# Multiplayer squares (event sheet)\nRun `nord serve .` (add `--lan` to play with a phone: open the printed link there). One device presses **Host**, the other **Join**; WASD moves your blue square, the yellow one is the other player. Peer-to-peer WebRTC data channels, signalling through the dev server — no external servers. For a static host (itch.io) you need your own signalling: `game.net.signalling = { send, subscribe }` (see `runtime/core/multiplayer.js`).\n',
  };
};
