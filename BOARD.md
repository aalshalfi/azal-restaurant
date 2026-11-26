# AZAL — Task board and file claims

Updated by whoever works. See `COORDINATION.md` for the rules. Last organized: 2026-11-25 (Toronto).

## Claims (file locks)

| File | Owner | Task | Since (Toronto) | Notes |
|---|---|---|---|---|
| none | | | | Claim for CI2 released by Claude (work is on branch `claude/ci-runtime-smoke`, nothing on `main`). |

## Open tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| C8 | EN/FR switch does nothing | Muse merged, Muse re-QA'd | **Done — merged `f884ec3`, live QA passed desktop 20:03 EST** | Lead cherry-picked Claude's fix commit `90f89b5` (branch carried stale parallel BOARD/COORDINATION copies, so a full merge would have conflicted; branch superseded, do not merge). Live: FR toggle translates all 9 cards, French search/filters work, cart survives EN→FR→EN, Sufra guide in FR, demo notices intact. Mobile width + `lang` attribute direct read still unverified (browser could not resize/inspect). |
| C9 | Header "YOUR ORDER" button wraps to two lines, badge overlaps text | ChatGPT | Desktop verified; mobile header pending | Fix commit `8e93e9d` verified live by Muse at desktop 1920 px (19:42 EST): single line, no wrap or overlap. Narrow/mobile header still unverified — QA browser cannot resize. |
| C6 | Four wrong dish photos: Hummus (shows a chocolate drink), Fahsa (rice plate), Mango Juice (assorted smoothies), Adeni Chai (clear tea with bag) | ChatGPT + Muse | Open | Replace only with images whose source and rights are clear. Keep them labelled as illustrative. |
| M1 | Favicon visual check in a real browser tab | Muse | File repaired; tab visual pending | File repaired by Muse (commit `2c5ded22`): valid SVG, 163,768 B, loads live with no XML error. Browser-tab visual still unconfirmed (screenshots do not show the tab strip). |
| A1 | Arabic wordmark "أَزَال" shows as boxes in the QA browser | Muse | Open | Likely a missing font in the QA environment. Verify on a real device. |
| S1 | Sufra Compass v1 prototype | Muse | **QA passed 19:42 EST (EN); FR regression after C8 merge** | Live QA passed: all three guide buttons, search clearing, tab sync, keyboard, cart, demo checkout. Critique given in `MUSE-REPLY.md`. One new finding filed as C10. FR half of QA waits on the C8 merge. |
| B1 | Brand-experience brief: Majlis AZAL, community content, multi-branch model | ChatGPT drafts, Muse reviews | Open | What is live now, what is visibly "Phase 2", what must never be faked. |
| CI2 | Runtime smoke test in CI (language switch, menu, cart, translation keys) | Muse merged | **Done — merged `efe955c`, 5/5 pass** | `tests/smoke.test.mjs` + one step in `site-check.yml`. Verified 5/5 locally against the C8-fixed tree and in-repo after merge. Merge order C8→CI2 respected. |
| C10 | Search × guide trap: typing a search while a guide is active ANDs with the category filter and can strand the guest on an empty menu with no hint | ChatGPT (Muse asked 19:42 EST) | Open | Repro: guide "Start with sides" active, type "mandi" → 0 dishes ("No dishes match that search."), guide card stays selected. Fix options: clear the guide when search input starts, or show a hint that the guide is filtering. Muse will not edit `script.js` while the C8 merge is pending. |

| G1 | Team work plan: fixed roles, decision tiers A/B/C, two-eyes merge gate, cadence throttle, owner reporting | All three | **Adopted by owner 2026-11-25** | Full text in `MUSE-REPLY.md` (19:47 EST section). Claude to fold into `COORDINATION.md`. **Amended 2026-11-25 19:56: Muse leads the team and owns owner summaries (see MUSE-REPLY.md).** |

| D1 | Design elevation pass — owner first impression: interface underwhelming. Hero art direction, type hierarchy, spacing rhythm, imagery treatment (palette/logo rules unchanged) | ChatGPT builds, Claude critiques, Muse gates | **Open — TOP PRIORITY (lead decision 2026-11-25 20:00)** | Bar: impressive at first sight, not merely functional. |

| F1 | FULL-BUILD scope (owner directive 2026-11-25 20:04): complete integrated site incl. real backend, customer accounts, Majlis membership/points — "demo" means unlaunched/internal only, never partial. Architecture & plan first | Muse leads plan, ChatGPT builds, Claude reviews | **Open — P1 architecture note posted `docs/f1-architecture.md` 20:12 EST, awaiting Claude review before any implementation** | Adapt proven Supabase blueprint (Yemen Gate v5.4); branches table from day one, HST 13% server-side, bilingual menu fields, Majlis memberships table, branch hours; points rates/tiers still Tier C pending owner. P2 (staging backend) after Claude review. |

| G2 | Collaboration dynamic + capacity-aware roles (owner directive 2026-11-25 20:08): Muse leads by eliciting ideas/questions, not restricting; Claude capacity LIMITED (unsubscribed) — batched high-value asks only; ChatGPT subscribed — implementation volume; Muse builds too | Muse (lead) | **Adopted** | First idea round posted in MUSE-REPLY.md 20:08 section. |

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
