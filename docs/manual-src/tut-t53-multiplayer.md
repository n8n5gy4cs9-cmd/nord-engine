---
title: T53 Two players with spawn, sync and RPC
section: Tutorials
order: 53
summary: Host and join from two browser windows, spawn one ship per player, sync movement with netSync, call a function on the other player and test with fake lag.
---
**Result:** two browser windows, each with its own ship that the other player sees move; a shout sent with an RPC. Allow 30 minutes. **Start from:** a 2D project with an `Entity` that can move (arrow keys).

::: dummies
In a multiplayer game each player runs the game on their own computer. **Host** is the player who owns the room, **guests** join it. Something must tell every screen "a ship exists" (**spawn**) and "it moved" (**sync**). An **RPC** is "run this function on the other player's computer".
:::

## 1. A ship prefab
Make `prefabs/ship.prefab.json` (sprite + your movement script). Add a **netSync** component: `rate` 15, `interpolate` on. Only the player who owns a ship moves it; everybody else just watches it glide.

## 2. A script that spawns one ship per player
```js
import { NordScript } from 'nord';
export default class Lobby extends NordScript {
  start() {
    const net = this.game.net;
    net.on('connected', () => {});                 // guests: you are in
    net.on('hosting', () => net.spawn('prefabs/ship.prefab.json', { pos: [100, 100, 0], owner: net.id }));
    net.on('join', ({ id }) => net.spawn('prefabs/ship.prefab.json', { pos: [300, 100, 0], owner: id }));
    net.rpc('shout', (text, { from }) => console.log(from, 'says', text));
  }
  update() { if (this.game.input.pressed('jump')) this.game.net.call('shout', 'hello!'); }
}
```
Only the host spawns; guests receive the ships automatically. A leaving player's ship disappears on every screen. In the ship's movement script move the ship only when `this.entity.getComponent('netSync').isMine` is true.

## 3. Play with two windows
**Project ▸ Play multiplayer (browser windows) ▸ 2 players.** The first window hosts, the second joins (it retries until the host is up). Move each ship, press **jump**: the other window's Console prints the shout. Pick **2 players, 100 ms lag + 2% loss** to see the game under bad network.

## 4. Look at the network
Press **F9** in a window (add `?debug` to the address), tab **network**: ping, bytes per second, simulated lag. The editor's **Window ▸ Profiler** shows the same under *Network*. In code: `net.simulate({ latency: 150, jitter: 30, loss: 0.05 })` and `net.stats()`.

**Check yourself:** both windows show two ships, each window moves only its own ship, the other one follows smoothly even with lag, and closing one window removes its ship in the other. Both windows must be in the same browser/network (WebRTC without internet servers, see [Multiplayer](multiplayer.html)). **Next:** [T48 Neon Harbor](tut-t48-neon-harbor.html) to see everything combined.
