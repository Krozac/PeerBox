// clientServer.js (ESM version, since browser)
import EventEmitter from "eventemitter3";
import { SERVER_MSG_TYPES } from "../signalingProtocol.js";

class ClientServer extends EventEmitter {
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
        case SERVER_MSG_TYPES.SIGNAL:
          this.emit("signal", data.payload);
          break;

        case SERVER_MSG_TYPES.HOST_DISCONNECTED:
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
    payload: { target, ...payload },
  });
}

  disconnect() {
    if (this.ws) {
      this.send(SERVER_MSG_TYPES.CLIENT_DISCONNECTED, { roomId: this.roomId });
      this.ws.close();
      this.ws = null;
    }
  }
}

export default ClientServer;
