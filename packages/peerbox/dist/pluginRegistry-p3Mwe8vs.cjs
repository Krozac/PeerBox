"use strict";
const WebSocket = require("ws");
class Host {
  constructor({ server, peers, reconnectManager, plugins }) {
    this.server = server;
    this.peers = peers;
    this.reconnectManager = reconnectManager;
    this.plugins = plugins;
    this._wire();
  }
  _wire() {
    this.peers.on("ping", ({ clientId, id }) => {
      this.send(clientId, { type: "pong", id });
    });
    this.peers.on("peer-transport-lost", (clientId) => {
      console.log(`Peer ${clientId} transport lost, starting reconnection process...`);
      this.reconnectManager._beginReconnect(clientId);
    });
    this.peers.on("peer-reconnected", (clientId) => {
      console.log(`Peer ${clientId} reconnected, marking as reconnected.`);
      this.reconnectManager._markReconnected(clientId);
    });
    this.reconnectManager.on("disconnected", (clientId) => {
      this.peers.destroyPeer(clientId);
      this.peers.emit("peer-disconnected", clientId);
    });
    this.server.on("new-peer", (id) => {
      this.peers._createPeer(id);
    });
    this.server.on("peer-reconnected", (id) => {
      this.peers._replacePeer(id);
    });
    this.server.on("signal", (from, payload) => {
      this.peers._handleSignal(from, payload);
    });
    this.server.on("peer-left", (id) => {
      this.peers.destroyPeer(id);
    });
  }
  on(event, cb) {
    this.peers.on(event, cb);
  }
  broadcast(msg, opts) {
    this.peers.broadcast(msg, opts);
  }
  send(clientId, msg) {
    this.peers.send(clientId, msg);
  }
  start() {
    this.server.start();
  }
}
class EventEmitter {
  constructor() {
    this.events = /* @__PURE__ */ new Map();
  }
  on(event, fn) {
    if (!this.events.has(event)) {
      this.events.set(event, /* @__PURE__ */ new Set());
    }
    this.events.get(event).add(fn);
    return this;
  }
  off(event, fn) {
    var _a;
    (_a = this.events.get(event)) == null ? void 0 : _a.delete(fn);
  }
  emit(event, ...args) {
    var _a;
    (_a = this.events.get(event)) == null ? void 0 : _a.forEach((fn) => fn(...args));
  }
}
const SIGNAL_TYPES = {
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  HOST_DISCONNECTED: "host-disconnected"
};
const SERVER_MSG_TYPES = {
  SIGNAL: "signal",
  CLIENT_DISCONNECTED: "client-disconnected",
  NEW_PEER: "new-peer",
  PEER_LEFT: "peer-left",
  PEER_DISCONNECTED: "peer-disconnected",
  PEER_RECONNECTED: "peer-reconnected"
};
function createSignal(type, payload = {}) {
  return { type, ...payload };
}
function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Invalid signal JSON:", raw);
    return null;
  }
}
class HostServer extends EventEmitter {
  constructor({ url, WebSocketImpl = globalThis.WebSocket } = {}) {
    super();
    this.url = url;
    this.ws = new WebSocketImpl(this.url);
    this._sendQueue = [];
    this._reconnectTimer = null;
  }
  start() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this._connect();
  }
  _connect() {
    this.ws.on("open", () => {
      this.emit("open");
      this._flushSendQueue();
    });
    this.ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
        console.log("Received message from signaling server:", data);
      } catch (err) {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (data.type) {
        case SERVER_MSG_TYPES.NEW_PEER:
          this.emit("new-peer", data.userId);
          break;
        case SERVER_MSG_TYPES.PEER_LEFT:
          this.emit("peer-intentional-leave", data.userId);
          break;
        case SERVER_MSG_TYPES.PEER_DISCONNECTED:
          this.emit("peer-transport-lost", data.userId);
          break;
        case SERVER_MSG_TYPES.PEER_RECONNECTED:
          this.emit("peer-reconnected", data.userId);
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
class HostPeerManager extends EventEmitter {
  constructor({ hostServer, rtc = globalThis, rtcConfiguration }) {
    super();
    this.hostServer = hostServer;
    this.rtc = rtc;
    this.rtcConfiguration = rtcConfiguration;
    this.peerConnections = /* @__PURE__ */ new Map();
    this.dataChannels = /* @__PURE__ */ new Map();
    this.iceCandidateBuffers = /* @__PURE__ */ new Map();
    this.reconnecting = /* @__PURE__ */ new Set();
    this.pendingRenegotiation = /* @__PURE__ */ new Map();
  }
  /*
  ============================================
  PUBLIC
  ============================================
  */
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
  destroyPeer(clientId) {
    this._destroyTransport(clientId);
    this.emit("peer-disconnected", clientId);
  }
  async _replacePeer(clientId) {
    console.log(`Replacing peer ${clientId}`);
    this._destroyTransport(clientId);
    await this._createPeer(clientId);
  }
  /*
  ============================================
  PEER CREATION
  ============================================
  */
  async _createPeer(clientId) {
    if (this.peerConnections.has(clientId)) {
      return;
    }
    const pc = new this.rtc.RTCPeerConnection(
      this.rtcConfiguration
    );
    const dc = pc.createDataChannel("data");
    this.peerConnections.set(clientId, pc);
    this.dataChannels.set(clientId, dc);
    this.iceCandidateBuffers.set(clientId, []);
    this._attachPeerHandlers(clientId, pc, dc);
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
  async _replacePeer(clientId) {
    console.log(`Replacing peer ${clientId}`);
    const oldPc = this.peerConnections.get(clientId);
    if (oldPc) {
      try {
        oldPc.close();
      } catch {
      }
    }
    this._destroyTransport(clientId);
    await this._createPeer(clientId);
    this.emit("peer-reconnected", clientId);
  }
  /*
  ============================================
  TRANSPORT
  ============================================
  */
  _destroyTransport(clientId) {
    const pc = this.peerConnections.get(clientId);
    if (pc) {
      try {
        pc.close();
      } catch {
      }
    }
    this.peerConnections.delete(clientId);
    this.dataChannels.delete(clientId);
    this.iceCandidateBuffers.delete(clientId);
  }
  /*
  ============================================
  HANDLERS
  ============================================
  */
  _attachPeerHandlers(clientId, pc, dc) {
    dc.onopen = () => {
      this.emit("peer-connected", clientId);
    };
    dc.onclose = () => {
      this.emit("peer-transport-lost", clientId);
    };
    dc.onerror = (err) => {
      this.emit("error", err, clientId);
    };
    dc.onmessage = (ev) => {
      this._handleDataMessage(clientId, ev.data);
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.hostServer.sendSignal(clientId, {
        type: "ice-candidate",
        candidate: ev.candidate
      });
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "disconnected" || state === "failed" || state === "closed") {
        this.emit("peer-transport-lost", clientId);
      }
    };
    pc.ontrack = (event) => {
      this.emit("track", {
        clientId,
        stream: event.streams[0],
        track: event.track
      });
    };
  }
  _handleDataMessage(clientId, data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (err) {
      this.emit("error", new Error("Invalid JSON from peer"), clientId);
      return;
    }
    if (!msg) return;
    const type = msg.type || "default";
    console.log("RAW MESSAGE:", msg);
    this.emit(type, { clientId, ...msg });
  }
  /*
  ============================================
  SIGNALING
  ============================================
  */
  _handleSignal(clientId, data) {
    const pc = this.peerConnections.get(clientId);
    if (!pc) return;
    if (data.type === "answer") {
      this._handleAnswer(clientId, pc, data);
    } else if (data.type === "ice-candidate") {
      this._handleIceCandidate(clientId, pc, data);
    } else if (data.type === "offer") {
      this._handleOffer(clientId, pc, data);
    }
  }
  async _handleAnswer(clientId, pc, data) {
    try {
      await pc.setRemoteDescription(
        new this.rtc.RTCSessionDescription(data.sdp)
      );
      const buffer = this.iceCandidateBuffers.get(clientId) || [];
      for (const candidate of buffer) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          this.emit("error", err, clientId);
        }
      }
      this.iceCandidateBuffers.set(clientId, []);
      await this._flushNegotiation(clientId, pc);
    } catch (err) {
      this.emit("error", err, clientId);
    }
  }
  async _handleIceCandidate(clientId, pc, data) {
    var _a, _b;
    if (!((_a = data.candidate) == null ? void 0 : _a.candidate)) {
      return;
    }
    const candidate = new this.rtc.RTCIceCandidate(data.candidate);
    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        this.emit("error", err, clientId);
      }
    } else {
      (_b = this.iceCandidateBuffers.get(clientId)) == null ? void 0 : _b.push(candidate);
    }
  }
  async _handleOffer(clientId, pc, data) {
    try {
      await pc.setRemoteDescription(
        new this.rtc.RTCSessionDescription(data.sdp)
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.hostServer.sendSignal(clientId, {
        type: "answer",
        sdp: pc.localDescription
      });
      await this._flushNegotiation(clientId, pc);
    } catch (err) {
      this.emit("error", err, clientId);
      return;
    }
  }
  async _renegotiate(pc, clientId) {
    if (pc.signalingState !== "stable") {
      console.log("Deferring renegotiation for", clientId);
      this.pendingRenegotiation.set(clientId, true);
      return;
    }
    await this._doRenegotiate(pc, clientId);
  }
  async _doRenegotiate(pc, clientId) {
    console.log("Renegotiating with peer", clientId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.hostServer.sendSignal(clientId, {
      type: "offer",
      sdp: pc.localDescription
    });
  }
  async _flushNegotiation(clientId, pc) {
    if (!this.pendingRenegotiation.get(clientId)) return;
    if (pc.signalingState !== "stable") return;
    console.log("Flushing pending renegotiation for", clientId);
    this.pendingRenegotiation.delete(clientId);
    await this._doRenegotiate(pc, clientId);
  }
  //Media tracks handling
  addTrackToAll(stream, excludeId) {
    for (const [id, pc] of this.peerConnections.entries()) {
      if (id === excludeId) continue;
      for (const track of stream.getTracks()) {
        console.log(`Adding track ${track.kind} to peer ${id}`);
        pc.addTrack(track, stream);
      }
      this._renegotiate(pc, id);
    }
  }
  addTrackToPeer(stream, clientId) {
    const pc = this.peerConnections.get(clientId);
    if (!pc) return;
    for (const track of stream.getTracks()) {
      console.log(`Adding track ${track.kind} to peer ${clientId}`);
      pc.addTrack(track, stream);
    }
    this._renegotiate(pc, clientId);
  }
}
function createPluginRegistry() {
  const plugins = /* @__PURE__ */ new Map();
  return {
    registerPlugin(plugin) {
      if (plugins.has(plugin.name)) {
        throw new Error(`Plugin with name ${plugin.name} is already registered.`);
      }
      plugins.set(plugin.name, plugin);
    },
    getPlugin(name) {
      return plugins.get(name);
    },
    getAllPlugins() {
      return Array.from(plugins.values());
    }
  };
}
exports.EventEmitter = EventEmitter;
exports.Host = Host;
exports.HostPeerManager = HostPeerManager;
exports.HostServer = HostServer;
exports.SERVER_MSG_TYPES = SERVER_MSG_TYPES;
exports.SIGNAL_TYPES = SIGNAL_TYPES;
exports.createPluginRegistry = createPluginRegistry;
exports.createSignal = createSignal;
exports.parseJSON = parseJSON;
