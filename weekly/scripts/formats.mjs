// Output formats. index.html is authored 1:1 (1080x1080). The 9:16 variant is
// derived mechanically into a temporary project copy: the root and every
// sub-composition root get data-height="1920", and <html> gets
// data-format="portrait", which the scene CSS/JS use to re-layout (not crop).
import { cpSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const FORMATS = {
  "1x1": { width: 1080, height: 1080, format: "square", resolution: "square" },
  "9x16": { width: 1080, height: 1920, format: "portrait", resolution: "portrait" },
};

const SKIP = /[\\/](node_modules|output|renders|snapshots|\.hf-segments|\.hyperframes)([\\/]|$)/;

/** Copy the project to a temp dir laid out for `formatKey`. Caller removes it. */
export function materialize(root, formatKey) {
  const f = FORMATS[formatKey];
  if (!f) throw new Error(`unknown format ${formatKey} (use ${Object.keys(FORMATS).join("|")})`);
  const dir = mkdtempSync(join(tmpdir(), `talex-weekly-${formatKey}-`));
  cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.test(src) });
  if (formatKey !== "1x1") {
    const idx = join(dir, "index.html");
    let html = readFileSync(idx, "utf8");
    html = html
      .replace('data-resolution="square" data-format="square"', `data-resolution="${f.resolution}" data-format="${f.format}"`)
      .replace("width=1080, height=1080", `width=${f.width}, height=${f.height}`)
      .replace("width: 1080px; height: 1080px;", `width: ${f.width}px; height: ${f.height}px;`)
      .replace(/data-height="1080"/g, `data-height="${f.height}"`)
      .replace(/data-width="1080"/g, `data-width="${f.width}"`);
    writeFileSync(idx, html);
    const comps = join(dir, "compositions");
    for (const name of readdirSync(comps)) {
      if (!name.endsWith(".html")) continue;
      const p = join(comps, name);
      writeFileSync(p, readFileSync(p, "utf8")
        .replace(/data-height="1080"/g, `data-height="${f.height}"`)
        .replace(/data-width="1080"/g, `data-width="${f.width}"`));
    }
  }
  return dir;
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}
