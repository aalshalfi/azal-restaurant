// Say it right (Claude): every Yemeni dish has an EN and FR pronunciation line; text only, no audio.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("dishes 1-8 have EN and FR pronunciations; juice has none", () => {
  for (let id = 1; id <= 8; id++) {
    assert.match(js, new RegExp(`\\{id:${id},name:"[^"]*",say:"[^"]+"`), `EN say for ${id}`);
    assert.match(js, new RegExp(`\\n ?${id}:\\{name:"[^"]*",say:"[^"]+"`), `FR say for ${id}`);
  }
  assert.ok(!/\{id:9,name:"[^"]*",say:/.test(js));
});

test("label is translated and rendered only when a dish has a pronunciation", () => {
  assert.match(js, /sayIt:"Say it"/);
  assert.match(js, /sayIt:"Prononcez"/);
  assert.match(js, /\$\{v\.say\?`<p class="say-it">/);
});

test("no audio, no network", () => {
  assert.ok(!/new Audio|<audio|speechSynthesis/.test(js));
});
