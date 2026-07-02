import { g as d, H as p, W as E, b as R, d as w, e as S } from "./pluginRegistry-Dw_gan_d.js";
function g(i, e) {
  for (var t = 0; t < e.length; t++) {
    const s = e[t];
    if (typeof s != "string" && !Array.isArray(s)) {
      for (const o in s)
        if (o !== "default" && !(o in i)) {
          const a = Object.getOwnPropertyDescriptor(s, o);
          a && Object.defineProperty(i, o, a.get ? a : {
            enumerable: !0,
            get: () => s[o]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(i, Symbol.toStringTag, { value: "Module" }));
}
const m = {}, n = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  RECONNECTED: "reconnected",
  FAILED: "failed",
  SYNCED: "synced"
});
class u extends m {
  constructor(e, t = {}) {
    super(), this.host = e, this.gracePeriod = t.gracePeriod || 12e4, this.peerStates = /* @__PURE__ */ new Map(), this.disconnectTimers = /* @__PURE__ */ new Map(), this._bindEvents();
  }
  _bindEvents() {
    this.host.peers.on("peer-transport-lost", (e) => {
      this._beginReconnect(e);
    }), this.host.peers.on("peer-connected", (e) => {
      this._markConnected(e);
    }), this.host.peers.on("peer-reconnected", (e) => {
      this._markReconnected(e);
    });
  }
  getState(e) {
    return this.peerStates.get(e) || n.DISCONNECTED;
  }
  isConnected(e) {
    const t = this.getState(e);
    return t === n.CONNECTED || t === n.RECONNECTED || t === n.SYNCED;
  }
  _setState(e, t) {
    const s = this.peerStates.get(e);
    s !== t && (this.peerStates.set(e, t), this.emit("state-change", { clientId: e, current: t, previous: s }));
  }
  _beginReconnect(e) {
    if (this.getState(e) === n.RECONNECTING) return;
    this._setState(e, n.RECONNECTING), this.emit("reconnecting", e), this._clearDisconnectTimer(e);
    const s = setTimeout(() => {
      var a, c;
      this.getState(e) === n.RECONNECTING && (this._setState(e, n.FAILED), this.emit("failed", e), (c = (a = this.host.peers).destroyPeer) == null || c.call(a, e), this._setState(e, n.DISCONNECTED), console.log(`Peer ${e} failed to reconnect within grace period, disconnecting.`), this.emit("disconnected", e));
    }, this.gracePeriod);
    this.disconnectTimers.set(e, s);
  }
  _markConnected(e) {
    this._clearDisconnectTimer(e), this.getState(e) === n.RECONNECTING ? (this._setState(e, n.RECONNECTED), this.emit("reconnected", e)) : (this._setState(e, n.CONNECTED), this.emit("connected", e));
  }
  _markReconnected(e) {
    this._clearDisconnectTimer(e), this._setState(e, n.RECONNECTED), this.emit("reconnected", e);
  }
  _markSynced(e) {
    this._setState(e, n.SYNCED), this.emit("synced", e);
  }
  _clearDisconnectTimer(e) {
    const t = this.disconnectTimers.get(e);
    t && (clearTimeout(t), this.disconnectTimers.delete(e));
  }
}
var r = {}, T;
function N() {
  return T || (T = 1, r.MediaStream = window.MediaStream, r.MediaStreamTrack = window.MediaStreamTrack, r.RTCDataChannel = window.RTCDataChannel, r.RTCDataChannelEvent = window.RTCDataChannelEvent, r.RTCDtlsTransport = window.RTCDtlsTransport, r.RTCIceCandidate = window.RTCIceCandidate, r.RTCIceTransport = window.RTCIceTransport, r.RTCPeerConnection = window.RTCPeerConnection, r.RTCPeerConnectionIceEvent = window.RTCPeerConnectionIceEvent, r.RTCRtpReceiver = window.RTCRtpReceiver, r.RTCRtpSender = window.RTCRtpSender, r.RTCRtpTransceiver = window.RTCRtpTransceiver, r.RTCSctpTransport = window.RTCSctpTransport, r.RTCSessionDescription = window.RTCSessionDescription, r.getUserMedia = window.getUserMedia, r.mediaDevices = navigator.mediaDevices), r;
}
var h = N();
const D = /* @__PURE__ */ d(h), f = /* @__PURE__ */ g({
  __proto__: null,
  default: D
}, [h]);
function v(i) {
  var c;
  const e = new p({
    ...i,
    WebSocketImpl: E
  }), t = new R({
    hostServer: e,
    rtc: f
  }), s = new u({
    peers: t
  }), o = S(), a = {
    host: {
      server: e,
      peers: t,
      reconnectManager: s,
      plugins: o
    },
    client: null,
    shared: i.shared ?? {}
  };
  for (const C of i.plugins)
    (c = C.install) == null || c.call(C, a);
  return new w({
    server: e,
    peers: t,
    reconnectManager: s,
    plugins: o
  });
}
export {
  v as createHost
};
