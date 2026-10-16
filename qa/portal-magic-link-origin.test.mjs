import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("magic login links use the current deployment origin", async () => {
  const source = await readFile(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
  assert.match(source, /async function emailLink\(email,baseUrl\)/);
  assert.match(source, /new URL\("\/portal\/\?magic="/);
  assert.match(source, /await emailLink\(email,u\.origin\)/);
  assert.doesNotMatch(source, /https:\/\/jade-pegasus-f6e204\.netlify\.app/);
});
