import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const html=await readFile(new URL("../index.html",import.meta.url),"utf8");

test("public intake does not accept personal document uploads until private storage is ready",()=>{
 assert.doesNotMatch(html,/<input[^>]+type=["']file["']/i);
 assert.doesNotMatch(html,/data-netlify=["']true["']/i);
 assert.match(html,/justificatifs ne sont pas encore acceptés en ligne/i);
});

test("public intake does not create a duplicate copy through a secondary Netlify Forms POST",()=>{
 assert.doesNotMatch(html,/fetch(["']/["']s*,s*{s*method:s*["']POST["']/i);
});
