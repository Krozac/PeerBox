class ue {
  constructor({ idGenerator: e } = {}) {
    this.entities = /* @__PURE__ */ new Map(), this.updateSystems = [], this.renderSystems = [], this.components = /* @__PURE__ */ new Map(), this.nextEntityId = 1, this._idGenerator = e || (() => this.nextEntityId++), this._listeners = /* @__PURE__ */ new Map();
  }
  // --- Event emitter API ---
  on(e, t) {
    this._listeners.has(e) || this._listeners.set(e, /* @__PURE__ */ new Set()), this._listeners.get(e).add(t);
  }
  off(e, t) {
    var o;
    (o = this._listeners.get(e)) == null || o.delete(t);
  }
  emit(e, t) {
    var o;
    (o = this._listeners.get(e)) == null || o.forEach((i) => i(t));
  }
  // --- ECS API ---
  clear() {
    this.entities.clear(), this.components.clear(), this.nextEntityId = 1, this.emit("clear");
  }
  createEntity(e = {}) {
    const t = this._idGenerator();
    this.entities.set(t, !0), this.components.set(t, /* @__PURE__ */ new Map());
    for (const [o, i] of Object.entries(e))
      this.addComponent(t, o, i);
    return this.emit("entityCreated", t), t;
  }
  addComponent(e, t, o) {
    this.components.get(e).set(t, o), this.emit("componentAdded", { entityId: e, name: t, data: o });
  }
  getComponent(e, t) {
    var o;
    return (o = this.components.get(e)) == null ? void 0 : o.get(t);
  }
  query(e) {
    return Array.from(this.entities.keys()).filter((t) => {
      const o = this.components.get(t);
      return e.every((i) => o == null ? void 0 : o.has(i));
    });
  }
  removeEntities(e) {
    for (const t of e)
      this.entities.delete(t), this.components.delete(t), this.emit("entityRemoved", t);
  }
  registerSystem(e, { type: t = "update" } = {}) {
    t === "render" ? this.renderSystems.push(e) : this.updateSystems.push(e), this.emit("systemRegistered", e);
  }
  update(e) {
    for (const t of this.updateSystems)
      t(this, e);
    this.emit("update", e);
  }
  render(e) {
    for (const t of this.renderSystems)
      t(this, e);
    this.emit("render", e);
  }
}
const de = /* @__PURE__ */ (() => {
  let n = !1, e = 0, t = null;
  const o = 100;
  let i = null, s = null;
  function r(f) {
    if (!n) return;
    e || (e = f);
    const m = f - e;
    if (m > o) {
      i && i(m), e = f, t = requestAnimationFrame(r);
      return;
    }
    const S = m / 1e3;
    i && i(S), s && s(S), e = f, t = requestAnimationFrame(r);
  }
  function c({ onUpdate: f, onRender: m, targetFps: S = 60 }) {
    n || (i = f, s = m, n = !0, e = 0, t = requestAnimationFrame(r));
  }
  function a() {
    n && (n = !1, t && (cancelAnimationFrame(t), t = null));
  }
  function l() {
    return n;
  }
  return {
    start: c,
    stop: a,
    isRunning: l
  };
})();
function x({ id: n, classes: e = [], style: t = {}, html: o = "" } = {}) {
  return {
    id: n,
    classes: e,
    style: t,
    html: o,
    parentSelector
    // Don't include `element` in the component itself!
  };
}
function P({ id: n, name: e = "Default User" }) {
  return {
    id: n,
    name: e,
    role: "client"
    // Default role, can be 'host' or 'client'
  };
}
function _({ duration: n = 3e3, type: e = "info" } = {}) {
  return {
    duration: n,
    type: e
  };
}
function b({ x: n = 0, y: e = 0 }) {
  return {
    x: n,
    y: e
  };
}
function J({ chatId: n, chatName: e = "Default Chat" }) {
  return {
    chatId: n,
    chatName: e,
    messages: []
    // optional: could track message entity IDs here
  };
}
function R({ username: n, message: e, timestamp: t = Date.now(), chatId: o = "default", autoScroll: i = !0 } = {}) {
  return {
    username: n,
    message: e,
    timestamp: t,
    chatId: o,
    autoScroll: i
  };
}
function M({ url: n, volume: e = 1, loop: t = !1 }) {
  return {
    url: n,
    // URL of the audio file
    buffer: null,
    // AudioBuffer after loading
    volume: e,
    loop: t
  };
}
function q() {
  return {
    rate: 50,
    // particles per second
    burst: 0,
    // optional: emit N particles instantly
    timeSinceLast: 0,
    // internal timer
    maxParticles: 200,
    active: !0,
    // Particle definition function (data-driven)
    spawnParticle: (n, e) => {
    }
  };
}
function L() {
  return {
    value: 2,
    age: 0
  };
}
function I() {
  return {
    dx,
    dy
  };
}
function O({ type: n, params: e }) {
  return {
    type: n,
    params: e
  };
}
function H({ x: n = 0, y: e = 9.81 }) {
  return {
    x: n,
    // gravity direction or force on X
    y: e
    // gravity force on Y
  };
}
const N = "ParticleTag", fe = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ChatComponent: J,
  ChatMessageComponent: R,
  GravityComponent: H,
  HtmlRenderComponent: x,
  LifetimeComponent: L,
  MovementPatternComponent: O,
  ParticleEmitterComponent: q,
  ParticleTag: N,
  PositionComponent: b,
  SoundComponent: M,
  ToastComponent: _,
  VelocityComponent: I,
  userComponent: P
}, Symbol.toStringTag, { value: "Module" })), E = /* @__PURE__ */ new Map();
function K(n, e = "#ui-root") {
  const t = new Set(n.query([x]));
  for (const [o, i] of E.entries())
    t.has(o) || (i.parentElement && i.parentElement.removeChild(i), E.delete(o));
  for (const o of t) {
    const i = n.getComponent(o, x);
    if (!i) continue;
    let s = E.get(o);
    s || (s = document.createElement(i.tagName || "div"), E.set(o, s));
    const r = i.parentSelector || e, c = document.querySelector(r);
    if (!c) {
      console.warn(`HtmlRenderSystem: No element found for selector ${r}`);
      continue;
    }
    (!s.parentElement || s.parentElement !== c) && c.appendChild(s), i.id && s.id !== i.id && (s.id = i.id), i.classes && (s.className = "", s.classList.add(...i.classes)), i.style && Object.assign(s.style, i.style), i.html && s.innerHTML !== i.html && (s.innerHTML = i.html);
    const a = n.getComponent(o, b);
    a && (s.style.position = "absolute", s.style.left = a.x + "px", s.style.top = a.y + "px");
  }
}
function W(n, e, t = {}) {
  const o = t.newMessageSound, i = t.newMessageVolume ?? 0.1, s = t.chatParentSelectorId ?? "#chatBox";
  document.addEventListener("datachannel-message", async (r) => {
    const { sender: c, message: a, timestamp: l = Date.now(), chatId: f = "default" } = r.detail, m = n.createEntity();
    if (n.addComponent(m, R, { username: c, message: a, timestamp: l, chatId: f }), n.addComponent(m, x, {
      tagName: "div",
      classes: [
        "pb-chat-message",
        c === "You" ? "pb-chat-message--self" : "pb-chat-message--other"
      ],
      html: `<strong>${c}:</strong> ${a}`,
      parentSelector: s
    }), c !== "You" && e && o) {
      n.addComponent(m, M, { url: o, volume: i, loop: !1 });
      const S = n.getComponent(m, M);
      await e.loadSound(m, S), e.playSound(m);
    }
  });
}
function X(n) {
  const e = new (window.AudioContext || window.webkitAudioContext)(), t = /* @__PURE__ */ new Map();
  async function o(r, c) {
    const l = await (await fetch(c.url)).arrayBuffer();
    c.buffer = await e.decodeAudioData(l);
  }
  function i(r) {
    const c = n.getComponent(r, M);
    if (!c || !c.buffer) return;
    const a = e.createBufferSource();
    a.buffer = c.buffer, a.loop = c.loop;
    const l = e.createGain();
    l.gain.value = c.volume, a.connect(l).connect(e.destination), a.start(0), t.set(r, { source: a, gain: l });
  }
  function s(r) {
    const c = t.get(r);
    c && (c.source.stop(), t.delete(r));
  }
  return { loadSound: o, playSound: i, stopSound: s };
}
const v = /* @__PURE__ */ new Map();
function A(n) {
  A.listenerAdded || (A.listenerAdded = !0, window.addEventListener("toast", (e) => {
    const { message: t, duration: o, parentSelector: i, type: s } = e.detail, r = n.createEntity();
    n.addComponent(r, _, { duration: o, remainingTime: o, type: s || "info" }), n.addComponent(r, x, {
      html: t,
      classes: ["pb-toast", `pb-toast--${s || "info"}`],
      parentSelector: i || "#toast-container"
    });
  }));
}
function Q(n, e) {
  const t = n.query([_]);
  A(n);
  for (const o of t) {
    const i = n.getComponent(o, _);
    if (!i) continue;
    v.has(o) || v.set(o, i.duration ?? 3e3);
    const s = v.get(o) - e;
    s <= 0 ? (n.removeEntities([o]), v.delete(o)) : v.set(o, s);
  }
}
function Z(n, e = {}) {
  const t = e.interval || 2e3;
  let o = 0, i = 0;
  const s = /* @__PURE__ */ new Map();
  return (r, c) => {
    if (n._pingBound || (n.on("pong", (a) => {
      if (s.has(a.id)) {
        const l = s.get(a.id), f = Date.now() - l;
        s.delete(a.id), console.log("RTT ", f), r.emit("ping-update", { rtt: f, id: a.id });
      }
    }), n._pingBound = !0), o += c, o >= t) {
      o = 0;
      const a = i++;
      s.set(a, Date.now()), n.send({ type: "ping", id: a });
    }
  };
}
function ee(n, e, { MAX: t = 1e3 } = {}) {
  var c;
  const o = n.query([q]), i = n.query([N]), s = [], r = Math.min(e, 0.1);
  for (const a of o) {
    const l = n.getComponent(a, q);
    if (l.active)
      switch (l.mode || "continuous") {
        case "continuous": {
          l.timeSinceLast += r;
          const f = 1 / l.rate;
          for (; l.timeSinceLast >= f && i.length < t; )
            l.spawnParticle(n, a), l.timeSinceLast -= f;
          l.timeSinceLast > f && (l.timeSinceLast = 0);
          break;
        }
        case "burst": {
          if (l.timeSinceLast += r, l.timeSinceLast >= (l.burstDelay || 1)) {
            const f = l.burstCount || 10;
            for (let m = 0; m < f && i.length < t; m++)
              l.spawnParticle(n, a);
            l.timeSinceLast = 0;
          }
          break;
        }
        case "custom":
          (c = l.emitFn) == null || c.call(l, n, a, r);
          break;
      }
  }
  for (const a of i) {
    const l = n.getComponent(a, L);
    l.age += r, l.age >= l.value && s.push(a);
  }
  s.length > 0 && n.removeEntities(s);
}
const w = /* @__PURE__ */ new Map();
w.set("spiral", ({ world: n, entity: e, dt: t, params: o }) => {
  const i = n.getComponent(e, b), s = n.getComponent(e, L);
  if (!i || !s) return;
  const r = s.age, c = r * o.angularSpeed, a = o.radiusGrowth * r;
  i.x = o.originX + Math.cos(c) * a, i.y = o.originY + Math.sin(c) * a;
});
w.set("wave", ({ world: n, entity: e, dt: t, params: o }) => {
  const i = n.getComponent(e, b), s = n.getComponent(e, L);
  if (!i || !s) return;
  const r = s.age;
  i.x += o.speedX * t, i.y = o.originY + Math.sin(r * o.frequency) * o.amplitude;
});
w.set("drift", ({ world: n, entity: e, dt: t, params: o }) => {
  const i = n.getComponent(e, b);
  i && (i.x += (Math.random() - 0.5) * o.speed * t, i.y += (Math.random() - 0.5) * o.speed * t);
});
w.set("custom", ({ pos: n, dt: e, life: t, params: o }) => {
  var i;
  (i = o.fn) == null || i.call(o, n, e, t);
});
function te(n, e) {
  const t = n.query([O]);
  for (const o of t) {
    const i = n.getComponent(o, O), s = w.get(i.type);
    s && s({ world: n, entity: o, dt: e, params: i.params });
  }
}
function ne(n, e) {
  const t = n.query([b, I]);
  for (const o of t) {
    const i = n.getComponent(o, b), s = n.getComponent(o, I), r = n.getComponent(o, H);
    r && (s.dx += r.x * e, s.dy += r.y * e), i.x += s.dx * e, i.y += s.dy * e;
  }
}
const pe = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ChatSystem: W,
  HtmlRenderSystem: K,
  ParticleMovementSystem: te,
  ParticleSystem: ee,
  PhysicsSystem: ne,
  PingSystem: Z,
  SoundSystem: X,
  ToastSystem: Q
}, Symbol.toStringTag, { value: "Module" }));
function U(n) {
  return btoa(n).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function oe(n) {
  for (n = n.replace(/-/g, "+").replace(/_/g, "/"); n.length % 4; ) n += "=";
  return atob(n);
}
async function G(n, e) {
  const t = new TextEncoder(), o = await crypto.subtle.importKey(
    "raw",
    t.encode(n),
    { name: "HMAC", hash: "SHA-256" },
    !1,
    ["sign"]
  ), i = await crypto.subtle.sign("HMAC", o, t.encode(e));
  return U(String.fromCharCode(...new Uint8Array(i)));
}
async function ie(n, e) {
  const t = JSON.stringify(e), o = U(t), i = await G(n, o);
  return `${o}.${i}`;
}
async function se(n, e) {
  const [t, o] = e.split(".");
  if (!t || !o) throw new Error("Invalid token format");
  const i = await G(n, t);
  if (o !== i) throw new Error("Invalid token signature");
  const s = oe(t);
  return JSON.parse(s);
}
function re(n, e = ae) {
  if (typeof n != "string") return n;
  let t = n;
  for (const o of e) {
    const i = new RegExp(`\\b${ce(o)}\\b`, "gi");
    t = t.replace(i, "*".repeat(o.length));
  }
  return t;
}
const ae = ["fuck", "shit", "bitch", "bastard", "asshole"];
function ce(n) {
  return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const z = /* @__PURE__ */ (function() {
  const e = "pb-framework-loading-overlay";
  let t = !1;
  function o() {
    if (document.getElementById(e)) return;
    const r = document.createElement("div");
    r.id = e, r.style.cssText = [
      "position:fixed",
      "inset:0",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,0.35)",
      "z-index:9999",
      "visibility:hidden",
      "opacity:0",
      "transition:opacity .18s, visibility .18s"
    ].join(";"), r.innerHTML = `<div style="padding:14px 20px;border-radius:8px;display:flex;gap:12px;align-items:center;">
      <div style="width:18px;height:18px;border-radius:50%;border:3px solid #ccc;border-top-color:#333;animation:pbspin .8s linear infinite"></div>
      <div id="pb-loading-overlay-text">Loading…</div>
    </div>
    <style>@keyframes pbspin{to{transform:rotate(360deg)}}</style>`, document.body.appendChild(r);
  }
  function i(r = "Loading…") {
    o();
    const c = document.getElementById(e), a = c.querySelector("#pb-loading-overlay-text");
    a && (a.textContent = r), c.style.visibility = "visible", c.style.opacity = "1", t = !0;
  }
  function s() {
    const r = document.getElementById(e);
    !r || !t || (r.style.opacity = "0", setTimeout(() => {
      r && (r.style.visibility = "hidden");
    }, 200), t = !1);
  }
  return { show: i, hide: s };
})(), me = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  LoadingOverlay: z,
  cleanText: re,
  detokenise: se,
  tokenise: ie
}, Symbol.toStringTag, { value: "Module" }));
function le(n, e) {
  let t = e.query([P]);
  for (const o of t) {
    let i = e.getComponent(o, P);
    if (i.id == n)
      return i;
  }
  return null;
}
const he = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getById: le
}, Symbol.toStringTag, { value: "Module" }));
class k {
  /**
   * opts:
   *  - name: optional human name
   *  - htmlPath: path to fragment
   *  - onLoad: async (world, client, sceneManager) => cleanupFn|void
   *  - onUnload: optional (world, client) => void
   */
  constructor({ name: e, htmlPath: t, onLoad: o, onUnload: i } = {}) {
    if (!t) throw new Error("Scene requires htmlPath");
    this.name = e || t, this.htmlPath = t, this.onLoad = o, this.onUnload = i;
  }
}
class ye {
  constructor(e = "#ui-root", t = {}) {
    this.root = document.querySelector(e) || this._createRoot(e), this.currentScene = null, this.previousScene = null, this._currentCleanup = null, this.loading = !!t.loading, this.loadingDelay = t.loadingDelay || 120, this._loadingOverlay = this.loading ? z : null;
  }
  _createRoot(e) {
    const t = document.createElement("div");
    return t.id = e.replace(/^#/, ""), document.body.appendChild(t), t;
  }
  async load(e, t = {}) {
    const o = e instanceof k ? e : new k(e);
    this.currentScene && (this.previousScene = {
      scene: this.currentScene,
      context: this.currentContext
    });
    const i = (async () => {
      const a = await fetch(o.htmlPath);
      if (!a.ok) throw new Error(`Failed to load scene: ${o.htmlPath}`);
      return await a.text();
    })();
    let s = null, r = !1;
    this._loadingOverlay && (s = setTimeout(() => {
      this._loadingOverlay.show(), r = !0;
    }, this.loadingDelay)), await this.unload(!1, !1);
    const c = await i;
    if (s && clearTimeout(s), this.root.innerHTML = c, this.currentScene = o, this.currentContext = t, o.onLoad) {
      const a = await o.onLoad(t, this);
      typeof a == "function" ? this._currentCleanup = a : this._currentCleanup = null;
    }
    r && this._loadingOverlay && this._loadingOverlay.hide();
  }
  async unload(e = !0, t = !0) {
    if (this._currentCleanup) {
      try {
        await this._currentCleanup();
      } catch (o) {
        console.warn("Scene cleanup failed", o);
      }
      this._currentCleanup = null;
    }
    if (this.currentScene && typeof this.currentScene.onUnload == "function")
      try {
        await this.currentScene.onUnload();
      } catch (o) {
        console.warn("scene onUnload error", o);
      }
    t && (this.root.innerHTML = ""), this.currentScene = null, e && (this.previousScene = null);
  }
  async goBack() {
    if (this.previousScene) {
      const { scene: e, context: t } = this.previousScene;
      return this.previousScene = null, this.load(e, t);
    }
  }
}
function ge({ world: n, network: e, isHost: t = !1 }) {
  const o = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
  let r = 0;
  const c = /* @__PURE__ */ new Map();
  function a(u, d) {
    o.set(u, d);
  }
  function l(u, d) {
    s.set(u, d);
  }
  function f(u, d) {
    i.set(u, d);
  }
  function m(u, d, y = {}) {
    const g = i.get(u), p = g ? g(d) : { action: u, payload: d };
    if (p.seq = ++r, p.clientEntityId = n.clientEntityId || e.id, !t && y.predict) {
      const C = o.get(u);
      C && C({ world: n, payload: d, clientId: e.id, predicted: !0, seq: p.seq });
      const h = `${p.clientEntityId}:${p.seq}`;
      c.set(h, p);
    }
    e.send({
      type: "sync",
      action: p.action,
      payload: p.payload,
      seq: p.seq,
      clientEntityId: p.clientEntityId
      // ✅ send it out
    });
  }
  function S(u, d, y = {}, g, p) {
    if (!t) {
      console.warn("[SyncSystem] broadcast() is host-only");
      return;
    }
    if (typeof e.broadcast != "function") {
      console.warn("[SyncSystem] network.broadcast not implemented");
      return;
    }
    e.broadcast({
      type: "sync",
      action: u,
      payload: d,
      seq: g,
      clientEntityId: p
      // ✅ or pass the original clientEntityId if you have it
    }, y);
  }
  function F(u, d, y) {
    console.log(u), e.send(u, {
      type: "sync",
      action: d,
      payload: y
    });
  }
  e.on("sync", ({ clientId: u, clientEntityId: d, action: y, payload: g, seq: p }) => {
    const C = o.get(y);
    if (C)
      if (t) {
        const h = C({ world: n, payload: g, clientId: u });
        if (!h || h.valid === !1) {
          e.send(u, {
            type: "sync-error",
            error: {
              action: y,
              // the original action type that failed
              reason: (h == null ? void 0 : h.reason) || "Invalid action",
              seq: p,
              // optional: sequence number
              payload: g
              // optional: original payload
            }
          });
          return;
        }
        h && h.broadcast !== !1 && S(h.action, h.payload ?? g, h.opts, p, d);
      } else {
        C({ world: n, payload: g, clientId: u, confirmed: !0, seq: p });
        const h = `${d}:${p}`;
        if (console.log(h), c.has(h)) {
          c.delete(h);
          for (const [V, $] of c.entries()) {
            const [D, j] = V.split(":");
            if (D === d && Number(j) > Number(p)) {
              const B = o.get($.action);
              B && B({
                world: n,
                payload: $.payload,
                clientId: u,
                predicted: !0,
                seq: Number(j),
                clientEntityId: D
              });
            }
          }
        }
      }
  }), e.on("sync-error", ({ clientId: u, error: d }) => {
    const y = s.get(d.action);
    y && y({ world: n, clientId: u, ...d });
  });
  function Y(u, d) {
  }
  const T = Object.assign(Y, {
    send: m,
    onAction: a,
    onError: l,
    registerAction: f
  });
  return t && (T.broadcast = S, T.sendTo = F), T;
}
export {
  fe as Components,
  de as GameLoop,
  w as Kinematics,
  k as Scene,
  ye as SceneManager,
  ge as SyncSystem,
  pe as Systems,
  he as User,
  me as Utils,
  ue as World
};
