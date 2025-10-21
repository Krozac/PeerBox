
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { randomUUID } = require("crypto");

// Framework host
const PeerBox = require("../../../framework/dist/index.cjs");
const { Host } = require("../../../framework/dist/host.cjs");
const { ChatMessageComponent } = require("./ecs/components/chatMessageComponent.js");

const { SyncSystem, Utils } = PeerBox;

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
        height: 300,
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
        width: 1280,
        height: 720,
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
async function initHost(url = "ws://localhost:5501") {
    hostInstance = new Host({ url });
    hostInstance.reconnectManager.configure({
        onAttempt: (id, n) => console.log(`Reconnecting ${id}, try ${n}`),
        onSuccess: (id) => console.log(`Reconnected ${id}`),
        onFail: (id) => console.warn(`Failed to reconnect ${id}`),
    });
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

function registerHostEvents() {
    hostInstance.onPeerConnected((clientId) => {
        console.log(clientId + " connected ");
    });

    hostInstance.onPeerDisconnected((clientId) => {
        console.log(clientId + " disconnected ");
    });

    hostInstance.on("intro", ({ clientId, username }) => {
        console.log(username + " joined the room!");

        let entity = world.createEntity();
        world.addComponent(entity, PeerBox.Components.userComponent, {
            id: clientId,
            name: username,
            role: "client",
        });

        hostInstance.send(clientId, {
            type: "join-ack",
            userEntityId: entity,
            username,
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
}

function registerSyncEvents(sync) {
    sync.onAction("chat-message", ({ world, payload, clientId, seq }) => {
        const { text } = payload;
        const user = PeerBox.User.getById(clientId, world);

        if (!user || typeof text !== "string" || text.length > 500) {
            console.warn("Invalid chat message from", clientId);
            return { valid: false, reason: "Invalid message" };
        }

        const entity = world.createEntity();
        world.addComponent(entity, ChatMessageComponent, {
            from: user,
            text,
        });

        const sanitized = Utils.cleanText(text, ["monkey"]);
        return {
            broadcast: true,
            action: "chat-message",
            payload: { username: user.name, text: sanitized },
            opts: {},
            seq,
            clientEntityId: user,
        };
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
    registerHostEvents();

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