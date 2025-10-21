const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("env", {
  config: {
    SIGNALING_URL: "ws://localhost:5501", // could also be read from process.env
  },

  host: {
    createRoom: () => ipcRenderer.send("create-room"),
    close: () => ipcRenderer.send("close-host"),
    setUsername: (username) => ipcRenderer.send("set-local-username", username),
    getRoomInfo: () => ipcRenderer.invoke("get-room-info"),
    onRoomCreated: (callback) => {
      ipcRenderer.on("room-created", (_e, data) => callback(data));
    },
  },

  window: {
    resize: (width, height) => ipcRenderer.send("resize-window", { width, height }),
    toggleFullscreen: () => ipcRenderer.send("toggle-fullscreen"),
  },
});

contextBridge.exposeInMainWorld("api", {
  on: (channel, callback) => {
    const validChannels = [
      "splash-set-status",
      "splash-show-progress",
      "splash-loading-progress",
      "splash-fade-out",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
});