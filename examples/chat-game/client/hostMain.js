import * as Peerbox from "@peerbox/core";
import { createHost } from "@peerbox/core/browser";
import { API_URL, SIGNALING_URL } from "./networkConfig.js";

const GAME_ID = "afbebc9d-9d21-4284-9317-cb0b6daec6a6";
const MAX_CHAT_LINES = 80;
const COLORS = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];

const form = document.querySelector("#create-room-form");
const hostNameInput = document.querySelector("#host-name");
const createButton = document.querySelector("#create-room-button");
const createPanel = document.querySelector("#create-panel");
const roomPanel = document.querySelector("#room-panel");
const status = document.querySelector("#host-status");
const roomStatus = document.querySelector("#room-status");
const roomCode = document.querySelector("#room-code");
const inviteLink = document.querySelector("#invite-link");
const playerCount = document.querySelector("#player-count");
const connectionPill = document.querySelector("#connection-status");
const playerGameFrame = document.querySelector("#player-game-frame");
const roomPanelElement = document.querySelector("#room-panel");
const toolbarToggle = document.querySelector("#toggle-toolbar-button");

let host;
let world;
let sync;
let hostName = "Host";
let roomIsOpen = false;
let nextColor = 0;
const userEntities = new Map();
const chatHistory = [];

hostNameInput.value = localStorage.getItem("username") || "";
form.addEventListener("submit", createRoom);
document.querySelector("#close-room-button").addEventListener("click", closeRoom);
document.querySelector("#copy-code-button").addEventListener("click", () => copyText(roomCode.textContent));
document.querySelector("#copy-link-button").addEventListener("click", () => copyText(inviteLink.href));
toolbarToggle.addEventListener("click", toggleToolbar);

async function createRoom(event) {
  event.preventDefault();
  hostName = hostNameInput.value.trim().slice(0, 16);
  if (!hostName) return setStatus("Enter a display name first.", true);

  createButton.disabled = true;
  setStatus("Connecting to the signaling service…");
  localStorage.setItem("username", hostName);

  try {
    if (!host) setupHost();
    host.start();
    host.server.send("create", { gameId: GAME_ID });
  } catch (error) {
    createButton.disabled = false;
    setStatus(error.message || "Could not start the host.", true);
  }
}

function setupHost() {
  host = createHost({
    url: SIGNALING_URL,
    rtcConfiguration: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    },
    plugins: [],
  });

  world = new Peerbox.World({
    idGenerator: () => globalThis.crypto?.randomUUID?.() ?? `entity-${Date.now()}-${Math.random()}`,
  });
  sync = Peerbox.SyncSystem({ world, network: host, isHost: true });

  host.server.on("room-created", onRoomCreated);
  host.server.on("host-resume-rejected", () => {
    roomIsOpen = false;
    setConnection("offline", "Room expired");
    setRoomStatus("The host could not reclaim the room. Create a new room to continue.", true);
  });
  host.server.on("error", (error) => {
    const message = error?.message || "Signaling connection error.";
    if (roomIsOpen) setRoomStatus(message, true);
    else setStatus(`${message} Retrying…`, true);
  });
  host.server.on("close", () => {
    if (!roomIsOpen) setStatus("Signaling disconnected. Retrying…");
  });

  host.on("intro", handleIntro);
  host.on("peer-connected", () => {
    if (roomIsOpen) setConnection("online", "Host connected");
  });
  host.on("peer-transport-lost", handlePeerTransportLost);
  host.on("peer-disconnected", handlePeerDisconnected);
  host.on("host-signaling-lost", () => {
    setConnection("waiting", "Reconnecting…");
    setRoomStatus("Signaling disconnected. This page will try to resume your room.");
  });
  host.on("host-signaling-restored", () => {
    if (roomIsOpen) {
      setConnection("online", "Host connected");
      setRoomStatus("Room connection restored.");
    }
  });
  host.on("room-closed", () => {
    roomIsOpen = false;
    setConnection("offline", "Room closed");
    setRoomStatus("This room has closed.", true);
  });

  sync.onAction("chat-message", validateChatMessage, { key: "example.chat-message" });
}

async function onRoomCreated({ roomId: id }) {
  roomIsOpen = true;
  roomCode.textContent = id;
  const url = new URL("./", window.location.href);
  url.searchParams.set("room", id);
  inviteLink.href = url.href;
  inviteLink.textContent = url.href;
  createPanel.hidden = true;
  roomPanel.hidden = false;
  setConnection("online", "Host connected");
  setRoomStatus("Getting your player invite…");
  renderPlayers();

  try {
    const response = await fetch(`${API_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: id, username: hostName }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create your player invite.");

    const gameUrl = new URL("./game.html", window.location.href);
    gameUrl.searchParams.set("token", result.token);
    playerGameFrame.src = gameUrl.href;
    setRoomStatus("You joined as a player. Keep this page open while people play.");
  } catch (error) {
    setRoomStatus(`${error.message || "Could not open your player view."} You can still share the invite.`, true);
  }
}

async function handleIntro({ clientId, payload = {} }) {
  if (!roomIsOpen) return;
  const name = typeof payload.username === "string" ? payload.username.trim().slice(0, 16) : "Player";
  let entityId = userEntities.get(clientId);

  if (entityId && world.entities.has(entityId)) {
    const user = world.getComponent(entityId, Peerbox.Components.userComponent);
    user.name = name || "Player";
    user.connected = true;
  } else {
    entityId = world.createEntity();
    userEntities.set(clientId, entityId);
    world.addComponent(entityId, Peerbox.Components.userComponent, {
      id: clientId,
      name: name || "Player",
      color: COLORS[nextColor++ % COLORS.length],
      connected: true,
    });
  }

  const user = world.getComponent(entityId, Peerbox.Components.userComponent);
  host.send(clientId, {
    type: "join-ack",
    userEntityId: entityId,
    username: user.name,
    userList: getUsers(),
  });
  host.send(clientId, { type: "chat-history", payload: { messages: [...chatHistory] } });
  sync.broadcast("users-state", getUsers());
  renderPlayers();
}

function validateChatMessage({ payload = {}, clientId, seq }) {
  const entityId = userEntities.get(clientId);
  const user = entityId && world.getComponent(entityId, Peerbox.Components.userComponent);
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!user?.connected) return { valid: false, reason: "You are not in this room." };
  if (!text || text.length > 300) return { valid: false, reason: "Messages must be 1–300 characters." };

  const message = { from: clientId, username: user.name, text, timestamp: Date.now() };
  chatHistory.push(message);
  if (chatHistory.length > MAX_CHAT_LINES) chatHistory.shift();
  return {
    valid: true,
    action: "chat-message",
    payload: { username: user.name, text },
    opts: {},
    seq,
    clientEntityId: entityId,
  };
}

function handlePeerTransportLost(clientId) {
  const entityId = userEntities.get(clientId);
  const user = entityId && world.getComponent(entityId, Peerbox.Components.userComponent);
  if (!user) return;
  user.connected = false;
  renderPlayers();
  if (roomIsOpen) sync.broadcast("users-state", getUsers());
}

function handlePeerDisconnected(clientId) {
  const entityId = userEntities.get(clientId);
  if (entityId) world.removeEntities([entityId]);
  userEntities.delete(clientId);
  renderPlayers();
  if (roomIsOpen) sync.broadcast("users-state", getUsers());
}

function getUsers() {
  return [...userEntities].flatMap(([id, entityId]) => {
    const user = world.getComponent(entityId, Peerbox.Components.userComponent);
    return user?.connected ? [{ id, name: user.name, color: user.color, connected: true }] : [];
  });
}

function renderPlayers() {
  if (playerCount) playerCount.textContent = String(getUsers().length);
}

function closeRoom() {
  if (!host) return;
  roomIsOpen = false;
  host.stop();
  playerGameFrame.src = "about:blank";
  roomPanel.hidden = true;
  createPanel.hidden = false;
  createButton.disabled = false;
  setConnection("offline", "Room closed");
  setStatus("Room closed. You can create another one.");
}

function setConnection(state, label) {
  connectionPill.dataset.state = state;
  connectionPill.textContent = label;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.error = String(isError);
}

function setRoomStatus(message, isError = false) {
  roomStatus.textContent = message;
  roomStatus.dataset.error = String(isError);
}

function toggleToolbar() {
  roomPanelElement.classList.toggle("toolbar-collapsed");
  const expanded = !roomPanelElement.classList.contains("toolbar-collapsed");
  toolbarToggle.textContent = expanded ? "▲" : "▼";
  toolbarToggle.setAttribute("aria-expanded", String(expanded));
  toolbarToggle.setAttribute("aria-label", expanded ? "Hide room controls" : "Show room controls");
  toolbarToggle.title = expanded ? "Hide room controls" : "Show room controls";
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    setRoomStatus("Copied to clipboard.");
  } catch {
    setRoomStatus("Clipboard access was blocked. Select and copy the invite manually.", true);
  }
}
