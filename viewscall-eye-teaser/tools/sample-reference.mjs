// Measure the reference logo: dominant eye colour, eye bbox, pupil bbox.
// Usage:  npx -y -p pngjs node tools/sample-reference.mjs assets/ViewsCall_eye.png
import fs from "node:fs";
import { createRequire } from "node:module";
const { PNG } = createRequire(import.meta.url)("pngjs");

const file = process.argv[2] ?? "assets/ViewsCall_eye.png";
const png = PNG.sync.read(fs.readFileSync(file));
const { width, height, data } = png;

const counts = new Map();
let eye = { x0: width, y0: height, x1: -1, y1: -1 };
const isBg = (r, g, b, a) => a < 128 || (r > 240 && g > 240 && b > 240);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (isBg(r, g, b, a)) continue;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (x < eye.x0) eye.x0 = x;
    if (x > eye.x1) eye.x1 = x;
    if (y < eye.y0) eye.y0 = y;
    if (y > eye.y1) eye.y1 = y;
  }
}
const [dominant] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const hex = "#" + dominant[0].toString(16).padStart(6, "0").toUpperCase();

// pupil = white pixels inside the eye bbox
let pupil = { x0: width, y0: height, x1: -1, y1: -1 };
for (let y = eye.y0; y <= eye.y1; y++) {
  for (let x = eye.x0; x <= eye.x1; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128 || !(data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240)) continue;
    // ignore background white touching the bbox edge by requiring red neighbours on both sides in the row
    if (x < pupil.x0) pupil.x0 = x;
    if (x > pupil.x1) pupil.x1 = x;
    if (y < pupil.y0) pupil.y0 = y;
    if (y > pupil.y1) pupil.y1 = y;
  }
}
const eyeW = eye.x1 - eye.x0 + 1, eyeH = eye.y1 - eye.y0 + 1;
const eyeCx = (eye.x0 + eye.x1) / 2, eyeCy = (eye.y0 + eye.y1) / 2;
const pW = pupil.x1 - pupil.x0 + 1, pH = pupil.y1 - pupil.y0 + 1;
const pCx = (pupil.x0 + pupil.x1) / 2, pCy = (pupil.y0 + pupil.y1) / 2;
console.log(JSON.stringify({
  canvas: { width, height },
  eyeRed: hex,
  eye: { ...eye, w: eyeW, h: eyeH, ratio_h_w: +(eyeH / eyeW).toFixed(3) },
  pupil: { ...pupil, r: +((pW + pH) / 4).toFixed(1), r_over_eyeW: +((pW + pH) / 4 / eyeW).toFixed(3),
           dx_over_eyeW: +((pCx - eyeCx) / eyeW).toFixed(3), dy_over_eyeH: +((pCy - eyeCy) / eyeH).toFixed(3) },
}, null, 2));
