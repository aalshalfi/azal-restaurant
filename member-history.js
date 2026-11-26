/* AZAL member page: your orders + your points history (Claude, ORD-REAL). Read-only, the member's OWN rows only
   (explicit user_id filter on top of RLS, because staff RLS can see more). Every value is rendered with textContent.
   Inert while window.AZAL_SUPABASE is null or nobody is signed in. */
(function (root) {
  "use strict";
  const code = (id) => String(id || "").slice(0, 6).toUpperCase();

  function createHistory({ config, fetch: fetchFn, getSession }) {
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    async function get(path, token) {
      let res;
      try { res = await fetchFn(base + path, { headers: { apikey: config.anonKey, Authorization: "Bearer " + token } }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      if (!res.ok) throw Object.assign(new Error("http_" + res.status), { code: res.status === 401 ? "signed_out" : "error" });
      return (await res.json()) || [];
    }
    return {
      enabled,
      async load() {
        const s = enabled && getSession ? await getSession() : null;
        const uid = s && s.user && s.user.id;
        if (!uid) return null;
        const u = encodeURIComponent(uid);
        const [orders, ledger] = await Promise.all([
          get("/rest/v1/orders?select=id,placed_at,pickup_slot,fulfilment_status,payment_status,total_cents,order_items(quantity,item_name_en_snapshot,item_name_fr_snapshot)" +
            "&user_id=eq." + u + "&order=placed_at.desc&limit=20", s.access_token),
          get("/rest/v1/points_ledger?select=entry_type,delta_points,created_at,order_id&user_id=eq." + u + "&order=created_at.desc&limit=50", s.access_token)
        ]);
        return { orders, ledger, total: ledger.reduce((a, r) => a + Number(r.delta_points || 0), 0) };
      }
    };
  }

  // V3 "Majlis as hospitality": one qahwa cup per collected paid order (earn rows minus reversals). The exact
  // points number is always shown next to it; the cups never replace or hide it.
  const cupsFrom = (ledger) => Math.max(0, (ledger || []).filter((r) => r.entry_type === "earn").length - (ledger || []).filter((r) => r.entry_type === "earn_reversal").length);
  const api = { createHistory, code, cupsFrom };
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
      cups: "{n} cups of qahwa poured for you: one for each order you collected.", cupsOne: "1 cup of qahwa poured for you: one for each order you collected.", cupsMore: "+{n}" },
    fr: { orders: "Vos commandes", none: "Aucune commande pour l’instant. Vos retraits apparaîtront ici.", points: "Vos points", noPoints: "Pas encore de points. Ils sont ajoutés quand une commande payée est récupérée.",
      total: "Solde : {n} points", code: "Code {code}", pickup: "Retrait {time}", more: "et {n} de plus",
      st_placed: "Reçue", st_accepted: "Acceptée", st_preparing: "En préparation", st_ready: "Prête à emporter", st_handed_over: "Récupérée", st_cancelled: "Annulée",
      pay_unpaid: "Non payée", pay_paid: "Payée", pay_refunded: "Remboursée", pay_voided: "Annulée",
      e_earn: "Gagnés", e_redeem: "Utilisés", e_earn_reversal: "Retirés", e_redeem_refund: "Rendus",
      forOrder: "commande {code}", error: "Impossible de charger votre historique. Actualisez pour réessayer.",
      cups: "{n} tasses de qahwa servies pour vous\u00a0: une pour chaque commande récupérée.", cupsOne: "1 tasse de qahwa servie pour vous\u00a0: une pour chaque commande récupérée.", cupsMore: "+{n}" },
    ar: { orders: "طلباتك", none: "لا طلبات بعد. ستظهر هنا طلباتك للاستلام.", points: "نقاطك", noPoints: "لا نقاط بعد. تُضاف النقاط عند استلام طلب مدفوع.",
      total: "الرصيد: {n} نقطة", code: "الرمز {code}", pickup: "الاستلام {time}", more: "و{n} أخرى",
      st_placed: "استُلم", st_accepted: "قُبل", st_preparing: "قيد التحضير", st_ready: "جاهز للاستلام", st_handed_over: "تم الاستلام", st_cancelled: "أُلغي",
      pay_unpaid: "غير مدفوع", pay_paid: "مدفوع", pay_refunded: "مُسترد", pay_voided: "مُلغى",
      e_earn: "مكتسبة", e_redeem: "مستخدمة", e_earn_reversal: "مسحوبة", e_redeem_refund: "مُعادة",
      forOrder: "الطلب {code}", error: "تعذّر تحميل سجلّك. حدّث الصفحة وحاول مرة أخرى.",
      cups: "صببنا لك {n} فناجين قهوة: فنجان عن كل طلب استلمته.", cupsOne: "صببنا لك فنجان قهوة: فنجان عن كل طلب استلمته.", cupsMore: "+{n}" }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k] || S.en[k] || k; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s.replace(/\.\./g, "."); };
  const loc = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const when = (iso, opts) => new Intl.DateTimeFormat(loc(), Object.assign({ timeZone: "America/Toronto" }, opts)).format(new Date(iso));
  const money = (c) => new Intl.NumberFormat(loc(), { style: "currency", currency: "CAD" }).format(Number(c || 0) / 100);
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
        li.append(top, el("p", "mh-items", shown), el("p", "mh-status", status.join(" · ")));
        ul.append(li);
      }
      o.append(ul);
    }
    const p = el("div", "mh-block"); p.append(el("h2", null, L("points")), el("p", "mh-balance", L("total", { n: pts(data.total) })));
    const cups = cupsFrom(data.ledger);
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
    box.replaceChildren(o, p);
  }
  async function refresh() {
    const my = ++seq;
    try { const d = await h.load(); if (my !== seq) return; data = d; failed = false; }
    catch (e) { if (my !== seq) return; data = null; failed = e.code !== "signed_out"; }
    paint();
  }
  document.addEventListener("azal:auth", (e) => { if (e.detail && e.detail.status === "signed_in") refresh(); else { seq++; data = null; failed = false; paint(); } });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})(typeof window !== "undefined" ? window : globalThis);
