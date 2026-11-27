/* AZAL "Sufra share card" (Claude, creative sprint V7). Scope (revised after ChatGPT's review): a DRAFT of the tray
   from the cart, before ordering, so it carries no pickup time; the card says "not ordered yet". One tap at the end of the preview turns the tray into a clean picture the
   guest can send to the family group with the phone's own share sheet ("here's what I'm getting, add anything?").
   Drawn on a <canvas> in the browser from the cart and the sample menu only. Nothing is uploaded or sent anywhere
   by us: the image goes only where the guest chooses to share it. Falls back to a download. EN/FR/AR. */
(function (root) {
  "use strict";
  const W = 1080, H = 1350, MAX_LINES = 9;
  // Pure: the text lines of the card for a cart Map(id -> qty).
  function cardLines(cartEntries, productsById, lang) {
    const out = [];
    for (const [id, q] of cartEntries) {
      const p = productsById(Number(id));
      if (p && q > 0) out.push({ qty: Number(q), name: p.name });
    }
    return { shown: out.slice(0, MAX_LINES), more: Math.max(0, out.length - MAX_LINES), count: out.reduce((a, l) => a + l.qty, 0) };
  }
  // Long dish names wrap onto a second line instead of being squeezed by fillText's maxWidth (ChatGPT, #44 review).
  // measure(text) -> width in px. Returns at most 2 lines; a single word wider than maxW stays whole on its line.
  function wrapName(name, maxW, measure) {
    if (measure(name) <= maxW) return [name];
    const words = String(name).split(/\s+/); let a = "";
    for (let i = 0; i < words.length; i++) {
      const t = a ? a + " " + words[i] : words[i];
      if (a && measure(t) > maxW) return [a, words.slice(i).join(" ")];
      a = t;
    }
    return [a];
  }
  // v2 "openable tray" (owner field test 21:21: the recipient got a picture only). The tray travels in the URL FRAGMENT
  // (#tray=v1.1x2.6x1), so it never reaches any server or log; nothing is stored. Strict allow-list parse.
  const TRAY_MAX_LEN = 200, TRAY_MAX_LINES = 12, TRAY_MAX_QTY = 20;
  function encodeTray(entries) {
    const parts = [];
    for (const [id, q] of entries) { const i = Number(id), n = Math.min(TRAY_MAX_QTY, Number(q)); if (Number.isInteger(i) && i > 0 && Number.isInteger(n) && n > 0) parts.push(i + "x" + n); }
    return parts.length ? "v1." + parts.slice(0, TRAY_MAX_LINES).join(".") : "";
  }
  // -> { ok:false } for anything malformed, or { ok:true, lines:[{id,qty}] (on the menu), retired:n (ids not on the menu) }
  function parseTray(hash, isKnown) {
    const m = /^#tray=(.*)$/.exec(String(hash || ""));
    if (!m) return null;
    const raw = m[1];
    if (raw.length > TRAY_MAX_LEN || !/^v1(\.\d{1,4}x\d{1,2})+$/.test(raw)) return { ok: false };
    const segs = raw.split(".").slice(1);
    if (segs.length > TRAY_MAX_LINES) return { ok: false };
    const qty = new Map(); let retired = 0;
    for (const seg of segs) {
      const [id, q] = seg.split("x").map(Number);
      if (q < 1 || q > TRAY_MAX_QTY) return { ok: false };
      if (!isKnown(id)) { retired++; continue; }
      qty.set(id, Math.min(TRAY_MAX_QTY, (qty.get(id) || 0) + q));
    }
    return { ok: true, lines: [...qty].map(([id, q]) => ({ id, qty: q })), retired };
  }
  const api = { cardLines, wrapName, encodeTray, parseTray, W, H, MAX_LINES };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // Placement (lead ruling 21:03, Claude's bonus target): the live checkout is a preview that ends in "nothing was sent".
  // The share button lives in that preview result, so the dead end becomes the payoff: the guest leaves with the tray picture.
  const msgBox = document.getElementById("checkoutMessage");
  if (!msgBox || typeof cart === "undefined") return;
  const S = {
    en: { btn: "Share this tray", title: "Our sufra from AZAL", sub: "Draft tray, not ordered yet · add anything?", more: "+{n} more", items: "{n} items", note: "Example menu and prices · preview", made: "Picture made", fail: "Couldn’t make the picture. Try again.", open: "Open our tray: {link}", shared: "A tray shared with you", addAll: "Add to my order", notNow: "Not now", addedAll: "Added to your order.", retired: "{n} dish(es) from this tray are no longer on the menu.", invalid: "This tray link isn’t valid.", trayNote: "Example menu and prices · adding it orders nothing" },
    fr: { btn: "Partager ce plateau", title: "Notre sufra chez AZAL", sub: "Plateau en brouillon, pas encore commandé · on ajoute quelque chose ?", more: "+{n} de plus", items: "{n} articles", note: "Menu et prix d’exemple · aperçu", made: "Image créée", fail: "Impossible de créer l’image. Réessayez.", open: "Ouvrir notre plateau\u00a0: {link}", shared: "Un plateau partagé avec vous", addAll: "Ajouter à ma commande", notNow: "Pas maintenant", addedAll: "Ajouté à votre commande.", retired: "{n} plat(s) de ce plateau ne sont plus au menu.", invalid: "Ce lien de plateau n’est pas valide.", trayNote: "Menu et prix d’exemple · l’ajouter ne commande rien" },
    ar: { btn: "شارك هذه السفرة", title: "سفرتنا من أزال", sub: "سفرة لم تُطلب بعد · هل نضيف شيئاً؟", more: "+{n} أخرى", items: "{n} أصناف", note: "الأطباق والأسعار للعرض فقط · معاينة", made: "صورتك جاهزة", fail: "تعذّر إنشاء الصورة. حاول مرة أخرى.", open: "افتح سفرتنا: {link}", shared: "سفرة أُرسلت إليك", addAll: "أضفها إلى طلبي", notNow: "ليس الآن", addedAll: "أُضيفت إلى طلبك.", retired: "{n} من أطباق هذه السفرة لم تعد في القائمة.", invalid: "رابط السفرة هذا غير صالح.", trayNote: "الأطباق والأسعار للعرض فقط · إضافتها لا تطلب شيئاً" }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k]; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s; };
  const byId = (id) => { try { const p = products.find((x) => x.id === id); return p ? (typeof localizedProduct === "function" ? localizedProduct(p) : p) : null; } catch { return null; } };

  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "button share-tray"; btn.id = "shareTray";
  const status = document.createElement("p"); status.className = "share-status"; status.setAttribute("role", "status");
  msgBox.after(btn, status);
  // The preview clears the cart, so the tray is copied on the way in (capture phase runs before script.js's handler).
  let tray = [];
  document.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest("#placeDemoOrder")) tray = [...cart.entries()].filter(([, q]) => q > 0); }, true);
  function paint() { btn.textContent = L("btn"); btn.hidden = !(tray.length && msgBox.textContent.trim()); if (btn.hidden) status.textContent = ""; }

  const trayLink = () => { const code = encodeTray(tray); if (!code) return ""; const u = new URL("menu.html", location.href); u.hash = "tray=" + code; return u.href; };
  function loadImage(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  async function draw() {
    const ar = lang() === "ar";
    const fontFam = ar ? '"AZAL Arabic", serif' : '"Source Serif 4", Georgia, serif', sans = ar ? '"AZAL Arabic", sans-serif' : '"Source Sans 3", Arial, sans-serif';
    if (ar && document.fonts && document.fonts.load) { try { await document.fonts.load('48px "AZAL Arabic"', "سفرة"); } catch {} }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.fillStyle = "#F8F1E7"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#42220E"; x.fillRect(0, 0, W, 300);
    const logo = await loadImage("assets/azal-logo-white.svg");
    if (logo) { const h = 190, w = h * (logo.width / logo.height || 1.2); x.drawImage(logo, (W - w) / 2, 55, w, h); }
    x.direction = ar ? "rtl" : "ltr"; x.textAlign = ar ? "right" : "left";
    const edge = ar ? W - 90 : 90;
    x.fillStyle = "#42220E"; x.font = `600 64px ${fontFam}`; x.fillText(L("title"), edge, 420);
    x.fillStyle = "#914820"; x.font = `400 40px ${sans}`; x.fillText(L("sub"), edge, 480);
    const { shown, more, count } = cardLines(tray, byId, lang());
    let y = 590;
    for (const l of shown) {
      x.fillStyle = "#CD8E2D"; x.font = `700 44px ${sans}`;
      const qty = l.qty + "×";
      x.fillText(qty, edge, y);
      x.fillStyle = "#42220E"; x.font = `500 46px ${sans}`;
      const nameLines = wrapName(l.name, W - 290, (t) => x.measureText(t).width);
      nameLines.forEach((t, i) => x.fillText(t, ar ? edge - 110 : edge + 110, y + i * 54, W - 290));
      y += (nameLines.length - 1) * 54;
      x.strokeStyle = "rgba(66,34,14,.12)"; x.lineWidth = 2; x.beginPath(); x.moveTo(90, y + 30); x.lineTo(W - 90, y + 30); x.stroke();
      y += 74;
    }
    if (more) { x.fillStyle = "#914820"; x.font = `500 40px ${sans}`; x.fillText(L("more", { n: more }), edge, y); y += 64; }
    x.fillStyle = "#42220E"; x.font = `700 40px ${sans}`; x.fillText(L("items", { n: count }), edge, Math.max(y + 20, 1180));
    x.fillStyle = "#6B5848"; x.font = `400 30px ${sans}`; x.textAlign = "center"; x.direction = "ltr"; x.fillText(L("note"), W / 2, H - 60);
    const link = trayLink(); // v2: the link that reopens this exact tray, printed on the card for apps that drop text
    if (link) { x.fillStyle = "#914820"; x.font = `500 24px "Source Sans 3", Arial, sans-serif`; x.fillText(link, W / 2, H - 104, W - 120); }
    return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  }
  btn.addEventListener("click", async () => {
    status.textContent = "";
    let blob = null;
    try { blob = await draw(); } catch {}
    if (!blob) { status.textContent = L("fail"); return; }
    const file = new File([blob], "azal-sufra.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { await navigator.share({ files: [file], title: L("title"), text: L("open", { link: trayLink() }) }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "azal-sufra.png"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = L("made");
  });
  new MutationObserver(paint).observe(msgBox, { childList: true, characterData: true, subtree: true });

  // v2 receiving side: a shared tray is SHOWN first; the guest's cart changes only when they tap "Add to my order".
  const menuTop = document.querySelector("#menu .menu-top");
  function openSharedTray() {
    if (!menuTop) return;
    const got = parseTray(location.hash, (id) => Boolean(byId(id)));
    if (!got) return;
    const box = document.createElement("section"); box.className = "shared-tray"; box.setAttribute("aria-live", "polite");
    const drop = () => { try { history.replaceState(null, "", location.pathname + location.search); } catch {} };
    const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; };
    if (!got.ok || (!got.lines.length && !got.retired)) { box.append(el("p", "shared-tray-msg", L("invalid"))); menuTop.after(box); drop(); return; }
    const list = el("ul", "shared-tray-list");
    for (const l of got.lines) list.append(el("li", null, l.qty + "× " + byId(l.id).name));
    const actions = el("div", "shared-tray-actions");
    const add = el("button", "button button-gold", L("addAll")); add.type = "button";
    const later = el("button", "button share-tray", L("notNow")); later.type = "button";
    box.append(el("h2", "shared-tray-title", L("shared")), list);
    if (got.retired) box.append(el("p", "shared-tray-msg", L("retired", { n: got.retired })));
    box.append(el("p", "shared-tray-note", L("trayNote")));
    if (got.lines.length) actions.append(add);
    actions.append(later); box.append(actions);
    add.addEventListener("click", () => {
      for (const l of got.lines) cart.set(l.id, Math.min(50, (cart.get(l.id) || 0) + l.qty));
      if (typeof renderCart === "function") renderCart();
      box.replaceChildren(el("p", "shared-tray-msg", L("addedAll"))); drop();
    });
    later.addEventListener("click", () => { box.remove(); drop(); });
    menuTop.after(box);
  }
  openSharedTray();
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  paint();
})(typeof window !== "undefined" ? window : globalThis);
