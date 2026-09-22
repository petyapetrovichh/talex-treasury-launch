// Copies the shared source (timeline, builder, styles, assets) into both
// format projects so they render from byte-identical timing and audio.
import { cpSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shared = join(root, "shared");
for (const target of ["horizontal", "vertical"]) {
  for (const entry of readdirSync(shared)) {
    cpSync(join(shared, entry), join(root, target, entry), { recursive: true });
  }
}
console.log("synced shared/ -> horizontal/, vertical/");
