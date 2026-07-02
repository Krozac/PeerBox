import { Scene } from "peerbox";
import { env } from "../clientEnv.js";


const resolutions = [
  "1920x1080",
  "1600x900",
  "1280x720",
  "900x900"
];


export const SettingsScene = new Scene({
  name: "menu",
  htmlPath: "scenes/settingsScene.html",
  onLoad: ({world, client}, sceneManager) => {
    console.log("Settings loaded");

    sceneManager.setTitle("Settings");

    // Handle resolution changes
    const resolutionSelect = document.getElementById("resolutionSelect");
    const resolutionHint = document.getElementById("resolutionHint");

    const nativeRes = `${screen.width}x${screen.height}`;

    if (!resolutions.includes(nativeRes)) {
      resolutions.unshift(nativeRes);
    }

    resolutionSelect.innerHTML = "";

    for (const res of resolutions) {
      const option = document.createElement("option");

      option.value = res;

      if (res === nativeRes) {
        option.textContent = `${res} (Native)`;
      } else {
        option.textContent = res;
      }

      resolutionSelect.appendChild(option);
    }

    
    const savedResolution = localStorage.getItem("selectedResolution") || "1920x1080";
    
    resolutionSelect.value = savedResolution;

    function updateResolutionHint(value) {
      const [w, h] = value.split("x").map(Number);

      const ratio = w / h;
      const is16by9 = Math.abs(ratio - (16 / 9)) < 0.02;

      resolutionHint.textContent = is16by9
        ? ""
        : "This resolution uses a different aspect ratio. Black bars may appear.";
    }

    resolutionSelect.addEventListener("change", (e) => {
      const value = e.target.value;

      updateResolutionHint(value);

      localStorage.setItem("selectedResolution", value);

      const [width, height] = value.split("x").map(Number);

      env.window.resize(width, height);
    });

    
    updateResolutionHint(resolutionSelect.value);

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
        sceneManager.goBack("bubbles-sweep-left");
      });
    }
  }
});
