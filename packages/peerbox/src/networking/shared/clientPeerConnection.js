// clientPeerConnection.js
import { SIGNAL_TYPES, createSignal, parseJSON } from "../signalingProtocol.js";
import {EventEmitter} from "./eventEmitter.js";

class ClientPeerManager extends EventEmitter {
  constructor({ signaling, username = "Anonymous", rtcConfiguration, rtc = globalThis }) {
    super();
    this.signaling = signaling; // abstraction: { send(type, payload) }
    this.username = username;

    this.rtcConfiguration = rtcConfiguration ;
    this.rtc = rtc;

    this.pc = null;
    this.dataChannel = null;
    this.pendingIceCandidates = [];
    this.signalSessionId = null;

    this._renegotiating = false;
    this._pendingRenegotiation = false;
    this._recovering = false;

    this._setupSignaling();
  }

  _setupSignaling() {
    this.signaling.on("signal", (payload) => this._handleSignal(payload));
    this.signaling.on("host-disconnected", () => {
      this.emit("host-disconnected");
    });
    this.signaling.on("room-closed", (message) => {
      this._recovering = true;
      this.emit("room-closed", message);
    });
  }

  async connect() {
    if (this.pc) return;
    this.pc = new this.rtc.RTCPeerConnection(this.rtcConfiguration ?? {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const pc = this.pc;

    this.pc.onicecandidate = (event) => {
      if (this.pc === pc && event.candidate) {
        this.signaling.sendSignal("host", createSignal(SIGNAL_TYPES.ICE_CANDIDATE, {
          candidate: event.candidate,
          sessionId: this.signalSessionId,
        }));
      }
    };

    this.pc.ondatachannel = (event) => {
      if (this.pc !== pc) return;
      this.dataChannel = event.channel;
      this._setupDataChannel();
    };

    this.pc.ontrack = (event) => { 
      if (this.pc !== pc) return;
      this.emit("track", {
        stream: event.streams[0],
        track: event.track,
      });
    };
  }

  _setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this._recovering = false;
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
      if (!this._recovering) {
        this._recovering = true;
        this.signaling.rejoin?.();
      }
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
          if (data.reconnect && this.pc) {
            this._closePeerConnection();
            this.pc = null;
            await this.connect();
          }
          if (this.signalSessionId && data.sessionId && this.signalSessionId !== data.sessionId) {
            this.pendingIceCandidates = [];
          }
          this.signalSessionId = data.sessionId ?? null;
          await this.pc.setRemoteDescription(new this.rtc.RTCSessionDescription(data.sdp));

          const candidates = this.pendingIceCandidates.filter((item) =>
            !item.sessionId || !this.signalSessionId || item.sessionId === this.signalSessionId
          );
          for (const { candidate } of candidates) {
            try {
              await this.pc.addIceCandidate(candidate);
            } catch (err) {
              this.emit("error", err);
            }
          }
          
          this.pendingIceCandidates = [];

          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signaling.sendSignal("host", createSignal(SIGNAL_TYPES.ANSWER, {
            sdp: this.pc.localDescription,
            sessionId: this.signalSessionId,
          }));
        } catch (err) {
          this.emit("error", err);
        }
        break;

      case SIGNAL_TYPES.ICE_CANDIDATE:
        if (data.candidate) {
          try {
            if (this.signalSessionId && data.sessionId && data.sessionId !== this.signalSessionId) break;
            const candidate = new this.rtc.RTCIceCandidate(data.candidate);
            if (this.pc.remoteDescription) {
              await this.pc.addIceCandidate(candidate);
            } else {
                this.pendingIceCandidates.push({ candidate, sessionId: data.sessionId ?? null });
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

  _closePeerConnection() {
    if (this.dataChannel) {
      this.dataChannel.onopen = null;
      this.dataChannel.onclose = null;
      this.dataChannel.onmessage = null;
      this.dataChannel.onerror = null;
      try { this.dataChannel.close(); } catch {}
    }
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ondatachannel = null;
      this.pc.ontrack = null;
      try { this.pc.close(); } catch {}
    }
    this.dataChannel = null;
    this.pendingIceCandidates = [];
    this.signalSessionId = null;
  }

  close() {
    this._closePeerConnection();
    this.pc = null;
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
          sessionId: this.signalSessionId,
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
