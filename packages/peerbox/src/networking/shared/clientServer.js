import { EventEmitter } from "./eventEmitter.js";
import { SERVER_MSG_TYPES } from "../signalingProtocol.js";

const OPEN = 1;
const CONNECTING = 0;

class ClientServer extends EventEmitter {
  constructor({ url, roomId, username, WebSocketImpl = globalThis.WebSocket, reconnectDelay = 1500 } = {}) {
    super();
    if (!url) throw new TypeError("ClientServer requires a signaling url");
    if (!WebSocketImpl) throw new TypeError("No WebSocket implementation is available");
    this.url = url;
    this.roomId = roomId;
    this.username = username;
    this.WebSocketImpl = WebSocketImpl;
    this.reconnectDelay = reconnectDelay;
    this.ws = null;
    this._started = false;
    this._intentionalClose = false;
    this._reconnectTimer = null;
    this._joinRequest = null;
    this.userId = null;
  }

  start() {
    this._started = true;
    this._intentionalClose = false;
    if (this.ws?.readyState === OPEN) return Promise.resolve();
    return this._connect();
  }

  _connect() {
    if (!this._started || this.ws?.readyState === OPEN || this.ws?.readyState === CONNECTING) return this._connecting;
    clearTimeout(this._reconnectTimer);
    const ws = new this.WebSocketImpl(this.url);
    this.ws = ws;
    this._connecting = new Promise((resolve, reject) => {
      let opened = false;
      ws.onopen = () => {
        if (this.ws !== ws) return;
        opened = true;
        if (this._joinRequest) this._sendRaw(this._joinRequest);
        this.emit("open", { reconnected: Boolean(this._joinRequest) });
        resolve();
      };
      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        let data;
        try { data = JSON.parse(event.data); }
        catch { this.emit("error", new Error("Invalid JSON from signaling server")); return; }
        if (data.type === SERVER_MSG_TYPES.SIGNAL) this.emit("signal", data.payload);
        else if (data.type === SERVER_MSG_TYPES.HOST_DISCONNECTED) this.emit("host-disconnected", data);
        else if (data.type === SERVER_MSG_TYPES.JOIN_ACCEPTED) {
          this.userId = data.userId;
          this.emit("join-accepted", data);
        } else if (data.type === SERVER_MSG_TYPES.ROOM_CLOSED) this.emit("room-closed", data);
        else if (data.type) this.emit(data.type, data);
        else this.emit("unknown-message", data);
      };
      ws.onclose = (event) => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (!opened) reject(new Error("Signaling WebSocket closed before opening"));
        this.emit("close", event);
        if (this._started && !this._intentionalClose) {
          this.emit("reconnecting");
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = setTimeout(() => {
            this._connect().catch((error) => this.emit("error", error));
          }, this.reconnectDelay);
        }
      };
      ws.onerror = (error) => {
        this.emit("error", error);
        if (!opened) reject(error instanceof Error ? error : new Error("Signaling WebSocket failed to open"));
      };
    });
    return this._connecting;
  }

  _sendRaw(message) {
    if (this.ws?.readyState !== OPEN) return false;
    this.ws.send(typeof message === "string" ? message : JSON.stringify(message));
    return true;
  }

  send(type, payload = {}) {
    const message = { type, ...payload };
    if (type === SERVER_MSG_TYPES.JOIN) this._joinRequest = JSON.stringify(message);
    if (this._sendRaw(message)) return true;
    if (!this._started && type !== SERVER_MSG_TYPES.JOIN) this.emit("warn", "Signaling socket is not connected");
    return false;
  }

  sendSignal(target, payload = {}) {
    return this.send(SERVER_MSG_TYPES.SIGNAL, { payload: { target, ...payload } });
  }

  rejoin() {
    if (!this._joinRequest) return false;
    return this._sendRaw(this._joinRequest);
  }

  disconnect() {
    this._intentionalClose = true;
    this._started = false;
    clearTimeout(this._reconnectTimer);
    if (!this.ws) return;
    if (this.ws.readyState === OPEN && this._joinRequest) {
      this._sendRaw({ type: SERVER_MSG_TYPES.CLIENT_DISCONNECTED, roomId: this.roomId });
    }
    this._joinRequest = null;
    this.userId = null;
    const ws = this.ws;
    this.ws = null;
    ws.close();
  }
}

export default ClientServer;
