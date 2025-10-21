"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const wrtc = require("wrtc");
const EventEmitter = require("events");
const WebSocket = require("ws");
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
class HostPeerManager extends EventEmitter {
  constructor({ hostServer }) {
    super();
    this.hostServer = hostServer;
    this.peerConnections = /* @__PURE__ */ new Map();
    this.dataChannels = /* @__PURE__ */ new Map();
    this.iceCandidateBuffers = /* @__PURE__ */ new Map();
    this.reconnecting = /* @__PURE__ */ new Set();
    this.hostServer.on("new-peer", (clientId) => this._handleNewPeer(clientId));
    this.hostServer.on("peer-left", (clientId) => this._removePeer(clientId));
    this.hostServer.on("signal", (from, payload) => this._handleSignal(from, payload));
  }
  async _handleNewPeer(clientId) {
    if (this.reconnecting.has(clientId)) {
      return;
    }
    const pc = new wrtc.RTCPeerConnection(configuration);
    this.peerConnections.set(clientId, pc);
    this.iceCandidateBuffers.set(clientId, []);
    const dc = pc.createDataChannel("data");
    this.dataChannels.set(clientId, dc);
    dc.onopen = () => {
      this.emit("peer-connected", clientId);
    };
    dc.onclose = () => {
      this._removePeer(clientId);
    };
    dc.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        this.emit("error", new Error("Invalid JSON from peer"), clientId);
        return;
      }
      if (!msg) return;
      const type = msg.type || "default";
      this.emit(type, { clientId, ...msg });
    };
    dc.onerror = (err) => this.emit("error", err, clientId);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.hostServer.sendSignal(clientId, {
          type: "ice-candidate",
          candidate: ev.candidate
        });
      }
    };
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.hostServer.sendSignal(clientId, {
        type: "offer",
        sdp: pc.localDescription
      });
    } catch (err) {
      this.emit("error", err, clientId);
    }
  }
  _handleSignal(clientId, data) {
    const pc = this.peerConnections.get(clientId);
    if (!pc) return;
    if (data.type === "answer") {
      pc.setRemoteDescription(new wrtc.RTCSessionDescription(data.sdp)).then(() => {
        const buffer = this.iceCandidateBuffers.get(clientId) || [];
        buffer.forEach((c) => pc.addIceCandidate(c).catch(console.error));
        this.iceCandidateBuffers.set(clientId, []);
      }).catch((err) => this.emit("error", err, clientId));
    } else if (data.type === "ice-candidate") {
      if (data.candidate && data.candidate.candidate) {
        const candidate = new wrtc.RTCIceCandidate(data.candidate);
        if (pc.remoteDescription) {
          pc.addIceCandidate(candidate).catch((err) => this.emit("error", err, clientId));
        } else {
          this.iceCandidateBuffers.get(clientId).push(candidate);
        }
      }
    }
  }
  _removePeer(clientId, { emit = true, reconnecting = false } = {}) {
    const pc = this.peerConnections.get(clientId);
    if (pc && !reconnecting) {
      try {
        pc.close();
      } catch {
      }
      this.peerConnections.delete(clientId);
    }
    this.dataChannels.delete(clientId);
    this.iceCandidateBuffers.delete(clientId);
    if (emit) {
      this.emit("peer-disconnected", clientId);
    }
  }
  send(clientId, obj) {
    const dc = this.dataChannels.get(clientId);
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(obj));
    }
  }
  broadcast(obj, { exclude } = {}) {
    for (const [id, dc] of this.dataChannels.entries()) {
      if (id === exclude) continue;
      if (dc.readyState === "open") {
        dc.send(JSON.stringify(obj));
      }
    }
  }
  async tryReconnect(clientId) {
    if (this.reconnecting.has(clientId)) return false;
    this.reconnecting.add(clientId);
    this.dataChannels.delete(clientId);
    this.iceCandidateBuffers.set(clientId, []);
    try {
      const pc = new wrtc.RTCPeerConnection(configuration);
      this.peerConnections.set(clientId, pc);
      this.iceCandidateBuffers.set(clientId, []);
      const dc = pc.createDataChannel("data");
      this.dataChannels.set(clientId, dc);
      dc.onclose = () => this._removePeer(clientId, { emit: false });
      dc.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg) this.emit(msg.type || "default", { clientId, ...msg });
        } catch (e) {
          this.emit("error", new Error("Invalid JSON from peer"), clientId);
        }
      };
      dc.onerror = (err) => this.emit("error", err, clientId);
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          this.hostServer.sendSignal(clientId, { type: "ice-candidate", candidate: ev.candidate });
        }
      };
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
      } catch (err) {
        this.emit("error", err, clientId);
        this.reconnecting.delete(clientId);
        return false;
      }
      this.hostServer.sendSignal(clientId, { type: "offer", sdp: pc.localDescription });
      const ok = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try {
            pc.close();
          } catch {
          }
          this._removePeer(clientId, { emit: false });
          resolve(false);
        }, 5e3);
        dc.addEventListener("open", () => {
          clearTimeout(timeout);
          this.emit("peer-connected", clientId);
          resolve(true);
        }, { once: true });
      });
      this.reconnecting.delete(clientId);
      return ok;
    } catch (err) {
      this.emit("error", err, clientId);
      this._removePeer(clientId, { emit: false });
      this.reconnecting.delete(clientId);
      return false;
    }
  }
}
const SERVER_MSG_TYPES = {
  SIGNAL: "signal",
  NEW_PEER: "new-peer",
  PEER_LEFT: "peer-left"
};
class HostServer extends EventEmitter {
  constructor({ url } = {}) {
    super();
    this.url = url;
    this.ws = null;
    this._sendQueue = [];
    this._reconnectTimer = null;
  }
  start() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this._connect();
  }
  _connect() {
    this.ws = new WebSocket(this.url);
    this.ws.on("open", () => {
      this.emit("open");
      this._flushSendQueue();
    });
    this.ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (data.type) {
        case SERVER_MSG_TYPES.NEW_PEER:
          this.emit("new-peer", data.clientId);
          break;
        case SERVER_MSG_TYPES.PEER_LEFT:
          this.emit("peer-left", data.clientId);
          break;
        case SERVER_MSG_TYPES.SIGNAL:
          this.emit("signal", data.from, data.payload);
          break;
        default:
          if (data.type) {
            this.emit(data.type, data);
          } else {
            this.emit("unknown-message", data);
          }
      }
    });
    this.ws.on("close", (code, reason) => {
      this.emit("close", { code, reason });
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = setTimeout(() => this._connect(), 2e3);
    });
    this.ws.on("error", (err) => {
      this.emit("error", err);
    });
  }
  _flushSendQueue() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this._sendQueue.length) {
      const msg = this._sendQueue.shift();
      this.ws.send(msg);
    }
  }
  send(type, payload = {}) {
    const envelope = JSON.stringify({ type, ...payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(envelope);
    } else {
      this._sendQueue.push(envelope);
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this._connect();
      }
    }
  }
  sendSignal(targetClientId, payload) {
    this.send("signal", {
      payload: { target: targetClientId, ...payload }
    });
  }
  getRoomID() {
    return this.roomID;
  }
  getHostID() {
    return this.hostID;
  }
  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    clearTimeout(this._reconnectTimer);
    this._sendQueue = [];
  }
}
class HostReconnectManager {
  constructor(host) {
    this.host = host;
    this.retryDelays = [1e3, 2e3, 5e3];
    this.retryTimers = /* @__PURE__ */ new Map();
    this.reconnectingPeers = /* @__PURE__ */ new Set();
    this.callbacks = {
      onAttempt: () => {
      },
      onSuccess: () => {
      },
      onFail: () => {
      }
    };
  }
  configure({ onAttempt, onSuccess, onFail }) {
    if (onAttempt) this.callbacks.onAttempt = onAttempt;
    if (onSuccess) this.callbacks.onSuccess = onSuccess;
    if (onFail) this.callbacks.onFail = onFail;
  }
  handleDisconnect(clientId) {
    if (this.reconnectingPeers.has(clientId)) return;
    this.reconnectingPeers.add(clientId);
    const maxAttempts = 5;
    let attempt = 0;
    const retry = async () => {
      var _a, _b, _c, _d, _e, _f;
      (_b = (_a = this.callbacks).onAttempt) == null ? void 0 : _b.call(_a, clientId, attempt);
      const ok = await this.host.peers.tryReconnect(clientId).catch((e) => {
        console.warn("tryReconnect error", e);
        return false;
      });
      if (ok) {
        (_d = (_c = this.callbacks).onSuccess) == null ? void 0 : _d.call(_c, clientId);
        this.reconnectingPeers.delete(clientId);
        return;
      }
      attempt++;
      if (attempt > maxAttempts) {
        (_f = (_e = this.callbacks).onFail) == null ? void 0 : _f.call(_e, clientId);
        this.reconnectingPeers.delete(clientId);
        return;
      }
      const delay = Math.min(5e3, 1e3 * Math.pow(2, attempt));
      setTimeout(retry, delay);
    };
    setTimeout(retry, 200);
  }
}
class Host {
  constructor(config) {
    this.server = new HostServer(config);
    this.peers = new HostPeerManager({ hostServer: this.server });
    this.listeners = {};
    this.reconnectManager = new HostReconnectManager(this);
    this.peers.on("ping", ({ clientId, id }) => {
      this.send(clientId, { type: "pong", id });
    });
    this.peers.on("peer-disconnected", (clientId) => {
      this.reconnectManager.handleDisconnect(clientId);
    });
  }
  on(event, callback) {
    this.peers.on(event, callback);
  }
  onPeerConnected(callback) {
    this.peers.on("peer-connected", callback);
  }
  onPeerDisconnected(callback) {
    this.peers.on("peer-disconnected", callback);
  }
  broadcast(msg, { exclude } = {}) {
    this.peers.broadcast(msg, { exclude });
  }
  send(clientId, msg) {
    this.peers.send(clientId, msg);
  }
  start() {
    this.server.start();
  }
}
exports.Host = Host;
