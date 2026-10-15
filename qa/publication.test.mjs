import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("production publish directory is built from an explicit static allowlist", async () => {
  const config = await readFile(join(root, "netlify.toml"), "utf8");
  assert.match(config, /publish\s*=\s*"dist"/);
  assert.match(config, /command\s*=\s*"node scripts\/build-static\.mjs"/);

  const result = spawnSync(process.execPath, ["scripts/build-static.mjs"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  for (const path of [
    "dist/index.html",
    "dist/admin/index.html",
    "dist/portal/index.html",
    "dist/cashback/index.html",
    "dist/_headers"
  ]) {
    await assert.doesNotReject(access(join(root, path)), `expected ${path} in static output`);
  }

  for (const path of [
    "dist/README.md",
    "dist/PRODUCTION_READINESS.md",
    "dist/package.json",
    "dist/netlify/functions/auth.mjs",
    "dist/qa/publication.test.mjs"
  ]) {
    await assert.rejects(access(join(root, path)), `unexpected published path: ${path}`);
  }

  const headers = await readFile(join(root, "dist/_headers"), "utf8");
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
});
