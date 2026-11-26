# AZAL — Task board and file claims

Updated by whoever works. See `COORDINATION.md` for the rules. Last organized: 2026-11-25 (Toronto).

## Claims (file locks)

| File | Owner | Task | Since (Toronto) | Notes |
|---|---|---|---|---|
| none | | | | C6 image/credit changes committed on `chatgpt/c6-illustrative-photo-fixes-20261125`, PR #5 open; awaiting CI and visual QA. |



## Open tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| C8 | EN/FR switch does nothing | Muse merged, Muse re-QA'd | **Done — merged `f884ec3`, live QA passed desktop 20:03 EST** | Lead cherry-picked Claude's fix commit `90f89b5` (branch carried stale parallel BOARD/COORDINATION copies, so a full merge would have conflicted; branch superseded, do not merge). Live: FR toggle translates all 9 cards, French search/filters work, cart survives EN→FR→EN, Sufra guide in FR, demo notices intact. Mobile width + `lang` attribute direct read still unverified (browser could not resize/inspect). |
| C9 | Header "YOUR ORDER" button wraps to two lines, badge overlaps text | ChatGPT | Desktop verified; mobile header pending | Fix commit `8e93e9d` verified live by Muse at desktop 1920 px (19:42 EST): single line, no wrap or overlap. Narrow/mobile header still unverified — QA browser cannot resize. |
| C6 | Four mismatched illustrative dish photos | ChatGPT implements, Muse gates | **PR #5 open — image source/attribution patch drafted; CI + live EN/FR desktop/mobile review pending** | Replacements: Hummus → `HummusLebanese.jpg` (Dumarest, CC BY-SA 3.0); Fahsa → `خبز ملوح.jpg` (SharabSalam, CC BY-SA 4.0 — correction to earlier board attribution); Adeni Chai illustrative tea image → `Chai_In_Sakora.jpg` (Dadhichbittu007, CC BY-SA 4.0); Mango juice → `Mango_juice.JPG` (Vyom25, CC BY-SA 4.0). Footer includes visible source/author/licence credits and EN/FR credit label. Files: `script.js`, `index.html`. No actual AZAL photography is implied. PR #5: https://github.com/aalshalfi/azal-restaurant/pull/5. |
| M1 | Favicon visual check in a real browser tab | Muse | File repaired; tab visual pending | File repaired by Muse (commit `2c5ded22`): valid SVG, 163,768 B, loads live with no XML error. Browser-tab visual still unconfirmed (screenshots do not show the tab strip). |
| A1 | Arabic wordmark "أَزَال" shows as boxes in the QA browser | Muse | Open | Likely a missing font in the QA environment. Verify on a real device. |
| S1 | Sufra Compass v1 prototype | Muse | **QA passed 19:42 EST (EN); FR regression after C8 merge** | Live QA passed: all three guide buttons, search clearing, tab sync, keyboard, cart, demo checkout. Critique given in `MUSE-REPLY.md`. One new finding filed as C10. FR half of QA waits on the C8 merge. |
| B1 | Brand-experience brief: Majlis AZAL, community content, multi-branch model | ChatGPT drafts, Muse reviews | **Concept direction drafted; Muse critique requested** | Sufra Thread, Majlis Welcome Note, and a static bilingual Majlis Journal are recorded in `CHATGPT-REPLY.md`; no facts, rewards, or personal-data collection are activated. |
| CI2 | Runtime smoke test in CI (language switch, menu, cart, translation keys) | Muse merged | **Done — merged `efe955c`, 5/5 pass** | `tests/smoke.test.mjs` + one step in `site-check.yml`. Verified 5/5 locally against the C8-fixed tree and in-repo after merge. Merge order C8→CI2 respected. |
| C10 | Search × guide trap: typing a search while a guide is active ANDs with the category filter and can strand the guest on an empty menu with no hint | Muse (lead) | **Done — fixed `92a8477`, live QA passed desktop 20:33 EST** | Typing a non-empty search now clears the active guide, resets the tab to All and the status line to initial. Smoke test added (6/6 pass). Live: "Start with sides" → 2 sides; "mandi" → guide deselected, both mandi dishes shown; clear search → 9 dishes. Deploy lag noted: first load ~2 min after push still served the old build. |

| G1 | Team work plan: fixed roles, decision tiers A/B/C, two-eyes merge gate, cadence throttle, owner reporting | All three | **Adopted by owner 2026-11-25** | Full text in `MUSE-REPLY.md` (19:47 EST section). Claude to fold into `COORDINATION.md`. **Amended 2026-11-25 19:56: Muse leads the team and owns owner summaries (see MUSE-REPLY.md).** |

| D1 | Design elevation pass — owner first impression: interface underwhelming. Hero art direction, type hierarchy, spacing rhythm, imagery treatment (palette/logo rules unchanged) | ChatGPT builds, Claude critiques, Muse gates | **Reopened 2026-11-25 21:01 EST — owner explicitly rejects current visual direction; independent critique requested from Muse + Claude** | Previous Welcome Arch merge `d7199cb` remains technically merged and desktop/FR QA passed, but that is not design approval. Hold C11 polish and any new decorative hero work pending team critique of the owner's full-page mobile screenshot. Reassess first-screen purpose, page length, menu density, image gaps, appetite appeal, brand distinctiveness and thumb-first order path. Mobile viewport still not independently verified. Request recorded in `CHATGPT-REPLY.md` commit `9c5d7ae`. **Muse independent critique posted MUSE-REPLY.md 21:09 EST section — verdict: reject as a landing-page direction, propose "Sufra-first" (menu is the first screen, compact scannable cards, arch demoted to a motif). Claude's critique still pending; decision rule stands — no polish until a coherent direction is agreed.** |
| C11 | Hero-bottom right text "YEMENI ROOTS · CANADIAN FUTURE" sits on pale wood at the photo's bottom edge — readable but low contrast | ChatGPT (D1 owner) | **Held — per D1 decision rule (21:01 EST); do not polish a direction that may be replaced** | Fix options (when direction settles): bottom scrim on the shade, or move the row clear of the photo. CSS-only, live QA after. |

| F1 | Full build: real backend + customer accounts + Majlis AZAL (owner scope correction 2026-11-25) | ChatGPT (owner directive 21:14; Muse gates) | **P1 review + P2 schema foundation drafted — PR #4 open, awaiting Muse review; not merged or deployed** | `docs/f1-review.md` + `supabase/migrations/0001_azal_staging.sql` in `chatgpt/f1-p2-staging-schema-20261125-v2`. Branch is 2 commits ahead / 0 behind latest main. Architecture review records three decisions/gaps; SQL includes bilingual catalogue, branch prices/options, profiles/roles/staff scope, memberships, order snapshots/events, points ledger, payment audit placeholders, RLS and least-privilege grants. Only Ottawa concept branch/13% planning tax seeded; no hours, users, final menu, rewards or provider. SQL not run: no owner-created staging DB. PR #4: https://github.com/aalshalfi/azal-restaurant/pull/4. PR #3 closed as superseded, not merged. Next: Muse security/schema review; staging migration + RLS/function tests after owner creates project. |


| G2 | Collaboration dynamic + capacity-aware roles (owner directive 2026-11-25 20:08): Muse leads by eliciting ideas/questions, not restricting; Claude capacity LIMITED (unsubscribed) — batched high-value asks only; ChatGPT subscribed — implementation volume; Muse builds too | Muse (lead) | **Adopted** | First idea round posted in MUSE-REPLY.md 20:08 section. |

| A2 | Adopt official brand assets on the site | Muse (lead) implemented the core swap 2026-11-25 21:1x | PARTLY DONE — live-verified: White primary SVG in footer (ivory plate retired), official Symbol SVG as favicon, smoke 6/6. Remaining: Horizontal variant placement + brand-font evaluation (Source Sans Pro; AM Thulth for Arabic display) — ChatGPT. | Logo-reference custom fonts are reference-only — do not embed. C6 food photos NOT covered by this package. |

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
