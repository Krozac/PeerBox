"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const pluginRegistry = require("./pluginRegistry-BoClf6ty.cjs");
class Client {
  constructor({ server, peer, plugins }) {
    this.server = server;
    this.peer = peer;
    this.plugins = plugins;
  }
  async connect() {
    await this.server.start();
    this.peer.connect();
  }
  on(event, callback) {
    this.peer.on(event, callback);
  }
  send(msg) {
    this.peer.send(msg);
  }
  disconnect() {
    var _a, _b, _c, _d;
    (_b = (_a = this.server).disconnect) == null ? void 0 : _b.call(_a);
    (_d = (_c = this.peer).close) == null ? void 0 : _d.call(_c);
  }
}
const OPEN = 1;
const CONNECTING = 0;
class ClientServer extends pluginRegistry.EventEmitter {
  constructor({ url, roomId, username, WebSocketImpl = globalThis.WebSocket, reconnectDelay = 1500 } = {}) {
    super();
    if (!url) throw new TypeError("ClientServer requires a signaling url");
    if (!WebSocketImpl) throw new TypeError("No WebSocket implementation is available");
    this.url = url;
    this.roomId = roomId;
    this.username = username;
    this.WebSocketImpl = WebSocketImpl;
    this.reconnectDelay = reconnectDelay;
    this.ws = null;
    this._started = false;
    this._intentionalClose = false;
    this._reconnectTimer = null;
    this._joinRequest = null;
    this.userId = null;
  }
  start() {
    var _a;
    this._started = true;
    this._intentionalClose = false;
    if (((_a = this.ws) == null ? void 0 : _a.readyState) === OPEN) return Promise.resolve();
    return this._connect();
  }
  _connect() {
    var _a, _b;
    if (!this._started || ((_a = this.ws) == null ? void 0 : _a.readyState) === OPEN || ((_b = this.ws) == null ? void 0 : _b.readyState) === CONNECTING) return this._connecting;
    clearTimeout(this._reconnectTimer);
    const ws = new this.WebSocketImpl(this.url);
    this.ws = ws;
    this._connecting = new Promise((resolve, reject) => {
      let opened = false;
      ws.onopen = () => {
        if (this.ws !== ws) return;
        opened = true;
        if (this._joinRequest) this._sendRaw(this._joinRequest);
        this.emit("open", { reconnected: Boolean(this._joinRequest) });
        resolve();
      };
      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          this.emit("error", new Error("Invalid JSON from signaling server"));
          return;
        }
        if (data.type === pluginRegistry.SERVER_MSG_TYPES.SIGNAL) this.emit("signal", data.payload);
        else if (data.type === pluginRegistry.SERVER_MSG_TYPES.HOST_DISCONNECTED) this.emit("host-disconnected", data);
        else if (data.type === pluginRegistry.SERVER_MSG_TYPES.JOIN_ACCEPTED) {
          this.userId = data.userId;
          this.emit("join-accepted", data);
        } else if (data.type === pluginRegistry.SERVER_MSG_TYPES.ROOM_CLOSED) this.emit("room-closed", data);
        else if (data.type) this.emit(data.type, data);
        else this.emit("unknown-message", data);
      };
      ws.onclose = (event) => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (!opened) reject(new Error("Signaling WebSocket closed before opening"));
        this.emit("close", event);
        if (this._started && !this._intentionalClose) {
          this.emit("reconnecting");
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = setTimeout(() => {
            this._connect().catch((error) => this.emit("error", error));
          }, this.reconnectDelay);
        }
      };
      ws.onerror = (error) => {
        this.emit("error", error);
        if (!opened) reject(error instanceof Error ? error : new Error("Signaling WebSocket failed to open"));
      };
    });
    return this._connecting;
  }
  _sendRaw(message) {
    var _a;
    if (((_a = this.ws) == null ? void 0 : _a.readyState) !== OPEN) return false;
    this.ws.send(typeof message === "string" ? message : JSON.stringify(message));
    return true;
  }
  send(type, payload = {}) {
    const message = { type, ...payload };
    if (type === pluginRegistry.SERVER_MSG_TYPES.JOIN) this._joinRequest = JSON.stringify(message);
    if (this._sendRaw(message)) return true;
    if (!this._started && type !== pluginRegistry.SERVER_MSG_TYPES.JOIN) this.emit("warn", "Signaling socket is not connected");
    return false;
  }
  sendSignal(target, payload = {}) {
    return this.send(pluginRegistry.SERVER_MSG_TYPES.SIGNAL, { payload: { target, ...payload } });
  }
  rejoin() {
    if (!this._joinRequest) return false;
    return this._sendRaw(this._joinRequest);
  }
  disconnect() {
    this._intentionalClose = true;
    this._started = false;
    clearTimeout(this._reconnectTimer);
    if (!this.ws) return;
    if (this.ws.readyState === OPEN && this._joinRequest) {
      this._sendRaw({ type: pluginRegistry.SERVER_MSG_TYPES.CLIENT_DISCONNECTED, roomId: this.roomId });
    }
    this._joinRequest = null;
    this.userId = null;
    const ws = this.ws;
    this.ws = null;
    ws.close();
  }
}
class ClientPeerManager extends pluginRegistry.EventEmitter {
  constructor({ signaling, username = "Anonymous", rtcConfiguration, rtc = globalThis }) {
    super();
    this.signaling = signaling;
    this.username = username;
    this.rtcConfiguration = rtcConfiguration;
    this.rtc = rtc;
    this.pc = null;
    this.dataChannel = null;
    this.pendingIceCandidates = [];
    this.signalSessionId = null;
    this._renegotiating = false;
    this._pendingRenegotiation = false;
    this._recovering = false;
    this._setupSignaling();
  }
  _setupSignaling() {
    this.signaling.on("signal", (payload) => this._handleSignal(payload));
    this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    });
    this.signaling.on("room-closed", (message) => {
      this._recovering = true;
      this.emit("room-closed", message);
    });
  }
  async connect() {
    if (this.pc) return;
    this.pc = new this.rtc.RTCPeerConnection(this.rtcConfiguration ?? {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    const pc = this.pc;
    this.pc.onicecandidate = (event) => {
      if (this.pc === pc && event.candidate) {
        this.signaling.sendSignal("host", pluginRegistry.createSignal(pluginRegistry.SIGNAL_TYPES.ICE_CANDIDATE, {
          candidate: event.candidate,
          sessionId: this.signalSessionId
        }));
      }
    };
    this.pc.ondatachannel = (event) => {
      if (this.pc !== pc) return;
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };
    this.pc.ontrack = (event) => {
      if (this.pc !== pc) return;
      this.emit("track", {
        stream: event.streams[0],
        track: event.track
      });
    };
  }
  _setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.onopen = () => {
      this._recovering = false;
      this.emit("connected");
    };
    this.dataChannel.onmessage = (event) => {
      const msg = pluginRegistry.parseJSON(event.data);
      console.log(msg);
      if (!msg) return;
      const type = msg.type || "default";
      console.log(type);
      this.emit(type, msg);
      if (msg.type === pluginRegistry.SIGNAL_TYPES.HOST_DISCONNECTED) {
        this.emit("host-disconnected");
      }
    };
    this.dataChannel.onerror = (err) => {
      this.emit("error", err);
    };
    this.dataChannel.onclose = () => {
      var _a, _b;
      this.emit("disconnected");
      if (!this._recovering) {
        this._recovering = true;
        (_b = (_a = this.signaling).rejoin) == null ? void 0 : _b.call(_a);
      }
    };
  }
  async _handleSignal(data) {
    console.log("Received signal from host:", data);
    if (!this.pc) {
      this.emit("error", new Error("PeerConnection not initialized"));
      return;
    }
    switch (data.type) {
      case pluginRegistry.SIGNAL_TYPES.OFFER:
        try {
          if (data.reconnect && this.pc) {
            this._closePeerConnection();
            this.pc = null;
            await this.connect();
          }
          if (this.signalSessionId && data.sessionId && this.signalSessionId !== data.sessionId) {
            this.pendingIceCandidates = [];
          }
          this.signalSessionId = data.sessionId ?? null;
          await this.pc.setRemoteDescription(new this.rtc.RTCSessionDescription(data.sdp));
          const candidates = this.pendingIceCandidates.filter(
            (item) => !item.sessionId || !this.signalSessionId || item.sessionId === this.signalSessionId
          );
          for (const { candidate } of candidates) {
            try {
              await this.pc.addIceCandidate(candidate);
            } catch (err) {
              this.emit("error", err);
            }
          }
          this.pendingIceCandidates = [];
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signaling.sendSignal("host", pluginRegistry.createSignal(pluginRegistry.SIGNAL_TYPES.ANSWER, {
            sdp: this.pc.localDescription,
            sessionId: this.signalSessionId
          }));
        } catch (err) {
          this.emit("error", err);
        }
        break;
      case pluginRegistry.SIGNAL_TYPES.ICE_CANDIDATE:
        if (data.candidate) {
          try {
            if (this.signalSessionId && data.sessionId && data.sessionId !== this.signalSessionId) break;
            const candidate = new this.rtc.RTCIceCandidate(data.candidate);
            if (this.pc.remoteDescription) {
              await this.pc.addIceCandidate(candidate);
            } else {
              this.pendingIceCandidates.push({ candidate, sessionId: data.sessionId ?? null });
            }
          } catch (err) {
            this.emit("error", err);
          }
        }
        break;
      default:
        this.emit("warn", `Unknown signal type from host: ${data.type}`);
    }
  }
  _closePeerConnection() {
    if (this.dataChannel) {
      this.dataChannel.onopen = null;
      this.dataChannel.onclose = null;
      this.dataChannel.onmessage = null;
      this.dataChannel.onerror = null;
      try {
        this.dataChannel.close();
      } catch {
      }
    }
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ondatachannel = null;
      this.pc.ontrack = null;
      try {
        this.pc.close();
      } catch {
      }
    }
    this.dataChannel = null;
    this.pendingIceCandidates = [];
    this.signalSessionId = null;
  }
  close() {
    this._closePeerConnection();
    this.pc = null;
  }
  send(message) {
    var _a;
    const envelope = {
      ...message,
      userId: this.signaling.userId,
      connectionId: this.connectionId,
      ts: Date.now()
    };
    if (((_a = this.dataChannel) == null ? void 0 : _a.readyState) === "open") {
      this.dataChannel.send(JSON.stringify(envelope));
    } else {
      this.emit("warn", "Data channel not open");
    }
  }
  async renegotiate() {
    if (!this.pc) return;
    if (this._renegotiating) {
      this._pendingRenegotiation = true;
      return;
    }
    this._renegotiating = true;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log("Renegotiation offer created and set as local description:", offer);
      this.signaling.sendSignal(
        "host",
        pluginRegistry.createSignal(pluginRegistry.SIGNAL_TYPES.OFFER, {
          sdp: this.pc.localDescription,
          sessionId: this.signalSessionId
        })
      );
    } finally {
      this._renegotiating = false;
      if (this._pendingRenegotiation) {
        this._pendingRenegotiation = false;
        this.renegotiate();
      }
    }
  }
}
function createHost(config) {
  var _a;
  const server = new pluginRegistry.HostServer(config);
  const peers = new pluginRegistry.HostPeerManager({
    hostServer: server,
    rtc: globalThis,
    rtcConfiguration: config.rtcConfiguration
  });
  const reconnectManager = new pluginRegistry.HostReconnectManager({ peers }, { gracePeriod: config.peerReconnectGracePeriod });
  const pluginRegistry$1 = pluginRegistry.createPluginRegistry();
  const context = {
    host: {
      server,
      peers,
      reconnectManager,
      plugins: pluginRegistry$1
    },
    client: null,
    shared: config.shared ?? {}
  };
  for (const plugin of config.plugins ?? []) {
    (_a = plugin.install) == null ? void 0 : _a.call(plugin, context);
  }
  return new pluginRegistry.Host({
    server,
    peers,
    reconnectManager,
    plugins: pluginRegistry$1
  });
}
function createClient(config) {
  var _a;
  const server = new ClientServer(config);
  const peer = new ClientPeerManager({
    signaling: server,
    username: config.username,
    rtcConfiguration: config.rtcConfiguration,
    rtc: globalThis
  });
  const pluginRegistry$1 = pluginRegistry.createPluginRegistry();
  const context = {
    host: null,
    client: {
      server,
      peer,
      plugins: pluginRegistry$1
    },
    shared: config.shared ?? {}
  };
  for (const plugin of config.plugins ?? []) {
    (_a = plugin.install) == null ? void 0 : _a.call(plugin, context);
  }
  return new Client({
    server,
    peer,
    plugins: pluginRegistry$1
  });
}
exports.createClient = createClient;
exports.createHost = createHost;
