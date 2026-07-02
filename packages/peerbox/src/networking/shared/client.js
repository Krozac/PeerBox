// client.js

export default class Client {
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
    this.server.disconnect?.();
    this.peer.close?.();  
  }
}