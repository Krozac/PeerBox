// hostPeerConnection.js
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from "wrtc";
import EventEmitter from "events";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};


export default class HostPeerManager extends EventEmitter {
  constructor({ hostServer }) {
    super();
    this.hostServer = hostServer;

    this.peerConnections = new Map();    // clientId -> RTCPeerConnection
    this.dataChannels = new Map();       // clientId -> RTCDataChannel
    this.iceCandidateBuffers = new Map();// clientId -> ICE candidate[]
    this.reconnecting = new Set();       // clientIds currently being reconnected

    // Subscribe to signaling server events
    this.hostServer.on("new-peer", (clientId) => this._handleNewPeer(clientId));
    this.hostServer.on("peer-left", (clientId) => this._removePeer(clientId));
    this.hostServer.on("signal", (from, payload) => this._handleSignal(from, payload));
  }

  async _handleNewPeer(clientId) {

    if (this.reconnecting.has(clientId)) {
      // optionally log/debug
      // console.log('New-peer ignored because reconnect in progress:', clientId);
      return;
    }

    const pc = new RTCPeerConnection(configuration);
    this.peerConnections.set(clientId, pc);
    this.iceCandidateBuffers.set(clientId, []);

    const dc = pc.createDataChannel("data");
    this.dataChannels.set(clientId, dc);

    dc.onopen = () => {
      this.emit("peer-connected", clientId);
    }
    dc.onclose = () => {
      this._removePeer(clientId);
    }

    dc.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        this.emit("error", new Error("Invalid JSON from peer"), clientId);
        return;
      }

      if (!msg) return;

      const type = msg.type || "default";
      this.emit(type, { clientId, ...msg });

    };

    dc.onerror = (err) => this.emit("error", err, clientId);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.hostServer.sendSignal(clientId, {
          type: "ice-candidate",
          candidate: ev.candidate,
        });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.hostServer.sendSignal(clientId, {
        type: "offer",
        sdp: pc.localDescription,
      });
    } catch (err) {
      this.emit("error", err, clientId);
    }
  }

  _handleSignal(clientId, data) {
    
    const pc = this.peerConnections.get(clientId);
    if (!pc) return;
    if (data.type === "answer") {
      pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
        .then(() => {
          const buffer = this.iceCandidateBuffers.get(clientId) || [];
          buffer.forEach((c) => pc.addIceCandidate(c).catch(console.error));
          this.iceCandidateBuffers.set(clientId, []);
        })
        .catch((err) => this.emit("error", err, clientId));
    } else if (data.type === "ice-candidate") {
      if (data.candidate && data.candidate.candidate) {
        const candidate = new RTCIceCandidate(data.candidate);
        if (pc.remoteDescription) {
          pc.addIceCandidate(candidate).catch((err) => this.emit("error", err, clientId));
        } else {
          this.iceCandidateBuffers.get(clientId).push(candidate);
        }
      }
    }
  }

  _removePeer(clientId, { emit = true, reconnecting = false } = {}) {
      const pc = this.peerConnections.get(clientId);
      if (pc && !reconnecting) {  // only close PC if not reconnecting
          try { pc.close(); } catch {}
          this.peerConnections.delete(clientId);
      }

      this.dataChannels.delete(clientId);
      this.iceCandidateBuffers.delete(clientId);

      if (emit) {
        this.emit("peer-disconnected", clientId);
      }
  }


  send(clientId, obj) {
    const dc = this.dataChannels.get(clientId);
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(obj));
    }
  }

  broadcast(obj, { exclude } = {}) {
    for (const [id, dc] of this.dataChannels.entries()) {
      if (id === exclude) continue;
      if (dc.readyState === "open") {
        dc.send(JSON.stringify(obj));
      }
    }
  }

  async tryReconnect(clientId) {
  if (this.reconnecting.has(clientId)) return false;
  this.reconnecting.add(clientId);

  // remove old references silently
  this.dataChannels.delete(clientId);
  this.iceCandidateBuffers.set(clientId, []);

  try {
    const pc = new RTCPeerConnection(configuration);
    this.peerConnections.set(clientId, pc);
    this.iceCandidateBuffers.set(clientId, []);

    const dc = pc.createDataChannel("data");
    this.dataChannels.set(clientId, dc);

    // wire events
    dc.onclose = () => this._removePeer(clientId, { emit: false });
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg) this.emit(msg.type || "default", { clientId, ...msg });
      } catch (e) {
        this.emit("error", new Error("Invalid JSON from peer"), clientId);
      }
    };
    dc.onerror = (err) => this.emit("error", err, clientId);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.hostServer.sendSignal(clientId, { type: "ice-candidate", candidate: ev.candidate });
      }
    };

    // create offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    } catch (err) {
      this.emit("error", err, clientId);
      this.reconnecting.delete(clientId);
      return false;
    }

    this.hostServer.sendSignal(clientId, { type: "offer", sdp: pc.localDescription });

    // wait for DC open with timeout
    const ok = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        try { pc.close(); } catch {}
        this._removePeer(clientId, { emit: false });
        resolve(false);
      }, 5000);

      dc.addEventListener("open", () => {
        clearTimeout(timeout);
        this.emit("peer-connected", clientId);
        resolve(true);
      }, { once: true });
    });

    this.reconnecting.delete(clientId);
    return ok;
  } catch (err) {
    this.emit("error", err, clientId);
    this._removePeer(clientId, { emit: false });
    this.reconnecting.delete(clientId);
    return false;
  }
}

}
