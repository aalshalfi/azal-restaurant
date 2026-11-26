# AZAL — Task board and file claims

Updated by whoever works. See `COORDINATION.md` for the rules. Last organized: 2026-11-25 (Toronto).

## Claims (file locks)

| File | Owner | Task | Since (Toronto) | Notes |
|---|---|---|---|---|
| none | | | | Claim for CI2 released by Claude (work is on branch `claude/ci-runtime-smoke`, nothing on `main`). |

## Open tasks

| ID | Task | Owner | Status | Notes |
|---|---|---|---|---|
| C8 | EN/FR switch does nothing | ChatGPT merges, Muse re-QAs | **Fix verified on branch; merge waiting for Muse QA report** | Confirmed actual branch commit `90f89b514dca543ccdff6dd220c9f9545a5f2aaf` changes only `document.document.documentElement.dir` to `document.documentElement.dir`. `main` still has the runtime error. Muse's latest reply says S1 QA is in progress and explicitly asks to wait for its report before moving the target. ChatGPT has replied in `CHATGPT-REPLY.md`; merge after Muse commits the S1 report, then verify Pages deployment and request full EN↔FR regression. |
| C9 | Header "YOUR ORDER" button wraps to two lines, badge overlaps text | ChatGPT | Open | `styles.css`. Add `white-space:nowrap`, check mobile header. |
| C6 | Four wrong dish photos: Hummus (shows a chocolate drink), Fahsa (rice plate), Mango Juice (assorted smoothies), Adeni Chai (clear tea with bag) | ChatGPT + Muse | Open | Replace only with images whose source and rights are clear. Keep them labelled as illustrative. |
| C7 | Card button stays "Added ✓" after removing the item from the cart drawer | Muse to re-test | Needs re-test | Current `main` re-renders products after a cart change, so this may already be fixed. Reproduce on the live URL before changing anything. |
| M1 | Favicon visual check in a real browser tab | Muse | Open | File exists on the server. Visual check pending. |
| A1 | Arabic wordmark "أَزَال" shows as boxes in the QA browser | Muse | Open | Likely a missing font in the QA environment. Verify on a real device. |
| S1 | Sufra Compass v1 prototype | Muse | Built, awaiting QA and critique | Pushed with CI "Site checks" passing. Muse to QA EN↔FR, guide buttons, search, tabs, keyboard, reduced motion, and critique the three labels. |
| B1 | Brand-experience brief: Majlis AZAL, community content, multi-branch model | ChatGPT drafts, Muse reviews | Open | What is live now, what is visibly "Phase 2", what must never be faked. |
| CI2 | Runtime smoke test in CI (language switch, menu, cart, translation keys) | ChatGPT merges after C8 | **Ready on branch `claude/ci-runtime-smoke` (commit `191221f`)** | Dependency-free `tests/smoke.test.mjs` plus one step in `site-check.yml`. Local result: fails on current `main` with the C8 TypeError, passes 5/5 with the C8 fix. **Merge order: C8 first, then CI2**, otherwise "Site checks" turns red on `main`. It uses a fake DOM, so it does not replace live QA. |

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
