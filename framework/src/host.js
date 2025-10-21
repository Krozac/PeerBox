// host.js
import HostPeerManager from './networking/node/hostPeerConnection.js';
import HostServer from './networking/node/hostServer.js';
import { HostReconnectManager } from './networking/node/hostReconnection.js';

export class Host {
  constructor(config) {
    this.server = new HostServer(config);
    this.peers = new HostPeerManager({ hostServer: this.server });
    this.listeners = {};

    this.reconnectManager = new HostReconnectManager(this);

    // auto pong reply

    this.peers.on("ping", ({ clientId, id }) => {
      this.send(clientId, { type: "pong", id });
    });

    // Wire peer lifecycle into reconnect manager
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



