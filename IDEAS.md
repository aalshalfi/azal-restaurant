# AZAL — Innovation ledger

This ledger tracks original product and hospitality ideas. Any points, rewards, menu combinations, and interactions shown before launch are illustrative prototypes only.

| Idea | Status | Decision / rationale |
|---|---|---|
| Majlis AZAL — a hospitality-led membership layer | Proposed | Strong brand fit; keep as a concept until real transactions, consent, and approved reward rules exist. |
| Sufra Compass (بوصلة السفرة) | In prototype — built, live QA pending | A three-choice, mood-first shortcut: **Something warming** → Traditional, **Fragrant rice** → Rice & meat, **Start with sides** → Sides. One tap filters the illustrative menu and moves the guest to it. This is safer and clearer than abstract Comfort / Explore / Share labels because each promise maps to an existing sample-menu category; it makes no portion, pairing, allergen, availability, or timing claims. Mobile-first, bilingual, no account or personal data. |
| Majlis Memory / saved preferences | Deferred | Useful after launch, but requires accounts and personal-data handling; do not simulate persistent customer profiles in the current static site. |
| Live conversational ordering assistant | Deferred | High potential, but current menu facts, allergy data, stock, prices, and ordering backend are not verified. A demo can be explored only after menu data is structured and clearly labelled. |
| Pickup readiness prediction | Deferred | Requires real kitchen timing and order data; do not invent preparation estimates. |


## Prototype quality gate — 2026-11-25 (Toronto)

| Check | Result | Notes |
|---|---|---|
| Reduces steps | Pass by design | One tap selects a sample category and scrolls to the menu; no second confirmation step. |
| Simple and elegant | Pass by design | Three short choices, using the existing AZAL palette and typography. |
| Mobile-first | Pass by design | Three cards on larger screens; stacked, thumb-friendly cards on narrow screens. |
| Bilingual | Implemented | English and French labels, status text, and accessible group label. |
| Safety / truthfulness | Pass by design | Uses only existing sample categories; no AI, allergy guarantees, serving-size claims, real availability, or real orders. |
| Live verification | Pending | GitHub Pages publication and interactive browser QA still need confirmation. |

**Decision:** keep the prototype in testing until the published page passes first-load, keyboard, mobile, and EN/FR checks. If it adds friction or the category mapping feels unnatural after Muse review, simplify or remove it.


**Verification update — 2026-11-25 (Toronto):** GitHub Actions `Site checks` passed on commit `c1dff35925d7e7d112b250014b40ad1495fbed5a`; GitHub Pages build and deployment also completed successfully for the same commit. Interactive testing against the rendered live page is still pending because the browser inspection route was unavailable in this run. Muse has been asked to perform live desktop/mobile and bilingual QA.
