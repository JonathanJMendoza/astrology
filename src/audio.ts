export type Sound = 'spin' | 'stop' | 'win' | 'bonus' | 'pick' | 'grand' | 'credit';
let context: AudioContext | undefined;
let master: GainNode | undefined;
let motor: AudioBufferSourceNode | undefined;
let enabled = true;

function note(ctx: BaseAudioContext, output: AudioNode, frequency: number, at: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency = frequency) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(output);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}

// The same synthesizer is exercised with OfflineAudioContext in browser tests.
export function scheduleSound(ctx: BaseAudioContext, output: AudioNode, kind: Sound, at = ctx.currentTime, reel = 0) {
  if (kind === 'stop') {
    note(ctx, output, 145 + reel * 23, at, 0.085, 0.18, 'triangle', 65);
    note(ctx, output, 1800, at, 0.025, 0.035, 'square', 650);
    return;
  }
  if (kind === 'spin') {
    note(ctx, output, 90, at, 0.16, 0.18, 'triangle', 180);
    [740, 988, 1480].forEach((hz, i) => note(ctx, output, hz, at + i * 0.035, 0.2, 0.065));
    return;
  }
  if (kind === 'credit' || kind === 'pick') {
    [1175, 1760, 2349].forEach((hz, i) => note(ctx, output, hz, at + i * 0.055, 0.28, 0.08));
    return;
  }
  const melody = kind === 'win' ? [523, 659, 784, 1047, 1319, 1568] :
    kind === 'grand' ? [262, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093] : [392, 494, 587, 784, 988, 1175, 1568];
  melody.forEach((hz, i) => {
    note(ctx, output, hz, at + i * 0.105, 0.55, 0.09, 'triangle');
    note(ctx, output, hz * 2, at + i * 0.105, 0.4, 0.025);
  });
  for (let i = 0; i < (kind === 'grand' ? 25 : 13); i++) {
    note(ctx, output, 1900 + (i % 4) * 310, at + 0.25 + i * 0.055, 0.07, 0.035);
  }
  if (kind !== 'win') [130.81, 164.81, 196].forEach(hz => note(ctx, output, hz, at, 1.6, 0.06, 'triangle'));
}

function unlock() {
  context ??= new AudioContext();
  if (!master) {
    master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.connect(compressor).connect(context.destination);
    master.gain.value = enabled ? 0.6 : 0;
  }
  void context.resume().catch(() => {});
  return context;
}
export function stopReels() {
  try { motor?.stop(); motor?.disconnect(); } catch { /* The source may already have stopped. */ }
  motor = undefined;
}
export function setAudioEnabled(value: boolean) {
  enabled = value;
  if (context && master) {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(value ? 0.6 : 0, context.currentTime, 0.015);
  }
  if (!value) stopReels();
}
export function playTone(kind: Sound, sound: boolean, reel = 0) {
  setAudioEnabled(sound);
  if (!sound) return;
  try {
    const ctx = unlock();
    scheduleSound(ctx, master!, kind, ctx.currentTime, reel);
    if (kind === 'spin') {
      stopReels();
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const t = i / ctx.sampleRate;
        const tick = Math.exp(-(t % 0.03) * 750);
        samples[i] = 0.045 * Math.sin(t * 2 * Math.PI * 95) + 0.06 * tick * Math.sin(t * 2 * Math.PI * 1700);
      }
      motor = ctx.createBufferSource();
      motor.buffer = buffer;
      motor.loop = true;
      motor.connect(master!);
      motor.start();
    }
  } catch { /* Browsers without Web Audio can still play the game. */ }
}
