# Handoff note for Muse — AZAL website

This file is a coordination note for the AI/developer agent working on this repository. Please read it before making further changes.

## Project context
- Repository: https://github.com/aalshalfi/azal-restaurant
- Brand: AZAL — a Yemeni restaurant concept in development.
- Important: there is not yet a confirmed operating restaurant, branch address, opening schedule, final menu, or live ordering/payment system.
- Preserve the existing AZAL logo and supplied brand palette. Do not redesign the logo.
- Brand palette: deep brown #42220E, heritage gold #CD8E2D, clay #914820, ivory #F8F1E7.

## Recent work already committed
Recent updates on `main` include:
- Improved homepage copy and concept-preview messaging.
- Added Open Graph and basic social-sharing metadata.
- Added a live menu search field alongside category filters.
- Added skip navigation, clearer mobile navigation labeling, keyboard Escape handling, focus styles, and reduced-motion support.
- Kept sample dishes/prices and demo checkout clearly marked as illustrative only.

Please inspect the current `index.html`, `styles.css`, and `script.js` before editing; do not assume this note describes every current line.

## What we want you to do
1. Review the site against excellent restaurant websites: clear visual hierarchy, appetite appeal, mobile-first usability, fast loading, accessible navigation, and a simple path through the menu.
2. Compare patterns from strong restaurant websites, but create an original AZAL experience. Do not copy another restaurant's branding or layout verbatim.
3. Audit the current implementation for broken interactions, responsive issues, accessibility problems, SEO basics, image performance, and maintainability.
4. Recommend and implement only improvements that make sense for a restaurant concept that is not open yet.
5. Keep all sample food items and prices visibly identified as examples. Do not imply that visitors can place real orders.
6. Do not invent a physical address, phone number, opening hours, social accounts, customer reviews, awards, delivery coverage, or business claims.
7. Do not connect real payments, delivery platforms, reservations, or customer-data collection.
8. Preserve the existing logo and palette. If you believe a change is necessary, explain why before changing the brand identity.

## Coordination / safety
- Make changes in a focused, reviewable way and summarize every changed file.
- Do not delete assets or rewrite large sections unnecessarily.
- Do not claim deployment succeeded unless you verify the published URL.
- If a decision requires information from the owner (real menu, location, photos, contact details), leave a clear TODO and ask rather than guessing.
- Please reply with your audit findings, the improvements you made, and any owner decisions still needed.

This note is a handoff message only. It does not grant permission to invent business details or activate real customer-facing transactions.


## OWNER AUTHORIZATION — AUTONOMOUS WEBSITE DEVELOPMENT (2026-11-25)
The owner grants ChatGPT and Muse ongoing permission to independently plan, implement, improve, test, and refine the AZAL website without requesting approval for each routine development decision.

### Authorized work
- Implement design, layout, responsive, accessibility, SEO, performance, code-quality, and reliability improvements.
- Build a polished bilingual English/French experience, including a language switch and translated interface/copy.
- Keep illustrative/demo food photography for now. Muse may use suitable images already available in the owner's supplied project/brand assets when their source and usage rights are clear; otherwise use clearly illustrative assets with appropriate rights. Do not represent stock images as actual AZAL food photography.
- Keep the sample menu, sample prices, cart, and checkout visible as a demo. Clearly state that no real order is transmitted and no payment is collected.
- Improve demo interactions and test the published site after changes.
- Coordinate directly through the repository reply files; do not wait for per-task approval.

### Boundaries that remain in force
- Never invent or publish a real address, phone number, hours, final menu/prices, social accounts, reviews, awards, delivery coverage, or other unconfirmed business facts.
- Never activate real ordering, payment processing, reservations, delivery integrations, or collection of customer personal/payment data.
- Do not spend money, purchase domains/services, create paid subscriptions, or change account/billing settings.
- Preserve the AZAL logo and brand palette (#42220E, #CD8E2D, #914820, #F8F1E7); do not make a brand-identity change.
- Do not delete source assets or perform destructive/irreversible repository or deployment actions. Use focused commits and preserve rollback paths.
- If a task crosses one of these boundaries or requires a real-world business fact, leave it clearly marked as pending rather than asking about routine design choices.
- Verify builds and the live URL before reporting success. Report commits, changed files, test results, and blockers.

This authorization replaces any earlier instruction to pause for approval on routine design, bilingual presentation, demo imagery, or other ordinary website-development decisions.

## TEAM OPERATING UPDATE — 2026-11-26 (Toronto)

The current collaboration workflow and decision boundaries are defined in `COORDINATION.md`, `TEAM-DIRECTION.md`, `ROADMAP.md`, and the task board. Read those files before taking work; this section is a concise operational pointer, not a replacement for them.

### Current verified state
- P2 backfill branch: `muse/p2-backfill`, PR #27, head `432dce8`.
- Claude's local PostgreSQL 16 + Supabase-stub C-REV on that exact head: **PASS**. Baseline-only checks were 32 PASS / 16 known FAIL; baseline + 0002 were 50 PASS / 0 FAIL. Dirty-baseline backfill produced 6 profiles for 6 auth users; reapplying 0002 succeeded. Node suite: 88/88.
- These are local harness results, **not** proof of a successful apply to the real staging project.
- No staging SQL apply or live Q1–Q13 before/after evidence is recorded here. Do not claim P2 is complete until Muse records the controlled staging run and Claude reviews the live outputs.
- PR #9 is superseded by PR #27; do not revive or force-push its branch.

### Next P2 sequence
1. Muse confirms the correct staging project/environment and that the approved backup/rollback and Q1–Q13 procedure are ready.
2. Muse runs the documented baseline 0001 → 0002 staging sequence, capturing Q1–Q13 before and after. Do not run against production or any unverified project.
3. Claude reviews the exact live outputs and posts final C-REV PASS/FAIL.
4. Muse records the result and next gate on `BOARD.md`. Keep Auth wiring, customer data, real orders, payments and reservations inactive until their separate roadmap gates and owner authorizations.

### Collaboration expectations
- Muse is accountable team lead, QA and release gate; ChatGPT is primary build/product capacity; Claude is for batched deep review, root-cause analysis and test work.
- Use the reply files and `BOARD.md` for explicit handoffs. Each agent writes only its own reply file and its own board rows.
- When asking ChatGPT for work, give a concrete task, target file/branch, acceptance criteria and any dependency. ChatGPT should likewise post clear, numbered questions rather than assume that silence means agreement.
- Continue safe Tier A work without waiting for routine owner approval. Escalate only real-world facts, money/billing, destructive/irreversible actions, or other Tier C decisions.

## Reservations and Majlis rulings — 2026-11-26 (Toronto)

### Reservations (R1) — specification only; not authorized to go live
Owner-supplied details recorded in `docs/reservations-spec.md`: capacity described as "up to 50 people" (currently interpreted as 50 total seats; still confirm if that meant largest party), 60-minute dining duration, 11:00–21:00 hours, no deposit, and email notification channel. Muse's provisional configuration is daily service, 30-minute slot starts, max online party 10, 60-minute minimum lead time, 30-day booking window, and cancellation any time before the slot. These provisional defaults are not all owner-confirmed. Still missing: operating days confirmation, whether 50 means seats or party size, largest party policy, actual receiving email and sender/service, final cancellation policy, and explicit go-live authorization. The reservation page remains inert; do not collect guest details or send emails until Muse records the required approvals and the real notification channel is configured.

### Majlis / membership and owner test mandate
The owner wants to personally test the complete member loop: register → place an order → add customer order notes → see points. Claude is the primary builder for the sequence; Muse controls staging, sequencing and live release gates; ChatGPT performs the independent customer-experience review on the exact Claude branch and later ordering branch.

- **Auth gate:** Claude's claimed branch is `claude/auth-wiring`; scope includes Supabase email sign-up/sign-in, session state, profile creation via the approved F1-R3 trigger, member page with live status/ledger balance, and sign-out. Sign-ups stay OFF until Muse's merge gate. ChatGPT reviews EN/FR, phone-first, keyboard/accessibility, errors, privacy and owner-test usability; Muse performs live QA.
- **Ordering gate:** after Auth, the signed-in member must place a real **staging** order, with pickup selection and a customer order-notes field. Server owns prices, HST 13%, hours, availability and idempotency; no client-side trust or payment integration.
- **Points gate:** display the member's own ledger-backed balance and movements. Working draft is 10 points per $1 pre-tax; proposal baseline is 10,000 points = $10. Muse must confirm the exact redemption threshold/rules before customer-facing promises or hard-coding. Points earn only on the schema's eligible completion condition (paid AND handed over); refunds/cancellations reverse once.
- **Test-settlement dependency:** payments remain last and are not authorized. Claude/Muse must define a safe staff-controlled staging-only path to exercise the paid/handed-over points lifecycle, or identify the missing server function/schema follow-up. Never simulate payment in client code or award points to unpaid orders.
- Existing `member.html` baseline copy mentions a permanent first-100 benefit and non-expiring points. Those are proposal-level claims, not confirmed rules; reconcile the copy before enabling sign-ups.
- Detailed independent review criteria are in `docs/cx-review-checklist.md`. The review begins only against Claude's ready branch/head; no overlapping edits to his claimed files.

### Collaboration cadence
The owner requested a five-minute team cadence. This chat session cannot run a background polling loop or wake itself every five minutes; I will check the repo whenever active/continued in a turn and will not claim unattended monitoring. Muse/Claude's own configured loops remain their responsibility.

## ACCT CX review progress — 2026-11-26

PR #28 (`claude/auth-wiring`, reported head `9b7214f`) is available as a draft. ChatGPT performed an initial source review and posted findings in the PR conversation. **Do not merge or enable sign-ups on the strength of that review.** The formal GitHub review endpoint rejects a review from the connected account because it is also the PR author; the findings are therefore a conversation comment plus the ChatGPT reply log.

Blocking items raised:
1. Provision a membership row server-side. The current schema has a `memberships` table and own-row SELECT policy but no membership INSERT policy or creation trigger/function; P2's Auth trigger only creates `profiles`. Never create membership rows from browser code.
2. Remove or approve inherited copy promising a permanent Founding Member benefit and non-expiring points; align earning language with paid + handed-over semantics.
3. Replace the signed-in "Preview: points appear here once ordering opens" note with accurate live-balance wording.
4. Update the branch from latest main without rewriting history. Initial compare was 1 ahead / 6 behind; after further documentation commits the latest compare is 1 ahead / 8 behind.

ChatGPT's detailed criteria are in `docs/cx-review-checklist.md`. Re-review is pending Claude's response/fixes and a new exact head SHA; then Muse performs live QA. The fake-server suite and fake-browser walk-through are Claude-reported local evidence only, not real staging verification.
