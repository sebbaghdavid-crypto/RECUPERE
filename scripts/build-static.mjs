import { cp, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "dist");

// Publish only the intended browser-facing pages. Server functions remain in
// Netlify's separately configured netlify/functions directory.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(join(root, "index.html"), join(output, "index.html"));

for (const directory of ["admin", "portal", "cashback"]) {
  await cp(join(root, directory), join(output, directory), { recursive: true });
}

await copyFile(join(root, "_headers"), join(output, "_headers"));
console.log("Static site built into dist/ from the explicit allowlist.");
