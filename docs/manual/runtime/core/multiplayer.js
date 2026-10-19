// Multiplayer (M10-32, optional): WebRTC peer-to-peer data channels, signalling through `nord serve` (or `nord serve --lan`, so a phone and a PC
// can play together). No third-party servers, no STUN: it works between devices on the same network.
//   const net = game.net;  await net.host('room1');  /  await net.join('room1');
//   net.send('pos', { x: 10, y: 20 })       → every other player gets it:  net.on('message', ({ from, name, data }) => …)
//   net.on('join' | 'leave', ({ id }))      net.peers (ids)  net.isHost  net.id
// Topology: a star. Guests talk to the host; the host relays guest messages to the other guests, so everyone sees everything.
// Event sheets: Multiplayer → Host / Join / Send / Leave;  On connected, On peer joined/left, On message (name);  Multiplayer.Last / LastFrom / PeerCount / Id.
// Custom signalling for static hosting: net.signalling = { send(msg), subscribe(fn) → unsubscribe }.
const ID = () => Math.random().toString(36).slice(2, 8);
const ICE_WAIT = 2500;

export class Multiplayer {
  constructor(game) {
    this.game = game; this.id = ID(); this.isHost = false; this.room = null; this.conns = new Map(); // peerId -> { pc, ch }
    this.handlers = new Map(); this.last = { name: '', data: 0, from: '' };
    this.signalling = null; this.unsub = null;
  }
  on(ev, fn) { const l = this.handlers.get(ev) ?? new Set(); l.add(fn); this.handlers.set(ev, l); return () => l.delete(fn); }
  #emit(ev, data) { for (const fn of [...(this.handlers.get(ev) ?? [])]) { try { fn(data); } catch (err) { this.game.reportError(err, { constructor: { name: 'Multiplayer' } }, ev); } } this.game.events.emit(`net:${ev}`, data); }
  get peers() { return [...this.conns.entries()].filter(([, c]) => c.ch?.readyState === 'open').map(([id]) => id); }
  get connected() { return this.peers.length > 0; }

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
    this.unsub?.(); this.unsub = null;
    for (const [id, c] of this.conns) { try { c.ch?.close(); c.pc.close(); } catch { /* closed */ } this.conns.delete(id); }
    this.room = null; this.isHost = false;
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
    this.conns.delete(peer); try { c.pc.close(); } catch { /* closed */ }
    if (wasOpen) this.#emit('leave', { id: peer });
  }
  #wire(peer, ch) {
    const conn = this.conns.get(peer); conn.ch = ch;
    ch.onopen = () => { conn.opened = true; this.#emit(this.isHost ? 'join' : 'connected', { id: peer }); if (this.isHost) this.#emit('connected', { id: peer }); };
    ch.onclose = () => this.#drop(peer);
    ch.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      this.last = { name: m.name, data: m.data, from: m.from ?? peer };
      this.#emit('message', { from: m.from ?? peer, name: m.name, data: m.data });
      if (this.isHost) this.#fanout(JSON.stringify({ ...m, from: m.from ?? peer }), peer); // relay to the other guests
    };
  }
  #fanout(text, except) { for (const [id, c] of this.conns) if (id !== except && c.ch?.readyState === 'open') c.ch.send(text); }
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
  /** Send to every other player. `data` must be JSON-serialisable. */
  send(name, data = 0) {
    const text = JSON.stringify({ name, data, from: this.id });
    for (const c of this.conns.values()) if (c.ch?.readyState === 'open') c.ch.send(text);
  }
}
