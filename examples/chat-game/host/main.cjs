
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { randomUUID } = require("crypto");

// Framework host
const PeerBox = require("peerbox");
const { createHost } = require("peerbox/node");
const { ChatMessageComponent } = require("./ecs/components/chatMessageComponent.js");

const fs = require("node:fs");

const { getUserList, getRandomColor } = require("./utils.js");
const { timeStamp } = require("node:console");

const VoicePlugin = require("peerbox-voice");

const { SyncSystem, Utils } = PeerBox;

const voiceStreams = new Map(); // Map of clientId to MediaStream

const bannedWords = fs
  .readFileSync(path.join(__dirname, "./fr"), "utf8")
  .split(/\r?\n/)
  .map(w => w.trim())
  .filter(Boolean);

const cleanText = Utils.createTextCleaner(bannedWords);

const gameId = "afbebc9d-9d21-4284-9317-cb0b6daec6a6";

let splash;
let win;
let hostInstance;
let world;
let username;
// ----------------------
// Window helpers
// ----------------------
function createSplash() {
    splash = new BrowserWindow({
        width: 400,
        height: 500,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        center: true,
        resizable: false,
        show: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
        },
    });
    splash.loadFile(path.join(__dirname, "ui", "splash.html"));
}

function createMainWindow() {
    win = new BrowserWindow({
        width: 1920,
        height: 1080,
        minWidth: 200,
        minHeight: 200,
        autoHideMenuBar: true,
        useContentSize: true,
        resizable: false,
        show: false,
        titleBarStyle: "default",
        title: "Peerbox | Chat Game",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
        },
    });

    win.loadFile(path.join(__dirname, "ui", "host.html"));
    win.setMenuBarVisibility(false);
    win.setAutoHideMenuBar(false);

    win.webContents.once("did-finish-load", async () => {
        fadeOutSplash(splash);
        updateSplash(splash, "App successfully Loaded", 100);
        splash.close();
        splash = null;
        win.show();
    });
}

// ----------------------
// small utils
// ----------------------
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const ApiUrl = "http://localhost:5502";

async function loginAsClient(roomId, username) {
    try {
        const response = await fetch(`${ApiUrl}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId, username }),
        });

        if (!response.ok) throw new Error(`Login failed: ${response.status}`);
        const { token, gameUrl } = await response.json();
        return { token, gameUrl };
    } catch (err) {
        console.error("Client login error:", err);
        return null;
    }
}

// ----------------------
// Splash helpers
// ----------------------
async function updateSplash(splashWindow, text, percent) {
    updateSplashStatus(splashWindow, text);
    updateSplashProgress(splashWindow, percent);
    await sleep(200);
}

function updateSplashStatus(splashWindow, text) {
    splashWindow.webContents.send("splash-set-status", text);
}

function updateSplashProgress(splashWindow, percent) {
    splashWindow.webContents.send("splash-loading-progress", percent);
}

function showSplashProgressBar(splashWindow, show = true) {
    splashWindow.webContents.send("splash-show-progress", show);
}

function fadeOutSplash(splashWindow) {
    splashWindow.webContents.send("splash-fade-out");
}

// ----------------------
// Host + ECS initialization (refactored)
// ----------------------
async function initHost(config = {
    url: "ws://localhost:5501" ,
    rtcConfiguration: {
        iceServers: [
            // STUN (optional on LAN, but harmless)
            { urls: "stun:stun.l.google.com:19302" },

            // YOUR LOCAL TURN SERVER
            {
            urls: [
                "turn:192.168.1.15:3478?transport=udp",
                "turn:192.168.1.15:3478?transport=tcp"
            ],
            username: "webrtc",
            credential: "webrtc123"
            }
        ]
    },
    plugins: [VoicePlugin()],
}) {
    hostInstance = createHost(config);

    hostInstance.start();
    return hostInstance;
}

function initWorld() {
    world = new PeerBox.World({
        idGenerator: () => randomUUID(),
    });
    const sync = SyncSystem({ world, network: hostInstance, isHost: true });
    return { world, sync };
}

function registerHostEvents(sync) {
    hostInstance.on("peer-connected",((clientId) => {
        console.log(clientId + " connected ");
        //send audio streams to the new client
        for (const [otherClientId, stream] of voiceStreams.entries()) {
            if (otherClientId === clientId) continue; // Don't send the new client's own stream back to them
            hostInstance.plugins.getPlugin("voice").send(stream, clientId);
        }
    }));

    hostInstance.on("peer-disconnected",((clientId) => {
        console.log(clientId + " disconnected ");
        const entity = PeerBox.User.getById(clientId, world);
        if (!entity) return;
        world.removeEntities([entity]);

        sync.broadcast("users-state", getUserList(world,PeerBox));
    }));

    hostInstance.on("peer-transport-lost",((clientId) => {
        console.log(clientId + " transport lost (possible reconnect) ");
        const entity = PeerBox.User.getById(clientId, world);
        if (!entity) return;

        const userComp = world.getComponent(entity, PeerBox.Components.userComponent);

        userComp.connected = false;
        sync.broadcast("users-state", getUserList(world,PeerBox));
    }));

    hostInstance.on("intro", (data) => {
        let userId = data.clientId;
        let username = data.payload.username || "Anonymous";

        let entity = PeerBox.User.getById(userId, world);

        console.log("Received intro from", username, "(", userId, ")");
        //reconnect 
        if (entity) {
            const userComp = world.getComponent(entity, PeerBox.Components.userComponent);
            userComp.connected = true;
            userComp.name = username; // Update name in case it changed
            console.log("User reconnected, updating name to", username);
        }
        else {
            entity = world.createEntity();
            
            world.addComponent(entity, PeerBox.Components.userComponent, {
                id: userId,
                name: username,
                role: "client",
                color: getRandomColor(),
                connected: true,
            });
        }

        hostInstance.send(userId, {
            type: "join-ack",
            userEntityId: entity,
            username,
        });

        sync.broadcast("users-state", getUserList(world,PeerBox));

        //send message history 

        const messageEntities = world.query([ChatMessageComponent]);

        const messages = messageEntities.map((id) => {
            const msg = world.getComponent(id, ChatMessageComponent);

            return {
                id,
                from: msg.from,
                username: msg.fromName || "Unknown",
                text: msg.text,
                timestamp: msg.timestamp,
            };
        });

        hostInstance.send(userId, {
            type: "chat-history",
            payload: { messages }
        });
    });

    hostInstance.server.on("room-created", async ({ roomId, clientId }) => {
        splash.webContents.send("set-status", "Loading game client…");
        const clientData = await loginAsClient(roomId, username);
        if (clientData) {
            const { token, gameUrl } = clientData;
            await win.loadURL(`${gameUrl}?token=${token}`);
            splash.close();
            splash = null;
            win.show();
        }
    });

    hostInstance.on("track", ({ stream, track, clientId }) => {
        console.log("Received track from", clientId, ":", track.kind);
        // Broadcast the track to all other clients
        //save the stream and broadcast it to all other clients except the sender (so newer clients can get the stream)

        voiceStreams.set(clientId, stream);
        hostInstance.plugins.getPlugin("voice").broadcast(stream, { exclude: clientId });
    });
}

function registerSyncEvents(sync) {

    sync.onAction("chat-message", ({ world, payload, clientId, seq }) => {
        console.log("Received chat message from", clientId, ":", payload.text);
        const { text } = payload;
        const user = PeerBox.User.getById(clientId, world);
        const userComp = world.getComponent(user, PeerBox.Components.userComponent);

        console.log("User component for", user);
        if (!user || typeof text !== "string" || text.length > 500) {
            console.warn("Invalid chat message from", clientId);
            return { valid: false, reason: "Invalid message" };
        }

        const entity = world.createEntity();
        const sanitized = cleanText(text);
        world.addComponent(entity, ChatMessageComponent, {
            from: clientId,
            fromName: userComp.name,
            text : sanitized,
            timestamp : Date.now()
        });

        return {
            broadcast: true,
            action: "chat-message",
            payload: { username: userComp.name, text: sanitized },
            opts: {},
            seq,
            clientEntityId: user,
            clientId 
        };
    });

    //user list 
    sync.onAction("users-state",(payload) => {
        sync.broadcast("users-state", getUserList(world,PeerBox));
    });
}

// ----------------------
// IPC handlers
// ----------------------
function setupIpcHandlers() {
    ipcMain.on("create-room", () => {
        if (!splash) createSplash();
        hostInstance?.server.send("create", { gameId });
        win.hide();
    });

    ipcMain.on("set-local-username", (e, newUsername) => {
        username = newUsername;
    });

    ipcMain.on("close-host", () => {
        hostInstance?.broadcast({
            type: "host-disconnected",
            message: "Host has left.",
        });
        hostInstance?.stop();
        win?.close();
    });

    ipcMain.on("resize-window", (event, { width, height }) => {
        if (!win) return;
        win.setContentSize(width, height);
    });
}

// ----------------------
// start sequence
// ----------------------
async function start() {
    showSplashProgressBar(splash);

    await updateSplash(splash, "Creating host instance ...", 0);
    await initHost();

    await updateSplash(splash, "Starting Hosting logic ...", 10);

    await updateSplash(splash, "Configurating ECS world ...", 20);
    const { sync } = initWorld();

    await updateSplash(splash, "Registering Host events ...", 30);
    registerHostEvents(sync);

    await updateSplash(splash, "Registering Sync events ...", 40);
    registerSyncEvents(sync);

    await updateSplash(splash, "Loading Main Window ...", 50);
    createMainWindow();

    setupIpcHandlers();
}

app.whenReady().then(() => {
    createSplash();
    start();
});