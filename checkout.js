/* AZAL checkout (Claude, ORD-REAL). Real orders into Supabase, paid with FAKE test cards only.
   Inert unless window.AZAL_SUPABASE has url + anonKey: the shipped preview checkout stays exactly as it is.
   Owner rule: no order without payment. A reservation needs none; an order is paid online.
   Card numbers never leave the browser: the three published test numbers map to test tokens here, and any other
   number is refused before anything is sent. The server (pay_order_test) also refuses unless payments_mode='test'.
   Prices, tax and totals are never sent: place_order prices on the server (U2). */
(function (root) {
  "use strict";

  // Sample menu ids (supabase/seed/staging-sample-menu.sql). The real menu replaces the seed rows, not this rule.
  const itemUuid = (id) => Number.isInteger(id) && id > 0 && id < 1e12 ? "a2a10000-0000-4000-8000-" + String(id).padStart(12, "0") : null;

  const TEST_CARDS = { "4242424242424242": "tok_test_ok", "4000000000000002": "tok_test_declined", "4000000000009995": "tok_test_insufficient" };
  const cardToToken = (raw) => TEST_CARDS[String(raw || "").replace(/[\s-]/g, "")] || null;

  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function validateGuest(name, email) {
    const n = String(name || "").trim(), e = String(email || "").trim().toLowerCase();
    if (n.length < 1 || n.length > 80) return { ok: false, field: "name" };
    if (e.length > 254 || !EMAIL.test(e)) return { ok: false, field: "email" };
    return { ok: true, name: n, email: e };
  }

  // Toronto wall-clock (day offset 0/1, minutes) -> ISO instant, DST-safe without a library.
  function torontoInstant(nowMs, dayOffset, minutes, tz) {
    tz = tz || "America/Toronto";
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(nowMs));
    const g = (k) => Number(p.find((x) => x.type === k).value);
    const wallUtc = Date.UTC(g("year"), g("month") - 1, g("day") + dayOffset, Math.floor(minutes / 60), minutes % 60);
    for (const off of [4, 5]) { // EDT, EST
      const cand = wallUtc + off * 3600e3;
      const q = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(cand));
      if (Number(q.find((x) => x.type === "hour").value) * 60 + Number(q.find((x) => x.type === "minute").value) === minutes) return new Date(cand).toISOString();
    }
    return null;
  }

  function buildOrder({ cart, choice, day, note, guest, branch, key, nowMs }) {
    const items = [];
    for (const [id, q] of cart) { const u = itemUuid(Number(id)); if (!u) return null; items.push({ menu_item_id: u, quantity: Number(q) }); }
    if (!items.length) return null;
    const body = { p_branch: branch || "ottawa", p_items: items, p_pickup_at: null, p_note: note ? String(note).trim().slice(0, 500) || null : null, p_idempotency_key: key };
    if (choice !== "asap") {
      const at = torontoInstant(nowMs, day === "tomorrow" ? 1 : 0, Number(choice));
      if (!at) return null;
      body.p_pickup_at = at;
    }
    if (guest) { body.p_guest_name = guest.name; body.p_guest_email = guest.email; }
    return body;
  }

  const newKey = () => {
    try { return "co-" + root.crypto.randomUUID(); } catch { return "co-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12); }
  };

  // One checkout attempt: the same idempotency key on every retry, so a double tap or a flaky network never makes two orders.
  function createCheckout({ config, fetch: fetchFn, getToken }) {
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    let key = newKey(), order = null;

    async function rpc(name, body) {
      const token = (getToken && (await getToken())) || config.anonKey;
      let res;
      try { res = await fetchFn(base + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: config.anonKey, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      let data = null; try { data = await res.json(); } catch {}
      if (!res.ok) { const m = String((data && data.message) || "error"); throw Object.assign(new Error(m), { code: /^[a-z_]+$/.test(m) ? m : "error", status: res.status }); }
      return data;
    }

    return {
      enabled,
      get order() { return order; },
      reset() { key = newKey(); order = null; },
      async place(args) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        if (order) return order; // already placed in this attempt: go straight to payment
        const body = buildOrder(Object.assign({}, args, { key }));
        if (!body) throw Object.assign(new Error("invalid_items"), { code: "invalid_items" });
        order = await rpc("place_order", body);
        return order;
      },
      async pay(cardNumber, guestEmail) {
        if (!order) throw Object.assign(new Error("no_order"), { code: "no_order" });
        const tok = cardToToken(cardNumber);
        if (!tok) throw Object.assign(new Error("not_test_card"), { code: "not_test_card" }); // nothing is sent
        const body = { p_order: order.order_id, p_token: tok };
        if (guestEmail) body.p_guest_email = guestEmail;
        return rpc("pay_order_test", body);
      }
    };
  }

  const api = { createCheckout, cardToToken, validateGuest, buildOrder, torontoInstant, itemUuid, TEST_CARDS };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const cfg = root.AZAL_SUPABASE || {};
  const auth = root.AZALAuth;
  const co = createCheckout({ config: cfg, fetch: root.fetch && root.fetch.bind(root), getToken: async () => { try { const s = auth && (await auth.session()); return s && s.access_token; } catch { return null; } } });
  root.AZALCheckout = co;
  if (!co.enabled) return; // inert: preview checkout unchanged

  const S = {
    en: { kicker: "TEST MODE", title: "Your order", text: "Payment is in test mode: use a test card below. No real money moves.",
      guestName: "Your name", guestEmail: "Email for your receipt and points", signedAs: "Ordering as {email}",
      note: "Note for the kitchen (optional)", notePh: "Allergies, less spice, extra bread…",
      card: "Card number (test cards only)", cardHelp: "Test cards: 4242 4242 4242 4242 pays · 4000 0000 0000 0002 is declined · 4000 0000 0000 9995 has insufficient funds.",
      pay: "Pay {total}", payPlain: "Place order and pay", working: "One moment…",
      paid: "Paid. Ready at {time}. Show code {code} at the counter.", paidGuest: "Join with {email} to collect the points for this order.",
      declined: "Card declined. Your order is kept for 15 minutes: try another test card.", insufficient: "Insufficient funds. Your order is kept for 15 minutes: try another test card.",
      e_not_test_card: "Only the test card numbers shown work here.", e_name: "Please add your name.", e_email: "Please check your email address.",
      e_slot_full: "That time just filled up. Choose another time.", e_closed: "We’re closed for orders at that time. Choose another time.", e_too_soon: "That time is too soon now. Choose another time.",
      e_item_unavailable: "Something in your order is no longer available.", e_rate_limited: "Too many unpaid orders. Please wait a few minutes.",
      e_payment_window_expired: "This order expired before payment. Start again.", e_payments_not_in_test_mode: "Payments are off right now. Nothing was charged.",
      e_note_too_long: "The note is too long (500 characters max).", e_network: "Connection problem. Check your connection and try again: you will not be charged twice.",
      e_error: "Something went wrong. Nothing was charged. Please try again." },
    fr: { kicker: "MODE TEST", title: "Votre commande", text: "Le paiement est en mode test : utilisez une carte test ci-dessous. Aucun paiement réel n’est effectué.",
      guestName: "Votre nom", guestEmail: "Courriel pour le reçu et les points", signedAs: "Commande au nom de {email}",
      note: "Note pour la cuisine (facultatif)", notePh: "Allergies, moins épicé, plus de pain…",
      card: "Numéro de carte (cartes test seulement)", cardHelp: "Cartes test : 4242 4242 4242 4242 paie · 4000 0000 0000 0002 est refusée · 4000 0000 0000 9995 a des fonds insuffisants.",
      pay: "Payer {total}", payPlain: "Commander et payer", working: "Un instant…",
      paid: "Payé. Prêt à {time}. Montrez le code {code} au comptoir.", paidGuest: "Inscrivez-vous avec {email} pour recevoir les points de cette commande.",
      declined: "Carte refusée. Votre commande est gardée 15 minutes : essayez une autre carte test.", insufficient: "Fonds insuffisants. Votre commande est gardée 15 minutes : essayez une autre carte test.",
      e_not_test_card: "Seuls les numéros de carte test indiqués fonctionnent ici.", e_name: "Veuillez indiquer votre nom.", e_email: "Veuillez vérifier votre courriel.",
      e_slot_full: "Cet horaire vient d’être complet. Choisissez un autre horaire.", e_closed: "Les commandes sont fermées à cette heure. Choisissez un autre horaire.", e_too_soon: "Cet horaire est trop proche. Choisissez un autre horaire.",
      e_item_unavailable: "Un article de votre commande n’est plus disponible.", e_rate_limited: "Trop de commandes non payées. Patientez quelques minutes.",
      e_payment_window_expired: "Cette commande a expiré avant le paiement. Recommencez.", e_payments_not_in_test_mode: "Les paiements sont désactivés pour l’instant. Rien n’a été débité.",
      e_note_too_long: "La note est trop longue (500 caractères max.).", e_network: "Problème de connexion. Vérifiez votre connexion et réessayez : vous ne serez pas débité deux fois.",
      e_error: "Un problème est survenu. Rien n’a été débité. Veuillez réessayer." }
  };
  const lang = () => (document.documentElement.lang === "fr" ? "fr" : "en");
  const L = (k, vars) => { let s = S[lang()][k] || S.en[k] || k; for (const v in vars || {}) s = s.replace("{" + v + "}", vars[v]); return s.replace(/\.\./g, "."); };
  const money = (c) => new Intl.NumberFormat(lang() === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(c / 100);
  const timeOf = (iso) => new Intl.DateTimeFormat(lang() === "fr" ? "fr-CA" : "en-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(iso));

  // Stage 2 (staging test): every "preview / nothing is sent" line becomes the honest test-mode line, in EN and FR.
  for (const [from, to] of [["cartDisclaimer", "cartDisclaimerTest"], ["menuIntro", "menuIntroTest"]]) {
    document.querySelectorAll(`[data-i18n="${from}"]`).forEach((el) => { el.dataset.i18n = to; if (typeof t === "function" && t(to)) el.textContent = t(to); });
  }

  const modal = document.getElementById("checkoutModal");
  const panel = modal && modal.querySelector(".checkout-panel");
  const oldBtn = document.getElementById("placeDemoOrder");
  if (!panel || !oldBtn) return;
  const btn = oldBtn.cloneNode(false); // drops the preview handler
  btn.id = "placeOrder"; btn.type = "button";
  oldBtn.replaceWith(btn);

  const box = document.createElement("div");
  box.className = "checkout-live";
  box.innerHTML = '<div class="co-guest" id="coGuest" hidden><label for="coName"></label><input id="coName" autocomplete="name" maxlength="80"><label for="coEmail"></label><input id="coEmail" type="email" autocomplete="email" maxlength="254"></div>' +
    '<p class="co-signed" id="coSigned" hidden></p>' +
    '<label for="coNote"></label><textarea id="coNote" maxlength="500" rows="2"></textarea>' +
    '<label for="coCard"></label><input id="coCard" inputmode="numeric" autocomplete="off" maxlength="23" spellcheck="false"><p class="co-help" id="coCardHelp"></p>' +
    '<p class="co-error" id="coError" role="alert"></p>';
  btn.before(box);
  const $ = (id) => document.getElementById(id);
  const msg = $("checkoutMessage");
  let guestMode = true, busy = false;

  const kicker = panel.querySelector("[data-i18n='demoOnly']"), title = $("checkoutTitle");
  const intro = panel.querySelector("[data-i18n='checkoutText']"), demoNote = panel.querySelector("[data-i18n='demoPickupOnly']");

  function paint() {
    if (kicker) kicker.textContent = L("kicker");
    if (title) title.textContent = L("title");
    if (intro) intro.textContent = L("text");
    if (demoNote) demoNote.hidden = true;
    box.querySelector("label[for=coName]").textContent = L("guestName");
    box.querySelector("label[for=coEmail]").textContent = L("guestEmail");
    box.querySelector("label[for=coNote]").textContent = L("note");
    $("coNote").placeholder = L("notePh");
    box.querySelector("label[for=coCard]").textContent = L("card");
    $("coCard").setAttribute("aria-describedby", "coCardHelp");
    $("coCardHelp").textContent = L("cardHelp");
    btn.textContent = busy ? L("working") : co.order ? L("pay", { total: money(co.order.total_cents) }) : L("payPlain");
  }
  async function prepare() {
    let s = null; try { s = auth && (await auth.session()); } catch {}
    guestMode = !s;
    $("coGuest").hidden = !guestMode;
    $("coSigned").hidden = guestMode;
    if (s) $("coSigned").textContent = L("signedAs", { email: (s.user && s.user.email) || "" });
    paint();
  }
  const unlock = () => { $("coName").disabled = $("coEmail").disabled = false; };
  const showError = (code) => { $("coError").textContent = L("e_" + code) === "e_" + code ? L("e_error") : L("e_" + code); };

  const sig = () => { try { return JSON.stringify([...cart.entries()].sort()) + "|" + (pickupState.choice || ""); } catch { return ""; } };
  let placedSig = "";
  document.getElementById("checkoutButton")?.addEventListener("click", () => { if (co.order && placedSig !== sig()) { co.reset(); unlock(); } $("coError").textContent = ""; if (msg) msg.textContent = ""; prepare(); });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  btn.addEventListener("click", async () => {
    if (busy) return;
    $("coError").textContent = "";
    let guest = null;
    if (guestMode) {
      const g = validateGuest($("coName").value, $("coEmail").value);
      if (!g.ok) { showError(g.field); $(g.field === "name" ? "coName" : "coEmail").focus(); return; }
      guest = { name: g.name, email: g.email };
    }
    if (!cardToToken($("coCard").value)) { showError("not_test_card"); $("coCard").focus(); return; }
    busy = true; paint();
    try {
      // script.js keeps `cart` and `pickupState` as top-level bindings shared across classic scripts.
      const c = typeof cart !== "undefined" ? cart : null;
      const ps = typeof pickupState !== "undefined" ? pickupState : { choice: "asap", plan: { day: "today" } };
      placedSig = sig();
      await co.place({ cart: c, choice: ps.choice || "asap", day: ps.plan && ps.plan.day, note: $("coNote").value, guest, nowMs: Date.now() });
      $("coName").disabled = $("coEmail").disabled = true; // the order is tied to this email now
      paint();
      const r = await co.pay($("coCard").value, guest && guest.email);
      $("coCard").value = "";
      if (r.outcome === "paid") {
        const o = co.order;
        if (msg) msg.textContent = L("paid", { time: timeOf(o.pickup_at), code: String(o.order_id).slice(0, 6).toUpperCase() }) + (guest ? " " + L("paidGuest", { email: guest.email }) : "");
        try { c.clear(); if (typeof renderCart === "function") renderCart(); } catch {}
        co.reset(); unlock(); box.hidden = true; btn.hidden = true; const pk = $("pickup"); if (pk) pk.hidden = true;
      } else {
        $("coError").textContent = L(r.reason === "insufficient_funds" ? "insufficient" : "declined");
      }
    } catch (e) {
      const code = (e && e.code) || "error";
      if (["slot_full", "closed", "too_soon", "payment_window_expired", "item_unavailable", "invalid_items", "idempotency_conflict"].includes(code)) { co.reset(); unlock(); }
      showError(code);
    } finally { busy = false; paint(); }
  });
  // Reopening after success shows the form again.
  document.getElementById("checkoutButton")?.addEventListener("click", () => { box.hidden = false; btn.hidden = false; const pk = $("pickup"); if (pk) pk.hidden = false; });
  prepare();
})(typeof window !== "undefined" ? window : globalThis);
