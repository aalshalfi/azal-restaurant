/* AZAL Iftar Mode (Claude, creative sprint 2026-11-26). During Ramadan the site counts down to TODAY's sunset in
   Ottawa and offers "Order for iftar", which pre-selects the latest pickup slot at or before sunset.
   - Ramadan: the browser's built-in Umm al-Qura calendar (Intl, "islamic-umalqura"); no hard-coded dates.
   - Sunset: NOAA solar equations, computed in the browser for Orléans/Ottawa; typically within about 2 minutes.
   - Honest note shown with it: local moon-sighting announcements can differ by a day.
   Inert outside Ramadan. Preview any day with ?iftar=preview. No data is collected or sent. */
(function (root) {
  "use strict";
  const TZ = "America/Toronto", LAT = 45.47, LON = -75.52; // Orléans, Ottawa (city-level, not the restaurant address)
  const rad = Math.PI / 180;

  function ymdIn(ms, tz) {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz || TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
    const g = (k) => Number(p.find((x) => x.type === k).value);
    return { y: g("year"), m: g("month"), d: g("day") };
  }
  // Ramadan = month 9 of the Umm al-Qura calendar, judged on the Toronto calendar day.
  function ramadanDay(ms) {
    try {
      const p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: TZ, month: "numeric", day: "numeric" }).formatToParts(new Date(ms));
      const month = Number(p.find((x) => x.type === "month").value), day = Number(p.find((x) => x.type === "day").value);
      return month === 9 ? day : 0;
    } catch { return 0; }
  }
  // Sunset instant (ms, UTC) for a civil date at lat/lon; NOAA general solar position equations, zenith 90.833 deg.
  function sunsetMs(y, m, d, lat, lon) {
    lat = lat == null ? LAT : lat; lon = lon == null ? LON : lon;
    const start = Date.UTC(y, 0, 1), day = Math.round((Date.UTC(y, m - 1, d) - start) / 864e5) + 1;
    const days = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    const g = (2 * Math.PI / days) * (day - 1);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
    if (cosH < -1 || cosH > 1) return null;
    const ha = Math.acos(cosH) / rad;
    const minutesUtc = 720 - 4 * (lon - ha) - eqt;
    return Date.UTC(y, m - 1, d) + Math.round(minutesUtc * 60) * 1000;
  }
  const torontoMinutes = (ms) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)); return Number(p.find((x) => x.type === "hour").value) * 60 + Number(p.find((x) => x.type === "minute").value); };
  // Latest pickup slot (minutes after midnight) at or before sunset; falls back to the earliest slot after it.
  function iftarSlot(slots, sunsetMin) {
    const before = slots.filter((s) => s <= sunsetMin);
    return before.length ? before[before.length - 1] : (slots.find((s) => s > sunsetMin) ?? null);
  }
  function state(nowMs, preview) {
    const rd = ramadanDay(nowMs);
    if (!rd && !preview) return { active: false };
    const t = ymdIn(nowMs), ss = sunsetMs(t.y, t.m, t.d);
    let next = ss;
    if (nowMs > ss) { const tm = ymdIn(nowMs + 864e5); next = sunsetMs(tm.y, tm.m, tm.d); }
    return { active: true, preview: !rd, ramadanDay: rd, sunset: ss, nextSunset: next, before: nowMs <= ss, minutesLeft: Math.max(0, Math.round((ss - nowMs) / 60000)), sunsetMin: torontoMinutes(ss) };
  }
  const api = { ramadanDay, sunsetMs, iftarSlot, state, torontoMinutes };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser ---------- */
  let preview = false;
  try { preview = new URLSearchParams(root.location.search).get("iftar") === "preview"; } catch {}
  if (!state(Date.now(), preview).active) return;
  const S = {
    en: { mubarak: "Ramadan Mubarak", before: "Iftar in {h} h {m} min · sunset in Ottawa {time}", soon: "Iftar in {m} min · sunset in Ottawa {time}", after: "Iftar was at {time}. Tomorrow: {next}.",
      order: "Order for iftar", note: "Sunset is calculated for Ottawa. Ramadan dates follow the Umm al-Qura calendar; local announcements may differ by a day.", previewTag: "Preview", picked: "Pickup set to {time}, just before iftar. You can change it." },
    fr: { mubarak: "Ramadan Moubarak", before: "Iftar dans {h} h {m} min · coucher du soleil à Ottawa {time}", soon: "Iftar dans {m} min · coucher du soleil à Ottawa {time}", after: "L’iftar était à {time}. Demain : {next}.",
      order: "Commander pour l’iftar", note: "Le coucher du soleil est calculé pour Ottawa. Les dates du Ramadan suivent le calendrier Umm al-Qura ; les annonces locales peuvent différer d’un jour.", previewTag: "Aperçu", picked: "Retrait fixé à {time}, juste avant l’iftar. Vous pouvez le changer." }
  };
  const lang = () => (document.documentElement.lang === "fr" ? "fr" : "en");
  const L = (k, v) => { let s = S[lang()][k]; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s.replace(/\.\./g, "."); };
  const fmt = (ms) => new Intl.DateTimeFormat(lang() === "fr" ? "fr-CA" : "en-CA", { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(ms)).replace(/\s/g, "\u00a0"); // keep "5:34 p.m." on one line
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  document.documentElement.classList.add("iftar-mode");
  const bar = el("aside", "iftar-banner"); bar.setAttribute("aria-label", "Ramadan");
  const header = document.querySelector(".site-header");
  if (header) header.after(bar); else document.body.prepend(bar);
  const KEY = "azal-iftar-target";

  function paint() {
    const st = state(Date.now(), preview);
    const line = st.before ? (st.minutesLeft >= 60 ? L("before", { h: Math.floor(st.minutesLeft / 60), m: st.minutesLeft % 60, time: fmt(st.sunset) }) : L("soon", { m: st.minutesLeft, time: fmt(st.sunset) })) : L("after", { time: fmt(st.sunset), next: fmt(st.nextSunset) });
    const head = el("p", "iftar-head"); head.append(el("strong", null, L("mubarak")));
    if (st.preview) head.append(el("span", "iftar-preview", L("previewTag")));
    const btn = el("button", "button button-gold iftar-order", L("order")); btn.type = "button";
    btn.addEventListener("click", () => {
      try { sessionStorage.setItem(KEY, "1"); } catch {}
      const hasCart = typeof cart !== "undefined" && cart && cart.size > 0;
      if (hasCart && typeof openCart === "function") openCart();
      else root.location.href = "menu.html" + (preview ? "?iftar=preview" : "") + "#menu";
    });
    bar.replaceChildren(head, el("p", "iftar-line", line), st.before ? btn : el("span"), el("p", "iftar-note", L("note")));
  }
  // When the pickup step opens, pre-select the iftar slot (once per click on "Order for iftar").
  document.getElementById("checkoutButton")?.addEventListener("click", () => {
    let want = false; try { want = sessionStorage.getItem(KEY) === "1"; } catch {}
    if (!want || typeof pickupState === "undefined" || !pickupState.plan || pickupState.plan.day !== "today") return;
    const st = state(Date.now(), preview), slot = iftarSlot(pickupState.plan.slots, st.sunsetMin);
    if (slot == null) return;
    pickupState.choice = String(slot);
    if (typeof renderPickup === "function") renderPickup();
    const live = document.getElementById("cartStatus");
    if (live) live.textContent = L("picked", { time: fmt(st.sunset - (st.sunsetMin - slot) * 60000) });
    try { sessionStorage.removeItem(KEY); } catch {}
  });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  paint(); setInterval(paint, 30000);
})(typeof window !== "undefined" ? window : globalThis);
