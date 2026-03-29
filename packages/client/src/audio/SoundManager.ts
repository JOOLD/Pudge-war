/**
 * SoundManager — Web Audio API based sound effects for skills.
 * All sounds are synthesized procedurally, no external files needed.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Rot toggle: low buzzing start/stop sound.
 * @param on - true = rot activated, false = deactivated
 */
export function playRotToggle(on: boolean): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(on ? 80 : 60, now);
  osc.frequency.exponentialRampToValueAtTime(on ? 120 : 40, now + 0.15);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  osc.start(now);
  osc.stop(now + 0.2);
}

/**
 * Phase Shift: crystalline "ding~" (high sine + harmonics, 300ms)
 */
export function playPhaseShift(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Fundamental
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(1200, now);
  osc1.frequency.exponentialRampToValueAtTime(800, now + 0.3);
  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc1.start(now);
  osc1.stop(now + 0.35);

  // Harmonic
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(2400, now);
  osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.25);
  gain2.gain.setValueAtTime(0.1, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc2.start(now);
  osc2.stop(now + 0.3);

  // High shimmer
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.connect(gain3);
  gain3.connect(ctx.destination);
  osc3.type = "triangle";
  osc3.frequency.setValueAtTime(3600, now);
  gain3.gain.setValueAtTime(0.05, now);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc3.start(now);
  osc3.stop(now + 0.25);
}

/**
 * Dismember: "nom nom" repeating low frequency pulses (2 sec)
 */
export function playDismember(): void {
  const ctx = getCtx();
  const now = ctx.currentTime;

  // Create 4 "nom" pulses over 2 seconds
  for (let i = 0; i < 4; i++) {
    const t = now + i * 0.5;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "square";
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.start(t);
    osc.stop(t + 0.25);
  }
}
