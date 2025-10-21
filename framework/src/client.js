// client.js
import ClientPeerManager from "./networking/browser/clientPeerConnection.js";
import ClientServer from "./networking/browser/signalingClient.js";

export default class Client {
  constructor({ signalingUrl, roomId, username}) {
    this.signaling = new ClientServer({ url: signalingUrl, roomId, username });
    this.peerConnection = new ClientPeerManager({
      signaling: this.signaling,
      username,
    });

    this.listeners = {};
  }

  async connect() {
    await this.signaling.start();
    this.peerConnection.connect();
  }

  on(event, callback) {
    this.peerConnection.on(event, callback);
  }

  send(msg) {
    console.log(msg)
    this.peerConnection.send(msg);
  }

  disconnect() {
    this.signaling.disconnect();
    this.peerConnection.close();
  }

}