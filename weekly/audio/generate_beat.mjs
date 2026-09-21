// Generates the music bed for the weekly video, REBUILT ON EVERY RENDER from
// data/week.json + src/schedule.mjs so the musical accents land exactly on:
//   - the Counter Slam (schedule.slamAt)
//   - the receipt stamp (schedule.stampAt)
//   - EACH day-step of the Active holders chart (schedule.steps[])
// with a build-up through the chart that peaks on the growth badge
// (schedule.badgeAt), a resolve on the logo (schedule.logoAt) and a fade-out.
//
// Usage (from weekly/):  node audio/generate_beat.mjs [--out audio/_build/music.mp3]
// If audio/weekly_music_override.mp3 exists, scripts/weekly.mjs uses that
// instead (see prepareMusic in scripts/weekly.mjs) — this file is then skipped.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, unlinkSync, mkdirSync } from "node:fs";
import { buildSchedule } from "../src/schedule.mjs";
import {
  Buffer1, makeRng, kick, hat, clap, crash, rim, bassPulse, blip, stab, pad,
  lowpassVar, ar, writeWav, wavToMp3,
} from "./synth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

export function generateBeat(data, outMp3) {
  const S = buildSchedule(data);
  const T = S.duration;
  const BEAT = S.beat;
  const E8 = BEAT / 2;
  const E16 = BEAT / 4;
  const rng = makeRng(0x5a1e5);

  const drums = new Buffer1(T);
  const bass = new Buffer1(T);
  const tones = new Buffer1(T);
  const fx = new Buffer1(T);

  const near = (t, list, eps = 0.03) => list.some((x) => Math.abs(x - t) < eps);
  const accents = [S.slamAt, S.stampAt, ...S.steps, S.badgeAt, S.logoAt];
  const grooveStart = S.slamAt;            // full drums kick in on the slam
  const grooveEnd = S.logoAt;              // drums stop on the logo, pad resolves
  const buildStart = S.steps[0] - S.stepInterval; // chart build-up window
  const buildEnd = S.badgeAt;

  // ---- KICK on every beat, dropping the beat right after the badge for a breath
  for (let b = 0; ; b++) {
    const t = b * BEAT;
    if (t >= grooveEnd - 1e-6) break;
    if (t < grooveStart - 1e-6) continue;
    if (t > S.badgeAt + 0.01 && t < S.badgeAt + BEAT * 1.5) continue; // breath after the peak
    if (near(t, accents)) continue; // accents place their own, bigger kick
    kick(drums, t, { amp: 0.9 });
  }

  // ---- HATS: 8ths, tightening to 16ths as the chart build-up progresses
  for (let i = 0; ; i++) {
    const t = i * E8;
    if (t >= grooveEnd) break;
    const off = i % 2 === 1;
    const intro = t < grooveStart;
    const buildP = t > buildStart && t < buildEnd ? (t - buildStart) / (buildEnd - buildStart) : 0;
    const amp = (intro ? 0.12 : off ? 0.22 : 0.15) * (1 + 0.5 * buildP);
    hat(drums, t, rng, { amp, decay: 0.018 + 0.01 * (off ? 1 : 0) });
    if (buildP > 0.35 || (i % 8 === 7)) {
      hat(drums, t + E16, rng, { amp: amp * 0.55, decay: 0.012 });
    }
  }
  // an open hat on the "and" of 4 every bar for lift
  for (let bar = 0; ; bar++) {
    const t = bar * BEAT * 4 + BEAT * 3.5;
    if (t >= grooveEnd) break;
    if (t < grooveStart) continue;
    hat(drums, t, rng, { amp: 0.12, decay: 0.03, open: true });
  }

  // ---- CLAPS on 2 and 4
  for (let bar = 0; ; bar++) {
    for (const beat of [1, 3]) {
      const t = bar * BEAT * 4 + beat * BEAT;
      if (t >= grooveEnd) break;
      if (t < grooveStart) continue;
      if (near(t, accents)) continue;
      clap(drums, t, rng, { amp: 0.42 });
    }
    if (bar * BEAT * 4 >= grooveEnd) break;
  }

  // ---- BASS pulse: 8th notes, root with a lift to the 5th on the last beat of each bar
  const ROOT = 43.65; // F1
  const FIFTH = 65.41; // C2
  for (let i = 0; ; i++) {
    const t = i * E8;
    if (t >= grooveEnd) break;
    const inBar = i % 8;
    const f = inBar >= 6 ? FIFTH : ROOT;
    const intro = t < grooveStart;
    const p = t > buildStart && t < buildEnd ? (t - buildStart) / (buildEnd - buildStart) : 0;
    bassPulse(bass, t, f, { amp: (intro ? 0.28 : 0.5) * (1 - 0.25 * p), decay: 0.08 + 0.03 * (inBar % 2) });
  }

  // ---- ACCENT: Counter slam — crash + heavy kick (hit.mp3 plays on top from the composition)
  kick(drums, S.slamAt, { amp: 1.0, f0: 190, f1: 42, decay: 0.2 });
  crash(fx, S.slamAt, rng, { amp: 0.3, decay: 0.45 });

  // ---- ACCENT: receipt stamp — clap + kick + short crash
  kick(drums, S.stampAt, { amp: 0.95, decay: 0.16 });
  clap(drums, S.stampAt, rng, { amp: 0.6 });
  crash(fx, S.stampAt, rng, { amp: 0.18, decay: 0.25 });

  // ---- ACCENTS: each day-step — rim + rising blip + kick, pitch climbs per step
  const semis = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24, 26, 27, 29, 31, 32, 34, 36];
  const base = 523.25; // C5
  S.steps.forEach((t, i) => {
    const semi = semis[Math.min(i, semis.length - 1)];
    const f = base * Math.pow(2, semi / 12);
    const p = i / Math.max(1, S.steps.length - 1);
    kick(drums, t, { amp: 0.8 + 0.2 * p, decay: 0.12 });
    rim(drums, t, { amp: 0.28 + 0.15 * p, freq: 1600 + 600 * p });
    blip(tones, t, f, { amp: 0.22 + 0.16 * p, decay: 0.1 + 0.06 * p });
  });

  // ---- BUILD-UP riser: filtered noise opening + sine climbing, ends on the badge
  {
    const lp = lowpassVar();
    const len = buildEnd - buildStart;
    fx.add(buildStart, len, (t) => {
      const p = t / len;
      const cutoff = 300 + 9000 * p * p;
      const n = lp(rng() * 2 - 1, cutoff);
      const sine = Math.sin(2 * Math.PI * (180 + 900 * p * p) * t) * 0.25;
      return (0.05 + 0.35 * p * p) * (n * 0.8 + sine);
    });
  }

  // ---- PEAK on the badge: crash + double kick + sub drop
  kick(drums, S.badgeAt, { amp: 1.0, f0: 200, f1: 40, decay: 0.24 });
  crash(fx, S.badgeAt, rng, { amp: 0.4, decay: 0.6 });
  stab(tones, S.badgeAt, [174.61, 261.63, 349.23], { amp: 0.28, decay: 0.35, len: 1.5 }); // F major

  // ---- RESOLVE on the logo: final stab + kick + crash, then a pad that carries the tail
  kick(drums, S.logoAt, { amp: 1.0, f0: 180, f1: 40, decay: 0.26 });
  crash(fx, S.logoAt, rng, { amp: 0.32, decay: 0.7 });
  stab(tones, S.logoAt, [87.31, 174.61, 261.63, 349.23, 440.0], { amp: 0.34, decay: 0.7, len: T - S.logoAt }); // F add9
  pad(tones, S.logoAt, [174.61, 261.63, 349.23, 440.0], { amp: 0.16, attack: 0.5, len: T - S.logoAt });
  bassPulse(bass, S.logoAt, ROOT, { amp: 0.55, len: 1.6, decay: 0.9 });

  // ---- MIX
  const mix = new Buffer1(T);
  mix.mix(drums, 1.0);
  mix.mix(bass, 0.85);
  mix.mix(tones, 0.9);
  mix.mix(fx, 0.8);

  // duck the bed around the two hit-sound moments so hit.mp3 cuts through
  const duck = (t, t0, depth, w) => {
    const d = t - t0;
    if (d < -0.04) return 1;
    return 1 - depth * Math.exp(-(d * d) / (w * w)) * (d < 0 ? Math.exp(d * 60) : 1);
  };
  const fadeIn = 0.6;
  const fadeOutStart = S.fadeOutStart;
  mix.gain((t) => {
    let g = 1;
    g *= duck(t, S.slamAt, 0.55, 0.22);
    g *= duck(t, S.stampAt, 0.4, 0.2);
    if (t < fadeIn) g *= t / fadeIn;
    if (t > fadeOutStart) g *= Math.max(0, 1 - (t - fadeOutStart) / (T - fadeOutStart));
    return g;
  });
  mix.softClip(1.25);
  mix.normalize(0.89);

  mkdirSync(dirname(outMp3), { recursive: true });
  const wav = outMp3.replace(/\.mp3$/, ".wav");
  writeWav(wav, mix);
  wavToMp3(wav, outMp3, "192k");
  unlinkSync(wav);
  return { schedule: S, out: outMp3 };
}

// CLI entry
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outIdx = process.argv.indexOf("--out");
  const out = outIdx > -1 ? process.argv[outIdx + 1] : join(root, "audio", "_build", "music.mp3");
  const data = JSON.parse(readFileSync(join(root, "data", "week.json"), "utf8"));
  const r = generateBeat(data, out);
  console.log(`beat: ${r.schedule.bpm} BPM, accents at slam ${r.schedule.slamAt}s, stamp ${r.schedule.stampAt}s, steps ${r.schedule.steps.join(", ")}s, badge ${r.schedule.badgeAt}s, logo ${r.schedule.logoAt}s -> ${out}`);
}
