"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const pluginRegistry = require("./pluginRegistry-p3Mwe8vs.cjs");
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
class ClientServer extends pluginRegistry.EventEmitter {
  constructor({ url, roomId, username }) {
    super();
    this.url = url;
    this.roomId = roomId;
    this.username = username;
    this.ws = null;
    this._sendQueue = [];
  }
  start() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this._connect();
  }
  _connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.emit("open");
      this._flushSendQueue();
    };
    this.ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (data.type) {
        case pluginRegistry.SERVER_MSG_TYPES.SIGNAL:
          this.emit("signal", data.payload);
          break;
        case pluginRegistry.SERVER_MSG_TYPES.HOST_DISCONNECTED:
          this.emit("host-disconnected");
          break;
        default:
          if (data.type) {
            this.emit(data.type, data);
          } else {
            this.emit("unknown-message", data);
          }
      }
    };
    this.ws.onclose = () => {
      this.emit("close");
    };
    this.ws.onerror = (err) => {
      this.emit("error", err);
    };
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
    }
  }
  sendSignal(target, payload = {}) {
    this.send("signal", {
      payload: { target, ...payload }
    });
  }
  disconnect() {
    if (this.ws) {
      this.send(pluginRegistry.SERVER_MSG_TYPES.CLIENT_DISCONNECTED, { roomId: this.roomId });
      this.ws.close();
      this.ws = null;
    }
  }
}
class ClientPeerManager extends pluginRegistry.EventEmitter {
  constructor({ signaling, username = "Anonymous", rtcConfiguration }) {
    super();
    this.signaling = signaling;
    this.username = username;
    this.rtcConfiguration = rtcConfiguration;
    this.pc = null;
    this.dataChannel = null;
    this.pendingIceCandidates = [];
    this._renegotiating = false;
    this._pendingRenegotiation = false;
    this._setupSignaling();
  }
  _setupSignaling() {
    this.signaling.on("signal", (payload) => this._handleSignal(payload));
    this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    });
  }
  async connect() {
    this.pc = new RTCPeerConnection(this.rtcConfiguration);
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendSignal("host", pluginRegistry.createSignal(pluginRegistry.SIGNAL_TYPES.ICE_CANDIDATE, { candidate: event.candidate }));
      }
    };
    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };
    this.pc.ontrack = (event) => {
      this.emit("track", {
        stream: event.streams[0],
        track: event.track
      });
    };
  }
  _setupDataChannel() {
    if (!this.dataChannel) return;
    this.dataChannel.onopen = () => {
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
      this.emit("disconnected");
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
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          for (const candidate of this.pendingIceCandidates) {
            try {
              await this.pc.addIceCandidate(candidate);
            } catch (err) {
              this.emit("error", err);
            }
          }
          this.pendingIceCandidates = [];
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signaling.sendSignal("host", pluginRegistry.createSignal(pluginRegistry.SIGNAL_TYPES.ANSWER, { sdp: this.pc.localDescription }));
        } catch (err) {
          this.emit("error", err);
        }
        break;
      case pluginRegistry.SIGNAL_TYPES.ICE_CANDIDATE:
        if (data.candidate) {
          try {
            const candidate = new RTCIceCandidate(data.candidate);
            if (this.pc.remoteDescription) {
              await this.pc.addIceCandidate(candidate);
            } else {
              this.pendingIceCandidates ?? (this.pendingIceCandidates = []);
              this.pendingIceCandidates.push(candidate);
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
          sdp: this.pc.localDescription
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
  const reconnectManager = new HostReconnectManager({
    peers
  });
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
  for (const plugin of config.plugins) {
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
    rtcConfiguration: config.rtcConfiguration
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
  for (const plugin of config.plugins) {
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
