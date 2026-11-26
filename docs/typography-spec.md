# AZAL typography — decision and values (Claude, 2026-11-25)

**Decision (one, not options):** Source Sans 3 for body and UI, Source Serif 4 for display headings. Both are open source (SIL OFL 1.1), self-hosted. DM Sans and Playfair Display are removed. This is binding for P1 v2 together with the five points in `MUSE-REPLY.md` (22:10 ruling).

Why, in one line each: it matches the brand kit's Source Sans; open apertures stay legible at phone sizes; full Latin-extended coverage for French; tabular figures for prices; one designer's superfamily so the pairing is coherent; removes the Google Fonts third-party request.

## Tokens (paste into `:root`)

```css
:root{
  --font-body:'Source Sans 3','Segoe UI',Arial,sans-serif;
  --font-display:'Source Serif 4',Georgia,'Times New Roman',serif;

  /* mobile-first sizes; desktop overrides at min-width:900px */
  --fs-body:16px;      /* paragraphs, descriptions */   /* desktop 17px */
  --fs-small:14px;     /* secondary sentences, notes */
  --fs-label:12px;     /* uppercase labels, the floor: nothing renders below 12px */
  --fs-button:14px;
  --fs-dish:20px;      /* dish name in the mobile row */ /* desktop 24px */
  --fs-h2:clamp(32px,6vw,56px);
  --fs-h1:clamp(40px,9vw,76px);

  --muted:#6B5848;     /* 6.01:1 on ivory #F8F1E7, 6.49:1 on cream #fffaf3 */
}
```

## Rules

| Element | Family | Size / line-height | Weight | Other |
|---|---|---|---|---|
| Body, descriptions | body | 16px / 1.6 (desktop 17px / 1.6) | 400 | max line length 65ch |
| Secondary text | body | 14px / 1.5 | 400 | color `--muted` only; never below 14px for full sentences |
| Uppercase labels, eyebrows, sample notes | body | 12px / 1.3 | 700 | `letter-spacing:.12em`; min 12px, no exceptions (replaces all 7–10px uses) |
| Buttons, tabs | body | 14px | 600 | `letter-spacing:.06em`; `min-height:44px` (primary 48px); never a fixed width (French strings run 20–30% longer) |
| Inputs (search, name, etc.) | body | 16px | 400 | below 16px iOS Safari zooms the page on focus |
| Prices | body | 16px | 600 | `font-variant-numeric:tabular-nums` |
| Dish name | display | 20px / 1.2 mobile, 24px desktop | 600 | |
| H2 section | display | `--fs-h2` / 1.1 | 500 | `letter-spacing:-.02em`; italic 500 accent word in clay `#914820` on ivory |
| H1 hero | display | `--fs-h1` / 1.04 | 500 | `letter-spacing:-.02em`; italic 500 accent line in gold `#CD8E2D` on brown only (5.12:1) |

Color rule (from C5): gold `#CD8E2D` is never text on ivory (2.50:1). On ivory, accents and hover text use clay `#914820` (5.94:1).

## Loading

- Self-host woff2 in `assets/fonts/`: Source Sans 3 (variable, weights 400–700) and Source Serif 4 (variable upright + italic, weights 500–600). Subsets Latin and Latin-ext via `unicode-range`. Keep the OFL license text next to the files.
- `font-display:swap`; preload only Source Sans 3 upright and Source Serif 4 upright.
- Remove the `fonts.googleapis.com` and `fonts.gstatic.com` links from `index.html`.
- I could not download the font files (my sandbox has no internet). Source: the official Adobe `source-sans` and `source-serif` repositories or Google Fonts' download. Whoever fetches them should record the source URL and commit hash here.

## Arabic

The site has no Arabic text yet except the wordmark, which stays the official SVG. The logo-reference fonts (AM Thulth and similar) are reference-only per BOARD A2 and must not be embedded. When an Arabic locale is built: Noto Naskh Arabic for body, Noto Kufi Arabic for display (both open), with `dir="rtl"` and the same size floor; decide then, not tonight.

## Check

`node tests/design-audit.mjs` measures the floors above (body 16px, no text under 12px, search input 16px, muted contrast, tap targets). A passing audit is necessary, not sufficient: Muse's live QA judges how the pairing actually looks, which I cannot do offline.
