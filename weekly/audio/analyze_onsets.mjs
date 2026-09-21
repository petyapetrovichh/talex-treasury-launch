// Onset / loudness analysis helper used to build audio/beats.json for a track.
// Usage: ffmpeg -i audio/music.mp3 -ac 1 -ar 22050 -f f32le /tmp/music.f32 && node audio/analyze_onsets.mjs /tmp/music.f32
// Prints every transient (time, relative strength, peak RMS, low-band peak) and a 0.5 s loudness contour.
import { readFileSync } from "node:fs";
const sr = 22050, hop = Math.round(sr * 0.005); // 5 ms
const raw = readFileSync(process.argv[2]);
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const n = Math.floor(x.length / hop);
// RMS envelope (5 ms) + low band (< ~150 Hz via crude one-pole) for stomp/kick emphasis
const env = new Float32Array(n), low = new Float32Array(n);
let lp = 0; const a = 1 - Math.exp(-2 * Math.PI * 150 / sr);
for (let i = 0; i < n; i++) {
  let s = 0, sl = 0;
  for (let j = 0; j < hop; j++) { const v = x[i * hop + j]; lp += a * (v - lp); s += v * v; sl += lp * lp; }
  env[i] = Math.sqrt(s / hop); low[i] = Math.sqrt(sl / hop);
}
const db = (v) => 20 * Math.log10(Math.max(v, 1e-6));
// onset strength: rise of envelope over the previous 40 ms
const flux = new Float32Array(n);
for (let i = 8; i < n; i++) flux[i] = Math.max(0, env[i] - Math.min(env[i - 8], env[i - 6], env[i - 4]));
const peaks = [];
const maxF = Math.max(...flux);
for (let i = 1; i < n - 1; i++) {
  if (flux[i] > 0.12 * maxF && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
    if (peaks.length && i - peaks[peaks.length - 1].i < 16) { if (flux[i] > peaks[peaks.length - 1].f) peaks[peaks.length - 1] = { i, f: flux[i] }; continue; }
    peaks.push({ i, f: flux[i] });
  }
}
console.log("duration", (x.length / sr).toFixed(3), "s");
console.log("t(s)   strength  rms(dB)  low(dB)");
for (const p of peaks) {
  const t = (p.i * hop / sr);
  const peakEnv = Math.max(...env.slice(p.i, p.i + 10)), peakLow = Math.max(...low.slice(p.i, p.i + 10));
  console.log(t.toFixed(3).padStart(6), (p.f / maxF).toFixed(2).padStart(8), db(peakEnv).toFixed(1).padStart(8), db(peakLow).toFixed(1).padStart(8));
}
// loudness contour every 0.5 s
let line = "rms per 0.5s:";
for (let t = 0; t < x.length / sr; t += 0.5) { const i0 = Math.round(t / 0.005), i1 = Math.min(n, i0 + 100); let s = 0; for (let i = i0; i < i1; i++) s += env[i] * env[i]; line += ` ${t.toFixed(1)}:${db(Math.sqrt(s / (i1 - i0))).toFixed(0)}`; }
console.log(line);
