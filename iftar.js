/* AZAL Iftar Mode (Claude, creative sprint 2026-11-26). During Ramadan the site counts down to TODAY's sunset in
   Ottawa and offers "Order for iftar", which pre-selects the latest pickup slot at or before sunset.
   - Ramadan: the browser's built-in Umm al-Qura calendar (Intl, "islamic-umalqura"); no hard-coded dates.
   - Sunset: NOAA solar-calculator equations for Ottawa, rounded UP to the minute; within 2 minutes of published Ottawa
     tables (tested). The iftar time SHOWN adds a 2-minute safety margin; pickup slots are chosen against raw sunset.
   - Honest note shown with it: local moon-sighting announcements can differ by a day.
   Inert outside Ramadan. Preview any day with ?iftar=preview. No data is collected or sent. */
(function (root) {
  "use strict";
  const TZ = "America/Toronto", LAT = 45.4215, LON = -75.6972; // Ottawa (the reference used by local published tables; not the restaurant address)
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
  // Sunset instant (ms, UTC) for a civil date: NOAA solar-calculator equations (Julian-century form, two passes so the
  // sun's position is taken at sunset itself), zenith 90.833 deg. Checked against published Ottawa tables (tests).
  // The returned instant is rounded UP to the whole minute: shown iftar times are never early.
  function sunsetMs(y, m, d, lat, lon) {
    lat = lat == null ? LAT : lat; lon = lon == null ? LON : lon;
    const day0 = Date.UTC(y, m - 1, d);
    let utcMin = 720 - 4 * lon + 300; // first guess, then refine
    for (let pass = 0; pass < 3; pass++) {
      const jd = (day0 + utcMin * 60000) / 864e5 + 2440587.5, T = (jd - 2451545) / 36525;
      const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
      const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
      const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
      const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
      const omega = 125.04 - 1934.136 * T;
      const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * rad);
      const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
      const eps = eps0 + 0.00256 * Math.cos(omega * rad);
      const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
      const yv = Math.tan((eps / 2) * rad) ** 2;
      const eqt = 4 / rad * (yv * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * yv * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * yv * yv * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
      const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
      if (cosH < -1 || cosH > 1) return null;
      utcMin = 720 - 4 * (lon - Math.acos(cosH) / rad) - eqt;
    }
    return day0 + Math.ceil(utcMin) * 60000;
  }
  const MARGIN_MIN = 2; // safety margin added to the calculated sunset: the iftar time we show is never early
  const iftarMs = (y, m, d) => { const ss = sunsetMs(y, m, d); return ss == null ? null : ss + MARGIN_MIN * 60000; };
  const torontoMinutes = (ms) => { const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)); return Number(p.find((x) => x.type === "hour").value) * 60 + Number(p.find((x) => x.type === "minute").value); };
  // Latest pickup slot (minutes after midnight) at or before RAW sunset. No slot before sunset -> null (fail closed:
  // we never offer a post-sunset pickup as an iftar slot).
  function iftarSlot(slots, sunsetMin) {
    const before = slots.filter((s) => s <= sunsetMin);
    return before.length ? before[before.length - 1] : null;
  }
  function state(nowMs, preview) {
    const rd = ramadanDay(nowMs);
    if (!rd && !preview) return { active: false };
    const t = ymdIn(nowMs), ss = iftarMs(t.y, t.m, t.d), raw = sunsetMs(t.y, t.m, t.d);
    let next = ss;
    if (nowMs > ss) { const tm = ymdIn(nowMs + 864e5); next = iftarMs(tm.y, tm.m, tm.d); }
    return { active: true, preview: !rd, ramadanDay: rd, sunset: ss, nextSunset: next, before: nowMs <= ss, minutesLeft: Math.max(0, Math.round((ss - nowMs) / 60000)), sunsetMin: torontoMinutes(raw) };
  }
  const api = { ramadanDay, sunsetMs, iftarMs, MARGIN_MIN, iftarSlot, state, torontoMinutes };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser ---------- */
  let preview = false;
  try { preview = new URLSearchParams(root.location.search).get("iftar") === "preview"; } catch {}
  if (!state(Date.now(), preview).active) return;
  const HIDE = "azal-iftar-hidden";
  const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  try { if (localStorage.getItem(HIDE) === todayKey() && !preview) return; } catch {}
  const S = {
    en: { mubarak: "Ramadan Mubarak", before: "Iftar in {h} h {m} min · {time} in Ottawa", soon: "Iftar in {m} min · {time} in Ottawa", after: "Iftar was at {time}. Tomorrow: {next}.",
      order: "Order for iftar", note: "Iftar time = calculated Ottawa sunset plus a 2-minute safety margin. Ramadan dates follow the Umm al-Qura calendar; please follow your mosque’s announcement, which may differ by a day.", previewTag: "Preview",
      picked: "Pickup set to {time}: the closest available time before sunset. You can change it.", none: "No pickup time before sunset is left today. Choose any time that suits you.", hide: "Hide for today" },
    fr: { mubarak: "Ramadan Moubarak", before: "Iftar dans {h} h {m} min · {time} à Ottawa", soon: "Iftar dans {m} min · {time} à Ottawa", after: "L’iftar était à {time}. Demain\u00a0: {next}.",
      order: "Commander pour l’iftar", note: "Heure de l’iftar = coucher du soleil calculé pour Ottawa plus une marge de sécurité de 2 minutes. Les dates du Ramadan suivent le calendrier Umm al-Qura\u00a0; suivez l’annonce de votre mosquée, qui peut différer d’un jour.", previewTag: "Aperçu",
      picked: "Retrait fixé à {time}\u00a0: l’heure disponible la plus proche avant le coucher du soleil. Vous pouvez la changer.", none: "Il ne reste plus d’heure de retrait avant le coucher du soleil aujourd’hui. Choisissez l’heure qui vous convient.", hide: "Masquer pour aujourd’hui" },
    ar: { mubarak: "رمضان مبارك", before: "الإفطار بعد {h} ساعة و{m} دقيقة · {time} في أوتاوا", soon: "الإفطار بعد {m} دقيقة · {time} في أوتاوا", after: "كان الإفطار الساعة {time}. غداً: {next}.",
      order: "اطلب للإفطار", note: "وقت الإفطار = غروب الشمس المحسوب لأوتاوا مع هامش أمان دقيقتين. تواريخ رمضان حسب تقويم أم القرى؛ يُرجى اتباع إعلان مسجدك، فقد يختلف بيوم.", previewTag: "معاينة",
      picked: "حُدّد الاستلام الساعة {time}: أقرب وقت متاح قبل الغروب. يمكنك تغييره.", none: "لم يعد هناك وقت استلام قبل الغروب اليوم. اختر الوقت الذي يناسبك.", hide: "إخفاء لليوم" }
  };

  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k]; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s.replace(/\.\./g, "."); };
  const fmt = (ms) => new Intl.DateTimeFormat({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" }[lang()], { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(ms)).replace(/\s/g, "\u00a0"); // keep "5:34 p.m." on one line
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
    const hide = el("button", "iftar-hide", "×"); hide.type = "button"; hide.setAttribute("aria-label", L("hide")); hide.title = L("hide");
    hide.addEventListener("click", () => { try { localStorage.setItem(HIDE, todayKey()); } catch {} bar.remove(); document.documentElement.classList.remove("iftar-mode"); });
    head.append(hide);
    bar.replaceChildren(head, el("p", "iftar-line", line), st.before ? btn : el("span"), el("p", "iftar-note", L("note")));
  }
  // When the pickup step opens, pre-select the iftar slot (once per click on "Order for iftar").
  document.getElementById("checkoutButton")?.addEventListener("click", () => {
    let want = false; try { want = sessionStorage.getItem(KEY) === "1"; } catch {}
    if (!want || typeof pickupState === "undefined" || !pickupState.plan || pickupState.plan.day !== "today") return;
    const st = state(Date.now(), preview), slot = iftarSlot(pickupState.plan.slots, st.sunsetMin);
    const live = document.getElementById("cartStatus");
    try { sessionStorage.removeItem(KEY); } catch {}
    if (slot == null) { if (live) live.textContent = L("none"); return; } // fail closed: nothing pre-selected
    pickupState.choice = String(slot);
    if (typeof renderPickup === "function") renderPickup();
    const hm = new Date(Date.UTC(2026, 0, 1, Math.floor(slot / 60), slot % 60));
    if (live) live.textContent = L("picked", { time: new Intl.DateTimeFormat({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" }[lang()], { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(hm).replace(/\s/g, "\u00a0") });
  });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  paint(); setInterval(paint, 30000);
})(typeof window !== "undefined" ? window : globalThis);
