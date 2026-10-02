import { EventEmitter } from "./eventEmitter.js";
import { SERVER_MSG_TYPES } from "../signalingProtocol.js";

const OPEN = 1;
const CONNECTING = 0;

function listen(ws, type, handler) {
  if (typeof ws.addEventListener === "function") {
    ws.addEventListener(type, handler);
  } else {
    ws.on(type, handler);
  }
}

function messageData(eventOrData) {
  return eventOrData && typeof eventOrData === "object" && "data" in eventOrData
    ? eventOrData.data
    : eventOrData;
}

export default class HostServer extends EventEmitter {
  constructor({ url, WebSocketImpl = globalThis.WebSocket, reconnectDelay = 2000 } = {}) {
    super();
    if (!url) throw new TypeError("HostServer requires a signaling url");
    if (!WebSocketImpl) throw new TypeError("No WebSocket implementation is available");

    this.url = url;
    this.WebSocketImpl = WebSocketImpl;
    this.reconnectDelay = reconnectDelay;
    this.ws = null;
    this._sendQueue = [];
    this._reconnectTimer = null;
    this._stopped = true;
    this._roomActive = false;
    this._intentionalStop = false;
    this.roomId = null;
    this.hostId = null;
    this.hostToken = null;
  }

  start() {
    this._stopped = false;
    this._intentionalStop = false;
    if (this.ws?.readyState === OPEN || this.ws?.readyState === CONNECTING) return;
    this._connect();
  }

  _connect() {
    if (this._stopped) return;
    if (this.ws?.readyState === OPEN || this.ws?.readyState === CONNECTING) return;
    clearTimeout(this._reconnectTimer);
    const ws = new this.WebSocketImpl(this.url);
    this.ws = ws;

    listen(ws, "open", () => {
      if (this.ws !== ws) return;
      this.emit("open");
      if (this.roomId && this.hostToken) {
        this._sendRaw({ type: "host-resume", roomId: this.roomId, hostId: this.hostId, hostToken: this.hostToken });
      } else {
        this._flushSendQueue();
      }
    });

    listen(ws, "message", (eventOrData) => {
      if (this.ws !== ws) return;
      let data;
      try {
        const raw = messageData(eventOrData);
        data = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        this.emit("error", new Error("Invalid JSON from signaling server"));
        return;
      }

      switch (data.type) {
        case SERVER_MSG_TYPES.ROOM_CREATED:
          this.roomId = data.roomId;
          this.hostId = data.hostId ?? data.userId;
          this.hostToken = data.hostToken;
          this._roomActive = true;
          this.emit("room-created", data);
          this._flushSendQueue();
          break;
        case SERVER_MSG_TYPES.HOST_RESUMED:
          this._roomActive = true;
          this.emit("host-resumed", data);
          this._flushSendQueue();
          break;
        case SERVER_MSG_TYPES.HOST_RESUME_REJECTED:
          this._roomActive = false;
          this.roomId = null;
          this.hostId = null;
          this.hostToken = null;
          this.emit("host-resume-rejected", data);
          break;
        case SERVER_MSG_TYPES.ROOM_CLOSED:
          this._roomActive = false;
          this.roomId = null;
          this.hostId = null;
          this.hostToken = null;
          this.emit("room-closed", data);
          break;
        case SERVER_MSG_TYPES.NEW_PEER:
          this.emit("new-peer", data.userId, data);
          break;
        case SERVER_MSG_TYPES.PEER_LEFT:
          this.emit("peer-left", data.userId, data);
          break;
        case SERVER_MSG_TYPES.PEER_DISCONNECTED:
          this.emit("peer-transport-lost", data.userId, data);
          break;
        case SERVER_MSG_TYPES.PEER_RECONNECTED:
          this.emit("peer-reconnected", data.userId, data);
          break;
        case SERVER_MSG_TYPES.SIGNAL:
          this.emit("signal", data.from, data.payload);
          break;
        default:
          if (data.type) this.emit(data.type, data);
          else this.emit("unknown-message", data);
      }
    });

    listen(ws, "close", (eventOrCode, reason) => {
      if (this.ws !== ws) return;
      this.emit("close", { code: eventOrCode?.code ?? eventOrCode, reason: eventOrCode?.reason ?? reason });
      if (this.roomId) {
        this._roomActive = false;
        this.emit("host-signaling-lost", { roomId: this.roomId });
      }
      if (!this._stopped && !this._intentionalStop) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = setTimeout(() => this._connect(), this.reconnectDelay);
      }
    });

    listen(ws, "error", (err) => {
      if (this.ws === ws) this.emit("error", err);
    });
  }

  _sendRaw(message) {
    if (this.ws?.readyState !== OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  _flushSendQueue() {
    if (!this._roomActive && this.roomId) return;
    while (this._sendQueue.length && this.ws?.readyState === OPEN) {
      this.ws.send(this._sendQueue.shift());
    }
  }

  send(type, payload = {}) {
    const message = { type, ...payload };
    if (type === SERVER_MSG_TYPES.SIGNAL && (!this._roomActive || this.ws?.readyState !== OPEN)) {
      this.emit("signal-dropped", message);
      return false;
    }
    if (this._sendRaw(message)) return true;

    // Queue lifecycle/control commands such as initial room creation, but never
    // carry stale SDP/ICE messages across a signaling reconnect.
    if (type !== SERVER_MSG_TYPES.SIGNAL) this._sendQueue.push(JSON.stringify(message));
    if (!this._stopped && (!this.ws || this.ws.readyState > OPEN)) this._connect();
    return false;
  }

  sendSignal(targetClientId, payload) {
    return this.send(SERVER_MSG_TYPES.SIGNAL, {
      payload: { target: targetClientId, ...payload },
    });
  }

  getRoomID() { return this.roomId; }
  getHostID() { return this.hostId; }

  stop({ permanent = true } = {}) {
    clearTimeout(this._reconnectTimer);
    this._stopped = true;
    this._intentionalStop = permanent;
    if (permanent && this.roomId && this.ws?.readyState === OPEN) {
      this._sendRaw({ type: SERVER_MSG_TYPES.HOST_DISCONNECTED, roomId: this.roomId, hostId: this.hostId });
    }
    const ws = this.ws;
    this.ws = null;
    this._roomActive = false;
    this._sendQueue = [];
    if (permanent) {
      this.roomId = null;
      this.hostId = null;
      this.hostToken = null;
    }
    ws?.close();
  }
}
