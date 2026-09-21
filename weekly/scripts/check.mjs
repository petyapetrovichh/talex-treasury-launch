#!/usr/bin/env node
// npm run check — regenerates data/week.js + music, then runs `hyperframes check`
// for BOTH output formats (each from a temp copy laid out for that format,
// see scripts/formats.mjs). Extra CLI args are passed through to `check`.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { prepare } from "./weekly.mjs";
import { FORMATS, materialize, cleanup } from "./formats.mjs";

const HYPERFRAMES = "hyperframes@0.8.58";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extra = process.argv.slice(2);

prepare();
const results = {};
for (const key of Object.keys(FORMATS)) {
  const dir = materialize(root, key);
  try {
    console.log(`\n=== hyperframes check (${key}: ${FORMATS[key].width}x${FORMATS[key].height}) ===`);
    const r = spawnSync("npx", ["--yes", HYPERFRAMES, "check", dir, ...extra], { stdio: "inherit", shell: process.platform === "win32" });
    results[key] = r.status === 0;
  } finally {
    cleanup(dir);
  }
}
const failed = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
if (failed.length) {
  console.error(`\ncheck failed for: ${failed.join(", ")}`);
  process.exit(1);
}
console.log("\ncheck passed for both formats");
