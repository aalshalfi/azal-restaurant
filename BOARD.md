# AZAL — Task board and file claims

Updated by whoever works. See `COORDINATION.md` for the rules. Last organized: 2026-11-25 (Toronto).

## Claims (file locks)

| File | Owner | Task | Since (Toronto) | Notes |
|---|---|---|---|---|
| index.html, styles.css, script.js | ChatGPT | P1 design v2 (branch chatgpt/p1-design-v2) | 2026-11-25 22:00 EST | Pre-claimed by lead (GO order, MUSE-REPLY 22:00). C6 claim released with merge 95cacad. |



## Open tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| C8 | EN/FR switch does nothing | Muse merged, Muse re-QA'd | **Done — merged `f884ec3`, live QA passed desktop 20:03 EST** | Lead cherry-picked Claude's fix commit `90f89b5` (branch carried stale parallel BOARD/COORDINATION copies, so a full merge would have conflicted; branch superseded, do not merge). Live: FR toggle translates all 9 cards, French search/filters work, cart survives EN→FR→EN, Sufra guide in FR, demo notices intact. Mobile width + `lang` attribute direct read still unverified (browser could not resize/inspect). |
| C9 | Header "YOUR ORDER" button wraps to two lines, badge overlaps text | ChatGPT | Desktop verified; mobile header pending | Fix commit `8e93e9d` verified live by Muse at desktop 1920 px (19:42 EST): single line, no wrap or overlap. Narrow/mobile header still unverified — QA browser cannot resize. |
| C6 | Four mismatched illustrative dish photos | ChatGPT implements, Muse gates | **Done — merged `95cacad`, live QA passed desktop EN+FR 21:37 EST** | All four new photos verified live on the published site: Hummus (bowl, chickpeas, olive oil), Fahsa (mulawah + stone bowl of stew), Adeni Chai (milky tea poured into clay cup), Mango Juice (pot of mango juice with ladle — container is a pot, not a glass; accepted as illustrative, subject unambiguous). Footer credits visible with verified Commons links; EN/FR translate; demo notices intact; cart resyncs after removal. Mobile width still unverified (QA browser cannot resize). PR #6 merged; PR #5 closed as superseded. |
| M1 | Favicon visual check in a real browser tab | Muse | File repaired; tab visual pending | File repaired by Muse (commit `2c5ded22`): valid SVG, 163,768 B, loads live with no XML error. Browser-tab visual still unconfirmed (screenshots do not show the tab strip). |
| A1 | Arabic wordmark "أَزَال" shows as boxes in the QA browser | Muse | Open | Likely a missing font in the QA environment. Verify on a real device. |
| S1 | Sufra Compass v1 prototype | Muse | **QA passed 19:42 EST (EN); FR regression after C8 merge** | Live QA passed: all three guide buttons, search clearing, tab sync, keyboard, cart, demo checkout. Critique given in `MUSE-REPLY.md`. One new finding filed as C10. FR half of QA waits on the C8 merge. |
| B1 | Brand-experience brief: Majlis AZAL, community content, multi-branch model | ChatGPT drafts, Muse reviews | **Concept direction drafted; Muse critique requested** | Sufra Thread, Majlis Welcome Note, and a static bilingual Majlis Journal are recorded in `CHATGPT-REPLY.md`; no facts, rewards, or personal-data collection are activated. |
| CI2 | Runtime smoke test in CI (language switch, menu, cart, translation keys) | Muse merged | **Done — merged `efe955c`, 5/5 pass** | `tests/smoke.test.mjs` + one step in `site-check.yml`. Verified 5/5 locally against the C8-fixed tree and in-repo after merge. Merge order C8→CI2 respected. |
| C10 | Search × guide trap: typing a search while a guide is active ANDs with the category filter and can strand the guest on an empty menu with no hint | Muse (lead) | **Done — fixed `92a8477`, live QA passed desktop 20:33 EST** | Typing a non-empty search now clears the active guide, resets the tab to All and the status line to initial. Smoke test added (6/6 pass). Live: "Start with sides" → 2 sides; "mandi" → guide deselected, both mandi dishes shown; clear search → 9 dishes. Deploy lag noted: first load ~2 min after push still served the old build. |

| G1 | Team work plan: fixed roles, decision tiers A/B/C, two-eyes merge gate, cadence throttle, owner reporting | All three | **Adopted by owner 2026-11-25** | Full text in `MUSE-REPLY.md` (19:47 EST section). Claude to fold into `COORDINATION.md`. **Amended 2026-11-25 19:56: Muse leads the team and owns owner summaries (see MUSE-REPLY.md).** |

| D1 | Design elevation pass — owner first impression: interface underwhelming. Hero art direction, type hierarchy, spacing rhythm, imagery treatment (palette/logo rules unchanged) | ChatGPT builds, Claude critiques, Muse gates | **Reopened 2026-11-25 21:01 EST — owner explicitly rejects current visual direction; independent critique requested from Muse + Claude** | Previous Welcome Arch merge `d7199cb` remains technically merged and desktop/FR QA passed, but that is not design approval. Hold C11 polish and any new decorative hero work pending team critique of the owner's full-page mobile screenshot. Reassess first-screen purpose, page length, menu density, image gaps, appetite appeal, brand distinctiveness and thumb-first order path. Mobile viewport still not independently verified. Request recorded in `CHATGPT-REPLY.md` commit `9c5d7ae`. **Muse independent critique posted MUSE-REPLY.md 21:09 EST section — verdict: reject as a landing-page direction, propose "Sufra-first" (menu is the first screen, compact scannable cards, arch demoted to a motif). Claude's critique posted in CLAUDE-REPLY.md (2026-11-25 21:59 Toronto section); decision rule stands — no polish until a coherent direction is agreed.** |
| C11 | Hero-bottom right text "YEMENI ROOTS · CANADIAN FUTURE" sits on pale wood at the photo's bottom edge — readable but low contrast | ChatGPT (D1 owner) | **Held — per D1 decision rule (21:01 EST); do not polish a direction that may be replaced** | Fix options (when direction settles): bottom scrim on the shade, or move the row clear of the photo. CSS-only, live QA after. |

| F1 | Full build: real backend + customer accounts + Majlis AZAL (owner scope correction 2026-11-25) | ChatGPT (owner directive 21:14; Muse gates) | **Muse review posted 21:30 — 3 must-fixes, merge HELD; branch needs refresh + fix (package P2-FIX, due Nov 26)** | `docs/f1-review.md` + `supabase/migrations/0001_azal_staging.sql` in `chatgpt/f1-p2-staging-schema-20261125-v2`. Must-fixes (MUSE-REPLY.md 21:30): F1-R1 admin join in `azal_staff_can_access()` locks out branch-less admins (fail-closed); F1-R2 no per-order earn uniqueness on `points_ledger` (add v5.4-style partial unique indexes); F1-R3 no profile-creation path (add `handle_new_user()` trigger). Ottawa concept seed KEPT (planning metadata only). SQL not run: no owner-created staging DB. PR #4: https://github.com/aalshalfi/azal-restaurant/pull/4. PR #3 closed as superseded, not merged. Next: ChatGPT fixes + refreshes; Muse re-reviews, then merges; staging migration + RLS/function tests after owner creates project (P2 start Nov 29). |


| G2 | Team leadership + capacity-aware execution (owner directive 2026-11-25 21:52): Muse is accountable lead from today; ChatGPT primary implementation capacity; Claude reserved for rare batched high-value reviews | Muse (accountable lead) | **Operating report published — MUSE-REPLY.md 21:30 section (method, rhythm, roles, status, ranked P1–P5 plan, owner requests, risk register)** | First work packages assigned: P2-FIX (PR #4 remediation, due Nov 26) and A2-TYPE (typography research note, docs-only, due Nov 27). Next owner checkpoint: Sat Nov 28 (P1 design v2). 9 PM window retired — `COORDINATION.md` fold done by Claude (section 8). |

| A2 | Adopt official brand assets on the site | Muse (lead) implemented the core swap 2026-11-25 21:1x | PARTLY DONE — live-verified: White primary SVG in footer (ivory plate retired), official Symbol SVG as favicon, smoke 6/6. Remaining: Horizontal variant placement + brand-font evaluation (Source Sans Pro; AM Thulth for Arabic display) — ChatGPT. | Logo-reference custom fonts are reference-only — do not embed. C6 food photos NOT covered by this package. |


## Phases & deadlines (owner charter 2026-11-25 — see ROADMAP.md)
- P1 Design & experience: Nov 26–28 (ChatGPT) — design v2 live, C6/C5/C11/A2-typography
- P2 Backend foundation: Nov 29–Dec 1 — schema + auth on staging (owner creates Supabase project at phase start)
- P3 Ordering end-to-end: Dec 2–5 — real test order → staff screen, HST + hours server-side
- P4 Majlis AZAL loyalty: Dec 6–8 — earn/redeem, member QR (rates decision at checkpoint)
- P5 Hardening & launch prep: Dec 9–11 — suites, security, payments last (owner-approved), launch on owner's word only

| C-REV | Verify ChatGPT's P2-FIX (3 must-fixes on PR #4) against Yemen Gate v5.4 semantics; verdict in CLAUDE-REPLY.md | Claude | Open — assigned 2026-11-25 21:58 (post-subscription) | Muse makes the merge call with Claude's verdict in hand. |
| C-DES | P1 design-v2 critique: hierarchy, mobile behaviour, accessibility — concrete fixes, before the Nov 28 checkpoint | Claude | Open — assigned 2026-11-25 21:58 | Reviews ChatGPT's v2 when posted; Muse gates the merge. |
| C-TST | Test design for P3 ordering flows (cart → checkout → persistence seams), extending the runtime smoke approach | Claude | Open — assigned 2026-11-25 21:58 | Tests designed ahead of P3 implementation (Dec 2–5). |

## Pending owner (real-world facts, do not guess)

- Final menu, prices and dish photography.
- Address, phone, opening hours, social accounts.
- Rules for rewards and points before any real transaction exists.
- Which supplied images are approved for publishing.

## Done

| ID | Task | Commit |
|---|---|---|
| C1 | Hardened `script.js` render and event wiring | see `CHATGPT-REPLY.md` |
| C2b | Menu images converted to `img` with lazy loading | e051d49, 7d76e0e |
| C3 | French draft copy `fr-draft.md` | see `CHATGPT-REPLY.md` |
| I1 | Innovation ledger `IDEAS.md` | 4a0fe41 |
| CI1 | GitHub Actions "Site checks" workflow | c1dff35 |
| C7 | Card button stays "Added ✓" after removing the item from the cart drawer | Re-tested live by Muse 19:42 EST: button resyncs after removal (products re-render on cart change). No code change needed. |

| M2 | Mobile viewport check of the current site (390 px) | Claude | **Done 2026-11-25 21:59 (local render, not live)** | Local Playwright render of repo files. No horizontal overflow; cart reachable only after opening the hamburger. Photos and web fonts are blocked in Claude's sandbox, so imagery and typography are NOT judged. Details in CLAUDE-REPLY.md. Muse should still confirm on a real phone. |
