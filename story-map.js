/* AZAL Story page: an interactive map of Yemen (Claude, creative sprint, vote V4). Tap a region to see the dish it gives
   our menu. Regions and dish stories come ONLY from the menu's own story lines (script.js), nothing new is claimed.
   The outline is a stylised, hand-simplified silhouette (not a survey map, no borders drawn). Client-only, no data sent. */
(function (root) {
  "use strict";
  // Stylised outline from approximate lon/lat points (lon 42.5..53.2, lat 12.5..19.1), projected to a 560x300 box.
  const OUTLINE = [[42.7, 16.4], [43.3, 17.4], [44.6, 17.4], [46.4, 17.25], [47.6, 17.5], [48.8, 18.2], [52.0, 19.0], [53.1, 16.65], [52.2, 15.9], [51.2, 15.2], [49.6, 14.6], [48.6, 14.0], [47.4, 13.6], [46.0, 13.3], [45.0, 12.8], [44.0, 12.6], [43.45, 12.65], [43.25, 13.3], [42.95, 14.1], [42.9, 14.8], [42.65, 15.5]];
  const project = ([lon, lat]) => [Math.round(((lon - 42.3) / (53.5 - 42.3)) * 560), Math.round(((19.4 - lat) / (19.4 - 12.3)) * 300)];
  // Each region points at products whose story names it (ids from script.js products).
  // The SVG is decorative (aria-hidden, no pointer handlers): the tab list is the one control surface.
  const REGIONS = [
    { id: "hadramaut", short: "Hadramaut", ar: "حضرموت", shortAr: "حضرموت", at: [48.6, 15.9], products: [1, 2], en: "Hadramaut", fr: "Hadramaout" },
    { id: "sanaa", short: "Sana’a", ar: "جبال صنعاء", shortAr: "صنعاء", at: [44.2, 15.35], products: [5, 4], en: "Sana’a highlands", fr: "Hauts plateaux de Sanaa" },
    { id: "aden", short: "Aden", ar: "عدن", shortAr: "عدن", at: [45.03, 12.8], products: [8], en: "Aden", fr: "Aden" },
    { id: "tihama", short: "Tihama", ar: "تهامة، سهل البحر الأحمر", shortAr: "تهامة", at: [43.1, 14.6], products: [9], en: "Tihama, Red Sea plain", fr: "Tihama, plaine de la mer Rouge" }
  ];
  const api = { OUTLINE, REGIONS, project };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  const host = document.querySelector(".story-regions");
  if (!host) return;
  const SVGNS = "http://www.w3.org/2000/svg";
  const lang = () => { const l = document.documentElement.lang; return l === "fr" || l === "ar" ? l : "en"; };
  const S = { en: { hint: "Choose a region below to see what it brings to the table.", menu: "See it on the menu", caption: "Stylised map, for orientation only." },
    fr: { hint: "Choisissez une région ci-dessous pour voir ce qu’elle apporte à la table.", menu: "Voir au menu", caption: "Carte stylisée, à titre indicatif." },
    ar: { hint: "اختر منطقة من القائمة أدناه لترى ما تقدّمه للسفرة.", menu: "شاهدها في القائمة", caption: "خريطة مبسّطة للتوضيح فقط." } };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const product = (id) => { try { const p = products.find((x) => x.id === id); return p ? (typeof localizedProduct === "function" ? localizedProduct(p) : p) : null; } catch { return null; } };

  const wrap = el("div", "ymap"); wrap.id = "yemenMap";
  const svg = svgEl("svg", { viewBox: "0 0 560 300", class: "ymap-svg", "aria-hidden": "true", focusable: "false" });
  svg.append(svgEl("path", { d: "M" + OUTLINE.map(project).map((p) => p.join(",")).join(" L") + " Z", class: "ymap-land" }));
  const dots = new Map();
  for (const r of REGIONS) {
    const [x, y] = project(r.at);
    const g = svgEl("g", { class: "ymap-dot", "data-region": r.id });
    const label = svgEl("text", { x: x + (r.id === "tihama" ? 14 : 0), y: r.id === "aden" || r.id === "sanaa" ? y - 14 : y + 30, class: "ymap-label", "text-anchor": r.id === "tihama" ? "start" : "middle" });
    g.append(svgEl("circle", { cx: x, cy: y, r: 22, class: "ymap-halo" }), svgEl("circle", { cx: x, cy: y, r: 7, class: "ymap-core" }), label);
    svg.append(g); dots.set(r.id, g);
  }
  const list = el("div", "ymap-regions"); list.setAttribute("role", "tablist");
  const panel = el("div", "ymap-panel"); panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-live", "polite"); panel.id = "ymapPanel";
  const hint = el("p", "ymap-hint"), cap = el("p", "ymap-caption");
  wrap.append(hint, svg, list, panel, cap);
  (host.querySelector(".story-values-grid") || host).after(wrap);
  let current = REGIONS[0].id;

  function select(id, focus) { current = id; paint(); if (focus) list.querySelector(`[data-region="${id}"]`)?.focus(); }
  function paint() {
    hint.textContent = S[lang()].hint; cap.textContent = S[lang()].caption;
    list.replaceChildren(...REGIONS.map((r) => {
      const b = el("button", "ymap-tab", r[lang()]); b.type = "button"; b.dataset.region = r.id; b.id = "ymap-" + r.id;
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(r.id === current)); b.setAttribute("aria-controls", "ymapPanel"); b.tabIndex = r.id === current ? 0 : -1;
      b.addEventListener("click", () => select(r.id));
      return b;
    }));
    panel.setAttribute("aria-labelledby", "ymap-" + current);
    for (const [id, g] of dots) { g.classList.toggle("is-on", id === current); const r0 = REGIONS.find((x) => x.id === id); g.querySelector("text").textContent = lang() === "ar" ? r0.shortAr : r0.short; }
    const r = REGIONS.find((x) => x.id === current);
    panel.replaceChildren(el("h3", null, r[lang()]), ...r.products.map(product).filter(Boolean).map((p) => {
      const d = el("div", "ymap-dish"); d.append(el("strong", null, p.name), el("p", null, p.story));
      return d;
    }), Object.assign(el("a", "text-link dark-link ymap-menu", S[lang()].menu), { href: "menu.html#menu" }));
  }
  list.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = REGIONS.findIndex((r) => r.id === current), n = REGIONS.length;
    // In right-to-left pages the tab row runs right to left, so ArrowLeft moves forward (WAI-ARIA tabs pattern).
    const rtl = document.documentElement.dir === "rtl";
    const forward = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight");
    const j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (forward ? 1 : -1) + n) % n;
    select(REGIONS[j].id, true);
  });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  paint();
})(typeof window !== "undefined" ? window : globalThis);
