import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const Email = require("../order-email.js");
const migration = readFileSync(new URL("../supabase/migrations/0009_order_notifications.sql", import.meta.url), "utf8");

const order = {
  order_id: "12345678-1234-4234-8234-123456789abc",
  order_number: "12345678",
  branch: { slug: "ottawa", name: "Ottawa" },
  placed_at: "2026-11-27T20:00:00Z",
  pickup_at: "2026-11-27T20:30:00Z",
  items: [{ name: "Lamb Mandi", quantity: 2, unit_price_cents: 2499, line_total_cents: 4998 }],
  subtotal_cents: 4998,
  discount_cents: 0,
  tax_cents: 650,
  total_cents: 5648,
  customer_note: "No onions",
  staff_queue_path: "staff.html"
};

test("NEW_ORDER email renders branded HTML and a plain-text fallback", () => {
  const message = Email.renderNewOrderEmail(order);
  assert.match(message.subject, /New AZAL order #12345678/);
  assert.match(message.html, /NEW ORDER/);
  assert.match(message.html, /assets\/azal-logo\.svg/);
  assert.match(message.html, /Lamb Mandi/);
  assert.match(message.html, /No onions/);
  assert.match(message.html, /staff\.html/);
  assert.match(message.text, /Lamb Mandi/);
  assert.match(message.text, /Subtotal/);
  assert.match(message.text, /Tax/);
  assert.match(message.text, /Total paid/);
});

test("email template escapes untrusted order fields and excludes customer/payment secrets", () => {
  const hostile = { ...order, branch: { name: "<img src=x onerror=alert(1)>" }, customer_note: "<script>alert(1)</script>" };
  const message = Email.renderNewOrderEmail(hostile);
  assert.match(message.html, /&lt;img/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.doesNotMatch(message.html, /4242424242424242|guest@example|phone|access_token|service_role/i);
});

test("French template localizes headings and preserves the same server-provided totals", () => {
  const message = Email.renderNewOrderEmail(order, { locale: "fr" });
  assert.match(message.subject, /Nouvelle commande AZAL/);
  assert.match(message.html, /NOUVELLE COMMANDE/);
  assert.match(message.text, /Sous-total/);
  assert.match(message.text, /Taxes/);
});

test("sender is fail-closed by default and never calls a provider", async () => {
  let calls = 0;
  const sender = Email.createSender({ provider: { send: async () => { calls++; return { id: "fake-1" }; } } });
  assert.deepEqual(await sender.send({ to: "info@azalrestaurant.com", order }), { status: "blocked", reason: "sender_disabled" });
  assert.equal(calls, 0);
});

test("enabled sender uses only an injected fake provider and returns provider acknowledgement, not delivery", async () => {
  const sent = [];
  const sender = Email.createSender({ enabled: true, provider: { send: async (message) => { sent.push(message); return { id: "fake-provider-42" }; } } });
  const result = await sender.send({ to: "info@azalrestaurant.com", order });
  assert.deepEqual(result, { status: "sent", provider_message_id: "fake-provider-42" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "info@azalrestaurant.com");
  assert.match(sent[0].html, /NEW ORDER/);
  assert.match(sent[0].text, /Lamb Mandi/);
});

test("migration is idempotent, private, event-keyed, and sender-disabled", () => {
  assert.match(migration, /unique \(order_id, event_type\)/i);
  assert.match(migration, /after insert or update of payment_status on public\.orders/i);
  assert.match(migration, /on conflict \(order_id, event_type\) do nothing/i);
  assert.match(migration, /alter table public\.order_outbox enable row level security/i);
  assert.match(migration, /revoke all on public\.order_notification_settings, public\.order_outbox from public, anon, authenticated/i);
  assert.match(migration, /constraint order_notification_sender_stays_off check \(sender_enabled = false\)/i);
  assert.match(migration, /values \(new\.id, 'NEW_ORDER', v_email, v_payload, 'blocked'/i);
  assert.doesNotMatch(migration, /smtp|service_role key|sendgrid|resend\.com/i);
});
