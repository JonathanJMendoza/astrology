let context: AudioContext | undefined;

export function playTone(kind: 'spin' | 'stop' | 'win' | 'bonus', enabled: boolean) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    const notes = kind === 'bonus' ? [523, 659, 784, 1047] : kind === 'win' ? [440, 554, 659] : kind === 'spin' ? [220, 330] : [440];
    notes.forEach((frequency, i) => {
      const start = context!.currentTime + i * 0.09;
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.06, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      oscillator.connect(gain);
      gain.connect(context!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.26);
    });
  } catch { /* Audio is optional when browser playback is unavailable. */ }
}
