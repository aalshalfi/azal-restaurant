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
  // T-02: the same mobile rule as profiles and 0008/0010 azal_phone(): ASCII digits, spaces, dots, dashes, brackets
  // and one leading "+"; 10 digits -> +1, 11 starting with 1 -> +, or "+" and 10-15 digits. Anything else is refused.
  function normalizePhone(raw) {
    const s = String(raw || "");
    if (!/^\s*\+?[0-9 ().-]+$/.test(s)) return null;
    const d = s.replace(/[^0-9]/g, "");
    if (/^\d{10}$/.test(d)) return "+1" + d;
    if (/^1\d{10}$/.test(d)) return "+" + d;
    if (/^\s*\+/.test(s) && /^[1-9]\d{9,14}$/.test(d)) return "+" + d;
    return null;
  }
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

  // Kitchen note: up to 500 characters, as the server's place_order allows (0004 note_too_long). Never cut in silence
  // (defect ledger: silent loss at encode): a longer note is refused with the same code the server would give.
  const NOTE_MAX = 500;
  function noteOf(note) {
    const t = note ? String(note).trim() : "";
    if ([...t].length > NOTE_MAX) throw Object.assign(new Error("note_too_long"), { code: "note_too_long" });
    return t || null;
  }
  function buildOrder({ cart, choice, day, note, guest, branch, key, nowMs, redeem, phone }) {
    const items = [];
    for (const [id, q] of cart) { const u = itemUuid(Number(id)); if (!u) return null; items.push({ menu_item_id: u, quantity: Number(q) }); }
    if (!items.length) return null;
    const body = { p_branch: branch || "ottawa", p_items: items, p_pickup_at: null, p_note: noteOf(note), p_idempotency_key: key };
    if (choice !== "asap") {
      const at = torontoInstant(nowMs, day === "tomorrow" ? 1 : 0, Number(choice));
      if (!at) return null;
      body.p_pickup_at = at;
    }
    if (guest) { body.p_guest_name = guest.name; body.p_guest_email = guest.email; }
    // F-OWN-4: only sent when the member chose a reward, so a server without 0006 keeps working for everyone else.
    if (!guest && Number.isSafeInteger(redeem) && redeem > 0 && redeem % 10000 === 0) body.p_redeem_points = redeem;
    // T-02: a guest always sends a mobile (checked before this); a member sends one only when given for this order.
    if (phone) body.p_guest_phone = phone;
    return body;
  }

  // F-OWN-4: which rewards a member can use on this order. The server's redeem_options() is the authority; this only
  // decides what to SHOW: usable tiers (enough points, not more than the subtotal) and, if none, the next one to aim for.
  function redeemView(opts, subtotalCents) {
    const balance = opts && Number.isSafeInteger(opts.balance) && opts.balance > 0 ? opts.balance : 0;
    const stepPoints = opts && Number.isSafeInteger(opts.step_points) ? opts.step_points : 0;
    const centsPerStep = opts && Number.isSafeInteger(opts.cents_per_step) ? opts.cents_per_step : 0;
    if (stepPoints === 10000 && centsPerStep === 1000) {
      const cap = opts && Number.isSafeInteger(opts.max_steps) ? Math.min(20, Math.max(1, opts.max_steps)) : 20;
      const steps = Math.min(Math.floor(balance / stepPoints), Math.floor(Math.max(0, subtotalCents) / centsPerStep), cap);
      const usable = Array.from({ length: steps }, (_, i) => ({ points: (i + 1) * stepPoints, cents: (i + 1) * centsPerStep }));
      const nextPoints = (Math.floor(balance / stepPoints) + 1) * stepPoints;
      const next = { points: nextPoints, cents: (nextPoints / stepPoints) * centsPerStep };
      const min = balance >= stepPoints ? { points: stepPoints, cents: centsPerStep } : null;
      return { balance, usable, next, min, first: balance < stepPoints, any: true };
    }
    // Compatibility with a server still on 0006: hide its legacy 5,000-point tier immediately.
    // Until 0007 is applied, only the single 10,000-point tier is displayed; the server remains authoritative.
    const tiers = (opts && Array.isArray(opts.tiers) ? opts.tiers : [])
      .filter((t) => Number.isSafeInteger(t.points) && t.points > 0 && t.points % 10000 === 0
        && Number.isSafeInteger(t.cents) && t.cents === t.points / 10)
      .sort((a, b) => a.points - b.points).slice(0, 20);
    const usable = tiers.filter((t) => t.points <= balance && t.cents <= subtotalCents);
    const next = tiers.find((t) => t.points > balance) || null;
    const min = tiers.find((t) => t.points <= balance) || null;
    return { balance, usable, next, min, first: next !== null && next.points === 10000, any: tiers.length > 0 };
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
      async options() { if (!enabled) return null; return rpc("redeem_options", {}); },
      async place(args) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        if (order) return order; // already placed in this attempt: go straight to payment
        const body = buildOrder(Object.assign({}, args, { key }));
        if (!body) throw Object.assign(new Error("invalid_items"), { code: "invalid_items" });
        try { order = await rpc("place_order", body); }
        catch (e) {
          // Until the lead applies 0010, place_order has no p_guest_phone (PostgREST: 404, no matching function).
          // Retry once without it; nothing was created by the refused call. After 0010 this branch never runs.
          if (e.status === 404 && "p_guest_phone" in body) { const b2 = Object.assign({}, body); delete b2.p_guest_phone; order = await rpc("place_order", b2); }
          else throw e;
        }
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

  // The guest's join link: the email travels in the URL FRAGMENT (never sent to any server) to member.html.
  const joinHref = (email) => "member.html#join=" + encodeURIComponent(String(email || "").trim().toLowerCase());
  const api = { NOTE_MAX, createCheckout, cardToToken, validateGuest, normalizePhone, buildOrder, redeemView, torontoInstant, itemUuid, TEST_CARDS, joinHref };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const cfg = root.AZAL_SUPABASE || {};
  const auth = root.AZALAuth;
  const co = createCheckout({ config: cfg, fetch: root.fetch && root.fetch.bind(root), getToken: async () => { try { const s = auth && (await auth.session()); return s && s.access_token; } catch { return null; } } });
  root.AZALCheckout = co;
  if (!co.enabled) return; // inert: preview checkout unchanged

  const S = {
    en: { kicker: "TEST MODE", title: "Your order", text: "Payment is in test mode: use a test card below. No real money moves.",
      guestName: "Your name", guestEmail: "Email for your receipt and points", phone: "Mobile number (so the kitchen can call you)", phoneMember: "Mobile for this order (so the kitchen can call you)", whoTitle: "How would you like to order?", whoSignIn: "Sign in", whoJoin: "Create an account", whoGuest: "Continue as guest", whoBack: "Have an account? Sign in instead", whoGuestNote: "As a guest you pay the same and get the same pickup. Points are for members: to collect this order’s points later, join with the same email.", joinBtn: "Join & collect these points", e_phone: "Please check your mobile number (10 digits, or + and country code).", e_phone_required: "Please add your mobile number.", e_invalid_phone: "Please check your mobile number (10 digits, or + and country code).", signedAs: "Ordering as {email}",
      note: "Note for the kitchen (optional)", notePh: "Allergies, less spice, extra bread…",
      card: "Card number (test cards only)", cardHelp: "Test cards: 4242 4242 4242 4242 pays · 4000 0000 0000 0002 is declined · 4000 0000 0000 9995 has insufficient funds.",
      pay: "Pay {total}", payPlain: "Place order and pay", working: "One moment…",
      paid: "Paid. Ready at {time}. At the counter, just say {sigil} (code {code}).", paidGuest: "Join with {email} to collect the points for this order.",
      declined: "Card declined. Your order is kept for 15 minutes: try another test card.", insufficient: "Insufficient funds. Your order is kept for 15 minutes: try another test card.",
      e_not_test_card: "Only the test card numbers shown work here.", e_name: "Please add your name.", e_email: "Please check your email address.",
      e_slot_full: "That time just filled up. Choose another time.", e_closed: "We’re closed for orders at that time. Choose another time.", e_too_soon: "That time is too soon now. Choose another time.",
      e_item_unavailable: "Something in your order is no longer available.", e_rate_limited: "Too many unpaid orders. Please wait a few minutes.",
      e_payment_window_expired: "This order expired before payment. Start again.", e_payments_not_in_test_mode: "Payments are off right now. Nothing was charged.",
      e_note_too_long: "The note is too long (500 characters max).", e_network: "Connection problem. Check your connection and try again: you will not be charged twice.",
      e_error: "Something went wrong. Nothing was charged. Please try again.",
      ptsTitle: "Majlis points", ptsBalance: "You have {points} points.", ptsNone: "Don’t use points", ptsUse: "Use {points} points: {amount} off",
      ptsNext: "Your first reward, {amount} off, comes at {points} points.", ptsNextMore: "Your next reward, {amount} off, comes at {points} points.", ptsMinOrder: "Your points can take {amount} off an order of {amount} or more.",
      e_points_insufficient: "Your points balance changed. Choose again.", e_invalid_redeem: "That reward is not available. Choose again.", e_redeem_exceeds_order: "That reward is larger than this order. Choose a smaller one.", e_redeem_members_only: "Sign in to use your points." },
    fr: { kicker: "MODE TEST", title: "Votre commande", text: "Le paiement est en mode test : utilisez une carte test ci-dessous. Aucun paiement réel n’est effectué.",
      guestName: "Votre nom", guestEmail: "Courriel pour le reçu et les points", phone: "Numéro de cellulaire (pour que la cuisine puisse vous appeler)", phoneMember: "Cellulaire pour cette commande (pour que la cuisine puisse vous appeler)", whoTitle: "Comment souhaitez-vous commander\u00a0?", whoSignIn: "Se connecter", whoJoin: "Créer un compte", whoGuest: "Continuer en invité", whoBack: "Vous avez un compte\u00a0? Connectez-vous plutôt", whoGuestNote: "En invité, vous payez le même prix et le retrait est le même. Les points sont réservés aux membres\u00a0: pour récupérer ceux de cette commande plus tard, inscrivez-vous avec le même courriel.", joinBtn: "S’inscrire et recevoir ces points", e_phone: "Vérifiez votre numéro de cellulaire (10 chiffres, ou + et l’indicatif du pays).", e_phone_required: "Veuillez indiquer votre numéro de cellulaire.", e_invalid_phone: "Vérifiez votre numéro de cellulaire (10 chiffres, ou + et l’indicatif du pays).", signedAs: "Commande au nom de {email}",
      note: "Note pour la cuisine (facultatif)", notePh: "Allergies, moins épicé, plus de pain…",
      card: "Numéro de carte (cartes test seulement)", cardHelp: "Cartes test : 4242 4242 4242 4242 paie · 4000 0000 0000 0002 est refusée · 4000 0000 0000 9995 a des fonds insuffisants.",
      pay: "Payer {total}", payPlain: "Commander et payer", working: "Un instant…",
      paid: "Payé. Prêt à {time}. Au comptoir, dites simplement {sigil} (code {code}).", paidGuest: "Inscrivez-vous avec {email} pour recevoir les points de cette commande.",
      declined: "Carte refusée. Votre commande est gardée 15 minutes : essayez une autre carte test.", insufficient: "Fonds insuffisants. Votre commande est gardée 15 minutes : essayez une autre carte test.",
      e_not_test_card: "Seuls les numéros de carte test indiqués fonctionnent ici.", e_name: "Veuillez indiquer votre nom.", e_email: "Veuillez vérifier votre courriel.",
      e_slot_full: "Cet horaire vient d’être complet. Choisissez un autre horaire.", e_closed: "Les commandes sont fermées à cette heure. Choisissez un autre horaire.", e_too_soon: "Cet horaire est trop proche. Choisissez un autre horaire.",
      e_item_unavailable: "Un article de votre commande n’est plus disponible.", e_rate_limited: "Trop de commandes non payées. Patientez quelques minutes.",
      e_payment_window_expired: "Cette commande a expiré avant le paiement. Recommencez.", e_payments_not_in_test_mode: "Les paiements sont désactivés pour l’instant. Rien n’a été débité.",
      e_note_too_long: "La note est trop longue (500 caractères max.).", e_network: "Problème de connexion. Vérifiez votre connexion et réessayez : vous ne serez pas débité deux fois.",
      e_error: "Un problème est survenu. Rien n’a été débité. Veuillez réessayer.",
      ptsTitle: "Points Majlis", ptsBalance: "Vous avez {points} points.", ptsNone: "Ne pas utiliser de points", ptsUse: "Utiliser {points} points : {amount} de rabais",
      ptsNext: "Votre première récompense, {amount} de rabais, arrive à {points} points.", ptsNextMore: "Votre prochaine récompense, {amount} de rabais, arrive à {points} points.", ptsMinOrder: "Vos points donnent {amount} de rabais sur une commande de {amount} ou plus.",
      e_points_insufficient: "Votre solde de points a changé. Choisissez de nouveau.", e_invalid_redeem: "Cette récompense n’est pas disponible. Choisissez de nouveau.", e_redeem_exceeds_order: "Cette récompense dépasse le montant de la commande. Choisissez-en une plus petite.", e_redeem_members_only: "Connectez-vous pour utiliser vos points." },
    ar: { kicker: "وضع التجربة", title: "طلبك", text: "الدفع هنا تجريبي: استخدم إحدى البطاقات التجريبية أدناه، ولن تُنقل أي أموال حقيقية.",
      guestName: "اسمك", guestEmail: "البريد لإيصالك ونقاطك", phone: "رقم الجوال (ليتصل بك المطبخ عند الحاجة)", phoneMember: "رقم الجوال لهذا الطلب (ليتصل بك المطبخ عند الحاجة)", whoTitle: "كيف تحب أن تطلب؟", whoSignIn: "تسجيل الدخول", whoJoin: "إنشاء حساب", whoGuest: "المتابعة كضيف", whoBack: "لديك حساب؟ سجّل الدخول بدلاً من ذلك", whoGuestNote: "كضيف تدفع السعر نفسه ويصلك الطلب بالطريقة نفسها. النقاط للأعضاء فقط، ولتحصل على نقاط هذا الطلب لاحقاً سجّل عضويتك بالبريد الإلكتروني نفسه.", joinBtn: "انضم واجمع نقاط هذا الطلب", e_phone: "تحقّق من رقم جوالك (10 أرقام، أو + ورمز الدولة).", e_phone_required: "اكتب رقم جوالك.", e_invalid_phone: "تحقّق من رقم جوالك (10 أرقام، أو + ورمز الدولة).", signedAs: "تطلب بحسابك {email}",
      note: "ملاحظة للمطبخ (اختياري)", notePh: "حساسية، حار أقل، خبز إضافي…",
      card: "رقم البطاقة (بطاقات تجريبية فقط)", cardHelp: "بطاقات تجريبية: 4242 4242 4242 4242 تدفع · 4000 0000 0000 0002 تُرفض · 4000 0000 0000 9995 رصيدها غير كافٍ.",
      pay: "ادفع {total}", payPlain: "اطلب وادفع", working: "لحظة…",
      paid: "تم الدفع. طلبك جاهز الساعة {time}. عند الاستلام قل فقط {sigil} (الرمز {code}).", paidGuest: "انضم إلى المجلس ببريدك {email} لتحصل على نقاط هذا الطلب.",
      declined: "رُفضت البطاقة. نحفظ طلبك 15 دقيقة، فجرّب بطاقة تجريبية أخرى.", insufficient: "الرصيد غير كافٍ. نحفظ طلبك 15 دقيقة، فجرّب بطاقة تجريبية أخرى.",
      e_not_test_card: "تعمل هنا أرقام البطاقات التجريبية المعروضة فقط.", e_name: "اكتب اسمك.", e_email: "تحقّق من بريدك الإلكتروني.",
      e_slot_full: "امتلأ هذا الوقت للتو. اختر وقتاً آخر.", e_closed: "الطلبات مغلقة في هذا الوقت. اختر وقتاً آخر.", e_too_soon: "اقترب هذا الوقت كثيراً. اختر وقتاً آخر.",
      e_item_unavailable: "صنف في طلبك لم يعد متاحاً.", e_rate_limited: "عندك طلبات كثيرة لم تُدفع بعد. انتظر بضع دقائق.",
      e_payment_window_expired: "انتهت مهلة هذا الطلب قبل الدفع. ابدأ من جديد.", e_payments_not_in_test_mode: "الدفع متوقف الآن. لم يُخصم شيء.",
      e_note_too_long: "الملاحظة أطول من 500 حرف. اختصرها قليلاً.", e_network: "مشكلة في الاتصال. تأكّد من الشبكة وحاول مرة أخرى، ولن يُخصم منك مرتين.",
      e_error: "حدث خطأ. لم يُخصم شيء. حاول مرة أخرى.",
      ptsTitle: "نقاط المجلس", ptsBalance: "رصيدك {points} نقطة.", ptsNone: "لا أريد استخدام النقاط", ptsUse: "استخدم {points} نقطة: خصم {amount}",
      ptsNext: "أول مكافأة لك خصم {amount}، تصلها عند {points} نقطة.", ptsNextMore: "مكافأتك التالية خصم {amount}، تصلها عند {points} نقطة.", ptsMinOrder: "نقاطك تخصم {amount} من أي طلب قيمته {amount} أو أكثر.",
      e_points_insufficient: "تغيّر رصيد نقاطك. اختر من جديد.", e_invalid_redeem: "هذه المكافأة غير متاحة. اختر من جديد.", e_redeem_exceeds_order: "المكافأة أكبر من قيمة هذا الطلب. اختر مكافأة أصغر.", e_redeem_members_only: "سجّل دخولك لتستخدم نقاطك." },
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const locOf = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const L = (k, vars) => { let s = S[lang()][k] || S.en[k] || k; for (const v in vars || {}) s = s.split("{" + v + "}").join(vars[v]); return s.replace(/\.\./g, "."); };
  // Same bidi rule as script.js (F-WALK-3): in Arabic every price is a left-to-right isolate.
  const money = (c) => { const s = new Intl.NumberFormat(locOf(), { style: "currency", currency: "CAD" }).format(c / 100); return lang() === "ar" ? "\u2066" + s.replace(/\u200f/g, "") + "\u2069" : s; };
  const timeOf = (iso) => new Intl.DateTimeFormat(locOf(), { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(iso));

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
  // F-OWN-20 (owner 18:58): a signed-out customer is first TOLD the options: sign in, create an account, or continue
  // as a guest (with the guest's points consequence stated before the fields). Signed-in customers never see it.
  box.innerHTML = '<div class="co-who" id="coWho" hidden><p class="co-who-title" id="coWhoTitle"></p><div class="co-who-actions">' +
    '<a class="button button-gold" id="coWhoSignIn" href="member.html#return=checkout&mode=signin"></a>' +
    '<a class="button co-who-join" id="coWhoJoin" href="member.html#return=checkout&mode=join"></a>' +
    '<button type="button" class="button co-who-guest" id="coWhoGuest"></button></div>' +
    '<p class="co-help" id="coWhoGuestNote"></p></div>' +
    '<div id="coFields"><div class="co-guest" id="coGuest" hidden><a class="co-who-back" id="coWhoBack" href="member.html#return=checkout&mode=signin"></a><label for="coName"></label><input id="coName" autocomplete="name" maxlength="80"><label for="coEmail"></label><input id="coEmail" type="email" autocomplete="email" maxlength="254"></div>' +
    '<label for="coPhone"></label><input id="coPhone" type="tel" dir="ltr" autocomplete="tel" maxlength="24">' +
    '<p class="co-signed" id="coSigned" hidden></p>' +
    '<fieldset class="co-points" id="coPoints" hidden><legend id="coPtsTitle"></legend><p class="co-help" id="coPtsBalance"></p><div id="coPtsChoices"></div><p class="co-help" id="coPtsNext" hidden></p></fieldset>' +
    '<label for="coNote"></label><textarea id="coNote" maxlength="500" rows="2"></textarea>' +
    '<label for="coCard"></label><input id="coCard" inputmode="numeric" autocomplete="off" maxlength="23" spellcheck="false"><p class="co-help" id="coCardHelp"></p></div>' +
    '<p class="co-error" id="coError" role="alert"></p>';
  btn.before(box);
  // F-OWN-20: the choice sits at the top of the sheet, above the pickup time, so it is the first thing read.
  { const pk = document.getElementById("pickup"); if (pk) pk.before(document.getElementById("coWho")); }
  const $ = (id) => document.getElementById(id);
  const msg = $("checkoutMessage");
  let guestMode = true, busy = false, ptsOpts = null, redeem = 0, guestChosen = false;
  // Leaving to sign in / join keeps the order: the cart is already saved; the note and the pickup choice ride along in
  // this tab's sessionStorage for 30 minutes and are restored when the customer comes back (#checkout).
  const STASH = "azal-checkout-return";
  function stash() {
    try { sessionStorage.setItem(STASH, JSON.stringify({ from: root.location.pathname.split("/").pop() || "menu.html", note: $("coNote").value, choice: (typeof pickupState !== "undefined" && pickupState.choice) || null, at: Date.now() })); } catch {}
  }
  const nf = () => new Intl.NumberFormat(locOf());
  const subtotalNow = () => { try { return cartTotals([...cart.entries()]).sub; } catch { return 0; } };
  const setRedeem = (pts, cents) => { redeem = pts; root.AZAL_REDEEM_CENTS = cents; try { if (typeof renderCart === "function") renderCart(); } catch {} };
  // Members only. Every control shown here works: unaffordable rewards are not shown as options (no dead radios), only
  // as the next goal. If the server has no redeem_options (0006 not applied) the section stays hidden.
  function paintPoints() {
    const fs = $("coPoints"); if (!fs) return;
    if (guestMode || !ptsOpts) { fs.hidden = true; if (redeem) setRedeem(0, 0); return; }
    const v = redeemView(ptsOpts, subtotalNow());
    if (!v.any) { fs.hidden = true; if (redeem) setRedeem(0, 0); return; } // CX-3: never keep a hidden reward
    fs.hidden = false;
    $("coPtsTitle").textContent = L("ptsTitle");
    $("coPtsBalance").textContent = L("ptsBalance", { points: nf().format(v.balance) });
    if (redeem && !v.usable.some((t) => t.points === redeem)) setRedeem(0, 0);
    const wrap = $("coPtsChoices"); wrap.replaceChildren();
    if (v.usable.length) {
      for (const t of [{ points: 0, cents: 0 }].concat(v.usable)) {
        const id = "coPts" + t.points, lab = document.createElement("label"), r = document.createElement("input");
        r.type = "radio"; r.name = "coPts"; r.id = id; r.value = String(t.points); r.checked = redeem === t.points;
        r.addEventListener("change", () => { if (co.order) { co.reset(); unlock(); } setRedeem(t.points, t.cents); paint(); });
        lab.className = "co-pts-choice"; lab.htmlFor = id;
        lab.append(r, document.createTextNode(" " + (t.points ? L("ptsUse", { points: nf().format(t.points), amount: money(t.cents) }) : L("ptsNone"))));
        wrap.append(lab);
      }
    }
    const nx = $("coPtsNext");
    // CX-2: enough points but an order smaller than the smallest reward: say what unlocks it (no blank box).
    const minOrder = !v.usable.length && v.min ? v.min : null;
    nx.hidden = !v.next && !minOrder;
    if (minOrder) nx.textContent = L("ptsMinOrder", { amount: money(minOrder.cents) });
    else if (v.next) nx.textContent = L(v.first ? "ptsNext" : "ptsNextMore", { points: nf().format(v.next.points), amount: money(v.next.cents) });
  }
  async function loadPoints() {
    ptsOpts = null;
    if (!guestMode) { try { ptsOpts = await co.options(); } catch { ptsOpts = null; } }
    paintPoints();
  }

  const kicker = panel.querySelector("[data-i18n='demoOnly']"), title = $("checkoutTitle");
  const intro = panel.querySelector("[data-i18n='checkoutText']"), demoNote = panel.querySelector("[data-i18n='demoPickupOnly']");

  function paintWho() {
    if (box.hidden) { $("coWho").hidden = true; return; } // the success state owns the sheet until it is reopened
    const ask = guestMode && !guestChosen;
    $("coWho").hidden = !ask; $("coFields").hidden = ask; btn.hidden = ask;
    $("coWhoTitle").textContent = L("whoTitle"); $("coWhoSignIn").textContent = L("whoSignIn"); $("coWhoJoin").textContent = L("whoJoin");
    $("coWhoGuest").textContent = L("whoGuest"); $("coWhoGuestNote").textContent = L("whoGuestNote"); $("coWhoBack").textContent = L("whoBack");
  }
  function paint() {
    if (kicker) kicker.textContent = L("kicker");
    if (title) title.textContent = L("title");
    if (intro) intro.textContent = L("text");
    if (demoNote) demoNote.hidden = true;
    box.querySelector("label[for=coName]").textContent = L("guestName");
    box.querySelector("label[for=coEmail]").textContent = L("guestEmail");
    box.querySelector("label[for=coPhone]").textContent = L(guestMode ? "phone" : "phoneMember");
    box.querySelector("label[for=coNote]").textContent = L("note");
    $("coNote").placeholder = L("notePh");
    box.querySelector("label[for=coCard]").textContent = L("card");
    $("coCard").setAttribute("aria-describedby", "coCardHelp");
    $("coCardHelp").textContent = L("cardHelp");
    btn.textContent = busy ? L("working") : co.order ? L("pay", { total: money(co.order.total_cents) }) : L("payPlain");
    paintPoints();
    paintWho();
  }
  async function prepare() {
    let s = null; try { s = auth && (await auth.session()); } catch {}
    guestMode = !s;
    $("coGuest").hidden = !guestMode;
    $("coSigned").hidden = guestMode;
    if (s) $("coSigned").textContent = L("signedAs", { email: (s.user && s.user.email) || "" });
    // Members: the profile mobile (0008) is filled in; changing it here applies to this order only.
    if (s && !$("coPhone").value) { try { const st = auth && (await auth.state()); if (st && st.phone) $("coPhone").value = st.phone; } catch {} }
    paint();
    await loadPoints();
  }
  const unlock = () => { $("coName").disabled = $("coEmail").disabled = $("coPhone").disabled = false; };
  const showError = (code) => { $("coError").textContent = L("e_" + code) === "e_" + code ? L("e_error") : L("e_" + code); };

  const sig = () => { try { return JSON.stringify([...cart.entries()].sort()) + "|" + (pickupState.choice || "") + "|" + redeem; } catch { return ""; } };
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
    const rawPhone = $("coPhone").value.trim();
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    if (guestMode && !rawPhone) { showError("phone_required"); $("coPhone").focus(); return; }
    if (rawPhone && !phone) { showError("phone"); $("coPhone").focus(); return; }
    if (!cardToToken($("coCard").value)) { showError("not_test_card"); $("coCard").focus(); return; }
    busy = true; paint();
    try {
      // script.js keeps `cart` and `pickupState` as top-level bindings shared across classic scripts.
      const c = typeof cart !== "undefined" ? cart : null;
      const ps = typeof pickupState !== "undefined" ? pickupState : { choice: "asap", plan: { day: "today" } };
      placedSig = sig();
      await co.place({ cart: c, choice: ps.choice || "asap", day: ps.plan && ps.plan.day, note: $("coNote").value, guest, nowMs: Date.now(), redeem: guest ? 0 : redeem, phone });
      $("coName").disabled = $("coEmail").disabled = $("coPhone").disabled = true; // the order is tied to these details now
      paint();
      const r = await co.pay($("coCard").value, guest && guest.email);
      $("coCard").value = "";
      if (r.outcome === "paid") {
        const o = co.order;
        if (msg) msg.textContent = L("paid", { time: timeOf(o.pickup_at), code: String(o.order_id).slice(0, 6).toUpperCase(), sigil: root.AzalSigil ? root.AzalSigil.label(o.order_id, lang()) : String(o.order_id).slice(0, 6).toUpperCase() }) + (guest ? " " + L("paidGuest", { email: guest.email }) : "");
        // V8: the sigil in large type, so the guest can just show the phone at the counter.
        const sg = root.AzalSigil && root.AzalSigil.sigil(o.order_id);
        if (msg && sg) { const big = document.createElement("span"); big.className = "co-sigil"; big.textContent = root.AzalSigil.label(o.order_id, lang()); msg.append(big); }
        // T-02 / F-OWN-16: the join line is a real action for guests: the join form with this order's email, locked.
        if (msg && guest) { const a = document.createElement("a"); a.className = "button button-gold co-join"; a.id = "coJoin"; a.href = joinHref(guest.email); a.textContent = L("joinBtn"); msg.append(a); }
        root.AZAL_REDEEM_CENTS = 0; redeem = 0;
        try { c.clear(); if (typeof renderCart === "function") renderCart(); } catch {}
        co.reset(); unlock(); box.hidden = true; btn.hidden = true; const pk = $("pickup"); if (pk) pk.hidden = true;
      } else {
        $("coError").textContent = L(r.reason === "insufficient_funds" ? "insufficient" : "declined");
      }
    } catch (e) {
      const code = (e && e.code) || "error";
      if (["slot_full", "closed", "too_soon", "payment_window_expired", "item_unavailable", "invalid_items", "idempotency_conflict", "note_too_long", "points_insufficient", "invalid_redeem", "redeem_exceeds_order", "redeem_members_only", "phone_required", "invalid_phone"].includes(code)) { co.reset(); unlock(); }
      if (["points_insufficient", "invalid_redeem", "redeem_exceeds_order", "redeem_members_only"].includes(code)) { setRedeem(0, 0); loadPoints(); }
      showError(code);
    } finally { busy = false; paint(); }
  });
  $("coWhoGuest").addEventListener("click", () => { guestChosen = true; paint(); $("coName").focus(); });
  for (const id of ["coWhoSignIn", "coWhoJoin", "coWhoBack"]) $(id).addEventListener("click", stash);
  // Back from sign-in/join (#checkout): reopen the sheet with the cart, the pickup choice and the note as they were.
  try {
    const back = root.location.hash === "#checkout" && JSON.parse(sessionStorage.getItem(STASH) || "null");
    if (root.location.hash === "#checkout") { try { root.history.replaceState(null, "", root.location.pathname + root.location.search); } catch {} }
    if (back && Date.now() - back.at < 30 * 60e3) {
      sessionStorage.removeItem(STASH);
      // The checkout button copies the CURRENT choice into `keep`, so the carried choice must be the current one.
      if (back.choice && typeof pickupState !== "undefined") pickupState.choice = back.choice;
      setTimeout(() => { document.getElementById("checkoutButton")?.click(); setTimeout(() => { if (back.note) $("coNote").value = back.note; }, 0); }, 0);
    }
  } catch {}
  // Reopening after success shows the form again.
  document.getElementById("checkoutButton")?.addEventListener("click", () => { box.hidden = false; btn.hidden = false; const pk = $("pickup"); if (pk) pk.hidden = false; });
  prepare();
})(typeof window !== "undefined" ? window : globalThis);
