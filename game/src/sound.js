// Sound: every effect is synthesized with Web Audio — no audio files.
// The context is created lazily on the first user gesture so the page never
// errors before interaction.

let ctx = null;
let muted = false;

export function setMuted(m) {
  muted = m;
}

export function isMuted() {
  return muted;
}

function audio() {
  if (ctx === null) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type, gain, slideTo) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain, lowpass) {
  if (muted) return;
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const len = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  shoot() { tone(880, 0.07, 'triangle', 0.05, 440); },
  hit() { tone(220, 0.08, 'square', 0.06, 110); },
  kill() { tone(520, 0.12, 'triangle', 0.08, 180); noise(0.08, 0.05, 1200); },
  hurt() { tone(140, 0.2, 'sawtooth', 0.12, 60); },
  dash() { noise(0.16, 0.1, 3000); tone(300, 0.14, 'sine', 0.08, 700); },
  nova() { tone(180, 0.4, 'sine', 0.16, 60); noise(0.35, 0.12, 900); },
  kindle() { tone(392, 0.25, 'sine', 0.12); setTimeout(() => tone(587, 0.35, 'sine', 0.12), 90); },
  pickup() { tone(1046, 0.1, 'triangle', 0.07, 1568); },
  relic() { tone(523, 0.18, 'triangle', 0.1); setTimeout(() => tone(784, 0.3, 'triangle', 0.1), 120); },
  boss() { tone(65, 0.9, 'sawtooth', 0.18, 40); tone(98, 0.9, 'sawtooth', 0.12, 55); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'triangle', 0.12), i * 140)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'sine', 0.12), i * 180)); },
  click() { tone(660, 0.05, 'triangle', 0.06); },
};
