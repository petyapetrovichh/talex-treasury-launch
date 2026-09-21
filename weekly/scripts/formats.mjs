// Output formats. index.html is authored 16:9 (1920x1080) — the format that
// `npm run weekly` renders. Other formats are derived mechanically into a
// temporary project copy (root + every sub-composition root get the new
// data-width/height, <html> gets data-format=...), and the scene CSS/JS
// re-layout from the variables in weekly.css.
import { cpSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const BASE = "16x9";
export const FORMATS = {
  "16x9": { width: 1920, height: 1080, format: "landscape", resolution: "landscape" },
  "1x1":  { width: 1080, height: 1080, format: "square",    resolution: "square" },
  "9x16": { width: 1080, height: 1920, format: "portrait",  resolution: "portrait" },
};

const SKIP = /[\\/](node_modules|output|renders|snapshots|\.hf-segments|\.hyperframes)([\\/]|$)/;

/** Copy the project to a temp dir laid out for `formatKey`. Caller removes it. */
export function materialize(root, formatKey) {
  const f = FORMATS[formatKey];
  if (!f) throw new Error(`unknown format ${formatKey} (use ${Object.keys(FORMATS).join("|")})`);
  const base = FORMATS[BASE];
  const dir = mkdtempSync(join(tmpdir(), `talex-weekly-${formatKey}-`));
  cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.test(src) });
  if (formatKey !== BASE) {
    const resize = (s) => s
      .replace(new RegExp(`data-width="${base.width}"`, "g"), `data-width="${f.width}"`)
      .replace(new RegExp(`data-height="${base.height}"`, "g"), `data-height="${f.height}"`);
    const idx = join(dir, "index.html");
    let html = readFileSync(idx, "utf8");
    html = resize(html)
      .replace(`data-resolution="${base.resolution}" data-format="${base.format}"`, `data-resolution="${f.resolution}" data-format="${f.format}"`)
      .replace(`width=${base.width}, height=${base.height}`, `width=${f.width}, height=${f.height}`)
      .replace(`width: ${base.width}px; height: ${base.height}px;`, `width: ${f.width}px; height: ${f.height}px;`);
    writeFileSync(idx, html);
    const comps = join(dir, "compositions");
    for (const name of readdirSync(comps)) {
      if (!name.endsWith(".html")) continue;
      const p = join(comps, name);
      writeFileSync(p, resize(readFileSync(p, "utf8")));
    }
  }
  return dir;
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}
