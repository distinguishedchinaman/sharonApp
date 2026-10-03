// Prepare during the Save tap so mobile browsers permit playback after saving.
export function prepareVictoryFanfare(): { play: () => void; dispose: () => void } | undefined {
  try {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    const context = new Audio();
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      void context.close().catch(() => {});
    };
    // Handle a denied resume immediately, without affecting the game save.
    const ready = context.resume().then(() => true, () => { dispose(); return false; });
    return {
      dispose,
      play: () => {
        void ready.then(ok => {
          if (!ok || disposed) return;
          const start = context.currentTime + 0.04;
          const brass = context.createPeriodicWave(new Float32Array(9), new Float32Array([0, 1, 0.65, 0.45, 0.3, 0.2, 0.14, 0.09, 0.06]));
          const notes = [[523.25, 0, 0.16], [523.25, 0.22, 0.16], [783.99, 0.44, 0.28], [1046.5, 0.8, 0.85], [659.25, 0.8, 0.85], [783.99, 0.8, 0.85]];
          for (const [frequency, offset, duration] of notes) {
            const horn = context.createOscillator();
            const envelope = context.createGain();
            const tone = context.createBiquadFilter();
            horn.setPeriodicWave(brass);
            horn.frequency.value = frequency;
            tone.type = 'lowpass';
            tone.frequency.value = 4000;
            const at = start + offset;
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(0.07, at + 0.025);
            envelope.gain.linearRampToValueAtTime(0.045, at + duration * 0.7);
            envelope.gain.linearRampToValueAtTime(0, at + duration);
            horn.connect(tone).connect(envelope).connect(context.destination);
            horn.start(at);
            horn.stop(at + duration + 0.02);
          }
          setTimeout(dispose, 2200);
        }).catch(dispose);
      },
    };
  } catch {
    // Audio is a bonus; unsupported browsers still save the game normally.
    return;
  }
}
