import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/tmp/cjs",
    lib: {
      entry: {
        index: "src/index.js",
        browser: "src/networking/browser/index.js",
        node: "src/networking/node/index.js",
      },
      formats: ["cjs"],
    },
    rollupOptions: {
      output: {
        entryFileNames: ({ name }) => `${name}.cjs`
      }
    },
    ssr: true,
  },
});