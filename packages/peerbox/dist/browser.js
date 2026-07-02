import { E as d, S as h, c as l, a as r, p, H as u, b as w, d as f, e as g } from "./pluginRegistry-Dw_gan_d.js";
class C {
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
class m extends d {
  constructor({ url: e, roomId: t, username: s }) {
    super(), this.url = e, this.roomId = t, this.username = s, this.ws = null, this._sendQueue = [];
  }
  start() {
    this.ws && this.ws.readyState === WebSocket.OPEN || this._connect();
  }
  _connect() {
    this.ws = new WebSocket(this.url), this.ws.onopen = () => {
      this.emit("open"), this._flushSendQueue();
    }, this.ws.onmessage = (e) => {
      let t;
      try {
        t = JSON.parse(e.data);
      } catch {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (t.type) {
        case h.SIGNAL:
          this.emit("signal", t.payload);
          break;
        case h.HOST_DISCONNECTED:
          this.emit("host-disconnected");
          break;
        default:
          t.type ? this.emit(t.type, t) : this.emit("unknown-message", t);
      }
    }, this.ws.onclose = () => {
      this.emit("close");
    }, this.ws.onerror = (e) => {
      this.emit("error", e);
    };
  }
  _flushSendQueue() {
    if (!(!this.ws || this.ws.readyState !== WebSocket.OPEN))
      for (; this._sendQueue.length; ) {
        const e = this._sendQueue.shift();
        this.ws.send(e);
      }
  }
  send(e, t = {}) {
    const s = JSON.stringify({ type: e, ...t });
    this.ws && this.ws.readyState === WebSocket.OPEN ? this.ws.send(s) : this._sendQueue.push(s);
  }
  sendSignal(e, t = {}) {
    this.send("signal", {
      payload: { target: e, ...t }
    });
  }
  disconnect() {
    this.ws && (this.send(h.CLIENT_DISCONNECTED, { roomId: this.roomId }), this.ws.close(), this.ws = null);
  }
}
class S extends d {
  constructor({ signaling: e, username: t = "Anonymous", rtcConfiguration: s }) {
    super(), this.signaling = e, this.username = t, this.rtcConfiguration = s, this.pc = null, this.dataChannel = null, this.pendingIceCandidates = [], this._renegotiating = !1, this._pendingRenegotiation = !1, this._setupSignaling();
  }
  _setupSignaling() {
    this.signaling.on("signal", (e) => this._handleSignal(e)), this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    });
  }
  async connect() {
    this.pc = new RTCPeerConnection(this.rtcConfiguration), this.pc.onicecandidate = (e) => {
      e.candidate && this.signaling.sendSignal("host", l(r.ICE_CANDIDATE, { candidate: e.candidate }));
    }, this.pc.ondatachannel = (e) => {
      this.dataChannel = e.channel, this._setupDataChannel();
    }, this.pc.ontrack = (e) => {
      this.emit("track", {
        stream: e.streams[0],
        track: e.track
      });
    };
  }
  _setupDataChannel() {
    this.dataChannel && (this.dataChannel.onopen = () => {
      this.emit("connected");
    }, this.dataChannel.onmessage = (e) => {
      const t = p(e.data);
      if (console.log(t), !t) return;
      const s = t.type || "default";
      console.log(s), this.emit(s, t), t.type === r.HOST_DISCONNECTED && this.emit("host-disconnected");
    }, this.dataChannel.onerror = (e) => {
      this.emit("error", e);
    }, this.dataChannel.onclose = () => {
      this.emit("disconnected");
    });
  }
  async _handleSignal(e) {
    if (console.log("Received signal from host:", e), !this.pc) {
      this.emit("error", new Error("PeerConnection not initialized"));
      return;
    }
    switch (e.type) {
      case r.OFFER:
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(e.sdp));
          for (const s of this.pendingIceCandidates)
            try {
              await this.pc.addIceCandidate(s);
            } catch (i) {
              this.emit("error", i);
            }
          this.pendingIceCandidates = [];
          const t = await this.pc.createAnswer();
          await this.pc.setLocalDescription(t), this.signaling.sendSignal("host", l(r.ANSWER, { sdp: this.pc.localDescription }));
        } catch (t) {
          this.emit("error", t);
        }
        break;
      case r.ICE_CANDIDATE:
        if (e.candidate)
          try {
            const t = new RTCIceCandidate(e.candidate);
            this.pc.remoteDescription ? await this.pc.addIceCandidate(t) : (this.pendingIceCandidates ?? (this.pendingIceCandidates = []), this.pendingIceCandidates.push(t));
          } catch (t) {
            this.emit("error", t);
          }
        break;
      default:
        this.emit("warn", `Unknown signal type from host: ${e.type}`);
    }
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
          l(r.OFFER, {
            sdp: this.pc.localDescription
          })
        );
      } finally {
        this._renegotiating = !1, this._pendingRenegotiation && (this._pendingRenegotiation = !1, this.renegotiate());
      }
    }
  }
}
function _(n) {
  var a;
  const e = new u(n), t = new w({
    hostServer: e,
    rtc: globalThis,
    rtcConfiguration: n.rtcConfiguration
  }), s = new HostReconnectManager({
    peers: t
  }), i = g(), o = {
    host: {
      server: e,
      peers: t,
      reconnectManager: s,
      plugins: i
    },
    client: null,
    shared: n.shared ?? {}
  };
  for (const c of n.plugins)
    (a = c.install) == null || a.call(c, o);
  return new f({
    server: e,
    peers: t,
    reconnectManager: s,
    plugins: i
  });
}
function E(n) {
  var o;
  const e = new m(n), t = new S({
    signaling: e,
    username: n.username,
    rtcConfiguration: n.rtcConfiguration
  }), s = g(), i = {
    host: null,
    client: {
      server: e,
      peer: t,
      plugins: s
    },
    shared: n.shared ?? {}
  };
  for (const a of n.plugins)
    (o = a.install) == null || o.call(a, i);
  return new C({
    server: e,
    peer: t,
    plugins: s
  });
}
export {
  E as createClient,
  _ as createHost
};
