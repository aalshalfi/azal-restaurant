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
      async signUp(email, password) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        const d = await call("/auth/v1/signup", { method: "POST", body: { email, password } });
        const s = toSession(d);
        if (s) { write(s); return { session: s, confirm: false }; }
        return { session: null, confirm: true };
      },
      // Email one-time code (primary sign-in, lead ruling): one flow for new and returning members.
      async requestCode(email) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        await call("/auth/v1/otp", { method: "POST", body: { email, create_user: true } });
        return true;
      },
      async verifyCode(email, token) {
        if (!enabled) throw Object.assign(new Error("disabled"), { code: "disabled" });
        const s = toSession(await call("/auth/v1/verify", { method: "POST", body: { type: "email", email, token } }));
        if (!s) throw Object.assign(new Error("no session"), { code: "code_invalid" });
        write(s);
        return s;
      },
      // Guest points (0004): move pending claims for this verified email into the ledger. 0 if none or not deployed.
      async claimGuestPoints() {
        const s = await session();
        if (!s) return 0;
        try {
          const r = await call("/rest/v1/rpc/claim_guest_points", { method: "POST", token: s.access_token, body: {} });
          return Number((r && r.points_added) || 0);
        } catch { return 0; }
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
            q("/rest/v1/profiles?select=id,display_name&id=eq." + encodeURIComponent(uid)).then((r) => r[0] || null),
            q("/rest/v1/memberships?select=status,joined_at&user_id=eq." + encodeURIComponent(uid)).then((r) => r[0] || null),
            q("/rest/v1/points_ledger?select=delta_points&user_id=eq." + encodeURIComponent(uid))
          ]);
        } catch (e) {
          if (e.status === 401) { write(null); return { status: "signed_out" }; }
          return { status: "error", email: s.user && s.user.email };
        }
        if (!profile) return { status: "no_profile", email: s.user && s.user.email };
        const points = (rows || []).reduce((a, r) => a + Number(r.delta_points || 0), 0);
        return { status: "signed_in", email: s.user && s.user.email, name: profile.display_name || null, membership: membership ? membership.status : null, points };
      }
    };
  }

  const api = { createAuth, KEY };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const auth = createAuth({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root), storage: root.localStorage });
  root.AZALAuth = auth;
  if (!auth.enabled) return; // inert: the static "opens soon" page stays exactly as shipped
  document.querySelectorAll(".member-banner .demo-label").forEach((el) => { el.hidden = true; });

  const tr = (k) => (typeof t === "function" ? t(k) : k); // t() is script.js's global translator
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtPoints = (n) => new Intl.NumberFormat(document.documentElement.lang === "fr" ? "fr-CA" : "en-CA").format(n);
  let last = null, mode = "code", codeSentTo = "", message = "", lastSentAt = 0;

  function errorKey(e) {
    return { invalid_credentials: "authErrCredentials", email_not_confirmed: "authErrConfirm", already_registered: "authErrExists",
      signups_closed: "authErrClosed", weak_password: "authErrWeak", rate_limited: "authErrRate", network: "authErrNetwork",
      code_invalid: "authErrCode" }[e && e.code] || "authErrGeneric";
  }

  function headerState(st) {
    document.querySelectorAll('.nav a[data-i18n="navMajlis"]').forEach((a) => {
      a.textContent = st && st.status === "signed_in" ? tr("navMajlisMine") : tr("navMajlis");
    });
  }

  function renderCard(st) {
    const card = document.querySelector(".member-card");
    if (!card) return;
    if (st.status === "signed_in" || st.status === "no_profile" || st.status === "error") {
      const pending = st.status !== "signed_in";
      card.innerHTML =
        `<div class="section-kicker">${tr("memberCardKicker")}</div>` +
        `<p class="auth-hello">${esc(tr("authHello").replace("{name}", st.name || st.email || ""))}</p>` +
        `<div class="member-stats"><div class="member-stat"><span>${tr("memberStatusLabel")}</span><strong>${pending ? tr("authSettingUp") : st.membership === "active" ? tr("authMemberActive") : tr("authMemberNone")}</strong></div>` +
        `<div class="member-stat"><span>${tr("memberPointsLabel")}</span><strong>${pending ? "—" : fmtPoints(st.points)}</strong></div></div>` +
        (st.claimed ? `<p class="auth-claimed" role="status">${esc(tr("authClaimed").replace("{points}", fmtPoints(st.claimed)))}</p>` : "") +
        `<p class="auth-note">${tr("authPreviewNote")}</p>` +
        `<div class="member-actions"><button class="button member-join" type="button" id="authSignOut">${tr("authSignOut")}</button></div>`;
      return;
    }
    if (mode === "code") {
      const step2 = Boolean(codeSentTo);
      card.innerHTML =
        `<div class="section-kicker">${tr("memberCardKicker")}</div>` +
        `<h2 class="auth-title">${tr("authCodeTitle")}</h2>` +
        (step2
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
      `<label for="authEmail">${tr("authEmail")}</label><input id="authEmail" name="email" type="email" autocomplete="email" required>` +
      `<label for="authPassword">${tr("authPassword")}</label><input id="authPassword" name="password" type="password" autocomplete="${isUp ? "new-password" : "current-password"}" minlength="8" required>` +
      `<p class="auth-message" id="authMessage" role="status" aria-live="polite">${esc(message)}</p>` +
      `<button class="button button-gold" type="submit" id="authSubmit">${tr(isUp ? "memberJoin" : "memberSignIn")}</button>` +
      `</form>` +
      `<div class="auth-links"><button class="text-link dark-link auth-switch" type="button" id="authSwitch">${tr(isUp ? "authHaveAccount" : "authNoAccount")}</button>` +
      `<button class="text-link dark-link auth-switch" type="button" id="authUseCode">${tr("authUseCode")}</button></div>` +
      `<p class="auth-note">${tr("authPrivacy")}</p>`;
  }

  async function refresh(afterSignIn) {
    let claimed = 0;
    if (afterSignIn) claimed = await auth.claimGuestPoints();
    last = await auth.state();
    if (claimed > 0) last.claimed = claimed;
    headerState(last);
    renderCard(last);
  }

  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "authSwitch") { mode = mode === "signin" ? "signup" : "signin"; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authSignOut") { await auth.signOut(); message = ""; mode = "code"; codeSentTo = ""; refresh(); }
    if (e.target && e.target.id === "authUsePassword") { mode = "signin"; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authUseCode") { mode = "code"; codeSentTo = ""; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authChangeEmail") { codeSentTo = ""; message = ""; renderCard(last); }
    if (e.target && e.target.id === "authResend") {
      if (Date.now() - lastSentAt < 60000) { message = tr("authCodeWait"); const m = document.getElementById("authMessage"); if (m) m.textContent = message; return; }
      try { await auth.requestCode(codeSentTo); lastSentAt = Date.now(); message = tr("authCodeResent"); } catch (err) { message = tr(errorKey(err)); }
      const m = document.getElementById("authMessage"); if (m) m.textContent = message;
    }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target && e.target.id === "authCodeRequest") {
      e.preventDefault();
      const email = e.target.email.value.trim();
      const btn = document.getElementById("authSubmit");
      if (!email) { message = tr("authErrMissingEmail"); document.getElementById("authMessage").textContent = message; return; }
      btn.disabled = true;
      try { await auth.requestCode(email); codeSentTo = email; lastSentAt = Date.now(); message = ""; renderCard(last); document.getElementById("authCode")?.focus(); }
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
    if (!e.target || e.target.id !== "authForm") return;
    e.preventDefault();
    const email = e.target.email.value.trim(), password = e.target.password.value;
    const btn = document.getElementById("authSubmit");
    if (!email || !password) { message = tr("authErrMissing"); document.getElementById("authMessage").textContent = message; return; }
    btn.disabled = true;
    try {
      if (mode === "signup") {
        const r = await auth.signUp(email, password);
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
  refresh();
})(typeof window !== "undefined" ? window : globalThis);
