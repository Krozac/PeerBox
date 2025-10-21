const _ = {
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  HOST_DISCONNECTED: "host-disconnected"
}, C = {
  SIGNAL: "signal",
  CLIENT_DISCONNECTED: "client-disconnected"
};
function E(f, t = {}) {
  return { type: f, ...t };
}
function b(f) {
  try {
    return JSON.parse(f);
  } catch {
    return console.warn("Invalid signal JSON:", f), null;
  }
}
function T(f) {
  return f && f.__esModule && Object.prototype.hasOwnProperty.call(f, "default") ? f.default : f;
}
var m = { exports: {} }, N;
function x() {
  return N || (N = 1, (function(f) {
    var t = Object.prototype.hasOwnProperty, e = "~";
    function h() {
    }
    Object.create && (h.prototype = /* @__PURE__ */ Object.create(null), new h().__proto__ || (e = !1));
    function D(o, s, i) {
      this.fn = o, this.context = s, this.once = i || !1;
    }
    function S(o, s, i, r, d) {
      if (typeof i != "function")
        throw new TypeError("The listener must be a function");
      var u = new D(i, r || o, d), a = e ? e + s : s;
      return o._events[a] ? o._events[a].fn ? o._events[a] = [o._events[a], u] : o._events[a].push(u) : (o._events[a] = u, o._eventsCount++), o;
    }
    function y(o, s) {
      --o._eventsCount === 0 ? o._events = new h() : delete o._events[s];
    }
    function l() {
      this._events = new h(), this._eventsCount = 0;
    }
    l.prototype.eventNames = function() {
      var s = [], i, r;
      if (this._eventsCount === 0) return s;
      for (r in i = this._events)
        t.call(i, r) && s.push(e ? r.slice(1) : r);
      return Object.getOwnPropertySymbols ? s.concat(Object.getOwnPropertySymbols(i)) : s;
    }, l.prototype.listeners = function(s) {
      var i = e ? e + s : s, r = this._events[i];
      if (!r) return [];
      if (r.fn) return [r.fn];
      for (var d = 0, u = r.length, a = new Array(u); d < u; d++)
        a[d] = r[d].fn;
      return a;
    }, l.prototype.listenerCount = function(s) {
      var i = e ? e + s : s, r = this._events[i];
      return r ? r.fn ? 1 : r.length : 0;
    }, l.prototype.emit = function(s, i, r, d, u, a) {
      var p = e ? e + s : s;
      if (!this._events[p]) return !1;
      var n = this._events[p], g = arguments.length, v, c;
      if (n.fn) {
        switch (n.once && this.removeListener(s, n.fn, void 0, !0), g) {
          case 1:
            return n.fn.call(n.context), !0;
          case 2:
            return n.fn.call(n.context, i), !0;
          case 3:
            return n.fn.call(n.context, i, r), !0;
          case 4:
            return n.fn.call(n.context, i, r, d), !0;
          case 5:
            return n.fn.call(n.context, i, r, d, u), !0;
          case 6:
            return n.fn.call(n.context, i, r, d, u, a), !0;
        }
        for (c = 1, v = new Array(g - 1); c < g; c++)
          v[c - 1] = arguments[c];
        n.fn.apply(n.context, v);
      } else {
        var I = n.length, w;
        for (c = 0; c < I; c++)
          switch (n[c].once && this.removeListener(s, n[c].fn, void 0, !0), g) {
            case 1:
              n[c].fn.call(n[c].context);
              break;
            case 2:
              n[c].fn.call(n[c].context, i);
              break;
            case 3:
              n[c].fn.call(n[c].context, i, r);
              break;
            case 4:
              n[c].fn.call(n[c].context, i, r, d);
              break;
            default:
              if (!v) for (w = 1, v = new Array(g - 1); w < g; w++)
                v[w - 1] = arguments[w];
              n[c].fn.apply(n[c].context, v);
          }
      }
      return !0;
    }, l.prototype.on = function(s, i, r) {
      return S(this, s, i, r, !1);
    }, l.prototype.once = function(s, i, r) {
      return S(this, s, i, r, !0);
    }, l.prototype.removeListener = function(s, i, r, d) {
      var u = e ? e + s : s;
      if (!this._events[u]) return this;
      if (!i)
        return y(this, u), this;
      var a = this._events[u];
      if (a.fn)
        a.fn === i && (!d || a.once) && (!r || a.context === r) && y(this, u);
      else {
        for (var p = 0, n = [], g = a.length; p < g; p++)
          (a[p].fn !== i || d && !a[p].once || r && a[p].context !== r) && n.push(a[p]);
        n.length ? this._events[u] = n.length === 1 ? n[0] : n : y(this, u);
      }
      return this;
    }, l.prototype.removeAllListeners = function(s) {
      var i;
      return s ? (i = e ? e + s : s, this._events[i] && y(this, i)) : (this._events = new h(), this._eventsCount = 0), this;
    }, l.prototype.off = l.prototype.removeListener, l.prototype.addListener = l.prototype.on, l.prefixed = e, l.EventEmitter = l, f.exports = l;
  })(m)), m.exports;
}
var A = x();
const O = /* @__PURE__ */ T(A), L = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
class k extends O {
  constructor({ signaling: t, username: e = "Anonymous" }) {
    super(), this.signaling = t, this.username = e, this.pc = null, this.dataChannel = null, this._setupSignaling();
  }
  _setupSignaling() {
    this.signaling.on("signal", (t) => this._handleSignal(t)), this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    });
  }
  async connect() {
    this.pc = new RTCPeerConnection(L), this.pc.onicecandidate = (t) => {
      t.candidate && this.signaling.sendSignal("host", E(_.ICE_CANDIDATE, { candidate: t.candidate }));
    }, this.pc.ondatachannel = (t) => {
      this.dataChannel = t.channel, this._setupDataChannel();
    };
  }
  _setupDataChannel() {
    this.dataChannel && (this.dataChannel.onopen = () => {
      this.emit("connected");
    }, this.dataChannel.onmessage = (t) => {
      const e = b(t.data);
      if (console.log(e), !e) return;
      const h = e.type || "default";
      console.log(h), this.emit(h, e), e.type === _.HOST_DISCONNECTED && this.emit("host-disconnected");
    }, this.dataChannel.onerror = (t) => {
      this.emit("error", t);
    }, this.dataChannel.onclose = () => {
      this.emit("disconnected");
    });
  }
  async _handleSignal(t) {
    if (console.log(t.type), !this.pc) {
      this.emit("error", new Error("PeerConnection not initialized"));
      return;
    }
    switch (t.type) {
      case _.OFFER:
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(t.sdp));
          const e = await this.pc.createAnswer();
          await this.pc.setLocalDescription(e), this.signaling.sendSignal("host", E(_.ANSWER, { sdp: this.pc.localDescription }));
        } catch (e) {
          this.emit("error", e);
        }
        break;
      case _.ICE_CANDIDATE:
        if (t.candidate)
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(t.candidate));
          } catch (e) {
            this.emit("error", e);
          }
        break;
      default:
        this.emit("warn", `Unknown signal type from host: ${t.type}`);
    }
  }
  send(t) {
    this.dataChannel && this.dataChannel.readyState === "open" ? this.dataChannel.send(JSON.stringify(t)) : this.emit("warn", "Data channel not open, cannot send");
  }
}
class P extends O {
  constructor({ url: t, roomId: e, username: h }) {
    super(), this.url = t, this.roomId = e, this.username = h, this.ws = null, this._sendQueue = [];
  }
  start() {
    this.ws && this.ws.readyState === WebSocket.OPEN || this._connect();
  }
  _connect() {
    this.ws = new WebSocket(this.url), this.ws.onopen = () => {
      this.emit("open"), this._flushSendQueue();
    }, this.ws.onmessage = (t) => {
      let e;
      try {
        e = JSON.parse(t.data);
      } catch {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (e.type) {
        case C.SIGNAL:
          this.emit("signal", e.payload);
          break;
        case C.HOST_DISCONNECTED:
          this.emit("host-disconnected");
          break;
        default:
          e.type ? this.emit(e.type, e) : this.emit("unknown-message", e);
      }
    }, this.ws.onclose = () => {
      this.emit("close");
    }, this.ws.onerror = (t) => {
      this.emit("error", t);
    };
  }
  _flushSendQueue() {
    if (!(!this.ws || this.ws.readyState !== WebSocket.OPEN))
      for (; this._sendQueue.length; ) {
        const t = this._sendQueue.shift();
        this.ws.send(t);
      }
  }
  send(t, e = {}) {
    const h = JSON.stringify({ type: t, ...e });
    this.ws && this.ws.readyState === WebSocket.OPEN ? this.ws.send(h) : this._sendQueue.push(h);
  }
  sendSignal(t, e = {}) {
    this.send("signal", {
      payload: { target: t, ...e }
    });
  }
  disconnect() {
    this.ws && (this.send(C.CLIENT_DISCONNECTED, { roomId: this.roomId }), this.ws.close(), this.ws = null);
  }
}
class R {
  constructor({ signalingUrl: t, roomId: e, username: h }) {
    this.signaling = new P({ url: t, roomId: e, username: h }), this.peerConnection = new k({
      signaling: this.signaling,
      username: h
    }), this.listeners = {};
  }
  async connect() {
    await this.signaling.start(), this.peerConnection.connect();
  }
  on(t, e) {
    this.peerConnection.on(t, e);
  }
  send(t) {
    console.log(t), this.peerConnection.send(t);
  }
  disconnect() {
    this.signaling.disconnect(), this.peerConnection.close();
  }
}
export {
  R as default
};
