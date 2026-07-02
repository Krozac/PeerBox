  //host.js

  export default class Host {
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