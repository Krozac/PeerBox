// hostPeerConnection.js
import { EventEmitter }  from "./eventEmitter.js";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};


export default class HostPeerManager extends EventEmitter {
  constructor({hostServer, rtc = globalThis, rtcConfiguration, }) {
    super();

    
    this.hostServer = hostServer;
    this.rtc = rtc;
    this.rtcConfiguration = rtcConfiguration;

    
    this.peerConnections = new Map();    // clientId -> RTCPeerConnection
    this.dataChannels = new Map();       // clientId -> RTCDataChannel
    this.iceCandidateBuffers = new Map();// clientId -> ICE candidate[]
    this.reconnecting = new Set();       // clientIds currently being reconnected

    this.pendingRenegotiation = new Map(); // clientId -> boolean (true if renegotiation is pending)

  }

  
  /*
  ============================================
  PUBLIC
  ============================================
  */

  
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

  destroyPeer(clientId) {
    this._destroyTransport(clientId);

    this.emit("peer-disconnected", clientId); // called when true disconnect else we emit "peer-transport-lost" and wait for possible reconnect
  }

  async _replacePeer(clientId) {
    // This event is emitted by the signaling server when it detects a reconnect (same userId)
    // We can choose to handle it here or just rely on the client to initiate a new connection
    console.log(`Replacing peer ${clientId}`);

    this._destroyTransport(clientId);
    await this._createPeer(clientId);
  }

    /*
  ============================================
  PEER CREATION
  ============================================
  */

  async _createPeer(clientId) {
    if (this.peerConnections.has(clientId)) {
      return;
    }

    const pc =
    new this.rtc.RTCPeerConnection(
      this.rtcConfiguration
    );

    const dc = pc.createDataChannel("data");

    this.peerConnections.set(clientId, pc);
    this.dataChannels.set(clientId, dc);
    this.iceCandidateBuffers.set(clientId, []);

    this._attachPeerHandlers(clientId, pc, dc);
    

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

  async _replacePeer(clientId) {
    console.log(`Replacing peer ${clientId}`);

    const oldPc = this.peerConnections.get(clientId);

    if (oldPc) {
      try { oldPc.close(); } catch {}
    }

    this._destroyTransport(clientId);

    // IMPORTANT: recreate fresh peer connection
    await this._createPeer(clientId);

    // optional: emit high-level event AFTER recreation
    this.emit("peer-reconnected", clientId);
  }
  
  /*
  ============================================
  TRANSPORT
  ============================================
  */

  _destroyTransport(clientId) {
    const pc = this.peerConnections.get(clientId);
    if (pc) {
      try { pc.close(); } catch {}
    }

    this.peerConnections.delete(clientId);
    this.dataChannels.delete(clientId);
    this.iceCandidateBuffers.delete(clientId);
  }

  
  /*
  ============================================
  HANDLERS
  ============================================
  */

  _attachPeerHandlers(clientId, pc, dc) {
    dc.onopen = () => {
      this.emit("peer-connected", clientId); 
    };

    dc.onclose = () => {
      this.emit("peer-transport-lost", clientId); // transport lost, wait for possible reconnect instead of immediate disconnect
    };

    dc.onerror = (err) => {
      this.emit("error", err, clientId);
    };

    dc.onmessage = (ev) => {
      this._handleDataMessage(clientId, ev.data);
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      this.hostServer.sendSignal(clientId, {
        type: "ice-candidate",
        candidate: ev.candidate,
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "disconnected" || state === "failed" || state === "closed") {
        this.emit("peer-transport-lost", clientId); // transport lost, wait for possible reconnect instead of immediate disconnect
      }
    };

    pc.ontrack = (event) => {
      this.emit("track", {
        clientId,
        stream: event.streams[0],
        track: event.track,
      });
    };


}

  _handleDataMessage(clientId, data) {
    let msg;

    try {
      msg = JSON.parse(data);
    } catch (err) {
      this.emit("error", new Error("Invalid JSON from peer"), clientId);
      return;
    }
    if (!msg) return;

    const type = msg.type || "default";

    console.log("RAW MESSAGE:", msg);

    this.emit(type, { clientId, ...msg });
  }

    /*
  ============================================
  SIGNALING
  ============================================
  */

  _handleSignal(clientId, data) {
    const pc = this.peerConnections.get(clientId);

    if (!pc) return;

    if (data.type === "answer") {
      this._handleAnswer(clientId, pc, data);

    } else if (data.type === "ice-candidate") {
      this._handleIceCandidate(clientId, pc, data);
    }else if (data.type === "offer") {
      // happens when client asks for renegotiation (e.g., after enabling microphone)
      this._handleOffer(clientId, pc, data);
    }
  }

  async _handleAnswer(clientId, pc, data) {
    try {
      await pc.setRemoteDescription(
        new this.rtc.RTCSessionDescription(data.sdp)
      );

      const buffer =
        this.iceCandidateBuffers.get(clientId) || [];

      for (const candidate of buffer) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          this.emit("error", err, clientId);
        }
      }

      this.iceCandidateBuffers.set(clientId, []);

      await this._flushNegotiation(clientId, pc);
    } catch (err) {
      this.emit("error", err, clientId);
    }
  }

  async _handleIceCandidate(clientId, pc, data) {
    if (!data.candidate?.candidate) {
      return;
    }

    const candidate =
      new this.rtc.RTCIceCandidate(data.candidate);

    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);

      } catch (err) {
        this.emit("error", err, clientId);
      }

    } else {
      this.iceCandidateBuffers
        .get(clientId)
        ?.push(candidate);
    }
  }

  async _handleOffer(clientId, pc, data) {
    try {
      await pc.setRemoteDescription(
        new this.rtc.RTCSessionDescription(data.sdp)
      );
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.hostServer.sendSignal(clientId, {
        type: "answer",
        sdp: pc.localDescription,
      });

      await this._flushNegotiation(clientId, pc);
    } catch (err) {
      this.emit("error", err, clientId);
      return;
    }
  }

  async _renegotiate(pc, clientId) {
    if (pc.signalingState !== "stable") {
      console.log("Deferring renegotiation for", clientId);

      this.pendingRenegotiation.set(clientId, true);
      return;
    }

    await this._doRenegotiate(pc, clientId);
  }

  async _doRenegotiate(pc, clientId) {
    console.log("Renegotiating with peer", clientId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.hostServer.sendSignal(clientId, {
      type: "offer",
      sdp: pc.localDescription,
    });
  }

  async _flushNegotiation(clientId, pc) {
    if (!this.pendingRenegotiation.get(clientId)) return;

    if (pc.signalingState !== "stable") return;

    console.log("Flushing pending renegotiation for", clientId);

    this.pendingRenegotiation.delete(clientId);
    await this._doRenegotiate(pc, clientId);
  }

  //Media tracks handling
  addTrackToAll(stream, excludeId) {
    for (const [id, pc] of this.peerConnections.entries()) {
      if (id === excludeId) continue;

      for (const track of stream.getTracks()) {
        console.log(`Adding track ${track.kind} to peer ${id}`);
        const sender = pc.addTrack(track, stream);
        
      }
      this._renegotiate(pc, id);
    }
  }

  addTrackToPeer(stream, clientId) {
    const pc = this.peerConnections.get(clientId);
    if (!pc) return;

    for (const track of stream.getTracks()) {
      console.log(`Adding track ${track.kind} to peer ${clientId}`);
      const sender = pc.addTrack(track, stream);
    }
    this._renegotiate(pc, clientId);
  }
}
