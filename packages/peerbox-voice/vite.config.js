import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.js",
      name: "PeerboxVoice",
      formats: ["es", "cjs"],

      fileName: (format) => {
        if (format === "es") return "index.js";
        if (format === "cjs") return "index.cjs";
      },
    },

    rollupOptions: {
      external: ["peerbox"],
    },
  },
});