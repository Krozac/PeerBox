import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/tmp/cjs",
    lib: {
      entry: {
        index: "src/index.js",
        host: "src/host.js"
      },
      formats: ["cjs"]
    },
    rollupOptions: {
      output: {
        entryFileNames: ({ name }) => {
          if (name === "host") return "host.cjs";
          if (name === "index") return "index.cjs";
          return `${name}.cjs`;
        }
      }
    },
    ssr: true,
  }
});
