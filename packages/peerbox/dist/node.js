import { H as C, b as T, d as l, e as f, f as v } from "./pluginRegistry-BPXLzCNK.js";
function g(r, a) {
  for (var o = 0; o < a.length; o++) {
    const t = a[o];
    if (typeof t != "string" && !Array.isArray(t)) {
      for (const n in t)
        if (n !== "default" && !(n in r)) {
          const s = Object.getOwnPropertyDescriptor(t, n);
          s && Object.defineProperty(r, n, s.get ? s : {
            enumerable: !0,
            get: () => t[n]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(r, Symbol.toStringTag, { value: "Module" }));
}
function p(r) {
  return r && r.__esModule && Object.prototype.hasOwnProperty.call(r, "default") ? r.default : r;
}
var e = {}, d;
function b() {
  return d || (d = 1, e.MediaStream = window.MediaStream, e.MediaStreamTrack = window.MediaStreamTrack, e.RTCDataChannel = window.RTCDataChannel, e.RTCDataChannelEvent = window.RTCDataChannelEvent, e.RTCDtlsTransport = window.RTCDtlsTransport, e.RTCIceCandidate = window.RTCIceCandidate, e.RTCIceTransport = window.RTCIceTransport, e.RTCPeerConnection = window.RTCPeerConnection, e.RTCPeerConnectionIceEvent = window.RTCPeerConnectionIceEvent, e.RTCRtpReceiver = window.RTCRtpReceiver, e.RTCRtpSender = window.RTCRtpSender, e.RTCRtpTransceiver = window.RTCRtpTransceiver, e.RTCSctpTransport = window.RTCSctpTransport, e.RTCSessionDescription = window.RTCSessionDescription, e.getUserMedia = window.getUserMedia, e.mediaDevices = navigator.mediaDevices), e;
}
var u = b();
const S = /* @__PURE__ */ p(u), h = /* @__PURE__ */ g({
  __proto__: null,
  default: S
}, [u]);
var c, R;
function m() {
  return R || (R = 1, c = function() {
    throw new Error(
      "ws does not work in the browser. Browser clients must use the native WebSocket object"
    );
  }), c;
}
var D = m();
const P = /* @__PURE__ */ p(D);
function M(r) {
  var w;
  const a = new C({
    ...r,
    WebSocketImpl: P
  }), o = new T({
    hostServer: a,
    rtc: h,
    rtcConfiguration: r.rtcConfiguration
  }), t = new l({ peers: o }, { gracePeriod: r.peerReconnectGracePeriod }), n = v(), s = {
    host: {
      server: a,
      peers: o,
      reconnectManager: t,
      plugins: n
    },
    client: null,
    shared: r.shared ?? {}
  };
  for (const i of r.plugins ?? [])
    (w = i.install) == null || w.call(i, s);
  return new f({
    server: a,
    peers: o,
    reconnectManager: t,
    plugins: n
  });
}
export {
  M as createHost
};
