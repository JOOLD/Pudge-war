/**
 * Procedural sound effects using Web Audio API.
 * No audio files needed — all sounds are synthesized.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private resumed: boolean = false;

  constructor() {
    try {
      this.ctx = new AudioContext();
    } catch {
      // Web Audio API not supported
    }
  }

  /**
   * Ensure AudioContext is resumed after user interaction.
   * Must be called from a user gesture event handler (click/touch).
   */
  tryResume(): void {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().then(() => {
        this.resumed = true;
      });
    } else {
      this.resumed = true;
    }
  }

  /** Short rising pitch sweep (200Hz -> 800Hz over 100ms) */
  playHookThrow(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.1);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.12);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Punchy impact: white noise burst 50ms + low sine 100Hz 50ms */
  playHookHit(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;

    // White noise burst
    const bufferSize = ctx.sampleRate * 0.05;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.1, now);
    noiseGain.gain.linearRampToValueAtTime(0, now + 0.05);
    noise.connect(noiseGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.06);

    // Low sine thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(100, now);

    oscGain.gain.setValueAtTime(0.12, now);
    oscGain.gain.linearRampToValueAtTime(0, now + 0.05);

    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Satisfying "ding": sine 880Hz, 200ms, quick fade */
  playKill(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Soft "whoosh": filtered noise sweep, 200ms */
  playRespawn(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;

    // Noise source
    const bufferSize = ctx.sampleRate * 0.25;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter sweep
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(2, now);
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.linearRampToValueAtTime(2000, now + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.25);
  }

  destroy(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

// ============================================================
// Standalone skill sound functions (Phase B)
// ============================================================

let skillAudioCtx: AudioContext | null = null;

function getSkillCtx(): AudioContext {
  if (!skillAudioCtx) {
    skillAudioCtx = new AudioContext();
  }
  if (skillAudioCtx.state === "suspended") {
    skillAudioCtx.resume();
  }
  return skillAudioCtx;
}

/**
 * Rot toggle: low buzzing start/stop sound.
 * @param on - true = rot activated, false = deactivated
 */
export function playRotToggle(on: boolean): void {
  const ctx = getSkillCtx();
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
  const ctx = getSkillCtx();
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
  const ctx = getSkillCtx();
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
