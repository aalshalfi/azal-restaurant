/* AZAL management area (Claude, ADM-1; owner F-OWN-6/7/10/13). One sign-in door: the member page signs you in,
   and the server-held role decides what opens. Authorization is the database's job (azal_is_admin(), RLS on every
   table); this page only reads, and only shows what the signed-in account's role allows. Nothing here writes.
   Built in ADM-1: the protected shell, the role check, and a read-only overview. Orders/customers (ADM-2), points
   adjustments (ADM-3) and staff management (ADM-4) are not shown until they exist: no dead navigation.
   Inert while window.AZAL_SUPABASE is null. Every value is rendered with textContent. */
(function (root) {
  "use strict";
  const TZ = "America/Toronto";

  // Start of "today" in Toronto as an ISO instant (DST-safe, no library).
  function torontoMidnight(nowMs) {
    const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(nowMs));
    const g = (k) => Number(p.find((x) => x.type === k).value);
    for (const off of [5, 4]) { // EST, EDT
      const cand = Date.UTC(g("year"), g("month") - 1, g("day"), off, 0);
      const h = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(cand));
      if (Number(h) === 0) return new Date(cand).toISOString();
    }
    return new Date(Date.UTC(g("year"), g("month") - 1, g("day"), 5)).toISOString();
  }

  // Today's orders summarised. Paid orders only for the kitchen counts (unpaid ones never reach the kitchen).
  function summarise(orders) {
    const s = { newPaid: 0, inKitchen: 0, ready: 0, collected: 0, cancelled: 0, unpaid: 0, salesCents: 0, byBranch: {} };
    for (const o of orders || []) {
      const b = (s.byBranch[o.branch_slug] = s.byBranch[o.branch_slug] || { orders: 0, collected: 0 });
      b.orders++;
      if (o.fulfilment_status === "cancelled") { s.cancelled++; continue; }
      if (o.payment_status !== "paid") { s.unpaid++; continue; }
      if (o.fulfilment_status === "placed") s.newPaid++;
      else if (o.fulfilment_status === "accepted" || o.fulfilment_status === "preparing") s.inKitchen++;
      else if (o.fulfilment_status === "ready") s.ready++;
      else if (o.fulfilment_status === "handed_over") { s.collected++; b.collected++; s.salesCents += Number(o.total_cents || 0); }
    }
    return s;
  }

  function createAdmin({ config, fetch: fetchFn, getSession, now }) {
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    now = now || (() => Date.now());
    async function call(path, token, { method = "GET", body, count } = {}) {
      let res;
      const headers = { apikey: config.anonKey, Authorization: "Bearer " + token, "Content-Type": "application/json" };
      if (count) headers.Prefer = "count=exact";
      try { res = await fetchFn(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      if (!res.ok) throw Object.assign(new Error("http_" + res.status), { code: res.status === 401 ? "signed_out" : "error" });
      const data = await res.json().catch(() => null);
      if (count) { const r = res.headers && res.headers.get && res.headers.get("content-range"); const n = r ? Number(String(r).split("/")[1]) : NaN; return Number.isFinite(n) ? n : (Array.isArray(data) ? data.length : 0); }
      return data;
    }
    return {
      enabled,
      // Who is this, according to the SERVER: the admin check is azal_is_admin() (user_roles), the staff branches come
      // from the caller's own staff_branch_access rows (RLS: self or admin). A client can't make itself admin here:
      // every read below is filtered again by RLS.
      async access() {
        const s = enabled && getSession ? await getSession() : null;
        if (!s || !s.access_token) return { status: "signed_out" };
        const uid = s.user && s.user.id;
        const [isAdmin, roles, branches] = await Promise.all([
          call("/rest/v1/rpc/azal_is_admin", s.access_token, { method: "POST", body: {} }),
          call("/rest/v1/user_roles?select=role&user_id=eq." + encodeURIComponent(uid), s.access_token),
          call("/rest/v1/staff_branch_access?select=branch_slug&user_id=eq." + encodeURIComponent(uid), s.access_token)
        ]);
        const roleSet = new Set((roles || []).map((r) => r.role));
        const role = isAdmin === true ? "admin" : roleSet.has("staff") ? "staff" : "customer";
        return { status: "signed_in", role, email: s.user && s.user.email, branches: (branches || []).map((b) => b.branch_slug) };
      },
      // Read-only overview for an admin: today's orders across ALL branches (admin RLS), and the member count.
      async overview() {
        const s = await getSession();
        const since = torontoMidnight(now());
        const [orders, members] = await Promise.all([
          call("/rest/v1/orders?select=id,branch_slug,fulfilment_status,payment_status,total_cents,placed_at&placed_at=gte." + encodeURIComponent(since) + "&order=placed_at.desc&limit=1000", s.access_token),
          call("/rest/v1/memberships?select=user_id&status=eq.active&limit=1", s.access_token, { count: true })
        ]);
        return Object.assign(summarise(orders), { members, since, truncated: (orders || []).length >= 1000 });
      },
      // T-08: paged reads only. RLS is the enforcement boundary; the UI also requires the server admin verdict.
      async customers({ search = "" } = {}) {
        const s = await getSession();
        if (!s || !s.access_token) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
        async function pages(path) {
          const rows = [];
          for (let offset = 0; ; offset += 500) {
            const page = await call(path + (path.includes("?") ? "&" : "?") + "limit=500&offset=" + offset, s.access_token);
            rows.push(...(page || []));
            if (!page || page.length < 500) return rows;
            if (rows.length >= 100000) throw Object.assign(new Error("result_too_large"), { code: "error" });
          }
        }
        const [profiles, memberships, ledger] = await Promise.all([
          pages("/rest/v1/profiles?select=id,display_name,phone,member_number,created_at&order=created_at.desc,id.desc"),
          pages("/rest/v1/memberships?select=user_id,status,joined_at"),
          pages("/rest/v1/points_ledger?select=user_id,delta_points")
        ]);
        const memberById = new Map((memberships || []).map(x => [x.user_id, x]));
        const balances = new Map();
        for (const row of ledger || []) balances.set(row.user_id, (balances.get(row.user_id) || 0) + Number(row.delta_points || 0));
        const term = String(search || "").trim().toLocaleLowerCase();
        return (profiles || []).map(p => Object.assign({}, p, {
          membership: memberById.get(p.id) || null, balance: balances.get(p.id) || 0
        })).filter(p => !term || [p.display_name, p.phone, p.member_number == null ? "" : String(p.member_number)].some(v => String(v || "").toLocaleLowerCase().includes(term)));
      },
      async orders({ search = "", status = "all" } = {}) {
        const s = await getSession();
        if (!s || !s.access_token) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const page = await call("/rest/v1/orders?select=id,user_id,branch_slug,fulfilment_status,payment_status,subtotal_cents,discount_cents,redeemed_points,tax_rate_bps,tax_cents,total_cents,placed_at,scheduled_for,pickup_slot,guest_name,guest_email,contact_phone&order=placed_at.desc,id.desc&limit=500&offset=" + offset, s.access_token);
          rows.push(...(page || []));
          if (!page || page.length < 500) break;
          if (rows.length >= 100000) throw Object.assign(new Error("result_too_large"), { code: "error" });
        }
        const term = String(search || "").trim().toLocaleLowerCase();
        return rows.filter(o => (status === "all" || o.fulfilment_status === status) &&
          (!term || [o.id, o.branch_slug, o.guest_name, o.guest_email, o.contact_phone, o.user_id].some(v => String(v || "").toLocaleLowerCase().includes(term))));
      },
      async orderDetail(orderId) {
        const s = await getSession();
        if (!s || !s.access_token) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
        if (!/^[0-9a-f-]{36}$/i.test(String(orderId))) throw Object.assign(new Error("not_found"), { code: "not_found" });
        const rows = await call("/rest/v1/orders?select=id,user_id,branch_slug,fulfilment_type,fulfilment_status,payment_status,subtotal_cents,discount_cents,redeemed_points,tax_rate_bps,tax_cents,total_cents,scheduled_for,pickup_slot,customer_note,guest_name,guest_email,contact_phone,placed_at,updated_at,handed_over_at,order_items(id,quantity,unit_price_cents,line_total_cents,item_name_en_snapshot,item_name_fr_snapshot,order_item_options(id,option_name_en_snapshot,option_name_fr_snapshot,quantity,unit_delta_cents,line_delta_cents)),order_events(id,actor_user_id,event_type,from_status,to_status,details,created_at)&id=eq." + encodeURIComponent(orderId) + "&order_events.order=created_at.asc,id.asc&limit=1", s.access_token);
        if (!rows || !rows.length) throw Object.assign(new Error("not_found"), { code: "not_found" });
        const order = rows[0];
        const profiles = order.user_id ? await call("/rest/v1/profiles?select=id,display_name,phone,member_number,created_at&id=eq." + encodeURIComponent(order.user_id) + "&limit=1", s.access_token) : [];
        return Object.assign({}, order, { customer: profiles && profiles[0] || null });
      }
    };
  }

  const api = { createAdmin, summarise, torontoMidnight };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const rootEl = document.getElementById("adminRoot");
  if (!rootEl) return;
  const auth = root.AZALAuth;
  const adm = createAdmin({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root), getSession: async () => { try { return auth && (await auth.session()); } catch { return null; } } });

  const S = {
    en: { title: "Management", inert: "The management area turns on when the site is connected.", signedOut: "Sign in first on the Majlis page with your management account.", signIn: "Go to sign in",
      notAdmin: "This area is for AZAL management. Your account doesn’t have access.", staffGo: "Open the kitchen orders screen", signedAs: "Signed in as {email} · {role}",
      r_admin: "Administrator", r_staff: "Branch staff", r_customer: "Member", overview: "Today", since: "Since midnight, all branches",
      k_new: "New, paid", k_kitchen: "In the kitchen", k_ready: "Ready for pickup", k_collected: "Collected", k_cancelled: "Cancelled", k_unpaid: "Unpaid (never reach the kitchen)",
      sales: "Collected sales today: {amount}", members: "Active Majlis members: {n}", kitchen: "Kitchen orders screen", next: "Next in this area: order history and customers, then points adjustments, then staff access.",
      branch: "{branch}: {orders} orders today, {collected} collected", signOut: "Sign out", signingOut: "Signing out…", error: "We couldn’t load the overview. Refresh to try again.", truncated: "Showing the first 1,000 orders of today." },
    fr: { title: "Gestion", inert: "L’espace de gestion s’active quand le site est connecté.", signedOut: "Connectez-vous d’abord sur la page Majlis avec votre compte de gestion.", signIn: "Aller à la connexion",
      notAdmin: "Cet espace est réservé à la gestion d’AZAL. Votre compte n’y a pas accès.", staffGo: "Ouvrir l’écran des commandes de cuisine", signedAs: "Connecté : {email} · {role}",
      r_admin: "Administrateur", r_staff: "Personnel de succursale", r_customer: "Membre", overview: "Aujourd’hui", since: "Depuis minuit, toutes les succursales",
      k_new: "Nouvelles, payées", k_kitchen: "En cuisine", k_ready: "Prêtes à emporter", k_collected: "Récupérées", k_cancelled: "Annulées", k_unpaid: "Non payées (n’arrivent jamais en cuisine)",
      sales: "Ventes récupérées aujourd’hui : {amount}", members: "Membres Majlis actifs : {n}", kitchen: "Écran des commandes de cuisine", next: "Prochainement ici : historique des commandes et clients, puis ajustements de points, puis accès du personnel.",
      branch: "{branch} : {orders} commandes aujourd’hui, {collected} récupérées", signOut: "Se déconnecter", signingOut: "Déconnexion…", error: "Impossible de charger l’aperçu. Actualisez pour réessayer.", truncated: "Les 1 000 premières commandes d’aujourd’hui sont affichées." },
    ar: { title: "الإدارة", inert: "تعمل صفحة الإدارة عند ربط الموقع.", signedOut: "سجّل دخولك أولاً من صفحة المجلس بحساب الإدارة.", signIn: "اذهب لتسجيل الدخول",
      notAdmin: "هذه الصفحة لإدارة أزال فقط، وحسابك لا يملك صلاحية الدخول إليها.", staffGo: "افتح شاشة طلبات المطبخ", signedAs: "مسجّل باسم {email} · {role}",
      r_admin: "مدير", r_staff: "موظف فرع", r_customer: "عضو", overview: "اليوم", since: "منذ منتصف الليل، كل الفروع",
      k_new: "جديدة ومدفوعة", k_kitchen: "في المطبخ", k_ready: "جاهزة للاستلام", k_collected: "استُلمت", k_cancelled: "أُلغيت", k_unpaid: "غير مدفوعة (لا تصل إلى المطبخ)",
      sales: "مبيعات الطلبات المستلمة اليوم: {amount}", members: "أعضاء المجلس النشطون: {n}", kitchen: "شاشة طلبات المطبخ", next: "قريباً هنا: سجلّ الطلبات والعملاء، ثم تعديل النقاط، ثم صلاحيات الموظفين.",
      branch: "{branch}: {orders} طلبات اليوم، استُلم منها {collected}", signOut: "تسجيل الخروج", signingOut: "جارٍ تسجيل الخروج…", error: "تعذّر تحميل الملخص. حدّث الصفحة وحاول مرة أخرى.", truncated: "نعرض أول 1,000 طلب من طلبات اليوم." }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k] || S.en[k] || k; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s; };
  const loc = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const money = (c) => { const s = new Intl.NumberFormat(loc(), { style: "currency", currency: "CAD" }).format(Number(c || 0) / 100); return lang() === "ar" ? "⁦" + s.replace(/‏/g, "") + "⁩" : s; };
  const num = (n) => new Intl.NumberFormat(loc()).format(n);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const link = (href, text, cls) => { const a = el("a", cls || "text-link dark-link", text); a.href = href; return a; };

  let acc = null, ov = null, failed = false, seq = 0, signingOut = false;
  // Sign-out ends the session (server logout + the local session key) and drops every number on this page at once,
  // then lands on the member page, signed out. A later visit here finds no session and shows the signed-out state.
  async function signOut() {
    if (signingOut) return;
    signingOut = true; seq++; ov = null; paint();
    try { if (auth) await auth.signOut(); } catch {}
    acc = { status: "signed_out" }; paint();
    try { root.location.replace("member.html"); } catch {}
  }
  function paint() {
    const h = el("h1", "admin-title", L("title"));
    if (!adm.enabled) return rootEl.replaceChildren(h, el("p", "admin-note", L("inert")));
    if (!acc) return rootEl.replaceChildren(h, el("p", "admin-note", "…"));
    if (acc.status !== "signed_in") return rootEl.replaceChildren(h, el("p", "admin-note", L("signedOut")), link("member.html", L("signIn"), "button button-gold"));
    // T-01 / F-OWN-19: identity + sign-out on every signed-in state of this page.
    const who = el("div", "admin-who-bar");
    const out = el("button", "button admin-signout", L(signingOut ? "signingOut" : "signOut")); out.type = "button"; out.id = "adminSignOut"; out.disabled = signingOut;
    out.addEventListener("click", signOut);
    who.append(el("p", "admin-who", L("signedAs", { email: acc.email || "", role: L("r_" + acc.role) })), out);
    if (acc.role !== "admin") {
      const parts = [h, who, el("p", "admin-note", L("notAdmin"))];
      if (acc.role === "staff") parts.push(link("staff.html", L("staffGo"), "button button-gold"));
      return rootEl.replaceChildren(...parts);
    }
    const parts = [h, who];
    const sec = el("section", "admin-panel"); sec.setAttribute("aria-labelledby", "admOverview");
    const h2 = el("h2", null, L("overview")); h2.id = "admOverview"; sec.append(h2, el("p", "admin-since", L("since")));
    if (failed) sec.append(el("p", "member-history-error", L("error")));
    else if (!ov) sec.append(el("p", "admin-note", "…"));
    else {
      const grid = el("dl", "admin-kpis");
      for (const [k, v] of [["k_new", ov.newPaid], ["k_kitchen", ov.inKitchen], ["k_ready", ov.ready], ["k_collected", ov.collected], ["k_cancelled", ov.cancelled], ["k_unpaid", ov.unpaid]]) {
        const d = el("div", "admin-kpi"); d.append(el("dt", null, L(k)), el("dd", null, num(v))); grid.append(d);
      }
      sec.append(grid, el("p", "admin-line", L("sales", { amount: money(ov.salesCents) })), el("p", "admin-line", L("members", { n: num(ov.members) })));
      for (const [b, x] of Object.entries(ov.byBranch)) sec.append(el("p", "admin-line", L("branch", { branch: b, orders: num(x.orders), collected: num(x.collected) })));
      if (ov.truncated) sec.append(el("p", "admin-note", L("truncated")));
    }
    parts.push(sec, el("p", "admin-actions"));
    parts[parts.length - 1].append(link("staff.html", L("kitchen"), "button button-gold"));
    parts.push(el("p", "admin-note", L("next")));
    rootEl.replaceChildren(...parts);
  }
  async function load() {
    const my = ++seq;
    try { acc = await adm.access(); } catch (e) { acc = { status: e.code === "signed_out" ? "signed_out" : "signed_in", role: "customer", email: "" }; }
    if (my !== seq) return;
    if (acc.role !== "admin") ov = null;
    paint();
    if (acc.role === "admin") {
      let o = null, bad = false;
      try { o = await adm.overview(); } catch { bad = true; }
      if (my !== seq) return; // invalidated while waiting: discard
      ov = o; failed = bad; paint();
    }
  }
  // ChatGPT #62 review: management data never outlives the session that fetched it. On a sign-out here, a sign-out or
  // account switch in another tab (storage event on the session key), or when the page comes back into view, the
  // counts are dropped at once, in-flight answers are discarded (seq), and the role is checked again.
  function invalidate() { seq++; acc = null; ov = null; failed = false; paint(); if (adm.enabled) load(); }
  const AUTH_KEY = "azal-auth-v1";
  root.addEventListener("storage", (e) => { if (e.key === AUTH_KEY || e.key === null) invalidate(); });
  document.addEventListener("azal:auth", (e) => { if (!e.detail || e.detail.status !== "signed_in") invalidate(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && acc && acc.role === "admin") invalidate(); });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  if (adm.enabled) load(); else paint();
})(typeof window !== "undefined" ? window : globalThis);
