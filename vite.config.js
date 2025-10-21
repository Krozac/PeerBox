import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import path from 'path';


export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'framework/index.js'),
      name: 'Peerbox',
      fileName: 'index',
      formats: ['es']
    },
  },
 plugins: [cssInjectedByJsPlugin()]
});