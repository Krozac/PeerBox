// hostServer.cjs
import EventEmitter from 'events';
import WebSocket from 'ws';
import { SERVER_MSG_TYPES } from '../signalingProtocol.js';

export default class HostServer extends EventEmitter {
  constructor({ url } = {}) {
    super();
    this.url = url;
    this.ws = null;
    this._sendQueue = [];
    this._reconnectTimer = null;
  }

  start() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this._connect();
  }

  _connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.emit("open");
      this._flushSendQueue();
      // ❌ removed auto "create"
      // ✅ let Host decide when to send "create" or "join"
    });

    this.ws.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }
      switch (data.type) {
        case SERVER_MSG_TYPES.NEW_PEER:
          this.emit("new-peer", data.clientId);
          break;

        case SERVER_MSG_TYPES.PEER_LEFT:
          this.emit("peer-left", data.clientId);
          break;

        case SERVER_MSG_TYPES.SIGNAL:
          this.emit("signal", data.from, data.payload);
          break;

        default:
          if (data.type) {
            this.emit(data.type, data);
          } else {
            this.emit("unknown-message", data);
          }
      }
    });

    this.ws.on("close", (code, reason) => {
      this.emit("close", { code, reason });
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = setTimeout(() => this._connect(), 2000);
    });

    this.ws.on("error", (err) => {
      this.emit("error", err);
    });
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
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this._connect();
      }
    }
  }

  sendSignal(targetClientId, payload) {
    this.send("signal", {
      payload: { target: targetClientId, ...payload },
    });
  }

  getRoomID() {
    return this.roomID;
  }

  getHostID() {
    return this.hostID;
  }

  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    clearTimeout(this._reconnectTimer);
    this._sendQueue = [];
  }
}

