class _ {
  constructor({ server: e, peers: t, reconnectManager: s, plugins: r }) {
    this.server = e, this.peers = t, this.reconnectManager = s, this.plugins = r, this._wire();
  }
  _wire() {
    this.peers.on("ping", ({ clientId: e, id: t }) => {
      this.send(e, { type: "pong", id: t });
    }), this.peers.on("peer-transport-lost", (e) => {
      console.log(`Peer ${e} transport lost, starting reconnection process...`);
    }), this.reconnectManager.on("disconnected", (e) => {
      this.peers.destroyPeer(e);
    }), this.server.on("new-peer", (e) => {
      this.peers.addPeer(e);
    }), this.server.on("peer-reconnected", (e) => {
      this.peers.reconnectPeer(e);
    }), this.server.on("peer-transport-lost", (e) => {
      this.peers.emit("peer-transport-lost", e);
    }), this.server.on("signal", (e, t) => {
      this.peers.handleSignal(e, t);
    }), this.server.on("peer-left", (e) => {
      this.reconnectManager.peerLeft(e), this.peers.destroyPeer(e);
    }), this.server.on("host-resumed", async ({ pendingPeers: e = [] }) => {
      for (const t of e)
        t.type === "peer-left" ? (this.reconnectManager.peerLeft(t.userId), this.peers.destroyPeer(t.userId)) : t.type === "peer-disconnected" ? this.peers.emit("peer-transport-lost", t.userId) : t.type === "peer-reconnected" ? await this.peers.reconnectPeer(t.userId) : t.type === "new-peer" && await this.peers.addPeer(t.userId);
      this.peers.emit("host-signaling-restored");
    }), this.server.on("room-closed", (e) => {
      this._closePeers(), this.peers.emit("room-closed", e);
    }), this.server.on("host-resume-rejected", (e) => {
      this._closePeers(), this.peers.emit("room-closed", { ...e, reason: "host-resume-rejected" });
    });
  }
  _closePeers() {
    this.reconnectManager.reset(), this.peers.closeAll();
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
  stop(e) {
    this.server.stop(e), this._closePeers();
  }
}
class l {
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
const m = {
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  HOST_DISCONNECTED: "host-disconnected"
}, o = {
  JOIN: "join",
  SIGNAL: "signal",
  CLIENT_DISCONNECTED: "client-disconnected",
  HOST_DISCONNECTED: "host-disconnected",
  ROOM_CREATED: "room-created",
  HOST_RESUMED: "host-resumed",
  HOST_RESUME_REJECTED: "host-resume-rejected",
  ROOM_CLOSED: "room-closed",
  JOIN_ACCEPTED: "join-accepted",
  NEW_PEER: "new-peer",
  PEER_LEFT: "peer-left",
  PEER_DISCONNECTED: "peer-disconnected",
  PEER_RECONNECTED: "peer-reconnected"
};
function S(n, e = {}) {
  return { type: n, ...e };
}
function E(n) {
  try {
    return JSON.parse(n);
  } catch {
    return console.warn("Invalid signal JSON:", n), null;
  }
}
const c = 1, p = 0;
function d(n, e, t) {
  typeof n.addEventListener == "function" ? n.addEventListener(e, t) : n.on(e, t);
}
function f(n) {
  return n && typeof n == "object" && "data" in n ? n.data : n;
}
class C extends l {
  constructor({ url: e, WebSocketImpl: t = globalThis.WebSocket, reconnectDelay: s = 2e3 } = {}) {
    if (super(), !e) throw new TypeError("HostServer requires a signaling url");
    if (!t) throw new TypeError("No WebSocket implementation is available");
    this.url = e, this.WebSocketImpl = t, this.reconnectDelay = s, this.ws = null, this._sendQueue = [], this._reconnectTimer = null, this._stopped = !0, this._roomActive = !1, this._intentionalStop = !1, this.roomId = null, this.hostId = null, this.hostToken = null;
  }
  start() {
    var e, t;
    this._stopped = !1, this._intentionalStop = !1, !(((e = this.ws) == null ? void 0 : e.readyState) === c || ((t = this.ws) == null ? void 0 : t.readyState) === p) && this._connect();
  }
  _connect() {
    var t, s;
    if (this._stopped || ((t = this.ws) == null ? void 0 : t.readyState) === c || ((s = this.ws) == null ? void 0 : s.readyState) === p) return;
    clearTimeout(this._reconnectTimer);
    const e = new this.WebSocketImpl(this.url);
    this.ws = e, d(e, "open", () => {
      this.ws === e && (this.emit("open"), this.roomId && this.hostToken ? this._sendRaw({ type: "host-resume", roomId: this.roomId, hostId: this.hostId, hostToken: this.hostToken }) : this._flushSendQueue());
    }), d(e, "message", (r) => {
      if (this.ws !== e) return;
      let i;
      try {
        const h = f(r);
        i = JSON.parse(typeof h == "string" ? h : h.toString());
      } catch {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (i.type) {
        case o.ROOM_CREATED:
          this.roomId = i.roomId, this.hostId = i.hostId ?? i.userId, this.hostToken = i.hostToken, this._roomActive = !0, this.emit("room-created", i), this._flushSendQueue();
          break;
        case o.HOST_RESUMED:
          this._roomActive = !0, this.emit("host-resumed", i), this._flushSendQueue();
          break;
        case o.HOST_RESUME_REJECTED:
          this._roomActive = !1, this.roomId = null, this.hostId = null, this.hostToken = null, this.emit("host-resume-rejected", i);
          break;
        case o.ROOM_CLOSED:
          this._roomActive = !1, this.roomId = null, this.hostId = null, this.hostToken = null, this.emit("room-closed", i);
          break;
        case o.NEW_PEER:
          this.emit("new-peer", i.userId, i);
          break;
        case o.PEER_LEFT:
          this.emit("peer-left", i.userId, i);
          break;
        case o.PEER_DISCONNECTED:
          this.emit("peer-transport-lost", i.userId, i);
          break;
        case o.PEER_RECONNECTED:
          this.emit("peer-reconnected", i.userId, i);
          break;
        case o.SIGNAL:
          this.emit("signal", i.from, i.payload);
          break;
        default:
          i.type ? this.emit(i.type, i) : this.emit("unknown-message", i);
      }
    }), d(e, "close", (r, i) => {
      this.ws === e && (this.emit("close", { code: (r == null ? void 0 : r.code) ?? r, reason: (r == null ? void 0 : r.reason) ?? i }), this.roomId && (this._roomActive = !1, this.emit("host-signaling-lost", { roomId: this.roomId })), !this._stopped && !this._intentionalStop && (clearTimeout(this._reconnectTimer), this._reconnectTimer = setTimeout(() => this._connect(), this.reconnectDelay)));
    }), d(e, "error", (r) => {
      this.ws === e && this.emit("error", r);
    });
  }
  _sendRaw(e) {
    var t;
    return ((t = this.ws) == null ? void 0 : t.readyState) !== c ? !1 : (this.ws.send(JSON.stringify(e)), !0);
  }
  _flushSendQueue() {
    var e;
    if (!(!this._roomActive && this.roomId))
      for (; this._sendQueue.length && ((e = this.ws) == null ? void 0 : e.readyState) === c; )
        this.ws.send(this._sendQueue.shift());
  }
  send(e, t = {}) {
    var r;
    const s = { type: e, ...t };
    return e === o.SIGNAL && (!this._roomActive || ((r = this.ws) == null ? void 0 : r.readyState) !== c) ? (this.emit("signal-dropped", s), !1) : this._sendRaw(s) ? !0 : (e !== o.SIGNAL && this._sendQueue.push(JSON.stringify(s)), !this._stopped && (!this.ws || this.ws.readyState > c) && this._connect(), !1);
  }
  sendSignal(e, t) {
    return this.send(o.SIGNAL, {
      payload: { target: e, ...t }
    });
  }
  getRoomID() {
    return this.roomId;
  }
  getHostID() {
    return this.hostId;
  }
  stop({ permanent: e = !0 } = {}) {
    var s;
    clearTimeout(this._reconnectTimer), this._stopped = !0, this._intentionalStop = e, e && this.roomId && ((s = this.ws) == null ? void 0 : s.readyState) === c && this._sendRaw({ type: o.HOST_DISCONNECTED, roomId: this.roomId, hostId: this.hostId });
    const t = this.ws;
    this.ws = null, this._roomActive = !1, this._sendQueue = [], e && (this.roomId = null, this.hostId = null, this.hostToken = null), t == null || t.close();
  }
}
const g = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
class T extends l {
  constructor({ hostServer: e, rtc: t = globalThis, rtcConfiguration: s }) {
    super(), this.hostServer = e, this.rtc = t, this.rtcConfiguration = s ?? g, this.peerConnections = /* @__PURE__ */ new Map(), this.dataChannels = /* @__PURE__ */ new Map(), this.iceCandidateBuffers = /* @__PURE__ */ new Map(), this.reconnecting = /* @__PURE__ */ new Set(), this.pendingRenegotiation = /* @__PURE__ */ new Map();
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
  addPeer(e) {
    return this._createPeer(e);
  }
  reconnectPeer(e) {
    return this._replacePeer(e);
  }
  handleSignal(e, t) {
    return this._handleSignal(e, t);
  }
  closeAll() {
    for (const e of [...this.peerConnections.keys()]) this.destroyPeer(e);
  }
  destroyPeer(e, { emit: t = !0 } = {}) {
    this._destroyTransport(e), t && this.emit("peer-disconnected", e);
  }
  /*
  ============================================
  PEER CREATION
  ============================================
  */
  async _createPeer(e, { reconnecting: t = !1 } = {}) {
    if (this.peerConnections.has(e))
      return;
    const s = new this.rtc.RTCPeerConnection(
      this.rtcConfiguration
    ), r = s.createDataChannel("data");
    s.__peerboxReconnect = t, s.__peerboxSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`, this.peerConnections.set(e, s), this.dataChannels.set(e, r), this.iceCandidateBuffers.set(e, []), this._attachPeerHandlers(e, s, r);
    try {
      const i = await s.createOffer();
      await s.setLocalDescription(i), this.hostServer.sendSignal(e, {
        type: "offer",
        reconnect: t,
        sessionId: s.__peerboxSessionId,
        sdp: s.localDescription
      });
    } catch (i) {
      this.emit("error", i, e);
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
    this._destroyTransport(e), await this._createPeer(e, { reconnecting: !0 });
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
      this.emit("peer-connected", e, { reconnected: !!t.__peerboxReconnect });
    }, s.onclose = () => {
      this.dataChannels.get(e) === s && this.emit("peer-transport-lost", e);
    }, s.onerror = (r) => {
      this.emit("error", r, e);
    }, s.onmessage = (r) => {
      this.dataChannels.get(e) === s && this._handleDataMessage(e, r.data);
    }, t.onicecandidate = (r) => {
      r.candidate && this.hostServer.sendSignal(e, {
        type: "ice-candidate",
        sessionId: t.__peerboxSessionId,
        candidate: r.candidate
      });
    }, t.onconnectionstatechange = () => {
      const r = t.connectionState;
      if (r === "disconnected" || r === "failed" || r === "closed") {
        if (this.peerConnections.get(e) !== t) return;
        this.emit("peer-transport-lost", e);
      }
    }, t.ontrack = (r) => {
      this.peerConnections.get(e) === t && this.emit("track", {
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
    s && (t.sessionId && t.sessionId !== s.__peerboxSessionId || (t.type === "answer" ? this._handleAnswer(e, s, t) : t.type === "ice-candidate" ? this._handleIceCandidate(e, s, t) : t.type === "offer" && this._handleOffer(e, s, t)));
  }
  async _handleAnswer(e, t, s) {
    try {
      if (await t.setRemoteDescription(
        new this.rtc.RTCSessionDescription(s.sdp)
      ), this.peerConnections.get(e) !== t) return;
      const r = this.iceCandidateBuffers.get(e) || [];
      for (const i of r)
        try {
          await t.addIceCandidate(i);
        } catch (h) {
          this.emit("error", h, e);
        }
      this.iceCandidateBuffers.set(e, []), await this._flushNegotiation(e, t);
    } catch (r) {
      this.emit("error", r, e);
    }
  }
  async _handleIceCandidate(e, t, s) {
    var i, h;
    if (this.peerConnections.get(e) !== t || !((i = s.candidate) != null && i.candidate))
      return;
    const r = new this.rtc.RTCIceCandidate(s.candidate);
    if (t.remoteDescription)
      try {
        await t.addIceCandidate(r);
      } catch (u) {
        this.emit("error", u, e);
      }
    else
      (h = this.iceCandidateBuffers.get(e)) == null || h.push(r);
  }
  async _handleOffer(e, t, s) {
    try {
      if (await t.setRemoteDescription(
        new this.rtc.RTCSessionDescription(s.sdp)
      ), this.peerConnections.get(e) !== t) return;
      const r = await t.createAnswer();
      await t.setLocalDescription(r), this.hostServer.sendSignal(e, {
        type: "answer",
        sessionId: t.__peerboxSessionId,
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
    if (this.peerConnections.get(t) !== e) return;
    console.log("Renegotiating with peer", t);
    const s = await e.createOffer();
    await e.setLocalDescription(s), this.hostServer.sendSignal(t, {
      type: "offer",
      sessionId: e.__peerboxSessionId,
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
const a = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  RECONNECTED: "reconnected",
  FAILED: "failed",
  SYNCED: "synced"
});
class N extends l {
  constructor({ peers: e }, t = {}) {
    super(), this.peers = e, this.gracePeriod = t.gracePeriod ?? 12e4, this.peerStates = /* @__PURE__ */ new Map(), this.disconnectTimers = /* @__PURE__ */ new Map(), this._bindEvents();
  }
  _bindEvents() {
    this.peers.on("peer-transport-lost", (e) => {
      this._beginReconnect(e);
    }), this.peers.on("peer-connected", (e) => {
      this._markConnected(e);
    });
  }
  getState(e) {
    return this.peerStates.get(e) || a.DISCONNECTED;
  }
  isConnected(e) {
    const t = this.getState(e);
    return t === a.CONNECTED || t === a.RECONNECTED || t === a.SYNCED;
  }
  _setState(e, t) {
    const s = this.peerStates.get(e);
    s !== t && (this.peerStates.set(e, t), this.emit("state-change", { clientId: e, current: t, previous: s }));
  }
  _beginReconnect(e) {
    if (this.getState(e) === a.RECONNECTING) return;
    this._setState(e, a.RECONNECTING), this.emit("reconnecting", e), this._clearDisconnectTimer(e);
    const s = setTimeout(() => {
      var i, h;
      this.getState(e) === a.RECONNECTING && (this._setState(e, a.FAILED), this.emit("failed", e), (h = (i = this.peers).destroyPeer) == null || h.call(i, e, { emit: !1 }), this._setState(e, a.DISCONNECTED), console.log(`Peer ${e} failed to reconnect within grace period, disconnecting.`), this.emit("disconnected", e));
    }, this.gracePeriod);
    this.disconnectTimers.set(e, s);
  }
  _markConnected(e) {
    this._clearDisconnectTimer(e), this.getState(e) === a.RECONNECTING ? (this._setState(e, a.RECONNECTED), this.emit("reconnected", e)) : (this._setState(e, a.CONNECTED), this.emit("connected", e));
  }
  peerLeft(e) {
    this._clearDisconnectTimer(e), this.peerStates.delete(e);
  }
  reset() {
    for (const e of this.disconnectTimers.values()) clearTimeout(e);
    this.disconnectTimers.clear(), this.peerStates.clear();
  }
  _markSynced(e) {
    this._setState(e, a.SYNCED), this.emit("synced", e);
  }
  _clearDisconnectTimer(e) {
    const t = this.disconnectTimers.get(e);
    t !== void 0 && (clearTimeout(t), this.disconnectTimers.delete(e));
  }
}
function w() {
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
  l as E,
  C as H,
  o as S,
  m as a,
  T as b,
  S as c,
  N as d,
  _ as e,
  w as f,
  E as p
};
