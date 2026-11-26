/* AZAL "Bread Clock" (Claude, creative sprint V6). Teaches the one gesture that makes a Yemeni meal: on dishes that
   our own menu says are eaten with bread, a small "How to eat it" control opens a three-step strip
   (tear · scoop · eat). Facts come only from the existing dish stories (fahsa: scooped with warm bread; saltah: eaten
   with bread; sahawiq: made for tearing bread into). Client-only; no data; reduced-motion safe; EN/FR/AR. */
(function (root) {
  "use strict";
  const BREAD_DISHES = [4, 5, 6]; // Fahsa, Saltah, Sahawiq & Fresh Bread (see their story lines in script.js)
  const api = { BREAD_DISHES };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const S = {
    en: { how: "How to eat it", hide: "Hide", tear: "Tear a piece of bread", scoop: "Scoop, no spoon needed", eat: "Eat, and pass the bread", label: "Eaten with bread, in three steps" },
    fr: { how: "Comment le manger", hide: "Masquer", tear: "Déchirez un morceau de pain", scoop: "Saucez, sans cuillère", eat: "Mangez, et passez le pain", label: "Se mange avec du pain, en trois gestes" },
    ar: { how: "كيف تأكله", hide: "إخفاء", tear: "اقطع قطعة خبز", scoop: "اغرف بها، بلا ملعقة", eat: "كُل، ومرّر الخبز", label: "يؤكل بالخبز، في ثلاث خطوات" }
  };
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const L = (k) => S[lang()][k];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const SVGNS = "http://www.w3.org/2000/svg";
  // Three tiny line drawings in the palette: a torn piece, a scoop over a bowl, a hand lifting.
  const PATHS = {
    tear: ["M4 15c2-5 6-8 11-8 2 0 4 1 5 3l-3 2 2 2-3 1 1 3c-5 1-10 0-13-3z"],
    scoop: ["M3 14h18c0 4-4 7-9 7s-9-3-9-7z", "M8 11c2-3 5-5 9-4l-2 3"],
    eat: ["M6 20c0-4 2-7 6-8l3-6", "M15 6l3 1-1 3", "M5 20h10"]
  };
  function icon(kind) {
    const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "bread-icon");
    for (const d of PATHS[kind]) { const p = document.createElementNS(SVGNS, "path"); p.setAttribute("d", d); svg.append(p); }
    return svg;
  }
  function decorate() {
    for (const id of BREAD_DISHES) {
      const card = grid.querySelector(`[data-add="${id}"]`)?.closest(".product-card");
      if (!card || card.querySelector(".bread-how")) continue;
      const info = card.querySelector(".product-info") || card;
      const wrap = el("div", "bread-how");
      const btn = el("button", "bread-toggle text-link dark-link", L("how")); btn.type = "button"; btn.setAttribute("aria-expanded", "false");
      const strip = el("ol", "bread-steps"); strip.hidden = true; strip.setAttribute("aria-label", L("label")); strip.id = "bread-steps-" + id; btn.setAttribute("aria-controls", strip.id);
      for (const k of ["tear", "scoop", "eat"]) { const li = el("li", "bread-step"); li.append(icon(k), el("span", null, L(k))); strip.append(li); }
      btn.addEventListener("click", () => { const open = strip.hidden; strip.hidden = !open; btn.setAttribute("aria-expanded", String(open)); btn.textContent = open ? L("hide") : L("how"); });
      wrap.append(btn, strip);
      const story = info.querySelector(".dish-story");
      if (story) story.after(wrap); else info.append(wrap);
    }
  }
  new MutationObserver(decorate).observe(grid, { childList: true }); // the menu re-renders on filter and language change
  decorate();
})(typeof window !== "undefined" ? window : globalThis);
