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
