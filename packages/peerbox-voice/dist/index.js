class r {
  constructor() {
    this.name = "voice";
  }
}
class a extends r {
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
class i extends r {
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
    const e = this.client.peer.pc;
    for (const t of this.stream.getTracks())
      e.addTrack(t, this.stream);
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
function n() {
  return {
    name: "voice",
    install({ host: s, client: e }) {
      console.log("Installing VoicePlugin for", s ? "host" : "client"), e && e.plugins.registerPlugin(new i(e)), s && s.plugins.registerPlugin(new a(s));
    }
  };
}
export {
  n as default
};
