# Multiplayer (M10-32, optional)
Peer-to-peer WebRTC data channels with a tiny signalling relay in `nord serve` (`/__signal/<room>`: POST a JSON message, every SSE subscriber of the room receives it; 64 KB per message, 64 rooms, room names `[A-Za-z0-9_-]`). No external servers and no STUN, so it works between devices on the same network. `nord serve --lan` also exposes the relay (token-protected) so a phone and a PC can play together.

## Use
JS: `await game.net.host('room')` / `await game.net.join('room')`, `game.net.send('pos', {x, y})`, `game.net.on('message', ({from, name, data}) => …)`, events `connected`, `join`, `leave`; `net.peers`, `net.isHost`, `net.id`. Topology is a star: guests talk to the host, the host relays to the other guests.
Event sheets: plugin **Multiplayer** — actions *Host*, *Join*, *Send (name, value)*, *Leave*; triggers *On connected*, *On peer joined/left*, *On message (name)*; condition *Is host / Is connected*; expressions `Multiplayer.Last`, `LastFrom`, `LastName`, `PeerCount`, `Id`.
Demo: template/example **es-multiplayer** (two squares). Static hosting (itch.io) has no signalling relay: set `game.net.signalling = { send(msg), subscribe(fn) → unsubscribe }` to your own.

## Tests
`cargo test -p nord-serve signalling` (relay) and `node tools/multiplayer-test.mjs` (two Chromium pages complete the WebRTC handshake, sync positions through the event sheet, leave; signalling is replaced by a BroadcastChannel stand-in there).
Not verified: across two physical devices, Safari/iOS (mDNS ICE candidates), strict NATs/VPNs (no TURN by design). Authoritative server logic, lag compensation and more than a few players are out of scope.

## Godot-style tooling (2026-10-23)
All in `runtime/core/multiplayer.js` + `netsync.js`; the old API is unchanged. Tests: `runtime/core/multiplayer.test.mjs` (uses `Multiplayer.link(a, b)`, an in-memory connection without WebRTC: host + guests, relay, routing, RPC, spawner, sync, stats, simulator).
* **Direct messages**: `net.send(name, data, { to: peerId })` (the host forwards to the target only). Names starting `__` are internal and never reach `on('message')`.
* **RPC**: `net.rpc('name', (args, { from, isHost }) => …, { from: 'host' })` registers (with `from: 'host'` only the host may call it, Godot "authority"); `net.call('name', args, { to, local })` calls every other peer (or one; `local` runs it here too); `net.callHost('name', args)`.
* **Replicated spawner**: `await net.spawn(prefab, { pos, rot, scale, owner })` on the host creates the entity on every peer (`entity.netId`, `entity.netOwner`); a guest calling it asks the host (returns `null`). Late joiners get the existing ones; a leaving peer's entities are removed everywhere (`net.despawn(entity)` for manual removal). Events `spawned` / `despawned`.
* **netSync component** (`{ rate, rot, scale, vars[], interpolate, smoothing, id }`): the owner sends position (+rotation/scale/vars) only when changed (plus 1 s heartbeat); other peers interpolate. Owner = `netOwner` or the host for placed entities. `comp.isMine`, `net.isAuthority(entity)`.
* **Ping and traffic**: guests and host ping each other every second; `net.stats()` → `{ peers, pingMs, bytesIn/Out, msgsIn/Out, inPerSec, outPerSec, dropped, spawned, sim }` (shown in the debugger's **network** tab and the editor Profiler).
* **Network simulator**: `net.simulate({ latency, jitter, loss })` delays/drops this peer's outgoing messages. URL helpers: `?net=host:room` / `?net=join:room` (guests retry up to 8 s) and `?netsim=latencyMs,jitterMs,loss`.
* **Editor**: **Project ▸ Play multiplayer (browser windows)**: 2 or 3 players, or 2 with 100 ms lag + 2 % loss; the first window hosts, the others join.
Not verified: the WebRTC handshake inside the in-app browser pane (mDNS ICE candidates did not connect there; `tools/multiplayer-test.mjs` covers the handshake), real devices. Still out of scope: authoritative simulation, prediction/rollback, dedicated servers.
