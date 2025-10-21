// clientEnv.js
// this is used to communicate between renderer -> electron (unused in a browser context)

export const env = {
  SIGNALING_URL: "ws://localhost:5501", // default for browser
  host: {
    createRoom: () => console.warn("createRoom not available outside Electron"),
    close: () => console.warn("closeHost not available outside Electron"),
    setUsername: (username) => console.warn("setUsername not available outside Electron"),
    getRoomInfo: async () => null,
    onRoomCreated: (_callback) => {},
  },
  window: {
    resize: (_w, _h) => console.warn("resize not available outside Electron"),
    toggleFullscreen: () => console.warn("toggleFullscreen not available outside Electron"),
  },
};

// If running inside Electron, override with actual exposed API
if (window.env) {
  Object.assign(env, window.env);
}
