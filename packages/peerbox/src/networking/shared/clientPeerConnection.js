// clientPeerConnection.js
import { SIGNAL_TYPES, createSignal, parseJSON } from "../signalingProtocol.js";
import {EventEmitter} from "./eventEmitter.js";

class ClientPeerManager extends EventEmitter {
  constructor({ signaling, username = "Anonymous", rtcConfiguration  }) {
    super();
    this.signaling = signaling; // abstraction: { send(type, payload) }
    this.username = username;

    this.rtcConfiguration = rtcConfiguration ;

    this.pc = null;
    this.dataChannel = null;
    this.pendingIceCandidates = [];

    this._renegotiating = false;
    this._pendingRenegotiation = false;

    this._setupSignaling();
  }

  _setupSignaling() {
    this.signaling.on("signal", (payload) => this._handleSignal(payload));
    this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    });
  }

  async connect() {
    this.pc = new RTCPeerConnection(this.rtcConfiguration);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendSignal("host", createSignal(SIGNAL_TYPES.ICE_CANDIDATE, { candidate: event.candidate }));
      }
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    this.pc.ontrack = (event) => { 
      this.emit("track", {
        stream: event.streams[0],
        track: event.track,
      });
    };
  }

  _setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.emit("connected");
    };

    this.dataChannel.onmessage = (event) => {
      const msg = parseJSON(event.data);
      console.log(msg)
      if (!msg ) return;
      const type = msg.type || "default";
            console.log(type)
      this.emit(type, msg);


      if (msg.type === SIGNAL_TYPES.HOST_DISCONNECTED) {
        this.emit("host-disconnected");
      }
    };

    this.dataChannel.onerror = (err) => {
      this.emit("error", err);
    };

    this.dataChannel.onclose = () => {
      this.emit("disconnected");
    };
  }

  async _handleSignal(data) {
    console.log("Received signal from host:", data);
    if (!this.pc) {
      this.emit("error", new Error("PeerConnection not initialized"));
      return;
    }

    switch (data.type) {
      case SIGNAL_TYPES.OFFER:
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

          for (const candidate of this.pendingIceCandidates) {
            try {
              await this.pc.addIceCandidate(candidate);
            } catch (err) {
              this.emit("error", err);
            }
          }
          
          this.pendingIceCandidates = [];

          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signaling.sendSignal("host", createSignal(SIGNAL_TYPES.ANSWER, { sdp: this.pc.localDescription }));
        } catch (err) {
          this.emit("error", err);
        }
        break;

      case SIGNAL_TYPES.ICE_CANDIDATE:
        if (data.candidate) {
          try {
            const candidate = new RTCIceCandidate(data.candidate);
            if (this.pc.remoteDescription) {
              await this.pc.addIceCandidate(candidate);
            } else {
                this.pendingIceCandidates ??= [];
                this.pendingIceCandidates.push(candidate);
            } 
          } catch (err) {
            this.emit("error", err);
          }
        }
        break;

      default:
        this.emit("warn", `Unknown signal type from host: ${data.type}`);
    }
  }

  send(message) {
    const envelope = {
      ...message,
      userId: this.signaling.userId,
      connectionId: this.connectionId,
      ts: Date.now(),
    };

    if (this.dataChannel?.readyState === "open") {
      this.dataChannel.send(JSON.stringify(envelope));
    } else {
      this.emit("warn", "Data channel not open");
    }
  }

  async renegotiate() {
    if (!this.pc) return;

    if (this._renegotiating) {
      this._pendingRenegotiation = true;
      return;
    }

    this._renegotiating = true;

    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log("Renegotiation offer created and set as local description:", offer);
      this.signaling.sendSignal(
        "host",
        createSignal(SIGNAL_TYPES.OFFER, {
          sdp: this.pc.localDescription,
        })
      );
      
    } finally {
      this._renegotiating = false;

      if (this._pendingRenegotiation) {
        this._pendingRenegotiation = false;
        this.renegotiate();
      }
    }
  }
}

export default ClientPeerManager;
