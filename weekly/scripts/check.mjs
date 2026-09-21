#!/usr/bin/env node
// npm run check — regenerates data/week.js, verifies index.html against the
// schedule, then runs `hyperframes check` on the 16:9 project. Pass --all to
// also check the derived 1:1 and 9:16 layouts (each from a temp copy, see
// scripts/formats.mjs). Other CLI args are passed through to `check`.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { prepare } from "./weekly.mjs";
import { FORMATS, BASE, materialize, cleanup } from "./formats.mjs";

const HYPERFRAMES = "hyperframes@0.8.58";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const all = args.includes("--all");
const extra = args.filter((a) => a !== "--all");

prepare();
const keys = all ? Object.keys(FORMATS) : [BASE];
const results = {};
for (const key of keys) {
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
console.log(`\ncheck passed (${keys.join(", ")})`);
