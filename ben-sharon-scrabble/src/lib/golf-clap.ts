// Unlock audio during the Save tap, then play the supplied clip only after success.
export function prepareGolfClap(audioUrl = '/ben-excellent.mp3'): { play: () => void; dispose: () => void } | undefined {
  try {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    const abort = new AbortController();
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      abort.abort();
      void context.close().catch(() => {});
    };
    const ready = Promise.all([
      context.resume(),
      fetch(audioUrl, { signal: abort.signal }).then(response => {
        if (!response.ok) throw new Error('Celebration audio unavailable');
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)),
    ]).then(([, buffer]) => buffer, () => { dispose(); return null; });
    return {
      dispose,
      play: () => {
        void ready.then(buffer => {
          if (!buffer || disposed) return;
          const clap = context.createBufferSource();
          const volume = context.createGain();
          clap.buffer = buffer;
          volume.gain.value = 0.6;
          clap.connect(volume).connect(context.destination);
          clap.onended = dispose;
          clap.start();
        }).catch(dispose);
      },
    };
  } catch {
    // Audio problems must never prevent the game from being saved.
    return;
  }
}
