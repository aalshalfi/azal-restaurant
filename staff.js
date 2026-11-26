/* AZAL kitchen orders screen (Claude, ORD-REAL step 3). Staff see PAID orders for their branch by pickup time and move
   them on: Accept -> Ready -> Handed over. Handing over completes the points (member ledger, or a guest's pending claim)
   inside staff_update_order. Reads go through the existing staff RLS (orders_read_owner_staff); writes only through
   the guarded function. Inert while window.AZAL_SUPABASE is null. */
(function (root) {
  "use strict";

  const NEXT = { placed: "accept", accepted: "ready", preparing: "ready", ready: "hand_over" };
  const code = (id) => String(id || "").slice(0, 6).toUpperCase();

  function createStaff({ config, fetch: fetchFn, getToken, branch }) {
    const enabled = Boolean(config && config.url && config.anonKey && fetchFn);
    const base = enabled ? String(config.url).replace(/\/+$/, "") : "";
    branch = branch || "ottawa";
    async function call(path, { method = "GET", body } = {}) {
      const token = getToken && (await getToken());
      if (!token) throw Object.assign(new Error("signed_out"), { code: "signed_out" });
      let res;
      try { res = await fetchFn(base + path, { method, headers: { apikey: config.anonKey, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); }
      catch { throw Object.assign(new Error("network"), { code: "network" }); }
      let data = null; try { data = await res.json(); } catch {}
      if (!res.ok) { const m = String((data && data.message) || "error"); throw Object.assign(new Error(m), { code: res.status === 401 ? "signed_out" : /^[a-z_]+$/.test(m) ? m : "error" }); }
      return data;
    }
    return {
      enabled,
      async isStaff() { return (await call("/rest/v1/rpc/azal_staff_can_access", { method: "POST", body: { p_branch_slug: branch } })) === true; },
      async list() {
        const q = "select=id,pickup_slot,scheduled_for,guest_name,customer_note,fulfilment_status,total_cents,order_items(quantity,item_name_en_snapshot,item_name_fr_snapshot)" +
          "&branch_slug=eq." + encodeURIComponent(branch) + "&payment_status=eq.paid&fulfilment_status=not.in.(handed_over,cancelled)&order=pickup_slot.asc.nullslast,placed_at.asc";
        return (await call("/rest/v1/orders?" + q)) || [];
      },
      async act(orderId, action) {
        if (!Object.values(NEXT).includes(action)) throw Object.assign(new Error("bad_transition"), { code: "bad_transition" });
        return call("/rest/v1/rpc/staff_update_order", { method: "POST", body: { p_order: orderId, p_action: action } });
      }
    };
  }

  const api = { createStaff, NEXT, code };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  /* ---------- browser wiring ---------- */
  const box = document.getElementById("staffRoot");
  if (!box) return;
  const auth = root.AZALAuth;
  const st = createStaff({ config: root.AZAL_SUPABASE || {}, fetch: root.fetch && root.fetch.bind(root), getToken: async () => { try { const s = auth && (await auth.session()); return s && s.access_token; } catch { return null; } } });

  const S = {
    en: { title: "Kitchen orders", inert: "The orders screen turns on when the site is connected to the AZAL system.", signIn: "Sign in with your staff email on the Majlis page first.", signInLink: "Go to sign-in",
      notStaff: "This account is not set up as staff for this branch.", empty: "No paid orders waiting. New ones appear here by themselves.",
      accept: "Accept", ready: "Ready", hand_over: "Hand over", asap: "As soon as possible", member: "Member",
      s_placed: "New", s_accepted: "Accepted", s_preparing: "Preparing", s_ready: "Ready for pickup",
      updated: "Updated {time}", refresh: "Refresh", working: "One moment…", e_network: "Connection problem. The list will retry.", e_error: "That did not work. Refresh and try again.",
      e_bad_transition: "That order already moved on. Refreshed.", e_order_closed: "That order is already closed. Refreshed.", e_not_staff: "This account is not staff for this branch." },
    fr: { title: "Commandes cuisine", inert: "L’écran des commandes s’active quand le site est relié au système AZAL.", signIn: "Connectez-vous d’abord avec votre courriel du personnel sur la page Majlis.", signInLink: "Aller à la connexion",
      notStaff: "Ce compte n’est pas configuré comme personnel de cette succursale.", empty: "Aucune commande payée en attente. Les nouvelles apparaissent ici d’elles-mêmes.",
      accept: "Accepter", ready: "Prête", hand_over: "Remettre", asap: "Dès que possible", member: "Membre",
      s_placed: "Nouvelle", s_accepted: "Acceptée", s_preparing: "En préparation", s_ready: "Prête à emporter",
      updated: "Mis à jour à {time}", refresh: "Actualiser", working: "Un instant…", e_network: "Problème de connexion. La liste va réessayer.", e_error: "Ça n’a pas marché. Actualisez et réessayez.",
      e_bad_transition: "Cette commande a déjà avancé. Liste actualisée.", e_order_closed: "Cette commande est déjà fermée. Liste actualisée.", e_not_staff: "Ce compte ne fait pas partie du personnel de cette succursale." },
    ar: { title: "طلبات المطبخ", inert: "تعمل شاشة الطلبات عند ربط الموقع بنظام أزال.", signIn: "سجّل الدخول أولاً ببريد الموظف من صفحة المجلس.", signInLink: "اذهب لتسجيل الدخول",
      notStaff: "هذا الحساب غير مُعدّ كموظف في هذا الفرع.", empty: "لا طلبات مدفوعة بالانتظار. تظهر الطلبات الجديدة هنا تلقائياً.",
      accept: "قبول", ready: "جاهز", hand_over: "تسليم", asap: "في أقرب وقت", member: "عضو",
      s_placed: "جديد", s_accepted: "مقبول", s_preparing: "قيد التحضير", s_ready: "جاهز للاستلام",
      updated: "حُدّث {time}", refresh: "تحديث", working: "لحظة…", e_network: "مشكلة في الاتصال. ستُعاد المحاولة.", e_error: "لم ينجح ذلك. حدّث وحاول مرة أخرى.",
      e_bad_transition: "هذا الطلب تقدّم بالفعل. تم التحديث.", e_order_closed: "هذا الطلب مغلق بالفعل. تم التحديث.", e_not_staff: "هذا الحساب ليس موظفاً في هذا الفرع." },
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const locOf = () => ({ en: "en-CA", fr: "fr-CA", ar: "ar-CA-u-nu-latn" })[lang()];
  const L = (k, v) => { let s = S[lang()][k] || S.en[k] || k; for (const x in v || {}) s = s.replace("{" + x + "}", v[x]); return s; };
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tf = (d, o) => new Intl.DateTimeFormat(locOf(), Object.assign({ hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }, o)).format(d);
  const money = (c) => new Intl.NumberFormat(locOf(), { style: "currency", currency: "CAD" }).format(c / 100);

  let rows = [], state = "loading", flash = "", busyId = null, lastAt = null, timer = null;

  function paint() {
    document.title = L("title") + " · AZAL";
    const h = `<h1 class="staff-title">${esc(L("title"))}</h1>`;
    if (state === "inert") { box.innerHTML = h + `<p class="staff-note">${esc(L("inert"))}</p>`; return; }
    if (state === "signed_out") { box.innerHTML = h + `<p class="staff-note">${esc(L("signIn"))}</p><p><a class="button button-gold" href="member.html">${esc(L("signInLink"))}</a></p>`; return; }
    if (state === "not_staff") { box.innerHTML = h + `<p class="staff-note">${esc(L("notStaff"))}</p>`; return; }
    const head = h + `<div class="staff-bar"><span class="staff-updated" aria-live="polite">${lastAt ? esc(L("updated", { time: tf(lastAt, { second: "2-digit" }) })) : ""}</span><button type="button" class="text-link dark-link" id="staffRefresh">${esc(L("refresh"))}</button></div>` +
      `<p class="staff-flash" role="status">${esc(flash)}</p>`;
    if (!rows.length) { box.innerHTML = head + `<p class="staff-note">${esc(L("empty"))}</p>`; return; }
    const groups = new Map();
    for (const r of rows) { const k = r.pickup_slot || r.scheduled_for || ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    let html = head;
    for (const [slot, list] of groups) {
      html += `<section class="staff-slot"><h2>${slot ? esc(tf(new Date(slot))) : esc(L("asap"))}</h2>`;
      for (const r of list) {
        const action = NEXT[r.fulfilment_status];
        const items = (r.order_items || []).map((i) => `<li><strong>${esc(i.quantity)}×</strong> ${esc(lang() === "fr" ? i.item_name_fr_snapshot || i.item_name_en_snapshot : i.item_name_en_snapshot)}</li>`).join("");
        html += `<article class="staff-order is-${esc(r.fulfilment_status)}"><header><span class="staff-code">${esc(code(r.id))}</span><span class="staff-who">${esc(r.guest_name || L("member"))}</span><span class="staff-status">${esc(L("s_" + r.fulfilment_status))}</span></header>` +
          `<ul class="staff-items">${items}</ul>` + (r.customer_note ? `<p class="staff-note-guest">“${esc(r.customer_note)}”</p>` : "") +
          `<footer><span>${esc(money(r.total_cents))}</span>${action ? `<button type="button" class="button button-gold staff-act" data-id="${esc(r.id)}" data-action="${action}"${busyId ? " disabled" : ""}>${esc(busyId === r.id ? L("working") : L(action))}</button>` : ""}</footer></article>`;
      }
      html += `</section>`;
    }
    box.innerHTML = html;
  }

  async function load() {
    if (!st.enabled) { state = "inert"; return paint(); }
    try {
      if (state !== "ready") { if (!(await st.isStaff())) { state = "not_staff"; return paint(); } }
      rows = await st.list(); lastAt = new Date(); state = "ready";
    } catch (e) {
      if (e.code === "signed_out") state = "signed_out"; else flash = L("e_network");
    }
    paint();
  }

  box.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("button");
    if (!b) return;
    if (b.id === "staffRefresh") { flash = ""; return load(); }
    if (b.classList.contains("staff-act") && !busyId) {
      busyId = b.dataset.id; flash = ""; paint();
      try { await st.act(b.dataset.id, b.dataset.action); }
      catch (err) { flash = L("e_" + err.code) !== "e_" + err.code ? L("e_" + err.code) : L("e_error"); }
      busyId = null; await load();
    }
  });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  load();
  if (st.enabled) timer = setInterval(() => { if (!busyId && state === "ready" && !document.hidden) load(); }, 20000);
})(typeof window !== "undefined" ? window : globalThis);
