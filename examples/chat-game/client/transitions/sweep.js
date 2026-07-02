function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadHTML(path) {
  const res = await fetch(path);
  console.log(res)
  return res.text();
}

export const SweepRightTransition = {
  async out() {
    const layer = document.getElementById("scene-transition-layer");


    let transition = await loadHTML('transitions/sweep.html')
    layer.innerHTML = transition

    const container = document.querySelector(".sweep-container");
    container?.classList.add("right");

    await wait(400);
  },

  async in() {
    const layer = document.getElementById(
      "scene-transition-layer"
    );

    await wait(400);

    layer.innerHTML = "";
  }
};

export const SweepLeftTransition = {
  async out() {
    const layer = document.getElementById("scene-transition-layer");
    
    let transition = await loadHTML('transitions/sweep.html')
    layer.innerHTML = transition

    const container = document.querySelector(".sweep-container");
    container?.classList.add("left");

    await wait(400);
  },

  async in() {
    const layer = document.getElementById(
      "scene-transition-layer"
    );

    await wait(400);

    layer.innerHTML = "";
  }
};