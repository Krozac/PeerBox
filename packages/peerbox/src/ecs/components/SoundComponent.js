export function SoundComponent({ url, volume = 1.0, loop = false }) {
  return {
    url,       // URL of the audio file
    buffer: null, // AudioBuffer after loading
    volume,
    loop
  };
}
