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


## 2026-11-25 — Sufra Circle (سفرة معًا): one shared basket for a gathering

**Status:** Proposed — backend-dependent; no customer-facing prototype yet.

**Concept:** An optional group-order mode for a family or gathering. The host starts one temporary Sufra Circle and shares a short-lived invite link or QR. Guests open the same bilingual sample menu and add their own selections to one shared basket. The host remains in control of the final review, pickup slot and single checkout. A normal solo order stays exactly as simple as it is; the group mode appears only when the host chooses it.

**What makes it distinct:** It translates the Yemeni habit of gathering around one sufra into a digital hosting ritual: guests contribute, while one host brings the table together. It is not a generic group-cart feature with a loyalty badge layered on top. The shared basket is the product; the Majlis tone is quiet and welcoming, not gamified or pushy.

**Guest value:** The host no longer has to collect everyone's choices in messages and re-enter them item by item. Guests can choose for themselves, while the host gets one consolidated review and one pickup plan. It is valuable for families and groups, but never forced on a solo guest.

### Quality gate

| Check | Evaluation | Design condition |
|---|---|---|
| Reduces steps? | **Pass for group orders; neutral for solo orders** | Replaces the host's manual collection and transcription of several orders. Keep it optional and out of the default solo path. |
| Simple and elegant? | **Conditional pass** | One action to start, one invite, one shared basket, one host-controlled review. No chat room, comments, polls, streaks or extra loyalty layer. |
| Mobile-first? | **Pass by design** | Share-sheet link/QR, one-column item list, large add controls, clear contributor labels, and a persistent host summary; no horizontal interaction. |
| Safe / truthful now? | **Not ready to build** | Requires server-side shared-cart concurrency, expiring invite tokens, host-only checkout authority, item/price snapshots, duplicate protection, abuse limits and privacy review. No guest names, phone numbers or payment details should be required just to contribute. |

**AI boundary:** Do not put a chatbot between the guest and the menu. A later, optional “help me shape the sufra” suggestion may use AI only against owner-approved menu, serving-size, allergen and availability data, with the guest in control. If those facts are absent, show no recommendation rather than guessing.

**Prototype decision:** Defer the prototype until the core single-customer order flow and backend are stable (after P3 at the earliest), and until Muse approves the interaction direction. A later prototype must be local-only with synthetic guests and sample items, no network sharing, no accounts, no personal data, and an obvious reset. Do not add this to the current P1 page while D1 is still awaiting a unified visual direction.

### Research notes — 2026-11-25 (Toronto)

- Starbucks Canada describes order-ahead as menu exploration, customization, choosing a store, receiving readiness guidance and saving favourites for next time: https://www.starbucks.ca/en-ca/ways-to-order
- Tim Hortons' Canadian help centre explains a clear in-store handoff using a Mobile Pickup sign and an order tagged with the guest name, order number and items: https://help.timhortons.ca/hc/en-ca/articles/35658215389211-Where-do-I-pick-up-my-mobile-order-in-restaurant
- McDonald's Canada says mobile orders earn MyMcDonald's Rewards points automatically, avoiding a separate scan step in that channel: https://www.mcdonalds.com/ca/en-ca/getmoremcds/mymcdonaldsrewards.html
- Chipotle's April 13, 2026 Rewards relaunch centralizes the points tracker, redemption progress, challenges and offers, and adds more flexible redemption choices: https://newsroom.chipotle.com/2026-04-13-CHIPOTLE-RELAUNCHES-REWARDS-WITH-REWARDS-ON-REPEAT%2C-DELIVERING-MORE-VALUE-WITHOUT-TRADE-OFFS
- Recent restaurant-retention guidance argues that personalization should make an ordinary order easier, not add another step, and that AI should solve a specific guest or operations problem: https://www.lsretail.com/resources/technology-driven-strategies-to-win-customer-loyalty-in-fast-food

**Synthesis for AZAL:** Preserve the useful mechanics (fast order-ahead, clear pickup handoff, automatic earned rewards after an eligible completed transaction, visible reward progress), but do not copy any chain's brand, wording or interface. The distinct opportunity is to make a group sufra easier to coordinate without slowing the ordinary order. AI stays optional and menu-grounded; the core experience remains human, direct and hospitable.

**Decision:** Keep Sufra Circle as a proposed post-P3 experiment. Do not implement until the single-order journey, branch rules and server-side order authority are proven.


## 2026-11-25 — I3: Sufra Balance Cue (ميزان السفرة)

**Status:** Proposed — post-core-cart experiment; Muse critique requested. No code or customer data added.

**Concept:** A quiet, optional one-line summary inside the basket groups the current items by the menu's verified categories (for example, rice & meat, sides, drinks). It shows only the mix already in the basket; it does not recommend missing dishes, infer portions, or label a basket as incomplete.

**What makes it distinct:** It treats the basket as a host's view of the shared sufra, not merely a transaction total. The guest can see the spread at a glance while keeping full control. It uses only the in-memory basket and the menu taxonomy; no profile, order history, AI model, or saved preference is needed.

**Guest value:** A host can check the variety of a family/group basket without reopening each item or mentally counting categories. Solo guests can ignore it; it never interrupts adding an item or checkout.

### Quality gate

| Check | Evaluation | Design condition |
|---|---|---|
| Reduces steps? | **Pass for basket scanning; neutral for item selection** | One glance replaces manually scanning each line; no extra tap or prompt. |
| Simple and elegant? | **Conditional pass** | Show one restrained text line only when two or more verified categories are present; no score, warning, upsell or progress bar. |
| Mobile-first? | **Pass by design** | Wrap naturally within the basket drawer; no chart, horizontal scroll or small controls. |
| Safe / truthful now? | **Safe as a local-only prototype, but defer** | Use synthetic sample items and current in-memory cart only. Do not infer serving sizes, allergens, availability or what a family “needs.” Wait until the core basket UI and canonical menu taxonomy are stable. |

**AI decision:** No AI is needed. If a future assistant is considered, it must only use owner-approved menu/serving facts and remain optional; the balance cue itself should remain deterministic.

**Decision:** Keep as a proposed post-P3 refinement. Do not add it to the current P1 screen; first finish the menu-first hierarchy and reliable cart. Ask Muse to critique whether the cue adds hospitality or merely noise, and whether the two-category display threshold is appropriate.
