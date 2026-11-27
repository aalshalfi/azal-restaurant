import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const S = require("../sigil.js");
const uuid = (i) => { const h = (Math.imul(i + 1, 2654435761) >>> 0).toString(16).padStart(8, "0"); return `${h}-1234-4abc-8def-${String(i).padStart(12, "0")}`; };

test("same id gives the same sigil, in every language", () => {
  const id = "3f9a0c12-0000-4000-8000-000000000000";
  assert.deepEqual([S.sigil(id).key, S.sigil(id.toUpperCase()).key], [S.sigil(id).key, S.sigil(id).key]);
  const n = parseInt("3f9a0c12", 16);
  assert.equal(S.sigil(id).index, n % 16); assert.equal(S.sigil(id).num, 10 + (Math.floor(n / 16) % 90));
  for (const l of ["en", "fr", "ar"]) assert.match(S.label(id, l), new RegExp(S.sigil(id).num + "$"));
});
test("numbers stay 10..99 and every icon has 3 words with no duplicates", () => {
  for (let i = 0; i < 5000; i++) { const s = S.sigil(uuid(i)); assert.ok(s.num >= 10 && s.num <= 99); }
  assert.equal(S.ICONS.length, 16);
  for (const col of [0, 1, 2, 3]) assert.equal(new Set(S.ICONS.map((r) => r[col])).size, col === 0 ? 16 : 16, "column " + col + " unique");
  for (const r of S.ICONS) assert.ok(r[3] && /[؀-ۿ]/.test(r[3]), "Arabic word for " + r[1]);
});
test("spreads over all 1,440 sigils", () => {
  const keys = new Set(); for (let i = 0; i < 20000; i++) keys.add(S.sigil(uuid(i)).key);
  assert.ok(keys.size > 1400, "covered " + keys.size);
});
test("bad ids fall back to the hex code, never throw", () => {
  for (const bad of [null, undefined, "", "zz", "order-1"]) assert.equal(S.sigil(bad), null);
  assert.equal(S.label("zzzzzz", "en"), "ZZZZZZ");
});
test("collisions() flags exactly the ids that share a sigil", () => {
  const a = "00000010-0000-4000-8000-000000000001", b = "00000010-ffff-4000-8000-000000000002", c = "00000020-0000-4000-8000-000000000003";
  assert.equal(S.sigil(a).key, S.sigil(b).key); assert.notEqual(S.sigil(a).key, S.sigil(c).key);
  assert.deepEqual([...S.collisions([a, b, c])].sort(), [a, b].sort());
  assert.equal(S.collisions([c]).size, 0);
});
test("guest confirmation and staff ticket use the same function", () => {
  const co = readFileSync(new URL("../checkout.js", import.meta.url), "utf8"), st = readFileSync(new URL("../staff.js", import.meta.url), "utf8");
  assert.match(co, /AzalSigil\.label\(o\.order_id, lang\(\)\)/);
  assert.match(st, /Sig\.collisions\(rows\.map/);
  for (const w of ["just say {sigil}", "dites simplement {sigil}", "قل فقط {sigil}"]) assert.ok(co.includes(w), w);
});
test("every page that loads checkout.js loads sigil.js before it", () => {
  for (const f of ["404.html", "index.html", "member.html", "menu.html", "reserve.html", "story.html", "staff.html"]) {
    const h = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    const s = h.indexOf('src="sigil.js'), c = h.indexOf('src="checkout.js');
    assert.ok(s > 0 && s < c, f);
  }
});
