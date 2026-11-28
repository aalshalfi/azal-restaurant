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
          pages("/rest/v1/memberships?select=user_id,status,joined_at&order=user_id.asc"),
          pages("/rest/v1/points_ledger?select=user_id,delta_points&order=created_at.asc,id.asc")
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
        const profiles = [];
        for (let offset = 0; ; offset += 500) {
          const page = await call("/rest/v1/profiles?select=id,display_name,phone,member_number&order=created_at.desc,id.desc&limit=500&offset=" + offset, s.access_token);
          profiles.push(...(page || []));
          if (!page || page.length < 500) break;
          if (profiles.length >= 100000) throw Object.assign(new Error("result_too_large"), { code: "error" });
        }
        const profileById = new Map(profiles.map(p => [p.id, p]));
        const enriched = rows.map(o => Object.assign({}, o, { customer: profileById.get(o.user_id) || null }));
        const term = String(search || "").trim().toLocaleLowerCase();
        return enriched.filter(o => (status === "all" || o.fulfilment_status === status) &&
          (!term || [o.id, o.branch_slug, o.guest_name, o.guest_email, o.contact_phone, o.user_id, o.customer && o.customer.display_name, o.customer && o.customer.phone, o.customer && o.customer.member_number].some(v => String(v || "").toLocaleLowerCase().includes(term))));
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

  const S = {"en":{"title":"Management","inert":"The management area turns on when the site is connected.","signedOut":"Sign in first on the Majlis page with your management account.","signIn":"Go to sign in","notAdmin":"This area is for AZAL management. Your account doesn’t have access.","staffGo":"Open the kitchen orders screen","signedAs":"Signed in as {email} · {role}","r_admin":"Administrator","r_staff":"Branch staff","r_customer":"Member","overview":"Today","since":"Since midnight, all branches","k_new":"New, paid","k_kitchen":"In the kitchen","k_ready":"Ready for pickup","k_collected":"Collected","k_cancelled":"Cancelled","k_unpaid":"Unpaid (never reach the kitchen)","sales":"Collected sales today: {amount}","members":"Active Majlis members: {n}","kitchen":"Kitchen orders screen","next":"","branch":"{branch}: {orders} orders today, {collected} collected","signOut":"Sign out","signingOut":"Signing out…","error":"We couldn’t load the overview. Refresh to try again.","truncated":"Showing the first 1,000 orders of today.","directory":"Customer directory","customerSearch":"Search name, phone or member number","search":"Search","noCustomers":"No matching customers.","memberNo":"Member #","balance":"Points balance","membership":"Membership","active":"Active","suspended":"Suspended","noMembership":"No membership row","ordersTitle":"All orders","orderSearch":"Search order, branch, customer, phone or email","allStatuses":"All statuses","placed":"Received","accepted":"Accepted","preparing":"Preparing","ready":"Ready","handed_over":"Handed over","cancelled":"Cancelled","unpaid":"Unpaid","paid":"Paid","refunded":"Refunded","voided":"Voided","noOrders":"No matching orders.","view":"View details","order":"Order","customer":"Customer","branchLabel":"Branch","payment":"Payment","fulfilment":"Fulfilment","subtotal":"Subtotal","discount":"Discount","tax":"Tax","total":"Total","items":"Items","events":"Order timeline","note":"Customer note","guest":"Guest","back":"Close details","emailUnavailable":"Member email is not exposed by the current database read policies; lead-approved server access is required.","dataError":"Could not load the directory or order history.","showing":"Showing {n} of {total}"},"fr":{"title":"Gestion","inert":"L’espace de gestion s’active quand le site est connecté.","signedOut":"Connectez-vous d’abord sur la page Majlis avec votre compte de gestion.","signIn":"Aller à la connexion","notAdmin":"Cet espace est réservé à la gestion d’AZAL. Votre compte n’y a pas accès.","staffGo":"Ouvrir l’écran des commandes de cuisine","signedAs":"Connecté : {email} · {role}","r_admin":"Administrateur","r_staff":"Personnel de succursale","r_customer":"Membre","overview":"Aujourd’hui","since":"Depuis minuit, toutes les succursales","k_new":"Nouvelles, payées","k_kitchen":"En cuisine","k_ready":"Prêtes à emporter","k_collected":"Récupérées","k_cancelled":"Annulées","k_unpaid":"Non payées (n’arrivent jamais en cuisine)","sales":"Ventes récupérées aujourd’hui : {amount}","members":"Membres Majlis actifs : {n}","kitchen":"Écran des commandes de cuisine","next":"","branch":"{branch} : {orders} commandes aujourd’hui, {collected} récupérées","signOut":"Se déconnecter","signingOut":"Déconnexion…","error":"Impossible de charger l’aperçu. Actualisez pour réessayer.","truncated":"Les 1 000 premières commandes d’aujourd’hui sont affichées.","directory":"Répertoire des clients","customerSearch":"Rechercher par nom, téléphone ou numéro de membre","search":"Rechercher","noCustomers":"Aucun client correspondant.","memberNo":"Membre nº","balance":"Solde de points","membership":"Adhésion","active":"Active","suspended":"Suspendue","noMembership":"Aucune adhésion","ordersTitle":"Toutes les commandes","orderSearch":"Rechercher commande, succursale, client, téléphone ou courriel","allStatuses":"Tous les statuts","placed":"Reçue","accepted":"Acceptée","preparing":"En préparation","ready":"Prête","handed_over":"Remise","cancelled":"Annulée","unpaid":"Non payée","paid":"Payée","refunded":"Remboursée","voided":"Annulée","noOrders":"Aucune commande correspondante.","view":"Voir les détails","order":"Commande","customer":"Client","branchLabel":"Succursale","payment":"Paiement","fulfilment":"État","subtotal":"Sous-total","discount":"Rabais","tax":"Taxes","total":"Total","items":"Articles","events":"Historique","note":"Note du client","guest":"Invité","back":"Fermer les détails","emailUnavailable":"Le courriel des membres n’est pas exposé par les règles de lecture actuelles; un accès serveur approuvé par la direction est requis.","dataError":"Impossible de charger le répertoire ou l’historique.","showing":"Affichage de {n} sur {total}"},"ar":{"title":"الإدارة","inert":"تعمل صفحة الإدارة عند ربط الموقع.","signedOut":"سجّل دخولك أولاً من صفحة المجلس بحساب الإدارة.","signIn":"اذهب لتسجيل الدخول","notAdmin":"هذه الصفحة لإدارة أزال فقط، وحسابك لا يملك صلاحية الدخول إليها.","staffGo":"افتح شاشة طلبات المطبخ","signedAs":"مسجّل باسم {email} · {role}","r_admin":"مدير","r_staff":"موظف فرع","r_customer":"عضو","overview":"اليوم","since":"منذ منتصف الليل، كل الفروع","k_new":"جديدة ومدفوعة","k_kitchen":"في المطبخ","k_ready":"جاهزة للاستلام","k_collected":"استُلمت","k_cancelled":"أُلغيت","k_unpaid":"غير مدفوعة (لا تصل إلى المطبخ)","sales":"مبيعات الطلبات المستلمة اليوم: {amount}","members":"أعضاء المجلس النشطون: {n}","kitchen":"شاشة طلبات المطبخ","next":"","branch":"{branch}: {orders} طلبات اليوم، استُلم منها {collected}","signOut":"تسجيل الخروج","signingOut":"جارٍ تسجيل الخروج…","error":"تعذّر تحميل الملخص. حدّث الصفحة وحاول مرة أخرى.","truncated":"نعرض أول 1,000 طلب من طلبات اليوم.","directory":"دليل العملاء","customerSearch":"ابحث بالاسم أو الهاتف أو رقم العضوية","search":"بحث","noCustomers":"لا يوجد عملاء مطابقون.","memberNo":"رقم العضوية","balance":"رصيد النقاط","membership":"العضوية","active":"نشطة","suspended":"موقوفة","noMembership":"لا توجد عضوية","ordersTitle":"جميع الطلبات","orderSearch":"ابحث برقم الطلب أو الفرع أو العميل أو الهاتف أو البريد","allStatuses":"كل الحالات","placed":"وصل الطلب","accepted":"تم القبول","preparing":"قيد التحضير","ready":"جاهز للاستلام","handed_over":"تم التسليم","cancelled":"ملغي","unpaid":"غير مدفوع","paid":"مدفوع","refunded":"مسترد","voided":"ملغي الدفع","noOrders":"لا توجد طلبات مطابقة.","view":"عرض التفاصيل","order":"الطلب","customer":"العميل","branchLabel":"الفرع","payment":"الدفع","fulfilment":"حالة التنفيذ","subtotal":"المجموع الفرعي","discount":"الخصم","tax":"الضريبة","total":"الإجمالي","items":"الأصناف","events":"سجل الأحداث","note":"ملاحظة العميل","guest":"ضيف","back":"إغلاق التفاصيل","emailUnavailable":"بريد العضو غير متاح عبر صلاحيات القراءة الحالية؛ يحتاج إلى مسار خادمي بموافقة المدير.","dataError":"تعذّر تحميل دليل العملاء أو سجل الطلبات.","showing":"نعرض {n} من {total}"}};
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k] || S.en[k] || k; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s; };
  const loc = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const money = (c) => { const s = new Intl.NumberFormat(loc(), { style: "currency", currency: "CAD" }).format(Number(c || 0) / 100); return lang() === "ar" ? "⁦" + s.replace(/‏/g, "") + "⁩" : s; };
  const num = (n) => new Intl.NumberFormat(loc()).format(n);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const link = (href, text, cls) => { const a = el("a", cls || "text-link dark-link", text); a.href = href; return a; };

  let acc = null, ov = null, failed = false, seq = 0, signingOut = false;
  let directoryRows = [], orderRows = [], detailRow = null, workspaceError = false, customerVisible = 100, orderVisible = 100;
  // Sign-out ends the session (server logout + the local session key) and drops every number on this page at once,
  // then lands on the member page, signed out. A later visit here finds no session and shows the signed-out state.
  async function signOut() {
    if (signingOut) return;
    signingOut = true; seq++; ov = null; paint();
    try { if (auth) await auth.signOut(); } catch {}
    acc = { status: "signed_out" }; paint();
    try { root.location.replace("member.html"); } catch {}
  }
  function workspace() {
    const wrap = el("div", "admin-workspace");
    if (workspaceError) wrap.append(el("p", "member-history-error", L("dataError")));
    const customers = el("section", "admin-panel"); customers.append(el("h2", null, L("directory")));
    const cform = el("form", "admin-filter");
    const ci = el("input", "admin-search"); ci.type = "search"; ci.placeholder = L("customerSearch"); ci.setAttribute("aria-label", L("customerSearch"));
    const cb = el("button", "button button-gold", L("search")); cb.type = "submit"; cform.append(ci,cb);
    cform.addEventListener("submit", async e => { e.preventDefault(); cb.disabled=true; try { directoryRows=await adm.customers({search:ci.value}); customerVisible=100; workspaceError=false; } catch { workspaceError=true; } paint(); });
    customers.append(cform,el("p","admin-note",L("showing",{n:num(Math.min(customerVisible,directoryRows.length)),total:num(directoryRows.length)})));
    if(!directoryRows.length) customers.append(el("p","admin-note",L("noCustomers")));
    for(const p of directoryRows.slice(0,customerVisible)){
      const card=el("article","admin-record");
      card.append(el("strong",null,p.display_name||"—"),el("span","admin-record-meta",L("memberNo")+": "+(p.member_number==null?"—":num(p.member_number))),
        el("span","admin-record-meta",(p.phone||"—")+" · "+L("balance")+": "+num(p.balance||0)),
        el("span","admin-record-meta",L("membership")+": "+(p.membership?L(p.membership.status):L("noMembership"))));
      customers.append(card);
    }
    if(directoryRows.length>customerVisible){const more=el("button","button admin-detail-button",L("more"));more.type="button";more.addEventListener("click",()=>{customerVisible+=100;paint();});customers.append(more);}
    const orders=el("section","admin-panel"); orders.append(el("h2",null,L("ordersTitle")));
    const oform=el("form","admin-filter");
    const oi=el("input","admin-search"); oi.type="search"; oi.placeholder=L("orderSearch"); oi.setAttribute("aria-label",L("orderSearch"));
    const os=el("select","admin-status"); os.setAttribute("aria-label",L("allStatuses"));
    for(const [v,label] of [["all",L("allStatuses")],["placed",L("placed")],["accepted",L("accepted")],["preparing",L("preparing")],["ready",L("ready")],["handed_over",L("handed_over")],["cancelled",L("cancelled")]]){const op=el("option",null,label);op.value=v;os.append(op);}
    const ob=el("button","button button-gold",L("search")); ob.type="submit"; oform.append(oi,os,ob);
    oform.addEventListener("submit",async e=>{e.preventDefault();ob.disabled=true;try{orderRows=await adm.orders({search:oi.value,status:os.value});orderVisible=100;workspaceError=false;}catch{workspaceError=true;}paint();});
    orders.append(oform,el("p","admin-note",L("showing",{n:num(Math.min(orderVisible,orderRows.length)),total:num(orderRows.length)})));
    if(!orderRows.length) orders.append(el("p","admin-note",L("noOrders")));
    for(const o of orderRows.slice(0,orderVisible)){
      const card=el("article","admin-record");
      const who=o.guest_name||(o.customer&&o.customer.display_name)||o.user_id||L("guest");
      card.append(el("strong",null,L("order")+" "+String(o.id).slice(0,8).toUpperCase()),
        el("span","admin-record-meta",who+" · "+(o.contact_phone||(o.customer&&o.customer.phone)||o.guest_email||"")+" · "+o.branch_slug+" · "+L(o.fulfilment_status)+" / "+L(o.payment_status)),
        el("span","admin-record-meta",money(o.total_cents)+" · "+new Date(o.placed_at).toLocaleString(loc())));
      const view=el("button","button admin-detail-button",L("view"));view.type="button";view.addEventListener("click",async()=>{view.disabled=true;try{detailRow=await adm.orderDetail(o.id);workspaceError=false;}catch{workspaceError=true;}paint();});
      card.append(view);orders.append(card);
    }
    if(orderRows.length>orderVisible){const more=el("button","button admin-detail-button",L("more"));more.type="button";more.addEventListener("click",()=>{orderVisible+=100;paint();});orders.append(more);}
    if(detailRow){
      const d=el("section","admin-panel admin-order-detail");d.append(el("h2",null,L("order")+" "+String(detailRow.id).slice(0,8).toUpperCase()));
      const cust=detailRow.customer;
      for(const [k,v] of [["customer",cust?((cust.display_name||"—")+" · "+(cust.phone||"—")+" · #"+(cust.member_number||"—")):(detailRow.guest_name||L("guest")+" · "+(detailRow.guest_email||"")+" · "+(detailRow.contact_phone||""))],["branchLabel",detailRow.branch_slug],["fulfilment",L(detailRow.fulfilment_status)],["payment",L(detailRow.payment_status)],["subtotal",money(detailRow.subtotal_cents)],["discount",money(detailRow.discount_cents)],["tax",money(detailRow.tax_cents)+" ("+(Number(detailRow.tax_rate_bps||0)/100)+"%)"],["total",money(detailRow.total_cents)],["note",detailRow.customer_note||"—"]])d.append(el("p","admin-line",L(k)+": "+v));
      d.append(el("h3",null,L("items")));
      for(const it of detailRow.order_items||[]){d.append(el("p","admin-line",num(it.quantity)+" × "+it.item_name_en_snapshot+" · "+money(it.line_total_cents)));for(const op of it.order_item_options||[])d.append(el("p","admin-record-meta","— "+op.option_name_en_snapshot+" × "+num(op.quantity)+" · "+money(op.line_delta_cents)));}
      d.append(el("h3",null,L("events")));
      for(const ev of detailRow.order_events||[])d.append(el("p","admin-record-meta",new Date(ev.created_at).toLocaleString(loc())+" · "+ev.event_type+" · "+(ev.from_status||"—")+" → "+(ev.to_status||"—")+" · "+JSON.stringify(ev.details||{})));
      const close=el("button","button admin-detail-button",L("back"));close.type="button";close.addEventListener("click",()=>{detailRow=null;paint();});d.append(close);
      wrap.append(d);
    }
    customers.append(el("p","admin-note",L("emailUnavailable")));
    wrap.append(customers,orders);return wrap;
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
    parts.push(workspace());
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
      ov = o; failed = bad;
      if (!bad) { try { const data = await Promise.all([adm.customers(), adm.orders()]); if (my !== seq) return; directoryRows=data[0]; orderRows=data[1]; workspaceError=false; } catch { if (my !== seq) return; workspaceError=true; } }
      paint();
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
