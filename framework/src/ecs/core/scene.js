// framework/scene/Scene.js
export class Scene {
  /**
   * opts:
   *  - name: optional human name
   *  - htmlPath: path to fragment
   *  - onLoad: async (world, client, sceneManager) => cleanupFn|void
   *  - onUnload: optional (world, client) => void
   */
  constructor({ name, htmlPath, onLoad, onUnload } = {}) {
    if (!htmlPath) throw new Error("Scene requires htmlPath");
    this.name = name || htmlPath;
    this.htmlPath = htmlPath;
    this.onLoad = onLoad;
    this.onUnload = onUnload;
  }
}
