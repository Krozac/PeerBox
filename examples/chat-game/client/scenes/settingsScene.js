import { Scene } from "../../../../framework/dist/index.js";
import { env } from "../clientEnv.js";


export const SettingsScene = new Scene({
  name: "menu",
  htmlPath: "scenes/settingsScene.html",
  onLoad: ({world, client}, sceneManager) => {
    console.log("Settings loaded");

    // Handle resolution changes
    const resolutionSelect = document.getElementById("resolutionSelect");
    if (resolutionSelect) {
      resolutionSelect.addEventListener("change", (e) => {
        const [width, height] = e.target.value.split("x").map(Number);
        console.log(`Resolution changed to ${width}x${height}`);
        // Emit custom event or IPC for electron
        console.log(env.window)
        if (env?.window?.resize) {
          env.window.resize(width, height);
        }
      });
    }

    // Handle fullscreen toggle
    const fullscreenBtn = document.getElementById("fullscreenBtn");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.body.requestFullscreen();
        }
      });
    }

    // Back to chat/game
    const backBtn = document.getElementById("backBtn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        sceneManager.goBack();
      });
    }
  }
});
