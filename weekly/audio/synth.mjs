// Tiny deterministic synth toolkit (no dependencies) used by generate_hit.mjs
// and generate_beat.mjs. Renders Float64 sample buffers and writes 16-bit WAV;
// ffmpeg (required by HyperFrames anyway) turns the WAV into MP3.
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const SR = 44100;

export function makeRng(seed) {
  // mulberry32 — deterministic so every render produces identical audio
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Buffer1 {
  constructor(seconds) {
    this.n = Math.round(seconds * SR);
    this.d = new Float64Array(this.n);
  }
  /** add a generated signal starting at `at` seconds; fn(tLocal) -> sample */
  add(at, seconds, fn) {
    const s0 = Math.round(at * SR);
    const len = Math.min(Math.round(seconds * SR), this.n - s0);
    for (let i = 0; i < len; i++) {
      this.d[s0 + i] += fn(i / SR, i);
    }
  }
  /** multiply the whole buffer by gain(tAbs) */
  gain(fn) {
    for (let i = 0; i < this.n; i++) this.d[i] *= fn(i / SR);
  }
  mix(other, g = 1) {
    const len = Math.min(this.n, other.n);
    for (let i = 0; i < len; i++) this.d[i] += other.d[i] * g;
  }
  peak() {
    let p = 0;
    for (let i = 0; i < this.n; i++) p = Math.max(p, Math.abs(this.d[i]));
    return p;
  }
  normalize(peakTarget = 0.95) {
    const p = this.peak() || 1;
    const g = peakTarget / p;
    for (let i = 0; i < this.n; i++) this.d[i] *= g;
  }
  softClip(drive = 1) {
    for (let i = 0; i < this.n; i++) this.d[i] = Math.tanh(this.d[i] * drive) / Math.tanh(drive);
  }
}

// ---- envelopes -------------------------------------------------------------
export const expDecay = (t, tau) => Math.exp(-t / tau);
export function ar(t, attack, release) {
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / release);
}

// ---- one-pole filters (stateful, create per voice) -------------------------
export function lowpass(cutoff) {
  let y = 0;
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  return (x) => (y += a * (x - y));
}
export function highpass(cutoff) {
  const lp = lowpass(cutoff);
  return (x) => x - lp(x);
}
/** low-pass with a time-varying cutoff (Hz) */
export function lowpassVar() {
  let y = 0;
  return (x, cutoff) => {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    return (y += a * (x - y));
  };
}

// ---- drum voices -----------------------------------------------------------
export function kick(buf, at, { amp = 1, f0 = 160, f1 = 48, sweep = 0.05, decay = 0.13, click = 0.4 } = {}) {
  let phase = 0;
  buf.add(at, 0.6, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t / sweep);
    phase += (2 * Math.PI * f) / SR;
    const body = Math.sin(phase) * ar(t, 0.001, decay);
    const c = click * Math.sin(2 * Math.PI * 2200 * t) * expDecay(t, 0.004);
    return amp * Math.tanh((body + c) * 1.6);
  });
}

export function hat(buf, at, rng, { amp = 0.25, decay = 0.02, open = false } = {}) {
  const hp = highpass(6500);
  const lp = lowpass(14000);
  const d = open ? decay * 6 : decay;
  buf.add(at, open ? 0.35 : 0.08, (t) => amp * lp(hp(rng() * 2 - 1)) * ar(t, 0.0005, d));
}

export function clap(buf, at, rng, { amp = 0.6, decay = 0.07 } = {}) {
  const hp = highpass(900);
  const lp = lowpass(5500);
  buf.add(at, 0.3, (t) => {
    // three micro-bursts then a tail: the classic clap shape
    let env = 0;
    for (let k = 0; k < 3; k++) {
      const tk = t - k * 0.009;
      if (tk >= 0) env += 0.6 * Math.exp(-tk / 0.006);
    }
    const tail = t > 0.026 ? Math.exp(-(t - 0.026) / decay) : 0;
    return amp * lp(hp(rng() * 2 - 1)) * (env + tail);
  });
}

export function crash(buf, at, rng, { amp = 0.35, decay = 0.5 } = {}) {
  const hp = highpass(3000);
  buf.add(at, decay * 4, (t) => amp * hp(rng() * 2 - 1) * ar(t, 0.002, decay));
}

export function rim(buf, at, { amp = 0.35, freq = 1800, decay = 0.02 } = {}) {
  buf.add(at, 0.1, (t) => amp * Math.sin(2 * Math.PI * freq * t) * ar(t, 0.0005, decay));
}

// ---- tonal voices ----------------------------------------------------------
export function bassPulse(buf, at, freq, { amp = 0.5, len = 0.22, decay = 0.09 } = {}) {
  const lp = lowpass(420);
  buf.add(at, len, (t) => {
    const s = Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(2 * Math.PI * freq * 2 * t);
    const sq = Math.tanh(s * 2.2);
    return amp * lp(sq) * ar(t, 0.003, decay);
  });
}

export function blip(buf, at, freq, { amp = 0.3, decay = 0.09 } = {}) {
  buf.add(at, 0.4, (t) => {
    const s = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(2 * Math.PI * freq * 2 * t) + 0.1 * Math.sin(2 * Math.PI * freq * 3 * t);
    return amp * s * ar(t, 0.002, decay);
  });
}

export function stab(buf, at, freqs, { amp = 0.35, decay = 0.5, len = 2.5 } = {}) {
  const lp = lowpass(3200);
  buf.add(at, len, (t) => {
    let s = 0;
    for (const f of freqs) s += Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.005 * t);
    return amp * lp(s / freqs.length) * ar(t, 0.004, decay);
  });
}

export function pad(buf, at, freqs, { amp = 0.2, attack = 0.4, len = 3 } = {}) {
  const lp = lowpass(1800);
  buf.add(at, len, (t) => {
    let s = 0;
    for (const f of freqs) {
      s += Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.004 * t + 1) + 0.4 * Math.sin(2 * Math.PI * f * 0.5 * t);
    }
    const env = Math.min(1, t / attack);
    return amp * lp(s / (freqs.length * 2.4)) * env;
  });
}

// ---- output ----------------------------------------------------------------
export function writeWav(path, buf) {
  const n = buf.n;
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + n * 2, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, buf.d[i]));
    bytes.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(path, bytes);
}

export function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.error) throw new Error("ffmpeg not found on PATH (HyperFrames needs it too): " + r.error.message);
  if (r.status !== 0) throw new Error("ffmpeg failed with exit code " + r.status);
}

export function wavToMp3(wav, mp3, bitrate = "192k") {
  ffmpeg(["-i", wav, "-codec:a", "libmp3lame", "-b:a", bitrate, mp3]);
}
