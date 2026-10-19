# Multiplayer (M10-32, optional)
Peer-to-peer WebRTC data channels with a tiny signalling relay in `nord serve` (`/__signal/<room>`: POST a JSON message, every SSE subscriber of the room receives it; 64 KB per message, 64 rooms, room names `[A-Za-z0-9_-]`). No external servers and no STUN, so it works between devices on the same network. `nord serve --lan` also exposes the relay (token-protected) so a phone and a PC can play together.

## Use
JS: `await game.net.host('room')` / `await game.net.join('room')`, `game.net.send('pos', {x, y})`, `game.net.on('message', ({from, name, data}) => …)`, events `connected`, `join`, `leave`; `net.peers`, `net.isHost`, `net.id`. Topology is a star: guests talk to the host, the host relays to the other guests.
Event sheets: plugin **Multiplayer** — actions *Host*, *Join*, *Send (name, value)*, *Leave*; triggers *On connected*, *On peer joined/left*, *On message (name)*; condition *Is host / Is connected*; expressions `Multiplayer.Last`, `LastFrom`, `LastName`, `PeerCount`, `Id`.
Demo: template/example **es-multiplayer** (two squares). Static hosting (itch.io) has no signalling relay: set `game.net.signalling = { send(msg), subscribe(fn) → unsubscribe }` to your own.

## Tests
`cargo test -p nord-serve signalling` (relay) and `node tools/multiplayer-test.mjs` (two Chromium pages complete the WebRTC handshake, sync positions through the event sheet, leave; signalling is replaced by a BroadcastChannel stand-in there).
Not verified: across two physical devices, Safari/iOS (mDNS ICE candidates), strict NATs/VPNs (no TURN by design). Authoritative server logic, lag compensation and more than a few players are out of scope.
