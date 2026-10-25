---
title: 28 · Multiplayer basics
section: Examples
order: 28
summary: Host and join from two windows, spawn one ship per player, move your own, and send a message to everyone.
---

**Goal:** two browser windows, each controlling its own square, both seeing both.

Nord multiplayer is peer to peer (WebRTC) with a tiny relay built into `nord serve`: no server to run. Full reference: [Multiplayer](multiplayer.html). The pieces: **host/join a room**, **spawn** a prefab for everybody (the host creates it), **netSync** (position sync), **messages / RPC**.

## 1. A player prefab with netSync
`prefabs/net-player.prefab.json` has `sprite`, `rigidbody`/`collider` if you want physics, a **netSync** component (`rate` 15, `interpolate` on, `smoothing` 15) and the script below. Remote copies are smoothed by `netSync`; you only move the one you own.
```js
import { MonoBehaviour, SerializeField } from 'nord';

export default class NetPlayer extends MonoBehaviour {
  static attributes = SerializeField({ speed: 200 });
  Update(dt) {
    if (!this.game.net.isAuthority(this.entity)) return;           // only the owner moves it
    const [x, y] = this.input.vec('left', 'right', 'up', 'down');
    const p = this.entity.pos;
    this.entity.pos = [p[0] + x * this.speed * dt, p[1] + y * this.speed * dt, p[2]];
  }
}
```

## 2. A lobby: host or join

**File: `scripts/Lobby.js`** (new file, the whole file; attach it to an empty `Lobby` object)
```js
import { MonoBehaviour } from 'nord';

export default class Lobby extends MonoBehaviour {
  Start() {
    this.ui.button('Host', () => this.Host(), { screen: 'lobby', anchor: 'c', y: -30 });
    this.ui.button('Join', () => this.Join(), { screen: 'lobby', anchor: 'c', y: 30 });
    this.ui.show('lobby');
    this.game.net.on('join', ({ id }) => this.OnJoin(id));          // the host hears about every new player
  }
  async Host() {
    await this.game.net.host('room1');
    this.ui.hide('lobby');
    await this.SpawnFor(this.game.net.id);                          // the host's own ship
  }
  async Join() { await this.game.net.join('room1'); this.ui.hide('lobby'); }   // rejects after 10 s if nobody answers
  OnJoin(id) { this.SpawnFor(id); }
  SpawnFor(owner) {
    return this.game.net.spawn('prefabs/net-player.prefab.json', { pos: [200 + Math.random() * 400, 200, 5], owner });   // creates it on every peer
  }
  OnDestroy() { this.ui.clear('lobby'); }
}
```
`net.id` is your player id, `net.isHost`, `net.peers`, `net.hostId`. When a player leaves, the objects they own are removed everywhere.

## 3. Try it
@ui[Project ▸ Play multiplayer (browser windows)] opens 2–3 windows (the first hosts, the others join) and can add **100 ms lag and 2 % packet loss**. Or run `nord serve` and open `http://localhost:4173/?net=host:room1` and `?net=join:room1` in two windows.

## Messages and RPC

**File: your script, for example `scripts/Player.js`** (inside `Start()`, after `this.game.net` is connected)
```js
const net = this.game.net;
net.send('chat', { text: 'hello' });                                   // to everybody else
net.on('message', ({ from, name, data }) => this.log(from, name, data));

net.rpc('damage', ({ amount }, { from }) => this.hp -= amount);        // register a function others may call
net.call('damage', { amount: 5 });                                     // run it on every other player
net.callHost('requestScore');                                          // run it on the host only
```
**Who decides?** Let the *owner* move their own object and the **host** decide shared things (score, who won, spawning pick-ups) with `callHost` and then send results to everyone. There is no prediction or rollback: this is for friends on a network, jams and prototypes.

## Sync other values
`netSync.vars` lists entity variables to sync, e.g. `["hp"]` (read and write them as `entity.vars.hp`). Per-frame state like a score can travel in messages: `net.send('score', { id, score })`.

## Debugging
`net.stats()` gives ping and bytes per second; `net.simulate({ latency: 150, jitter: 30, loss: 0.05 })` adds fake lag; the debugger's *network* tab shows traffic. Static hosts such as itch.io have no signalling relay: use a LAN or `nord serve --lan` for play tests.
