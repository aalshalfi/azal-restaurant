/* AZAL accounts (Claude, ACCT). Supabase Auth + PostgREST over plain fetch: no third-party library.
   Inert unless window.AZAL_SUPABASE has both url and anonKey. Tokens live in localStorage under one key,
   the same place the official client keeps them; nothing else about the visitor is stored. */
(function (root) {
  "use strict";
  const KEY = "azal-auth-v1";

  function createAuth(opts) {
    const cfg = opts.config || {};
    const fetchFn = opts.fetch;
    const store = opts.storage;
    const now = opts.now || (() => Date.now());
    const enabled = Boolean(cfg.url && cfg.anonKey && fetchFn);
    const base = enabled ? String(cfg.url).replace(/\/+$/, "") : "";

    const read = () => { try { return JSON.parse(store.getItem(KEY) || "null"); } catch { return null; } };
    const write = (s) => { try { s ? store.setItem(KEY, JSON.stringify(s)) : store.removeItem(KEY); } catch {} };
    const toSession = (d) => d && d.access_token ? {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: now() + Math.max(0, Number(d.expires_in || 3600) - 60) * 1000,
      user: d.user ? { id: d.user.id, email: d.user.email } : null
    } : null;

    async function call(path, { method = "GET", body, token, prefer } = {}) {
      const headers = { apikey: cfg.anonKey, "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;
      if (prefer) headers.Prefer = prefer;
      let res;
      try { res = await fetchFn(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
      catch { const e = new Error("network"); e.code = "network"; throw e; }
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const msg = String((data && (data.error_description || data.msg || data.message || data.error)) || "");
        const e = new Error(msg || "error");
        e.status = res.status;
        e.code = /invalid login|invalid_grant|invalid credentials/i.test(msg) ? "invalid_credentials"
          : /not confirmed/i.test(msg) ? "email_not_confirmed"
          : /already registered|already exists/i.test(msg) ? "already_registered"
          : /signups? not allowed|signup.*disabled/i.test(msg) ? "signups_closed"
          : /password/i.test(msg) && /(short|weak|least|character)/i.test(msg) ? "weak_password"
          : /^(invalid_name|invalid_phone|signed_out|no_profile)$/.test(msg) ? msg   // our own RPC codes, passed through
          : /expired|invalid.*(token|otp)|otp.*invalid/i.test(msg) ? "code_invalid"
          : res.status === 429 || /only request this after|rate limit/i.test(msg) ? "rate_limited" : "error";
        throw e;
      }
      return data;
    }

    async function session() {
      if (!enabled) return null;
      const s = read();
      if (!s) return null;
      if (s.expires_at > now()) return s;
      try {
        const fresh = toSession(await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } }));
        write(fresh);
        return fresh;
      } catch { write(null); return null; }
    }

    return {
      enabled,
      async signIn(email, password) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        const s = toSession(await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } }));
        write(s);
        return s;
      },
      // F-OWN-2: name + mobile travel as user metadata; the server (0008 handle_new_user) cleans and stores them.
      async signUp(email, password, meta) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        const body = { email, password };
        if (meta && (meta.name || meta.phone)) body.data = { display_name: meta.name || null, phone: meta.phone || null };
        const d = await call("/auth/v1/signup", { method: "POST", body });
        const s = toSession(d);
        if (s) { write(s); return { session: s, confirm: false }; }
        return { session: null, confirm: true };
      },
      // Email one-time code (primary sign-in, lead ruling): one flow for new and returning members.
      async requestCode(email, redirectTo) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || "").trim())) throw Object.assign(new Error("invalid_email"), { code: "invalid_email" }); // nothing sent
        // redirect_to: the default Supabase email carries a sign-in LINK (no code) until custom SMTP lets us edit it;
        // the link returns here and adoptLink() finishes sign-in. With {{ .Token }} in the template, the code works too.
        // Lead decision 14:47: the link signs in EXISTING members only; accounts are created only by the join form
        // (name + email + mobile + password). An unknown email gets the same neutral answer as a known one, so the
        // page never reveals whether an account exists. Rate limits and network errors still surface.
        try {
          await call("/auth/v1/otp" + (redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : ""), { method: "POST", body: { email, create_user: false } });
        } catch (e) {
          if (e.code === "signups_closed" || /user not found|signups? not allowed|otp_disabled/i.test(String(e.message || ""))) return true;
          throw e;
        }
        return true;
      },
      async verifyCode(email, token) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        const s = toSession(await call("/auth/v1/verify", { method: "POST", body: { type: "email", email, token } }));
        if (!s) throw Object.assign(new Error("no session"), { code: "code_invalid" });
        write(s);
        return s;
      },
      // Return from the emailed link: "#access_token=…&refresh_token=…&expires_in=…" (or "#error=…").
      async adoptLink(hash) {
        if (!enabled) return null;
        const p = new URLSearchParams(String(hash || "").replace(/^#/, ""));
        if (p.get("error") || p.get("error_code")) return { error: "link_invalid" };
        const at = p.get("access_token"), rt = p.get("refresh_token");
        if (!at || !rt) return null;
        let user = null;
        try { user = await call("/auth/v1/user", { token: at }); } catch { return { error: "link_invalid" }; }
        const s = toSession({ access_token: at, refresh_token: rt, expires_in: p.get("expires_in"), user });
        write(s);
        return { session: s };
      },
      // Guest points (0004): move pending claims for this verified email into the ledger.
      // { added: N, failed: false } on success (N may be 0); { added: 0, failed: true } when the call fails, so the UI can say so.
      async claimGuestPoints() {
        const s = await session();
        if (!s) return { added: 0, failed: false };
        try {
          const r = await call("/rest/v1/rpc/claim_guest_points", { method: "POST", token: s.access_token, body: {} });
          return { added: Number((r && r.points_added) || 0), failed: false };
        } catch { return { added: 0, failed: true }; }
      },
      // F-OWN-8: the member edits their own name and mobile (0008 update_my_profile validates server-side).
      async updateProfile(name, phone) {
        const s = await session();
        if (!s) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
        return call("/rest/v1/rpc/update_my_profile", { method: "POST", token: s.access_token, body: { p_name: name, p_phone: phone || null } });
      },
      // Email change: Supabase Auth sends a confirmation to the new address; nothing changes until it is opened.
      async changeEmail(email, redirectTo) {
        const s = await session();
        if (!s) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || "").trim())) throw Object.assign(new Error("invalid_email"), { code: "invalid_email" });
        await call("/auth/v1/user" + (redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : ""), { method: "PUT", token: s.access_token, body: { email: String(email).trim() } });
        return true;
      },
      async signOut() {
        const s = read();
        write(null);
        if (enabled && s) { try { await call("/auth/v1/logout", { method: "POST", token: s.access_token }); } catch {} }
      },
      session,
      async state() {
        if (!enabled) return { status: "inert" };
        const s = await session();
        if (!s) return { status: "signed_out" };
        const uid = s.user && s.user.id;
        const q = (p) => call(p, { token: s.access_token });
        let profile = null, membership = null, rows = [];
        try {
          [profile, membership, rows] = await Promise.all([
            // select=* so the 0008 phone column comes along once it exists, and nothing breaks before.
            // B4: explicit columns; one fallback for a server without 0008 (no phone column -> 400).
            q("/rest/v1/profiles?select=id,display_name,phone&id=eq." + encodeURIComponent(uid)).catch((e) => { if (e.status === 400) return q("/rest/v1/profiles?select=id,display_name&id=eq." + encodeURIComponent(uid)); throw e; }).then((r) => r[0] || null),
            q("/rest/v1/memberships?select=status,joined_at&user_id=eq." + encodeURIComponent(uid)).then((r) => r[0] || null),
            q("/rest/v1/points_ledger?select=delta_points&user_id=eq." + encodeURIComponent(uid))
          ]);
        } catch (e) {
          if (e.status === 401) { write(null); return { status: "signed_out" }; }
          return { status: "error", email: s.user && s.user.email };
        }
        if (!profile) return { status: "no_profile", email: s.user && s.user.email };
        const points = (rows || []).reduce((a, r) => a + Number(r.delta_points || 0), 0);
        return { status: "signed_in", email: s.user && s.user.email, name: profile.display_name || null, phone: profile.phone || null, hasPhoneField: "phone" in profile, membership: membership ? membership.status : null, points };
      }
    };
  }

  // Same mobile rule as reservations and 0008 azal_phone(): 10 digits -> +1, 11 starting with 1 -> +, or + and 10-15 digits.
  // Only ASCII digits, spaces, dots, dashes, brackets and ONE leading "+" are accepted (ChatGPT #60 review): letters,
  // a second "+", or non-ASCII digits make the number invalid rather than being silently dropped.
  function normalizePhone(raw) {
    const s = String(raw || "");
    if (!/^\s*\+?[0-9 ().-]+$/.test(s)) return null;
    const d = s.replace(/[^0-9]/g, "");
    if (/^\d{10}$/.test(d)) return "+1" + d;
    if (/^1\d{10}$/.test(d)) return "+" + d;
    if (/^\s*\+/.test(s) && /^[1-9]\d{9,14}$/.test(d)) return "+" + d;
    return null;
  }
  // F-OWN-2: what a new member must give. Returns the first problem field, or null.
  function signUpProblem({ name, email, phone, password }) {
    const n = String(name || "").trim();
    if (!n || n.length > 80) return "name";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || "").trim())) return "email";
    if (!normalizePhone(phone)) return "phone";
    if (String(password || "").length < 8) return "password";
    return null;
  }
  const api = { createAuth, KEY, normalizePhone, signUpProblem };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const auth = createAuth({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root), storage: root.localStorage });
  root.AZALAuth = auth;
  if (!auth.enabled) return; // inert: the static "opens soon" page stays exactly as shipped
  document.querySelectorAll(".member-banner .demo-label").forEach((el) => { el.hidden = true; });

  const tr = (k) => (typeof t === "function" ? t(k) : k); // t() is script.js's global translator
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtPoints = (n) => new Intl.NumberFormat(document.documentElement.lang === "fr" ? "fr-CA" : "en-CA").format(n);
  // F-OWN-1 (owner): a password is the main way in; the email link stays one tap away.
  let last = null, mode = "signin", codeSentTo = "", message = "", lastSentAt = 0, editing = false, detailMsg = "";

  function errorKey(e) {
    return { invalid_credentials: "authErrCredentials", email_not_confirmed: "authErrConfirm", already_registered: "authErrExists",
      signups_closed: "authErrClosed", weak_password: "authErrWeak", rate_limited: "authErrRate", network: "authErrNetwork",
      code_invalid: "authErrCode", invalid_name: "authErrName", invalid_phone: "authErrPhone", invalid_email: "authErrInvalidEmail" }[e && e.code] || "authErrGeneric";
  }

  function headerState(st) {
    document.querySelectorAll('.nav a[data-i18n="navMajlis"]').forEach((a) => {
      a.textContent = st && st.status === "signed_in" ? tr("navMajlisMine") : tr("navMajlis");
    });
  }

  // F-OWN-8: the member sees and edits their own name, mobile and email. Editing shows only when the server has
  // 0008 (the profile row carries a phone field); otherwise the details are shown read-only, with no dead button.
  function detailsBlock(st) {
    const v = (x) => (x ? esc(x) : `<span class="auth-unset">${esc(tr("authNotSet"))}</span>`);
    if (!editing) {
      return `<div class="auth-details"><h3 class="auth-details-title">${esc(tr("authDetails"))}</h3>` +
        `<dl class="auth-dl"><div><dt>${esc(tr("authName"))}</dt><dd>${v(st.name)}</dd></div>` +
        `<div><dt>${esc(tr("authPhone"))}</dt><dd dir="ltr">${v(st.phone)}</dd></div>` +
        `<div><dt>${esc(tr("authEmailLabel"))}</dt><dd dir="ltr">${v(st.email)}</dd></div></dl>` +
        (detailMsg ? `<p class="auth-message" role="status">${esc(detailMsg)}</p>` : "") +
        (st.hasPhoneField ? `<button class="text-link dark-link auth-switch" type="button" id="authEditDetails">${esc(tr("authEdit"))}</button>` : "") + `</div>`;
    }
    return `<form class="auth-form auth-details" id="authDetailsForm" novalidate><h3 class="auth-details-title">${esc(tr("authDetails"))}</h3>` +
      `<label for="pfName">${esc(tr("authName"))}</label><input id="pfName" name="name" autocomplete="name" maxlength="80" required value="${esc(st.name || "")}">` +
      `<label for="pfPhone">${esc(tr("authPhone"))}</label><input id="pfPhone" name="phone" type="tel" dir="ltr" autocomplete="tel" maxlength="24" value="${esc(st.phone || "")}">` +
      `<label for="pfEmail">${esc(tr("authEmailLabel"))}</label><input id="pfEmail" name="email" type="email" dir="ltr" autocomplete="email" maxlength="254" required value="${esc(st.email || "")}">` +
      `<p class="auth-message" id="pfMessage" role="status" aria-live="polite">${esc(detailMsg)}</p>` +
      `<div class="auth-links"><button class="button button-gold" type="submit" id="pfSave">${esc(tr("authSave"))}</button>` +
      `<button class="text-link dark-link auth-switch" type="button" id="authCancelDetails">${esc(tr("authCancel"))}</button></div></form>`;
  }

  function renderCard(st) {
    try { document.dispatchEvent(new CustomEvent("azal:auth", { detail: { status: st && st.status } })); } catch {} // member-history.js listens
    const card = document.querySelector(".member-card");
    if (!card) return;
    if (st.status === "signed_in" || st.status === "no_profile" || st.status === "error") {
      const pending = st.status !== "signed_in";
      card.innerHTML =
        `<div class="section-kicker">${tr("memberCardKicker")}</div>` +
        `<p class="auth-hello">${esc(tr("authHello").replace("{name}", st.name || st.email || ""))}</p>` +
        `<div class="member-stats"><div class="member-stat"><span>${tr("memberStatusLabel")}</span><strong>${pending ? tr("authSettingUp") : st.membership === "active" ? tr("authMemberActive") : tr("authMemberNone")}</strong></div>` +
        // Owner 21:31: no placeholder where personal data would go; the points card renders only with real points behind it.
        (pending ? "" : `<div class="member-stat"><span>${tr("memberPointsLabel")}</span><strong>${fmtPoints(st.points)}</strong></div>`) + `</div>` +
        (st.claimed ? `<p class="auth-claimed" role="status">${esc(tr("authClaimed").replace("{points}", fmtPoints(st.claimed)))}</p>` : "") +
        (st.claimFailed ? `<p class="auth-claimed auth-claim-failed" role="alert">${esc(tr("authClaimFailed"))} <button type="button" class="text-link dark-link" id="authClaimRetry">${esc(tr("authClaimRetry"))}</button></p>` : "") +
        (pending ? "" : detailsBlock(st)) +
        `<p class="auth-note">${tr("authPreviewNote")}</p>` +
        `<div class="member-actions"><button class="button member-join" type="button" id="authSignOut">${tr("authSignOut")}</button></div>`;
      if (editing) document.getElementById("pfName")?.focus();
      return;
    }
    if (mode === "code") {
      const step2 = Boolean(codeSentTo);
      // ChatGPT #30 review (lead-confirmed): the default Supabase email carries a sign-in LINK only. The code box is shown
      // only once the email template carries {{ .Token }} and the config says so (AZAL_SUPABASE.emailCode === true);
      // until then the copy is link-first and promises no code.
      const codeEntry = Boolean(root.AZAL_SUPABASE && root.AZAL_SUPABASE.emailCode === true);
      card.innerHTML =
        `<div class="section-kicker">${tr("memberCardKicker")}</div>` +
        `<h2 class="auth-title">${tr("authCodeTitle")}</h2>` +
        (step2 && !codeEntry
          ? `<p class="auth-sent" role="status">${esc(tr("authLinkSent").replace("{email}", codeSentTo))}</p>` +
            `<p class="auth-message" id="authMessage" role="status" aria-live="polite">${esc(message)}</p>` +
            `<div class="auth-links"><button class="text-link dark-link auth-switch" type="button" id="authResend">${tr("authCodeResend")}</button>` +
            `<button class="text-link dark-link auth-switch" type="button" id="authChangeEmail">${tr("authCodeChange")}</button></div>`
          : step2
          ? `<form class="auth-form" id="authCodeVerify" novalidate>` +
            `<p class="auth-sent">${esc(tr("authCodeSent").replace("{email}", codeSentTo))}</p>` +
            `<label for="authCode">${tr("authCodeLabel")}</label><input id="authCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="8" required>` +
            `<p class="auth-message" id="authMessage" role="status" aria-live="polite">${esc(message)}</p>` +
            `<button class="button button-gold" type="submit" id="authSubmit">${tr("authCodeVerify")}</button>` +
            `</form>` +
            `<div class="auth-links"><button class="text-link dark-link auth-switch" type="button" id="authResend">${tr("authCodeResend")}</button>` +
            `<button class="text-link dark-link auth-switch" type="button" id="authChangeEmail">${tr("authCodeChange")}</button></div>`
          : `<form class="auth-form" id="authCodeRequest" novalidate>` +
            `<label for="authEmail">${tr("authEmail")}</label><input id="authEmail" name="email" type="email" autocomplete="email" required>` +
            `<p class="auth-message" id="authMessage" role="status" aria-live="polite">${esc(message)}</p>` +
            `<button class="button button-gold" type="submit" id="authSubmit">${tr("authCodeSend")}</button>` +
            `</form>` +
            `<button class="text-link dark-link auth-switch" type="button" id="authUsePassword">${tr("authUsePassword")}</button>`) +
        `<p class="auth-note">${tr("authCodeNote")}</p><p class="auth-note">${tr("authPrivacy")}</p>`;
      return;
    }
    const isUp = mode === "signup";
    card.innerHTML =
      `<div class="section-kicker">${tr("memberCardKicker")}</div>` +
      `<h2 class="auth-title">${tr(isUp ? "authJoinTitle" : "authSignInTitle")}</h2>` +
      `<form class="auth-form" id="authForm" novalidate>` +
      (isUp ? `<label for="authName">${tr("authName")}</label><input id="authName" name="name" autocomplete="name" maxlength="80" required>` : "") +
      `<label for="authEmail">${tr("authEmail")}</label><input id="authEmail" name="email" type="email" autocomplete="email" required>` +
      (isUp ? `<label for="authPhone">${tr("authPhone")}</label><input id="authPhone" name="phone" type="tel" dir="ltr" autocomplete="tel" maxlength="24" required>` : "") +
      `<label for="authPassword">${tr("authPassword")}</label><input id="authPassword" name="password" type="password" autocomplete="${isUp ? "new-password" : "current-password"}" minlength="8" required>` +
      `<p class="auth-message" id="authMessage" role="status" aria-live="polite">${esc(message)}</p>` +
      `<button class="button button-gold" type="submit" id="authSubmit">${tr(isUp ? "memberJoin" : "memberSignIn")}</button>` +
      `</form>` +
      `<div class="auth-links"><button class="text-link dark-link auth-switch" type="button" id="authSwitch">${tr(isUp ? "authHaveAccount" : "authNoAccount")}</button>` +
      `<button class="text-link dark-link auth-switch" type="button" id="authUseCode">${tr("authUseCode")}</button></div>` +
      `<p class="auth-note">${tr("authPrivacy")}</p>`;
  }

  const here = () => { try { return root.location.origin + root.location.pathname; } catch { return undefined; } };
  async function refresh(afterSignIn) {
    let claim = { added: 0, failed: false };
    if (afterSignIn) claim = await auth.claimGuestPoints();
    last = await auth.state();
    if (claim.added > 0) last.claimed = claim.added;
    if (claim.failed) last.claimFailed = true;
    headerState(last);
    renderCard(last);
  }

  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "authSwitch") { mode = mode === "signin" ? "signup" : "signin"; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authSignOut") { await auth.signOut(); message = ""; mode = "signin"; codeSentTo = ""; editing = false; detailMsg = ""; refresh(); }
    if (e.target && e.target.id === "authEditDetails") { editing = true; detailMsg = ""; renderCard(last); }
    if (e.target && e.target.id === "authCancelDetails") { editing = false; detailMsg = ""; renderCard(last); document.getElementById("authEditDetails")?.focus(); }
    if (e.target && e.target.id === "authClaimRetry") { e.target.disabled = true; message = ""; refresh(true); return; }
    if (e.target && e.target.id === "authUsePassword") { mode = "signin"; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authUseCode") { mode = "code"; codeSentTo = ""; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authChangeEmail") { codeSentTo = ""; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authResend") {
      if (Date.now() - lastSentAt < 60000) { message = tr("authCodeWait"); const m = document.getElementById("authMessage"); if (m) m.textContent = message; return; }
      try { await auth.requestCode(codeSentTo, here()); lastSentAt = Date.now(); message = tr("authCodeResent"); } catch (err) { message = tr(errorKey(err)); }
      const m = document.getElementById("authMessage"); if (m) m.textContent = message;
    }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target && e.target.id === "authCodeRequest") {
      e.preventDefault();
      const email = e.target.email.value.trim();
      const btn = document.getElementById("authSubmit");
      if (!email) { message = tr("authErrMissingEmail"); document.getElementById("authMessage").textContent = message; return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { message = tr("authErrInvalidEmail"); document.getElementById("authMessage").textContent = message; e.target.email.focus(); return; }
      btn.disabled = true;
      try { await auth.requestCode(email, here()); codeSentTo = email; lastSentAt = Date.now(); message = ""; renderCard(last); document.getElementById("authCode")?.focus(); }
      catch (err) { message = tr(errorKey(err)); const m = document.getElementById("authMessage"); if (m) m.textContent = message; btn.disabled = false; }
      return;
    }
    if (e.target && e.target.id === "authCodeVerify") {
      e.preventDefault();
      const code = e.target.code.value.replace(/\s+/g, "");
      const btn = document.getElementById("authSubmit");
      if (!/^[0-9]{6,8}$/.test(code)) { message = tr("authErrCode"); document.getElementById("authMessage").textContent = message; return; }
      btn.disabled = true;
      try { await auth.verifyCode(codeSentTo, code); message = ""; codeSentTo = ""; await refresh(true); }
      catch (err) { message = tr(errorKey(err)); const m = document.getElementById("authMessage"); if (m) m.textContent = message; btn.disabled = false; }
      return;
    }
    if (e.target && e.target.id === "authDetailsForm") {
      e.preventDefault();
      // By id, never form.name (that is the form's own name attribute).
      const g = (id) => document.getElementById(id);
      const name = g("pfName").value.trim(), rawPhone = g("pfPhone").value.trim(), email = g("pfEmail").value.trim();
      const say = (k) => { detailMsg = tr(k); const m = document.getElementById("pfMessage"); if (m) m.textContent = detailMsg; };
      if (!name || name.length > 80) { say("authErrName"); g("pfName").focus(); return; }
      const phone = rawPhone ? normalizePhone(rawPhone) : null;
      if (rawPhone && !phone) { say("authErrPhone"); g("pfPhone").focus(); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say("authErrInvalidEmail"); g("pfEmail").focus(); return; }
      const save = document.getElementById("pfSave"); save.disabled = true;
      const who = last && last.email; // if the account changes or signs out meanwhile, the answer is not shown
      // B5 (ChatGPT audit, lead-accepted): name/mobile and email are two separate outcomes, reported separately.
      const profChanged = name !== (last.name || "") || (phone || null) !== (last.phone || null);
      const emailChanged = email.toLowerCase() !== String(last.email || "").toLowerCase();
      let profOk = !profChanged, profErr = null, mailOk = !emailChanged, mailErr = null;
      if (profChanged) { try { await auth.updateProfile(name, phone); profOk = true; } catch (err) { profErr = err; } }
      if (emailChanged) { try { await auth.changeEmail(email, here()); mailOk = true; } catch (err) { mailErr = err; } }
      const s2 = await auth.session(); if (!s2 || !last || last.email !== who) return; // signed out / switched meanwhile
      const lines = [];
      if (profChanged) lines.push(profOk ? tr("authSaved") : tr("authProfileFailed") + " " + tr(errorKey(profErr)));
      if (emailChanged) lines.push(mailOk ? tr("authEmailChangeSent").replace("{email}", email) : tr("authEmailFailed") + " " + tr(errorKey(mailErr)));
      if (!lines.length) lines.push(tr("authSaved"));
      detailMsg = lines.join(" ");
      if (profOk && mailOk) { editing = false; await refresh(); document.getElementById("authEditDetails")?.focus(); }
      else { if (profOk) { await refresh(); } const m = document.getElementById("pfMessage"); if (m) m.textContent = detailMsg; const sv = document.getElementById("pfSave"); if (sv) sv.disabled = false; }
      return;
    }
    if (!e.target || e.target.id !== "authForm") return;
    e.preventDefault();
    const email = e.target.email.value.trim(), password = e.target.password.value;
    const btn = document.getElementById("authSubmit");
    const say = (k) => { message = tr(k); document.getElementById("authMessage").textContent = message; };
    if (mode === "signup") {
      const val = (id) => (document.getElementById(id) || {}).value || "";
      const bad = signUpProblem({ name: val("authName"), email, phone: val("authPhone"), password });
      if (bad) { say({ name: "authErrName", email: "authErrInvalidEmail", phone: "authErrPhone", password: "authErrWeak" }[bad]); document.getElementById({ name: "authName", email: "authEmail", phone: "authPhone", password: "authPassword" }[bad]).focus(); return; }
    }
    if (!email || !password) { say("authErrMissing"); return; }
    btn.disabled = true;
    try {
      if (mode === "signup") {
        const r = await auth.signUp(email, password, { name: document.getElementById("authName").value.trim(), phone: normalizePhone(document.getElementById("authPhone").value) });
        message = r.confirm ? tr("authCheckEmail") : "";
      } else {
        await auth.signIn(email, password);
        message = "";
      }
      await refresh(true);
    } catch (err) {
      message = tr(errorKey(err));
      const m = document.getElementById("authMessage");
      if (m) m.textContent = message;
      btn.disabled = false;
    }
  });
  document.getElementById("languageToggle")?.addEventListener("click", () => setTimeout(() => { headerState(last); renderCard(last || { status: "signed_out" }); }, 0));
  (async () => {
    const h = root.location && root.location.hash;
    if (h && /access_token=|error=/.test(h)) {
      const r = await auth.adoptLink(h);
      try { root.history.replaceState(null, "", root.location.pathname + root.location.search); } catch {} // tokens never stay in the address bar
      if (r && r.session) { mode = "signin"; codeSentTo = ""; message = ""; return refresh(true); }
      if (r && r.error) message = tr("authLinkInvalid");
    }
    refresh();
  })();
})(typeof window !== "undefined" ? window : globalThis);
