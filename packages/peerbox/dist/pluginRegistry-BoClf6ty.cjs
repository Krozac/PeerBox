"use strict";
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
    });
    this.reconnectManager.on("disconnected", (clientId) => {
      this.peers.destroyPeer(clientId);
    });
    this.server.on("new-peer", (id) => {
      this.peers.addPeer(id);
    });
    this.server.on("peer-reconnected", (id) => {
      this.peers.reconnectPeer(id);
    });
    this.server.on("peer-transport-lost", (id) => {
      this.peers.emit("peer-transport-lost", id);
    });
    this.server.on("signal", (from, payload) => {
      this.peers.handleSignal(from, payload);
    });
    this.server.on("peer-left", (id) => {
      this.reconnectManager.peerLeft(id);
      this.peers.destroyPeer(id);
    });
    this.server.on("host-resumed", async ({ pendingPeers = [] }) => {
      for (const peer of pendingPeers) {
        if (peer.type === "peer-left") {
          this.reconnectManager.peerLeft(peer.userId);
          this.peers.destroyPeer(peer.userId);
        } else if (peer.type === "peer-disconnected") {
          this.peers.emit("peer-transport-lost", peer.userId);
        } else if (peer.type === "peer-reconnected") {
          await this.peers.reconnectPeer(peer.userId);
        } else if (peer.type === "new-peer") {
          await this.peers.addPeer(peer.userId);
        }
      }
      this.peers.emit("host-signaling-restored");
    });
    this.server.on("room-closed", (message) => {
      this._closePeers();
      this.peers.emit("room-closed", message);
    });
    this.server.on("host-resume-rejected", (message) => {
      this._closePeers();
      this.peers.emit("room-closed", { ...message, reason: "host-resume-rejected" });
    });
  }
  _closePeers() {
    this.reconnectManager.reset();
    this.peers.closeAll();
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
  stop(options) {
    this.server.stop(options);
    this._closePeers();
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
const OPEN = 1;
const CONNECTING = 0;
function listen(ws, type, handler) {
  if (typeof ws.addEventListener === "function") {
    ws.addEventListener(type, handler);
  } else {
    ws.on(type, handler);
  }
}
function messageData(eventOrData) {
  return eventOrData && typeof eventOrData === "object" && "data" in eventOrData ? eventOrData.data : eventOrData;
}
class HostServer extends EventEmitter {
  constructor({ url, WebSocketImpl = globalThis.WebSocket, reconnectDelay = 2e3 } = {}) {
    super();
    if (!url) throw new TypeError("HostServer requires a signaling url");
    if (!WebSocketImpl) throw new TypeError("No WebSocket implementation is available");
    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.reconnectDelay = reconnectDelay;
    this.ws = null;
    this._sendQueue = [];
    this._reconnectTimer = null;
    this._stopped = true;
    this._roomActive = false;
    this._intentionalStop = false;
    this.roomId = null;
    this.hostId = null;
    this.hostToken = null;
  }
  start() {
    var _a, _b;
    this._stopped = false;
    this._intentionalStop = false;
    if (((_a = this.ws) == null ? void 0 : _a.readyState) === OPEN || ((_b = this.ws) == null ? void 0 : _b.readyState) === CONNECTING) return;
    this._connect();
  }
  _connect() {
    var _a, _b;
    if (this._stopped) return;
    if (((_a = this.ws) == null ? void 0 : _a.readyState) === OPEN || ((_b = this.ws) == null ? void 0 : _b.readyState) === CONNECTING) return;
    clearTimeout(this._reconnectTimer);
    const ws = new this.WebSocketImpl(this.url);
    this.ws = ws;
    listen(ws, "open", () => {
      if (this.ws !== ws) return;
      this.emit("open");
      if (this.roomId && this.hostToken) {
        this._sendRaw({ type: "host-resume", roomId: this.roomId, hostId: this.hostId, hostToken: this.hostToken });
      } else {
        this._flushSendQueue();
      }
    });
    listen(ws, "message", (eventOrData) => {
      if (this.ws !== ws) return;
      let data;
      try {
        const raw = messageData(eventOrData);
        data = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (data.type) {
        case SERVER_MSG_TYPES.ROOM_CREATED:
          this.roomId = data.roomId;
          this.hostId = data.hostId ?? data.userId;
          this.hostToken = data.hostToken;
          this._roomActive = true;
          this.emit("room-created", data);
          this._flushSendQueue();
          break;
        case SERVER_MSG_TYPES.HOST_RESUMED:
          this._roomActive = true;
          this.emit("host-resumed", data);
          this._flushSendQueue();
          break;
        case SERVER_MSG_TYPES.HOST_RESUME_REJECTED:
          this._roomActive = false;
          this.roomId = null;
          this.hostId = null;
          this.hostToken = null;
          this.emit("host-resume-rejected", data);
          break;
        case SERVER_MSG_TYPES.ROOM_CLOSED:
          this._roomActive = false;
          this.roomId = null;
          this.hostId = null;
          this.hostToken = null;
          this.emit("room-closed", data);
          break;
        case SERVER_MSG_TYPES.NEW_PEER:
          this.emit("new-peer", data.userId, data);
          break;
        case SERVER_MSG_TYPES.PEER_LEFT:
          this.emit("peer-left", data.userId, data);
          break;
        case SERVER_MSG_TYPES.PEER_DISCONNECTED:
          this.emit("peer-transport-lost", data.userId, data);
          break;
        case SERVER_MSG_TYPES.PEER_RECONNECTED:
          this.emit("peer-reconnected", data.userId, data);
          break;
        case SERVER_MSG_TYPES.SIGNAL:
          this.emit("signal", data.from, data.payload);
          break;
        default:
          if (data.type) this.emit(data.type, data);
          else this.emit("unknown-message", data);
      }
    });
    listen(ws, "close", (eventOrCode, reason) => {
      if (this.ws !== ws) return;
      this.emit("close", { code: (eventOrCode == null ? void 0 : eventOrCode.code) ?? eventOrCode, reason: (eventOrCode == null ? void 0 : eventOrCode.reason) ?? reason });
      if (this.roomId) {
        this._roomActive = false;
        this.emit("host-signaling-lost", { roomId: this.roomId });
      }
      if (!this._stopped && !this._intentionalStop) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => this._connect(), this.reconnectDelay);
      }
    });
    listen(ws, "error", (err) => {
      if (this.ws === ws) this.emit("error", err);
    });
  }
  _sendRaw(message) {
    var _a;
    if (((_a = this.ws) == null ? void 0 : _a.readyState) !== OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }
  _flushSendQueue() {
    var _a;
    if (!this._roomActive && this.roomId) return;
    while (this._sendQueue.length && ((_a = this.ws) == null ? void 0 : _a.readyState) === OPEN) {
      this.ws.send(this._sendQueue.shift());
    }
  }
  send(type, payload = {}) {
    var _a;
    const message = { type, ...payload };
    if (type === SERVER_MSG_TYPES.SIGNAL && (!this._roomActive || ((_a = this.ws) == null ? void 0 : _a.readyState) !== OPEN)) {
      this.emit("signal-dropped", message);
      return false;
    }
    if (this._sendRaw(message)) return true;
    if (type !== SERVER_MSG_TYPES.SIGNAL) this._sendQueue.push(JSON.stringify(message));
    if (!this._stopped && (!this.ws || this.ws.readyState > OPEN)) this._connect();
    return false;
  }
  sendSignal(targetClientId, payload) {
    return this.send(SERVER_MSG_TYPES.SIGNAL, {
      payload: { target: targetClientId, ...payload }
    });
  }
  getRoomID() {
    return this.roomId;
  }
  getHostID() {
    return this.hostId;
  }
  stop({ permanent = true } = {}) {
    var _a;
    clearTimeout(this._reconnectTimer);
    this._stopped = true;
    this._intentionalStop = permanent;
    if (permanent && this.roomId && ((_a = this.ws) == null ? void 0 : _a.readyState) === OPEN) {
      this._sendRaw({ type: SERVER_MSG_TYPES.HOST_DISCONNECTED, roomId: this.roomId, hostId: this.hostId });
    }
    const ws = this.ws;
    this.ws = null;
    this._roomActive = false;
    this._sendQueue = [];
    if (permanent) {
      this.roomId = null;
      this.hostId = null;
      this.hostToken = null;
    }
    ws == null ? void 0 : ws.close();
  }
}
const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};
class HostPeerManager extends EventEmitter {
  constructor({ hostServer, rtc = globalThis, rtcConfiguration }) {
    super();
    this.hostServer = hostServer;
    this.rtc = rtc;
    this.rtcConfiguration = rtcConfiguration ?? configuration;
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
  addPeer(clientId) {
    return this._createPeer(clientId);
  }
  reconnectPeer(clientId) {
    return this._replacePeer(clientId);
  }
  handleSignal(clientId, payload) {
    return this._handleSignal(clientId, payload);
  }
  closeAll() {
    for (const id of [...this.peerConnections.keys()]) this.destroyPeer(id);
  }
  destroyPeer(clientId, { emit = true } = {}) {
    this._destroyTransport(clientId);
    if (emit) this.emit("peer-disconnected", clientId);
  }
  /*
  ============================================
  PEER CREATION
  ============================================
  */
  async _createPeer(clientId, { reconnecting = false } = {}) {
    if (this.peerConnections.has(clientId)) {
      return;
    }
    const pc = new this.rtc.RTCPeerConnection(
      this.rtcConfiguration
    );
    const dc = pc.createDataChannel("data");
    pc.__peerboxReconnect = reconnecting;
    pc.__peerboxSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.peerConnections.set(clientId, pc);
    this.dataChannels.set(clientId, dc);
    this.iceCandidateBuffers.set(clientId, []);
    this._attachPeerHandlers(clientId, pc, dc);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.hostServer.sendSignal(clientId, {
        type: "offer",
        reconnect: reconnecting,
        sessionId: pc.__peerboxSessionId,
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
    await this._createPeer(clientId, { reconnecting: true });
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
      this.emit("peer-connected", clientId, { reconnected: Boolean(pc.__peerboxReconnect) });
    };
    dc.onclose = () => {
      if (this.dataChannels.get(clientId) === dc) {
        this.emit("peer-transport-lost", clientId);
      }
    };
    dc.onerror = (err) => {
      this.emit("error", err, clientId);
    };
    dc.onmessage = (ev) => {
      if (this.dataChannels.get(clientId) === dc) this._handleDataMessage(clientId, ev.data);
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.hostServer.sendSignal(clientId, {
        type: "ice-candidate",
        sessionId: pc.__peerboxSessionId,
        candidate: ev.candidate
      });
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "disconnected" || state === "failed" || state === "closed") {
        if (this.peerConnections.get(clientId) !== pc) return;
        this.emit("peer-transport-lost", clientId);
      }
    };
    pc.ontrack = (event) => {
      if (this.peerConnections.get(clientId) !== pc) return;
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
    if (data.sessionId && data.sessionId !== pc.__peerboxSessionId) return;
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
      if (this.peerConnections.get(clientId) !== pc) return;
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
    if (this.peerConnections.get(clientId) !== pc) return;
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
      if (this.peerConnections.get(clientId) !== pc) return;
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.hostServer.sendSignal(clientId, {
        type: "answer",
        sessionId: pc.__peerboxSessionId,
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
    if (this.peerConnections.get(clientId) !== pc) return;
    console.log("Renegotiating with peer", clientId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.hostServer.sendSignal(clientId, {
      type: "offer",
      sessionId: pc.__peerboxSessionId,
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
const PeerStates = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  RECONNECTED: "reconnected",
  FAILED: "failed",
  SYNCED: "synced"
});
class HostReconnectManager extends EventEmitter {
  constructor({ peers }, options = {}) {
    super();
    this.peers = peers;
    this.gracePeriod = options.gracePeriod ?? 12e4;
    this.peerStates = /* @__PURE__ */ new Map();
    this.disconnectTimers = /* @__PURE__ */ new Map();
    this._bindEvents();
  }
  _bindEvents() {
    this.peers.on("peer-transport-lost", (clientId) => {
      this._beginReconnect(clientId);
    });
    this.peers.on("peer-connected", (clientId) => {
      this._markConnected(clientId);
    });
  }
  getState(clientId) {
    return this.peerStates.get(clientId) || PeerStates.DISCONNECTED;
  }
  isConnected(clientId) {
    const state = this.getState(clientId);
    return state === PeerStates.CONNECTED || state === PeerStates.RECONNECTED || state === PeerStates.SYNCED;
  }
  _setState(clientId, state) {
    const previous = this.peerStates.get(clientId);
    if (previous === state) return;
    this.peerStates.set(clientId, state);
    this.emit("state-change", { clientId, current: state, previous });
  }
  _beginReconnect(clientId) {
    const current = this.getState(clientId);
    if (current === PeerStates.RECONNECTING) return;
    this._setState(clientId, PeerStates.RECONNECTING);
    this.emit("reconnecting", clientId);
    this._clearDisconnectTimer(clientId);
    const timeout = setTimeout(() => {
      var _a, _b;
      const state = this.getState(clientId);
      if (state !== PeerStates.RECONNECTING) {
        return;
      }
      this._setState(clientId, PeerStates.FAILED);
      this.emit("failed", clientId);
      (_b = (_a = this.peers).destroyPeer) == null ? void 0 : _b.call(_a, clientId, { emit: false });
      this._setState(clientId, PeerStates.DISCONNECTED);
      console.log(`Peer ${clientId} failed to reconnect within grace period, disconnecting.`);
      this.emit("disconnected", clientId);
    }, this.gracePeriod);
    this.disconnectTimers.set(clientId, timeout);
  }
  _markConnected(clientId) {
    this._clearDisconnectTimer(clientId);
    const previous = this.getState(clientId);
    if (previous === PeerStates.RECONNECTING) {
      this._setState(clientId, PeerStates.RECONNECTED);
      this.emit("reconnected", clientId);
    } else {
      this._setState(clientId, PeerStates.CONNECTED);
      this.emit("connected", clientId);
    }
  }
  peerLeft(clientId) {
    this._clearDisconnectTimer(clientId);
    this.peerStates.delete(clientId);
  }
  reset() {
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    this.peerStates.clear();
  }
  _markSynced(clientId) {
    this._setState(clientId, PeerStates.SYNCED);
    this.emit("synced", clientId);
  }
  _clearDisconnectTimer(clientId) {
    const timeout = this.disconnectTimers.get(clientId);
    if (timeout !== void 0) {
      clearTimeout(timeout);
      this.disconnectTimers.delete(clientId);
    }
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
exports.HostReconnectManager = HostReconnectManager;
exports.HostServer = HostServer;
exports.SERVER_MSG_TYPES = SERVER_MSG_TYPES;
exports.SIGNAL_TYPES = SIGNAL_TYPES;
exports.createPluginRegistry = createPluginRegistry;
exports.createSignal = createSignal;
exports.parseJSON = parseJSON;
