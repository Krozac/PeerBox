import { EventEmitter } from "./eventEmitter.js";
export const PeerStates = Object.freeze({
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  RECONNECTING: "reconnecting",
  RECONNECTED: "reconnected",
  FAILED: "failed",
  SYNCED: "synced",
});


export class HostReconnectManager extends EventEmitter {
  constructor({ peers }, options = {}) {
    super();

    this.peers = peers;

    this.gracePeriod = options.gracePeriod ?? 120000;

    this.peerStates = new Map(); // clientId -> PeerStates

    this.disconnectTimers = new Map(); // clientId -> timeoutId

    this._bindEvents();
  }

  _bindEvents() {
    this.peers.on("peer-transport-lost", (clientId) => {
      this._beginReconnect(clientId);
    });
    
    this.peers.on("peer-connected", (clientId) => {
      this._markConnected(clientId);
    });

  }

  getState(clientId) {
    return this.peerStates.get(clientId) || PeerStates.DISCONNECTED;
  }

  isConnected(clientId) {
    const state = this.getState(clientId);

    return state === PeerStates.CONNECTED || state === PeerStates.RECONNECTED || state === PeerStates.SYNCED;
  }

  _setState(clientId, state) {
    const previous = this.peerStates.get(clientId);

    if (previous === state) return;

    this.peerStates.set(clientId, state);

    this.emit("state-change", { clientId, current:state, previous });
  }

  _beginReconnect(clientId) {
    const current = this.getState(clientId);
    if (current === PeerStates.RECONNECTING) return;
    
    this._setState(clientId, PeerStates.RECONNECTING);

    // Attempt immediate reconnect
    this.emit("reconnecting", clientId);

    this._clearDisconnectTimer(clientId);

    const timeout = setTimeout(() => {
      const state = this.getState(clientId);
      if (state !== PeerStates.RECONNECTING) {
        return;
      }

      this._setState(clientId, PeerStates.FAILED);
      this.emit("failed", clientId);

      this.peers.destroyPeer?.(clientId, { emit: false });

      this._setState(clientId, PeerStates.DISCONNECTED);
      console.log(`Peer ${clientId} failed to reconnect within grace period, disconnecting.`);
      this.emit("disconnected", clientId);
    }, this.gracePeriod);

    this.disconnectTimers.set(clientId, timeout);
  }

  _markConnected(clientId) {
    this._clearDisconnectTimer(clientId);
    const previous = this.getState(clientId);

    if (previous === PeerStates.RECONNECTING) {
      this._setState(clientId, PeerStates.RECONNECTED);
      this.emit("reconnected", clientId);
    }else{
      this._setState(clientId, PeerStates.CONNECTED);
      this.emit("connected", clientId);
    }
  }

  peerLeft(clientId) {
    this._clearDisconnectTimer(clientId);
    this.peerStates.delete(clientId);
  }

  reset() {
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    this.peerStates.clear();
  }

  _markSynced(clientId) {
    this._setState(clientId, PeerStates.SYNCED);
    this.emit("synced", clientId);
  }

  _clearDisconnectTimer(clientId) {
    const timeout = this.disconnectTimers.get(clientId);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      this.disconnectTimers.delete(clientId);
    }
  }
}
