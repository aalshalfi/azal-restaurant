# AZAL — Task board and file claims

Updated by whoever works. See `COORDINATION.md` for the rules. Last organized: 2026-11-25 (Toronto).

## Claims (file locks)

| File | Owner | Task | Since (Toronto) | Notes |
|---|---|---|---|---|
| index.html, styles.css, script.js | ChatGPT | P1 v2 (PR #8) | Released 2026-11-25 22:24 EST | Merged into main at `51ec4c94d79795d9472f73d0c168448bb801725d`; Muse live-verified the published site: smoke 10/10, sticky cart, three self-hosted @font-face rules, Source fonts/OFL, demo notices and C11 scrim intact, all five adopted points passed. |


| supabase/migrations/0002_p2_fixes.sql, docs/schema-reference/0001_azal_staging_baseline.sql, docs/f1-review.md, docs/p2-staging-apply.md, supabase/tests/p2_fix_assertions.sql, tests/p2-schema-static.test.mjs, .github/workflows/site-check.yml | ChatGPT | P2-FIX + apply prep (PR #9, branch chatgpt/p2-fix-current) | 2026-11-25 22:25 EST | R1/R2/R3 implemented; Q5 client DML hardening included. Node 22 CI queued; Claude C-REV and Muse review pending. Target ref nrnkhnmlgkjytyryinlj. No SQL applied. |

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

| D1 | Design elevation pass — owner first impression: interface underwhelming. Hero art direction, type hierarchy, spacing rhythm, imagery treatment (palette/logo rules unchanged) | ChatGPT builds, Claude critiques, Muse gates | **Done — merged to main `51ec4c94`; Muse live QA passed 10/10 (22:24 EST)** | Menu is the hero's immediate successor; Sufra Compass inline before search/filters; story below menu; sticky cart outside hamburger + fixed non-empty summary; compact 96px mobile rows; Source Sans 3 + Source Serif 4 self-hosted under OFL; body/search 16px; 12px label floor; #6B5848 contrast; C11 scrim retained; demo checkout collects no personal data and offers no delivery. Muse verified live on the published site and smoke 10/10. |
| C11 | Hero-bottom right text "YEMENI ROOTS · CANADIAN FUTURE" sits on pale wood at the photo's bottom edge — readable but low contrast | ChatGPT (D1 owner) | **Held — per D1 decision rule (21:01 EST); do not polish a direction that may be replaced** | Fix options (when direction settles): bottom scrim on the shade, or move the row clear of the photo. CSS-only, live QA after. |

| F1 | Full build: real backend + customer accounts + Majlis AZAL (owner scope correction 2026-11-25) | ChatGPT (owner directive 21:14; Muse gates) | **P2-FIX incremental patch in PR #9; CI + C-REV pending; no apply performed** | Existing staging schema is already present; do not re-run the full 0001 baseline. Deliver only `supabase/migrations/0002_p2_fixes.sql` (R1/R2/R3 + Q5 hardening). Preserve the original 0001 as a non-executable reference. Muse runs Q1–Q12 baseline, Claude C-REV static PASS, Muse applies 0002 under her hand, then Q1–Q12 rerun and Claude PASS/FAIL. No SQL applied by ChatGPT. |


| G2 | Team leadership + capacity-aware execution (owner directive 2026-11-25 21:52): Muse is accountable lead from today; ChatGPT primary implementation capacity; Claude reserved for rare batched high-value reviews | Muse (accountable lead) | **Operating report published — MUSE-REPLY.md 21:30 section (method, rhythm, roles, status, ranked P1–P5 plan, owner requests, risk register)** | First work packages assigned: P2-FIX (PR #4 remediation, due Nov 26) and A2-TYPE (typography research note, docs-only, due Nov 27). Next owner checkpoint: Sat Nov 28 (P1 design v2). 9 PM window retired — `COORDINATION.md` fold done by Claude (section 8). **Claude authority granted by Muse 22:15 (MUSE-REPLY.md): direct push to main for docs/tests/CI only; may claim unassigned Tier A tasks; no-history-rewrite confirmed. ChatGPT to set own commit identity (currently commits as aalshalfi).** |

| A2 | Adopt official brand assets on the site | Muse (lead) implemented the core swap 2026-11-25 21:1x | PARTLY DONE — live-verified: White primary SVG in footer (ivory plate retired), official Symbol SVG as favicon, smoke 6/6. Remaining: Horizontal variant placement + brand-font evaluation (Source Sans Pro; AM Thulth for Arabic display) — ChatGPT. | Logo-reference custom fonts are reference-only — do not embed. C6 food photos NOT covered by this package. |


## Phases & deadlines (owner charter 2026-11-25 — see ROADMAP.md)
- P1 Design & experience: **Nov 25 TONIGHT** (compressed by owner 22:03) — ChatGPT builds v2, Claude typography verdict + design critique tonight, Muse gates instantly
- P2 Backend foundation: Nov 26–28 — schema + auth on staging (owner creates Supabase project at phase start)
- P3 Ordering end-to-end: Nov 29–Dec 2 — real test order → staff screen, HST + hours server-side
- P4 Majlis AZAL loyalty: Dec 3–5 — earn/redeem, member QR (rates decision at checkpoint)
- P5 Hardening & launch prep: Dec 6–8 — launch-ready Dec 8 — suites, security, payments last (owner-approved), launch on owner's word only

| C-REV | Verify ChatGPT's P2-FIX (3 must-fixes on PR #4) against Yemen Gate v5.4 semantics; verdict in CLAUDE-REPLY.md | Claude | Open — assigned 2026-11-25 21:58 (post-subscription) | Muse makes the merge call with Claude's verdict in hand. Target project exists: azal, ref `nrnkhnmlgkjytyryinlj` (Muse 22:13). P2-FIX not yet posted (F1 branch head `0f5aa36`, checked 22:15). |
| C-DES | P1 design-v2 critique: hierarchy, mobile behaviour, accessibility — concrete fixes, before the Nov 28 checkpoint | Claude | **Part 1 done (typography decision `docs/typography-spec.md`, top-5 changes, audit gate `tests/design-audit.mjs`, baseline 4 pass / 9 fail on main — baseline not reproducible in Muse's VM, no playwright; CI runs the gate); part 2 FINAL posted: PASS on merged main (audit 12/1, smoke 10/10), 3 non-blocking follow-ups in CLAUDE-REPLY.md; superseded note: earlier text said final verdict runs when `chatgpt/p1-design-v2-work` posts done. Lead verified branch 22:15: 5 commits, sticky cart + Sufra-first + hero shrink + 96px compact rows present; typography tokens + C5 contrast NOT yet applied.** | Reviews ChatGPT's v2 when posted; Muse gates the merge. |
| C-TST | Test design for P3 ordering flows (cart → checkout → persistence seams), extending the runtime smoke approach | Claude | **Delivered 2026-11-25** — `docs/p3-test-design.md` (32 cases, pass criteria, P0 blockers, assumptions A1–A4) | Implementation of each case lands with P3; Muse/ChatGPT may overrule assumptions. |

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
