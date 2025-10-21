"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
class World {
  constructor({ idGenerator } = {}) {
    this.entities = /* @__PURE__ */ new Map();
    this.updateSystems = [];
    this.renderSystems = [];
    this.components = /* @__PURE__ */ new Map();
    this.nextEntityId = 1;
    this._idGenerator = idGenerator || (() => this.nextEntityId++);
    this._listeners = /* @__PURE__ */ new Map();
  }
  // --- Event emitter API ---
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, /* @__PURE__ */ new Set());
    }
    this._listeners.get(event).add(callback);
  }
  off(event, callback) {
    var _a;
    (_a = this._listeners.get(event)) == null ? void 0 : _a.delete(callback);
  }
  emit(event, data) {
    var _a;
    (_a = this._listeners.get(event)) == null ? void 0 : _a.forEach((cb) => cb(data));
  }
  // --- ECS API ---
  clear() {
    this.entities.clear();
    this.components.clear();
    this.nextEntityId = 1;
    this.emit("clear");
  }
  createEntity(initialComponents = {}) {
    const id = this._idGenerator();
    this.entities.set(id, true);
    this.components.set(id, /* @__PURE__ */ new Map());
    for (const [name, value] of Object.entries(initialComponents)) {
      this.addComponent(id, name, value);
    }
    this.emit("entityCreated", id);
    return id;
  }
  addComponent(entityId, name, data) {
    this.components.get(entityId).set(name, data);
    this.emit("componentAdded", { entityId, name, data });
  }
  getComponent(entityId, name) {
    var _a;
    return (_a = this.components.get(entityId)) == null ? void 0 : _a.get(name);
  }
  query(componentNames) {
    return Array.from(this.entities.keys()).filter((id) => {
      const comps = this.components.get(id);
      return componentNames.every((name) => comps == null ? void 0 : comps.has(name));
    });
  }
  removeEntities(entityIds) {
    for (const id of entityIds) {
      this.entities.delete(id);
      this.components.delete(id);
      this.emit("entityRemoved", id);
    }
  }
  registerSystem(systemFn, { type = "update" } = {}) {
    if (type === "render") this.renderSystems.push(systemFn);
    else this.updateSystems.push(systemFn);
    this.emit("systemRegistered", systemFn);
  }
  update(deltaTime) {
    for (const system of this.updateSystems) {
      system(this, deltaTime);
    }
    this.emit("update", deltaTime);
  }
  render(deltaTime) {
    for (const system of this.renderSystems) {
      system(this, deltaTime);
    }
    this.emit("render", deltaTime);
  }
}
const GameLoop = /* @__PURE__ */ (() => {
  let running = false;
  let lastTime = 0;
  let frameId = null;
  const maxLag = 100;
  let updateCallback = null;
  let renderCallback = null;
  function loop(timestamp) {
    if (!running) return;
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    if (delta > maxLag) {
      updateCallback && updateCallback(delta);
      lastTime = timestamp;
      frameId = requestAnimationFrame(loop);
      return;
    }
    const dt = delta / 1e3;
    updateCallback && updateCallback(dt);
    renderCallback && renderCallback(dt);
    lastTime = timestamp;
    frameId = requestAnimationFrame(loop);
  }
  function start({ onUpdate, onRender, targetFps = 60 }) {
    if (running) return;
    updateCallback = onUpdate;
    renderCallback = onRender;
    running = true;
    lastTime = 0;
    frameId = requestAnimationFrame(loop);
  }
  function stop() {
    if (!running) return;
    running = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }
  function isRunning() {
    return running;
  }
  return {
    start,
    stop,
    isRunning
  };
})();
function HtmlRenderComponent({ id, classes = [], style = {}, html = "" } = {}) {
  return {
    id,
    classes,
    style,
    html,
    parentSelector
    // Don't include `element` in the component itself!
  };
}
function userComponent({ id, name = "Default User" }) {
  return {
    id,
    name,
    role: "client"
    // Default role, can be 'host' or 'client'
  };
}
function ToastComponent({ duration = 3e3, type = "info" } = {}) {
  return {
    duration,
    type
  };
}
function PositionComponent({ x = 0, y = 0 }) {
  return {
    x,
    y
  };
}
function ChatComponent({ chatId, chatName = "Default Chat" }) {
  return {
    chatId,
    chatName,
    messages: []
    // optional: could track message entity IDs here
  };
}
function ChatMessageComponent({ username, message, timestamp = Date.now(), chatId = "default", autoScroll = true } = {}) {
  return {
    username,
    message,
    timestamp,
    chatId,
    autoScroll
  };
}
function SoundComponent({ url, volume = 1, loop = false }) {
  return {
    url,
    // URL of the audio file
    buffer: null,
    // AudioBuffer after loading
    volume,
    loop
  };
}
function ParticleEmitterComponent() {
  return {
    rate: 50,
    // particles per second
    burst: 0,
    // optional: emit N particles instantly
    timeSinceLast: 0,
    // internal timer
    maxParticles: 200,
    active: true,
    // Particle definition function (data-driven)
    spawnParticle: (world, emitterEntity) => {
    }
  };
}
function LifetimeComponent() {
  return {
    value: 2,
    age: 0
  };
}
function VelocityComponent() {
  return {
    dx,
    dy
  };
}
function MovementPatternComponent({ type, params }) {
  return {
    type,
    params
  };
}
function GravityComponent({ x = 0, y = 9.81 }) {
  return {
    x,
    // gravity direction or force on X
    y
    // gravity force on Y
  };
}
const ParticleTag = "ParticleTag";
const index$2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ChatComponent,
  ChatMessageComponent,
  GravityComponent,
  HtmlRenderComponent,
  LifetimeComponent,
  MovementPatternComponent,
  ParticleEmitterComponent,
  ParticleTag,
  PositionComponent,
  SoundComponent,
  ToastComponent,
  VelocityComponent,
  userComponent
}, Symbol.toStringTag, { value: "Module" }));
const renderedElements = /* @__PURE__ */ new Map();
function HtmlRenderSystem(world, defaultParentSelector = "#ui-root") {
  const currentEntityIds = new Set(world.query([HtmlRenderComponent]));
  for (const [entityId, el] of renderedElements.entries()) {
    if (!currentEntityIds.has(entityId)) {
      if (el.parentElement) el.parentElement.removeChild(el);
      renderedElements.delete(entityId);
    }
  }
  for (const id of currentEntityIds) {
    const htmlRenderComponent = world.getComponent(id, HtmlRenderComponent);
    if (!htmlRenderComponent) continue;
    let el = renderedElements.get(id);
    if (!el) {
      el = document.createElement(htmlRenderComponent.tagName || "div");
      renderedElements.set(id, el);
    }
    const parentSelector2 = htmlRenderComponent.parentSelector || defaultParentSelector;
    const parent = document.querySelector(parentSelector2);
    if (!parent) {
      console.warn(`HtmlRenderSystem: No element found for selector ${parentSelector2}`);
      continue;
    }
    if (!el.parentElement || el.parentElement !== parent) {
      parent.appendChild(el);
    }
    if (htmlRenderComponent.id && el.id !== htmlRenderComponent.id) {
      el.id = htmlRenderComponent.id;
    }
    if (htmlRenderComponent.classes) {
      el.className = "";
      el.classList.add(...htmlRenderComponent.classes);
    }
    if (htmlRenderComponent.style) {
      Object.assign(el.style, htmlRenderComponent.style);
    }
    if (htmlRenderComponent.html && el.innerHTML !== htmlRenderComponent.html) {
      el.innerHTML = htmlRenderComponent.html;
    }
    const pos = world.getComponent(id, PositionComponent);
    if (pos) {
      el.style.position = "absolute";
      el.style.left = pos.x + "px";
      el.style.top = pos.y + "px";
    }
  }
}
function ChatSystem(ecs, soundSystem, config = {}) {
  const newMessageSound = config.newMessageSound;
  const newMessageVolume = config.newMessageVolume ?? 0.1;
  const chatParentSelectorId = config.chatParentSelectorId ?? "#chatBox";
  document.addEventListener("datachannel-message", async (e) => {
    const { sender, message, timestamp = Date.now(), chatId = "default" } = e.detail;
    const entity = ecs.createEntity();
    ecs.addComponent(entity, ChatMessageComponent, { username: sender, message, timestamp, chatId });
    ecs.addComponent(entity, HtmlRenderComponent, {
      tagName: "div",
      classes: [
        "pb-chat-message",
        sender === "You" ? "pb-chat-message--self" : "pb-chat-message--other"
      ],
      html: `<strong>${sender}:</strong> ${message}`,
      parentSelector: chatParentSelectorId
    });
    if (sender !== "You" && soundSystem && newMessageSound) {
      ecs.addComponent(entity, SoundComponent, { url: newMessageSound, volume: newMessageVolume, loop: false });
      const soundComp = ecs.getComponent(entity, SoundComponent);
      await soundSystem.loadSound(entity, soundComp);
      soundSystem.playSound(entity);
    }
  });
}
function SoundSystem(ecs) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const gainNodes = /* @__PURE__ */ new Map();
  async function loadSound(entity, soundComp) {
    const response = await fetch(soundComp.url);
    const arrayBuffer = await response.arrayBuffer();
    soundComp.buffer = await audioCtx.decodeAudioData(arrayBuffer);
  }
  function playSound(entity) {
    const soundComp = ecs.getComponent(entity, SoundComponent);
    if (!soundComp || !soundComp.buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = soundComp.buffer;
    source.loop = soundComp.loop;
    const gain = audioCtx.createGain();
    gain.gain.value = soundComp.volume;
    source.connect(gain).connect(audioCtx.destination);
    source.start(0);
    gainNodes.set(entity, { source, gain });
  }
  function stopSound(entity) {
    const nodes = gainNodes.get(entity);
    if (nodes) {
      nodes.source.stop();
      gainNodes.delete(entity);
    }
  }
  return { loadSound, playSound, stopSound };
}
const toastTimers = /* @__PURE__ */ new Map();
function setupToastListener(world) {
  if (setupToastListener.listenerAdded) return;
  setupToastListener.listenerAdded = true;
  window.addEventListener("toast", (e) => {
    const { message, duration, parentSelector: parentSelector2, type } = e.detail;
    const id = world.createEntity();
    world.addComponent(id, ToastComponent, { duration, remainingTime: duration, type: type || "info" });
    world.addComponent(id, HtmlRenderComponent, {
      html: message,
      classes: ["pb-toast", `pb-toast--${type || "info"}`],
      parentSelector: parentSelector2 || "#toast-container"
    });
  });
}
function ToastSystem(world, dt) {
  const toastEntities = world.query([ToastComponent]);
  setupToastListener(world);
  for (const id of toastEntities) {
    const toast = world.getComponent(id, ToastComponent);
    if (!toast) continue;
    if (!toastTimers.has(id)) {
      toastTimers.set(id, toast.duration ?? 3e3);
    }
    const remaining = toastTimers.get(id) - dt;
    if (remaining <= 0) {
      world.removeEntities([id]);
      toastTimers.delete(id);
    } else {
      toastTimers.set(id, remaining);
    }
  }
}
function PingSystem(client, options = {}) {
  const interval = options.interval || 2e3;
  let lastPingSent = 0;
  let pingId = 0;
  const pending = /* @__PURE__ */ new Map();
  return (world, deltaTime) => {
    if (!client._pingBound) {
      client.on("pong", (msg) => {
        if (pending.has(msg.id)) {
          const sentAt = pending.get(msg.id);
          const rtt = Date.now() - sentAt;
          pending.delete(msg.id);
          console.log("RTT ", rtt);
          world.emit("ping-update", { rtt, id: msg.id });
        }
      });
      client._pingBound = true;
    }
    lastPingSent += deltaTime;
    if (lastPingSent >= interval) {
      lastPingSent = 0;
      const id = pingId++;
      pending.set(id, Date.now());
      client.send({ type: "ping", id });
    }
  };
}
function ParticleSystem(world, dt, { MAX = 1e3 } = {}) {
  var _a;
  const emitters = world.query([ParticleEmitterComponent]);
  const particles = world.query([ParticleTag]);
  const toRemove = [];
  const frameDt = Math.min(dt, 0.1);
  for (const emitter of emitters) {
    const comp = world.getComponent(emitter, ParticleEmitterComponent);
    if (!comp.active) continue;
    switch (comp.mode || "continuous") {
      case "continuous": {
        comp.timeSinceLast += frameDt;
        const interval = 1 / comp.rate;
        while (comp.timeSinceLast >= interval && particles.length < MAX) {
          comp.spawnParticle(world, emitter);
          comp.timeSinceLast -= interval;
        }
        if (comp.timeSinceLast > interval) comp.timeSinceLast = 0;
        break;
      }
      case "burst": {
        comp.timeSinceLast += frameDt;
        if (comp.timeSinceLast >= (comp.burstDelay || 1)) {
          const burstCount = comp.burstCount || 10;
          for (let i = 0; i < burstCount && particles.length < MAX; i++) {
            comp.spawnParticle(world, emitter);
          }
          comp.timeSinceLast = 0;
        }
        break;
      }
      case "custom":
        (_a = comp.emitFn) == null ? void 0 : _a.call(comp, world, emitter, frameDt);
        break;
    }
  }
  for (const p of particles) {
    const life = world.getComponent(p, LifetimeComponent);
    life.age += frameDt;
    if (life.age >= life.value) toRemove.push(p);
  }
  if (toRemove.length > 0) world.removeEntities(toRemove);
}
const Kinematics = /* @__PURE__ */ new Map();
Kinematics.set("spiral", ({ world, entity, dt, params }) => {
  const pos = world.getComponent(entity, PositionComponent);
  const life = world.getComponent(entity, LifetimeComponent);
  if (!pos || !life) return;
  const t = life.age;
  const angle = t * params.angularSpeed;
  const radius = params.radiusGrowth * t;
  pos.x = params.originX + Math.cos(angle) * radius;
  pos.y = params.originY + Math.sin(angle) * radius;
});
Kinematics.set("wave", ({ world, entity, dt, params }) => {
  const pos = world.getComponent(entity, PositionComponent);
  const life = world.getComponent(entity, LifetimeComponent);
  if (!pos || !life) return;
  const t = life.age;
  pos.x += params.speedX * dt;
  pos.y = params.originY + Math.sin(t * params.frequency) * params.amplitude;
});
Kinematics.set("drift", ({ world, entity, dt, params }) => {
  const pos = world.getComponent(entity, PositionComponent);
  if (!pos) return;
  pos.x += (Math.random() - 0.5) * params.speed * dt;
  pos.y += (Math.random() - 0.5) * params.speed * dt;
});
Kinematics.set("custom", ({ pos, dt, life, params }) => {
  var _a;
  (_a = params.fn) == null ? void 0 : _a.call(params, pos, dt, life);
});
function ParticleMovementSystem(world, dt) {
  const particles = world.query([MovementPatternComponent]);
  for (const e of particles) {
    const move = world.getComponent(e, MovementPatternComponent);
    const kinematic = Kinematics.get(move.type);
    if (kinematic) kinematic({ world, entity: e, dt, params: move.params });
  }
}
function PhysicsSystem(world, dt) {
  const entities = world.query([PositionComponent, VelocityComponent]);
  for (const e of entities) {
    const pos = world.getComponent(e, PositionComponent);
    const vel = world.getComponent(e, VelocityComponent);
    const gravity = world.getComponent(e, GravityComponent);
    if (gravity) {
      vel.dx += gravity.x * dt;
      vel.dy += gravity.y * dt;
    }
    pos.x += vel.dx * dt;
    pos.y += vel.dy * dt;
  }
}
const index$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ChatSystem,
  HtmlRenderSystem,
  ParticleMovementSystem,
  ParticleSystem,
  PhysicsSystem,
  PingSystem,
  SoundSystem,
  ToastSystem
}, Symbol.toStringTag, { value: "Module" }));
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}
async function hmacSHA256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
}
async function tokenise(secret, params) {
  const payload = JSON.stringify(params);
  const payloadB64 = base64urlEncode(payload);
  const sig = await hmacSHA256(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}
async function detokenise(secret, token) {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) throw new Error("Invalid token format");
  const expectedSig = await hmacSHA256(secret, payloadB64);
  if (sig !== expectedSig) throw new Error("Invalid token signature");
  const json = base64urlDecode(payloadB64);
  return JSON.parse(json);
}
function cleanText(text, bannedWords = defaultBannedWords) {
  if (typeof text !== "string") return text;
  let cleaned = text;
  for (const word of bannedWords) {
    const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    cleaned = cleaned.replace(regex, "*".repeat(word.length));
  }
  return cleaned;
}
const defaultBannedWords = ["fuck", "shit", "bitch", "bastard", "asshole"];
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const LoadingOverlay = /* @__PURE__ */ (function createLoadingOverlayModule() {
  const ID = "pb-framework-loading-overlay";
  let shown = false;
  function ensure() {
    if (document.getElementById(ID)) return;
    const el = document.createElement("div");
    el.id = ID;
    el.style.cssText = [
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
    ].join(";");
    el.innerHTML = `<div style="padding:14px 20px;border-radius:8px;display:flex;gap:12px;align-items:center;">
      <div style="width:18px;height:18px;border-radius:50%;border:3px solid #ccc;border-top-color:#333;animation:pbspin .8s linear infinite"></div>
      <div id="pb-loading-overlay-text">Loading…</div>
    </div>
    <style>@keyframes pbspin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(el);
  }
  function show(text = "Loading…") {
    ensure();
    const el = document.getElementById(ID);
    const txt = el.querySelector("#pb-loading-overlay-text");
    if (txt) txt.textContent = text;
    el.style.visibility = "visible";
    el.style.opacity = "1";
    shown = true;
  }
  function hide() {
    const el = document.getElementById(ID);
    if (!el || !shown) return;
    el.style.opacity = "0";
    setTimeout(() => {
      if (el) el.style.visibility = "hidden";
    }, 200);
    shown = false;
  }
  return { show, hide };
})();
const index = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  LoadingOverlay,
  cleanText,
  detokenise,
  tokenise
}, Symbol.toStringTag, { value: "Module" }));
function getById(userId, world) {
  let usersEID = world.query([userComponent]);
  for (const userEID of usersEID) {
    let user = world.getComponent(userEID, userComponent);
    if (user.id == userId) {
      return user;
    }
  }
  return null;
}
const userUtils = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getById
}, Symbol.toStringTag, { value: "Module" }));
class Scene {
  /**
   * opts:
   *  - name: optional human name
   *  - htmlPath: path to fragment
   *  - onLoad: async (world, client, sceneManager) => cleanupFn|void
   *  - onUnload: optional (world, client) => void
   */
  constructor({ name, htmlPath, onLoad, onUnload } = {}) {
    if (!htmlPath) throw new Error("Scene requires htmlPath");
    this.name = name || htmlPath;
    this.htmlPath = htmlPath;
    this.onLoad = onLoad;
    this.onUnload = onUnload;
  }
}
class SceneManager {
  constructor(rootSelector = "#ui-root", options = {}) {
    this.root = document.querySelector(rootSelector) || this._createRoot(rootSelector);
    this.currentScene = null;
    this.previousScene = null;
    this._currentCleanup = null;
    this.loading = !!options.loading;
    this.loadingDelay = options.loadingDelay || 120;
    this._loadingOverlay = this.loading ? LoadingOverlay : null;
  }
  _createRoot(rootSelector) {
    const el = document.createElement("div");
    el.id = rootSelector.replace(/^#/, "");
    document.body.appendChild(el);
    return el;
  }
  async load(sceneLike, context = {}) {
    const scene = sceneLike instanceof Scene ? sceneLike : new Scene(sceneLike);
    if (this.currentScene) {
      this.previousScene = {
        scene: this.currentScene,
        context: this.currentContext
      };
    }
    const fetchHtml = (async () => {
      const res = await fetch(scene.htmlPath);
      if (!res.ok) throw new Error(`Failed to load scene: ${scene.htmlPath}`);
      return await res.text();
    })();
    let overlayTimer = null;
    let overlayShown = false;
    if (this._loadingOverlay) {
      overlayTimer = setTimeout(() => {
        this._loadingOverlay.show();
        overlayShown = true;
      }, this.loadingDelay);
    }
    await this.unload(false, false);
    const html = await fetchHtml;
    if (overlayTimer) {
      clearTimeout(overlayTimer);
    }
    this.root.innerHTML = html;
    this.currentScene = scene;
    this.currentContext = context;
    if (scene.onLoad) {
      const maybeCleanup = await scene.onLoad(context, this);
      if (typeof maybeCleanup === "function") this._currentCleanup = maybeCleanup;
      else this._currentCleanup = null;
    }
    if (overlayShown && this._loadingOverlay) this._loadingOverlay.hide();
  }
  async unload(clearPrev = true, clearDom = true) {
    if (this._currentCleanup) {
      try {
        await this._currentCleanup();
      } catch (err) {
        console.warn("Scene cleanup failed", err);
      }
      this._currentCleanup = null;
    }
    if (this.currentScene && typeof this.currentScene.onUnload === "function") {
      try {
        await this.currentScene.onUnload();
      } catch (err) {
        console.warn("scene onUnload error", err);
      }
    }
    if (clearDom) this.root.innerHTML = "";
    this.currentScene = null;
    if (clearPrev) {
      this.previousScene = null;
    }
  }
  async goBack() {
    if (this.previousScene) {
      const { scene, context } = this.previousScene;
      this.previousScene = null;
      return this.load(scene, context);
    }
  }
}
function SyncSystem({ world, network, isHost = false }) {
  const actionHandlers = /* @__PURE__ */ new Map();
  const registeredActions = /* @__PURE__ */ new Map();
  const errorHandlers = /* @__PURE__ */ new Map();
  let seq = 0;
  const pendingPredictions = /* @__PURE__ */ new Map();
  function onAction(type, handler) {
    actionHandlers.set(type, handler);
  }
  function onError(type, handler) {
    errorHandlers.set(type, handler);
  }
  function registerAction(type, builder) {
    registeredActions.set(type, builder);
  }
  function send(actionType, payload, options = {}) {
    const builder = registeredActions.get(actionType);
    const msg = builder ? builder(payload) : { action: actionType, payload };
    msg.seq = ++seq;
    msg.clientEntityId = world.clientEntityId || network.id;
    if (!isHost && options.predict) {
      const handler = actionHandlers.get(actionType);
      if (handler) {
        handler({ world, payload, clientId: network.id, predicted: true, seq: msg.seq });
      }
      const key = `${msg.clientEntityId}:${msg.seq}`;
      pendingPredictions.set(key, msg);
    }
    network.send({
      type: "sync",
      action: msg.action,
      payload: msg.payload,
      seq: msg.seq,
      clientEntityId: msg.clientEntityId
      // ✅ send it out
    });
  }
  function broadcast(actionType, payload, opts = {}, seq2, clientEntityId) {
    if (!isHost) {
      console.warn(`[SyncSystem] broadcast() is host-only`);
      return;
    }
    if (typeof network.broadcast !== "function") {
      console.warn(`[SyncSystem] network.broadcast not implemented`);
      return;
    }
    network.broadcast({
      type: "sync",
      action: actionType,
      payload,
      seq: seq2,
      clientEntityId
      // ✅ or pass the original clientEntityId if you have it
    }, opts);
  }
  function sendTo(clientId, actionType, payload) {
    console.log(clientId);
    network.send(clientId, {
      type: "sync",
      action: actionType,
      payload
    });
  }
  network.on("sync", ({ clientId, clientEntityId, action, payload, seq: seq2 }) => {
    const handler = actionHandlers.get(action);
    if (!handler) return;
    if (isHost) {
      const result = handler({ world, payload, clientId });
      if (!result || result.valid === false) {
        network.send(clientId, {
          type: "sync-error",
          error: {
            action,
            // the original action type that failed
            reason: (result == null ? void 0 : result.reason) || "Invalid action",
            seq: seq2,
            // optional: sequence number
            payload
            // optional: original payload
          }
        });
        return;
      }
      if (result && result.broadcast !== false) {
        broadcast(result.action, result.payload ?? payload, result.opts, seq2, clientEntityId);
      }
    } else {
      handler({ world, payload, clientId, confirmed: true, seq: seq2 });
      const key = `${clientEntityId}:${seq2}`;
      console.log(key);
      if (pendingPredictions.has(key)) {
        pendingPredictions.delete(key);
        for (const [k, p] of pendingPredictions.entries()) {
          const [cid, s] = k.split(":");
          if (cid === clientEntityId && Number(s) > Number(seq2)) {
            const handler2 = actionHandlers.get(p.action);
            if (handler2) {
              handler2({
                world,
                payload: p.payload,
                clientId,
                predicted: true,
                seq: Number(s),
                clientEntityId: cid
              });
            }
          }
        }
      }
    }
  });
  network.on("sync-error", ({ clientId, error }) => {
    const handler = errorHandlers.get(error.action);
    if (!handler) return;
    handler({ world, clientId, ...error });
  });
  function update(world2, dt) {
  }
  const api = Object.assign(update, {
    send,
    onAction,
    onError,
    registerAction
  });
  if (isHost) {
    api.broadcast = broadcast;
    api.sendTo = sendTo;
  }
  return api;
}
exports.Components = index$2;
exports.GameLoop = GameLoop;
exports.Kinematics = Kinematics;
exports.Scene = Scene;
exports.SceneManager = SceneManager;
exports.SyncSystem = SyncSystem;
exports.Systems = index$1;
exports.User = userUtils;
exports.Utils = index;
exports.World = World;
