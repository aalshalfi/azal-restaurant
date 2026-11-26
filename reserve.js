/* AZAL table booking (Claude). Owner rule (07:48 via Muse): a reservation reserves a TABLE only.
   The guest gives exactly: number of people, date, time, name, mobile phone, email. No dishes, notes or payment.
   Server: 0005 (reservation_availability, reserve_table, cancel_reservation). Inert while window.AZAL_SUPABASE is null. */
(function (root) {
  "use strict";
  const TZ = "America/Toronto";
  const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  // Same rule as the server (azal_reservation_phone): 10 digits -> +1, 11 starting with 1 -> +, or + and 10-15 digits.
  function normalizePhone(raw) {
    const s = String(raw || ""), d = s.replace(/\D/g, "");
    if (/^\d{10}$/.test(d)) return "+1" + d;
    if (/^1\d{10}$/.test(d)) return "+" + d;
    if (/^\s*\+/.test(s) && /^[1-9]\d{9,14}$/.test(d)) return "+" + d;
    return null;
  }
  function validate({ party, startsAt, name, email, phone }, maxParty) {
    if (!Number.isInteger(party) || party < 1 || party > (maxParty || 10)) return "party";
    if (!startsAt) return "time";
    if (!String(name || "").trim() || String(name).trim().length > 80) return "name";
    if (!normalizePhone(phone)) return "phone";
    const e = String(email || "").trim();
    if (e.length > 254 || !EMAIL.test(e)) return "email";
    return null;
  }
  // Toronto calendar date (YYYY-MM-DD) for an instant, plus N days.
  function torontoDate(ms, plus) {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
    const g = (k) => Number(p.find((x) => x.type === k).value);
    const d = new Date(Date.UTC(g("year"), g("month") - 1, g("day") + (plus || 0)));
    return d.toISOString().slice(0, 10);
  }
  const newKey = () => { try { return "rs-" + root.crypto.randomUUID(); } catch { return "rs-" + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); } };

  function createReservations({ config, fetch: fetchFn, branch }) {
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    branch = branch || "ottawa";
    let key = "", lastSig = "";
    async function rpc(name, body) {
      let res;
      try { res = await fetchFn(base + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: config.anonKey, Authorization: "Bearer " + config.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      let data = null; try { data = await res.json(); } catch {}
      if (!res.ok) { const m = String((data && data.message) || "error"); throw Object.assign(new Error(m), { code: /^[a-z_]+$/.test(m) ? m : "error" }); }
      return data;
    }
    return {
      enabled,
      async availability(day, party) { return (await rpc("reservation_availability", { p_branch: branch, p_day: day, p_party: party })) || []; },
      async reserve(f) {
        const bad = validate(f);
        if (bad) throw Object.assign(new Error("invalid_" + bad), { code: "invalid_" + bad }); // nothing sent
        const body = { p_branch: branch, p_starts_at: f.startsAt, p_party: f.party, p_name: String(f.name).trim(), p_email: String(f.email).trim().toLowerCase(), p_phone: normalizePhone(f.phone) };
        const sig = JSON.stringify(body);
        if (sig !== lastSig) { key = newKey(); lastSig = sig; } // same request after a network error keeps its key: never two bookings
        const r = await rpc("reserve_table", Object.assign(body, { p_idempotency_key: key }));
        lastSig = ""; // the next booking is a new attempt
        return r;
      },
      async cancel(code, email) { return rpc("cancel_reservation", { p_code: String(code || "").trim(), p_email: String(email || "").trim() }); }
    };
  }

  const api = { createReservations, normalizePhone, validate, torontoDate };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const rs = createReservations({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root) });
  root.AZALReservations = rs;
  const how = document.querySelector(".reserve-how");
  if (!rs.enabled || !how) return;
  const cfg = root.AZAL_RESERVATION_CONFIG || {};
  const maxParty = cfg.maxPartySize || 10;

  const S = {
    en: { kicker: "TABLES", intro: "Come and sit with us: the majlis way, around shared plates.", party: "How many people?", date: "Date", time: "Time",
      name: "Your name", phone: "Mobile phone", email: "Email (your confirmation goes here)", book: "Book the table", working: "One moment…",
      noSlots: "No free tables that day for this many people. Try another day.", pickTime: "Choose a time.", loading: "Loading times…",
      big: "More than {n} people? Call us and we’ll set the table.", deposit: "No deposit. Nothing to pay.",
      done: "Your table for {party} is booked for {date} at {time}.", doneCode: "Your booking code: {code}", doneMail: "The confirmation is sent to {email}. Keep the code to cancel.",
      another: "Book another table", cancelTitle: "Cancel a booking", cancelCode: "Booking code", cancelEmail: "Email used to book", cancelBtn: "Cancel the booking",
      cancelled: "Booking {code} is cancelled. The table is free for someone else.",
      e_invalid_party: "Choose how many people.", e_invalid_time: "Choose a time.", e_invalid_name: "Please add your name.", e_invalid_phone: "Please enter a mobile number with area code, like 343 555 0101.",
      e_invalid_email: "Please check your email address.", e_slot_full: "That time just filled up. Choose another time.", e_closed: "We’re closed at that time. Choose another time.",
      e_too_soon: "That time is too soon to book online. Choose a later time or call us.", e_too_far: "We take bookings up to 30 days ahead.", e_party_too_large: "For more than {n} people, please call us.",
      e_rate_limited: "Too many bookings from this email just now. Please wait a few minutes.", e_not_found: "We couldn’t find a booking with that code and email.", e_too_late: "That booking can no longer be cancelled online. Please call us.",
      e_network: "Connection problem. Check your connection and try again: you won’t be booked twice.", e_error: "Something went wrong. Please try again." },
    fr: { kicker: "RÉSERVATIONS", intro: "Venez vous asseoir avec nous, à la manière du majlis, autour de plats partagés.", party: "Combien de personnes ?", date: "Date", time: "Heure",
      name: "Votre nom", phone: "Téléphone mobile", email: "Courriel (votre confirmation y est envoyée)", book: "Réserver la table", working: "Un instant…",
      noSlots: "Aucune table libre ce jour-là pour ce nombre de personnes. Essayez un autre jour.", pickTime: "Choisissez une heure.", loading: "Chargement des heures…",
      big: "Plus de {n} personnes ? Appelez-nous et nous dresserons la table.", deposit: "Aucun dépôt. Rien à payer.",
      done: "Votre table pour {party} est réservée le {date} à {time}.", doneCode: "Votre code de réservation : {code}", doneMail: "La confirmation est envoyée à {email}. Gardez le code pour annuler.",
      another: "Réserver une autre table", cancelTitle: "Annuler une réservation", cancelCode: "Code de réservation", cancelEmail: "Courriel utilisé pour réserver", cancelBtn: "Annuler la réservation",
      cancelled: "La réservation {code} est annulée. La table est libre pour quelqu’un d’autre.",
      e_invalid_party: "Choisissez le nombre de personnes.", e_invalid_time: "Choisissez une heure.", e_invalid_name: "Veuillez indiquer votre nom.", e_invalid_phone: "Entrez un numéro mobile avec l’indicatif, par exemple 343 555 0101.",
      e_invalid_email: "Veuillez vérifier votre courriel.", e_slot_full: "Cette heure vient d’être complète. Choisissez une autre heure.", e_closed: "Nous sommes fermés à cette heure. Choisissez une autre heure.",
      e_too_soon: "Cette heure est trop proche pour réserver en ligne. Choisissez plus tard ou appelez-nous.", e_too_far: "Nous prenons les réservations jusqu’à 30 jours à l’avance.", e_party_too_large: "Pour plus de {n} personnes, appelez-nous.",
      e_rate_limited: "Trop de réservations avec ce courriel. Patientez quelques minutes.", e_not_found: "Aucune réservation ne correspond à ce code et à ce courriel.", e_too_late: "Cette réservation ne peut plus être annulée en ligne. Appelez-nous.",
      e_network: "Problème de connexion. Vérifiez votre connexion et réessayez : vous ne serez pas réservé deux fois.", e_error: "Un problème est survenu. Veuillez réessayer." }
  };
  const lang = () => (document.documentElement.lang === "fr" ? "fr" : "en");
  const L = (k, v) => { let s = S[lang()][k] || S.en[k] || k; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s.replace(/\.\./g, "."); };
  const loc = () => (lang() === "fr" ? "fr-CA" : "en-CA");
  const fmtTime = (iso) => new Intl.DateTimeFormat(loc(), { hour: "numeric", minute: "2-digit", timeZone: TZ }).format(new Date(iso)).replace(/\.\./g, ".");
  const fmtDate = (iso) => new Intl.DateTimeFormat(loc(), { weekday: "long", month: "long", day: "numeric", timeZone: TZ }).format(new Date(iso));
  const errText = (code) => { const k = "e_" + code; return S.en[k] ? L(k, { n: maxParty }) : L("e_error"); };

  // Turn the "how it will work" panel into the live booking panel. Static notices that are no longer true go away.
  ["reserveNotice", "reserveSoon"].forEach((k) => document.querySelectorAll(`[data-i18n="${k}"]`).forEach((el) => { el.hidden = true; }));
  const steps = how.querySelector(".reserve-steps"), howTitle = how.querySelector("#reserveHowTitle");
  if (steps) steps.hidden = true;
  const today = torontoDate(Date.now(), 0), last = torontoDate(Date.now(), 30);
  const form = document.createElement("form");
  form.className = "reserve-form"; form.noValidate = true; form.id = "reserveForm";
  form.innerHTML =
    `<label for="rsParty"></label><select id="rsParty">${Array.from({ length: maxParty }, (_, i) => `<option value="${i + 1}"${i === 1 ? " selected" : ""}>${i + 1}</option>`).join("")}</select><p class="rs-help" id="rsBig"></p>` +
    `<label for="rsDate"></label><input id="rsDate" type="date" min="${today}" max="${last}" value="${today}">` +
    `<fieldset class="rs-times"><legend id="rsTimeLabel"></legend><div id="rsSlots" role="radiogroup" aria-labelledby="rsTimeLabel"></div><p class="rs-help" id="rsSlotMsg" aria-live="polite"></p></fieldset>` +
    `<label for="rsName"></label><input id="rsName" autocomplete="name" maxlength="80">` +
    `<label for="rsPhone"></label><input id="rsPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20">` +
    `<label for="rsEmail"></label><input id="rsEmail" type="email" autocomplete="email" maxlength="254">` +
    `<p class="rs-error" id="rsError" role="alert"></p><button class="button button-gold" type="submit" id="rsSubmit"></button><p class="rs-help" id="rsDeposit"></p>`;
  const done = document.createElement("div"); done.className = "reserve-done"; done.id = "reserveDone"; done.hidden = true; done.setAttribute("role", "status"); done.tabIndex = -1;
  const cancel = document.createElement("details"); cancel.className = "reserve-cancel"; cancel.id = "reserveCancel";
  cancel.innerHTML = `<summary id="rcTitle"></summary><form id="rcForm" novalidate><label for="rcCode"></label><input id="rcCode" autocomplete="off" maxlength="8" spellcheck="false" style="text-transform:uppercase"><label for="rcEmail"></label><input id="rcEmail" type="email" autocomplete="email" maxlength="254"><p class="rs-error" id="rcMsg" role="status"></p><button class="button" type="submit" id="rcSubmit"></button></form>`;
  const deposit = how.querySelector("[data-i18n='reserveDeposit']"); if (deposit) deposit.hidden = true;
  (steps || howTitle).after(form, done, cancel);
  const $ = (id) => document.getElementById(id);
  let slots = [], chosen = null, busy = false, booked = null, loadSeq = 0;

  function paint() {
    if (howTitle) howTitle.textContent = L("book");
    for (const [id, k] of [["rsParty", "party"], ["rsDate", "date"], ["rsName", "name"], ["rsPhone", "phone"], ["rsEmail", "email"], ["rcCode", "cancelCode"], ["rcEmail", "cancelEmail"]]) form.parentNode.querySelector(`label[for=${id}]`).textContent = L(k);
    $("rsTimeLabel").textContent = L("time"); $("rsBig").textContent = L("big", { n: maxParty }); $("rsDeposit").textContent = L("deposit");
    $("rsSubmit").textContent = busy ? L("working") : L("book"); $("rcTitle").textContent = L("cancelTitle"); $("rcSubmit").textContent = L("cancelBtn");
    $("rsSlots").innerHTML = slots.map((s, i) => `<button type="button" role="radio" class="rs-slot" aria-checked="${s.starts_at === chosen}" tabindex="${s.starts_at === chosen || (!chosen && i === 0) ? 0 : -1}" data-at="${s.starts_at}">${fmtTime(s.starts_at)}</button>`).join("");
    if (booked) done.innerHTML = `<p class="rs-done-main">${L("done", { party: booked.party_size, date: fmtDate(booked.starts_at), time: fmtTime(booked.starts_at) })}</p><p class="rs-code">${L("doneCode", { code: booked.code })}</p><p>${L("doneMail", { email: booked.email })}</p><button type="button" class="button" id="rsAnother">${L("another")}</button>`;
  }
  async function loadSlots() {
    const seq = ++loadSeq; chosen = null; slots = []; $("rsSlotMsg").textContent = L("loading"); paint();
    try {
      const r = await rs.availability($("rsDate").value, Number($("rsParty").value));
      if (seq !== loadSeq) return;
      slots = r; $("rsSlotMsg").textContent = r.length ? "" : L("noSlots");
    } catch (e) { if (seq === loadSeq) $("rsSlotMsg").textContent = errText(e.code); }
    paint();
  }
  $("rsParty").addEventListener("change", loadSlots);
  $("rsDate").addEventListener("change", loadSlots);
  $("rsSlots").addEventListener("click", (e) => { const b = e.target.closest(".rs-slot"); if (!b) return; chosen = b.dataset.at; paint(); $("rsSlots").querySelector(`[data-at="${chosen}"]`).focus(); });
  $("rsSlots").addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key) || !slots.length) return;
    e.preventDefault();
    const i = Math.max(0, slots.findIndex((s) => s.starts_at === chosen)), n = (i + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + slots.length) % slots.length;
    chosen = slots[n].starts_at; paint(); $("rsSlots").querySelector(`[data-at="${chosen}"]`).focus();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); if (busy) return;
    const f = { party: Number($("rsParty").value), startsAt: chosen, name: $("rsName").value, phone: $("rsPhone").value, email: $("rsEmail").value };
    const bad = validate(f, maxParty);
    if (bad) { $("rsError").textContent = errText("invalid_" + bad); const target = { party: "rsParty", time: "rsSlots", name: "rsName", phone: "rsPhone", email: "rsEmail" }[bad]; ($(target).querySelector?.(".rs-slot") || $(target)).focus(); return; }
    busy = true; $("rsError").textContent = ""; paint();
    try {
      const r = await rs.reserve(f);
      booked = Object.assign({ email: String(f.email).trim().toLowerCase() }, r);
      form.hidden = true; done.hidden = false; busy = false; paint(); done.focus();
    } catch (err) {
      busy = false; $("rsError").textContent = errText(err.code); paint();
      if (["slot_full", "closed", "too_soon"].includes(err.code)) loadSlots();
    }
  });
  done.addEventListener("click", (e) => { if (e.target.id !== "rsAnother") return; booked = null; done.hidden = true; form.hidden = false; form.reset(); $("rsDate").value = today; loadSlots(); $("rsParty").focus(); });
  $("rcForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = $("rcCode").value.trim().toUpperCase(), email = $("rcEmail").value.trim();
    if (!/^[A-Z0-9]{8}$/.test(code) || !EMAIL.test(email)) { $("rcMsg").textContent = errText("not_found"); return; }
    try { const r = await rs.cancel(code, email); $("rcMsg").textContent = L("cancelled", { code: r.code }); loadSlots(); }
    catch (err) { $("rcMsg").textContent = errText(err.code); }
  });
  new MutationObserver(() => { paint(); if (!slots.length && $("rsSlotMsg").textContent) loadSlots(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  paint(); loadSlots();
})(typeof window !== "undefined" ? window : globalThis);
