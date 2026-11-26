import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "reservations.html"), "utf8");
const pageJs = fs.readFileSync(path.join(root, "reservations.js"), "utf8");
const config = fs.readFileSync(path.join(root, "reservation-config.js"), "utf8");

test("reservation defaults live in one adjustable config and booking stays disabled", () => {
  assert.match(config, /openingDays: \[0, 1, 2, 3, 4, 5, 6\]/);
  assert.match(config, /openingTime: "11:00"/);
  assert.match(config, /closingTime: "21:00"/);
  assert.match(config, /durationMinutes: 60/);
  assert.match(config, /slotIntervalMinutes: 30/);
  assert.match(config, /totalSeats: 50/);
  assert.match(config, /maxPartySize: 10/);
  assert.match(config, /depositRequired: false/);
  assert.match(config, /notificationMethod: "email"/);
  assert.match(config, /notificationEmail: null/);
  assert.match(config, /bookingEnabled: false/);
  assert.match(config, /goLiveAuthorized: false/);
});

test("reservation page renders its facts from config, not duplicated constants", () => {
  assert.match(html, /id="reservationDuration"/);
  assert.match(html, /id="reservationPartyLimit"/);
  assert.match(html, /id="reservationTotalSeats"/);
  assert.match(html, /id="reservationDeposit"/);
  assert.match(html, /id="reservationDays"/);
  assert.match(html, /id="reservationHours"/);
  assert.doesNotMatch(html, /60 minutes|50 seats|Up to 10 guests|11:00–21:00|max="10"/);
  assert.ok(html.indexOf("reservation-config.js") < html.indexOf("reservations.js"));
  assert.match(pageJs, /window\.AZAL_RESERVATION_CONFIG/);
});

test("reservation controls are inert and cannot collect or submit personal data", () => {
  const disabledFieldset = html.match(/<fieldset[^>]*disabled[^>]*>([\s\S]*?)<\/fieldset>/i)?.[1] ?? "";
  assert.ok(disabledFieldset, "all booking controls must be inside a disabled fieldset");
  assert.equal((disabledFieldset.match(/<(input|select|textarea)\b/gi) ?? []).length, 7);
  assert.doesNotMatch(html.replace(disabledFieldset, ""), /<(input|select|textarea)\b/i);
  assert.doesNotMatch(html, /<form\b|\baction=/i);
  assert.doesNotMatch(html, /\bname=["']/i);
  assert.match(html, /<button[^>]*disabled[^>]*aria-disabled="true"/);
  assert.doesNotMatch(html, /mailto:|supabase|createClient|signUp|signIn/i);
  assert.doesNotMatch(pageJs, /supabase|createClient|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|mailto:/i);
});

test("reservation page is bilingual and uses shared P1 v3 language/cart hooks", () => {
  assert.match(html, /data-res-en=/);
  assert.match(html, /data-res-fr=/);
  assert.match(html, /id="languageToggle"/);
  assert.match(html, /id="cartCount"/);
  assert.ok(html.indexOf("script.js") < html.indexOf("reservation-config.js"));
  assert.ok(html.indexOf("reservation-config.js") < html.indexOf("reservations.js"));
  assert.match(pageJs, /addEventListener\("click", applyReservationPage\)/);
});
