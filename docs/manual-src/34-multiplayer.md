---
title: Multiplayer
section: Manual
order: 34
summary: Host and join a room, send messages, call functions on other players (RPC), spawn and sync entities, and test with fake lag. Peer to peer, no server.
---

Nord games can be played by several people at once. Players connect **directly** to each other (WebRTC data channels), with a tiny signalling relay built into `nord serve`. No cloud, no account. It works between devices on the same network (`nord serve --lan` lets a phone join a PC).

::: dummies
One player **hosts** a room, the others **join** it by name. After that every screen has to agree on what exists and where it is. Nord gives you four tools for that: **messages** (shout something), **RPC** (run a function on the other players), the **spawner** (create an object on everybody's screen) and **netSync** (keep an object's position the same everywhere).
:::

## Connect

**File: your script, for example `scripts/Lobby.js`** (inside an `async` method)
```js
await game.net.host('room1');   // player 1
await game.net.join('room1');   // players 2..n (rejects after 10 s if nobody answers)
game.net.on('join', ({ id }) => {});    // host: someone joined
game.net.on('leave', ({ id }) => {});
```
`net.peers`, `net.isHost`, `net.id`, `net.hostId`. The host relays guest messages, so everybody sees everything. Event sheets have a **Multiplayer** plugin (Host, Join, Send, On message…).

## Messages and RPC

**File: your script, for example `scripts/Chat.js`** (inside any method after you are connected)
```js
net.send('chat', { text: 'hi' });                 // everybody else
net.send('whisper', 1, { to: peerId });           // one player
net.on('message', ({ from, name, data }) => {});

net.rpc('damage', ({ amount }, { from, isHost }) => this.hp -= amount);
net.call('damage', { amount: 5 });                // run on every other player
net.callHost('requestScore');                     // run on the host only
net.rpc('startRound', fn, { from: 'host' });      // only the host may call this one
```

## Spawn and sync
The **host** creates entities for everyone:

**File: your script, for example `scripts/Match.js`** (inside an `async` method on the host)
```js
const ship = await net.spawn('prefabs/ship.prefab.json', { pos: [100, 100, 0], owner: playerId });
```
Guests receive the entity automatically (also guests who join later). When a player leaves, the entities they own are removed everywhere. Put a **netSync** component on the prefab: the owner sends position (optionally rotation, scale and chosen `vars`) about 15 times a second, only while it changes; everyone else sees it glide. Move an entity only when `netSync.isMine` (or `net.isAuthority(entity)`) is true.

## Test it
* **Project ▸ Play multiplayer (browser windows)**: 2 or 3 players, or 2 with **100 ms lag and 2 % packet loss**. The first window hosts, the others join automatically.
* In the game address: `?net=host:room1` / `?net=join:room1` and `?netsim=latency,jitter,loss`.
* `net.simulate({ latency: 150, jitter: 30, loss: 0.05 })` in code. `net.stats()` gives ping, bytes per second and dropped messages; the debugger's **network** tab (F9) and the editor's **Window ▸ Profiler** show them.
* Tests without a network: `Multiplayer.link(hostA, guestB)` connects two games in memory.

::: warn
No authoritative server, prediction or rollback: this is for friends on a network, jams and prototypes. Static hosts such as itch.io have no signalling relay, so set `game.net.signalling` to your own. Details: `docs/MULTIPLAYER.md`. Guided build: [T53](tut-t53-multiplayer.html).
:::
