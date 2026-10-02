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
