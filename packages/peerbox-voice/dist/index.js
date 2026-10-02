class i {
  constructor() {
    this.name = "voice";
  }
}
class n extends i {
  constructor(e) {
    super(), this.host = e;
  }
  broadcast(e, { exclude: t } = {}) {
    this.host.peers.addTrackToAll(e, t);
  }
  send(e, t) {
    this.host.peers.addTrackToPeer(e, t);
  }
}
class c extends i {
  constructor(e) {
    super(), this.client = e, this.stream = null, this.remoteStreams = /* @__PURE__ */ new Map(), this._setup();
  }
  _setup() {
    this.client.peer.on("track", ({ stream: e, track: t }) => {
      this.remoteStreams.set(t.id, e);
    });
  }
  async enableMicrophone() {
    if (this.stream) return this.stream;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: !0 }), await this.stream.getAudioTracks()[0].applyConstraints({
      echoCancellation: !0,
      noiseSuppression: !0,
      autoGainControl: !0
    });
    const e = this.stream.getAudioTracks();
    if (!e || e.length === 0) {
      console.error("No audio tracks found in the stream.");
      return;
    }
    const t = e[0];
    console.log(
      "Local track state:",
      {
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      }
    ), await new Promise((a) => {
      const r = () => {
        t.readyState === "live" ? (console.log("Track is live and ready."), a()) : (console.log("Waiting for track to become live. Current state:", t.readyState), setTimeout(r, 100));
      };
      r();
    });
    const o = this.client.peer.pc;
    for (const a of this.stream.getTracks())
      o.addTrack(a, this.stream);
    return console.log("Renegotiating after enabling microphone..."), await this.client.peer.renegotiate(), this.stream;
  }
  disableMicrophone() {
    this.stream && (this.stream.getTracks().forEach((e) => e.stop()), this.stream = null);
  }
  mute() {
    var e;
    (e = this.stream) == null || e.getAudioTracks().forEach((t) => t.enabled = !1);
  }
  unmute() {
    var e;
    (e = this.stream) == null || e.getAudioTracks().forEach((t) => t.enabled = !0);
  }
}
function l() {
  return {
    name: "voice",
    install({ host: s, client: e }) {
      console.log("Installing VoicePlugin for", s ? "host" : "client"), e && e.plugins.registerPlugin(new c(e)), s && s.plugins.registerPlugin(new n(s));
    }
  };
}
export {
  l as default
};
