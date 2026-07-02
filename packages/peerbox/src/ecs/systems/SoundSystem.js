import { SoundComponent } from "../components/index.js";
export function SoundSystem(ecs) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const gainNodes = new Map();

  async function loadSound(entity, soundComp) {
    const response = await fetch(soundComp.url);
    const arrayBuffer = await response.arrayBuffer();
    soundComp.buffer = await audioCtx.decodeAudioData(arrayBuffer);
  }

  function playSound(entity) {
    const soundComp = ecs.getComponent(entity, SoundComponent);
    if (!soundComp || !soundComp.buffer) return;

    const source = audioCtx.createBufferSource();
    source.buffer = soundComp.buffer;
    source.loop = soundComp.loop;

    const gain = audioCtx.createGain();
    gain.gain.value = soundComp.volume;

    source.connect(gain).connect(audioCtx.destination);
    source.start(0);

    gainNodes.set(entity, { source, gain });
  }

  function stopSound(entity) {
    const nodes = gainNodes.get(entity);
    if (nodes) {
      nodes.source.stop();
      gainNodes.delete(entity);
    }
  }

  return { loadSound, playSound, stopSound };
}
