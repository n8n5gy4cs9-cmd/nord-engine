// Multiplayer (M10-32, optional): WebRTC peer-to-peer data channels, signalling through `nord serve` (or `nord serve --lan`, so a phone and a PC
// can play together). No third-party servers, no STUN: it works between devices on the same network.
//   const net = game.net;  await net.host('room1');  /  await net.join('room1');
//   net.send('pos', { x: 10, y: 20 })       → every other player gets it:  net.on('message', ({ from, name, data }) => …)
//   net.on('join' | 'leave', ({ id }))      net.peers (ids)  net.isHost  net.id
// Topology: a star. Guests talk to the host; the host relays guest messages to the other guests, so everyone sees everything.
// Event sheets: Multiplayer → Host / Join / Send / Leave;  On connected, On peer joined/left, On message (name);  Multiplayer.Last / LastFrom / PeerCount / Id.
// Custom signalling for static hosting: net.signalling = { send(msg), subscribe(fn) → unsubscribe }.
//
// Godot-style tooling (docs/MULTIPLAYER.md): RPCs (`net.rpc`, `net.call`), a replicated spawner (`net.spawn`, host authority), the `netSync`
// component (entity transform + vars from the owning peer, interpolated), ping + traffic stats (`net.stats()`), a network simulator
// (`net.simulate({ latency, jitter, loss })`), and `Multiplayer.link(a, b)` (in-memory connection for tests and local bots).
// Names starting with `__` are internal messages and never reach `net.on('message')`.
const ID = () => Math.random().toString(36).slice(2, 8);
const ICE_WAIT = 2500;
const PING_MS = 1000;
const now = () => (globalThis.performance?.now?.() ?? Date.now());

export class Multiplayer {
  constructor(game) {
    this.game = game; this.id = ID(); this.isHost = false; this.room = null; this.conns = new Map(); // peerId -> { pc, ch }
    this.handlers = new Map(); this.last = { name: '', data: 0, from: '' };
    this.signalling = null; this.unsub = null;
    this.sim = { latency: 0, jitter: 0, loss: 0 };            // outgoing network simulator
    this.rpcs = new Map();                                    // name -> { fn, from }
    this.spawned = new Map();                                 // netId -> entity (host and guests)
    this.syncs = new Map();                                   // netId/entity id -> netSync component
    this.rtt = new Map(); this.pingTimer = null;              // peerId -> last round trip ms
    this.counters = { bytesIn: 0, bytesOut: 0, msgsIn: 0, msgsOut: 0, dropped: 0 }; this.snap = { t: now(), bytesIn: 0, bytesOut: 0, inRate: 0, outRate: 0 };
    this.counter = 0; this.warned = new Set();
  }
  on(ev, fn) { const l = this.handlers.get(ev) ?? new Set(); l.add(fn); this.handlers.set(ev, l); return () => l.delete(fn); }
  #emit(ev, data) { for (const fn of [...(this.handlers.get(ev) ?? [])]) { try { fn(data); } catch (err) { this.game.reportError(err, { constructor: { name: 'Multiplayer' } }, ev); } } this.game.events.emit(`net:${ev}`, data); }
  get peers() { return [...this.conns.entries()].filter(([, c]) => c.ch?.readyState === 'open').map(([id]) => id); }
  get connected() { return this.peers.length > 0; }
  /** Peer id of the host (a guest knows it from its one connection). null until connected. */
  get hostId() { return this.isHost ? this.id : (this.room ? ([...this.conns.keys()][0] ?? null) : null); }
  /** True when this peer owns `entity` (spawned entities: the owner given to `spawn`; placed entities: the host). */
  isAuthority(entity) { return (entity?.netOwner ?? this.hostId) === this.id; }

  #sig() {
    if (this.signalling) return this.signalling;
    const room = this.room;
    return {
      send: (m) => fetch(`/__signal/${room}`, { method: 'POST', body: JSON.stringify(m) }),
      subscribe: (fn) => { const es = new EventSource(`/__signal/${room}`); es.onmessage = (e) => { try { fn(JSON.parse(e.data)); } catch { /* ignore */ } }; return () => es.close(); },
    };
  }
  #listen() {
    const sig = this.#sig();
    this.unsub = sig.subscribe((m) => { if (m.from !== this.id && (!m.to || m.to === this.id)) this.#onSignal(m).catch((err) => this.game.reportError(err, { constructor: { name: 'Multiplayer' } }, 'signal')); });
    return sig;
  }
  /** Create a room and wait for guests. Resolves once listening. */
  async host(room) {
    await this.leave(); this.room = room; this.isHost = true; this.sig = this.#listen();
    this.#emit('hosting', { room });
  }
  /** Join a room hosted on the same network; resolves when the data channel to the host is open (rejects after `timeout` ms). */
  async join(room, timeout = 10000) {
    await this.leave(); this.room = room; this.isHost = false; this.sig = this.#listen();
    const ready = new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`multiplayer: no host answered in room '${room}'`)), timeout); const off = this.on('connected', () => { clearTimeout(t); off(); res(); }); });
    await this.sig.send({ type: 'hello', from: this.id });
    return ready;
  }
  async leave() {
    this.unsub?.(); this.unsub = null; clearInterval(this.pingTimer); this.pingTimer = null;
    for (const [id, c] of this.conns) { try { c.ch?.close(); c.pc.close(); } catch { /* closed */ } this.conns.delete(id); }
    this.room = null; this.isHost = false; this.rtt.clear();
  }

  #pc(peer) {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const conn = { pc, ch: null }; this.conns.set(peer, conn);
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) this.#drop(peer); };
    return conn;
  }
  #drop(peer) {
    const c = this.conns.get(peer); if (!c) return;
    const wasOpen = c.ch?.readyState === 'open' || c.opened;
    this.conns.delete(peer); this.rtt.delete(peer); try { c.pc.close(); } catch { /* closed */ }
    if (wasOpen) {
      if (this.isHost) for (const [netId, e] of [...this.spawned]) if (e?.netOwner === peer) this.despawn(netId); // a leaving player takes their entities with them
      this.#emit('leave', { id: peer });
    }
  }
  #wire(peer, ch) {
    const conn = this.conns.get(peer); conn.ch = ch;
    ch.onopen = () => this.#opened(peer);
    ch.onclose = () => this.#drop(peer);
    ch.onmessage = (e) => this.#recv(peer, e.data);
  }
  #opened(peer) {
    const conn = this.conns.get(peer); if (!conn) return;
    conn.opened = true; this.#emit(this.isHost ? 'join' : 'connected', { id: peer }); if (this.isHost) this.#emit('connected', { id: peer });
    if (this.isHost) for (const [netId, e] of this.spawned) if (e) this.send('__spawn', this.#spawnInfo(netId, e), { to: peer }); // late joiner: replay what exists
    if (!this.pingTimer) { this.pingTimer = setInterval(() => this.#ping(), PING_MS); this.pingTimer.unref?.(); }
  }
  #ping() { for (const p of this.peers) this.send('__ping', { t: now() }, { to: p }); }

  #gathered(pc) {
    return new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, ICE_WAIT); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
  }
  async #onSignal(m) {
    if (this.isHost && m.type === 'hello') { // a guest wants in: offer it a data channel
      const conn = this.#pc(m.from);
      this.#wire(m.from, conn.pc.createDataChannel('nord'));
      await conn.pc.setLocalDescription(await conn.pc.createOffer());
      await this.#gathered(conn.pc);
      await this.sig.send({ type: 'offer', from: this.id, to: m.from, sdp: conn.pc.localDescription.sdp });
    } else if (!this.isHost && m.type === 'offer') {
      const conn = this.#pc(m.from);
      conn.pc.ondatachannel = (e) => this.#wire(m.from, e.channel);
      await conn.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      await conn.pc.setLocalDescription(await conn.pc.createAnswer());
      await this.#gathered(conn.pc);
      await this.sig.send({ type: 'answer', from: this.id, to: m.from, sdp: conn.pc.localDescription.sdp });
    } else if (this.isHost && m.type === 'answer') {
      await this.conns.get(m.from)?.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
    }
  }

  // ---- transport (stats + simulator live here)
  #transmit(ch, text) {
    if (ch?.readyState !== 'open') return;
    const s = this.sim;
    if (s.loss > 0 && Math.random() < s.loss) { this.counters.dropped++; return; }
    this.counters.msgsOut++; this.counters.bytesOut += text.length;
    const delay = s.latency + (s.jitter ? (Math.random() * 2 - 1) * s.jitter : 0);
    if (delay > 0) { const t = setTimeout(() => { if (ch.readyState === 'open') ch.send(text); }, delay); t.unref?.(); } else ch.send(text);
  }
  #fanout(text, except) { for (const [id, c] of this.conns) if (id !== except) this.#transmit(c.ch, text); }
  #route(text, to) { this.#transmit(this.conns.get(to)?.ch, text); }
  #recv(peer, text) {
    let m; try { m = JSON.parse(text); } catch { return; }
    this.counters.msgsIn++; this.counters.bytesIn += String(text).length;
    const from = m.from ?? peer;
    if (m.to && m.to !== this.id) { if (this.isHost) this.#route(JSON.stringify({ ...m, from }), m.to); return; } // addressed to another peer: the host forwards it
    if (typeof m.name === 'string' && m.name.startsWith('__')) this.#internal(m, from);
    else { this.last = { name: m.name, data: m.data, from }; this.#emit('message', { from, name: m.name, data: m.data }); }
    if (this.isHost && !m.to) this.#fanout(JSON.stringify({ ...m, from }), peer); // broadcast: relay to the other guests
  }
  /** Send to every other player (or only to `to`). `data` must be JSON-serialisable. */
  send(name, data = 0, { to = null } = {}) {
    const text = JSON.stringify(to ? { name, data, from: this.id, to } : { name, data, from: this.id });
    if (to && this.isHost) return this.#route(text, to);
    for (const c of this.conns.values()) this.#transmit(c.ch, text);
  }

  // ---- internal messages
  #internal(m, from) {
    const d = m.data;
    switch (m.name) {
      case '__ping': this.send('__pong', { t: d.t }, { to: from }); break;
      case '__pong': this.rtt.set(from, now() - d.t); break;
      case '__rpc': this.#invoke(d.n, d.a, from); break;
      case '__spawn': this.#spawnLocal(d).catch((err) => this.game.reportError(err, { constructor: { name: 'Multiplayer' } }, 'spawn')); break;
      case '__spawnReq': if (this.isHost) this.spawn(d.prefab, { ...d.opts, owner: from }).catch((err) => this.game.reportError(err, { constructor: { name: 'Multiplayer' } }, 'spawn')); break;
      case '__despawn': this.#despawnLocal(d.netId); break;
      case '__sync': this.syncs.get(d.id)?.receive?.(d, from); break;
      default: break;
    }
  }

  // ---- RPC (Godot-style): `net.rpc('hit', (args, { from }) => …)` registers; `net.call('hit', { dmg: 3 })` runs it on every other peer.
  /** Register a handler. `from: 'host'` accepts the call only when the host sent it (Godot "authority" mode); default accepts anyone. */
  rpc(name, fn, { from = 'any' } = {}) { this.rpcs.set(name, { fn, from }); return () => this.rpcs.delete(name); }
  /** Call `name` on every other peer, or on one (`{ to: peerId }`). `{ local: true }` also runs it here. */
  call(name, args = null, { to = null, local = false } = {}) {
    if (local) this.#invoke(name, args, this.id);
    this.send('__rpc', { n: name, a: args }, { to });
  }
  /** Call `name` on the host only. */
  callHost(name, args = null) { const h = this.hostId; if (h === this.id) this.#invoke(name, args, this.id); else if (h) this.send('__rpc', { n: name, a: args }, { to: h }); }
  #invoke(name, args, from) {
    const r = this.rpcs.get(name);
    if (!r) { if (!this.warned.has(name)) { this.warned.add(name); this.game.warn?.(`[nord] rpc '${name}' has no handler on this peer`); } return; }
    if (r.from === 'host' && from !== this.hostId && from !== this.id) { this.game.warn?.(`[nord] rpc '${name}' ignored: only the host may call it`); return; }
    try { r.fn(args, { from, isHost: from === this.hostId }); } catch (err) { this.game.reportError(err, { constructor: { name: `rpc ${name}` } }, 'rpc'); }
  }

  // ---- replicated spawner (host authority): the host creates the entity and every peer mirrors it
  #spawnInfo(netId, e) { return { netId, prefab: e.netPrefab, pos: [...e.pos], rot: [...e.rot], scale: [...e.scale], owner: e.netOwner }; }
  /** Spawn a prefab on every peer. Host: creates it and returns the entity. Guest: asks the host (the entity shows up via the `spawned` event) and returns null. */
  async spawn(prefab, { pos, rot, scale, owner = null } = {}) {
    if (!this.isHost) { if (this.hostId) this.send('__spawnReq', { prefab, opts: { pos, rot, scale } }, { to: this.hostId }); return null; }
    const netId = `${this.id}:${++this.counter}`;
    const e = await this.#spawnLocal({ netId, prefab, pos, rot, scale, owner: owner ?? this.id });
    if (e) this.send('__spawn', this.#spawnInfo(netId, e));
    return e;
  }
  async #spawnLocal(info) {
    if (this.spawned.has(info.netId)) return this.spawned.get(info.netId);
    this.spawned.set(info.netId, null); // reserve: a duplicate message must not spawn twice
    for (let i = 0; !this.game.scene && i < 100; i++) await new Promise((r) => setTimeout(r, 50)); // a guest may connect before its scene is loaded
    const e = await this.game.scene.spawn(info.prefab, { pos: info.pos, rot: info.rot, scale: info.scale });
    e.netId = info.netId; e.netOwner = info.owner; e.netPrefab = info.prefab;
    this.spawned.set(info.netId, e); this.#emit('spawned', { entity: e, netId: info.netId, owner: info.owner });
    return e;
  }
  /** Host: remove a spawned entity everywhere (by entity or netId). */
  despawn(which) {
    const netId = typeof which === 'string' ? which : which?.netId; if (!netId || !this.isHost) return;
    this.#despawnLocal(netId); this.send('__despawn', { netId });
  }
  #despawnLocal(netId) {
    const e = this.spawned.get(netId); this.spawned.delete(netId);
    if (e && !e.destroyed) { this.#emit('despawned', { entity: e, netId }); e.destroy(); }
  }

  // ---- network tooling
  /** Outgoing network simulator for testing: fixed `latency` ms, ±`jitter` ms, `loss` 0..1 (all in this peer's sends). */
  simulate({ latency = 0, jitter = 0, loss = 0 } = {}) { this.sim = { latency: Math.max(0, latency), jitter: Math.max(0, jitter), loss: Math.min(1, Math.max(0, loss)) }; return this.sim; }
  /** Ping, traffic and simulator state (also shown in the debugger's Network tab and the editor's Profiler). */
  stats() {
    const t = now(), c = this.counters, s = this.snap;
    if (t - s.t >= 1000) { const dt = (t - s.t) / 1000; s.inRate = (c.bytesIn - s.bytesIn) / dt; s.outRate = (c.bytesOut - s.bytesOut) / dt; s.t = t; s.bytesIn = c.bytesIn; s.bytesOut = c.bytesOut; }
    const r = [...this.rtt.values()];
    return { room: this.room, isHost: this.isHost, id: this.id, peers: this.peers.length, pingMs: r.length ? r.reduce((a, b) => a + b, 0) / r.length : null, ...c, inPerSec: s.inRate, outPerSec: s.outRate, spawned: this.spawned.size, sim: { ...this.sim } };
  }

  /** In-memory connection between two Multiplayer objects (no WebRTC, no signalling): `a` becomes the host, `b` a guest. For tests and local bots. */
  static link(a, b) {
    const room = 'local'; a.room = b.room = room; a.isHost = true; b.isHost = false;
    const chan = (to, from) => ({ readyState: 'open', send: (t) => queueMicrotask(() => to.#recv(from.id, t)), close() { if (this.readyState === 'closed') return; this.readyState = 'closed'; queueMicrotask(() => to.#drop(from.id)); from.#drop(to.id); } });
    a.conns.set(b.id, { pc: { close() {} }, ch: chan(b, a) }); b.conns.set(a.id, { pc: { close() {} }, ch: chan(a, b) });
    a.#opened(b.id); b.#opened(a.id);
  }
}
