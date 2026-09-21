// Generates the SIGNATURE hit sound of the weekly series: a deep bass boom
// with a short noise transient (~0.6 s). Run once (`npm run hit` inside
// weekly/); the resulting weekly/audio/hit.mp3 is committed and reused every
// week. Re-running it produces a bit-identical file (seeded noise).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { unlinkSync } from "node:fs";
import { Buffer1, makeRng, ar, expDecay, lowpass, highpass, writeWav, wavToMp3 } from "./synth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const rng = makeRng(20260921);
const buf = new Buffer1(0.7);

// 1) sub boom: exponential pitch drop 170 Hz -> 36 Hz, long-ish decay, saturated
let phase = 0;
buf.add(0, 0.7, (t) => {
  const f = 36 + (170 - 36) * Math.exp(-t / 0.045);
  phase += (2 * Math.PI * f) / 44100;
  const body = Math.sin(phase) * ar(t, 0.0015, 0.19);
  return Math.tanh(body * 2.4) * 0.95;
});

// 2) noise transient: bright burst, ~35 ms, band-limited
{
  const hp = highpass(400);
  const lp = lowpass(9000);
  buf.add(0, 0.12, (t) => 0.55 * lp(hp(rng() * 2 - 1)) * ar(t, 0.0008, 0.028));
}

// 3) a darker "thud" noise layer under it for weight
{
  const lp = lowpass(900);
  buf.add(0, 0.2, (t) => 0.5 * lp(rng() * 2 - 1) * expDecay(t, 0.05));
}

// 4) tiny click on the very first millisecond so the transient reads on small speakers
buf.add(0, 0.01, (t) => 0.4 * Math.sin(2 * Math.PI * 3000 * t) * expDecay(t, 0.0015));

// short fade-out on the tail so the file ends clean
buf.gain((t) => (t > 0.6 ? Math.max(0, (0.7 - t) / 0.1) : 1));
buf.softClip(1.15);
buf.normalize(0.98);

const wav = join(here, "_build", "hit.wav");
const mp3 = join(here, "hit.mp3");
writeWav(wav, buf);
wavToMp3(wav, mp3, "192k");
unlinkSync(wav);
console.log("wrote", mp3);
