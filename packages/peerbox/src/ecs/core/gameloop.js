// gameLoop.js

export const GameLoop = (() => {
  let running = false;
  let fps = 60;
  let interval = 1000 / fps;
  let lastTime = 0;
  let frameId = null;

  // lag threshold in ms to skip rendering but keep updating
  const maxLag = 100;

  // The main loop callback: receives deltaTime in ms
  let updateCallback = null;
  let renderCallback = null;

  function loop(timestamp) {
    if (!running) return;

    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;

    // If lagging too much, we can skip rendering frames to catch up
    if (delta > maxLag) {
      // update but no render
      updateCallback && updateCallback(delta);
      lastTime = timestamp;
      frameId = requestAnimationFrame(loop);
      return;
    }

    // Normal update and render
    const dt = delta / 1000; // convert to seconds
    updateCallback && updateCallback(dt);
    renderCallback && renderCallback(dt);

    lastTime = timestamp;
    frameId = requestAnimationFrame(loop);
  }

  function start({ onUpdate, onRender, targetFps = 60 }) {
    if (running) return;

    updateCallback = onUpdate;
    renderCallback = onRender;
    fps = targetFps;
    interval = 1000 / fps;

    running = true;
    lastTime = 0;
    frameId = requestAnimationFrame(loop);
  }

  function stop() {
    if (!running) return;

    running = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function isRunning() {
    return running;
  }

  return {
    start,
    stop,
    isRunning,
  };
})();
