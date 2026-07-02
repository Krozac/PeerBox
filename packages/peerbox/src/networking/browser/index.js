import Host from "../shared/host.js";
import Client from "../shared/client.js";
import HostServer from "../shared/hostServer.js";
import ClientServer from "../shared/clientServer.js";
import HostPeerManager from "../shared/hostPeerConnection.js";
import ClientPeerManager from "../shared/clientPeerConnection.js";

import createPluginRegistry from "../shared/pluginRegistry.js";

export function createHost(config) {
  const server = new HostServer(config);

  const peers = new HostPeerManager({
    hostServer: server,
    rtc: globalThis,
    rtcConfiguration : config.rtcConfiguration,
  });

  const reconnectManager = new HostReconnectManager({
    peers,
  });

  const pluginRegistry  = createPluginRegistry();

  const context = {
      host: {
        server,
        peers,
        reconnectManager,
        plugins: pluginRegistry,
      },
      client: null,
      shared: config.shared ?? {},
  };

  for (const plugin of config.plugins) {
    plugin.install?.(context);
  }

  return new Host({
    server,
    peers,
    reconnectManager,
    plugins : pluginRegistry,
  });
}

export function createClient(config) {
  const server = new ClientServer(config);

  const peer = new ClientPeerManager({
    signaling: server,
    username: config.username,
    rtcConfiguration : config.rtcConfiguration,
  });

  const pluginRegistry  = createPluginRegistry();
  const context = {
      host: null,
      client: {
        server,
        peer,
        plugins : pluginRegistry,
      },
      shared: config.shared ?? {},
  };

  for (const plugin of config.plugins) {
    plugin.install?.(context);
  }

  return new Client({
    server,
    peer,
    plugins : pluginRegistry,
  });
}