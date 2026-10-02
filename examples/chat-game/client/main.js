import * as Peerbox from "@peerbox/core";
import { createClient } from "@peerbox/core/browser";
import { ChatScene } from "./scenes/chatScene.js";
import { SweepLeftTransition, SweepRightTransition } from "./transitions/sweep.js";
import { SIGNALING_URL } from "./networkConfig.js";

const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const loadingRoot = document.querySelector("#game-root");
const networkStatus = document.querySelector("#network-status");

let roomId = "";
let username = localStorage.getItem("username") || "Anonymous";
let gameStarted = false;
let client;

if (!token) {
  window.location.replace("./");
} else {
  bootstrap().catch((error) => {
    Peerbox.Utils.LoadingOverlay.hide();
    setNetworkStatus(error.message || "Could not connect.", true);
  });
}

async function bootstrap() {
  Peerbox.Utils.LoadingOverlay.show("Connecting to room…", loadingRoot);

  client = createClient({
    url: SIGNALING_URL,
    username,
    plugins: [],
    rtcConfiguration: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    },
  });

  client.server.on("join-accepted", (message) => {
    roomId = message.roomId;
    username = message.username || username;
    client.id = message.userId;
    localStorage.setItem("username", username);
    localStorage.setItem("clientId", message.userId);
    document.querySelector("#room-id").textContent = roomId;
  });

  client.server.on("join-rejected", ({ reason }) => {
    setNetworkStatus(joinError(reason), true);
    Peerbox.Utils.LoadingOverlay.hide();
  });
  client.server.on("room-closed", () => {
    setNetworkStatus("The host closed this room.", true);
    Peerbox.Utils.LoadingOverlay.hide();
  });
  client.server.on("host-resumed", () => {
    if (client.peer.dataChannel?.readyState === "open") setNetworkStatus("Connected");
  });
  client.server.on("error", (error) => setNetworkStatus(error?.message || "Signaling connection error.", true));

  client.on("connected", () => {
    if (!gameStarted) {
      startGameOnce().catch((error) => setNetworkStatus(error.message || "Could not start the game.", true));
      return;
    }
    setNetworkStatus("Connected");
    client.send({ type: "intro", payload: { username } });
  });
  client.on("disconnected", () => setNetworkStatus("Connection interrupted. Reconnecting…"));
  client.on("host-disconnected", () => setNetworkStatus("Host connection interrupted. Waiting for the host…"));
  client.on("error", (error) => setNetworkStatus(error?.message || "Peer connection error.", true));

  await client.connect();
  client.server.send("join", {
    token,
    userId: localStorage.getItem("clientId") || null,
  });
}

async function startGameOnce() {
  if (gameStarted) {
    setNetworkStatus("Connected");
    return;
  }
  gameStarted = true;
  setNetworkStatus("Connected");

  const world = new Peerbox.World();
  world.registerSystem(Peerbox.Systems.HtmlRenderSystem, { type: "render" });
  world.registerSystem(Peerbox.Systems.PingSystem(client, { interval: 2 }));
  world.registerSystem(Peerbox.Systems.PhysicsSystem);
  world.registerSystem(Peerbox.Systems.ParticleSystem);
  world.registerSystem(Peerbox.Systems.ParticleMovementSystem);
  world.registerSystem(Peerbox.Systems.ToastSystem);

  const sync = new Peerbox.SyncSystem({ world, network: client, isHost: false });
  const transitions = new Peerbox.TransitionManager();
  transitions.register("bubbles-sweep-right", SweepRightTransition);
  transitions.register("bubbles-sweep-left", SweepLeftTransition);

  const scenes = new Peerbox.SceneManager("#scene-container", {
    loading: true,
    loadingDelay: 120,
    transitionManager: transitions,
  });
  scenes.setTitle = (title) => {
    const titleElement = document.querySelector("#sceneTitle");
    if (titleElement) titleElement.textContent = title;
  };

  await scenes.load(ChatScene, { world, sync, client });
  sync.onAction("users-state", ({ payload }) => reconcileUsers(payload, world));

  const fpsElement = document.querySelector("#status-fps");
  let smoothedFps = 60;
  let fpsAccumulator = 0;
  Peerbox.GameLoop.start({
    onUpdate: (dt) => world.update(dt),
    onRender: (dt) => {
      world.render(dt);
      if (!fpsElement) return;
      const fps = dt > 0 ? 1 / dt : 0;
      smoothedFps = smoothedFps * 0.9 + fps * 0.1;
      fpsAccumulator += dt;
      if (fpsAccumulator >= 0.2) {
        fpsElement.textContent = `FPS: ${Math.round(smoothedFps)}`;
        fpsAccumulator = 0;
      }
    },
  });

  addPingDisplay(world);
  updateEntityCount(world);
  world.on("entityCreated", () => updateEntityCount(world));
  world.on("entityRemoved", () => updateEntityCount(world));

  document.querySelector("#copyRoomIdBtn")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(roomId).catch(() => setNetworkStatus("Select the room code and copy it manually."));
  });
  document.querySelector("#leaveRoomBtn")?.addEventListener("click", () => {
    client.disconnect();
    localStorage.removeItem("clientId");
    window.location.assign("./");
  });

  client.send({ type: "intro", payload: { username } });
  Peerbox.Utils.LoadingOverlay.hide();
}

function addPingDisplay(world) {
  const entity = world.createEntity();
  world.addComponent(entity, Peerbox.Components.HtmlRenderComponent, {
    parentSelector: "#status-ping",
    tagName: "div",
    classes: null,
    html: "<strong>—</strong>",
  });
  world.on("ping-update", ({ rtt }) => {
    const component = world.getComponent(entity, Peerbox.Components.HtmlRenderComponent);
    if (component) component.html = `<p style="display:inline">${Number(rtt) || 0}ms</p>`;
  });
}

function updateEntityCount(world) {
  const element = document.querySelector("#status-entity");
  if (element) element.textContent = `Entities: ${world.entities.size}`;
}

function setNetworkStatus(message, isError = false) {
  if (!networkStatus) return;
  networkStatus.textContent = message;
  networkStatus.dataset.error = String(isError);
}

function joinError(reason) {
  if (reason === "room-not-found") return "That room is no longer available.";
  if (reason === "invalid-token") return "This invite has expired. Return to the lobby and re-enter the room code.";
  return "Could not join this room.";
}

function reconcileUsers(users, world) {
  if (!Array.isArray(users)) return;
  const componentName = Peerbox.Components.userComponent;
  const existing = new Map(world.getEntitiesWithComponent(componentName).map((entity) => {
    const user = world.getComponent(entity, componentName);
    return [user.id, entity];
  }));

  for (const user of users) {
    const entity = existing.get(user.id);
    if (entity) {
      const component = world.getComponent(entity, componentName);
      Object.assign(component, { name: user.name, color: user.color, connected: user.connected });
      existing.delete(user.id);
    } else {
      const newEntity = world.createEntity();
      world.addComponent(newEntity, componentName, { ...user, role: "client" });
    }
  }
  world.removeEntities([...existing.values()]);
}
