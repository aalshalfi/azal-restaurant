/* AZAL Table Pulse (Claude, creative sprint; ChatGPT's 14:10 phone-first spec, accepted by Muse 14:15).
   Answers one question after checkout: "What is happening with my order?" — WITHOUT promising when it will be ready.
   - Member-only first slice: the signed-in member's OWN paid order, read through existing RLS + explicit user_id filter.
     No guest lookup, no new schema, no new data collected.
   - A milestone advances only when the server returns that persisted status. "Preparing" appears only if the server
     actually reports `preparing`; it is never inferred from time. No countdown, ETA, percentage or animation.
   - Polls every 25 s while the page is visible; stops on Collected / Cancelled; manual refresh always available.
   Inert while window.AZAL_SUPABASE is null. */
(function (root) {
  "use strict";
  const KNOWN = ["placed", "accepted", "preparing", "ready", "handed_over", "cancelled"];
  const TERMINAL = ["handed_over", "cancelled"];
  // Steps to show for a given persisted status. Each: { key, state: "done" | "current" | "todo" }.
  function timeline(status) {
    if (!KNOWN.includes(status)) return null;               // unknown status: show "unavailable", never guess
    if (status === "cancelled") return [{ key: "cancelled", state: "current" }];
    const steps = ["placed", "accepted"].concat(status === "preparing" ? ["preparing"] : [], ["ready", "handed_over"]);
    const at = steps.indexOf(status);
    return steps.map((key, i) => ({ key, state: i < at ? "done" : i === at ? (status === "handed_over" ? "done" : "current") : "todo" }));
  }
  const code = (id) => String(id || "").slice(0, 6).toUpperCase();

  function createPulse({ config, fetch: fetchFn, getSession }) {
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    const cols = "select=id,fulfilment_status,payment_status,pickup_slot,updated_at";
    async function get(q) {
      const s = getSession ? await getSession() : null;
      const uid = s && s.user && s.user.id;
      if (!uid) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
      let res;
      try { res = await fetchFn(base + "/rest/v1/orders?" + cols + "&user_id=eq." + encodeURIComponent(uid) + q, { headers: { apikey: config.anonKey, Authorization: "Bearer " + s.access_token } }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      if (!res.ok) throw Object.assign(new Error("http"), { code: res.status === 401 ? "signed_out" : "error" });
      const rows = await res.json();
      return Array.isArray(rows) ? rows[0] || null : null;
    }
    return {
      enabled,
      // The member's most recent PAID order that is still open (unpaid orders never reach the kitchen).
      active: () => get("&payment_status=eq.paid&fulfilment_status=not.in.(handed_over,cancelled)&order=placed_at.desc&limit=1"),
      byId: (id) => get("&id=eq." + encodeURIComponent(id) + "&limit=1")
    };
  }

  const api = { timeline, createPulse, code, TERMINAL };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser ---------- */
  const card = document.querySelector(".member-card");
  const auth = root.AZALAuth;
  const p = createPulse({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root), getSession: async () => { try { return auth && (await auth.session()); } catch { return null; } } });
  if (!p.enabled || !card) return;

  const S = {
    en: { title: "Your order", code: "Code {code}", updated: "Last updated {time}", refresh: "Refresh", pickup: "Pickup time: {time}",
      placed: "Received", accepted: "Accepted by the kitchen", preparing: "Being prepared", ready: "Ready for pickup", handed_over: "Collected", cancelled: "Order cancelled",
      now: "Now", unavailable: "Status unavailable right now. Try again.", hint: "This updates by itself. It shows what the kitchen has confirmed, not an estimate." },
    fr: { title: "Votre commande", code: "Code {code}", updated: "Mis à jour à {time}", refresh: "Actualiser", pickup: "Heure de retrait : {time}",
      placed: "Reçue", accepted: "Acceptée par la cuisine", preparing: "En préparation", ready: "Prête à emporter", handed_over: "Récupérée", cancelled: "Commande annulée",
      now: "En cours", unavailable: "Statut indisponible pour le moment. Réessayez.", hint: "Cette page se met à jour seule. Elle montre ce que la cuisine a confirmé, pas une estimation." },
    ar: { title: "طلبك", code: "الرمز {code}", updated: "آخر تحديث {time}", refresh: "تحديث", pickup: "وقت الاستلام: {time}",
      placed: "استُلم", accepted: "قبله المطبخ", preparing: "قيد التحضير", ready: "جاهز للاستلام", handed_over: "تم الاستلام", cancelled: "أُلغي الطلب",
      now: "الآن", unavailable: "الحالة غير متاحة الآن. حاول مرة أخرى.", hint: "تتحدّث هذه الصفحة تلقائياً. تعرض ما أكّده المطبخ، لا وقتاً تقديرياً." }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k] || S.en[k]; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s.replace(/\.\./g, "."); };
  const loc = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const time = (d, opts) => new Intl.DateTimeFormat(loc(), Object.assign({ hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }, opts)).format(d);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const box = el("section", "pulse section"); box.id = "tablePulse"; box.hidden = true;
  const live = el("p", "visually-hidden"); live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  card.closest("section").after(box, live);
  let order = null, failed = false, lastAt = null, timer = null, lastStatus = null, seq = 0;

  function paint() {
    if (!order && !failed) { box.hidden = true; box.replaceChildren(); return; }
    box.hidden = false;
    const head = el("div", "pulse-head");
    head.append(el("h2", null, L("title")));
    if (order) head.append(el("span", "pulse-code", L("code", { code: code(order.id) })));
    const out = [head];
    const steps = order && timeline(order.fulfilment_status);
    if (failed || !steps) out.push(el("p", "pulse-error", L("unavailable")));
    else {
      const ol = el("ol", "pulse-steps");
      for (const s of steps) {
        const li = el("li", "pulse-step is-" + s.state + (s.key === "cancelled" ? " is-cancelled" : ""));
        li.append(el("span", "pulse-mark"), el("span", "pulse-label", L(s.key)));
        if (s.state === "current" && s.key !== "cancelled") { li.setAttribute("aria-current", "step"); li.append(el("span", "pulse-now", L("now"))); }
        ol.append(li);
      }
      out.push(ol);
      if (order.pickup_slot && order.fulfilment_status !== "cancelled") out.push(el("p", "pulse-pickup", L("pickup", { time: time(new Date(order.pickup_slot)) })));
    }
    const foot = el("div", "pulse-foot");
    if (lastAt) foot.append(el("span", "pulse-updated", L("updated", { time: time(lastAt, { second: "2-digit" }) })));
    const btn = el("button", "text-link dark-link pulse-refresh", L("refresh")); btn.type = "button"; btn.addEventListener("click", () => load(true));
    foot.append(btn);
    out.push(foot, el("p", "pulse-hint", L("hint")));
    box.replaceChildren(...out);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() { stop(); if (order && !TERMINAL.includes(order.fulfilment_status)) timer = setInterval(() => { if (!document.hidden) load(false); }, 25000); }
  async function load(manual) {
    const my = ++seq;
    try {
      const o = order ? await p.byId(order.id) : await p.active();
      if (my !== seq) return;
      order = o; failed = false; lastAt = new Date();
      if (o && o.fulfilment_status !== lastStatus) { if (lastStatus !== null) live.textContent = L(o.fulfilment_status) || ""; lastStatus = o.fulfilment_status; }
    } catch (e) { if (my !== seq) return; if (e.code === "signed_out") { order = null; failed = false; } else failed = true; }
    paint();
    if (!order || TERMINAL.includes(order.fulfilment_status)) stop(); else if (!timer) start();
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && order && !TERMINAL.includes(order.fulfilment_status)) load(false); });
  document.addEventListener("azal:auth", (e) => { if (e.detail && e.detail.status === "signed_in") { order = null; lastStatus = null; load(false); } else { seq++; stop(); order = null; failed = false; paint(); } });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  root.AZALPulse = { _state: () => ({ order, failed, polling: Boolean(timer) }) };
})(typeof window !== "undefined" ? window : globalThis);
