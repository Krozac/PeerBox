// clientPeerConnection.js
import { SIGNAL_TYPES, createSignal, parseJSON } from "../signalingProtocol.js";
import EventEmitter from "eventemitter3";

const configuration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

class ClientPeerManager extends EventEmitter {
  constructor({ signaling, username = "Anonymous" }) {
    super();
    this.signaling = signaling; // abstraction: { send(type, payload) }
    this.username = username;

    this.pc = null;
    this.dataChannel = null;

    this._setupSignaling();
  }

  _setupSignaling() {
    this.signaling.on("signal", (payload) => this._handleSignal(payload));
    this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    });
  }

  async connect() {
    this.pc = new RTCPeerConnection(configuration);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendSignal("host", createSignal(SIGNAL_TYPES.ICE_CANDIDATE, { candidate: event.candidate }));
      }
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this._setupDataChannel();
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
    console.log(data.type)
    if (!this.pc) {
      this.emit("error", new Error("PeerConnection not initialized"));
      return;
    }

    switch (data.type) {
      case SIGNAL_TYPES.OFFER:
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
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
            await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            this.emit("error", err);
          }
        }
        break;

      default:
        this.emit("warn", `Unknown signal type from host: ${data.type}`);
    }
  }

  send(obj) {
    if (this.dataChannel && this.dataChannel.readyState === "open") {
      this.dataChannel.send(JSON.stringify(obj));
    } else {
      this.emit("warn", "Data channel not open, cannot send");
    }
  }
}

export default ClientPeerManager;
