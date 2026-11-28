/* AZAL one sign-in door (Claude, ADM-1; owner F-OWN-7/10/13). After a sign-in on the member page, the SERVER-held
   role decides where they go: an administrator is sent to the management area (admin.html), branch staff to the
   kitchen orders screen (staff.html), and the customer account is hidden meanwhile. Customers stay and see nothing extra. The role comes from azal_is_admin() and the
   caller's own user_roles rows (RLS); the links only lead to pages that check the role again server-side.
   Inert while window.AZAL_SUPABASE is null. Every value is rendered with textContent. */
(function (root) {
  "use strict";
  async function roleOf({ config, fetch: fetchFn, session }) {
    if (!config || !config.url || !config.anonKey || !session || !session.access_token) return "none";
    const base = String(config.url).replace(/\/+$/, ""), uid = session.user && session.user.id;
    const h = { apikey: config.anonKey, Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" };
    const [a, r] = await Promise.all([
      fetchFn(base + "/rest/v1/rpc/azal_is_admin", { method: "POST", headers: h, body: "{}" }),
      fetchFn(base + "/rest/v1/user_roles?select=role&user_id=eq." + encodeURIComponent(uid), { headers: h })
    ]);
    if (!a.ok || !r.ok) return "customer";
    if ((await a.json()) === true) return "admin";
    const roles = (await r.json()) || [];\n    return roles.some((x) => x.role === "manager") ? "manager" : roles.some((x) => x.role === "staff") ? "staff" : "customer";
  }
  const api = { roleOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  const card = document.querySelector(".member-card");
  const cfg = root.AZAL_SUPABASE || {};
  if (!card || !cfg.url || !cfg.anonKey) return;
  const S = {
    en: { kicker: "AZAL MANAGEMENT", admin: "You are signed in as an administrator.", adminGo: "Open the management area", manager: "You are signed in as a branch manager.", managerGo: "Open branch management", kitchen: "Kitchen orders", staff: "You are signed in as branch staff.", staffGo: "Open the kitchen orders screen" },
    fr: { kicker: "GESTION AZAL", admin: "Vous êtes connecté en tant qu’administrateur.", adminGo: "Ouvrir l’espace de gestion", manager: "Vous êtes connecté comme gestionnaire de succursale.", managerGo: "Ouvrir la gestion de succursale", kitchen: "Commandes de cuisine", staff: "Vous êtes connecté en tant que personnel de succursale.", staffGo: "Ouvrir l’écran des commandes de cuisine" },
    ar: { kicker: "إدارة أزال", admin: "أنت مسجّل بصفة مدير النظام.", adminGo: "افتح صفحة الإدارة", manager: "أنت مسجّل بصفة مدير فرع.", managerGo: "افتح إدارة الفرع", kitchen: "طلبات المطبخ", staff: "أنت مسجّل بصفة موظف فرع.", staffGo: "افتح شاشة طلبات المطبخ" }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k) => S[lang()][k] || S.en[k];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const box = el("section", "role-door"); box.id = "roleDoor"; box.hidden = true; box.setAttribute("aria-label", S.en.kicker);
  card.before(box);
  let role = "none", seq = 0;
  function paint() {
    box.hidden = role !== "admin" && role !== "manager" && role !== "staff";
    if (box.hidden) { box.replaceChildren(); return; }
    box.setAttribute("aria-label", L("kicker"));
    const go = (href, text, cls) => { const a = el("a", cls, text); a.href = href; return a; };
    const acts = el("div", "role-door-actions");
    if (role === "admin") acts.append(go("admin.html", L("adminGo"), "button button-gold"), go("staff.html", L("kitchen"), "text-link"));
    else if (role === "manager") acts.append(go("admin.html", L("managerGo"), "button button-gold"));
    else acts.append(go("staff.html", L("staffGo"), "button button-gold"));
    box.replaceChildren(el("div", "section-kicker", L("kicker")), el("p", "role-door-text", L(role === "admin" ? "admin" : role === "manager" ? "manager" : "staff")), acts);
  }
  async function refresh() {
    const my = ++seq; let s = null;
    try { s = root.AZALAuth && (await root.AZALAuth.session()); } catch {}
    let r = "none"; try { r = await roleOf({ config: cfg, fetch: root.fetch.bind(root), session: s }); } catch { r = "customer"; }
    if (my !== seq) return;
    role = r; paint();
    // Owner (relayed by ChatGPT, #62 review): staff and admins never get the customer account on the post-sign-in
    // screen. The member content is hidden at once and the browser goes to their own area; each destination checks
    // the role again on the server. Customers stay here. No loop: admin.html and staff.html never send anyone back.
    if (r === "admin" || r === "manager" || r === "staff") {
      document.documentElement.classList.add("role-leaving");
      try { root.location.replace(r === "admin" || r === "manager" ? "admin.html" : "staff.html"); } catch {}
    }
  }
  document.addEventListener("azal:auth", (e) => { if (e.detail && e.detail.status === "signed_in") refresh(); else { seq++; role = "none"; paint(); } });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})(typeof window !== "undefined" ? window : globalThis);
