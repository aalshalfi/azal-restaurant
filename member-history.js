/* AZAL member page: your orders + your points history (Claude, ORD-REAL). Read-only, the member's OWN rows only
   (explicit user_id filter on top of RLS, because staff RLS can see more). Every value is rendered with textContent.
   Inert while window.AZAL_SUPABASE is null or nobody is signed in. */
(function (root) {
  "use strict";
  const code = (id) => String(id || "").slice(0, 6).toUpperCase();

  const cupsFrom = (ledger) => Math.max(0, (ledger || []).filter((r) => r.entry_type === "earn").length - (ledger || []).filter((r) => r.entry_type === "earn_reversal").length);
  function createHistory({ config, fetch: fetchFn, getSession, pageSize }) {
    const PAGE = pageSize || 500;   // below Supabase's default PostgREST max-rows (1000), so pages are never truncated
    const MAX_ROWS = 100000;
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    async function get(path, token) {
      let res;
      try { res = await fetchFn(base + path, { headers: { apikey: config.anonKey, Authorization: "Bearer " + token } }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      if (!res.ok) throw Object.assign(new Error("http_" + res.status), { code: res.status === 401 ? "signed_out" : "error", status: res.status });
      return (await res.json()) || [];
    }
    return {
      enabled,
      async load() {
        const s = enabled && getSession ? await getSession() : null;
        const uid = s && s.user && s.user.id;
        if (!uid) return null;
        const u = encodeURIComponent(uid);
        // The WHOLE ledger is read (paged to exhaustion) so the balance and the cups are complete; only the
        // 50 newest rows are listed on screen. Stable order (created_at, id) so pages never overlap or skip.
        async function allLedger() {
          const rows = [];
          for (let offset = 0; ; offset += PAGE) {
            const page = await get("/rest/v1/points_ledger?select=id,entry_type,delta_points,created_at,order_id&user_id=eq." + u + "&order=created_at.desc,id.desc&limit=" + PAGE + "&offset=" + offset, s.access_token);
            rows.push(...page);
            if (page.length < PAGE) return rows;
            // Safety cap: never present a partial ledger as complete. 200 pages x 500 rows = 100,000 entries.
            if (offset + PAGE >= MAX_ROWS) throw Object.assign(new Error("ledger_too_large"), { code: "error" });
          }
        }
        const [orders, ledgerAll] = await Promise.all([
          get("/rest/v1/orders?select=id,placed_at,pickup_slot,fulfilment_status,payment_status,total_cents,order_items(quantity,item_name_en_snapshot,item_name_fr_snapshot)" +
            "&user_id=eq." + u + "&order=placed_at.desc&limit=20", s.access_token),
          allLedger()
        ]);
        return { orders, ledger: ledgerAll.slice(0, 50), cups: cupsFrom(ledgerAll), entries: ledgerAll.length, total: ledgerAll.reduce((a, r) => a + Number(r.delta_points || 0), 0) };
      },
      // F-OWN-3: one order in full, on demand. `*` so the 0006 columns (discount_cents, redeemed_points) come along
      // when present and nothing breaks before 0006 is applied. Own rows only (user_id filter on top of RLS).
      async detail(orderId) {
        const s = enabled && getSession ? await getSession() : null;
        const uid = s && s.user && s.user.id;
        if (!uid) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
        if (!/^[0-9a-f-]{36}$/i.test(String(orderId))) throw Object.assign(new Error("not_found"), { code: "not_found" });
        // Explicit allow-list (ChatGPT #59 review): only the columns the panel renders. No hashes, keys, guest
        // contact or internal fields ever travel. The 0006 columns are asked for, with one fallback for a server
        // that has not applied 0006 (PostgREST answers 400 for an unknown column).
        const q = (cols) => "/rest/v1/orders?select=" + cols + ",order_items(quantity,unit_price_cents,line_total_cents,item_name_en_snapshot,item_name_fr_snapshot),order_events(event_type,created_at)" +
          "&id=eq." + encodeURIComponent(orderId) + "&user_id=eq." + encodeURIComponent(uid) + "&order_events.order=created_at.asc,id.asc&limit=1";
        let rows;
        // Newest columns first (0010 contact_phone, 0006 points); each older server answers 400 and we step back once.
        rows = null;
        for (const extra of [",discount_cents,redeemed_points,contact_phone", ",discount_cents,redeemed_points", ""]) {
          try { rows = await get(q(DETAIL_COLS + extra), s.access_token); break; }
          catch (e) { if (e.status !== 400) throw e; }
        }
        if (!rows) throw Object.assign(new Error("error"), { code: "error" });
        if (!rows.length) throw Object.assign(new Error("not_found"), { code: "not_found" });
        return detailView(rows[0]);
      }
    };
  }

  // F-OWN-3: everything the guest needs to check an order, from the server's own snapshot (never recomputed here).
  const DETAIL_COLS = "id,subtotal_cents,tax_rate_bps,tax_cents,total_cents,scheduled_for,pickup_slot,customer_note,fulfilment_status,payment_status";
  // A Map, not an object literal: "constructor", "toString", "__proto__" are never steps (ChatGPT #59 review).
  const STEP = new Map([["placed", "placed"], ["paid", "paid"], ["accept", "accepted"], ["prepare", "preparing"], ["ready", "ready"], ["hand_over", "handed_over"], ["cancel", "cancelled"]]);
  function detailView(r) {
    const lines = (r.order_items || []).map((i) => ({ q: Number(i.quantity), en: i.item_name_en_snapshot, fr: i.item_name_fr_snapshot || i.item_name_en_snapshot, unit: Number(i.unit_price_cents), line: Number(i.line_total_cents) }));
    const timeline = (r.order_events || []).filter((e) => STEP.has(e.event_type)).map((e) => ({ step: STEP.get(e.event_type), at: e.created_at }));
    return { id: r.id, lines, subtotal: Number(r.subtotal_cents), discount: Number(r.discount_cents || 0), points: Number(r.redeemed_points || 0),
      tax: Number(r.tax_cents), rateBps: Number(r.tax_rate_bps), total: Number(r.total_cents), pickup: r.scheduled_for || r.pickup_slot || null,
      note: r.customer_note || null, phone: r.contact_phone || null, status: r.fulfilment_status, payment: r.payment_status, timeline };
  }

  // V3 "Majlis as hospitality": one qahwa cup per collected paid order (earn rows minus reversals). The exact
  // points number is always shown next to it; the cups never replace or hide it.
  const api = { createHistory, code, cupsFrom, detailView, DETAIL_COLS };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const card = document.querySelector(".member-card");
  const auth = root.AZALAuth;
  const h = createHistory({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root), getSession: async () => { try { return auth && (await auth.session()); } catch { return null; } } });
  if (!h.enabled || !card) return;

  const S = {
    en: { orders: "Your orders", none: "No orders yet. Your pickups will appear here.", points: "Your points", noPoints: "No points yet. Points are added when a paid order is collected.",
      total: "Balance: {n} points", code: "Code {code}", pickup: "Pickup {time}", more: "and {n} more",
      st_placed: "Received", st_accepted: "Accepted", st_preparing: "Preparing", st_ready: "Ready for pickup", st_handed_over: "Collected", st_cancelled: "Cancelled",
      pay_unpaid: "Not paid", pay_paid: "Paid", pay_refunded: "Refunded", pay_voided: "Voided",
      e_earn: "Earned", e_redeem: "Used", e_earn_reversal: "Reversed", e_redeem_refund: "Returned",
      forOrder: "order {code}", error: "We couldn’t load your history. Refresh to try again.",
      cups: "{n} cups of qahwa poured for you: one for each order you collected.", cupsOne: "1 cup of qahwa poured for you: one for each order you collected.", cupsMore: "+{n}",
      details: "Order details", hide: "Hide details", each: "{price} each", subtotal: "Subtotal", pointsLine: "Majlis points ({n})", hst: "HST ({rate}%)", grand: "Total",
      pickupAt: "Pickup: {time}", phoneLine: "Mobile for this order: {phone}", note: "Your note: {note}", timeline: "What happened", t_placed: "Received", t_paid: "Paid", t_accepted: "Accepted", t_preparing: "Preparing", t_ready: "Ready", t_handed_over: "Collected", t_cancelled: "Cancelled",
      loading: "Loading…", checked: "Checked at {time}. Close and reopen to check again.", detailError: "We couldn’t load this order. Try again." },
    fr: { orders: "Vos commandes", none: "Aucune commande pour l’instant. Vos retraits apparaîtront ici.", points: "Vos points", noPoints: "Pas encore de points. Ils sont ajoutés quand une commande payée est récupérée.",
      total: "Solde : {n} points", code: "Code {code}", pickup: "Retrait {time}", more: "et {n} de plus",
      st_placed: "Reçue", st_accepted: "Acceptée", st_preparing: "En préparation", st_ready: "Prête à emporter", st_handed_over: "Récupérée", st_cancelled: "Annulée",
      pay_unpaid: "Non payée", pay_paid: "Payée", pay_refunded: "Remboursée", pay_voided: "Annulée",
      e_earn: "Gagnés", e_redeem: "Utilisés", e_earn_reversal: "Retirés", e_redeem_refund: "Rendus",
      forOrder: "commande {code}", error: "Impossible de charger votre historique. Actualisez pour réessayer.",
      cups: "{n} tasses de qahwa servies pour vous\u00a0: une pour chaque commande récupérée.", cupsOne: "1 tasse de qahwa servie pour vous\u00a0: une pour chaque commande récupérée.", cupsMore: "+{n}",
      details: "Détails de la commande", hide: "Masquer les détails", each: "{price} chacun", subtotal: "Sous-total", pointsLine: "Points Majlis ({n})", hst: "TVH ({rate}\u00a0%)", grand: "Total",
      pickupAt: "Retrait\u00a0: {time}", phoneLine: "Cellulaire pour cette commande\u00a0: {phone}", note: "Votre note\u00a0: {note}", timeline: "Déroulement", t_placed: "Reçue", t_paid: "Payée", t_accepted: "Acceptée", t_preparing: "En préparation", t_ready: "Prête", t_handed_over: "Récupérée", t_cancelled: "Annulée",
      loading: "Chargement…", checked: "Vérifié à {time}. Fermez et rouvrez pour vérifier de nouveau.", detailError: "Impossible de charger cette commande. Réessayez." },
    ar: { orders: "طلباتك", none: "لا طلبات بعد. ستظهر هنا طلباتك للاستلام.", points: "نقاطك", noPoints: "لا نقاط بعد. تُضاف النقاط عند استلام طلب مدفوع.",
      total: "الرصيد: {n} نقطة", code: "الرمز {code}", pickup: "الاستلام {time}", more: "و{n} أخرى",
      st_placed: "وصلنا طلبك", st_accepted: "قُبل", st_preparing: "قيد التحضير", st_ready: "جاهز للاستلام", st_handed_over: "تم الاستلام", st_cancelled: "أُلغي",
      pay_unpaid: "غير مدفوع", pay_paid: "مدفوع", pay_refunded: "مُسترد", pay_voided: "مُلغى",
      e_earn: "مكتسبة", e_redeem: "مستخدمة", e_earn_reversal: "مسحوبة", e_redeem_refund: "مُعادة",
      forOrder: "الطلب {code}", error: "تعذّر تحميل سجلّك. حدّث الصفحة وحاول مرة أخرى.",
      cups: "صببنا لك {n} فناجين قهوة: فنجان عن كل طلب استلمته.", cupsOne: "صببنا لك فنجان قهوة: فنجان عن كل طلب استلمته.", cupsMore: "+{n}",
      details: "تفاصيل الطلب", hide: "إخفاء التفاصيل", each: "{price} للواحد", subtotal: "المجموع قبل الضريبة", pointsLine: "نقاط المجلس ({n})", hst: "ضريبة المبيعات ({rate}%)", grand: "المجموع",
      pickupAt: "الاستلام: {time}", phoneLine: "رقم الجوال لهذا الطلب: {phone}", note: "ملاحظتك: {note}", timeline: "مسار الطلب", t_placed: "وصلنا طلبك", t_paid: "تم الدفع", t_accepted: "قُبل", t_preparing: "قيد التحضير", t_ready: "جاهز", t_handed_over: "تم الاستلام", t_cancelled: "أُلغي",
      loading: "لحظة…", checked: "آخر تحقّق الساعة {time}. أغلق التفاصيل وافتحها لتتحقّق من جديد.", detailError: "تعذّر تحميل هذا الطلب. حاول مرة أخرى." }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k] || S.en[k] || k; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s.replace(/\.\./g, "."); };
  const loc = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const when = (iso, opts) => new Intl.DateTimeFormat(loc(), Object.assign({ timeZone: "America/Toronto" }, opts)).format(new Date(iso));
  // Same bidi rule as script.js (F-WALK-3): in Arabic every price is one left-to-right isolate.
  const money = (c) => { const s = new Intl.NumberFormat(loc(), { style: "currency", currency: "CAD" }).format(Number(c || 0) / 100); return lang() === "ar" ? "\u2066" + s.replace(/\u200f/g, "") + "\u2069" : s; };
  const neg = (c) => { const s = money(c); return s.startsWith("\u2066") ? "\u2066\u2212" + s.slice(1) : "\u2212" + s; };
  const pts = (n) => new Intl.NumberFormat(loc()).format(n);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const SVGNS = "http://www.w3.org/2000/svg";
  function cupIcon() { // a small finjan (handle-less coffee cup) with steam, drawn in the palette
    const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "mh-cup"); svg.setAttribute("aria-hidden", "true");
    for (const [tag, a] of [["path", { d: "M5 10h14l-1.6 7.2a3 3 0 0 1-2.9 2.3H9.5a3 3 0 0 1-2.9-2.3z", class: "mh-cup-body" }], ["path", { d: "M10 7c0-1.2 1-1.4 1-2.6M14 7c0-1.2 1-1.4 1-2.6", class: "mh-cup-steam" }]]) {
      const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e);
    }
    return svg;
  }
  const box = el("section", "member-history section"); box.id = "memberHistory"; box.hidden = true; box.setAttribute("aria-live", "polite");
  card.closest("section").after(box);
  let data = null, failed = false, seq = 0;
  const open = new Set(), cache = new Map(), loadingIds = new Set(), errIds = new Set();
  // Auth epoch (ChatGPT #59 review): a detail that arrives after a sign-out or an account switch is thrown away.
  let epoch = 0;
  const name = (l) => (lang() === "fr" ? l.fr : l.en);
  function detailPanel(id) {
    const panel = el("div", "mh-detail"); panel.id = "mhd-" + id;
    if (errIds.has(id)) { panel.append(el("p", "member-history-error", L("detailError"))); return panel; }
    const d = cache.get(id);
    if (!d) { panel.append(el("p", "mh-empty", L("loading"))); return panel; }
    const ul = el("ul", "mh-lines");
    for (const l of d.lines) { const li = el("li", "mh-line"); li.append(el("span", "mh-line-name", l.q + "× " + name(l)), el("span", "mh-line-each", L("each", { price: money(l.unit) })), el("strong", "mh-line-total", money(l.line))); ul.append(li); }
    const sums = el("dl", "mh-sums");
    const row = (k, v, cls) => { const w = el("div", "mh-sum" + (cls ? " " + cls : "")); w.append(el("dt", null, k), el("dd", null, v)); sums.append(w); };
    row(L("subtotal"), money(d.subtotal));
    if (d.discount) row(L("pointsLine", { n: pts(d.points) }), neg(d.discount), "mh-sum-points");
    row(L("hst", { rate: String(d.rateBps / 100) }), money(d.tax));
    row(L("grand"), money(d.total), "mh-sum-grand");
    panel.append(ul, sums);
    if (d.checkedAt) panel.append(el("p", "mh-detail-meta mh-checked", L("checked", { time: when(d.checkedAt, { hour: "numeric", minute: "2-digit" }) }) + (loadingIds.has(id) ? " · " + L("loading") : "")));
    if (d.pickup) panel.append(el("p", "mh-detail-meta", L("pickupAt", { time: when(d.pickup, { dateStyle: "medium", timeStyle: "short" }) })));
    if (d.phone) { const ph = el("p", "mh-detail-meta", L("phoneLine", { phone: "" })); const sp = el("span", null, d.phone); sp.dir = "ltr"; ph.append(sp); panel.append(ph); }
    if (d.note) panel.append(el("p", "mh-detail-meta mh-detail-note", L("note", { note: d.note })));
    if (d.timeline.length) {
      const tl = el("ol", "mh-timeline"); tl.setAttribute("aria-label", L("timeline"));
      for (const t of d.timeline) { const li = el("li"); li.append(el("span", null, L("t_" + t.step)), el("time", null, when(t.at, { hour: "numeric", minute: "2-digit" }))); li.lastChild.dateTime = t.at; tl.append(li); }
      panel.append(el("p", "mh-timeline-title", L("timeline")), tl);
    }
    return panel;
  }
  async function toggle(id) {
    if (open.has(id)) { open.delete(id); paint(); return; }
    open.add(id); errIds.delete(id); paint();
    if (loadingIds.has(id)) return;
    // Every opening fetches again (the order may have moved on since); the last copy shows meanwhile, with its time.
    loadingIds.add(id);
    const mine = epoch;
    let d = null, bad = false;
    try { d = await h.detail(id); } catch { bad = true; }
    if (mine !== epoch) return; // signed out or switched account while waiting: drop it
    loadingIds.delete(id);
    if (bad) { if (!cache.has(id)) errIds.add(id); } else cache.set(id, Object.assign(d, { checkedAt: new Date().toISOString() }));
    paint();
    const b = document.getElementById("mhb-" + id); if (b && document.activeElement === document.body) b.focus();
  }

  function paint() {
    if (!data && !failed) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    if (failed) { box.replaceChildren(el("p", "member-history-error", L("error"))); return; }
    const o = el("div", "mh-block"); o.append(el("h2", null, L("orders")));
    if (!data.orders.length) o.append(el("p", "mh-empty", L("none")));
    else {
      const ul = el("ul", "mh-orders");
      for (const r of data.orders) {
        const li = el("li", "mh-order");
        const top = el("div", "mh-top");
        top.append(el("strong", "mh-code", L("code", { code: code(r.id) })), el("span", "mh-date", when(r.placed_at, { dateStyle: "medium" })), el("span", "mh-total", money(r.total_cents)));
        const items = (r.order_items || []).map((i) => i.quantity + "× " + (lang() === "fr" ? i.item_name_fr_snapshot || i.item_name_en_snapshot : i.item_name_en_snapshot));
        const shown = items.slice(0, 3).join(", ") + (items.length > 3 ? " " + L("more", { n: items.length - 3 }) : "");
        const status = [L("st_" + r.fulfilment_status), L("pay_" + r.payment_status)];
        if (r.pickup_slot) status.push(L("pickup", { time: when(r.pickup_slot, { hour: "numeric", minute: "2-digit" }) }));
        const isOpen = open.has(r.id);
        const btn = el("button", "mh-toggle text-link", isOpen ? L("hide") : L("details"));
        btn.type = "button"; btn.id = "mhb-" + r.id; btn.setAttribute("aria-expanded", String(isOpen)); btn.setAttribute("aria-controls", "mhd-" + r.id);
        btn.addEventListener("click", () => toggle(r.id));
        li.append(top, el("p", "mh-items", shown), el("p", "mh-status", status.join(" · ")), btn);
        if (isOpen) li.append(detailPanel(r.id));
        ul.append(li);
      }
      o.append(ul);
    }
    const p = el("div", "mh-block"); p.append(el("h2", null, L("points")), el("p", "mh-balance", L("total", { n: pts(data.total) })));
    const cups = data.cups;
    if (cups > 0) {
      const row = el("div", "mh-cups"); row.setAttribute("role", "img"); row.setAttribute("aria-label", cups === 1 ? L("cupsOne") : L("cups", { n: pts(cups) }));
      for (let i = 0; i < Math.min(cups, 12); i++) row.append(cupIcon());
      if (cups > 12) row.append(el("span", "mh-cups-more", L("cupsMore", { n: pts(cups - 12) })));
      p.append(row, el("p", "mh-cups-text", cups === 1 ? L("cupsOne") : L("cups", { n: pts(cups) })));
    }
    if (!data.ledger.length) p.append(el("p", "mh-empty", L("noPoints")));
    else {
      const ids = new Map(data.orders.map((r) => [r.id, code(r.id)]));
      const ul = el("ul", "mh-ledger");
      for (const r of data.ledger) {
        const li = el("li", "mh-entry");
        const n = Number(r.delta_points || 0);
        li.append(el("span", "mh-when", when(r.created_at, { dateStyle: "medium" })), el("span", "mh-what", L("e_" + r.entry_type) + (r.order_id ? " · " + L("forOrder", { code: ids.get(r.order_id) || code(r.order_id) }) : "")), el("strong", n >= 0 ? "mh-plus" : "mh-minus", (n >= 0 ? "+" : "−") + pts(Math.abs(n))));
        ul.append(li);
      }
      p.append(ul);
    }
    const focused = document.activeElement && document.activeElement.id && document.activeElement.id.startsWith("mhb-") ? document.activeElement.id : null;
    box.replaceChildren(o, p);
    if (focused) { const f = document.getElementById(focused); if (f) f.focus(); }
  }
  async function refresh() {
    const my = ++seq;
    try { const d = await h.load(); if (my !== seq) return; data = d; failed = false; }
    catch (e) { if (my !== seq) return; data = null; failed = e.code !== "signed_out"; }
    paint();
  }
  let lastUid = null;
  const forget = () => { epoch++; open.clear(); cache.clear(); errIds.clear(); loadingIds.clear(); };
  document.addEventListener("azal:auth", async (e) => {
    if (e.detail && e.detail.status === "signed_in") {
      let uid = null; try { const s = auth && (await auth.session()); uid = s && s.user && s.user.id; } catch {}
      if (uid !== lastUid) { forget(); lastUid = uid; } // another account: nothing of the previous one survives
      refresh();
    } else { seq++; forget(); lastUid = null; data = null; failed = false; paint(); }
  });
  // T-23B residual (lead 21:35): when the card's balance changes in place, this section re-reads as well (same guards).
  document.addEventListener("azal:points-changed", () => { if (lastUid) refresh(); });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})(typeof window !== "undefined" ? window : globalThis);
