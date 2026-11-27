import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const tr = eval("(" + src.slice(src.indexOf("{", src.indexOf("const translations")), src.indexOf("const productTranslations")).trim().replace(/;\s*$/, "") + ")");
const prAr = eval("(" + src.slice(src.indexOf("{", src.indexOf("const productTranslationsAr")), src.indexOf("};", src.indexOf("const productTranslationsAr")) + 1) + ")");

test("Arabic covers every English key, keeps every {placeholder}, and is actually Arabic", () => {
  for (const [k, v] of Object.entries(tr.en)) {
    assert.ok(k in tr.ar, "missing ar key: " + k);
    for (const ph of v.match(/\{\w+\}/g) || []) assert.ok(tr.ar[k].includes(ph), `${k}: lost ${ph}`);
    if (/[A-Za-z]{3}/.test(v) && !["memberPointsValue"].includes(k)) assert.match(tr.ar[k], /[؀-ۿ]/, k + " is not Arabic");
  }
});

test("all 9 dishes have Arabic name, description, story; no invented facts beyond EN (same tag presence)", () => {
  const products = eval(src.slice(src.indexOf("[", src.indexOf("const products = [")), src.indexOf("];", src.indexOf("const products = [")) + 1));
  for (const p of products) {
    const a = prAr[p.id];
    assert.ok(a && a.name && a.description && a.story, "dish " + p.id);
    assert.match(a.name, /[؀-ۿ]/);
    assert.equal(Boolean(a.tag), Boolean(p.tag), "dish " + p.id + ": a tag appears only where English has one");
  }
});

test("RTL, Latin digits for prices and times, three-way switch", () => {
  assert.match(src, /document\.documentElement\.dir=language==="ar"\?"rtl":"ltr"/);
  assert.match(src, /ar:"ar-CA-u-nu-latn"/);
  assert.match(src, /NEXT_LANG=\{en:"fr",fr:"ar",ar:"en"\}/);
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /html\[lang="ar"\] \*\{letter-spacing:0!important\}/, "letter-spacing would break Arabic joining");
});

test("Arabic never says 'ideal' (مثالي) where English says 'example'", () => {
  assert.doesNotMatch(src, /مثالي/);
});


test("F-A: Arabic webfont bundled (Amiri, OFL), only for Arabic code points, first in the Arabic stack", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@font-face\{font-family:"AZAL Arabic";src:url\("assets\/fonts\/Amiri-Arabic\.woff"\) format\("woff"\);[^}]*unicode-range:U\+0600-06FF/);
  assert.match(css, /html\[lang="ar"\] body,[^{]*\{font-family:"AZAL Arabic"/);
  assert.ok(readFileSync(new URL("../assets/fonts/Amiri-Arabic.woff", import.meta.url)).length > 50000);
  assert.match(readFileSync(new URL("../assets/fonts/OFL-Amiri.txt", import.meta.url), "utf8"), /SIL OPEN FONT LICENSE/i);
});

test("AR-REWRITE (lead 21:25): literal-translation calques found in the audit do not come back", async () => {
  const { readFileSync } = await import("node:fs");
  const src = ["script.js", "iftar.js", "story-map.js"].map((f) => readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n");
  for (const calque of ["اختر مزاجك", "كي يتكلم اللحم", "وُلد في حضرموت", "وقت الإفطار =", "في الأثناء", "مبني حول هذه العادة", "اليمن مطبوخاً", "بالطريقة الطويلة", "رمز جديد في الطريق إليك", "صُنعت لتغمس", "كأعضاء مؤسسين", "لاحقاً اليوم", "ومحبوبة للمشاركة"])
    assert.ok(!src.includes(calque), "calque is back: " + calque);
  // honesty labels keep their force in Arabic (the rewrite changed words, not facts)
  for (const label of ["طبق للعرض", "للتوضيح", "معاينة", "لم يُرسل شيء", "قريباً"]) assert.ok(src.includes(label), "honesty label missing: " + label);
});

test("owner rule: the reservation step asks for name + mobile + email in all three languages (ChatGPT #47 review)", async () => {
  const { readFileSync } = await import("node:fs");
  const js = readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const v = [...js.matchAll(/reserveHow2:"([^"]*)"/g)].map((m) => m[1]);
  assert.equal(v.length, 3, "EN, FR and AR each have the step");
  assert.match(v[0], /name.*mobile.*email/i); assert.match(v[1], /nom.*mobile.*courriel/i); assert.match(v[2], /اسم.*جوال.*بريد/);
  assert.match(readFileSync(new URL("../reserve.html", import.meta.url), "utf8"), /data-i18n="reserveHow2">Leave your name, mobile number and email/);
});

test("AR-REWRITE follow-up: reserve.js Arabic is written from meaning (ChatGPT examples)", async () => {
  const { readFileSync } = await import("node:fs");
  const r = readFileSync(new URL("../reserve.js", import.meta.url), "utf8");
  for (const calque of ["نحمّل الأوقات", "تعال واجلس معنا: على طريقة المجلس، حول صحون مشتركة", "حُفظ حجزك باسم", "البريد المستخدم في الحجز"]) assert.ok(!r.includes(calque), "calque is back: " + calque);
  for (const fact of ["30 يوماً", "{n} أشخاص", "{code}", "{email}"]) assert.ok(r.includes(fact), "fact/placeholder kept: " + fact);
});

test("checkout.js and staff.js: Arabic from meaning, and prices isolated in Arabic (bidi class)", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["checkout.js", "staff.js"]) {
    const s = readFileSync(new URL("../" + f, import.meta.url), "utf8");
    assert.match(s, /lang\(\) === "ar" \? "\\u2066" \+ s\.replace\(\/\\u200f\/g, ""\) \+ "\\u2069"/, f + ": Arabic prices are LTR isolates");
    for (const calque of ["انضم بالبريد", "طلبات غير مدفوعة كثيرة", "غير مُعدّ كموظف", "شيء في طلبك"]) assert.ok(!s.includes(calque), f + ": calque is back: " + calque);
  }
});

test("pulse.js Arabic: 'placed' and 'handed over' can never read alike (both used to say استلام)", async () => {
  const { readFileSync } = await import("node:fs");
  const p = readFileSync(new URL("../pulse.js", import.meta.url), "utf8");
  const ar = p.slice(p.indexOf("ar: {"));
  const placed = ar.match(/placed: "([^"]*)"/)[1], handed = ar.match(/handed_over: "([^"]*)"/)[1];
  assert.ok(!/استُلم|استلم/.test(placed) && /الاستلام/.test(handed), `placed="${placed}" handed_over="${handed}"`);
});
