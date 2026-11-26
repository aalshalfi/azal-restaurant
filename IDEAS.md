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


## 2026-11-25 — Sufra Thread (خيط السفرة): owner-verified menu stories

**Status:** Proposed — content validation gate; not implemented.

**Concept:** Each approved dish may offer one optional, concise “table note” that explains a verified ingredient, regional connection, preparation tradition, or place in Yemeni hospitality. The note expands inline on the same menu card; it never sends the guest to another page, starts a chat, or asks for personal information.

**What makes it distinct:** It turns the menu into a quiet act of hosting rather than a catalogue or a generic AI chatbot. The content is curated from owner-approved facts, not generated from guesses. It complements Sufra Compass without creating another mandatory step.

**Guest value:** A first-time guest can understand an unfamiliar dish and choose with more confidence without leaving the menu or searching elsewhere.

**Quality gate:**
- **Fewer steps:** Pass only if optional and inline; no new screen, form, or forced question.
- **Simple and elegant:** One short note per dish; no long essays, badges, or modal interruptions.
- **Mobile-first:** Expand in place with a large tap target and readable line length; no horizontal carousel.
- **Truthfulness:** Blocked until AZAL supplies/approves each note. Do not invent ingredients, origins, preparation, serving customs, spice level, allergens, or health claims.

**Decision:** Keep as a content-gated proposal. Do not build the story layer until the owner provides verified source notes. A visually polished empty placeholder would add noise rather than value.

## 2026-11-25 — D1 prototype: AZAL Welcome Arch

**Status:** Feature branch prototype — review required.

The hero receives a CSS-only arch composition using the existing sample image and existing palette. The arch is a restrained visual cue for entering a welcoming space; it does not claim to depict AZAL's real premises or Yemeni architecture. Existing logo, copy, image URL, menu, and demo behavior remain unchanged.

| Check | Result | Reason |
|---|---|---|
| Reduces steps | Neutral / pass | Visual treatment adds no controls or interaction steps. |
| Simple and elegant | Pass by design | One clear hero message, one primary menu action, one secondary story action; decoration stays behind content. |
| Mobile-first | Pass by design, live QA pending | Arch frame is removed at 800px and below; the existing full-bleed image treatment remains with stronger contrast. |
| Brand / truthfulness | Pass by design | Existing AZAL palette and logo retained; no new factual claims or assets. |
| CI verification | Pass | Site checks #25 passed on PR head `ce16a61`; syntax, smoke tests, and Sufra bilingual markup checks are green. |
| Live verification | Pending | PR is not merged; requires two-eyes review, Pages deploy, and live EN/FR desktop/mobile QA. |


## Additional concept checks — 2026-11-25

| Idea | Reduces steps? | Simple and elegant? | Mobile-first? | Status / decision |
|---|---|---|---|---|
| Majlis Welcome Note | Pass if it appears automatically after a confirmed paid-and-handed-over order; no scan or extra claim step. | Pass if it is one short owner-written thank-you, not a badge feed or points dashboard. | Pass if it is a compact card inside the member account, without a forced push notification. | Proposed / post-launch gate. Requires real order confirmation, approved content, account controls, and owner-approved loyalty terms. Do not simulate it in the public concept site. |
| Majlis Journal | Neutral for checkout steps; it must never interrupt or gate the menu. | Pass if it is a small curated bilingual journal, not an endless social feed. | Pass if it is a simple vertical reading list with short entries and accessible text. | Proposed / pre-opening content gate. Static and data-free, but every cultural or historical statement must be owner-approved; no comments, sign-up wall, or email capture. |

**Cross-idea decision:** Do not add streaks, spin-to-win, pressure-based challenges, or notification-led engagement as a default loyalty mechanic. They add activity without necessarily improving hospitality. Prefer quiet recognition, useful context, and reduced repeat effort.
