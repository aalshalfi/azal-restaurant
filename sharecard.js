/* AZAL "Sufra share card" (Claude, creative sprint V7). One tap in the cart turns the tray into a clean picture the
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
  const api = { cardLines, W, H, MAX_LINES };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  const bottom = document.querySelector(".cart-bottom");
  if (!bottom || typeof cart === "undefined") return;
  const S = {
    en: { btn: "Share this tray", title: "Our sufra from AZAL", sub: "Add anything?", more: "+{n} more", items: "{n} items", note: "Example menu and prices · preview", made: "Picture made", fail: "Couldn’t make the picture. Try again." },
    fr: { btn: "Partager ce plateau", title: "Notre sufra chez AZAL", sub: "On ajoute quelque chose ?", more: "+{n} de plus", items: "{n} articles", note: "Menu et prix d’exemple · aperçu", made: "Image créée", fail: "Impossible de créer l’image. Réessayez." },
    ar: { btn: "شارك هذه السفرة", title: "سفرتنا من أزال", sub: "تضيفون شيئاً؟", more: "+{n} أخرى", items: "{n} أصناف", note: "قائمة وأسعار للعرض · معاينة", made: "تم إنشاء الصورة", fail: "تعذّر إنشاء الصورة. حاول مرة أخرى." }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k, v) => { let s = S[lang()][k]; for (const x in v || {}) s = s.split("{" + x + "}").join(v[x]); return s; };
  const byId = (id) => { try { const p = products.find((x) => x.id === id); return p ? (typeof localizedProduct === "function" ? localizedProduct(p) : p) : null; } catch { return null; } };

  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "button share-tray"; btn.id = "shareTray";
  const status = document.createElement("p"); status.className = "share-status"; status.setAttribute("role", "status");
  bottom.append(btn, status);
  function paint() { btn.textContent = L("btn"); btn.hidden = !(cart && cart.size > 0); }

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
    const { shown, more, count } = cardLines(cart.entries(), byId, lang());
    let y = 590;
    for (const l of shown) {
      x.fillStyle = "#CD8E2D"; x.font = `700 44px ${sans}`;
      const qty = l.qty + "×";
      x.fillText(qty, edge, y);
      x.fillStyle = "#42220E"; x.font = `500 46px ${sans}`;
      x.fillText(l.name, ar ? edge - 110 : edge + 110, y, W - 290);
      x.strokeStyle = "rgba(66,34,14,.12)"; x.lineWidth = 2; x.beginPath(); x.moveTo(90, y + 30); x.lineTo(W - 90, y + 30); x.stroke();
      y += 74;
    }
    if (more) { x.fillStyle = "#914820"; x.font = `500 40px ${sans}`; x.fillText(L("more", { n: more }), edge, y); y += 64; }
    x.fillStyle = "#42220E"; x.font = `700 40px ${sans}`; x.fillText(L("items", { n: count }), edge, Math.max(y + 20, 1180));
    x.fillStyle = "#6B5848"; x.font = `400 30px ${sans}`; x.textAlign = "center"; x.direction = "ltr"; x.fillText(L("note"), W / 2, H - 60);
    return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  }
  btn.addEventListener("click", async () => {
    status.textContent = "";
    let blob = null;
    try { blob = await draw(); } catch {}
    if (!blob) { status.textContent = L("fail"); return; }
    const file = new File([blob], "azal-sufra.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) { await navigator.share({ files: [file], title: L("title") }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "azal-sufra.png"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = L("made");
  });
  const cartItems = document.getElementById("cartItems");
  if (cartItems) new MutationObserver(paint).observe(cartItems, { childList: true, subtree: true });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  paint();
})(typeof window !== "undefined" ? window : globalThis);
