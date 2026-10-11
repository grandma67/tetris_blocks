// Tiny WebAudio synth — no audio files to ship.
let ctx = null;
let master = null;
let enabled = true;

function ensure() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq, to = freq, dur = 0.12, type = 'sine', vol = 0.5, delay = 0 }) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.3, delay = 0 }) {
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, t0);
  filter.frequency.exponentialRampToValueAtTime(200, t0 + dur);
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

export const Sound = {
  setEnabled(v) {
    enabled = v;
  },
  unlock: () => ensure(),
  pick: () => tone({ freq: 660, to: 880, dur: 0.06, type: 'triangle', vol: 0.25 }),
  drop: () => tone({ freq: 220, to: 110, dur: 0.1, type: 'square', vol: 0.15 }),
  invalid: () => tone({ freq: 160, to: 120, dur: 0.12, type: 'sawtooth', vol: 0.12 }),
  clear(lines, combo) {
    const base = Math.min(combo, 4);
    for (let i = 0; i < Math.min(lines + 2, 6); i++) {
      tone({ freq: SCALE[Math.min(i + base, SCALE.length - 1)], dur: 0.16, type: 'triangle', vol: 0.3, delay: i * 0.06 });
    }
    if (lines >= 2) noise({ dur: 0.25 + lines * 0.08, vol: 0.12 + lines * 0.03 });
  },
  boardClear() {
    [0, 4, 7, 12, 16, 19, 24].forEach((st, i) =>
      tone({ freq: 523.25 * 2 ** (st / 12), dur: 0.3, type: 'triangle', vol: 0.3, delay: i * 0.07 }),
    );
    noise({ dur: 0.8, vol: 0.2, delay: 0.1 });
  },
  newRound: () => tone({ freq: 440, to: 660, dur: 0.12, type: 'sine', vol: 0.15 }),
  rotate() {
    tone({ freq: 500, to: 900, dur: 0.08, type: 'triangle', vol: 0.2 });
    tone({ freq: 700, to: 1200, dur: 0.06, type: 'sine', vol: 0.12, delay: 0.05 });
  },
  boom(delay = 0) {
    noise({ dur: 0.7, vol: 0.5, delay });
    tone({ freq: 140, to: 35, dur: 0.6, type: 'sine', vol: 0.6, delay });
    tone({ freq: 80, to: 30, dur: 0.4, type: 'square', vol: 0.15, delay });
  },
  rumble() {
    tone({ freq: 70, to: 140, dur: 0.5, type: 'sawtooth', vol: 0.18 });
    noise({ dur: 0.4, vol: 0.15 });
  },
  thud: () => tone({ freq: 180, to: 60, dur: 0.18, type: 'square', vol: 0.15 }),
  token() {
    [0, 7, 12].forEach((st, i) => tone({ freq: 880 * 2 ** (st / 12), dur: 0.14, type: 'sine', vol: 0.22, delay: 0.25 + i * 0.07 }));
  },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, to: f * 0.97, dur: 0.35, type: 'triangle', vol: 0.3, delay: i * 0.18 }));
  },
  highscore() {
    [0, 4, 7, 12, 7, 12, 16].forEach((st, i) =>
      tone({ freq: 523.25 * 2 ** (st / 12), dur: 0.22, type: 'square', vol: 0.12, delay: 0.9 + i * 0.1 }),
    );
  },
};
