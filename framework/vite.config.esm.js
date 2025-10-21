import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/tmp/esm",
    lib: {
      entry: {
        index: "src/index.js",
        client: "src/client.js",
      },
      formats: ["es"]
    },
    rollupOptions: {
      output: {
        entryFileNames: ({ name }) => {
          if (name === "client") return "client.js";
          if (name === "index") return "index.js";
          return `${name}.js`;
        }
      }
    }
  }
});
