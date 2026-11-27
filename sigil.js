/* AZAL "Pickup sigil" (Claude, creative sprint V8). The 6-hex pickup code ("3F9A0C") is hard to say aloud and means
   nothing in Arabic or French, and calling a guest's name across the counter leaks who they are. The sigil is an icon,
   a word and a number derived ONLY from the order id: the guest's confirmation and the staff ticket compute the same one,
   so nothing new is stored or sent. The hex code stays visible underneath. 16 icons x 90 numbers = 1,440 sigils; the staff
   screen flags any two active orders that share one (collisions()). */
(function (root) {
  "use strict";
  const ICONS = [
    ["🌙", "Moon", "Lune", "قمر"], ["⭐", "Star", "Étoile", "نجمة"], ["🌴", "Palm", "Palmier", "نخلة"], ["🐪", "Camel", "Chameau", "جمل"],
    ["☕", "Coffee", "Café", "قهوة"], ["🍯", "Honey", "Miel", "عسل"], ["🌶️", "Pepper", "Piment", "فلفل"], ["🍋", "Lemon", "Citron", "ليمون"],
    ["🍞", "Bread", "Pain", "خبز"], ["🌹", "Rose", "Rose", "وردة"], ["🐟", "Fish", "Poisson", "سمكة"], ["🍇", "Grape", "Raisin", "عنب"],
    ["🌾", "Wheat", "Blé", "قمح"], ["☀️", "Sun", "Soleil", "شمس"], ["⛰️", "Mountain", "Montagne", "جبل"], ["🕊️", "Dove", "Colombe", "حمامة"]
  ];
  const COL = { en: 1, fr: 2, ar: 3 };
  // Same id -> same sigil on every screen. Returns null for anything that is not a hex id (callers keep the hex code).
  function sigil(id) {
    const hex = String(id || "").replace(/-/g, "");
    if (!/^[0-9a-f]{8}/i.test(hex)) return null;
    const n = parseInt(hex.slice(0, 8), 16);
    const i = n % 16, num = 10 + (Math.floor(n / 16) % 90);
    return { icon: ICONS[i][0], index: i, num, key: i + "-" + num, word: (lang) => ICONS[i][COL[lang] || 1] };
  }
  const code = (id) => String(id || "").slice(0, 6).toUpperCase();
  // "🌙 Moon 42" in the given language (digits stay Latin, matching the site's ar-CA-u-nu-latn locale).
  function label(id, lang) { const s = sigil(id); return s ? s.icon + " " + s.word(lang) + " " + s.num : code(id); }
  // Ids whose sigil is shared by another id in the list (the staff screen shows their hex code large).
  function collisions(ids) {
    const seen = new Map();
    for (const id of ids) { const s = sigil(id); if (!s) continue; if (!seen.has(s.key)) seen.set(s.key, []); seen.get(s.key).push(id); }
    const out = new Set();
    for (const list of seen.values()) if (list.length > 1) list.forEach((x) => out.add(x));
    return out;
  }
  const api = { ICONS, sigil, label, code, collisions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AzalSigil = api;
})(typeof window !== "undefined" ? window : globalThis);
