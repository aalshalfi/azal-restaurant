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


## 2026-11-25 — Claude's v3 Menu and Majlis proposals (recorded by ChatGPT)

### 1. Sufra for N — سفرة لـ N

**What:** One calm question at the top of Menu: how many people are at the table (2 / 4 / 6 / 8). One tap proposes an editable shared spread from approved menu combinations, then adds it to the sample cart in one step.

**What makes it distinct:** It composes a whole table rather than filtering individual dishes (Sufra Compass) or letting multiple guests collaborate in one cart (Sufra Circle). It reflects Yemeni shared-meal behaviour without copying a competitor's flow.

**Guest value:** Potentially replaces 5–8 individual add actions with one choice and a balanced starting point.

| Quality check | Evaluation |
|---|---|
| Reduces steps | Pass if one group-size tap proposes the spread and one add action; fail if it adds a multi-step wizard. |
| Simple and elegant | Pass as one compact card with editable sample items; no modal or chat. |
| Mobile-first | Pass as four large horizontal chips at 390px; the spread preview stays compact. |
| Truthfulness / status | **Proposed — recommended first Menu prototype, awaiting Muse ranking.** Use clearly labelled sample combinations only; real portions and combinations require owner approval (Tier C). |

### 2. Say it right — dish-name pronunciation

**What:** An optional small “Say it” chip under a dish name, initially text-only with an owner-approved Latin-letter pronunciation. Audio can be added later only from staff-recorded clips.

**What makes it distinct:** It solves a real first-time guest hesitation without adding a chatbot, extra page, or promotional interaction.

**Guest value:** Guests can order unfamiliar Yemeni dish names more confidently and with less friction.

| Quality check | Evaluation |
|---|---|
| Reduces steps | Neutral / pass — it does not shorten checkout, but may remove the need to search elsewhere. |
| Simple and elegant | Pass if optional, one short line, and never louder than the dish name. |
| Mobile-first | Pass with a 44px minimum tap target and no audio autoplay. |
| Truthfulness / status | **Proposed — text-only prototype after owner approves spellings.** No fabricated audio or unapproved transliterations. |

### 3. Iftar & Eid pickup window

**What:** A future pickup-time helper that can show slots relative to local sunset (for example, a slot around iftar) and group-pickup capacity on selected high-demand days.

**What makes it distinct:** It treats pickup timing as a meaningful hospitality constraint rather than a generic clock-time list.

**Guest value:** Less uncertainty about when to arrive; clearer kitchen demand by slot.

| Quality check | Evaluation |
|---|---|
| Reduces steps | Potential pass if the right slot is suggested; not useful if it adds date questions. |
| Simple and elegant | Conditional — show only during owner-approved periods, never a permanent extra control. |
| Mobile-first | Pass as a short vertical slot list with clear capacity states. |
| Truthfulness / status | **Deferred to P3.** Requires owner-confirmed opening/iftar availability and kitchen capacity; compute dates rather than hardcoding Ramadan/Eid dates. No hours or slots may be invented. |

### 4. Diyafa — ضيافة guest invitations

**What:** A future Majlis benefit that lets an eligible member gift a tea or dessert invitation to a guest using a one-time pickup code after a defined number of completed orders.

**What makes it distinct:** It turns loyalty from self-reward into generosity and hosting, without streaks, spin-to-win, or pressure notifications.

**Guest value:** A reason to return that feels like inviting someone to the table, and a warm introduction for a new guest.

| Quality check | Evaluation |
|---|---|
| Reduces steps | Neutral — must be a one-tap gift from the member page, not a claim form. |
| Simple and elegant | Pass if the invitation is one quiet card and one code; no reward feed. |
| Mobile-first | Pass as a compact member-page card with a copyable one-time code. |
| Truthfulness / status | **Concept only — P4.** Requires owner-approved reward rules/costs and a ledger design; no code, points, or reward promise until approved. |

### 5. Sufra Circle — shared group cart

**What:** An optional shared-cart session where guests can add sample dishes to one table cart while a host keeps final review control.

**What makes it distinct:** Unlike Sufra for N, it does not compose a spread; it coordinates multiple contributors to one cart.

**Guest value:** Less back-and-forth for families and groups choosing together.

| Quality check | Evaluation |
|---|---|
| Reduces steps | Pass for groups only; adds steps for solo diners, so it must never be the default. |
| Simple and elegant | Conditional — one invite link and one host review; no chat or account requirement. |
| Mobile-first | Conditional — each contributor needs a clear add/undo path and the host needs a compact live summary. |
| Truthfulness / status | **Deferred until after the individual order flow is stable.** Requires safe session tokens, sync, expiry and privacy rules; prototype with fixtures only, no real shared orders. |

**Muse ranking request:** Please rank Sufra for N and Say it right for the v3 Menu page. Keep Iftar & Eid for P3, Diyafa for P4, and Sufra Circle deferred until the individual ordering flow is stable.

## 2026-11-25 — Reservation UX research note (ChatGPT)

### 6. No dead-end availability

**What:** When real availability is connected, an unavailable date/time should immediately offer a small set of genuinely available alternatives and a clear “choose another date” path. A waitlist option appears only if the restaurant has an approved, staffed waitlist workflow.

**What makes it distinct:** It treats an unavailable slot as a guided next step, not an error state. It must read from the same capacity source as the host view and must never invent times or overbook to make the screen look helpful.

**Guest value:** Fewer abandoned bookings and less back-and-forth when a preferred time is unavailable.

| Quality check | Evaluation |
|---|---|
| Reduces steps | Pass — alternatives are offered in the same view instead of forcing a restart. |
| Simple and elegant | Pass if limited to a few true alternatives; no calendar maze or upsell. |
| Mobile-first | Pass as large tap targets in a short vertical list, with a clear back/change-date action. |
| Truthfulness / status | **Proposed for R1/P3 after capacity, service days and floor plan are confirmed.** No sample slots or waitlist promise before real inventory exists. |

**Research basis:** Toast Canada recommends one-tap booking entry points and alternatives rather than dead ends; ServeAround's 2026 mobile-booking guidance stresses thumb-sized controls and a clear confirmation; Ava's 2026 setup guide puts table inventory, party-size rules, service periods and a staff soft-launch before public opening. AZAL's version remains capacity-first and does not copy any provider's UI.