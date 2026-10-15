import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("portal inline JavaScript parses after HTML edits", () => {
  const html = readFileSync(new URL("../portal/index.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, "portal should contain its client script");
  const directory = mkdtempSync(join(tmpdir(), "recupere-portal-"));
  const scriptPath = join(directory, "portal-inline.mjs");
  try {
    writeFileSync(scriptPath, scripts.map((match) => match[1]).join("\n"));
    execFileSync(process.execPath, ["--check", scriptPath], { stdio: "pipe" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
