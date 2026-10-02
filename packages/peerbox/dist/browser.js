import { E as u, S as h, c as g, a as l, p as f, H as _, b as m, d as C, e as S, f as p } from "./pluginRegistry-BPXLzCNK.js";
class I {
  constructor({ server: e, peer: t, plugins: s }) {
    this.server = e, this.peer = t, this.plugins = s;
  }
  async connect() {
    await this.server.start(), this.peer.connect();
  }
  on(e, t) {
    this.peer.on(e, t);
  }
  send(e) {
    this.peer.send(e);
  }
  disconnect() {
    var e, t, s, i;
    (t = (e = this.server).disconnect) == null || t.call(e), (i = (s = this.peer).close) == null || i.call(s);
  }
}
const d = 1, w = 0;
class y extends u {
  constructor({ url: e, roomId: t, username: s, WebSocketImpl: i = globalThis.WebSocket, reconnectDelay: r = 1500 } = {}) {
    if (super(), !e) throw new TypeError("ClientServer requires a signaling url");
    if (!i) throw new TypeError("No WebSocket implementation is available");
    this.url = e, this.roomId = t, this.username = s, this.WebSocketImpl = i, this.reconnectDelay = r, this.ws = null, this._started = !1, this._intentionalClose = !1, this._reconnectTimer = null, this._joinRequest = null, this.userId = null;
  }
  start() {
    var e;
    return this._started = !0, this._intentionalClose = !1, ((e = this.ws) == null ? void 0 : e.readyState) === d ? Promise.resolve() : this._connect();
  }
  _connect() {
    var t, s;
    if (!this._started || ((t = this.ws) == null ? void 0 : t.readyState) === d || ((s = this.ws) == null ? void 0 : s.readyState) === w) return this._connecting;
    clearTimeout(this._reconnectTimer);
    const e = new this.WebSocketImpl(this.url);
    return this.ws = e, this._connecting = new Promise((i, r) => {
      let c = !1;
      e.onopen = () => {
        this.ws === e && (c = !0, this._joinRequest && this._sendRaw(this._joinRequest), this.emit("open", { reconnected: !!this._joinRequest }), i());
      }, e.onmessage = (a) => {
        if (this.ws !== e) return;
        let n;
        try {
          n = JSON.parse(a.data);
        } catch {
          this.emit("error", new Error("Invalid JSON from signaling server"));
          return;
        }
        n.type === h.SIGNAL ? this.emit("signal", n.payload) : n.type === h.HOST_DISCONNECTED ? this.emit("host-disconnected", n) : n.type === h.JOIN_ACCEPTED ? (this.userId = n.userId, this.emit("join-accepted", n)) : n.type === h.ROOM_CLOSED ? this.emit("room-closed", n) : n.type ? this.emit(n.type, n) : this.emit("unknown-message", n);
      }, e.onclose = (a) => {
        this.ws === e && (this.ws = null, c || r(new Error("Signaling WebSocket closed before opening")), this.emit("close", a), this._started && !this._intentionalClose && (this.emit("reconnecting"), clearTimeout(this._reconnectTimer), this._reconnectTimer = setTimeout(() => {
          this._connect().catch((n) => this.emit("error", n));
        }, this.reconnectDelay)));
      }, e.onerror = (a) => {
        this.emit("error", a), c || r(a instanceof Error ? a : new Error("Signaling WebSocket failed to open"));
      };
    }), this._connecting;
  }
  _sendRaw(e) {
    var t;
    return ((t = this.ws) == null ? void 0 : t.readyState) !== d ? !1 : (this.ws.send(typeof e == "string" ? e : JSON.stringify(e)), !0);
  }
  send(e, t = {}) {
    const s = { type: e, ...t };
    return e === h.JOIN && (this._joinRequest = JSON.stringify(s)), this._sendRaw(s) ? !0 : (!this._started && e !== h.JOIN && this.emit("warn", "Signaling socket is not connected"), !1);
  }
  sendSignal(e, t = {}) {
    return this.send(h.SIGNAL, { payload: { target: e, ...t } });
  }
  rejoin() {
    return this._joinRequest ? this._sendRaw(this._joinRequest) : !1;
  }
  disconnect() {
    if (this._intentionalClose = !0, this._started = !1, clearTimeout(this._reconnectTimer), !this.ws) return;
    this.ws.readyState === d && this._joinRequest && this._sendRaw({ type: h.CLIENT_DISCONNECTED, roomId: this.roomId }), this._joinRequest = null, this.userId = null;
    const e = this.ws;
    this.ws = null, e.close();
  }
}
class R extends u {
  constructor({ signaling: e, username: t = "Anonymous", rtcConfiguration: s, rtc: i = globalThis }) {
    super(), this.signaling = e, this.username = t, this.rtcConfiguration = s, this.rtc = i, this.pc = null, this.dataChannel = null, this.pendingIceCandidates = [], this.signalSessionId = null, this._renegotiating = !1, this._pendingRenegotiation = !1, this._recovering = !1, this._setupSignaling();
  }
  _setupSignaling() {
    this.signaling.on("signal", (e) => this._handleSignal(e)), this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    }), this.signaling.on("room-closed", (e) => {
      this._recovering = !0, this.emit("room-closed", e);
    });
  }
  async connect() {
    if (this.pc) return;
    this.pc = new this.rtc.RTCPeerConnection(this.rtcConfiguration ?? {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    const e = this.pc;
    this.pc.onicecandidate = (t) => {
      this.pc === e && t.candidate && this.signaling.sendSignal("host", g(l.ICE_CANDIDATE, {
        candidate: t.candidate,
        sessionId: this.signalSessionId
      }));
    }, this.pc.ondatachannel = (t) => {
      this.pc === e && (this.dataChannel = t.channel, this._setupDataChannel());
    }, this.pc.ontrack = (t) => {
      this.pc === e && this.emit("track", {
        stream: t.streams[0],
        track: t.track
      });
    };
  }
  _setupDataChannel() {
    this.dataChannel && (this.dataChannel.onopen = () => {
      this._recovering = !1, this.emit("connected");
    }, this.dataChannel.onmessage = (e) => {
      const t = f(e.data);
      if (console.log(t), !t) return;
      const s = t.type || "default";
      console.log(s), this.emit(s, t), t.type === l.HOST_DISCONNECTED && this.emit("host-disconnected");
    }, this.dataChannel.onerror = (e) => {
      this.emit("error", e);
    }, this.dataChannel.onclose = () => {
      var e, t;
      this.emit("disconnected"), this._recovering || (this._recovering = !0, (t = (e = this.signaling).rejoin) == null || t.call(e));
    });
  }
  async _handleSignal(e) {
    if (console.log("Received signal from host:", e), !this.pc) {
      this.emit("error", new Error("PeerConnection not initialized"));
      return;
    }
    switch (e.type) {
      case l.OFFER:
        try {
          e.reconnect && this.pc && (this._closePeerConnection(), this.pc = null, await this.connect()), this.signalSessionId && e.sessionId && this.signalSessionId !== e.sessionId && (this.pendingIceCandidates = []), this.signalSessionId = e.sessionId ?? null, await this.pc.setRemoteDescription(new this.rtc.RTCSessionDescription(e.sdp));
          const t = this.pendingIceCandidates.filter(
            (i) => !i.sessionId || !this.signalSessionId || i.sessionId === this.signalSessionId
          );
          for (const { candidate: i } of t)
            try {
              await this.pc.addIceCandidate(i);
            } catch (r) {
              this.emit("error", r);
            }
          this.pendingIceCandidates = [];
          const s = await this.pc.createAnswer();
          await this.pc.setLocalDescription(s), this.signaling.sendSignal("host", g(l.ANSWER, {
            sdp: this.pc.localDescription,
            sessionId: this.signalSessionId
          }));
        } catch (t) {
          this.emit("error", t);
        }
        break;
      case l.ICE_CANDIDATE:
        if (e.candidate)
          try {
            if (this.signalSessionId && e.sessionId && e.sessionId !== this.signalSessionId) break;
            const t = new this.rtc.RTCIceCandidate(e.candidate);
            this.pc.remoteDescription ? await this.pc.addIceCandidate(t) : this.pendingIceCandidates.push({ candidate: t, sessionId: e.sessionId ?? null });
          } catch (t) {
            this.emit("error", t);
          }
        break;
      default:
        this.emit("warn", `Unknown signal type from host: ${e.type}`);
    }
  }
  _closePeerConnection() {
    if (this.dataChannel) {
      this.dataChannel.onopen = null, this.dataChannel.onclose = null, this.dataChannel.onmessage = null, this.dataChannel.onerror = null;
      try {
        this.dataChannel.close();
      } catch {
      }
    }
    if (this.pc) {
      this.pc.onicecandidate = null, this.pc.ondatachannel = null, this.pc.ontrack = null;
      try {
        this.pc.close();
      } catch {
      }
    }
    this.dataChannel = null, this.pendingIceCandidates = [], this.signalSessionId = null;
  }
  close() {
    this._closePeerConnection(), this.pc = null;
  }
  send(e) {
    var s;
    const t = {
      ...e,
      userId: this.signaling.userId,
      connectionId: this.connectionId,
      ts: Date.now()
    };
    ((s = this.dataChannel) == null ? void 0 : s.readyState) === "open" ? this.dataChannel.send(JSON.stringify(t)) : this.emit("warn", "Data channel not open");
  }
  async renegotiate() {
    if (this.pc) {
      if (this._renegotiating) {
        this._pendingRenegotiation = !0;
        return;
      }
      this._renegotiating = !0;
      try {
        const e = await this.pc.createOffer();
        await this.pc.setLocalDescription(e), console.log("Renegotiation offer created and set as local description:", e), this.signaling.sendSignal(
          "host",
          g(l.OFFER, {
            sdp: this.pc.localDescription,
            sessionId: this.signalSessionId
          })
        );
      } finally {
        this._renegotiating = !1, this._pendingRenegotiation && (this._pendingRenegotiation = !1, this.renegotiate());
      }
    }
  }
}
function T(o) {
  var c;
  const e = new _(o), t = new m({
    hostServer: e,
    rtc: globalThis,
    rtcConfiguration: o.rtcConfiguration
  }), s = new C({ peers: t }, { gracePeriod: o.peerReconnectGracePeriod }), i = p(), r = {
    host: {
      server: e,
      peers: t,
      reconnectManager: s,
      plugins: i
    },
    client: null,
    shared: o.shared ?? {}
  };
  for (const a of o.plugins ?? [])
    (c = a.install) == null || c.call(a, r);
  return new S({
    server: e,
    peers: t,
    reconnectManager: s,
    plugins: i
  });
}
function N(o) {
  var r;
  const e = new y(o), t = new R({
    signaling: e,
    username: o.username,
    rtcConfiguration: o.rtcConfiguration,
    rtc: globalThis
  }), s = p(), i = {
    host: null,
    client: {
      server: e,
      peer: t,
      plugins: s
    },
    shared: o.shared ?? {}
  };
  for (const c of o.plugins ?? [])
    (r = c.install) == null || r.call(c, i);
  return new I({
    server: e,
    peer: t,
    plugins: s
  });
}
export {
  N as createClient,
  T as createHost
};
