import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'client/index.html'),
        host: path.resolve(__dirname, 'client/host.html'),
        game: path.resolve(__dirname, 'client/game.html'),
      }
    }
  },
  optimizeDeps: {
    exclude: ["@peerbox/core"]
  }
});
