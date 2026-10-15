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
    await assert.doesNotReject(() => access(join(root, path)), `expected ${path} in static output`);
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

test("Netlify API routes remain explicitly wired to their intended functions", async () => {
  const routes = [
    ["netlify/functions/cases.mjs", "/api/cases"],
    ["netlify/functions/portal.mjs", "/api/portal"],
    ["netlify/functions/payment.mjs", "/api/payment"],
    ["netlify/functions/stripe-webhook.mjs", "/api/stripe-webhook"],
    ["netlify/functions/cashback.mjs", "/api/cashback"]
  ];

  for (const [file, route] of routes) {
    const source = await readFile(join(root, file), "utf8");
    assert.match(
      source,
      new RegExp("export\\s+const\\s+config\\s*=\\s*\\{\\s*path:\\s*['\\"]" + route + "['\\"]\\s*\\}"),
      `${file} must keep its explicit ${route} route`
    );
  }
});

test("published HTML keeps API calls same-origin and the payment feature guarded", async () => {
  const home = await readFile(join(root, "dist/index.html"), "utf8");
  const admin = await readFile(join(root, "dist/admin/index.html"), "utf8");
  const portal = await readFile(join(root, "dist/portal/index.html"), "utf8");
  assert.match(home, /fetch\(["']\/api\/cases["']/);
  assert.match(admin, /fetch\(["']\/api\/cases\?admin=1["']/);
  assert.match(portal, /fetch\(["']\/api\/portal/);

  const payment = await readFile(join(root, "netlify/functions/payment.mjs"), "utf8");
  assert.match(payment, /if\s*\(!PAYMENT_CONFIGURATION\.ok\)\s*return response\([^;]+503\)/);
});
