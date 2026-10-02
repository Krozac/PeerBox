"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const pluginRegistry = require("./pluginRegistry-BoClf6ty.cjs");
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
function createHost(config) {
  var _a;
  const server = new pluginRegistry.HostServer({
    ...config,
    WebSocketImpl: WebSocket
  });
  const peers = new pluginRegistry.HostPeerManager({
    hostServer: server,
    rtc: wrtc__namespace,
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
exports.createHost = createHost;
