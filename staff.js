/* AZAL kitchen orders screen (Claude, ORD-REAL step 3). Staff see PAID orders for their branch by pickup time and move
   them on: Accept -> Ready -> Handed over. Handing over completes the points (member ledger, or a guest's pending claim)
   inside staff_update_order. Reads go through the existing staff RLS (orders_read_owner_staff); writes only through
   the guarded function. Inert while window.AZAL_SUPABASE is null. */
(function (root) {
  "use strict";

  const NEXT = { placed: "accept", accepted: "ready", preparing: "ready", ready: "hand_over" };
  const code = (id) => String(id || "").slice(0, 6).toUpperCase();
  const Sig = root.AzalSigil || (typeof require === "function" ? require("./sigil.js") : null);
  // V8: the spoken sigil leads the ticket; all three words are shown because the guest may say it in any language.
  function sigilHtml(id, clash, esc, note) {
    const s = Sig && Sig.sigil(id);
    if (!s) return "";
    return `<span class="staff-sigil" aria-label="${esc(s.word("en") + " " + s.num)}">${esc(s.icon + " " + s.num)}</span><span class="staff-sigil-words">${esc(["en", "fr", "ar"].map(s.word).join(" · "))}</span>` +
      (clash ? `<span class="staff-clash">${esc(note)}</span>` : "");
  }

  function createStaff({ config, fetch: fetchFn, getToken, branch }) {
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    branch = branch || "ottawa";
    let allowedBranches = [];
    async function call(path, { method = "GET", body } = {}) {
      const token = getToken && (await getToken());
      if (!token) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
      let res;
      try { res = await fetchFn(base + path, { method, headers: { apikey: config.anonKey, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      let data = null; try { data = await res.json(); } catch {}
      if (!res.ok) { const m = String((data && data.message) || "error"); throw Object.assign(new Error(m), { code: res.status === 401 ? "signed_out" : /^[a-z_]+$/.test(m) ? m : "error", status: res.status }); }
      return data;
    }
    return {
      enabled,
      async branches() { const list = await call("/rest/v1/rpc/azal_staff_my_branches", { method: "POST", body: {} }); allowedBranches = Array.isArray(list) ? list : []; return allowedBranches.slice(); },
      setBranch(next) { if (!allowedBranches.includes(next)) throw Object.assign(new Error("bad_branch"), { code: "bad_branch" }); branch = next; return branch; },
      currentBranch() { return branch; },
      async isStaff() { return (await call("/rest/v1/rpc/azal_staff_can_access", { method: "POST", body: { p_branch_slug: branch } })) === true; },
      async todaySummary() {
        return call("/rest/v1/rpc/azal_staff_today_summary", { method: "POST", body: { p_branch_slug: branch } });
      },
      async history() {
        const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
        const parts = (date) => Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
        const now = parts(new Date());
        const today = now.year + "-" + now.month + "-" + now.day;
        const nextDate = new Date(Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day) + 1)).toISOString().slice(0, 10);
        const midnight = (day) => {
          const naive = Date.parse(day + "T00:00:00Z");
          const wallParts = parts(new Date(naive + 12 * 60 * 60 * 1000));
          const wall = Date.UTC(Number(wallParts.year), Number(wallParts.month) - 1, Number(wallParts.day), Number(wallParts.hour), Number(wallParts.minute), Number(wallParts.second));
          return new Date(naive - (wall - (naive + 12 * 60 * 60 * 1000))).toISOString();
        };
        const start = midnight(today), end = midnight(nextDate);
        const q = "select=id,placed_at,fulfilment_status,order_items(quantity,item_name_en_snapshot,item_name_fr_snapshot)" +
          "&branch_slug=eq." + encodeURIComponent(branch) + "&payment_status=in.(paid,refunded)" +
          "&fulfilment_status=in.(handed_over,cancelled)&placed_at=gte." + encodeURIComponent(start) +
          "&placed_at=lt." + encodeURIComponent(end) + "&order=placed_at.desc&limit=100";
        return (await call("/rest/v1/orders?" + q)) || [];
      },
      async list() {
        // T-02: contact_phone (0010) so the kitchen can call; one fallback for a server without 0010 (400, unknown column).
        const q = (extra) => "select=id,pickup_slot,scheduled_for,guest_name,customer_note,fulfilment_status,total_cents" + extra + ",order_items(quantity,item_name_en_snapshot,item_name_fr_snapshot)" +
          "&branch_slug=eq." + encodeURIComponent(branch) + "&payment_status=eq.paid&fulfilment_status=not.in.(handed_over,cancelled)&order=pickup_slot.asc.nullslast,placed_at.asc";
        try { return (await call("/rest/v1/orders?" + q(",contact_phone"))) || []; }
        catch (e) { if (e.status !== 400) throw e; return (await call("/rest/v1/orders?" + q(""))) || []; }
      },
      async act(orderId, action) {
        if (!Object.values(NEXT).includes(action)) throw Object.assign(new Error("bad_transition"), { code: "bad_transition" });
        return call("/rest/v1/rpc/staff_update_order", { method: "POST", body: { p_order: orderId, p_action: action } });
      }
    };
  }

  const api = { createStaff, NEXT, code, sigilHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const box = document.getElementById("staffRoot");
  if (!box) return;
  const auth = root.AZALAuth;
  const st = createStaff({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root), getToken: async () => { try { const s = auth && (await auth.session()); return s && s.access_token; } catch { return null; } } });

  const S = {
    en: { title:"Kitchen orders", inert:"The orders screen turns on when the site is connected to the AZAL system.", signIn:"Sign in with your staff email on the Majlis page first.", signInLink:"Go to sign-in", notStaff:"This account is not set up as staff for this branch.", empty:"No paid orders waiting. New ones appear here by themselves.", accept:"Accept", ready:"Ready", hand_over:"Hand over", asap:"As soon as possible", member:"Member", clash:"Same sigil as another order: check the code", s_placed:"New", s_accepted:"Accepted", s_preparing:"Preparing", s_ready:"Ready for pickup", updated:"Updated {time}", refresh:"Refresh", working:"One moment…", e_network:"Connection problem. The list will retry.", e_error:"That did not work. Refresh and try again.", e_bad_transition:"That order already moved on. Refreshed.", e_order_closed:"That order is already closed. Refreshed.", e_not_staff:"This account is not staff for this branch.", signedAs:"Signed in as {email}", call:"Call", branch:"Branch", signOut:"Sign out", signingOut:"Signing out…", queue:"Queue", history:"History", scheduled:"Scheduled", stageAll:"All", stageNew:"New", stagePreparing:"Preparing", stageReady:"Ready", summary:"Today's summary", summaryUnavailable:"Today's summary is not available yet. It will appear after the reporting gate is completed.", copySummary:"Copy summary", copied:"Summary copied. Share it manually.", copyFailed:"Could not copy the summary. You can select and copy the text.", emptyHistory:"No completed or cancelled orders today.", historyOrders:"Today’s completed and cancelled orders", historyError:"Today’s order history could not be loaded. Refresh and try again.", historyLoading:"Loading today’s order history…", s_handed_over:"Handed over", s_cancelled:"Cancelled", ordersCount:"Orders", netCollectedSales:"Net collected sales", collectedCount:"Collected", cancelledCount:"Cancelled", placedCount:"New", acceptedCount:"Accepted", preparingCount:"Preparing", readyCount:"Ready" },
    fr: { title:"Commandes cuisine", inert:"L’écran des commandes s’active quand le site est relié au système AZAL.", signIn:"Connectez-vous d’abord avec votre courriel du personnel sur la page Majlis.", signInLink:"Aller à la connexion", notStaff:"Ce compte n’est pas configuré comme personnel de cette succursale.", empty:"Aucune commande payée en attente. Les nouvelles apparaissent ici d’elles-mêmes.", accept:"Accepter", ready:"Prête", hand_over:"Remettre", asap:"Dès que possible", member:"Membre", clash:"Même signe qu’une autre commande : vérifiez le code", s_placed:"Nouvelle", s_accepted:"Acceptée", s_preparing:"En préparation", s_ready:"Prête à emporter", updated:"Mis à jour à {time}", refresh:"Actualiser", working:"Un instant…", e_network:"Problème de connexion. La liste va réessayer.", e_error:"Ça n’a pas marché. Actualisez et réessayez.", e_bad_transition:"Cette commande a déjà avancé. Liste actualisée.", e_order_closed:"Cette commande est déjà fermée. Liste actualisée.", e_not_staff:"Ce compte ne fait pas partie du personnel de cette succursale.", signedAs:"Connecté : {email}", call:"Appeler", branch:"Succursale", signOut:"Se déconnecter", signingOut:"Déconnexion…", queue:"File", history:"Historique", scheduled:"Planifiées", stageAll:"Toutes", stageNew:"Nouvelles", stagePreparing:"En préparation", stageReady:"Prêtes", summary:"Résumé du jour", summaryUnavailable:"Le résumé du jour n’est pas encore disponible. Il apparaîtra après la validation des rapports.", copySummary:"Copier le résumé", copied:"Résumé copié. Partagez-le manuellement.", copyFailed:"Impossible de copier le résumé. Vous pouvez sélectionner et copier le texte.", emptyHistory:"Aucune commande terminée ou annulée aujourd’hui.", historyOrders:"Commandes terminées et annulées aujourd’hui", historyError:"Impossible de charger l’historique du jour. Actualisez et réessayez.", historyLoading:"Chargement de l’historique du jour…", s_handed_over:"Remise", s_cancelled:"Annulée", ordersCount:"Commandes", netCollectedSales:"Ventes nettes encaissées", collectedCount:"Récupérées", cancelledCount:"Annulées", placedCount:"Nouvelles", acceptedCount:"Acceptées", preparingCount:"En préparation", readyCount:"Prêtes" },
    ar: { title:"طلبات المطبخ", inert:"تعمل شاشة الطلبات حين يُربط الموقع بنظام أزال.", signIn:"سجّل الدخول أولاً ببريد الموظف من صفحة المجلس.", signInLink:"اذهب لتسجيل الدخول", notStaff:"هذا الحساب ليس حساب موظف في هذا الفرع.", empty:"لا طلبات مدفوعة تنتظر. تظهر الطلبات الجديدة هنا وحدها.", accept:"قبول", ready:"جاهز", hand_over:"تسليم", asap:"في أقرب وقت", member:"عضو", clash:"الرمز نفسه لطلب آخر: طابِق الرمز المكتوب تحته", s_placed:"جديد", s_accepted:"مقبول", s_preparing:"قيد التحضير", s_ready:"جاهز للاستلام", updated:"حُدّث {time}", refresh:"تحديث", working:"لحظة…", e_network:"مشكلة في الاتصال. ستُعاد المحاولة.", e_error:"لم تنجح العملية. حدّث الصفحة وحاول مرة أخرى.", e_bad_transition:"هذا الطلب تقدّم بالفعل. تم التحديث.", e_order_closed:"هذا الطلب مغلق بالفعل. تم التحديث.", e_not_staff:"هذا الحساب ليس موظفاً في هذا الفرع.", signedAs:"مسجّل باسم {email}", call:"اتصل بـ", branch:"الفرع", signOut:"تسجيل الخروج", signingOut:"جارٍ تسجيل الخروج…", queue:"قائمة الطلبات", history:"السجل", scheduled:"المجدولة", stageAll:"الكل", stageNew:"جديدة", stagePreparing:"قيد التحضير", stageReady:"جاهزة", summary:"ملخص اليوم", summaryUnavailable:"ملخص اليوم غير متاح بعد. سيظهر بعد اجتياز بوابة التقارير.", copySummary:"نسخ الملخص", copied:"تم نسخ الملخص. أرسله يدوياً.", copyFailed:"تعذّر نسخ الملخص. يمكنك تحديد النص ونسخه.", emptyHistory:"لا توجد طلبات مكتملة أو ملغاة اليوم.", historyOrders:"طلبات اليوم المكتملة والملغاة", historyError:"تعذّر تحميل سجل طلبات اليوم. حدّث الصفحة وحاول مجدداً.", historyLoading:"جارٍ تحميل سجل طلبات اليوم…", s_handed_over:"تم التسليم", s_cancelled:"ملغي", ordersCount:"الطلبات", netCollectedSales:"صافي المبيعات المحصّلة", collectedCount:"المستلمة", cancelledCount:"الملغاة", placedCount:"جديدة", acceptedCount:"مقبولة", preparingCount:"قيد التحضير", readyCount:"جاهزة" }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const locOf = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const L = (k, v) => { let s = S[lang()][k] || S.en[k] || k; for (const x in v || {}) s = s.replace("{" + x + "}", v[x]); return s; };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tf = (d, o) => new Intl.DateTimeFormat(locOf(), Object.assign({ hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }, o)).format(d);
  // Same bidi rule as script.js (F-WALK-3): in Arabic every price is a left-to-right isolate.
  const money = (c) => { const s = new Intl.NumberFormat(locOf(), { style: "currency", currency: "CAD" }).format(c / 100); return lang() === "ar" ? "\u2066" + s.replace(/\u200f/g, "") + "\u2069" : s; };

  let rows = [], state = "loading", flash = "", busyId = null, lastAt = null, timer = null, email = "", signingOut = false, gen = 0, branchOptions = [];
  let today = null, historyRows = [], historyError = "", historyLoading = false, historyPromise = null, historyBranch = null, activeView = "queue", stageFilter = "all";
  const whoBar = () => '<details class="staff-profile"><summary>' + esc(L("signedAs", { email })) + '</summary><button type="button" class="button staff-signout" id="staffSignOut"' + (signingOut ? " disabled" : "") + '>' + esc(L(signingOut ? "signingOut" : "signOut")) + '</button></details>';

  function paint() {
    document.title = L("title") + " · AZAL";
    const h = '<h1 class="staff-title">' + esc(L("title")) + '</h1>';
    if (state === "inert") { box.innerHTML = h + '<p class="staff-note">' + esc(L("inert")) + '</p>'; return; }
    if (state === "signed_out") { box.innerHTML = h + '<p class="staff-note">' + esc(L("signIn")) + '</p><p><a class="button button-gold" href="member.html">' + esc(L("signInLink")) + '</a></p>'; return; }
    if (state === "not_staff") { box.innerHTML = h + whoBar() + '<p class="staff-note">' + esc(L("notStaff")) + '</p>'; return; }
    const branchPicker = branchOptions.length > 1 ? '<label class="staff-branch-picker"><span>' + esc(L("branch")) + '</span><select id="staffBranch">' + branchOptions.map(b => '<option value="' + esc(b) + '"' + (b === st.currentBranch() ? " selected" : "") + '>' + esc(b) + '</option>').join("") + '</select></label>' : "";
    const head = h + whoBar() + branchPicker + '<div class="staff-bar"><span class="staff-updated" aria-live="polite">' + (lastAt ? esc(L("updated", { time: tf(lastAt, { second: "2-digit" }) })) : "") + '</span><button type="button" class="text-link dark-link" id="staffRefresh">' + esc(L("refresh")) + '</button></div><p class="staff-flash" role="status">' + esc(flash) + '</p>';
    const scheduledRows = rows.filter(r => r.scheduled_for && new Date(r.scheduled_for).getTime() > Date.now());
    const queueRows = rows.filter(r => !scheduledRows.includes(r));
    if (!["queue","history","scheduled"].includes(activeView) || (activeView === "scheduled" && !scheduledRows.length)) activeView = "queue";
    const nav = '<nav class="staff-shell-nav" aria-label="' + esc(L("title")) + '">' +
      '<a href="#queue" data-staff-view="queue"' + (activeView === "queue" ? ' aria-current="page"' : "") + '>' + esc(L("queue")) + '</a>' +
      (scheduledRows.length ? '<a href="#scheduled" data-staff-view="scheduled"' + (activeView === "scheduled" ? ' aria-current="page"' : "") + '>' + esc(L("scheduled")) + '<span class="staff-nav-count">' + scheduledRows.length + '</span></a>' : "") +
      '<a href="#history" data-staff-view="history"' + (activeView === "history" ? ' aria-current="page"' : "") + '>' + esc(L("history")) + '</a></nav>';
    const clashes = Sig ? Sig.collisions(rows.map(r => r.id)) : new Set();
    const ticket = (r) => {
      const action = NEXT[r.fulfilment_status];
      const items = (r.order_items || []).map(i => '<li><strong>' + esc(i.quantity) + '×</strong> ' + esc(lang() === "fr" ? i.item_name_fr_snapshot || i.item_name_en_snapshot : i.item_name_en_snapshot) + '</li>').join("");
      const clash = clashes.has(r.id);
      return '<article class="staff-order is-' + esc(r.fulfilment_status) + (clash ? " is-clash" : "") + '"><header>' + sigilHtml(r.id, clash, esc, L("clash")) + '<span class="staff-code">' + esc(code(r.id)) + '</span><span class="staff-who">' + esc(r.guest_name || L("member")) + '</span>' +
        (r.contact_phone ? '<a class="staff-phone" dir="ltr" href="tel:' + esc(r.contact_phone) + '" aria-label="' + esc(L("call")) + ' ' + esc(r.contact_phone) + '">' + esc(r.contact_phone) + '</a>' : "") +
        '<span class="staff-status">' + esc(L("s_" + r.fulfilment_status)) + '</span></header><ul class="staff-items">' + items + '</ul>' +
        (r.customer_note ? '<p class="staff-note-guest">“' + esc(r.customer_note) + '”</p>' : "") +
        '<footer><span>' + esc(money(r.total_cents)) + '</span>' +
        (action ? '<button type="button" class="button button-gold staff-act" data-id="' + esc(r.id) + '" data-action="' + action + '"' + (busyId ? " disabled" : "") + '>' + esc(busyId === r.id ? L("working") : L(action)) + '</button>' : "") + '</footer></article>';
    };
    const renderOrders = (list) => {
      if (!list.length) return '<p class="staff-note">' + esc(L("empty")) + '</p>';
      const groups = new Map();
      for (const r of list) { const k = r.pickup_slot || r.scheduled_for || ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
      let html = "";
      for (const [slot, group] of groups) html += '<section class="staff-slot"><h2>' + (slot ? esc(tf(new Date(slot))) : esc(L("asap"))) + '</h2>' + group.map(ticket).join("") + '</section>';
      return html;
    };
    const counts = {
      all: queueRows.length,
      new: queueRows.filter(r => ["placed","accepted"].includes(r.fulfilment_status)).length,
      preparing: queueRows.filter(r => r.fulfilment_status === "preparing").length,
      ready: queueRows.filter(r => r.fulfilment_status === "ready").length
    };
    const stages = [["all","stageAll"],["new","stageNew"],["preparing","stagePreparing"],["ready","stageReady"]];
    const chips = '<div class="staff-stage-chips" role="group" aria-label="' + esc(L("queue")) + '">' + stages.map(([key,label]) =>
      '<button type="button" class="staff-stage-chip" data-stage="' + key + '" aria-pressed="' + (stageFilter === key) + '">' + esc(L(label)) + '<span>' + counts[key] + '</span></button>').join("") + '</div>';
    const filtered = queueRows.filter(r => stageFilter === "all" || (stageFilter === "new" ? ["placed","accepted"].includes(r.fulfilment_status) : r.fulfilment_status === stageFilter));
    const queue = '<section class="staff-shell-screen" id="staffScreen-queue"' + (activeView === "queue" ? "" : " hidden") + '>' + chips + renderOrders(filtered) + '</section>';
    const scheduled = scheduledRows.length ? '<section class="staff-shell-screen" id="staffScreen-scheduled"' + (activeView === "scheduled" ? "" : " hidden") + '>' + renderOrders(scheduledRows) + '</section>' : "";
    const summary = today;
    const summaryText = summary ? ["AZAL · " + (summary.local_date || ""), L("netCollectedSales") + ": " + money(summary.net_collected_cents), L("ordersCount") + ": " + summary.order_count, L("placedCount") + ": " + summary.placed_count, L("acceptedCount") + ": " + summary.accepted_count, L("preparingCount") + ": " + summary.preparing_count, L("readyCount") + ": " + summary.ready_count, L("collectedCount") + ": " + summary.collected_count, L("cancelledCount") + ": " + summary.cancelled_count].join("\n") : "";
    const historyCards = historyRows.map(r => {
      const items = (r.order_items || []).map(i => '<li><strong>' + esc(i.quantity) + '×</strong> ' + esc(lang() === "fr" ? i.item_name_fr_snapshot || i.item_name_en_snapshot : i.item_name_en_snapshot) + '</li>').join("");
      return '<article class="staff-history-order"><header><span class="staff-code">' + esc(code(r.id)) + '</span><span class="staff-status">' + esc(L("s_" + r.fulfilment_status)) + '</span><time>' + esc(tf(new Date(r.placed_at))) + '</time></header><ul class="staff-items">' + items + '</ul></article>';
    }).join("");
    const historyScreen = '<section class="staff-shell-screen staff-history-screen" id="staffScreen-history"' + (activeView === "history" ? "" : " hidden") + '><section class="staff-summary-panel"><h2>' + esc(L("summary")) + '</h2>' +
      (summary ? '<dl class="staff-summary-grid"><div><dt>' + esc(L("netCollectedSales")) + '</dt><dd>' + esc(money(summary.net_collected_cents)) + '</dd></div>' +
        '<div><dt>' + esc(L("ordersCount")) + '</dt><dd>' + esc(summary.order_count) + '</dd></div>' +
        '<div><dt>' + esc(L("placedCount")) + '</dt><dd>' + esc(summary.placed_count) + '</dd></div>' +
        '<div><dt>' + esc(L("acceptedCount")) + '</dt><dd>' + esc(summary.accepted_count) + '</dd></div>' +
        '<div><dt>' + esc(L("preparingCount")) + '</dt><dd>' + esc(summary.preparing_count) + '</dd></div>' +
        '<div><dt>' + esc(L("readyCount")) + '</dt><dd>' + esc(summary.ready_count) + '</dd></div>' +
        '<div><dt>' + esc(L("collectedCount")) + '</dt><dd>' + esc(summary.collected_count) + '</dd></div>' +
        '<div><dt>' + esc(L("cancelledCount")) + '</dt><dd>' + esc(summary.cancelled_count) + '</dd></div></dl>' +
        '<button type="button" class="button button-gold" id="staffCopySummary">' + esc(L("copySummary")) + '</button><textarea class="staff-summary-copy" id="staffSummaryText" readonly aria-label="' + esc(L("summary")) + '">' + esc(summaryText) + '</textarea>' :
        '<p class="staff-note">' + esc(L("summaryUnavailable")) + '</p>') + '</section>' +
      '<section class="staff-history-list"><h2>' + esc(L("historyOrders")) + '</h2>' +
        (historyLoading ? '<p class="staff-note">' + esc(L("historyLoading")) + '</p>' : historyError ? '<p class="staff-note">' + esc(L("historyError")) + '</p>' : historyCards || '<p class="staff-note">' + esc(L("emptyHistory")) + '</p>') +
      '</section></section>';
    box.innerHTML = '<div class="staff-shell-head">' + head + '</div>' + nav + '<div class="staff-shell-content">' + queue + scheduled + historyScreen + '</div>';
  }
  async function load() {
    if (!st.enabled) { state = "inert"; return paint(); }
    if (signingOut) return;
    // ChatGPT #67 review: every await is followed by a generation check, so a load still in flight when Sign out is
    // pressed (a 20 s refresh or a manual one) can never repaint the queue afterwards.
    const my = ++gen;
    const stale = () => my !== gen || signingOut;
    if (activeView === "history") { historyLoading = true; historyError = ""; paint(); }
    try { const s = auth && (await auth.session()); if (stale()) return; email = (s && s.user && s.user.email) || ""; if (!s) { state = "signed_out"; rows = []; return paint(); } } catch {}
    try {
      if (!branchOptions.length) { branchOptions = await st.branches(); if (stale()) return; if (!branchOptions.length) { state = "not_staff"; return paint(); } st.setBranch(branchOptions[0]); }
      if (state !== "ready") { const ok = await st.isStaff(); if (stale()) return; if (!ok) { state = "not_staff"; return paint(); } }
      const r = await st.list(); if (stale()) return;
      let summary = today, past = historyRows, historyFailed = false;
      if (activeView === "history") {
        const [summaryResult, historyResult] = await Promise.allSettled([st.todaySummary(), st.history()]);
        if (stale()) return;
        summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
        past = historyResult.status === "fulfilled" ? historyResult.value : [];
        historyFailed = historyResult.status !== "fulfilled";
      }
      if (stale()) return;
      rows = r; today = summary; historyRows = past; historyError = historyFailed ? "load_failed" : ""; historyLoading = false; lastAt = new Date(); state = "ready";
    } catch (e) {
      if (stale()) return;
      if (e.code === "signed_out") state = "signed_out"; else flash = L("e_network");
    }
    paint();
  }

  box.addEventListener("change", async (e) => {
    if (e.target && e.target.id === "staffBranch" && branchOptions.includes(e.target.value)) {
      try { st.setBranch(e.target.value); rows=[]; today=null; historyRows=[]; historyError=""; state="loading"; flash=""; paint(); await load(); } catch { flash=L("e_error"); paint(); }
    }
  });
  async function loadHistory() {
    if (!st.enabled || signingOut || state !== "ready") return;
    const requestBranch = st.currentBranch();
    if (historyPromise && historyBranch === requestBranch) return historyPromise;
    const my = ++gen, stale = () => my !== gen || signingOut;
    historyLoading = true; historyError = ""; paint();
    const request = (async () => {
      const [summaryResult, historyResult] = await Promise.allSettled([st.todaySummary(), st.history()]);
      if (stale()) return;
      today = summaryResult.status === "fulfilled" ? summaryResult.value : null;
      historyRows = historyResult.status === "fulfilled" ? historyResult.value : [];
      historyError = historyResult.status === "fulfilled" ? "" : "load_failed";
      historyLoading = false; paint();
    })();
    historyPromise = request; historyBranch = requestBranch;
    try { await request; } finally {
      if (historyPromise === request) { historyPromise = null; historyBranch = null; }
    }
  }
  box.addEventListener("click", async (e) => {
    const nav = e.target.closest && e.target.closest("a[data-staff-view]");
    if (nav) {
      e.preventDefault();
      activeView = nav.dataset.staffView;
      if (location.hash !== nav.getAttribute("href")) history.pushState(null,"",nav.getAttribute("href"));
      paint();
      if (activeView === "history") await loadHistory();
      return;
    }
    const stage = e.target.closest && e.target.closest("button[data-stage]");
    if (stage) { stageFilter = stage.dataset.stage; paint(); return; }
    const b = e.target.closest && e.target.closest("button");
    if (!b) return;
    if (b.id === "staffCopySummary") {
      const value = document.getElementById("staffSummaryText")?.value || "";
      try { await navigator.clipboard.writeText(value); flash = L("copied"); }
      catch { flash = L("copyFailed"); }
      paint(); return;
    }
    if (b.id === "staffRefresh") { flash = ""; return load(); }
    if (b.id === "staffSignOut") {
      if (signingOut) return;
      signingOut = true; gen++; clearInterval(timer); timer = null; rows = []; branchOptions = []; paint(); // the queue disappears at once; in-flight loads are void
      try { if (auth) await auth.signOut(); } catch {}
      state = "signed_out"; paint();
      try { root.location.replace("member.html"); } catch {}
      return;
    }
    if (b.classList.contains("staff-act") && !busyId) {
      busyId = b.dataset.id; flash = ""; paint();
      try { await st.act(b.dataset.id, b.dataset.action); }
      catch (err) { flash = L("e_" + err.code) !== "e_" + err.code ? L("e_" + err.code) : L("e_error"); }
      busyId = null; await load();
    }
  });
  function routeFromHash() {
    const view = location.hash.slice(1).split("/")[0];
    if (["queue","history","scheduled"].includes(view)) activeView = view;
    if (activeView === "scheduled" && !rows.some(r => r.scheduled_for && new Date(r.scheduled_for).getTime() > Date.now())) activeView = "queue";
    paint();
    if (activeView === "history" && state === "ready") loadHistory();
  }
  root.addEventListener("hashchange", routeFromHash);
  root.addEventListener("popstate", routeFromHash);
  if (["queue","history","scheduled"].includes(location.hash.slice(1))) activeView = location.hash.slice(1);
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  load();
  if (st.enabled) timer = setInterval(() => { if (!busyId && state === "ready" && activeView === "queue" && !document.hidden) load(); }, 20000);
})(typeof window !== "undefined" ? window : globalThis);
