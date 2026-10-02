import Host from "../shared/host.js";
import HostServer from "../shared/hostServer.js";
import HostPeerManager from "../shared/hostPeerConnection.js";
import { HostReconnectManager } from "../shared/hostReconnection.js";

import createPluginRegistry from "../shared/pluginRegistry.js";

import * as wrtc from "wrtc";
import WebSocket from "ws";

export function createHost(config) {
  const server = new HostServer({
    ...config,
    WebSocketImpl: WebSocket,
  });

  const peers = new HostPeerManager({
    hostServer: server,
    rtc: wrtc,
    rtcConfiguration: config.rtcConfiguration,
  });

  const reconnectManager = new HostReconnectManager({ peers }, { gracePeriod: config.peerReconnectGracePeriod });

  const pluginRegistry  = createPluginRegistry();

  const context = {
      host: {
        server,
        peers,
        reconnectManager,
        plugins : pluginRegistry,
      },
      client: null,
      shared: config.shared ?? {},
  };

  for (const plugin of config.plugins ?? []) {
    plugin.install?.(context);
  }

  return new Host({
    server,
    peers,
    reconnectManager,
    plugins : pluginRegistry,
  });
}
