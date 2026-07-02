// framework/scene/sceneManager.js
import { Scene } from "./scene.js";
import LoadingOverlay from "../../utils/loading.js"; // <-- small util

export default class SceneManager {
  constructor(rootSelector = "#ui-root", options = {}) {
    this.root = document.querySelector(rootSelector) || this._createRoot(rootSelector);
    this.currentScene = null;
    this.previousScene = null;
    this._currentCleanup = null;

    this.transitionManager = options.transitionManager || null;
    this.loading = !!options.loading; // default false
    this.loadingDelay = options.loadingDelay || 120; // ms threshold before showing overlay
    this._loadingOverlay = this.loading ? LoadingOverlay : null;
  }

  _createRoot(rootSelector) {
    const el = document.createElement("div");
    el.id = rootSelector.replace(/^#/, "");
    document.body.appendChild(el);
    return el;
  }

  async load(sceneLike, context = {}, transition = null) {
    const scene = sceneLike instanceof Scene ? sceneLike : new Scene(sceneLike);
    
    // remember current before replacing
    if (this.currentScene) {
      this.previousScene = {
        scene: this.currentScene,
        context: this.currentContext,
      };
    }

    // Start fetching the new scene immediately (overlap network/IO with cleanup)
    const fetchHtml = (async () => {
      const res = await fetch(scene.htmlPath);
        if (!res.ok) throw new Error(`Failed to load scene: ${scene.htmlPath}`);
        return await res.text();
    })();


    // Show loading overlay only if fetch/unload takes longer than threshold

    let overlayTimer = null;
    let overlayShown = false;
    if (this._loadingOverlay) {
      overlayTimer = setTimeout(() => {
        this._loadingOverlay.show();
        overlayShown = true;
      }, this.loadingDelay);
    }

    console.log("transitionManager  : ",this.transitionManager )
    if (this.transitionManager) {
      await this.transitionManager.out(
        transition,
        this.root
      );
    }


    // Unload current scene
    await this.unload(false,false);

    // Await HTML
    const html = await fetchHtml;


    if (overlayTimer) {
      clearTimeout(overlayTimer);
    }

    // inject
    this.root.innerHTML = html;
    this.currentScene = scene;
    this.currentContext = context;

    // call onLoad
    if (scene.onLoad) {
      const maybeCleanup = await scene.onLoad(context, this);
      if (typeof maybeCleanup === "function") this._currentCleanup = maybeCleanup;
      else this._currentCleanup = null;
    }

    
    if (overlayShown && this._loadingOverlay) this._loadingOverlay.hide();
    
    if (this.transitionManager) {
      this.transitionManager.in(
        transition,
        this.root
      ).catch(console.error);
    }
    
  }

  async unload(clearPrev = true,clearDom = true) {
    if (this._currentCleanup) {
      try { await this._currentCleanup(); } catch (err) { console.warn("Scene cleanup failed", err); }
      this._currentCleanup = null;
    }
    if (this.currentScene && typeof this.currentScene.onUnload === "function") {
      try { await this.currentScene.onUnload(); } catch (err) { console.warn("scene onUnload error", err); }
    }

    if (clearDom) this.root.innerHTML = "";
    this.currentScene = null;

    if (clearPrev) {
      this.previousScene = null;
    }
  }

  async goBack(transition = null) {
    if (this.previousScene) {
      const { scene, context } = this.previousScene;
      this.previousScene = null;
      return this.load(scene, context, transition); // ✅ restore exact same context
    }
  }
}

export class TransitionManager {
  constructor() {
    this.transitions = new Map();
  }

  register(name, transition) {
    this.transitions.set(name, transition);
    console.log("transitions :", this.transitions)
  }

  async out(name, root) {
    console.log("executing out transition :", name)
    const t = this.transitions.get(name);
    console.log(t)
    if (t?.out) await t.out(root);
  }

  async in(name, root) {
    const t = this.transitions.get(name);
    if (t?.in) await t.in(root);
  }
}