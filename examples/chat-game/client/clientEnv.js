// Optional Electron bridge for the legacy desktop host. The browser example
// reads its network endpoints from Vite environment variables.
import { SIGNALING_URL } from "./networkConfig.js";

export const env = {
  SIGNALING_URL,
  host: {
    createRoom: () => console.warn("createRoom not available outside Electron"),
    close: () => console.warn("closeHost not available outside Electron"),
    setUsername: (username) => console.warn("setUsername not available outside Electron"),
    getRoomInfo: async () => null,
    onRoomCreated: (_callback) => {},
  },
  window: {
    resize: () => {},
    toggleFullscreen: () => {},
  },
};

// If running inside Electron, override with actual exposed API
if (window.env) {
  Object.assign(env, window.env);
}
