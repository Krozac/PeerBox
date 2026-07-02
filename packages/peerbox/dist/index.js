class fe {
  constructor({ idGenerator: e } = {}) {
    this.entities = /* @__PURE__ */ new Map(), this.updateSystems = [], this.renderSystems = [], this.components = /* @__PURE__ */ new Map(), this.nextEntityId = 1, this._idGenerator = e || (() => this.nextEntityId++), this._listeners = /* @__PURE__ */ new Map();
  }
  // --- Event emitter API ---
  on(e, n) {
    this._listeners.has(e) || this._listeners.set(e, /* @__PURE__ */ new Set()), this._listeners.get(e).add(n);
  }
  off(e, n) {
    var t;
    (t = this._listeners.get(e)) == null || t.delete(n);
  }
  emit(e, n) {
    var t;
    (t = this._listeners.get(e)) == null || t.forEach((i) => i(n));
  }
  // --- ECS API ---
  clear() {
    this.entities.clear(), this.components.clear(), this.nextEntityId = 1, this.emit("clear");
  }
  createEntity(e = {}) {
    const n = this._idGenerator();
    this.entities.set(n, !0), this.components.set(n, /* @__PURE__ */ new Map());
    for (const [t, i] of Object.entries(e))
      this.addComponent(n, t, i);
    return this.emit("entityCreated", n), n;
  }
  getEntities() {
    return Array.from(this.entities.keys());
  }
  getEntitiesWithComponent(e) {
    return this.getEntities().filter((n) => {
      var t;
      return (t = this.components.get(n)) == null ? void 0 : t.has(e);
    });
  }
  addComponent(e, n, t) {
    this.components.get(e).set(n, t), this.emit("componentAdded", { entityId: e, name: n, data: t });
  }
  removeComponent(e, n) {
    var t;
    (t = this.components.get(e)) == null || t.delete(n), this.emit("componentRemoved", { entityId: e, name: n });
  }
  getComponent(e, n) {
    var t;
    return (t = this.components.get(e)) == null ? void 0 : t.get(n);
  }
  query(e) {
    return Array.from(this.entities.keys()).filter((n) => {
      const t = this.components.get(n);
      return e.every((i) => t == null ? void 0 : t.has(i));
    });
  }
  removeEntities(e) {
    for (const n of e)
      this.entities.delete(n), this.components.delete(n), this.emit("entityRemoved", n);
  }
  registerSystem(e, { type: n = "update" } = {}) {
    n === "render" ? this.renderSystems.push(e) : this.updateSystems.push(e), this.emit("systemRegistered", e);
  }
  update(e) {
    for (const n of this.updateSystems)
      n(this, e);
    this.emit("update", e);
  }
  render(e) {
    for (const n of this.renderSystems)
      n(this, e);
    this.emit("render", e);
  }
}
const pe = /* @__PURE__ */ (() => {
  let o = !1, e = 0, n = null;
  const t = 100;
  let i = null, s = null;
  function c(p) {
    if (!o) return;
    e || (e = p);
    const h = p - e;
    if (h > t) {
      i && i(h), e = p, n = requestAnimationFrame(c);
      return;
    }
    const b = h / 1e3;
    i && i(b), s && s(b), e = p, n = requestAnimationFrame(c);
  }
  function r({ onUpdate: p, onRender: h, targetFps: b = 60 }) {
    o || (i = p, s = h, o = !0, e = 0, n = requestAnimationFrame(c));
  }
  function l() {
    o && (o = !1, n && (cancelAnimationFrame(n), n = null));
  }
  function a() {
    return o;
  }
  return {
    start: r,
    stop: l,
    isRunning: a
  };
})();
function M({ id: o, classes: e = [], style: n = {}, html: t = "" } = {}) {
  return {
    id: o,
    classes: e,
    style: n,
    html: t,
    parentSelector
    // Don't include `element` in the component itself!
  };
}
function q({ id: o, name: e = "Default User", connected: n = !0 }) {
  return {
    id: o,
    name: e,
    role: "client",
    // Default role, can be 'host' or 'client'
    connected: n
  };
}
function L({ duration: o = 3e3, type: e = "info" } = {}) {
  return {
    duration: o,
    type: e
  };
}
function C({ x: o = 0, y: e = 0 }) {
  return {
    x: o,
    y: e
  };
}
function K({ chatId: o, chatName: e = "Default Chat" }) {
  return {
    chatId: o,
    chatName: e,
    messages: []
    // optional: could track message entity IDs here
  };
}
function H({ username: o, message: e, timestamp: n = Date.now(), chatId: t = "default", autoScroll: i = !0 } = {}) {
  return {
    username: o,
    message: e,
    timestamp: n,
    chatId: t,
    autoScroll: i
  };
}
function T({ url: o, volume: e = 1, loop: n = !1 }) {
  return {
    url: o,
    // URL of the audio file
    buffer: null,
    // AudioBuffer after loading
    volume: e,
    loop: n
  };
}
function D() {
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
    spawnParticle: (o, e) => {
    }
  };
}
function P() {
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
function $({ type: o, params: e }) {
  return {
    type: o,
    params: e
  };
}
function N({ x: o = 0, y: e = 9.81 }) {
  return {
    x: o,
    // gravity direction or force on X
    y: e
    // gravity force on Y
  };
}
const F = "ParticleTag", me = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ChatComponent: K,
  ChatMessageComponent: H,
  GravityComponent: N,
  HtmlRenderComponent: M,
  LifetimeComponent: P,
  MovementPatternComponent: $,
  ParticleEmitterComponent: D,
  ParticleTag: F,
  PositionComponent: C,
  SoundComponent: T,
  ToastComponent: L,
  VelocityComponent: I,
  userComponent: q
}, Symbol.toStringTag, { value: "Module" })), _ = /* @__PURE__ */ new Map();
function X(o, e = "#ui-root") {
  const n = new Set(o.query([M]));
  for (const [t, i] of _.entries())
    n.has(t) || (i.parentElement && i.parentElement.removeChild(i), _.delete(t));
  for (const t of n) {
    const i = o.getComponent(t, M);
    if (!i) continue;
    let s = _.get(t);
    s || (s = document.createElement(i.tagName || "div"), _.set(t, s));
    const c = i.parentSelector || e, r = document.querySelector(c);
    if (!r)
      continue;
    (!s.parentElement || s.parentElement !== r) && r.appendChild(s), i.id && s.id !== i.id && (s.id = i.id), i.classes && (s.className = "", s.classList.add(...i.classes)), i.style && Object.assign(s.style, i.style), i.html && s.innerHTML !== i.html && (s.innerHTML = i.html);
    const l = o.getComponent(t, C);
    l && (s.style.position = "absolute", s.style.left = l.x + "px", s.style.top = l.y + "px");
  }
}
function Q(o, e, n = {}) {
  const t = n.newMessageSound, i = n.newMessageVolume ?? 0.1, s = n.chatParentSelectorId ?? "#chatBox";
  document.addEventListener("datachannel-message", async (c) => {
    const { sender: r, message: l, timestamp: a = Date.now(), chatId: p = "default" } = c.detail, h = o.createEntity();
    if (o.addComponent(h, H, { username: r, message: l, timestamp: a, chatId: p }), o.addComponent(h, M, {
      tagName: "div",
      classes: [
        "pb-chat-message",
        r === "You" ? "pb-chat-message--self" : "pb-chat-message--other"
      ],
      html: `<strong>${r}:</strong> ${l}`,
      parentSelector: s
    }), r !== "You" && e && t) {
      o.addComponent(h, T, { url: t, volume: i, loop: !1 });
      const b = o.getComponent(h, T);
      await e.loadSound(h, b), e.playSound(h);
    }
  });
}
function Z(o) {
  const e = new (window.AudioContext || window.webkitAudioContext)(), n = /* @__PURE__ */ new Map();
  async function t(c, r) {
    const a = await (await fetch(r.url)).arrayBuffer();
    r.buffer = await e.decodeAudioData(a);
  }
  function i(c) {
    const r = o.getComponent(c, T);
    if (!r || !r.buffer) return;
    const l = e.createBufferSource();
    l.buffer = r.buffer, l.loop = r.loop;
    const a = e.createGain();
    a.gain.value = r.volume, l.connect(a).connect(e.destination), l.start(0), n.set(c, { source: l, gain: a });
  }
  function s(c) {
    const r = n.get(c);
    r && (r.source.stop(), n.delete(c));
  }
  return { loadSound: t, playSound: i, stopSound: s };
}
const w = /* @__PURE__ */ new Map();
function z(o) {
  z.listenerAdded || (z.listenerAdded = !0, window.addEventListener("toast", (e) => {
    const { message: n, duration: t, parentSelector: i, type: s } = e.detail, c = o.createEntity();
    o.addComponent(c, L, { duration: t, remainingTime: t, type: s || "info" }), o.addComponent(c, M, {
      html: n,
      classes: ["pb-toast", `pb-toast--${s || "info"}`],
      parentSelector: i || "#toast-container"
    });
  }));
}
function ee(o, e) {
  const n = o.query([L]);
  z(o);
  for (const t of n) {
    const i = o.getComponent(t, L);
    if (!i) continue;
    w.has(t) || w.set(t, i.duration ?? 3e3);
    const s = w.get(t) - e;
    s <= 0 ? (o.removeEntities([t]), w.delete(t)) : w.set(t, s);
  }
}
function te(o, e = {}) {
  const n = e.interval || 2e3;
  let t = 0, i = 0;
  const s = /* @__PURE__ */ new Map();
  return (c, r) => {
    if (o._pingBound || (o.on("pong", (l) => {
      if (s.has(l.id)) {
        const a = s.get(l.id), p = Date.now() - a;
        s.delete(l.id), console.log("RTT ", p), c.emit("ping-update", { rtt: p, id: l.id });
      }
    }), o._pingBound = !0), t += r, t >= n) {
      t = 0;
      const l = i++;
      s.set(l, Date.now()), o.send({ type: "ping", id: l });
    }
  };
}
function ne(o, e, { MAX: n = 1e3 } = {}) {
  var r;
  const t = o.query([D]), i = o.query([F]), s = [], c = Math.min(e, 0.1);
  for (const l of t) {
    const a = o.getComponent(l, D);
    if (a.active)
      switch (a.mode || "continuous") {
        case "continuous": {
          a.timeSinceLast += c;
          const p = 1 / a.rate;
          for (; a.timeSinceLast >= p && i.length < n; )
            a.spawnParticle(o, l), a.timeSinceLast -= p;
          a.timeSinceLast > p && (a.timeSinceLast = 0);
          break;
        }
        case "burst": {
          if (a.timeSinceLast += c, a.timeSinceLast >= (a.burstDelay || 1)) {
            const p = a.burstCount || 10;
            for (let h = 0; h < p && i.length < n; h++)
              a.spawnParticle(o, l);
            a.timeSinceLast = 0;
          }
          break;
        }
        case "custom":
          (r = a.emitFn) == null || r.call(a, o, l, c);
          break;
      }
  }
  for (const l of i) {
    const a = o.getComponent(l, P);
    a.age += c, a.age >= a.value && s.push(l);
  }
  s.length > 0 && o.removeEntities(s);
}
const E = /* @__PURE__ */ new Map();
E.set("spiral", ({ world: o, entity: e, dt: n, params: t }) => {
  const i = o.getComponent(e, C), s = o.getComponent(e, P);
  if (!i || !s) return;
  const c = s.age, r = c * t.angularSpeed, l = t.radiusGrowth * c;
  i.x = t.originX + Math.cos(r) * l, i.y = t.originY + Math.sin(r) * l;
});
E.set("wave", ({ world: o, entity: e, dt: n, params: t }) => {
  const i = o.getComponent(e, C), s = o.getComponent(e, P);
  if (!i || !s) return;
  const c = s.age;
  i.x += t.speedX * n, i.y = t.originY + Math.sin(c * t.frequency) * t.amplitude;
});
E.set("drift", ({ world: o, entity: e, dt: n, params: t }) => {
  const i = o.getComponent(e, C);
  i && (i.x += (Math.random() - 0.5) * t.speed * n, i.y += (Math.random() - 0.5) * t.speed * n);
});
E.set("custom", ({ pos: o, dt: e, life: n, params: t }) => {
  var i;
  (i = t.fn) == null || i.call(t, o, e, n);
});
function oe(o, e) {
  const n = o.query([$]);
  for (const t of n) {
    const i = o.getComponent(t, $), s = E.get(i.type);
    s && s({ world: o, entity: t, dt: e, params: i.params });
  }
}
function ie(o, e) {
  const n = o.query([C, I]);
  for (const t of n) {
    const i = o.getComponent(t, C), s = o.getComponent(t, I), c = o.getComponent(t, N);
    c && (s.dx += c.x * e, s.dy += c.y * e), i.x += s.dx * e, i.y += s.dy * e;
  }
}
const he = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ChatSystem: Q,
  HtmlRenderSystem: X,
  ParticleMovementSystem: oe,
  ParticleSystem: ne,
  PhysicsSystem: ie,
  PingSystem: te,
  SoundSystem: Z,
  ToastSystem: ee
}, Symbol.toStringTag, { value: "Module" }));
function U(o) {
  return btoa(o).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function se(o) {
  for (o = o.replace(/-/g, "+").replace(/_/g, "/"); o.length % 4; ) o += "=";
  return atob(o);
}
async function G(o, e) {
  const n = new TextEncoder(), t = await crypto.subtle.importKey(
    "raw",
    n.encode(o),
    { name: "HMAC", hash: "SHA-256" },
    !1,
    ["sign"]
  ), i = await crypto.subtle.sign("HMAC", t, n.encode(e));
  return U(String.fromCharCode(...new Uint8Array(i)));
}
async function re(o, e) {
  const n = JSON.stringify(e), t = U(n), i = await G(o, t);
  return `${t}.${i}`;
}
async function ae(o, e) {
  const n = e.split(".");
  if (n.length !== 2) throw new Error("Invalid token format");
  const [t, i] = n, s = await G(o, t);
  if (i !== s) throw new Error("Invalid token signature");
  const c = se(t);
  return JSON.parse(c);
}
const ce = /[\u200B-\u200D\uFEFF]/g;
function le(o) {
  const n = o.map(B).map((t) => ({
    word: t,
    regex: new RegExp(`(?<!\\p{L})${ue(t)}(?!\\p{L})`, "giu")
  }));
  return function(i) {
    if (typeof i != "string") return i;
    let s = B(i);
    for (const { word: c, regex: r } of n)
      s = s.replace(r, "*".repeat(c.length));
    return s;
  };
}
function B(o) {
  return o.normalize("NFD").replace(ce, "").replace(/(.)\1{2,}/g, "$1$1");
}
function ue(o) {
  return o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const W = /* @__PURE__ */ (function() {
  const e = "pb-framework-loading-overlay";
  let n = !1, t = null;
  function i(r) {
    if (t = r || document.body, document.getElementById(e)) return;
    const l = document.createElement("div");
    l.id = e, l.style.cssText = [
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
    ].join(";"), l.innerHTML = `<div style="padding:14px 20px;border-radius:8px;display:flex;gap:12px;align-items:center;">
      <div style="width:18px;height:18px;border-radius:50%;border:3px solid #ccc;border-top-color:#333;animation:pbspin .8s linear infinite"></div>
      <div id="pb-loading-overlay-text">Loading…</div>
    </div>
    <style>@keyframes pbspin{to{transform:rotate(360deg)}}</style>`, t.appendChild(l);
  }
  function s(r = "Loading…", l) {
    i(l);
    const a = document.getElementById(e), p = a.querySelector("#pb-loading-overlay-text");
    p && (p.textContent = r), a.style.visibility = "visible", a.style.opacity = "1", n = !0;
  }
  function c() {
    const r = document.getElementById(e);
    !r || !n || (r.style.opacity = "0", setTimeout(() => {
      r && (r.style.visibility = "hidden");
    }, 200), n = !1);
  }
  return { show: s, hide: c };
})(), ge = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  LoadingOverlay: W,
  createTextCleaner: le,
  detokenise: ae,
  tokenise: re
}, Symbol.toStringTag, { value: "Module" }));
function de(o, e) {
  let n = e.query([q]);
  for (const t of n)
    if (e.getComponent(t, q).id == o)
      return t;
  return null;
}
const ye = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getById: de
}, Symbol.toStringTag, { value: "Module" }));
class R {
  /**
   * opts:
   *  - name: optional human name
   *  - htmlPath: path to fragment
   *  - onLoad: async (world, client, sceneManager) => cleanupFn|void
   *  - onUnload: optional (world, client) => void
   */
  constructor({ name: e, htmlPath: n, onLoad: t, onUnload: i } = {}) {
    if (!n) throw new Error("Scene requires htmlPath");
    this.name = e || n, this.htmlPath = n, this.onLoad = t, this.onUnload = i;
  }
}
class Se {
  constructor(e = "#ui-root", n = {}) {
    this.root = document.querySelector(e) || this._createRoot(e), this.currentScene = null, this.previousScene = null, this._currentCleanup = null, this.transitionManager = n.transitionManager || null, this.loading = !!n.loading, this.loadingDelay = n.loadingDelay || 120, this._loadingOverlay = this.loading ? W : null;
  }
  _createRoot(e) {
    const n = document.createElement("div");
    return n.id = e.replace(/^#/, ""), document.body.appendChild(n), n;
  }
  async load(e, n = {}, t = null) {
    const i = e instanceof R ? e : new R(e);
    this.currentScene && (this.previousScene = {
      scene: this.currentScene,
      context: this.currentContext
    });
    const s = (async () => {
      const a = await fetch(i.htmlPath);
      if (!a.ok) throw new Error(`Failed to load scene: ${i.htmlPath}`);
      return await a.text();
    })();
    let c = null, r = !1;
    this._loadingOverlay && (c = setTimeout(() => {
      this._loadingOverlay.show(), r = !0;
    }, this.loadingDelay)), console.log("transitionManager  : ", this.transitionManager), this.transitionManager && await this.transitionManager.out(
      t,
      this.root
    ), await this.unload(!1, !1);
    const l = await s;
    if (c && clearTimeout(c), this.root.innerHTML = l, this.currentScene = i, this.currentContext = n, i.onLoad) {
      const a = await i.onLoad(n, this);
      typeof a == "function" ? this._currentCleanup = a : this._currentCleanup = null;
    }
    r && this._loadingOverlay && this._loadingOverlay.hide(), this.transitionManager && this.transitionManager.in(
      t,
      this.root
    ).catch(console.error);
  }
  async unload(e = !0, n = !0) {
    if (this._currentCleanup) {
      try {
        await this._currentCleanup();
      } catch (t) {
        console.warn("Scene cleanup failed", t);
      }
      this._currentCleanup = null;
    }
    if (this.currentScene && typeof this.currentScene.onUnload == "function")
      try {
        await this.currentScene.onUnload();
      } catch (t) {
        console.warn("scene onUnload error", t);
      }
    n && (this.root.innerHTML = ""), this.currentScene = null, e && (this.previousScene = null);
  }
  async goBack(e = null) {
    if (this.previousScene) {
      const { scene: n, context: t } = this.previousScene;
      return this.previousScene = null, this.load(n, t, e);
    }
  }
}
class be {
  constructor() {
    this.transitions = /* @__PURE__ */ new Map();
  }
  register(e, n) {
    this.transitions.set(e, n), console.log("transitions :", this.transitions);
  }
  async out(e, n) {
    console.log("executing out transition :", e);
    const t = this.transitions.get(e);
    console.log(t), t != null && t.out && await t.out(n);
  }
  async in(e, n) {
    const t = this.transitions.get(e);
    t != null && t.in && await t.in(n);
  }
}
function ve({ world: o, network: e, isHost: n = !1 }) {
  const t = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map();
  let c = 0;
  const r = /* @__PURE__ */ new Map();
  function l(u, f, { key: y } = {}) {
    t.has(u) || t.set(u, /* @__PURE__ */ new Map());
    const g = t.get(u), d = y || f;
    return g.set(d, f), () => {
      g.delete(d);
    };
  }
  function a(u, f, { key: y } = {}) {
    s.has(u) || s.set(u, /* @__PURE__ */ new Map());
    const g = s.get(u), d = y || f;
    return g.set(d, f), () => {
      g.delete(d);
    };
  }
  function p(u, f) {
    i.set(u, f);
  }
  function h(u, f, y = {}) {
    const g = i.get(u), d = g ? g(f) : { action: u, payload: f };
    if (d.seq = ++c, d.clientEntityId = o.clientEntityId || e.id, !n && y.predict) {
      const S = t.get(d.action);
      if (!S || S.size === 0) return;
      for (const v of S.values())
        v({ world: o, payload: f, clientId: e.id, predicted: !0, seq: d.seq });
      const m = `${d.clientEntityId}:${d.seq}`;
      r.set(m, d);
    }
    e.send({
      type: "sync",
      action: d.action,
      payload: d.payload,
      seq: d.seq,
      clientEntityId: d.clientEntityId
      // ✅ send it out
    });
  }
  function b(u, f, y = {}, g, d, S) {
    if (!n) {
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
      payload: f,
      seq: g,
      clientEntityId: d,
      // ✅ or pass the original clientEntityId if you have it
      clientId: S
    }, y);
  }
  function Y(u, f, y) {
    console.log(u), e.send(u, {
      type: "sync",
      action: f,
      payload: y
    });
  }
  e.on("sync", ({ clientId: u, clientEntityId: f, action: y, payload: g, seq: d }) => {
    const S = t.get(y);
    if (!(!S || S.size === 0))
      if (n) {
        let m;
        for (const v of S.values()) {
          const x = v({ world: o, payload: g, clientId: u, seq: d });
          x !== void 0 && m === void 0 && (m = x);
        }
        if (!m || m.valid === !1) {
          e.send(u, {
            type: "sync-error",
            error: {
              action: y,
              // the original action type that failed
              reason: (m == null ? void 0 : m.reason) || "Invalid action",
              seq: d,
              // optional: sequence number
              payload: g
              // optional: original payload
            }
          });
          return;
        }
        m && m.broadcast !== !1 && b(m.action, m.payload ?? g, m.opts, d, f, u);
      } else {
        for (const v of S.values())
          v({
            world: o,
            payload: g,
            clientId: u,
            confirmed: !0,
            seq: d
          });
        const m = `${f}:${d}`;
        if (console.log(m), r.has(m)) {
          r.delete(m);
          for (const [v, x] of r.entries()) {
            const [j, k] = v.split(":");
            if (j === f && Number(k) > Number(d)) {
              const O = t.get(x.action);
              if (!O || O.size === 0) continue;
              for (const J of O.values())
                J({
                  world: o,
                  payload: x.payload,
                  clientId: u,
                  predicted: !0,
                  seq: Number(k),
                  clientEntityId: j
                });
            }
          }
        }
      }
  }), e.on("sync-error", ({ clientId: u, error: f }) => {
    const y = s.get(f.action);
    if (!(!y || y.size === 0))
      for (const g of y.values())
        g({ world: o, clientId: u, ...f });
  });
  function V(u, f) {
  }
  const A = Object.assign(V, {
    send: h,
    onAction: l,
    onError: a,
    registerAction: p
  });
  return n && (A.broadcast = b, A.sendTo = Y), A;
}
export {
  me as Components,
  pe as GameLoop,
  E as Kinematics,
  R as Scene,
  Se as SceneManager,
  ve as SyncSystem,
  he as Systems,
  be as TransitionManager,
  ye as User,
  ge as Utils,
  fe as World
};
