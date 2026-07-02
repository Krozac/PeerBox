class w {
  constructor({ server: e, peers: t, reconnectManager: s, plugins: r }) {
    this.server = e, this.peers = t, this.reconnectManager = s, this.plugins = r, this._wire();
  }
  _wire() {
    this.peers.on("ping", ({ clientId: e, id: t }) => {
      this.send(e, { type: "pong", id: t });
    }), this.peers.on("peer-transport-lost", (e) => {
      console.log(`Peer ${e} transport lost, starting reconnection process...`), this.reconnectManager._beginReconnect(e);
    }), this.peers.on("peer-reconnected", (e) => {
      console.log(`Peer ${e} reconnected, marking as reconnected.`), this.reconnectManager._markReconnected(e);
    }), this.reconnectManager.on("disconnected", (e) => {
      this.peers.destroyPeer(e), this.peers.emit("peer-disconnected", e);
    }), this.server.on("new-peer", (e) => {
      this.peers._createPeer(e);
    }), this.server.on("peer-reconnected", (e) => {
      this.peers._replacePeer(e);
    }), this.server.on("signal", (e, t) => {
      this.peers._handleSignal(e, t);
    }), this.server.on("peer-left", (e) => {
      this.peers.destroyPeer(e);
    });
  }
  on(e, t) {
    this.peers.on(e, t);
  }
  broadcast(e, t) {
    this.peers.broadcast(e, t);
  }
  send(e, t) {
    this.peers.send(e, t);
  }
  start() {
    this.server.start();
  }
}
class p {
  constructor() {
    this.events = /* @__PURE__ */ new Map();
  }
  on(e, t) {
    return this.events.has(e) || this.events.set(e, /* @__PURE__ */ new Set()), this.events.get(e).add(t), this;
  }
  off(e, t) {
    var s;
    (s = this.events.get(e)) == null || s.delete(t);
  }
  emit(e, ...t) {
    var s;
    (s = this.events.get(e)) == null || s.forEach((r) => r(...t));
  }
}
function l(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var h, d;
function f() {
  return d || (d = 1, h = function() {
    throw new Error(
      "ws does not work in the browser. Browser clients must use the native WebSocket object"
    );
  }), h;
}
var u = f();
const c = /* @__PURE__ */ l(u), _ = {
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  HOST_DISCONNECTED: "host-disconnected"
}, a = {
  SIGNAL: "signal",
  CLIENT_DISCONNECTED: "client-disconnected",
  NEW_PEER: "new-peer",
  PEER_LEFT: "peer-left",
  PEER_DISCONNECTED: "peer-disconnected",
  PEER_RECONNECTED: "peer-reconnected"
};
function m(n, e = {}) {
  return { type: n, ...e };
}
function E(n) {
  try {
    return JSON.parse(n);
  } catch {
    return console.warn("Invalid signal JSON:", n), null;
  }
}
class S extends p {
  constructor({ url: e, WebSocketImpl: t = globalThis.WebSocket } = {}) {
    super(), this.url = e, this.ws = new t(this.url), this._sendQueue = [], this._reconnectTimer = null;
  }
  start() {
    this.ws && this.ws.readyState === c.OPEN || this._connect();
  }
  _connect() {
    this.ws.on("open", () => {
      this.emit("open"), this._flushSendQueue();
    }), this.ws.on("message", (e) => {
      let t;
      try {
        t = JSON.parse(e), console.log("Received message from signaling server:", t);
      } catch {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (t.type) {
        case a.NEW_PEER:
          this.emit("new-peer", t.userId);
          break;
        case a.PEER_LEFT:
          this.emit("peer-intentional-leave", t.userId);
          break;
        case a.PEER_DISCONNECTED:
          this.emit("peer-transport-lost", t.userId);
          break;
        case a.PEER_RECONNECTED:
          this.emit("peer-reconnected", t.userId);
          break;
        case a.SIGNAL:
          this.emit("signal", t.from, t.payload);
          break;
        default:
          t.type ? this.emit(t.type, t) : this.emit("unknown-message", t);
      }
    }), this.ws.on("close", (e, t) => {
      this.emit("close", { code: e, reason: t }), clearTimeout(this._reconnectTimer), this._reconnectTimer = setTimeout(() => this._connect(), 2e3);
    }), this.ws.on("error", (e) => {
      this.emit("error", e);
    });
  }
  _flushSendQueue() {
    if (!(!this.ws || this.ws.readyState !== c.OPEN))
      for (; this._sendQueue.length; ) {
        const e = this._sendQueue.shift();
        this.ws.send(e);
      }
  }
  send(e, t = {}) {
    const s = JSON.stringify({ type: e, ...t });
    this.ws && this.ws.readyState === c.OPEN ? this.ws.send(s) : (this._sendQueue.push(s), (!this.ws || this.ws.readyState === c.CLOSED) && this._connect());
  }
  sendSignal(e, t) {
    this.send("signal", {
      payload: { target: e, ...t }
    });
  }
  getRoomID() {
    return this.roomID;
  }
  getHostID() {
    return this.hostID;
  }
  stop() {
    this.ws && (this.ws.close(), this.ws = null), clearTimeout(this._reconnectTimer), this._sendQueue = [];
  }
}
class y extends p {
  constructor({ hostServer: e, rtc: t = globalThis, rtcConfiguration: s }) {
    super(), this.hostServer = e, this.rtc = t, this.rtcConfiguration = s, this.peerConnections = /* @__PURE__ */ new Map(), this.dataChannels = /* @__PURE__ */ new Map(), this.iceCandidateBuffers = /* @__PURE__ */ new Map(), this.reconnecting = /* @__PURE__ */ new Set(), this.pendingRenegotiation = /* @__PURE__ */ new Map();
  }
  /*
  ============================================
  PUBLIC
  ============================================
  */
  send(e, t) {
    const s = this.dataChannels.get(e);
    s && s.readyState === "open" && s.send(JSON.stringify(t));
  }
  broadcast(e, { exclude: t } = {}) {
    for (const [s, r] of this.dataChannels.entries())
      s !== t && r.readyState === "open" && r.send(JSON.stringify(e));
  }
  destroyPeer(e) {
    this._destroyTransport(e), this.emit("peer-disconnected", e);
  }
  async _replacePeer(e) {
    console.log(`Replacing peer ${e}`), this._destroyTransport(e), await this._createPeer(e);
  }
  /*
  ============================================
  PEER CREATION
  ============================================
  */
  async _createPeer(e) {
    if (this.peerConnections.has(e))
      return;
    const t = new this.rtc.RTCPeerConnection(
      this.rtcConfiguration
    ), s = t.createDataChannel("data");
    this.peerConnections.set(e, t), this.dataChannels.set(e, s), this.iceCandidateBuffers.set(e, []), this._attachPeerHandlers(e, t, s);
    try {
      const r = await t.createOffer();
      await t.setLocalDescription(r), this.hostServer.sendSignal(e, {
        type: "offer",
        sdp: t.localDescription
      });
    } catch (r) {
      this.emit("error", r, e);
    }
  }
  async _replacePeer(e) {
    console.log(`Replacing peer ${e}`);
    const t = this.peerConnections.get(e);
    if (t)
      try {
        t.close();
      } catch {
      }
    this._destroyTransport(e), await this._createPeer(e), this.emit("peer-reconnected", e);
  }
  /*
  ============================================
  TRANSPORT
  ============================================
  */
  _destroyTransport(e) {
    const t = this.peerConnections.get(e);
    if (t)
      try {
        t.close();
      } catch {
      }
    this.peerConnections.delete(e), this.dataChannels.delete(e), this.iceCandidateBuffers.delete(e);
  }
  /*
  ============================================
  HANDLERS
  ============================================
  */
  _attachPeerHandlers(e, t, s) {
    s.onopen = () => {
      this.emit("peer-connected", e);
    }, s.onclose = () => {
      this.emit("peer-transport-lost", e);
    }, s.onerror = (r) => {
      this.emit("error", r, e);
    }, s.onmessage = (r) => {
      this._handleDataMessage(e, r.data);
    }, t.onicecandidate = (r) => {
      r.candidate && this.hostServer.sendSignal(e, {
        type: "ice-candidate",
        candidate: r.candidate
      });
    }, t.onconnectionstatechange = () => {
      const r = t.connectionState;
      (r === "disconnected" || r === "failed" || r === "closed") && this.emit("peer-transport-lost", e);
    }, t.ontrack = (r) => {
      this.emit("track", {
        clientId: e,
        stream: r.streams[0],
        track: r.track
      });
    };
  }
  _handleDataMessage(e, t) {
    let s;
    try {
      s = JSON.parse(t);
    } catch {
      this.emit("error", new Error("Invalid JSON from peer"), e);
      return;
    }
    if (!s) return;
    const r = s.type || "default";
    console.log("RAW MESSAGE:", s), this.emit(r, { clientId: e, ...s });
  }
  /*
  ============================================
  SIGNALING
  ============================================
  */
  _handleSignal(e, t) {
    const s = this.peerConnections.get(e);
    s && (t.type === "answer" ? this._handleAnswer(e, s, t) : t.type === "ice-candidate" ? this._handleIceCandidate(e, s, t) : t.type === "offer" && this._handleOffer(e, s, t));
  }
  async _handleAnswer(e, t, s) {
    try {
      await t.setRemoteDescription(
        new this.rtc.RTCSessionDescription(s.sdp)
      );
      const r = this.iceCandidateBuffers.get(e) || [];
      for (const i of r)
        try {
          await t.addIceCandidate(i);
        } catch (o) {
          this.emit("error", o, e);
        }
      this.iceCandidateBuffers.set(e, []), await this._flushNegotiation(e, t);
    } catch (r) {
      this.emit("error", r, e);
    }
  }
  async _handleIceCandidate(e, t, s) {
    var i, o;
    if (!((i = s.candidate) != null && i.candidate))
      return;
    const r = new this.rtc.RTCIceCandidate(s.candidate);
    if (t.remoteDescription)
      try {
        await t.addIceCandidate(r);
      } catch (g) {
        this.emit("error", g, e);
      }
    else
      (o = this.iceCandidateBuffers.get(e)) == null || o.push(r);
  }
  async _handleOffer(e, t, s) {
    try {
      await t.setRemoteDescription(
        new this.rtc.RTCSessionDescription(s.sdp)
      );
      const r = await t.createAnswer();
      await t.setLocalDescription(r), this.hostServer.sendSignal(e, {
        type: "answer",
        sdp: t.localDescription
      }), await this._flushNegotiation(e, t);
    } catch (r) {
      this.emit("error", r, e);
      return;
    }
  }
  async _renegotiate(e, t) {
    if (e.signalingState !== "stable") {
      console.log("Deferring renegotiation for", t), this.pendingRenegotiation.set(t, !0);
      return;
    }
    await this._doRenegotiate(e, t);
  }
  async _doRenegotiate(e, t) {
    console.log("Renegotiating with peer", t);
    const s = await e.createOffer();
    await e.setLocalDescription(s), this.hostServer.sendSignal(t, {
      type: "offer",
      sdp: e.localDescription
    });
  }
  async _flushNegotiation(e, t) {
    this.pendingRenegotiation.get(e) && t.signalingState === "stable" && (console.log("Flushing pending renegotiation for", e), this.pendingRenegotiation.delete(e), await this._doRenegotiate(t, e));
  }
  //Media tracks handling
  addTrackToAll(e, t) {
    for (const [s, r] of this.peerConnections.entries())
      if (s !== t) {
        for (const i of e.getTracks())
          console.log(`Adding track ${i.kind} to peer ${s}`), r.addTrack(i, e);
        this._renegotiate(r, s);
      }
  }
  addTrackToPeer(e, t) {
    const s = this.peerConnections.get(t);
    if (s) {
      for (const r of e.getTracks())
        console.log(`Adding track ${r.kind} to peer ${t}`), s.addTrack(r, e);
      this._renegotiate(s, t);
    }
  }
}
function C() {
  const n = /* @__PURE__ */ new Map();
  return {
    registerPlugin(e) {
      if (n.has(e.name))
        throw new Error(`Plugin with name ${e.name} is already registered.`);
      n.set(e.name, e);
    },
    getPlugin(e) {
      return n.get(e);
    },
    getAllPlugins() {
      return Array.from(n.values());
    }
  };
}
export {
  p as E,
  S as H,
  a as S,
  c as W,
  _ as a,
  y as b,
  m as c,
  w as d,
  C as e,
  l as g,
  E as p
};
