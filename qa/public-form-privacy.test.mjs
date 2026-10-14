import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const html=await readFile(new URL("../index.html",import.meta.url),"utf8");

test("public intake does not accept personal document uploads until private storage is ready",()=>{
 assert.equal(/<input[^>]+type=["']file["']/i.test(html),false);
 assert.equal(/data-netlify=["']true["']/i.test(html),false);
 assert.match(html,/justificatifs ne sont pas encore acceptés en ligne/i);
});

test("public intake does not create a duplicate copy through a secondary Netlify Forms POST",()=>{
 assert.equal(html.includes('fetch("/",{method:"POST",body:fd})'),false);
});
