import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/tmp/esm",
    lib: {
      entry: {
        index: "src/index.js",
        browser: "src/networking/browser/index.js",
        node: "src/networking/node/index.js",
      },
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: ({ name }) => `${name}.js`,
      },
    },
  },
});