// EMBERKEEP — sound: every effect is synthesized with the Web Audio API.
// No audio files, no network: oscillators, noise and gain envelopes only.
// The context is created lazily on the first user gesture, as browsers require.

/** A tiny noise buffer, built once and reused by every noisy effect. */
function makeNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.drone = null;
  }

  /** Create (or resume) the audio context. Safe to call on every gesture. */
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.42;
        this.master.connect(this.ctx.destination);
        this.noise = makeNoiseBuffer(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.02);
    }
  }

  /** One oscillator blip with a pitch glide and a quick fade. */
  tone(freqFrom, freqTo, dur, type, vol, delay = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqFrom, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (err) { /* audio is best-effort */ }
  }

  /** A burst of filtered noise, for thuds, booms and whooshes. */
  burst(dur, filterFreq, vol, type = 'lowpass', delay = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch (err) { /* audio is best-effort */ }
  }

  shoot() { this.tone(880, 520, 0.09, 'square', 0.05); }
  hit() { this.tone(220, 140, 0.07, 'triangle', 0.1); }
  kill() { this.tone(340, 60, 0.22, 'sawtooth', 0.12); this.burst(0.18, 700, 0.12); }
  pickup() { this.tone(1240, 1860, 0.12, 'sine', 0.12); }
  heal() { this.tone(520, 780, 0.18, 'sine', 0.14); this.tone(780, 1040, 0.18, 'sine', 0.1, 0.09); }
  hurt() { this.tone(160, 55, 0.3, 'sawtooth', 0.2); this.burst(0.25, 300, 0.2); }
  dash() { this.burst(0.22, 2400, 0.14, 'bandpass'); this.tone(300, 900, 0.16, 'sine', 0.08); }
  nova() { this.burst(0.6, 500, 0.3); this.tone(120, 40, 0.55, 'sine', 0.3); this.tone(660, 1320, 0.3, 'triangle', 0.1, 0.05); }
  click() { this.tone(700, 900, 0.06, 'sine', 0.1); }
  upgrade() { this.tone(523, 523, 0.12, 'triangle', 0.14); this.tone(659, 659, 0.12, 'triangle', 0.14, 0.1); this.tone(784, 784, 0.2, 'triangle', 0.14, 0.2); }
  waveHorn() { this.tone(196, 196, 0.5, 'sawtooth', 0.12); this.tone(147, 147, 0.5, 'sawtooth', 0.1, 0.02); this.tone(294, 294, 0.35, 'triangle', 0.1, 0.08); }
  bossRoar() { this.tone(90, 45, 1.1, 'sawtooth', 0.25); this.burst(1.0, 220, 0.25); this.tone(60, 38, 1.2, 'square', 0.14, 0.1); }

  victory() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => this.tone(f, f, 0.22, 'triangle', 0.15, i * 0.14));
  }

  gameOver() {
    this.tone(220, 110, 1.4, 'sine', 0.2);
    this.tone(165, 82, 1.6, 'triangle', 0.14, 0.15);
  }

  /** The boss's low drone: two detuned oscillators plus a slow wobble. */
  startBossDrone() {
    if (!this.ctx || this.muted || this.drone) return;
    try {
      const ctx = this.ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      gain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.5);
      const o1 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.value = 55;
      const o2 = ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.value = 55.7;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      o1.connect(filter);
      o2.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      o1.start();
      o2.start();
      lfo.start();
      this.drone = { gain, o1, o2, lfo };
    } catch (err) { /* audio is best-effort */ }
  }

  stopBossDrone() {
    if (!this.drone || !this.ctx) return;
    try {
      const d = this.drone;
      d.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      const stopAt = this.ctx.currentTime + 0.8;
      d.o1.stop(stopAt);
      d.o2.stop(stopAt);
      d.lfo.stop(stopAt);
    } catch (err) { /* audio is best-effort */ }
    this.drone = null;
  }
}
