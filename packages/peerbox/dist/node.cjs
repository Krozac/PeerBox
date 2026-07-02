"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const pluginRegistry = require("./pluginRegistry-p3Mwe8vs.cjs");
const EventEmitter = require("events");
const wrtc = require("wrtc");
const WebSocket = require("ws");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const wrtc__namespace = /* @__PURE__ */ _interopNamespaceDefault(wrtc);
const PeerStates = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  RECONNECTED: "reconnected",
  FAILED: "failed",
  SYNCED: "synced"
});
class HostReconnectManager extends EventEmitter {
  constructor(host, options = {}) {
    super();
    this.host = host;
    this.gracePeriod = options.gracePeriod || 12e4;
    this.peerStates = /* @__PURE__ */ new Map();
    this.disconnectTimers = /* @__PURE__ */ new Map();
    this._bindEvents();
  }
  _bindEvents() {
    this.host.peers.on("peer-transport-lost", (clientId) => {
      this._beginReconnect(clientId);
    });
    this.host.peers.on("peer-connected", (clientId) => {
      this._markConnected(clientId);
    });
    this.host.peers.on("peer-reconnected", (clientId) => {
      this._markReconnected(clientId);
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
      (_b = (_a = this.host.peers).destroyPeer) == null ? void 0 : _b.call(_a, clientId);
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
  _markReconnected(clientId) {
    this._clearDisconnectTimer(clientId);
    this._setState(clientId, PeerStates.RECONNECTED);
    this.emit("reconnected", clientId);
  }
  _markSynced(clientId) {
    this._setState(clientId, PeerStates.SYNCED);
    this.emit("synced", clientId);
  }
  _clearDisconnectTimer(clientId) {
    const timeout = this.disconnectTimers.get(clientId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimers.delete(clientId);
    }
  }
}
function createHost(config) {
  var _a;
  const server = new pluginRegistry.HostServer({
    ...config,
    WebSocketImpl: WebSocket
  });
  const peers = new pluginRegistry.HostPeerManager({
    hostServer: server,
    rtc: wrtc__namespace
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
exports.createHost = createHost;
